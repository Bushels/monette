"""Earth Engine initialization helper.

Centralizes how the satellite seeding pipeline authenticates to GEE so
every script can call a single `initialize()` and get the right
credentials for its environment:

  - Service account (preferred for unattended / production runs)
    Triggered when both env vars are set:
      GEE_SERVICE_ACCOUNT  - the SA email
                             (e.g. 'monette-seeding-pipeline@monette-494717.iam.gserviceaccount.com')
      GEE_KEY_FILE         - absolute path to the SA's JSON key
                             (default: ~/.config/earthengine/monette-sa-key.json)
    Service-account auth bypasses Google's unverified-app filter that
    blocks user OAuth on locked-down Gmail accounts.

  - User OAuth (fallback for ad-hoc local development)
    Used when no service-account env vars are set. Reads from the
    earthengine credentials file written by `earthengine authenticate`.

The Cloud project is hard-coded as MONETTE_PROJECT below since the
satellite pipeline is project-scoped and we don't want every script
re-deciding which project to bill against.
"""
from __future__ import annotations

import os
from pathlib import Path

import ee

MONETTE_PROJECT = "monette-494717"

DEFAULT_SA_KEY_PATH = Path.home() / ".config" / "earthengine" / "monette-sa-key.json"


def initialize() -> None:
    """Initialize the Earth Engine client.

    Prefers service-account credentials (set via GEE_SERVICE_ACCOUNT and
    GEE_KEY_FILE env vars or the default key path); falls back to user
    OAuth if no service-account credentials are configured.
    """
    sa_email = os.environ.get("GEE_SERVICE_ACCOUNT")
    key_file = os.environ.get("GEE_KEY_FILE", str(DEFAULT_SA_KEY_PATH))

    if sa_email and Path(key_file).exists():
        credentials = ee.ServiceAccountCredentials(sa_email, key_file)
        ee.Initialize(credentials, project=MONETTE_PROJECT)
        return

    # Fall back to user OAuth (uses ~/.config/earthengine/credentials)
    ee.Initialize(project=MONETTE_PROJECT)


def auth_source() -> str:
    """Return a string describing which auth source initialize() would use.

    Useful in script logs so we can confirm which credentials a given
    run actually used.
    """
    sa_email = os.environ.get("GEE_SERVICE_ACCOUNT")
    key_file = os.environ.get("GEE_KEY_FILE", str(DEFAULT_SA_KEY_PATH))
    if sa_email and Path(key_file).exists():
        return f"service-account ({sa_email})"
    return "user-oauth"
