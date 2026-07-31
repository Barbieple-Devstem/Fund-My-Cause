"""Unit tests for the fraud-detection scoring stage — Issue #943.

Covers clearly low/medium/high-risk fixture profiles, threshold-boundary
cases, and malformed/incomplete input handling.

Closes #943
"""
from __future__ import annotations

import time
from unittest.mock import patch
import pytest

from pipeline import (
    CampaignRecord, ContributionEvent, FlagReason, FlagSeverity, RefundEvent,
    DUPLICATE_JACCARD_THRESHOLD, SPIKE_MAX_CONTRIBUTIONS, SPIKE_WINDOW_SECONDS,
    WASH_MIN_OCCURRENCES, WASH_WINDOW_SECONDS,
    _CAMPAIGN_RECORDS, _CONTRIBUTIONS, _QUEUE, _REFUNDS,
    run_full_scan, scan_contribution_spikes, scan_duplicate_content, scan_wash_contributions,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clear():
    _CONTRIBUTIONS.clear()
    _REFUNDS.clear()
    _CAMPAIGN_RECORDS.clear()
    _QUEUE.clear()


@pytest.fixture(autouse=True)
def isolated_stores():
    _clear()
    yield
    _clear()


def _isolated_wash(campaign: str, wallet: str, cycles: int, delay: float = 60.0) -> None:
    """
    Build wash cycles with a 3× window gap between each cycle so that
    contribution[i] never cross-pairs with refund[j] (i≠j) within the window.
    """
    gap = WASH_WINDOW_SECONDS * 3
    for i in range(cycles):
        t = 1_700_000_000.0 + i * gap
        _CONTRIBUTIONS.append(ContributionEvent(campaign, wallet, 1_000, t))
        _REFUNDS.append(RefundEvent(campaign, wallet, t + delay))


def _spike(campaign: str, count: int, spread: float = 0.5) -> None:
    t = time.time()
    for i in range(count):
        _CONTRIBUTIONS.append(ContributionEvent(campaign, f"GW{i}", 100, t + i * spread))


def _patched_run_full_scan():
    """
    Run run_full_scan with a safe structlog configuration.

    pipeline.py configures structlog at import time with
    structlog.stdlib.add_logger_name, which crashes on a PrintLogger
    (structlog's native logger). We temporarily reconfigure structlog to drop
    that processor, then restore the original config afterward.
    """
    import structlog

    original_cfg = structlog.get_config()
    safe_processors = [
        p for p in original_cfg["processors"]
        if getattr(p, "__name__", "") != "add_logger_name"
        and not (hasattr(p, "__func__") and getattr(p.__func__, "__name__", "") == "add_logger_name")
        and p is not structlog.stdlib.add_logger_name
    ]
    structlog.configure(processors=safe_processors)
    try:
        return run_full_scan()
    finally:
        structlog.configure(**original_cfg)


# ---------------------------------------------------------------------------
# Severity correctness
# ---------------------------------------------------------------------------

class TestFlagSeverity:
    def test_wash_is_high_severity(self):
        _isolated_wash("c1", "GW", WASH_MIN_OCCURRENCES)
        flags = scan_wash_contributions()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.HIGH
        assert flags[0].reason == FlagReason.WASH_CONTRIBUTION

    def test_spike_is_medium_severity(self):
        _spike("c2", SPIKE_MAX_CONTRIBUTIONS + 1)
        flags = scan_contribution_spikes()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.MEDIUM
        assert flags[0].reason == FlagReason.CONTRIBUTION_SPIKE

    def test_duplicate_is_low_severity(self):
        _CAMPAIGN_RECORDS.append(CampaignRecord("d1", "Save the Ocean Initiative", ""))
        _CAMPAIGN_RECORDS.append(CampaignRecord("d2", "Save the Ocean Initiative", ""))
        flags = scan_duplicate_content()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.LOW
        assert flags[0].reason == FlagReason.DUPLICATE_CONTENT


# ---------------------------------------------------------------------------
# Risk profiles
# ---------------------------------------------------------------------------

class TestRiskProfiles:
    def test_low_risk_no_flags(self):
        t = 1_700_000_000.0
        for i in range(10):
            _CONTRIBUTIONS.append(ContributionEvent("clean", f"G{i}", 5_000, t + i * 3600))
        assert scan_wash_contributions() == []
        assert scan_contribution_spikes() == []

    def test_low_risk_dissimilar_titles_no_duplicate_flag(self):
        _CAMPAIGN_RECORDS.append(CampaignRecord("lr1", "Community Garden Project", ""))
        _CAMPAIGN_RECORDS.append(CampaignRecord("lr2", "Open Source Dev Fund", ""))
        assert scan_duplicate_content() == []

    def test_medium_risk_spike_profile(self):
        _spike("med", SPIKE_MAX_CONTRIBUTIONS + 5)
        flags = scan_contribution_spikes()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.MEDIUM

    def test_high_risk_wash_profile(self):
        _isolated_wash("hi", "GBAD", WASH_MIN_OCCURRENCES + 2)
        flags = scan_wash_contributions()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.HIGH

    def test_high_risk_detail_contains_cycle_count(self):
        cycles = WASH_MIN_OCCURRENCES + 1
        _isolated_wash("hi2", "GBAD2", cycles)
        flags = scan_wash_contributions()
        assert len(flags) == 1
        assert str(cycles) in flags[0].detail


# ---------------------------------------------------------------------------
# Threshold boundaries
# ---------------------------------------------------------------------------

class TestThresholdBoundaries:

    def test_wash_exactly_at_threshold_is_flagged(self):
        _isolated_wash("wb1", "GB1", WASH_MIN_OCCURRENCES)
        assert len(scan_wash_contributions()) == 1

    def test_wash_one_below_threshold_is_not_flagged(self):
        _isolated_wash("wb2", "GB2", WASH_MIN_OCCURRENCES - 1)
        assert scan_wash_contributions() == []

    def test_wash_refund_at_exact_window_edge_is_flagged(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            _CONTRIBUTIONS.append(ContributionEvent("wb3", "GB3", 1_000, t))
            _REFUNDS.append(RefundEvent("wb3", "GB3", t + WASH_WINDOW_SECONDS))
        assert len(scan_wash_contributions()) == 1

    def test_wash_refund_just_outside_window_is_not_flagged(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            _CONTRIBUTIONS.append(ContributionEvent("wb4", "GB4", 1_000, t))
            _REFUNDS.append(RefundEvent("wb4", "GB4", t + WASH_WINDOW_SECONDS + 1))
        assert scan_wash_contributions() == []

    def test_spike_exactly_at_max_not_flagged(self):
        _spike("sb1", SPIKE_MAX_CONTRIBUTIONS)
        assert scan_contribution_spikes() == []

    def test_spike_one_over_max_is_flagged(self):
        _spike("sb2", SPIKE_MAX_CONTRIBUTIONS + 1)
        assert len(scan_contribution_spikes()) == 1

    def test_spike_spread_past_window_not_flagged(self):
        t = time.time()
        for i in range(SPIKE_MAX_CONTRIBUTIONS + 1):
            _CONTRIBUTIONS.append(
                ContributionEvent("sb3", f"G{i}", 100, t + i * (SPIKE_WINDOW_SECONDS + 10))
            )
        assert scan_contribution_spikes() == []

    def test_jaccard_at_threshold_is_flagged(self):
        # 4 shared / 5 union = 0.80 == DUPLICATE_JACCARD_THRESHOLD
        _CAMPAIGN_RECORDS.append(CampaignRecord("jb1", "alpha beta gamma delta", ""))
        _CAMPAIGN_RECORDS.append(CampaignRecord("jb2", "alpha beta gamma delta epsilon", ""))
        assert len(scan_duplicate_content()) == 1

    def test_jaccard_well_below_threshold_not_flagged(self):
        _CAMPAIGN_RECORDS.append(CampaignRecord("jb3", "clean water access rural areas", ""))
        _CAMPAIGN_RECORDS.append(CampaignRecord("jb4", "support local school renovation project", ""))
        assert scan_duplicate_content() == []


# ---------------------------------------------------------------------------
# Malformed / incomplete input
# ---------------------------------------------------------------------------

class TestMalformedInput:
    def test_zero_amount_contribution_no_crash(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            _CONTRIBUTIONS.append(ContributionEvent("mf1", "GZR", 0, t))
            _REFUNDS.append(RefundEvent("mf1", "GZR", t + 30))
        scan_wash_contributions()  # must not raise

    def test_empty_title_no_crash(self):
        _CAMPAIGN_RECORDS.append(CampaignRecord("mf2", "", ""))
        _CAMPAIGN_RECORDS.append(CampaignRecord("mf3", "", ""))
        scan_duplicate_content()  # must not raise

    def test_refund_before_contribution_not_flagged(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            _CONTRIBUTIONS.append(ContributionEvent("mf4", "GBACK", 1_000, t + 100))
            _REFUNDS.append(RefundEvent("mf4", "GBACK", t))  # before contribution
        assert scan_wash_contributions() == []

    def test_unknown_campaign_spike_no_crash(self):
        _CONTRIBUTIONS.append(ContributionEvent("ghost_camp", "GANON", 500, time.time()))
        scan_contribution_spikes()  # must not raise

    def test_single_contribution_no_refund_not_wash(self):
        _CONTRIBUTIONS.append(ContributionEvent("mf5", "GSOLO", 5_000, time.time()))
        assert scan_wash_contributions() == []

    def test_negative_timestamp_no_crash(self):
        _CONTRIBUTIONS.append(ContributionEvent("mf6", "GNEG", 1_000, -1.0))
        _REFUNDS.append(RefundEvent("mf6", "GNEG", 3600.0))
        scan_wash_contributions()  # must not raise


# ---------------------------------------------------------------------------
# Full-scan integration
# ---------------------------------------------------------------------------

class TestFullScanIntegration:
    def test_all_three_risk_tiers_detected(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            _CONTRIBUTIONS.append(ContributionEvent("fs_w", "GWASH", 1_000, t))
            _REFUNDS.append(RefundEvent("fs_w", "GWASH", t + 60))
        _spike("fs_s", SPIKE_MAX_CONTRIBUTIONS + 1)
        _CAMPAIGN_RECORDS.append(CampaignRecord("fs_d1", "Identical Campaign Title Here", ""))
        _CAMPAIGN_RECORDS.append(CampaignRecord("fs_d2", "Identical Campaign Title Here", ""))

        flags = _patched_run_full_scan()
        severities = {f.severity for f in flags}
        assert FlagSeverity.HIGH in severities
        assert FlagSeverity.MEDIUM in severities
        assert FlagSeverity.LOW in severities

    def test_flags_appended_to_queue(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            _CONTRIBUTIONS.append(ContributionEvent("fs_q", "GQW", 1_000, t))
            _REFUNDS.append(RefundEvent("fs_q", "GQW", t + 60))
        flags = _patched_run_full_scan()
        queue_ids = {f.id for f in _QUEUE}
        for flag in flags:
            assert flag.id in queue_ids

    def test_clean_activity_no_flags(self):
        t = 1_700_000_000.0
        for i in range(5):
            _CONTRIBUTIONS.append(ContributionEvent("fs_c", f"GC{i}", 2_000, t + i * 7200))
        assert _patched_run_full_scan() == []

    def test_empty_stores_no_flags(self):
        assert _patched_run_full_scan() == []
