"""
Snow/freeze/precip QC predicates for SAR baseline scene selection.

Per spec §4.2, a Sentinel-1 scene qualifies as a T0 baseline candidate
only if all of the following hold for the scene's date and AOI:

  - snow-free (Sentinel-2 SCL snow class < 5%, OR NSIDC snow_extent = 0)
  - unfrozen (ECMWF/ERA5_LAND/DAILY_AGGR.temperature_2m > 273.15 K)
  - dry (no precipitation > 5 mm in the 24 h preceding the SAR pass,
    via ECCC GeoMet for CA / NOAA NCEP for US)

This module exposes pure-Python helpers for those three rules so they
can be unit-tested without GEE. The GEE-side mask construction lives
in qc.build_qc_mask() (Phase 2 — uses these same thresholds via ee
expressions).
"""
from __future__ import annotations

SNOW_THRESHOLD_PCT = 5.0
FREEZE_THRESHOLD_KELVIN = 273.15
PRECIP_THRESHOLD_MM = 5.0


def is_snow_free(snow_pct: float) -> bool:
    """True iff snow coverage in the AOI is < 5% (per Sentinel-2 SCL)."""
    return snow_pct < SNOW_THRESHOLD_PCT


def is_unfrozen(temp_2m_kelvin: float) -> bool:
    """True iff daily mean 2m air temperature is strictly above 0 °C."""
    return temp_2m_kelvin > FREEZE_THRESHOLD_KELVIN


def is_dry_24h(precip_mm: float) -> bool:
    """True iff cumulative precip in the 24 h before the SAR pass is ≤ 5 mm."""
    return precip_mm <= PRECIP_THRESHOLD_MM


def qualifies_for_baseline(
    *, snow_pct: float, temp_2m_kelvin: float, precip_mm: float
) -> bool:
    """All three QC rules must pass for a scene to qualify as T0 baseline."""
    return (
        is_snow_free(snow_pct)
        and is_unfrozen(temp_2m_kelvin)
        and is_dry_24h(precip_mm)
    )
