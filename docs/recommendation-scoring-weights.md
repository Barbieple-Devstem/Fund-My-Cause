# Recommendation Scoring Weights — Tuning Guide

> Issue #912 — Backend: Extract recommendation scoring weights into config

The `backend/recommendations` service uses two numeric weights to rank campaigns.
Both are fully externalized to environment variables: no redeployment is needed to
adjust them.

---

## Available weights

| Environment variable | Default | Constraint | Controls |
|---|---|---|---|
| `RECOMMENDATION_WEIGHT_CATEGORY_BOOST` | `2.0` | `≥ 1.0` | Score multiplier applied when a campaign's category matches one of the user's preferred categories. A value of `2.0` doubles the score for matching categories. |
| `RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN` | `1.0` | `> 0` | Lower bound (hours) used in the age denominator of the trending score. Clamps the raw campaign age to `max(age_hours, age_divisor_min)` to prevent brand-new campaigns from getting an artificially inflated score due to near-zero age. |

---

## How the weights are loaded

Weights are loaded **once at startup** by `scoring_config.py → load_scoring_config()`.

```
RECOMMENDATION_WEIGHT_<FIELD_NAME_UPPER>=<value>
```

- If a variable is **absent**, the built-in default is used silently.  
  A partial override is therefore safe for local development.
- If a variable is **present but malformed** (e.g. `"two"` instead of `"2.0"`),
  the service raises a `ValueError` at startup with a message naming the offending
  variable — the service will **not** start in a misconfigured state.
- Values that violate domain constraints (e.g. `category_boost = 0.5`) also raise
  a `ValueError` at startup.

---

## How the weights affect scoring

### Trending score (cold-start / unauthenticated)

```python
trending_score(c) = (contributor_count × log1p(total_raised)) / max(age_hours, age_divisor_min)
```

- `age_divisor_min` prevents brand-new campaigns from dominating by capping the
  divisor floor. Raise it to smooth out recency spikes; lower it to let very new
  campaigns surface more aggressively.

### Personalised score (authenticated wallet with activity)

```python
personalised_score(c) = trending_score(c) × category_boost   (if c.category in preferred)
personalised_score(c) = trending_score(c)                      (otherwise)
personalised_score(c) = 0                                       (if already contributed)
```

- `category_boost` amplifies campaigns whose category matches the user's history.
  The default `2.0` means a matching campaign ranks as if it were twice as popular.
  Set to `1.0` to disable personalisation entirely; higher values make category
  preference increasingly dominant.

---

## Setting weights in each environment

### Local development (shell)

```bash
export RECOMMENDATION_WEIGHT_CATEGORY_BOOST=3.0
uvicorn service:app --reload
```

### Docker / docker-compose

```yaml
services:
  recommendations:
    image: fund-my-cause-recommendations
    environment:
      RECOMMENDATION_WEIGHT_CATEGORY_BOOST: "3.0"
      RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN: "0.5"
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: recommendations-config
data:
  RECOMMENDATION_WEIGHT_CATEGORY_BOOST: "2.5"
  RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN: "1.0"
```

### AWS ECS / Secrets Manager

Store the values as plain text parameters in SSM Parameter Store and reference
them from the task definition's `environment` or `secrets` section.

---

## Verifying the active weights at runtime

The `/health` endpoint does not expose weights (they could reveal business logic).
To verify the active configuration, check the startup logs:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

You can also inspect the running config in a Python shell inside the container:

```python
from scoring_config import SCORING_CONFIG
print(SCORING_CONFIG)
# ScoringWeightsConfig(category_boost=2.0, age_divisor_min=1.0)
```

---

## Validation rules

The service enforces these constraints at startup — attempting to start with an
invalid config exits immediately with a clear error:

| Weight | Rule | Reason |
|---|---|---|
| `category_boost` | `≥ 1.0` | A value below 1.0 would *demote* preferred categories, which is the opposite of personalisation. |
| `age_divisor_min` | `> 0` | The trending score divides by age; a zero divisor would produce infinity. |
| All weights | Finite float | `NaN` / `Infinity` are silently wrong values that would corrupt every score. |
| All weights | `≥ 0` | Negative weights have no defined meaning in this scoring model. |

---

## Default config produces identical output to historical hardcoded values

The built-in defaults in `ScoringWeightsConfig` match the constants that were
previously hardcoded directly in `service.py`, so deploying with no environment
variables set produces identical ranking output to the pre-#912 version.  See
`backend/recommendations/tests_scoring_config.py → test_default_config_matches_hardcoded_values`
for the regression guard.
