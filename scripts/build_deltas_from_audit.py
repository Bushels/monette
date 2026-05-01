"""
Generate proposed-deltas.json files in Codex's full-record schema by
mechanically translating audit.json buckets into reconciliation deltas.

This replicates Codex's worked-example methodology (see
docs/logs/sk-titles/wymark/methodology.md and memory
sk_titles_methodology.md) for areas that don't need bespoke knowledge-layer
reasoning. For areas with rich rumored-sale or court-doc intel attached
to specific quarters, hand-edit the produced deltas to add bespoke
flag_subtypes.

Inputs:
  docs/logs/sk-titles/parsed.json
  docs/logs/sk-titles/audit.json
  quarters-data.js                 (current map; for KEEP/FLAG full records)

Output:
  docs/logs/sk-titles/<property_id>/proposed-deltas.json

Idempotency / cross-property safety:
  Each property's deltas always contain the FULL TARGET STATE for that
  property, derived fresh from the audit. Re-running the script after
  any apply produces the same logical end state.

  When a property has reassign_out to a target property, the same record
  appears in the target's reassign_in bucket. To keep the apply script
  cross-property-correct, this generator emits the reassign_in record on
  the target side too — so applying just the source's deltas doesn't
  silently drop the parcel. Run with --include-reassign-targets to
  produce a combined deltas file.

Usage:
  python scripts/build_deltas_from_audit.py <property_id> [--include-reassign-targets]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PARSED_PATH = REPO_ROOT / "docs" / "logs" / "sk-titles" / "parsed.json"
AUDIT_PATH = REPO_ROOT / "docs" / "logs" / "sk-titles" / "audit.json"
QUARTERS_PATH = REPO_ROOT / "quarters-data.js"
OUT_DIR = REPO_ROOT / "docs" / "logs" / "sk-titles"


def load_quarters() -> dict:
    text = QUARTERS_PATH.read_text(encoding="utf-8")
    m = re.search(r"window\.MONETTE_QUARTERS_REAL\s*=\s*(\{.*\})", text, re.DOTALL)
    if not m:
        sys.exit("Could not parse quarters-data.js")
    return json.loads(m.group(1))


def slug_rm(rm) -> str:
    """Turn 'RM OF MOUNT HOPE NO. 279' -> 'mount_hope'.

    Also strips parentheticals like '(TOWN OF RAYMORE)' and trailing
    'NO. <n>' even when buried mid-string.

    Defensive: some legacy XLSX rows (notably hafford) store rm as the
    bare RM number (int) instead of the full RM name string. For those
    we fall back to 'rm_no_<n>' so each RM still gets a distinct FLAG
    subtype rather than collapsing them all into 'unknown'.
    """
    if rm is None or rm == "":
        return "unknown"
    if isinstance(rm, (int, float)):
        return f"rm_no_{int(rm)}"
    if not isinstance(rm, str):
        return "unknown"
    s = rm.upper()
    s = re.sub(r"\([^)]*\)", "", s)            # strip parentheticals
    s = s.replace("RM OF ", "").replace("VILLAGE OF ", "")
    s = re.sub(r"\s+NO\.\s+\d+", "", s)         # strip "NO. 279" anywhere
    s = s.lower().strip()
    s = re.sub(r"['\"\.,]", "", s)
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "unknown"


def flag_subtype_for(record: dict, primary_rms: set[str]) -> str:
    """Choose a FLAG subtype based on the record's RM. Generic default."""
    rm = record.get("rm")
    if rm is None or rm == "":
        return "unknown_not_in_mfl_csv"
    return f"{slug_rm(rm)}_not_in_mfl_csv"


def csv_match_block(csv_rec: dict) -> dict:
    """Extract reconciliation csv_match metadata from a parsed.json record."""
    return {
        "loc": csv_rec.get("loc"),
        "parcel_no": csv_rec.get("parcel_no"),
        "title_number": csv_rec.get("title_number"),
        "title_text": csv_rec.get("title_text"),
        "rm": csv_rec.get("rm"),
        "qtr": csv_rec.get("qtr"),
        "sec": csv_rec.get("sec"),
        "twp": csv_rec.get("twp"),
        "rng": csv_rec.get("rng"),
        "mer": csv_rec.get("mer"),
        "lsd": csv_rec.get("lsd"),
        "lot": csv_rec.get("lot"),
        "block": csv_rec.get("block"),
        "plan": csv_rec.get("plan"),
        "ext": csv_rec.get("ext"),
        "ac_estimated": csv_rec.get("ac_estimated"),
        "is_lsd": csv_rec.get("is_lsd"),
        "is_town_lot": csv_rec.get("is_town_lot"),
        "is_planned_parcel": csv_rec.get("is_planned_parcel"),
        "csv_source": csv_rec.get("csv_source"),
    }


def build_keep_record(current: dict, csv_matches: list[dict], pid: str, snapshot: str) -> dict:
    """Take a current quarters-data.js record + add reconciliation block (KEEP)."""
    rec = dict(current)
    # Strip any pre-existing reconciliation so re-runs are idempotent
    rec.pop("reconciliation", None)
    rec["reconciliation"] = {
        "bucket": "KEEP",
        "action": f"keep_under_{pid}_and_mark_mfl_titled_verified",
        "status": "mfl_titled_verified_at_snapshot",
        "snapshot_date": snapshot,
        "csv_matches": [csv_match_block(c) for c in csv_matches],
    }
    return rec


def build_flag_record(current: dict, pid: str, snapshot: str, primary_rms: set[str]) -> dict:
    rec = dict(current)
    rec.pop("reconciliation", None)
    subtype = flag_subtype_for(current, primary_rms)
    rec["reconciliation"] = {
        "bucket": "FLAG",
        "action": f"keep_under_{pid}_but_no_csv_match_at_snapshot",
        "status": "title_status_unresolved_under_csv_snapshot",
        "snapshot_date": snapshot,
        "flag_subtype": subtype,
        "follow_up_note": (
            "Record kept on map (anchor-truth principle). Pull title history "
            "or check whether held by a different Monette entity, leased back, "
            "or sold pre-2026-01-18."
        ),
    }
    return rec


def build_reassign_out_record(current: dict, target_pid: str, source_pid: str, snapshot: str) -> dict:
    rec = dict(current)
    rec.pop("reconciliation", None)
    rec["reconciliation"] = {
        "bucket": "REASSIGN_OUT",
        "action": f"move_from_{source_pid}_to_{target_pid}",
        "source_property_id": source_pid,
        "target_property_id": target_pid,
        "status": f"csv_confirms_mfl_titled_under_{target_pid.replace('-', '_')}",
        "snapshot_date": snapshot,
    }
    return rec


def build_reassign_in_record(current: dict, csv_match: dict | None, target_pid: str, source_pid: str, snapshot: str) -> dict:
    rec = dict(current)
    rec.pop("reconciliation", None)
    block = {
        "bucket": "REASSIGN_IN",
        "action": f"move_from_{source_pid}_to_{target_pid}",
        "source_property_id": source_pid,
        "target_property_id": target_pid,
        "status": f"csv_confirms_mfl_titled_under_{target_pid.replace('-', '_')}",
        "snapshot_date": snapshot,
    }
    if csv_match:
        block["csv_matches"] = [csv_match_block(csv_match)]
    rec["reconciliation"] = block
    return rec


def build_add_record(csv_rec: dict, pid: str, snapshot: str) -> dict:
    pn = csv_rec.get("parcel_no")
    is_lsd = bool(csv_rec.get("is_lsd"))
    return {
        "loc": csv_rec.get("loc"),
        "parcel_no": int(pn) if pn and str(pn).isdigit() else pn,
        "rm": csv_rec.get("rm"),
        "ac": csv_rec.get("ac_estimated"),
        "geometry": None,
        "owner": "MONETTE FARMS LTD.",
        "title": csv_rec.get("title_text"),
        "soil": None,
        "assessment": None,
        "crop": None,
        "tax_year": None,
        "gis_ac": None,
        "property_card": None,
        "source": "isc_csv_2026_01_18",
        "reconciliation": {
            "bucket": "ADD",
            "action": f"add_to_{pid}_geometry_pending",
            "status": "mfl_titled_verified_at_snapshot",
            "snapshot_date": snapshot,
            "geometry_action": "compute_lsd_polygon_from_dls" if is_lsd else "compute_quarter_polygon_from_dls",
            "csv_matches": [csv_match_block(csv_rec)],
        },
    }


def build_for_property(
    pid: str,
    parsed: dict,
    audit: dict,
    quarters: dict,
    snapshot: str,
) -> dict:
    """Build the delta block for a single property."""
    p_audit = audit["per_property"][pid]
    csv_recs_for_pid = parsed["by_property"].get(pid, [])

    # Index parsed CSVs across ALL properties, by parcel_no, so we can attach
    # csv_match metadata to reassign_in records that originated from a
    # different property's CSV bucket.
    csv_by_pn: dict[str, dict] = {}
    csv_by_loc_rm: dict[tuple, dict] = {}
    for other_pid, recs in parsed["by_property"].items():
        for r in recs:
            pn = str(r.get("parcel_no")) if r.get("parcel_no") else None
            if pn:
                csv_by_pn[pn] = r
            if r.get("loc") and r.get("rm"):
                csv_by_loc_rm[(r["loc"], r["rm"])] = r

    primary_rms = {r["rm"] for r in csv_recs_for_pid if r.get("rm")}

    # Collapse audit's KEEP title rows by unique current map feature so a
    # parcel with multiple CSV title rows (extension variants like
    # NW-7-13-14-W3 with 2 parcel_nos -> 1 polygon) becomes one keep record
    # with all CSV matches attached. Title rows != map features.
    keep_groups: dict[tuple, dict] = {}
    for entry in p_audit.get("keep", []):
        cur = entry["current"]
        cur_pn = str(cur.get("parcel_no")) if cur.get("parcel_no") is not None else None
        key = ("pn", cur_pn) if cur_pn else ("locrm", cur.get("loc"), cur.get("rm"))
        if key not in keep_groups:
            keep_groups[key] = {"current": cur, "csv_matches": []}
        keep_groups[key]["csv_matches"].append(entry["csv"])

    keep_records: list[dict] = []
    for group in keep_groups.values():
        cur = group["current"]
        # Also pull any CSV rows under the same property that match this current
        # feature but weren't represented in the audit's keep entries (defensive).
        cur_pn = str(cur.get("parcel_no")) if cur.get("parcel_no") is not None else None
        seen_match_keys = {
            (m.get("title_number"), m.get("parcel_no"), m.get("ext"))
            for m in group["csv_matches"]
        }
        for r in csv_recs_for_pid:
            mk = (r.get("title_number"), r.get("parcel_no"), r.get("ext"))
            if mk in seen_match_keys:
                continue
            if r.get("parcel_no") and str(r["parcel_no"]) == cur_pn:
                group["csv_matches"].append(r)
                seen_match_keys.add(mk)
            elif r.get("loc") == cur.get("loc") and r.get("rm") == cur.get("rm"):
                group["csv_matches"].append(r)
                seen_match_keys.add(mk)
        keep_records.append(build_keep_record(cur, group["csv_matches"], pid, snapshot))

    flag_records: list[dict] = [
        build_flag_record(cur, pid, snapshot, primary_rms)
        for cur in p_audit.get("flag", [])
    ]

    add_records: list[dict] = [
        build_add_record(r, pid, snapshot)
        for r in p_audit.get("add", [])
    ]

    reassign_out_records: list[dict] = []
    for entry in p_audit.get("reassign_out", []):
        cur = entry["current"]
        target = entry["target_property"]
        reassign_out_records.append(
            build_reassign_out_record(cur, target, pid, snapshot)
        )

    reassign_in_records: list[dict] = []
    for entry in p_audit.get("reassign_in", []):
        cur = entry["current"]
        csv_match_for_in = entry.get("csv")
        source_pid = entry.get("current_property")
        reassign_in_records.append(
            build_reassign_in_record(cur, csv_match_for_in, pid, source_pid, snapshot)
        )

    return {
        "add": add_records,
        "keep": keep_records,
        "flag": flag_records,
        "remove": [],
        "reassign_out": reassign_out_records,
        "reassign_in": reassign_in_records,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("property_id", help="property id to generate deltas for, e.g. prince-albert")
    ap.add_argument(
        "--include-reassign-targets",
        action="store_true",
        help="also include partial reassign_in delta blocks for any other property targeted by reassign_out",
    )
    args = ap.parse_args()

    parsed = json.loads(PARSED_PATH.read_text(encoding="utf-8"))
    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    quarters = load_quarters()
    snapshot = parsed.get("snapshot_date", "unknown")

    pid = args.property_id
    if pid not in audit["per_property"]:
        sys.exit(f"Unknown property: {pid}")

    out = {
        "branch": "feat/sk-titles-2026-01-18",
        "snapshot_date": snapshot,
        "generated_by": "scripts/build_deltas_from_audit.py",
        "scope": [pid],
        "anchor_truth_rule": (
            "CSV (ISC title export, snapshot 2026-01-18) is the truth for "
            "MFL title. Records currently on map but absent from CSV are "
            "kept (FLAG), never deleted."
        ),
        "properties": {pid: build_for_property(pid, parsed, audit, quarters, snapshot)},
    }

    # Add partial reassign_in blocks for properties targeted by this one's reassign_out
    if args.include_reassign_targets:
        targets: set[str] = set()
        for entry in audit["per_property"][pid].get("reassign_out", []):
            t = entry.get("target_property")
            if t:
                targets.add(t)
        for t in targets:
            t_block = {"add": [], "keep": [], "flag": [], "remove": [], "reassign_out": [], "reassign_in": []}
            # Find the current parcel that belongs to t and was claimed via this property's reassign_out
            for entry in audit["per_property"][pid].get("reassign_out", []):
                if entry.get("target_property") != t:
                    continue
                cur = entry["current"]
                # Look up CSV match for this parcel under t's CSV set
                csv_match_for = None
                for r in parsed["by_property"].get(t, []):
                    if r.get("parcel_no") and cur.get("parcel_no") and str(r["parcel_no"]) == str(cur["parcel_no"]):
                        csv_match_for = r
                        break
                t_block["reassign_in"].append(
                    build_reassign_in_record(cur, csv_match_for, t, pid, snapshot)
                )
            out["properties"][t] = t_block
            out["scope"].append(t)

    out_dir = OUT_DIR / pid
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "proposed-deltas.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    summary = {bucket: len(records) for bucket, records in out["properties"][pid].items()}
    print(f"Wrote {out_path}")
    print(f"  {pid}: {summary}")
    if args.include_reassign_targets and len(out["scope"]) > 1:
        for t in out["scope"][1:]:
            tsum = {bucket: len(records) for bucket, records in out["properties"][t].items()}
            print(f"  {t} (target): {tsum}")


if __name__ == "__main__":
    main()
