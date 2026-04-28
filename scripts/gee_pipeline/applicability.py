"""
CDL/ACI crop class → applicability enum.

Per spec §4.1, the per-parcel `applicability` value drives the decision
rule (and the map fill style). This module captures the v1 logic:

  - alfalfa, pasture, hay_perennial → perennial (no annual seeding event)
  - winter_wheat in any territory during spring run → out-of-season
    (planted previous fall; pipeline cannot detect a seeding event for it)
  - AZ cotton outside the Feb 1 – Apr 15 planting window → out-of-season
  - Unknown / ambiguous classes → active (let the pipeline run; the
    decision rule will null-out weak signals via confidence < 65)

All other classes → active (run full pipeline).

This is intentionally simple in v1. Manual overrides via
calibration/az_co_applicability_overrides.json get applied AFTER this
classifier (in pipeline.apply_applicability_overrides()).
"""
from __future__ import annotations
from datetime import date
from typing import Literal

Applicability = Literal[
    "active",
    "perennial",
    "out-of-season",
    "insufficient_baseline",
    "unmapped",
]

PERENNIAL_CROPS = frozenset({
    "alfalfa",
    "pasture_grass",
    "hay_perennial",
    "grass_managed",
    "switchgrass",
})

OUT_OF_SEASON_SPRING = frozenset({
    "winter_wheat",  # planted previous fall, no spring seeding event
    "winter_canola",
    "winter_barley",
})

# AZ cotton planting window — Feb 1 to mid-April
AZ_COTTON_PLANTING_END_MMDD = (4, 15)


def _parse_run_date(run_date: str) -> date:
    return date.fromisoformat(run_date)


def applicability_for_crop(
    *, crop_class: str, territory: str, run_date: str
) -> Applicability:
    """
    Map a CDL/ACI crop class string to an applicability enum, considering
    the territory and the date the satellite pipeline is being run on.
    """
    crop = crop_class.lower().strip()

    if crop in PERENNIAL_CROPS:
        return "perennial"

    if crop in OUT_OF_SEASON_SPRING:
        return "out-of-season"

    # AZ cotton is seasonal: planting Feb 1 – mid-April. After Apr 15 the
    # crop is already in ground; we cannot detect a seeding event.
    if crop == "cotton" and territory == "az":
        d = _parse_run_date(run_date)
        cutoff_mmdd = AZ_COTTON_PLANTING_END_MMDD
        if (d.month, d.day) > cutoff_mmdd:
            return "out-of-season"
        return "active"

    # Default: run the pipeline; let the decision rule decide if the
    # signal is strong enough.
    return "active"
