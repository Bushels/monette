"""Unit tests for CDL/ACI crop class → applicability enum mapping.

Per spec §4.1, applicability values are:
  active | perennial | out-of-season | insufficient_baseline | unmapped
"""
import pytest
from scripts.gee_pipeline.applicability import (
    applicability_for_crop,
    PERENNIAL_CROPS,
    OUT_OF_SEASON_SPRING,
)


def test_canola_is_active():
    # AAFC ACI canola class
    assert applicability_for_crop(crop_class="canola", territory="sk", run_date="2026-04-28") == "active"


def test_wheat_is_active_in_sk():
    assert applicability_for_crop(crop_class="spring_wheat", territory="sk", run_date="2026-04-28") == "active"


def test_alfalfa_is_perennial_anywhere():
    assert applicability_for_crop(crop_class="alfalfa", territory="az", run_date="2026-04-28") == "perennial"
    assert applicability_for_crop(crop_class="alfalfa", territory="sk", run_date="2026-04-28") == "perennial"


def test_pasture_is_perennial():
    assert applicability_for_crop(crop_class="pasture_grass", territory="mt", run_date="2026-04-28") == "perennial"


def test_winter_wheat_is_out_of_season_in_spring_run():
    # Spring satellite run finds winter wheat that was planted previous fall
    assert applicability_for_crop(crop_class="winter_wheat", territory="co", run_date="2026-04-28") == "out-of-season"


def test_cotton_in_az_late_april_is_out_of_season():
    # AZ cotton planting is Feb-mid April; April 28 is past the window
    assert applicability_for_crop(crop_class="cotton", territory="az", run_date="2026-04-28") == "out-of-season"


def test_cotton_in_az_early_march_is_active():
    # AZ cotton planting is in progress in early March
    assert applicability_for_crop(crop_class="cotton", territory="az", run_date="2026-03-05") == "active"


def test_unknown_crop_defaults_to_active():
    # Spec policy: when CDL is ambiguous, run the pipeline; the QC + decision-rule
    # null-out path will catch unmappable signal.
    assert applicability_for_crop(crop_class="other_grain", territory="sk", run_date="2026-04-28") == "active"


def test_perennial_crops_set_membership():
    # alfalfa, pasture_grass, hay_perennial should all be in the perennial set
    assert "alfalfa" in PERENNIAL_CROPS
    assert "pasture_grass" in PERENNIAL_CROPS
