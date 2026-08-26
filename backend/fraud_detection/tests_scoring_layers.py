"""
Unit tests for the extracted scoring and repository layers (#1122).

These tests verify:
1. Scoring rules (scan_* functions) are testable without any HTTP layer.
2. The repository layer correctly stores and retrieves events.
3. run_full_scan() delegates to both layers correctly.
4. The layer boundary is clean: scoring.py has no FastAPI import.
5. The repository layer has no scoring logic.

Closes #1122
"""

from __future__ import annotations

import time
import inspect
import types
import pytest

import repository
import scoring
from repository import (
    CampaignRecord,
    ContributionEvent,
    Flag,
    FlagReason,
    FlagSeverity,
    RefundEvent,
    append_campaign,
    append_contribution,
    append_refund,
    clear_all,
    enqueue_flag,
    get_campaign_records,
    get_contributions,
    get_flags,
    get_refunds,
    mark_flag_reviewed,
    next_flag_id,
    total_flag_count,
)
from scoring import (
    DUPLICATE_JACCARD_THRESHOLD,
    DUPLICATE_SCAN_MIN_INTERVAL_SECONDS,
    SPIKE_MAX_CONTRIBUTIONS,
    SPIKE_WINDOW_SECONDS,
    WASH_MIN_OCCURRENCES,
    WASH_WINDOW_SECONDS,
    run_full_scan,
    scan_contribution_spikes,
    scan_duplicate_content,
    scan_wash_contributions,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_stores():
    clear_all()
    scoring._last_duplicate_scan_at = 0.0
    yield
    clear_all()
    scoring._last_duplicate_scan_at = 0.0


def _wash_cycles(campaign: str, wallet: str, cycles: int, delay: float = 60.0) -> None:
    gap = WASH_WINDOW_SECONDS * 3
    for i in range(cycles):
        t = 1_700_000_000.0 + i * gap
        append_contribution(ContributionEvent(campaign, wallet, 1_000, t))
        append_refund(RefundEvent(campaign, wallet, t + delay))


def _spike(campaign: str, count: int, spread: float = 0.5) -> None:
    t = time.time()
    for i in range(count):
        append_contribution(ContributionEvent(campaign, f"GW{i}", 100, t + i * spread))


# ---------------------------------------------------------------------------
# Layer-boundary tests
# ---------------------------------------------------------------------------

class TestLayerBoundaries:
    """
    Structural tests: scoring.py must not import FastAPI; repository.py must
    not contain scoring/heuristic logic.
    """

    def test_scoring_module_has_no_fastapi_import(self):
        """scoring.py must be testable without an HTTP server."""
        source = inspect.getsource(scoring)
        assert "fastapi" not in source.lower(), (
            "scoring.py imports FastAPI — scoring logic must be HTTP-independent (#1122)"
        )

    def test_scoring_module_has_no_asyncio_import(self):
        """Scoring functions are synchronous; asyncio belongs in pipeline.py."""
        source = inspect.getsource(scoring)
        assert "import asyncio" not in source, (
            "scoring.py imports asyncio — keep async concerns in pipeline.py (#1122)"
        )

    def test_repository_has_no_scan_functions(self):
        """repository.py must not contain heuristic logic."""
        source = inspect.getsource(repository)
        assert "scan_wash" not in source, (
            "repository.py contains scan logic — move heuristics to scoring.py (#1122)"
        )
        assert "jaccard" not in source.lower(), (
            "repository.py contains Jaccard similarity — move to scoring.py (#1122)"
        )

    def test_scoring_functions_are_callable_without_http(self):
        """Calling scan functions must never raise ImportError for HTTP deps."""
        # This assertion is trivially satisfied if the import at the top of
        # this file succeeds; the explicit call below adds extra confidence.
        result = scan_wash_contributions()
        assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Repository layer unit tests
# ---------------------------------------------------------------------------

class TestRepositoryLayer:
    def test_append_and_read_contributions(self):
        append_contribution(ContributionEvent("c1", "GW1", 1000, 1.0))
        append_contribution(ContributionEvent("c2", "GW2", 2000, 2.0))
        contribs = get_contributions()
        assert len(contribs) == 2
        assert contribs[0].campaign_id == "c1"
        assert contribs[1].campaign_id == "c2"

    def test_append_and_read_refunds(self):
        append_refund(RefundEvent("c1", "GW1", 60.0))
        refunds = get_refunds()
        assert len(refunds) == 1
        assert refunds[0].wallet == "GW1"

    def test_append_and_read_campaign_records(self):
        append_campaign(CampaignRecord("id1", "Title A", "desc"))
        records = get_campaign_records()
        assert len(records) == 1
        assert records[0].title == "Title A"

    def test_enqueue_and_read_flags(self):
        flag = Flag(
            id=next_flag_id(),
            reason=FlagReason.WASH_CONTRIBUTION,
            severity=FlagSeverity.HIGH,
            campaign_id="c1",
            wallet="GW1",
            detail="test",
        )
        enqueue_flag(flag)
        flags = get_flags()
        assert len(flags) == 1
        assert flags[0].reason == FlagReason.WASH_CONTRIBUTION

    def test_get_flags_filter_by_reviewed(self):
        f1 = Flag(id=next_flag_id(), reason=FlagReason.WASH_CONTRIBUTION,
                  severity=FlagSeverity.HIGH, campaign_id="c1", wallet="G1", detail="")
        f2 = Flag(id=next_flag_id(), reason=FlagReason.CONTRIBUTION_SPIKE,
                  severity=FlagSeverity.MEDIUM, campaign_id="c2", wallet=None, detail="")
        f2.reviewed = True
        enqueue_flag(f1)
        enqueue_flag(f2)

        unreviewed = get_flags(reviewed=False)
        assert len(unreviewed) == 1
        assert unreviewed[0].id == f1.id

        reviewed = get_flags(reviewed=True)
        assert len(reviewed) == 1
        assert reviewed[0].id == f2.id

    def test_get_flags_filter_by_reason(self):
        f1 = Flag(id=next_flag_id(), reason=FlagReason.WASH_CONTRIBUTION,
                  severity=FlagSeverity.HIGH, campaign_id="c1", wallet="G1", detail="")
        f2 = Flag(id=next_flag_id(), reason=FlagReason.DUPLICATE_CONTENT,
                  severity=FlagSeverity.LOW, campaign_id="c2", wallet=None, detail="")
        enqueue_flag(f1)
        enqueue_flag(f2)

        wash_flags = get_flags(reason=FlagReason.WASH_CONTRIBUTION)
        assert len(wash_flags) == 1
        assert wash_flags[0].reason == FlagReason.WASH_CONTRIBUTION

    def test_mark_flag_reviewed_returns_true_on_success(self):
        flag_id = next_flag_id()
        flag = Flag(id=flag_id, reason=FlagReason.WASH_CONTRIBUTION,
                    severity=FlagSeverity.HIGH, campaign_id="c1", wallet="G1", detail="")
        enqueue_flag(flag)
        result = mark_flag_reviewed(flag_id)
        assert result is True
        assert get_flags(reviewed=True)[0].id == flag_id

    def test_mark_flag_reviewed_returns_false_on_missing(self):
        result = mark_flag_reviewed("FLAG-99999")
        assert result is False

    def test_total_flag_count(self):
        for i in range(3):
            enqueue_flag(Flag(
                id=next_flag_id(),
                reason=FlagReason.WASH_CONTRIBUTION,
                severity=FlagSeverity.HIGH,
                campaign_id=f"c{i}",
                wallet="G1",
                detail="",
            ))
        assert total_flag_count() == 3

    def test_next_flag_id_is_monotonic(self):
        ids = [next_flag_id() for _ in range(5)]
        # All IDs must be distinct
        assert len(set(ids)) == 5
        # Extract the numeric suffix and verify it's increasing
        nums = [int(fid.split("-")[1]) for fid in ids]
        assert nums == sorted(nums)

    def test_clear_all_resets_everything(self):
        append_contribution(ContributionEvent("c1", "G1", 100, 1.0))
        append_refund(RefundEvent("c1", "G1", 60.0))
        append_campaign(CampaignRecord("c1", "T", ""))
        enqueue_flag(Flag(id=next_flag_id(), reason=FlagReason.WASH_CONTRIBUTION,
                          severity=FlagSeverity.HIGH, campaign_id="c1", wallet="G1", detail=""))

        clear_all()

        assert get_contributions() == []
        assert get_refunds() == []
        assert get_campaign_records() == []
        assert get_flags() == []
        assert total_flag_count() == 0


# ---------------------------------------------------------------------------
# Scoring layer unit tests — no HTTP dependency
# ---------------------------------------------------------------------------

class TestScoringLayerWithoutHTTP:
    """
    These tests call scoring functions directly.  They do NOT create a
    TestClient or import FastAPI — that's the point of the split.
    """

    def test_scan_wash_contributions_flags_wash_pattern(self):
        _wash_cycles("camp1", "GBAD", WASH_MIN_OCCURRENCES)
        flags = scan_wash_contributions()
        assert len(flags) == 1
        assert flags[0].reason == FlagReason.WASH_CONTRIBUTION
        assert flags[0].severity == FlagSeverity.HIGH

    def test_scan_wash_below_threshold_no_flag(self):
        _wash_cycles("camp2", "GCLEAN", WASH_MIN_OCCURRENCES - 1)
        assert scan_wash_contributions() == []

    def test_scan_contribution_spikes_flags_spike(self):
        _spike("spike1", SPIKE_MAX_CONTRIBUTIONS + 1)
        flags = scan_contribution_spikes()
        assert len(flags) == 1
        assert flags[0].reason == FlagReason.CONTRIBUTION_SPIKE
        assert flags[0].severity == FlagSeverity.MEDIUM

    def test_scan_contribution_spikes_below_threshold_no_flag(self):
        _spike("safe1", SPIKE_MAX_CONTRIBUTIONS - 1)
        assert scan_contribution_spikes() == []

    def test_scan_duplicate_content_flags_identical_titles(self):
        append_campaign(CampaignRecord("d1", "Fund the Open Commons", "desc"))
        append_campaign(CampaignRecord("d2", "Fund the Open Commons", "desc2"))
        flags = scan_duplicate_content()
        assert len(flags) == 1
        assert flags[0].reason == FlagReason.DUPLICATE_CONTENT
        assert flags[0].severity == FlagSeverity.LOW

    def test_scan_duplicate_content_different_titles_no_flag(self):
        append_campaign(CampaignRecord("e1", "Community Garden", ""))
        append_campaign(CampaignRecord("e2", "Open Source Wallet Dev", ""))
        assert scan_duplicate_content() == []

    def test_run_full_scan_enqueues_flags_in_repository(self):
        _wash_cycles("fs1", "GBADACTOR", WASH_MIN_OCCURRENCES)
        flags = run_full_scan()
        assert len(flags) >= 1
        # Flags must be in the repository queue
        queue_ids = {f.id for f in get_flags()}
        for f in flags:
            assert f.id in queue_ids

    def test_duplicate_scan_rate_limited_within_interval(self):
        append_campaign(CampaignRecord("rl1", "Identical Title Here", ""))
        append_campaign(CampaignRecord("rl2", "Identical Title Here", ""))

        first = run_full_scan()
        before = scoring._last_duplicate_scan_at

        second = run_full_scan()
        after = scoring._last_duplicate_scan_at

        assert after == before, "Rate-limited duplicate scan should not update timestamp"
        assert not any(f.reason == FlagReason.DUPLICATE_CONTENT for f in second)

    def test_duplicate_scan_bypassed_by_force_flag(self):
        append_campaign(CampaignRecord("bp1", "Identical Title Here", ""))
        append_campaign(CampaignRecord("bp2", "Identical Title Here", ""))

        run_full_scan()  # warm up _last_duplicate_scan_at
        flags = run_full_scan(force_duplicate_scan=True)
        assert any(f.reason == FlagReason.DUPLICATE_CONTENT for f in flags)

    def test_empty_stores_produce_no_flags(self):
        assert run_full_scan() == []
