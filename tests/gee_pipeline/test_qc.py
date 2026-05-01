"""Unit tests for the snow/freeze/precip QC predicates.

The actual GEE-side QC mask is built in qc.build_qc_mask(); these tests
cover the pure-Python helpers it uses.
"""
import pytest
from scripts.gee_pipeline.qc import (
    is_snow_free,
    is_unfrozen,
    is_dry_24h,
    qualifies_for_baseline,
    active_seed_veto,
)


def test_snow_free_true_when_under_threshold():
    assert is_snow_free(snow_pct=2.0) is True


def test_snow_free_false_when_at_threshold():
    assert is_snow_free(snow_pct=5.0) is False


def test_snow_free_false_when_over_threshold():
    assert is_snow_free(snow_pct=12.5) is False


def test_unfrozen_true_above_zero_celsius():
    assert is_unfrozen(temp_2m_kelvin=274.0) is True


def test_unfrozen_false_at_zero_celsius():
    # T_mean must be STRICTLY > 273.15 K per spec §4.2
    assert is_unfrozen(temp_2m_kelvin=273.15) is False


def test_unfrozen_false_below_zero():
    assert is_unfrozen(temp_2m_kelvin=270.0) is False


def test_dry_24h_true_under_5mm():
    assert is_dry_24h(precip_mm=4.9) is True


def test_dry_24h_true_at_5mm():
    # Spec §4.2: "no precipitation > 5 mm". 5.0 mm is NOT > 5.0, so it passes
    # the gate. Strictly inclusive at the boundary.
    assert is_dry_24h(precip_mm=5.0) is True


def test_dry_24h_false_over_5mm():
    assert is_dry_24h(precip_mm=12.3) is False


def test_qualifies_for_baseline_all_pass():
    assert qualifies_for_baseline(snow_pct=2.0, temp_2m_kelvin=275.0, precip_mm=1.0) is True


def test_qualifies_for_baseline_freeze_fails():
    assert qualifies_for_baseline(snow_pct=2.0, temp_2m_kelvin=270.0, precip_mm=1.0) is False


def test_qualifies_for_baseline_snow_fails():
    assert qualifies_for_baseline(snow_pct=20.0, temp_2m_kelvin=280.0, precip_mm=1.0) is False


def test_qualifies_for_baseline_wet_fails():
    assert qualifies_for_baseline(snow_pct=2.0, temp_2m_kelvin=275.0, precip_mm=10.0) is False


def test_active_seed_veto_blocks_snow_or_freeze_risk():
    veto = active_seed_veto(
        latest_snow_pct=12.0,
        latest_temp_2m_kelvin=272.5,
        latest_precip_mm=1.0,
    )

    assert veto["vetoed"] is True
    assert veto["reason"] == "snow_or_freeze_risk"


def test_active_seed_veto_allows_clean_active_observation():
    veto = active_seed_veto(
        latest_snow_pct=1.0,
        latest_temp_2m_kelvin=276.0,
        latest_precip_mm=0.5,
    )

    assert veto["vetoed"] is False
    assert veto["reason"] is None


def test_active_seed_veto_blocks_local_area_snow_risk():
    veto = active_seed_veto(
        latest_snow_pct=1.0,
        local_area_snow_pct=12.0,
        latest_temp_2m_kelvin=None,
        latest_precip_mm=None,
    )

    assert veto["vetoed"] is True
    assert veto["reason"] == "snow_or_freeze_risk"
