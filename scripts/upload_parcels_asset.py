# scripts/upload_parcels_asset.py
"""
One-time upload of quarters.geojson as a GEE FeatureCollection asset.

Auth comes from gee_pipeline.auth.initialize() — service account if
configured, else Application Default Credentials, else earthengine
user OAuth. See gee_pipeline/auth.py for setup.

The asset is referenced by gee_pipeline.pipeline as the source of
polygon geometry, so this must happen before any T0 baseline or weekly
pipeline runs.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import ee

# Bootstrap: ensure scripts/ is on sys.path so we can import the gee_pipeline
# package whether this file is run as `python scripts/upload_parcels_asset.py`
# (where Python adds scripts/ to sys.path automatically) or otherwise.
_HERE = Path(__file__).resolve()
for _parent in _HERE.parents:
    if _parent.name == "scripts":
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break

from gee_pipeline.auth import initialize, auth_source, MONETTE_PROJECT

ASSET_ID = f"projects/{MONETTE_PROJECT}/assets/monette/parcels_v1"

ROOT = _HERE.parent.parent
GEOJSON_PATH = ROOT / "quarters.geojson"


def main() -> int:
    initialize()
    print(f"GEE auth source: {auth_source()}")

    geojson = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    features = []
    for f in geojson.get("features", []):
        props = f.get("properties") or {}
        # Carry forward only the fields the pipeline needs to keep the asset small.
        keep = {
            "property_id": props.get("property_id"),
            "loc": props.get("loc"),
            "titled_ac": props.get("titled_ac"),
        }
        features.append(ee.Feature(ee.Geometry(f["geometry"]), keep))

    fc = ee.FeatureCollection(features)
    print(f"Uploading {len(features)} features as {ASSET_ID}...")

    task = ee.batch.Export.table.toAsset(
        collection=fc,
        description="monette_parcels_v1_upload",
        assetId=ASSET_ID,
    )
    task.start()
    print(f"Started task {task.id}. Monitor with: earthengine task info {task.id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
