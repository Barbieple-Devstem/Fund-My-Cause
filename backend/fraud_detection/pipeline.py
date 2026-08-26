"""
Fraud / Anomaly Detection Pipeline (#636, #1122)

HTTP ingestion and API layer — thin handlers only.

Architecture after #1122 split
────────────────────────────────
  repository.py  — all mutable in-process state (event store, flag queue)
  scoring.py     — pure heuristic logic, no HTTP / asyncio dependencies
  pipeline.py    — this file: FastAPI app, async job queue, HTTP handlers

By keeping scoring rules in a separate module with no FastAPI dependency,
every heuristic can be unit-tested without starting an HTTP server or
setting up request contexts.  See tests_scoring_layers.py.

Backward-compatibility re-exports
────────────────────────────────────
All public symbols that tests_pipeline.py and tests_scoring.py import from
``pipeline`` are still importable from here.  The domain types and state are
delegated to the sub-modules; this file only re-exports them so existing
imports keep working without modification.

Async job queue (#904)
──────────────────────
``POST /contributions`` enqueues a ``ScoringJob`` and returns immediately
with ``{"status": "queued"}``.  The background worker (``_scoring_worker``)
dequeues jobs, calls repository + scoring functions, and updates metrics.

Dead-code audit (#900)
──────────────────────
No feature-flag conditionals, no versioned-model dispatch.
See tests_pipeline.py → test_no_dead_feature_flag_branches.

Trace-ID propagation
────────────────────
Every inbound HTTP request carries ``X-Trace-ID``.  TraceIDMiddleware
extracts or generates the value and binds it into structlog's context-var
store so every log line automatically includes ``trace_id``.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from contextlib import asynccontextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import AsyncIterator, Callable, Optional

import structlog
from fastapi import FastAPI, BackgroundTasks, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------------------
# Sub-module imports
# ---------------------------------------------------------------------------

# Repository: all mutable state lives here
import repository as _repo
from repository import (
    CampaignRecord,
    ContributionEvent,
    Flag,
    FlagReason,
    FlagSeverity,
    RefundEvent,
    append_contribution,
    append_refund,
    append_campaign,
    enqueue_flag,
    next_flag_id,
    get_contributions,
    get_refunds,
    get_campaign_records,
    get_flags,
    total_flag_count,
    mark_flag_reviewed,
    clear_all as _repo_clear_all,
)

# Scoring: pure heuristic logic
import scoring as _scoring
from scoring import (
    WASH_WINDOW_SECONDS,
    WASH_MIN_OCCURRENCES,
    SPIKE_WINDOW_SECONDS,
    SPIKE_MAX_CONTRIBUTIONS,
    DUPLICATE_JACCARD_THRESHOLD,
    DUPLICATE_SCAN_MIN_INTERVAL_SECONDS,
    scan_wash_contributions,
    scan_contribution_spikes,
    scan_duplicate_content,
    run_full_scan,
)

# ---------------------------------------------------------------------------
# Backward-compatibility aliases for tests_pipeline.py / tests_scoring.py
# that import from ``pipeline`` directly.
# ---------------------------------------------------------------------------
# These module-level lists are the same objects as in repository.py — tests
# that mutate them (e.g. _CONTRIBUTIONS.append(…)) will see the changes
# reflected in the repository and vice-versa, because Python list identity
# is preserved across assignments.

_CONTRIBUTIONS = _repo._CONTRIBUTIONS
_REFUNDS = _repo._REFUNDS
_CAMPAIGN_RECORDS = _repo._CAMPAIGN_RECORDS
_QUEUE = _repo._QUEUE

# _last_duplicate_scan_at lives in scoring.py; tests access it as
# pipeline_module._last_duplicate_scan_at so we expose it as a property-like
# module attribute.  Reads/writes go through scoring module.

def __getattr__(name: str):
    if name == "_last_duplicate_scan_at":
        return _scoring._last_duplicate_scan_at
    raise AttributeError(name)

def __setattr__(name: str, value):  # type: ignore[override]
    if name == "_last_duplicate_scan_at":
        _scoring._last_duplicate_scan_at = value
        return
    raise AttributeError(name)


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer()
        if __import__("os").getenv("LOG_FORMAT") != "json"
        else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(__import__("os").getenv("LOG_LEVEL", "INFO"))
    ),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

log: structlog.BoundLogger = structlog.get_logger("fraud_detection")

# ---------------------------------------------------------------------------
# Trace-ID convention
# ---------------------------------------------------------------------------

TRACE_ID_HEADER = "x-trace-id"
_TRACE_ID_RE = re.compile(r"^fmc-[0-9a-f]{8}-[0-9a-f]{16}$")
_trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")


def _is_valid_trace_id(value: str) -> bool:
    return bool(_TRACE_ID_RE.match(value))


# ---------------------------------------------------------------------------
# Trace-ID middleware
# ---------------------------------------------------------------------------

class TraceIDMiddleware(BaseHTTPMiddleware):
    """Extract (or generate) an X-Trace-ID for every inbound request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        raw = request.headers.get(TRACE_ID_HEADER, "")
        trace_id = raw if _is_valid_trace_id(raw) else f"unknown-{int(time.time())}"

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)
        _trace_id_var.set(trace_id)

        log.info("request_started", method=request.method, path=request.url.path)
        response: Response = await call_next(request)
        response.headers[TRACE_ID_HEADER] = trace_id
        log.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
        )
        return response


# ---------------------------------------------------------------------------
# Scoring queue (#904)
# ---------------------------------------------------------------------------

SCORING_QUEUE_MAXSIZE = 1000


@dataclass
class ContributionPayload:
    """
    Payload posted by graphql-api to ``POST /contributions``.

    Mirrors ``ContributionNotification`` in
    ``services/graphql-api/src/services/fraud-client.ts``.
    """
    campaignId: str
    contributor: str
    amount: str
    transactionHash: str
    timestamp: float


@dataclass
class ScoringJob:
    """A unit of async fraud-scoring work enqueued per incoming contribution."""
    payload: ContributionPayload
    enqueued_at: float = field(default_factory=time.time)


_scoring_queue: asyncio.Queue[ScoringJob] = asyncio.Queue(maxsize=SCORING_QUEUE_MAXSIZE)

# ---------------------------------------------------------------------------
# Queue metrics
# ---------------------------------------------------------------------------

_JOBS_PROCESSED: int = 0
_TOTAL_FLAGS_FOUND: int = 0
_AVG_LATENCY_MS_EMA: float = 0.0
_LAST_JOB_AT: Optional[float] = None
_EMA_ALPHA = 0.1


async def _scoring_worker() -> None:
    """
    Background coroutine that drains the scoring queue.

    For each job:
    1. Dequeue a ScoringJob.
    2. Store the contribution via the repository layer.
    3. Run the full heuristic scan via the scoring layer.
    4. Update metrics.
    5. Mark the task done.
    """
    global _JOBS_PROCESSED, _TOTAL_FLAGS_FOUND, _AVG_LATENCY_MS_EMA, _LAST_JOB_AT

    worker_log = log.bind(component="scoring_worker")
    worker_log.info("scoring_worker_started")

    while True:
        job: ScoringJob = await _scoring_queue.get()
        try:
            payload = job.payload

            # Store via repository (not inline in this module)
            append_contribution(ContributionEvent(
                campaign_id=payload.campaignId,
                wallet=payload.contributor,
                amount=int(payload.amount) if payload.amount.isdigit() else 0,
                timestamp=payload.timestamp,
            ))

            # Score via scoring layer
            new_flags = run_full_scan()

            processing_latency_ms = (time.time() - job.enqueued_at) * 1000
            _JOBS_PROCESSED += 1
            _TOTAL_FLAGS_FOUND += len(new_flags)
            _LAST_JOB_AT = time.time()

            if _JOBS_PROCESSED == 1:
                _AVG_LATENCY_MS_EMA = processing_latency_ms
            else:
                _AVG_LATENCY_MS_EMA = (
                    _EMA_ALPHA * processing_latency_ms
                    + (1 - _EMA_ALPHA) * _AVG_LATENCY_MS_EMA
                )

            worker_log.info(
                "job_processed",
                campaign_id=payload.campaignId,
                contributor=payload.contributor,
                new_flags=len(new_flags),
                processing_latency_ms=round(processing_latency_ms, 2),
                queue_depth_after=_scoring_queue.qsize(),
                total_jobs_processed=_JOBS_PROCESSED,
            )
        except Exception as exc:
            worker_log.error(
                "job_processing_error",
                error=str(exc),
                campaign_id=getattr(job.payload, "campaignId", "unknown"),
            )
        finally:
            _scoring_queue.task_done()


# ---------------------------------------------------------------------------
# Application lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app_: FastAPI) -> AsyncIterator[None]:
    """Start the background scoring worker on startup; cancel it on shutdown."""
    task = asyncio.create_task(_scoring_worker())
    log.info("scoring_worker_task_created")
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        log.info("scoring_worker_task_stopped")


# ---------------------------------------------------------------------------
# FastAPI app — thin HTTP handlers only
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Fund-My-Cause Fraud Detection",
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(TraceIDMiddleware)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/contributions")
async def ingest_contribution(request: Request) -> JSONResponse:
    """
    Accept a contribution notification from graphql-api and enqueue it for
    async fraud scoring.

    Returns:
      200 {"status": "queued", "queue_depth": N}  – job enqueued successfully
      503 {"error": "queue_full"}                  – queue at capacity; retry later
      422 {"error": "invalid payload"}             – malformed request body
    """
    try:
        body = await request.json()
        payload = ContributionPayload(**body)
    except Exception as exc:
        log.warning("contributions_ingest_invalid_payload", error=str(exc))
        return JSONResponse(status_code=422, content={"error": "invalid payload"})

    try:
        _scoring_queue.put_nowait(ScoringJob(payload=payload))
    except asyncio.QueueFull:
        log.warning(
            "scoring_queue_full",
            campaign_id=payload.campaignId,
            queue_depth=_scoring_queue.qsize(),
        )
        return JSONResponse(
            status_code=503,
            content={"error": "queue_full", "queue_depth": _scoring_queue.qsize()},
        )

    queue_depth = _scoring_queue.qsize()
    log.info(
        "contribution_queued",
        campaign_id=payload.campaignId,
        contributor=payload.contributor,
        amount=payload.amount,
        tx_hash=payload.transactionHash,
        queue_depth=queue_depth,
    )
    return JSONResponse(content={"status": "queued", "queue_depth": queue_depth})


@app.post("/scan")
def trigger_scan(background_tasks: BackgroundTasks) -> dict:
    """Trigger a full fraud scan asynchronously (manual trigger).

    Bypasses the duplicate-content scan's rate limit since this is an
    explicit, on-demand request for a full scan.
    """
    log.info("scan_scheduled")
    background_tasks.add_task(run_full_scan, force_duplicate_scan=True)
    return {"status": "scan_scheduled"}


@app.get("/metrics")
def get_metrics() -> dict:
    """
    Expose queue depth and job-processing metrics for monitoring (#904).

    Fields:
      queue_depth                – current number of pending scoring jobs
      total_jobs_processed       – lifetime count of successfully processed jobs
      total_flags_found          – lifetime count of fraud flags raised
      avg_processing_latency_ms  – EMA of ms from job enqueue to completion
      last_job_at                – Unix timestamp of the last processed job, or null
    """
    return {
        "queue_depth": _scoring_queue.qsize(),
        "total_jobs_processed": _JOBS_PROCESSED,
        "total_flags_found": _TOTAL_FLAGS_FOUND,
        "avg_processing_latency_ms": round(_AVG_LATENCY_MS_EMA, 3),
        "last_job_at": _LAST_JOB_AT,
    }


@app.get("/moderation-queue")
def moderation_queue(
    reviewed: Optional[bool] = None,
    reason: Optional[FlagReason] = None,
    limit: int = 50,
) -> JSONResponse:
    """
    Return flags from the moderation queue.

    Query params:
    - ``reviewed``: filter by reviewed status (omit for all)
    - ``reason``: filter by flag reason
    - ``limit``: max flags returned (default 50)
    """
    items = get_flags(reviewed=reviewed, reason=reason, limit=limit)

    log.debug(
        "moderation_queue_queried",
        returned=len(items),
        total=total_flag_count(),
    )

    return JSONResponse(content={
        "total": total_flag_count(),
        "returned": len(items),
        "flags": [
            {
                "id": f.id,
                "reason": f.reason,
                "severity": f.severity,
                "campaign_id": f.campaign_id,
                "wallet": f.wallet,
                "detail": f.detail,
                "flagged_at": f.flagged_at,
                "reviewed": f.reviewed,
            }
            for f in items
        ],
    })


@app.patch("/moderation-queue/{flag_id}/reviewed")
def mark_reviewed(flag_id: str) -> dict:
    """Mark a flag as reviewed by a moderator."""
    found = mark_flag_reviewed(flag_id)
    if found:
        log.info("flag_marked_reviewed", flag_id=flag_id)
        return {"status": "updated", "id": flag_id}
    log.warning("flag_not_found", flag_id=flag_id)
    return JSONResponse(status_code=404, content={"error": "flag not found"})
