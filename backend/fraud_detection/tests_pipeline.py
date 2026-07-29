"""Tests for the fraud/anomaly detection pipeline (#636)."""

import re
import time
import inspect
import pytest
from fastapi.testclient import TestClient

from pipeline import (
    CampaignRecord,
    ContributionEvent,
    FlagReason,
    RefundEvent,
    _CAMPAIGN_RECORDS,
    _CONTRIBUTIONS,
    _QUEUE,
    _REFUNDS,
    app,
    scan_contribution_spikes,
    scan_duplicate_content,
    scan_wash_contributions,
    WASH_MIN_OCCURRENCES,
    WASH_WINDOW_SECONDS,
    SPIKE_MAX_CONTRIBUTIONS,
    SPIKE_WINDOW_SECONDS,
)
import pipeline as pipeline_module

client = TestClient(app)


def _clear():
    _CONTRIBUTIONS.clear()
    _REFUNDS.clear()
    _CAMPAIGN_RECORDS.clear()
    _QUEUE.clear()


# ── Dead-code regression guards (#900) ───────────────────────────────────────

def test_no_dead_feature_flag_branches():
    """
    The rules engine must contain no conditional branches gated on feature
    flags.  Feature flags are identified by the common patterns:
      - FEATURE_* variable references
      - os.getenv("FEATURE_*") calls
    If any are found, they must be actively referenced in run_full_scan()
    or a scan function; otherwise they are dead code.
    """
    source = inspect.getsource(pipeline_module)
    # Detect FEATURE_* variable names that are NOT inside comments or strings
    # (a simple heuristic: count lines with FEATURE_ outside of # comments).
    non_comment_lines = [
        line for line in source.splitlines()
        if "FEATURE_" in line and not line.lstrip().startswith("#")
    ]
    assert non_comment_lines == [], (
        f"Unexpected feature-flag references found in pipeline.py "
        f"(potential dead branches): {non_comment_lines}"
    )


def test_no_dead_scoring_model_dispatch():
    """
    There must be no versioned-model dispatch logic (``if model_version ==``
    or ``if scoring_model ==``) which would indicate a removed scoring path
    that was never cleaned up.
    """
    source = inspect.getsource(pipeline_module)
    patterns = [
        r"if\s+model_version\s*==",
        r"if\s+scoring_model\s*==",
    ]
    for pattern in patterns:
        matches = re.findall(pattern, source)
        assert not matches, (
            f"Dead scoring-model dispatch found (pattern={pattern!r}): {matches}"
        )


def test_all_scan_functions_called_by_run_full_scan():
    """
    Every scan_* function defined in the module must be invoked by
    run_full_scan().  An orphaned scan function is a dead code path.
    """
    import types

    scan_funcs = [
        name for name, obj in vars(pipeline_module).items()
        if name.startswith("scan_") and isinstance(obj, types.FunctionType)
    ]
    run_full_scan_source = inspect.getsource(pipeline_module.run_full_scan)

    dead = [name for name in scan_funcs if name not in run_full_scan_source]
    assert not dead, (
        f"scan_*() functions defined but NOT called by run_full_scan() "
        f"(dead code): {dead}"
    )


# ── Scoring regression test: byte-for-byte output on a fixed transaction set ─
#
# This test uses a deterministic set of contributions/refunds and asserts that
# the scanner produces exactly the expected flag count and reasons.  If the
# scoring logic changes, this test must be updated intentionally (not silently
# pass with a different result).

_FIXED_NOW = 1_700_000_000.0  # 2023-11-14T22:13:20Z — fixed for reproducibility


def test_scoring_regression_fixed_transaction_set():
    """
    Run the full pipeline against a fixed, deterministic transaction set and
    assert byte-for-byte identical flag output.

    Expected output (verified on first authorship):
      - 1 WASH_CONTRIBUTION flag for wallet GWASH on campaign CAMP_WASH
      - 1 CONTRIBUTION_SPIKE flag for campaign CAMP_SPIKE
      - 1 DUPLICATE_CONTENT flag for campaign DUP_B

    Any change to thresholds or heuristics that alters this output MUST be
    accompanied by an intentional update to the expected values below.
    """
    _clear()

    # Wash-contribution fixture: 3 wash cycles within the window
    for i in range(WASH_MIN_OCCURRENCES):
        _CONTRIBUTIONS.append(ContributionEvent("CAMP_WASH", "GWASH", 1000, _FIXED_NOW + i * 10))
        _REFUNDS.append(RefundEvent("CAMP_WASH", "GWASH", _FIXED_NOW + i * 10 + 60))

    # Contribution-spike fixture: SPIKE_MAX_CONTRIBUTIONS + 1 contributions in one window
    for i in range(SPIKE_MAX_CONTRIBUTIONS + 1):
        _CONTRIBUTIONS.append(ContributionEvent("CAMP_SPIKE", f"G{i:04d}", 100, _FIXED_NOW + i))

    # Duplicate-content fixture: two campaigns with identical titles
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_A", "Fund the Open Commons", "desc"))
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_B", "Fund the Open Commons", "desc2"))

    wash_flags = scan_wash_contributions()
    spike_flags = scan_contribution_spikes()
    dup_flags = scan_duplicate_content()

    # Exact counts
    assert len(wash_flags) == 1, f"Expected 1 wash flag, got {len(wash_flags)}"
    assert len(spike_flags) == 1, f"Expected 1 spike flag, got {len(spike_flags)}"
    assert len(dup_flags) == 1, f"Expected 1 duplicate flag, got {len(dup_flags)}"

    # Exact reasons
    assert wash_flags[0].reason == FlagReason.WASH_CONTRIBUTION
    assert spike_flags[0].reason == FlagReason.CONTRIBUTION_SPIKE
    assert dup_flags[0].reason == FlagReason.DUPLICATE_CONTENT

    # Exact targets
    assert wash_flags[0].campaign_id == "CAMP_WASH"
    assert wash_flags[0].wallet == "GWASH"
    assert spike_flags[0].campaign_id == "CAMP_SPIKE"
    assert dup_flags[0].campaign_id == "DUP_B"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200


# ── Wash contribution ─────────────────────────────────────────────────────────

def test_wash_contribution_flagged():
    _clear()
    now = time.time()
    for i in range(WASH_MIN_OCCURRENCES):
        _CONTRIBUTIONS.append(ContributionEvent("camp1", "GWASH", 1000, now + i * 10))
        _REFUNDS.append(RefundEvent("camp1", "GWASH", now + i * 10 + 60))

    flags = scan_wash_contributions()
    assert len(flags) == 1
    assert flags[0].reason == FlagReason.WASH_CONTRIBUTION
    assert flags[0].wallet == "GWASH"


def test_wash_below_threshold_not_flagged():
    _clear()
    now = time.time()
    for i in range(WASH_MIN_OCCURRENCES - 1):
        _CONTRIBUTIONS.append(ContributionEvent("camp2", "GCLEAN", 1000, now + i * 10))
        _REFUNDS.append(RefundEvent("camp2", "GCLEAN", now + i * 10 + 60))

    flags = scan_wash_contributions()
    assert flags == []


def test_wash_refund_outside_window_not_flagged():
    _clear()
    now = time.time()
    for i in range(WASH_MIN_OCCURRENCES):
        _CONTRIBUTIONS.append(ContributionEvent("camp3", "GSLOW", 1000, now + i * 10))
        # Refund after window expires
        _REFUNDS.append(RefundEvent("camp3", "GSLOW", now + WASH_WINDOW_SECONDS + 3600))

    flags = scan_wash_contributions()
    assert flags == []


# ── Contribution spike ────────────────────────────────────────────────────────

def test_spike_flagged():
    _clear()
    now = time.time()
    for i in range(SPIKE_MAX_CONTRIBUTIONS + 1):
        _CONTRIBUTIONS.append(ContributionEvent("campSpike", f"G{i}", 100, now + i))

    flags = scan_contribution_spikes()
    assert len(flags) == 1
    assert flags[0].reason == FlagReason.CONTRIBUTION_SPIKE


def test_spike_below_threshold_not_flagged():
    _clear()
    now = time.time()
    for i in range(SPIKE_MAX_CONTRIBUTIONS - 1):
        _CONTRIBUTIONS.append(ContributionEvent("campOk", f"G{i}", 100, now + i))

    flags = scan_contribution_spikes()
    assert flags == []


# ── Duplicate content ─────────────────────────────────────────────────────────

def test_duplicate_title_flagged():
    _clear()
    _CAMPAIGN_RECORDS.append(CampaignRecord("x1", "Fund a Solar Farm Project", "desc"))
    _CAMPAIGN_RECORDS.append(CampaignRecord("x2", "Fund a Solar Farm Project", "desc2"))

    flags = scan_duplicate_content()
    assert len(flags) == 1
    assert flags[0].reason == FlagReason.DUPLICATE_CONTENT


def test_different_titles_not_flagged():
    _clear()
    _CAMPAIGN_RECORDS.append(CampaignRecord("y1", "Community Garden Initiative", ""))
    _CAMPAIGN_RECORDS.append(CampaignRecord("y2", "Open Source Wallet Development", ""))

    flags = scan_duplicate_content()
    assert flags == []


# ── Moderation queue endpoint ─────────────────────────────────────────────────

def test_moderation_queue_returns_flags():
    _clear()
    now = time.time()
    for i in range(WASH_MIN_OCCURRENCES):
        _CONTRIBUTIONS.append(ContributionEvent("cq", "GQ", 1000, now + i * 5))
        _REFUNDS.append(RefundEvent("cq", "GQ", now + i * 5 + 30))

    from pipeline import run_full_scan
    run_full_scan()

    r = client.get("/moderation-queue")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert any(f["reason"] == FlagReason.WASH_CONTRIBUTION for f in body["flags"])
