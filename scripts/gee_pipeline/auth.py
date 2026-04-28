"""Earth Engine initialization helper.

Centralizes how the satellite seeding pipeline authenticates to GEE so
every script can call a single `initialize()` and get the right
credentials for its environment.

Auth-source priority (first one that's available wins):

  1. **Service account** (preferred for unattended / production runs)
     Triggered when `GEE_SERVICE_ACCOUNT` env var is set AND its
     `GEE_KEY_FILE` (default: ~/.config/earthengine/monette-sa-key.json)
     points to a real JSON key.
     Bypasses Google's unverified-app filter that blocks user OAuth on
     locked-down Gmail accounts. Best for Cloud Scheduler runs.

  2. **Application Default Credentials (ADC)** (preferred for personal
     dev work when the org policy blocks SA-key creation, which is
     common under Google's "Secure by Default" auto-enforcement).
     Set up locally via:
         gcloud auth application-default login
         gcloud auth application-default set-quota-project monette-494717
     ADC uses gcloud's Cloud-SDK OAuth client which is widely
     verified/allowlisted; it works in many environments where
     `earthengine authenticate` directly hits "this app is blocked."

  3. **Earth Engine user OAuth** (last-resort fallback).
     Reads from the credentials file at
     ~/.config/earthengine/credentials written by
     `earthengine authenticate`. Skipped if the file is missing.

The Cloud project is hard-coded as `MONETTE_PROJECT` below since the
satellite pipeline is project-scoped and we don't want every script
re-deciding which project to bill against.
"""
from __future__ import annotations

import os
from pathlib import Path

import ee

MONETTE_PROJECT = "monette-494717"

DEFAULT_SA_KEY_PATH = Path.home() / ".config" / "earthengine" / "monette-sa-key.json"

# Scopes ADC must hold for Earth Engine work
EE_SCOPES = (
    "https://www.googleapis.com/auth/earthengine",
    "https://www.googleapis.com/auth/cloud-platform",
)


def _try_service_account() -> bool:
    """Try Path 1: service account from GEE_SERVICE_ACCOUNT + GEE_KEY_FILE."""
    sa_email = os.environ.get("GEE_SERVICE_ACCOUNT")
    key_file = os.environ.get("GEE_KEY_FILE", str(DEFAULT_SA_KEY_PATH))
    if sa_email and Path(key_file).exists():
        credentials = ee.ServiceAccountCredentials(sa_email, key_file)
        ee.Initialize(credentials, project=MONETTE_PROJECT)
        return True
    return False


def _try_adc() -> bool:
    """Try Path 2: Application Default Credentials via google.auth.default()."""
    try:
        from google.auth import default as _google_default
    except ImportError:
        return False
    try:
        credentials, _ = _google_default(scopes=list(EE_SCOPES))
    except Exception:
        return False
    ee.Initialize(credentials, project=MONETTE_PROJECT)
    return True


def _try_user_oauth() -> bool:
    """Try Path 3: Earth Engine user OAuth from ~/.config/earthengine/credentials."""
    ee_creds_path = Path.home() / ".config" / "earthengine" / "credentials"
    if not ee_creds_path.exists():
        return False
    ee.Initialize(project=MONETTE_PROJECT)
    return True


def initialize() -> None:
    """Initialize the Earth Engine client using the best available auth source.

    Tries service-account → ADC → user-OAuth in order, raising the last
    exception if none work.
    """
    last_err: Exception | None = None
    for fn in (_try_service_account, _try_adc, _try_user_oauth):
        try:
            if fn():
                return
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(
        "No working GEE auth source. Tried: service account "
        f"({DEFAULT_SA_KEY_PATH}), ADC (gcloud auth application-default "
        "login), user OAuth (earthengine authenticate). Last error: "
        f"{last_err}"
    )


def auth_source() -> str:
    """Return a string describing which auth source initialize() would use.

    Useful for run-log breadcrumbs so we can confirm which credentials a
    given run actually used.
    """
    sa_email = os.environ.get("GEE_SERVICE_ACCOUNT")
    key_file = os.environ.get("GEE_KEY_FILE", str(DEFAULT_SA_KEY_PATH))
    if sa_email and Path(key_file).exists():
        return f"service-account ({sa_email})"

    adc_paths = [
        Path(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")),
        Path.home() / ".config" / "gcloud" / "application_default_credentials.json",
        Path(os.environ.get("APPDATA", "")) / "gcloud" / "application_default_credentials.json",
    ]
    if any(p.exists() for p in adc_paths if str(p)):
        return "adc (gcloud application-default credentials)"

    if (Path.home() / ".config" / "earthengine" / "credentials").exists():
        return "user-oauth (earthengine credentials file)"

    return "none-available"
