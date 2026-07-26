"""
Fraud / Anomaly Detection Pipeline (#636)

Detects suspicious patterns over indexed contribution and campaign data:

 - Wash contributions  : same wallet contributing and immediately requesting
                         a refund in a short window, repeatedly.
 - Sudden spike        : campaign receives an unusually large number of
                         contributions in a short window.
 - Duplicate content   : campaign title/description appears nearly identical
                         to an existing campaign (Jaccard similarity).

Each check produces a ``Flag`` that is appended to a moderation queue and
surfaced via the ``/moderation-queue`` endpoint.

Heuristics and their thresholds are documented in
``docs/fraud-detection-heuristics.md``.

Trace-ID propagation
────────────────────
Every inbound HTTP request carries an ``X-Trace-ID`` header injected by the
graphql-api service (or generated fresh there for requests that arrive without
one).  A Starlette middleware extracts that value and stores it in a
``contextvars.ContextVar`` so that every ``structlog`` log line emitted during
the request lifecycle automatically includes ``trace_id`` — making it trivial
to correlate fraud-detection log entries with the originating donation request.

See ``docs/logging-conventions.md`` for the project-wide convention.
"""

from __future__ import annotations

import logging
import re
import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional

import structlog
from fastapi import FastAPI, BackgroundTasks, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# ---------------------------------------------------------------------------
# Logging — structlog configured for JSON output in production,
# coloured console output in development.
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,       # injects trace_id
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer()                # swap for JSONRenderer in prod
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

#: The canonical header name — must match TRACE_ID_HEADER in shared-utils.
TRACE_ID_HEADER = "x-trace-id"

#: Valid Fund-My-Cause trace IDs match this pattern.
_TRACE_ID_RE = re.compile(r"^fmc-[0-9a-f]{8}-[0-9a-f]{16}$")

#: Holds the trace ID for the current request.  structlog middleware reads
#: this to bind ``trace_id`` onto every log line inside the request.
_trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")


def _is_valid_trace_id(value: str) -> bool:
    return bool(_TRACE_ID_RE.match(value))


# ---------------------------------------------------------------------------
# Trace-ID middleware
# ---------------------------------------------------------------------------

class TraceIDMiddleware(BaseHTTPMiddleware):
    """
    Extract (or generate) an X-Trace-ID for every inbound request.

    - If the caller supplies a well-formed ``X-Trace-ID`` header, it is
      accepted and stored in the ``_trace_id_var`` context variable.
    - Otherwise a placeholder ``unknown-<timestamp>`` value is stored so
      log lines are never missing the field.
    - The resolved value is echoed back as a response header so callers can
      correlate their own logs.
    - structlog's ``contextvars`` integration picks up the value automatically
      because ``bind_contextvars`` is called before the next middleware runs.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        raw = request.headers.get(TRACE_ID_HEADER, "")
        trace_id = raw if _is_valid_trace_id(raw) else f"unknown-{int(time.time())}"

        # Bind into structlog's context-var store so every downstream log call
        # emitted during this request automatically carries trace_id.
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

        # Also store in a plain ContextVar for non-structlog callsites.
        _trace_id_var.set(trace_id)

        log.info(
            "request_started",
            method=request.method,
            path=request.url.path,
        )

        response: Response = await call_next(request)

        # Echo the trace ID back so callers can correlate their logs.
        response.headers[TRACE_ID_HEADER] = trace_id

        log.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
        )

        return response


# ---------------------------------------------------------------------------
# Tuneable thresholds (see docs/fraud-detection-heuristics.md for rationale)
# ---------------------------------------------------------------------------
WASH_WINDOW_SECONDS = 3600          # contributions that refund within 1 h
WASH_MIN_OCCURRENCES = 3            # flag after 3 wash cycles
SPIKE_WINDOW_SECONDS = 600          # 10-minute rolling window
SPIKE_MAX_CONTRIBUTIONS = 50        # > 50 contributions in 10 min → spike
DUPLICATE_JACCARD_THRESHOLD = 0.8   # titles ≥ 80 % token overlap → duplicate


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------
class FlagReason(str, Enum):
    WASH_CONTRIBUTION = "wash_contribution"
    CONTRIBUTION_SPIKE = "contribution_spike"
    DUPLICATE_CONTENT = "duplicate_content"


class FlagSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class Flag:
    id: str
    reason: FlagReason
    severity: FlagSeverity
    campaign_id: str
    wallet: Optional[str]
    detail: str
    flagged_at: float = field(default_factory=time.time)
    reviewed: bool = False


# ---------------------------------------------------------------------------
# Moderation queue (in-memory; replace with DB in production)
# ---------------------------------------------------------------------------
_QUEUE: list[Flag] = []
_FLAG_COUNTER = 0


def _next_flag_id() -> str:
    global _FLAG_COUNTER
    _FLAG_COUNTER += 1
    return f"FLAG-{_FLAG_COUNTER:05d}"


def _enqueue(flag: Flag) -> None:
    _QUEUE.append(flag)


# ---------------------------------------------------------------------------
# Indexed event store (populated by indexer; stubbed here)
# ---------------------------------------------------------------------------
@dataclass
class ContributionEvent:
    campaign_id: str
    wallet: str
    amount: int
    timestamp: float


@dataclass
class RefundEvent:
    campaign_id: str
    wallet: str
    timestamp: float


@dataclass
class CampaignRecord:
    id: str
    title: str
    description: str


_CONTRIBUTIONS: list[ContributionEvent] = []
_REFUNDS: list[RefundEvent] = []
_CAMPAIGN_RECORDS: list[CampaignRecord] = []


# ---------------------------------------------------------------------------
# Heuristic implementations
# ---------------------------------------------------------------------------

def _jaccard(a: str, b: str) -> float:
    """Token-level Jaccard similarity between two strings."""
    sa = set(a.lower().split())
    sb = set(b.lower().split())
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / len(sa | sb)


def scan_wash_contributions() -> list[Flag]:
    """
    Wash contribution heuristic.

    A wallet that contributes then refunds the *same campaign* within
    WASH_WINDOW_SECONDS, and does so WASH_MIN_OCCURRENCES or more times,
    is flagged as a potential wash contributor.
    """
    flags: list[Flag] = []
    # Group refunds by (campaign, wallet)
    refund_lookup: dict[tuple[str, str], list[float]] = {}
    for r in _REFUNDS:
        key = (r.campaign_id, r.wallet)
        refund_lookup.setdefault(key, []).append(r.timestamp)

    # For each contribution, check if a refund followed within the window
    wash_count: dict[tuple[str, str], int] = {}
    for c in _CONTRIBUTIONS:
        key = (c.campaign_id, c.wallet)
        for rt in refund_lookup.get(key, []):
            if 0 < rt - c.timestamp <= WASH_WINDOW_SECONDS:
                wash_count[key] = wash_count.get(key, 0) + 1

    for (campaign_id, wallet), count in wash_count.items():
        if count >= WASH_MIN_OCCURRENCES:
            flags.append(Flag(
                id=_next_flag_id(),
                reason=FlagReason.WASH_CONTRIBUTION,
                severity=FlagSeverity.HIGH,
                campaign_id=campaign_id,
                wallet=wallet,
                detail=f"Wallet performed {count} wash cycles within {WASH_WINDOW_SECONDS}s",
            ))
    return flags


def scan_contribution_spikes() -> list[Flag]:
    """
    Sudden-spike heuristic.

    If a campaign receives more than SPIKE_MAX_CONTRIBUTIONS in any
    SPIKE_WINDOW_SECONDS rolling window, flag it as a potential sybil attack.
    """
    flags: list[Flag] = []
    by_campaign: dict[str, list[float]] = {}
    for c in _CONTRIBUTIONS:
        by_campaign.setdefault(c.campaign_id, []).append(c.timestamp)

    for campaign_id, timestamps in by_campaign.items():
        ts = sorted(timestamps)
        for i, t_start in enumerate(ts):
            window = [t for t in ts[i:] if t - t_start <= SPIKE_WINDOW_SECONDS]
            if len(window) > SPIKE_MAX_CONTRIBUTIONS:
                flags.append(Flag(
                    id=_next_flag_id(),
                    reason=FlagReason.CONTRIBUTION_SPIKE,
                    severity=FlagSeverity.MEDIUM,
                    campaign_id=campaign_id,
                    wallet=None,
                    detail=(
                        f"{len(window)} contributions in "
                        f"{SPIKE_WINDOW_SECONDS}s window "
                        f"(threshold: {SPIKE_MAX_CONTRIBUTIONS})"
                    ),
                ))
                break  # one flag per campaign per scan
    return flags


def scan_duplicate_content() -> list[Flag]:
    """
    Duplicate-content heuristic.

    Compares every pair of campaigns by title Jaccard similarity.
    Pairs above DUPLICATE_JACCARD_THRESHOLD are flagged.
    """
    flags: list[Flag] = []
    records = _CAMPAIGN_RECORDS
    for i in range(len(records)):
        for j in range(i + 1, len(records)):
            a, b = records[i], records[j]
            sim = _jaccard(a.title, b.title)
            if sim >= DUPLICATE_JACCARD_THRESHOLD:
                flags.append(Flag(
                    id=_next_flag_id(),
                    reason=FlagReason.DUPLICATE_CONTENT,
                    severity=FlagSeverity.LOW,
                    campaign_id=b.id,
                    wallet=None,
                    detail=(
                        f"Title Jaccard similarity {sim:.2f} with campaign {a.id} "
                        f"(threshold: {DUPLICATE_JACCARD_THRESHOLD})"
                    ),
                ))
    return flags


def run_full_scan() -> list[Flag]:
    """Execute all heuristics and append new flags to the moderation queue."""
    scan_log = log.bind(operation="run_full_scan")
    scan_log.info("scan_started")

    new_flags: list[Flag] = []
    new_flags.extend(scan_wash_contributions())
    new_flags.extend(scan_contribution_spikes())
    new_flags.extend(scan_duplicate_content())
    for f in new_flags:
        _enqueue(f)

    scan_log.info("scan_completed", new_flags=len(new_flags), queue_depth=len(_QUEUE))
    return new_flags


# ---------------------------------------------------------------------------
# Contribution notification model
# ---------------------------------------------------------------------------

@dataclass
class ContributionPayload:
    """
    Payload posted by graphql-api to ``POST /contributions``.

    Mirrors ``ContributionNotification`` in
    ``services/graphql-api/src/services/fraud-client.ts``.
    """
    campaignId: str
    contributor: str
    amount: str          # stringified bigint
    transactionHash: str
    timestamp: float     # Unix epoch seconds


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Fund-My-Cause Fraud Detection", version="1.0.0")

# Register the trace-ID middleware first so every subsequent handler has
# trace_id bound in structlog's context-var store.
app.add_middleware(TraceIDMiddleware)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/contributions")
async def ingest_contribution(request: Request) -> dict:
    """
    Accept a contribution notification from graphql-api.

    The middleware has already extracted X-Trace-ID and bound it to the
    structlog context, so every log line in this handler automatically
    carries ``trace_id``.
    """
    try:
        body = await request.json()
        payload = ContributionPayload(**body)
    except Exception as exc:
        log.warning("contributions_ingest_invalid_payload", error=str(exc))
        return JSONResponse(status_code=422, content={"error": "invalid payload"})

    log.info(
        "contribution_received",
        campaign_id=payload.campaignId,
        contributor=payload.contributor,
        amount=payload.amount,
        tx_hash=payload.transactionHash,
    )

    # Ingest into the in-memory event store for the next scan pass.
    _CONTRIBUTIONS.append(ContributionEvent(
        campaign_id=payload.campaignId,
        wallet=payload.contributor,
        amount=int(payload.amount) if payload.amount.isdigit() else 0,
        timestamp=payload.timestamp,
    ))

    log.debug("contribution_stored", store_size=len(_CONTRIBUTIONS))
    return {"status": "accepted"}


@app.post("/scan")
def trigger_scan(background_tasks: BackgroundTasks) -> dict:
    """Trigger a full fraud scan asynchronously."""
    log.info("scan_scheduled")
    background_tasks.add_task(run_full_scan)
    return {"status": "scan_scheduled"}


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
    items = _QUEUE
    if reviewed is not None:
        items = [f for f in items if f.reviewed == reviewed]
    if reason is not None:
        items = [f for f in items if f.reason == reason]
    items = items[-limit:]

    log.debug(
        "moderation_queue_queried",
        returned=len(items),
        total=len(_QUEUE),
    )

    return JSONResponse(content={
        "total": len(_QUEUE),
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
    for f in _QUEUE:
        if f.id == flag_id:
            f.reviewed = True
            log.info("flag_marked_reviewed", flag_id=flag_id)
            return {"status": "updated", "id": flag_id}
    log.warning("flag_not_found", flag_id=flag_id)
    return JSONResponse(status_code=404, content={"error": "flag not found"})
