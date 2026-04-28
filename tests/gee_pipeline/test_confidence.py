"""Unit tests for the §4.7 confidence formula.

The formula: sig = clamp((|mean_dvh_db| - 0.5) / 1.5, 0, 1) * 100, then
add bonuses (+5 for n_pixels > 200) and subtract penalties (-20 for
cropland_coverage < 0.50, -25 for precip > 5mm in 24h).
"""
import pytest
from scripts.gee_pipeline.confidence import compute_confidence


def test_at_positive_threshold_clean_conditions():
    # mean_dvh_db = +1.5, no penalties, no bonuses
    c = compute_confidence(
        mean_dvh_db=1.5,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    # sig = (1.5 - 0.5) / 1.5 = 0.667; base = 67
    assert 65 <= c <= 70


def test_at_positive_threshold_with_robustness_bonus():
    # n_pixels > 200 adds +5
    c = compute_confidence(
        mean_dvh_db=1.5,
        n_pixels=300,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    assert 70 <= c <= 75


def test_at_negative_threshold_clean():
    # |-1.5| produces same magnitude → same base
    c = compute_confidence(
        mean_dvh_db=-1.5,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    assert 65 <= c <= 70


def test_inside_uncertain_zone():
    # mean_dvh_db = +1.0 → sig = 0.333 → base 33
    c = compute_confidence(
        mean_dvh_db=1.0,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    assert 30 <= c <= 38


def test_low_polygon_quality_penalty():
    # Same magnitude but cropland_coverage < 0.50 subtracts 20
    c = compute_confidence(
        mean_dvh_db=1.5,
        n_pixels=150,
        cropland_coverage=0.30,
        precip_mm_24h=2.0,
    )
    # Base ~67, penalty -20 → ~47
    assert 45 <= c <= 50


def test_wet_soil_penalty():
    # precip > 5mm subtracts 25
    c = compute_confidence(
        mean_dvh_db=1.5,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=8.0,
    )
    # Base ~67, penalty -25 → ~42
    assert 40 <= c <= 45


def test_far_above_threshold_caps_at_100():
    # mean_dvh_db = +5.0 should give sig=1, base=100
    c = compute_confidence(
        mean_dvh_db=5.0,
        n_pixels=300,
        cropland_coverage=0.9,
        precip_mm_24h=0.0,
    )
    # Bonus +5 capped at 100
    assert c == 100


def test_zero_signal_clamps_at_zero():
    c = compute_confidence(
        mean_dvh_db=0.0,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    assert c == 0


def test_returns_int_in_0_100_range():
    for dvh in [-3.0, -1.0, 0.0, 1.0, 3.0]:
        c = compute_confidence(
            mean_dvh_db=dvh,
            n_pixels=150,
            cropland_coverage=0.7,
            precip_mm_24h=2.0,
        )
        assert isinstance(c, int)
        assert 0 <= c <= 100
