"""Tests for the campaign recommendation service (#635)."""

import pytest
from fastapi.testclient import TestClient

from service import (
    Campaign,
    IndexedActivity,
    _ACTIVITY,
    _CAMPAIGNS,
    _recommend,
    app,
)

client = TestClient(app)


# ── Schema audit regression guard (#897) ─────────────────────────────────────
# If a field is added to the Campaign or IndexedActivity dataclass but is never
# actually referenced in the module, this test will fail, signalling that the
# new column is dead weight.

def test_all_campaign_fields_used():
    """
    Every field declared on Campaign must appear at least once in the
    recommendation logic (score functions or API response).
    """
    import dataclasses, service as svc

    field_names = {f.name for f in dataclasses.fields(Campaign)}

    # Collect field references from the source of the service module
    import inspect
    source = inspect.getsource(svc)

    missing = [name for name in field_names if f".{name}" not in source]
    assert not missing, (
        f"Campaign fields not referenced anywhere in service.py "
        f"(potential dead columns): {missing}"
    )


def test_all_indexed_activity_fields_used():
    """
    Every field declared on IndexedActivity must be referenced in the
    recommendation logic.
    """
    import dataclasses, service as svc, inspect

    field_names = {f.name for f in dataclasses.fields(IndexedActivity)}
    source = inspect.getsource(svc)

    missing = [name for name in field_names if f".{name}" not in source]
    assert not missing, (
        f"IndexedActivity fields not referenced anywhere in service.py "
        f"(potential dead columns): {missing}"
    )


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Cold-start fallback ───────────────────────────────────────────────────────

def test_cold_start_returns_trending():
    """Unknown wallet → still gets sensible (trending) suggestions."""
    r = client.get("/recommendations?wallet=GUNKNOWN&limit=3")
    assert r.status_code == 200
    body = r.json()
    assert body["personalised"] is False
    assert len(body["recommendations"]) == 3
    # All returned campaigns must be from our known set
    known_ids = {c.id for c in _CAMPAIGNS}
    for rec in body["recommendations"]:
        assert rec["campaign_id"] in known_ids


def test_no_wallet_returns_trending():
    r = client.get("/recommendations?limit=2")
    assert r.status_code == 200
    body = r.json()
    assert body["personalised"] is False
    assert len(body["recommendations"]) == 2


# ── Personalised recommendations ─────────────────────────────────────────────

def test_personalised_excludes_already_contributed():
    """Campaigns already contributed to must not appear in recommendations."""
    wallet = "GTESTPERSONALISED"
    _ACTIVITY[wallet] = IndexedActivity(
        wallet=wallet,
        contributed_campaign_ids=["c1", "c3"],
        preferred_categories=["tech"],
    )
    try:
        result = _recommend(wallet, 10)
        ids = [r["campaign_id"] for r in result]
        assert "c1" not in ids
        assert "c3" not in ids
    finally:
        del _ACTIVITY[wallet]


def test_personalised_boosts_preferred_category():
    """Campaigns in a preferred category must rank above unrelated ones."""
    wallet = "GTESTBOOST"
    _ACTIVITY[wallet] = IndexedActivity(
        wallet=wallet,
        contributed_campaign_ids=[],
        preferred_categories=["environment"],
    )
    try:
        result = _recommend(wallet, len(_CAMPAIGNS))
        env_ids = {"c2", "c5"}  # environment campaigns
        top_ids = {r["campaign_id"] for r in result[:2]}
        # At least one environment campaign should be in the top 2
        assert top_ids & env_ids
    finally:
        del _ACTIVITY[wallet]


# ── Caching ───────────────────────────────────────────────────────────────────

def test_cache_headers():
    r1 = client.get("/recommendations?limit=1")
    r2 = client.get("/recommendations?limit=1")
    assert r1.headers.get("X-Cache") == "MISS"
    assert r2.headers.get("X-Cache") == "HIT"


# ── Limit validation ─────────────────────────────────────────────────────────

def test_limit_too_large_rejected():
    r = client.get("/recommendations?limit=99")
    assert r.status_code == 422


def test_limit_zero_rejected():
    r = client.get("/recommendations?limit=0")
    assert r.status_code == 422
