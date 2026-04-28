"""
Confidence scoring per spec §4.7 (rev 4).

  sig  = clamp((|mean_dvh_db| - 0.5) / 1.5, 0, 1) * 100
  base = sig

  + 5  if n_pixels > 200            (statistical robustness)
  - 20 if cropland_coverage < 0.50  (poor polygon QC)
  - 25 if precip_mm_24h > 5.0       (wet-soil ambiguity)

  final = clamp(base + bonuses + penalties, 0, 100)

The same formula handles positive and negative SAR change. The sign of
mean_dvh_db only matters for the decision rule (see decision_rule.py),
not for the confidence number.
"""
from __future__ import annotations


CONFIDENCE_FLOOR_DB = 0.5
CONFIDENCE_CEILING_DB = 2.0
ROBUSTNESS_PIXEL_THRESHOLD = 200
ROBUSTNESS_BONUS = 5
POLYGON_QC_PENALTY = -20
POLYGON_QC_THRESHOLD = 0.50
WET_SOIL_PENALTY = -25
WET_SOIL_PRECIP_THRESHOLD_MM = 5.0


def compute_confidence(
    *,
    mean_dvh_db: float,
    n_pixels: int,
    cropland_coverage: float,
    precip_mm_24h: float,
) -> int:
    """Return an integer confidence in [0, 100]."""
    magnitude = abs(mean_dvh_db)

    # Normalize magnitude to [0, 1] over [0.5, 2.0] dB
    span = CONFIDENCE_CEILING_DB - CONFIDENCE_FLOOR_DB
    normalized = (magnitude - CONFIDENCE_FLOOR_DB) / span
    sig = max(0.0, min(1.0, normalized))
    base = sig * 100.0

    bonus = ROBUSTNESS_BONUS if n_pixels > ROBUSTNESS_PIXEL_THRESHOLD else 0
    penalty = 0
    if cropland_coverage < POLYGON_QC_THRESHOLD:
        penalty += POLYGON_QC_PENALTY
    if precip_mm_24h > WET_SOIL_PRECIP_THRESHOLD_MM:
        penalty += WET_SOIL_PENALTY

    final = base + bonus + penalty
    final = max(0.0, min(100.0, final))
    return int(round(final))
