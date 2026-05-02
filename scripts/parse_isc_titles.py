"""
Parse ISC-style title export CSVs (MONETTE FARMS LTD. land titles, as of 2026-01-18)
into a single normalized JSON file used to reconcile against quarters-data.js.

Inputs (local-only, not committed):
  docs/Land/Monette - file 1.csv
  docs/Land/Monette - file 2.csv
  docs/Land/Monette - file 3.csv

Output:
  docs/logs/sk-titles/parsed.json

Run:
  python scripts/parse_isc_titles.py
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = REPO_ROOT / "docs" / "Land"
OUTPUT_PATH = REPO_ROOT / "docs" / "logs" / "sk-titles" / "parsed.json"

CSV_FILES = [
    "Monette - file 1.csv",
    "Monette - file 2.csv",
    "Monette - file 3.csv",
]

# RM-to-property crosswalk (Phase 1 working draft — confidence flags drive Codex review).
# Each entry: rm_name -> (property_id, confidence, note)
RM_TO_PROPERTY = {
    "RM OF AUVERGNE NO. 076":      ("ponteix",       "high",   ""),
    "RM OF ENFIELD NO. 194":       ("calderbank",    "high",   ""),
    "RM OF WHISKA CREEK NO. 106":  ("vanguard",      "medium", "verify with Codex — Vanguard or Admiral?"),
    "RM OF LAJORD NO. 128":        ("regina-south",  "medium", "65 parcels in single township T15-R18-W2M"),
    "RM OF MORSE NO. 165":         ("calderbank",    "low",    "no current 'morse' property; townships contiguous with Enfield"),
    "RM OF BRATT'S LAKE NO. 129":  ("regina-south",  "medium", ""),
    "RM OF SWIFT CURRENT NO. 137": ("swift-current", "high",   "Stewart Valley townships T13 — currently swift-current has 0 parcels"),
    "RM OF SLIDING HILLS NO. 273": ("kamsack",       "high",   ""),
    "RM OF LAC PELLETIER NO. 107": ("wymark",        "high",   ""),
    "VILLAGE OF NEVILLE":          ("vanguard",      "low",    "town lots in Plan N3619; folded into vanguard via Phase 3 anchor decision (closest property anchor, ~17km NE)"),
    "RM OF EDENWOLD NO. 158":      ("regina-south",  "low",    "T16-R18-W2M directly N of Lajord — likely same block"),
    "RM OF COTE NO. 271":          ("kamsack",       "high",   ""),
    "RM OF PADDOCKWOOD NO. 520":   ("prince-albert", "high",   ""),
    "RM OF RUDY NO. 284":          ("outlook",       "high",   ""),
    "RM OF MONTROSE NO. 315":      ("outlook",       "high",   ""),
    "RM OF MOUNT HOPE NO. 279":    ("raymore",       "high",   ""),
    "RM OF DOUGLAS NO. 436":       ("hafford",       "low",    "only 2 of 158 Hafford quarters — corroborates rented-back thesis"),
    "RM OF GARDEN RIVER NO. 490":  ("prince-albert", "high",   ""),
    "RM OF BONE CREEK NO. 108":    ("admiral",       "low",    "Cabri/Admiral area — verify"),
    "RM OF LONGLAKETON NO. 219":   ("regina-south",  "low",    "single parcel; Lumsden area"),
}


def normalize_loc(row: dict) -> tuple[str, dict]:
    """
    Build a canonical `loc` string matching quarters-data.js convention.
    Returns (loc, flags_dict).

    Cases:
      Quarter:    NE-10-11-13-W3            (qtr-section-township-range-Wmeridian)
      LSD:        LSD-3-19-13-13-W3         (lsd-section-township-range-Wmeridian)
      Town lot:   LOT-1-BLK-13-PLAN-N3619   (lot-block-plan)
    """
    qtr = (row.get("qtr_section") or "").strip().upper()
    sec = (row.get("section") or "").strip()
    twp = (row.get("township") or "").strip()
    rng = (row.get("range") or "").strip()
    mer = (row.get("meridian") or "").strip()
    lsd = (row.get("lsd") or "").strip()
    lot = (row.get("lot") or "").strip()
    blk = (row.get("block/parcel") or "").strip()
    plan = (row.get("plan") or "").strip()

    flags = {"is_lsd": False, "is_town_lot": False, "is_planned_parcel": False}

    # Town lot or planned-parcel block (e.g. Village of Neville)
    if lot and blk and plan:
        flags["is_town_lot"] = True
        return f"LOT-{lot}-BLK-{blk}-PLAN-{plan}", flags

    # Planned parcel without lot/block (e.g. "Blk/Par A-Plan 102196065")
    if blk and plan and not lot:
        flags["is_planned_parcel"] = True
        return f"BLK-{blk}-PLAN-{plan}", flags

    # LSD (40-acre subdivision)
    if lsd and sec and twp and rng and mer:
        flags["is_lsd"] = True
        return f"LSD-{lsd}-{sec}-{twp}-{rng}-W{mer}", flags

    # Standard quarter
    if qtr and sec and twp and rng and mer:
        return f"{qtr}-{sec}-{twp}-{rng}-W{mer}", flags

    # Fallback: use the raw description so we don't silently lose rows
    return (row.get("Land Description") or "").strip()[:120], flags


def estimate_acres(flags: dict) -> float | None:
    """Default acreage by parcel type. Real acres come from XLSX/SAMA later."""
    if flags.get("is_lsd"):
        return 40.0
    if flags.get("is_town_lot") or flags.get("is_planned_parcel"):
        return None  # variable, must look up
    return 160.0


def parse_csv(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, skipinitialspace=True)
        for row in reader:
            ptype = (row.get("Parcel Type") or "").strip()
            if ptype != "Surface Regular":
                # mineral / other — skip for surface map
                continue

            loc, flags = normalize_loc(row)
            rm = (row.get("Municipality") or "").strip() or "(blank)"
            mapping = RM_TO_PROPERTY.get(rm, ("__unassigned__", "none", f"unknown RM: {rm}"))

            rec = {
                "loc": loc,
                "parcel_no": (row.get("Parcel Number") or "").strip(),
                "title_number": (row.get("Title Number") or "").strip(),
                "title_text": (row.get("Land Description") or "").strip(),
                "rm": rm,
                "qtr": (row.get("qtr_section") or "").strip().upper() or None,
                "sec": (row.get("section") or "").strip() or None,
                "twp": (row.get("township") or "").strip() or None,
                "rng": (row.get("range") or "").strip() or None,
                "mer": (row.get("meridian") or "").strip() or None,
                "lsd": (row.get("lsd") or "").strip() or None,
                "lot": (row.get("lot") or "").strip() or None,
                "block": (row.get("block/parcel") or "").strip() or None,
                "plan": (row.get("plan") or "").strip() or None,
                "ext": (row.get("extension") or "").strip() or None,
                "ac_estimated": estimate_acres(flags),
                "is_lsd": flags["is_lsd"],
                "is_town_lot": flags["is_town_lot"],
                "is_planned_parcel": flags["is_planned_parcel"],
                "property_id": mapping[0],
                "property_confidence": mapping[1],
                "property_note": mapping[2],
                "csv_source": path.name,
            }
            rows.append(rec)
    return rows


def main():
    if not INPUT_DIR.exists():
        sys.exit(f"Input directory not found: {INPUT_DIR}")

    all_rows: list[dict] = []
    for fname in CSV_FILES:
        fpath = INPUT_DIR / fname
        if not fpath.exists():
            sys.exit(f"Missing CSV: {fpath}")
        all_rows.extend(parse_csv(fpath))

    by_property: dict[str, list[dict]] = defaultdict(list)
    seen_parcel_nos: set[str] = set()
    for rec in all_rows:
        pn = rec["parcel_no"]
        if pn and pn in seen_parcel_nos:
            # duplicate parcel_no across CSV files (extension variants) — keep first only
            continue
        if pn:
            seen_parcel_nos.add(pn)
        by_property[rec["property_id"]].append(rec)

    # Sort each property's parcels by twp, rng, sec, qtr for stable output
    for pid in by_property:
        by_property[pid].sort(key=lambda r: (
            r.get("twp") or "",
            r.get("rng") or "",
            r.get("sec") or "",
            r.get("qtr") or "",
            r.get("lsd") or "",
            r.get("loc") or "",
        ))

    # Summary
    summary = {
        "snapshot_date": "2026-01-18",
        "source": "ISC-style title export — MONETTE FARMS LTD.",
        "csv_files": CSV_FILES,
        "total_rows_processed": len(all_rows),
        "unique_surface_parcels": len(seen_parcel_nos),
        "rm_to_property_crosswalk": {
            rm: {"property_id": pid, "confidence": conf, "note": note}
            for rm, (pid, conf, note) in RM_TO_PROPERTY.items()
        },
        "parcels_by_property": {pid: len(parcels) for pid, parcels in by_property.items()},
        "by_property": dict(by_property),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2, ensure_ascii=False)

    print(f"Wrote {OUTPUT_PATH}")
    print(f"Total surface parcels: {summary['unique_surface_parcels']}")
    print(f"Properties:")
    for pid, n in sorted(summary["parcels_by_property"].items(), key=lambda x: -x[1]):
        print(f"  {pid}: {n}")


if __name__ == "__main__":
    main()
