"""
Decision rule for the §4.5 tri-state seeded call.

  seeded:
    null  if applicability != "active"
    true  if confidence ≥ 65 AND mean_dvh_db ≥ +1.5
    false if confidence ≥ 65 AND mean_dvh_db ≤ -1.5
    null  otherwise (uncertain — show as gray with confidence pct visible)

Symmetric thresholds at ±1.5 dB ensure the rule is reachable under the
§4.7 confidence formula (the negative side at -1.0 was unreachable in
rev 3 — see rev-4 audit-resolution table).
"""
from __future__ import annotations
from typing import Optional

from .applicability import Applicability


POSITIVE_THRESHOLD_DB = 1.5
NEGATIVE_THRESHOLD_DB = -1.5
CONFIDENCE_FLOOR = 65


def decide_seeded(
    *,
    applicability: Applicability,
    mean_dvh_db: float,
    confidence: int,
) -> Optional[bool]:
    """Return True (seeded), False (not seeded), or None (uncertain / n/a)."""
    if applicability != "active":
        return None

    if confidence < CONFIDENCE_FLOOR:
        return None

    if mean_dvh_db >= POSITIVE_THRESHOLD_DB:
        return True

    if mean_dvh_db <= NEGATIVE_THRESHOLD_DB:
        return False

    return None
