"""
Audit script: diff the ISC-CSV-derived parcel set (parsed.json) against the current
quarters-data.js, per property. Produces machine-readable + markdown reports.

Reads:
  docs/logs/sk-titles/parsed.json      (output of parse_isc_titles.py)
  quarters-data.js                     (current map source of truth)

Writes:
  docs/logs/sk-titles/audit.json                  (machine-readable)
  docs/logs/sk-titles/audit-summary.md            (top-line + per-property table)
  docs/logs/sk-titles/audit-<property_id>.md      (per-property diff narrative)

Match key:
  Primary: parcel_no (ISC stable id)
  Secondary: (loc, rm) if parcel_no is missing on either side

Buckets:
  ADD      : in CSV, not in current quarters-data.js for this property
  KEEP     : in both (CSV confirms current; raise confidence to MFL-titled-verified)
  FLAG     : in current quarters-data.js but not in CSV → keep on map, flag follow-up
             (could be sold, leased, other entity, or in a different property's bucket)
  REASSIGN : in CSV under property A, but currently filed under property B
             (these need a property-id move; do NOT delete)

Run:
  python scripts/audit_isc_vs_quarters.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PARSED_PATH = REPO_ROOT / "docs" / "logs" / "sk-titles" / "parsed.json"
QUARTERS_PATH = REPO_ROOT / "quarters-data.js"
OUT_DIR = REPO_ROOT / "docs" / "logs" / "sk-titles"


def load_quarters_data() -> dict:
    text = QUARTERS_PATH.read_text(encoding="utf-8")
    m = re.search(r"window\.MONETTE_QUARTERS_REAL\s*=\s*(\{.*\})", text, re.DOTALL)
    if not m:
        sys.exit("Could not parse quarters-data.js — missing window.MONETTE_QUARTERS_REAL")
    return json.loads(m.group(1))


def build_csv_index(parsed: dict) -> tuple[dict, dict]:
    """Return (parcel_no -> rec, (loc,rm) -> rec) indexes across all properties."""
    by_pn: dict[str, dict] = {}
    by_loc_rm: dict[tuple[str, str], dict] = {}
    for pid, recs in parsed["by_property"].items():
        for r in recs:
            r2 = dict(r)
            r2["_property_id"] = pid
            if r["parcel_no"]:
                by_pn[str(r["parcel_no"])] = r2
            if r.get("loc") and r.get("rm"):
                by_loc_rm[(r["loc"], r["rm"])] = r2
    return by_pn, by_loc_rm


def build_quarters_index(quarters: dict) -> tuple[dict, dict, dict]:
    """Return (parcel_no -> (property_id, rec), (loc,rm) -> (property_id, rec), property_id -> count)."""
    by_pn: dict[str, tuple[str, dict]] = {}
    by_loc_rm: dict[tuple[str, str], tuple[str, dict]] = {}
    counts: dict[str, int] = {}
    for pid, recs in quarters.items():
        counts[pid] = len(recs)
        for r in recs:
            pn = r.get("parcel_no")
            if pn is not None:
                by_pn[str(pn)] = (pid, r)
            loc = r.get("loc")
            rm = r.get("rm")
            if loc and rm:
                by_loc_rm[(loc, rm)] = (pid, r)
    return by_pn, by_loc_rm, counts


def diff_property(
    pid: str,
    csv_recs: list[dict],
    quarters: dict,
    quarters_pn: dict,
    quarters_loc_rm: dict,
) -> dict:
    """Bucket every parcel for this property into ADD / KEEP / FLAG / REASSIGN."""
    add: list[dict] = []
    keep: list[dict] = []
    reassign: list[dict] = []  # CSV says this property, but currently filed elsewhere

    csv_seen_pns: set[str] = set()
    csv_seen_loc_rm: set[tuple[str, str]] = set()

    for r in csv_recs:
        pn = str(r["parcel_no"]) if r["parcel_no"] else None
        loc_rm = (r["loc"], r["rm"]) if r.get("loc") and r.get("rm") else None
        if pn:
            csv_seen_pns.add(pn)
        if loc_rm:
            csv_seen_loc_rm.add(loc_rm)

        match = None
        match_pid = None
        if pn and pn in quarters_pn:
            match_pid, match = quarters_pn[pn]
        elif loc_rm and loc_rm in quarters_loc_rm:
            match_pid, match = quarters_loc_rm[loc_rm]

        if match is None:
            add.append(r)
        elif match_pid == pid:
            keep.append({"csv": r, "current": match})
        else:
            reassign.append({"csv": r, "current": match, "current_property": match_pid})

    # FLAG: any current parcel for this property not matched by CSV (kept, not deleted)
    flag: list[dict] = []
    for cur in quarters.get(pid, []):
        cur_pn = str(cur["parcel_no"]) if cur.get("parcel_no") is not None else None
        cur_loc_rm = (cur.get("loc"), cur.get("rm")) if cur.get("loc") and cur.get("rm") else None
        in_csv = (cur_pn and cur_pn in csv_seen_pns) or (cur_loc_rm and cur_loc_rm in csv_seen_loc_rm)
        if not in_csv:
            flag.append(cur)

    return {
        "property_id": pid,
        "csv_total": len(csv_recs),
        "current_total": len(quarters.get(pid, [])),
        "add": add,
        "keep": keep,
        "reassign": reassign,
        "flag": flag,
        "summary": {
            "add": len(add),
            "keep": len(keep),
            "reassign": len(reassign),
            "flag": len(flag),
        },
    }


def write_summary_md(audit: dict, out_path: Path):
    lines = [
        "# ISC vs quarters-data.js — Audit Summary",
        "",
        f"**Snapshot date:** {audit['snapshot_date']}",
        f"**Generated:** {audit.get('generated_at', '')}",
        "",
        "## Per-property reconciliation",
        "",
        "| Property | CSV parcels | Current parcels | ADD | KEEP | REASSIGN-in | FLAG |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for pid in sorted(audit["per_property"].keys()):
        p = audit["per_property"][pid]
        s = p["summary"]
        lines.append(
            f"| `{pid}` | {p['csv_total']} | {p['current_total']} | {s['add']} | {s['keep']} | {s['reassign']} | {s['flag']} |"
        )

    lines += [
        "",
        "## Bucket meanings",
        "- **ADD**: parcel is in CSV but not currently in the map for this property (not under any property by parcel_no/loc-rm) — net-new MFL-titled record for the property",
        "- **KEEP**: parcel is in both CSV and current map under this property — confirmed MFL-titled, raise confidence",
        "- **REASSIGN-in**: parcel is in CSV claiming this property, but currently filed under a *different* property — needs a property-id move (do not delete)",
        "- **FLAG**: parcel is in current map under this property but not in CSV — could be (a) sold pre-2026-01-18, (b) leased/rented, (c) titled to a different Monette entity. Keep on map; flag for follow-up.",
        "",
        "## Top decisions surfaced",
    ]

    # Surface biggest-impact decisions
    decisions = []
    for pid, p in audit["per_property"].items():
        if p["summary"]["reassign"] > 0:
            decisions.append(f"- `{pid}`: {p['summary']['reassign']} parcels arriving from other properties (REASSIGN)")
        if p["summary"]["add"] > 5:
            decisions.append(f"- `{pid}`: {p['summary']['add']} net-new ADD parcels — likely needs geometry computation")
        if p["summary"]["flag"] > 10:
            decisions.append(f"- `{pid}`: {p['summary']['flag']} FLAG parcels — large unverified-by-CSV set; investigate post-Codex")
    lines.extend(decisions or ["- (none surfaced — all properties land cleanly)"])

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_property_md(pid: str, p: dict, out_path: Path):
    s = p["summary"]
    lines = [
        f"# Audit — `{pid}`",
        "",
        f"- CSV parcels claimed for this property: **{p['csv_total']}**",
        f"- Current parcels in quarters-data.js: **{p['current_total']}**",
        f"- ADD: {s['add']}  |  KEEP: {s['keep']}  |  REASSIGN-in: {s['reassign']}  |  FLAG: {s['flag']}",
        "",
    ]

    def fmt_csv(r):
        return f"`{r['loc']}`  · pn `{r['parcel_no'] or '?'}`  · {r['rm']}  · ext {r.get('ext', '')}  · {'LSD' if r['is_lsd'] else ('TOWN-LOT' if r['is_town_lot'] else ('PLANNED' if r['is_planned_parcel'] else 'QUARTER'))}"

    def fmt_cur(r):
        return f"`{r.get('loc')}`  · pn `{r.get('parcel_no')}`  · {r.get('rm')}  · ac {r.get('ac')}  · soil {r.get('soil')}"

    if p["add"]:
        lines += ["## ADD — in CSV, not in any current property", ""]
        for r in p["add"]:
            lines.append(f"- {fmt_csv(r)}")
        lines.append("")

    if p["reassign"]:
        lines += ["## REASSIGN-in — in CSV under this property, currently filed under another", ""]
        for entry in p["reassign"]:
            lines.append(f"- CSV: {fmt_csv(entry['csv'])}")
            lines.append(f"  · CURRENT: under `{entry['current_property']}`  → {fmt_cur(entry['current'])}")
        lines.append("")

    if p["flag"]:
        lines += ["## FLAG — currently mapped, not in CSV (keep, investigate)", ""]
        for r in p["flag"]:
            lines.append(f"- {fmt_cur(r)}")
        lines.append("")

    if p["keep"]:
        lines += ["## KEEP — confirmed MFL-titled (in both CSV and current map)", ""]
        for entry in p["keep"][:50]:
            lines.append(f"- {fmt_cur(entry['current'])}  ← CSV title `{entry['csv']['title_number']}` ext {entry['csv'].get('ext','')}")
        if len(p["keep"]) > 50:
            lines.append(f"- ... ({len(p['keep']) - 50} more, omitted from narrative)")
        lines.append("")

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    if not PARSED_PATH.exists():
        sys.exit(f"Run scripts/parse_isc_titles.py first — {PARSED_PATH} missing")

    parsed = json.loads(PARSED_PATH.read_text(encoding="utf-8"))
    quarters = load_quarters_data()

    csv_pn, csv_loc_rm = build_csv_index(parsed)
    q_pn, q_loc_rm, q_counts = build_quarters_index(quarters)

    per_property: dict[str, dict] = {}
    all_csv_pids = set(parsed["by_property"].keys())
    all_q_pids = set(quarters.keys())

    for pid in sorted(all_csv_pids | all_q_pids):
        csv_recs = parsed["by_property"].get(pid, [])
        per_property[pid] = diff_property(pid, csv_recs, quarters, q_pn, q_loc_rm)

    # CSV totals reconciliation
    csv_total = sum(len(recs) for recs in parsed["by_property"].values())
    matched_pn = sum(1 for r_list in parsed["by_property"].values() for r in r_list if str(r["parcel_no"]) in q_pn)
    matched_loc_rm_only = sum(
        1 for r_list in parsed["by_property"].values() for r in r_list
        if str(r["parcel_no"]) not in q_pn and (r.get("loc"), r.get("rm")) in q_loc_rm
    )

    audit = {
        "snapshot_date": parsed.get("snapshot_date"),
        "generated_at": "",  # filled at write-time below
        "csv_total_parcels": csv_total,
        "csv_matches_by_parcel_no": matched_pn,
        "csv_matches_by_loc_rm_only": matched_loc_rm_only,
        "csv_unmatched": csv_total - matched_pn - matched_loc_rm_only,
        "per_property": per_property,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    import datetime
    audit["generated_at"] = datetime.datetime.utcnow().isoformat() + "Z"

    json_out = OUT_DIR / "audit.json"
    json_out.write_text(json.dumps(audit, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {json_out}")

    summary_out = OUT_DIR / "audit-summary.md"
    write_summary_md(audit, summary_out)
    print(f"Wrote {summary_out}")

    for pid, p in per_property.items():
        if p["csv_total"] == 0 and p["current_total"] == 0:
            continue
        out = OUT_DIR / f"audit-{pid}.md"
        write_property_md(pid, p, out)
        print(f"Wrote {out}")

    # Top-line console output
    print()
    print("=" * 70)
    print(f"CSV parcels total: {csv_total}")
    print(f"  matched by parcel_no: {matched_pn}")
    print(f"  matched by (loc,rm) only: {matched_loc_rm_only}")
    print(f"  unmatched: {audit['csv_unmatched']}")
    print()
    print("Per-property summary:")
    print(f"  {'property':<20} {'CSV':>5} {'CUR':>5} {'ADD':>5} {'KEEP':>5} {'REASN':>5} {'FLAG':>5}")
    for pid in sorted(per_property.keys()):
        p = per_property[pid]
        s = p["summary"]
        print(f"  {pid:<20} {p['csv_total']:>5} {p['current_total']:>5} {s['add']:>5} {s['keep']:>5} {s['reassign']:>5} {s['flag']:>5}")


if __name__ == "__main__":
    main()
