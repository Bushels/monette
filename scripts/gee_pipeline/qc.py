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
ACTIVE_SEED_VETO_REASON = "snow_or_freeze_risk"


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


def active_seed_veto(
    *,
    latest_snow_pct: float | None,
    local_area_snow_pct: float | None = None,
    latest_temp_2m_kelvin: float | None,
    latest_precip_mm: float | None = None,
) -> dict:
    """Return the public-safe active-read veto state for seeding calls.

    This is stricter than the confidence penalty. If the latest active SAR
    observation is snowy or frozen, the model may still see a radar change, but
    the public seeded call is withheld because field operations are not
    physically credible under those conditions.
    """
    parcel_snow_risk = (
        latest_snow_pct is not None
        and not is_snow_free(latest_snow_pct)
    )
    local_area_snow_risk = (
        local_area_snow_pct is not None
        and not is_snow_free(local_area_snow_pct)
    )
    snow_risk = parcel_snow_risk or local_area_snow_risk
    freeze_risk = (
        latest_temp_2m_kelvin is not None
        and not is_unfrozen(latest_temp_2m_kelvin)
    )
    wet_soil_risk = (
        latest_precip_mm is not None
        and not is_dry_24h(latest_precip_mm)
    )
    vetoed = snow_risk or freeze_risk
    return {
        "vetoed": vetoed,
        "reason": ACTIVE_SEED_VETO_REASON if vetoed else None,
        "snow_risk": snow_risk,
        "parcel_snow_risk": parcel_snow_risk,
        "local_area_snow_risk": local_area_snow_risk,
        "freeze_risk": freeze_risk,
        "wet_soil_risk": wet_soil_risk,
    }
