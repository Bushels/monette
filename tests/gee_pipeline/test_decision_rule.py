"""Unit tests for the §4.5 decision rule (rev 4 thresholds).

  applicability != "active"          → seeded: null
  confidence ≥ 65 AND dvh_db ≥ +1.5  → seeded: true
  confidence ≥ 65 AND dvh_db ≤ -1.5  → seeded: false
  otherwise                          → seeded: null
"""
import pytest
from scripts.gee_pipeline.decision_rule import decide_seeded


def test_perennial_returns_null():
    assert decide_seeded(applicability="perennial", mean_dvh_db=2.0, confidence=85) is None


def test_out_of_season_returns_null():
    assert decide_seeded(applicability="out-of-season", mean_dvh_db=2.0, confidence=85) is None


def test_insufficient_baseline_returns_null():
    assert decide_seeded(applicability="insufficient_baseline", mean_dvh_db=2.0, confidence=85) is None


def test_strong_positive_active_returns_true():
    assert decide_seeded(applicability="active", mean_dvh_db=1.7, confidence=78) is True


def test_active_veto_withholds_even_strong_positive_signal():
    assert decide_seeded(
        applicability="active",
        mean_dvh_db=2.4,
        confidence=100,
        veto_reason="snow_or_freeze_risk",
    ) is None


def test_strong_negative_active_returns_false():
    assert decide_seeded(applicability="active", mean_dvh_db=-1.7, confidence=78) is False


def test_low_confidence_returns_null():
    # ΔVH magnitude looks strong but confidence below threshold
    assert decide_seeded(applicability="active", mean_dvh_db=1.7, confidence=60) is None


def test_below_positive_threshold_returns_null():
    # Confidence high enough but dvh_db not over +1.5
    assert decide_seeded(applicability="active", mean_dvh_db=1.2, confidence=70) is None


def test_above_negative_threshold_returns_null():
    # |dvh_db| < 1.5 so neither true nor false
    assert decide_seeded(applicability="active", mean_dvh_db=-1.0, confidence=70) is None


def test_exactly_at_positive_threshold():
    # +1.5 is the boundary — inclusive per spec table
    assert decide_seeded(applicability="active", mean_dvh_db=1.5, confidence=65) is True


def test_exactly_at_negative_threshold():
    # -1.5 is the boundary — inclusive per spec table
    assert decide_seeded(applicability="active", mean_dvh_db=-1.5, confidence=65) is False


def test_exactly_at_confidence_floor():
    # Confidence == 65 is the inclusive minimum
    assert decide_seeded(applicability="active", mean_dvh_db=1.6, confidence=65) is True
