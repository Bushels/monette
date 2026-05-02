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
    parsed: dict,
) -> dict:
    """Bucket every parcel for this property into ADD / KEEP / REASSIGN-in / REASSIGN-out / FLAG.

    Codex round-1 improvements (per docs/logs/sk-titles/wymark/methodology.md):
      - Distinguish reassign_in (CSV claims this property, currently elsewhere)
        from reassign_out (current under this property, CSV claims another).
        The flag bucket no longer hides reassign-out features.
      - Track unique_map_features alongside csv_title_rows since they aren't 1:1.
    """
    reassign_in: list[dict] = []   # CSV says this property, currently filed elsewhere
    add: list[dict] = []
    keep: list[dict] = []

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
            reassign_in.append({"csv": r, "current": match, "current_property": match_pid})

    # Build a lookup for "is this current parcel claimed by another property's CSV set?"
    # Used to split FLAG into reassign_out (claimed elsewhere) vs true FLAG.
    other_csv_pns: dict[str, str] = {}      # pn -> claimant property_id
    other_csv_loc_rm: dict[tuple, str] = {}
    for other_pid, other_recs in parsed["by_property"].items():
        if other_pid == pid:
            continue
        for r in other_recs:
            opn = str(r["parcel_no"]) if r["parcel_no"] else None
            olrm = (r["loc"], r["rm"]) if r.get("loc") and r.get("rm") else None
            if opn:
                other_csv_pns[opn] = other_pid
            if olrm:
                other_csv_loc_rm[olrm] = other_pid

    reassign_out: list[dict] = []
    flag: list[dict] = []
    for cur in quarters.get(pid, []):
        cur_pn = str(cur["parcel_no"]) if cur.get("parcel_no") is not None else None
        cur_loc_rm = (cur.get("loc"), cur.get("rm")) if cur.get("loc") and cur.get("rm") else None
        in_own_csv = (cur_pn and cur_pn in csv_seen_pns) or (cur_loc_rm and cur_loc_rm in csv_seen_loc_rm)
        if in_own_csv:
            continue  # already accounted for in keep
        # Is it claimed by another property's CSV?
        claimant = (other_csv_pns.get(cur_pn) if cur_pn else None) or (
            other_csv_loc_rm.get(cur_loc_rm) if cur_loc_rm else None
        )
        if claimant:
            reassign_out.append({"current": cur, "target_property": claimant})
        else:
            flag.append(cur)

    # Unique-map-feature counts (not title-row counts).
    # KEEP/FLAG/REASSIGN-out are already keyed off current map features (deduplicated).
    # KEEP can have multiple CSV title rows pointing to the same current feature — collapse.
    unique_keep_features = len({id(e["current"]) for e in keep})
    unique_reassign_in = len({id(e["current"]) for e in reassign_in})

    return {
        "property_id": pid,
        "csv_total": len(csv_recs),
        "current_total": len(quarters.get(pid, [])),
        "add": add,
        "keep": keep,
        "reassign_in": reassign_in,
        "reassign_out": reassign_out,
        "flag": flag,
        "summary": {
            "add": len(add),
            "keep_title_rows": len(keep),
            "keep_unique_features": unique_keep_features,
            "reassign_in_title_rows": len(reassign_in),
            "reassign_in_unique_features": unique_reassign_in,
            "reassign_out": len(reassign_out),
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
        "Title-row counts and unique-map-feature counts are NOT 1:1.",
        "One legal location can have multiple CSV title rows (extension variants);",
        "one current map feature is one polygon. KEEP/REASSIGN-in show both.",
        "",
        "## Per-property reconciliation",
        "",
        "| Property | CSV rows | Cur rows | ADD | KEEP rows / feats | REASSIGN-in rows / feats | REASSIGN-out feats | FLAG |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for pid in sorted(audit["per_property"].keys()):
        p = audit["per_property"][pid]
        s = p["summary"]
        lines.append(
            f"| `{pid}` | {p['csv_total']} | {p['current_total']} | {s['add']} | "
            f"{s['keep_title_rows']} / {s['keep_unique_features']} | "
            f"{s['reassign_in_title_rows']} / {s['reassign_in_unique_features']} | "
            f"{s['reassign_out']} | {s['flag']} |"
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
        s = p["summary"]
        if s["reassign_in_title_rows"] > 0:
            decisions.append(f"- `{pid}`: {s['reassign_in_title_rows']} title rows arriving from other properties ({s['reassign_in_unique_features']} unique features) — REASSIGN-in")
        if s["reassign_out"] > 0:
            decisions.append(f"- `{pid}`: {s['reassign_out']} features moving out to another property — REASSIGN-out")
        if s["add"] > 5:
            decisions.append(f"- `{pid}`: {s['add']} net-new ADD parcels — likely needs geometry computation")
        if s["flag"] > 10:
            decisions.append(f"- `{pid}`: {s['flag']} FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass")
    lines.extend(decisions or ["- (none surfaced — all properties land cleanly)"])

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_property_md(pid: str, p: dict, out_path: Path):
    s = p["summary"]
    lines = [
        f"# Audit — `{pid}`",
        "",
        f"- CSV title rows for this property: **{p['csv_total']}**",
        f"- Current map records (quarters-data.js): **{p['current_total']}**",
        f"- ADD: {s['add']}  ·  "
        f"KEEP {s['keep_title_rows']} title rows / {s['keep_unique_features']} unique features  ·  "
        f"REASSIGN-in {s['reassign_in_title_rows']} title rows / {s['reassign_in_unique_features']} unique features  ·  "
        f"REASSIGN-out {s['reassign_out']} features  ·  "
        f"FLAG {s['flag']}",
        "",
        "_Note: title rows ≠ map features. One legal location can have multiple CSV title rows._",
        "",
    ]

    def fmt_csv(r):
        return f"`{r['loc']}`  · pn `{r['parcel_no'] or '?'}`  · {r['rm']}  · ext {r.get('ext', '')}  · {'LSD' if r['is_lsd'] else ('TOWN-LOT' if r['is_town_lot'] else ('PLANNED' if r['is_planned_parcel'] else 'QUARTER'))}"

    def fmt_cur(r):
        return f"`{r.get('loc')}`  · pn `{r.get('parcel_no')}`  · {r.get('rm')}  · ac {r.get('ac')}  · soil {r.get('soil')}"

    if p["add"]:
        lines += ["## ADD — in CSV, not in any current map record", ""]
        for r in p["add"]:
            lines.append(f"- {fmt_csv(r)}")
        lines.append("")

    if p["reassign_in"]:
        lines += ["## REASSIGN-in — CSV claims this property, currently filed under another", ""]
        for entry in p["reassign_in"]:
            lines.append(f"- CSV: {fmt_csv(entry['csv'])}")
            lines.append(f"  · CURRENT: under `{entry['current_property']}`  → {fmt_cur(entry['current'])}")
        lines.append("")

    if p.get("reassign_out"):
        lines += ["## REASSIGN-out — currently under this property, CSV claims another", ""]
        for entry in p["reassign_out"]:
            lines.append(f"- CURRENT: {fmt_cur(entry['current'])}")
            lines.append(f"  · CSV-claimed by: `{entry['target_property']}`")
        lines.append("")

    if p["flag"]:
        lines += ["## FLAG — currently mapped, not claimed by any CSV row (keep, investigate)", ""]
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
        per_property[pid] = diff_property(pid, csv_recs, quarters, q_pn, q_loc_rm, parsed)

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
    print("=" * 90)
    print(f"CSV parcels total: {csv_total}")
    print(f"  matched by parcel_no: {matched_pn}")
    print(f"  matched by (loc,rm) only: {matched_loc_rm_only}")
    print(f"  unmatched: {audit['csv_unmatched']}")
    print()
    print("Per-property summary (rows = CSV title rows; feats = unique map features):")
    print(f"  {'property':<20} {'CSV':>5} {'CUR':>5} {'ADD':>4} {'KEEPrf':>7} {'RASIrf':>7} {'RASOf':>6} {'FLAG':>5}")
    for pid in sorted(per_property.keys()):
        p = per_property[pid]
        s = p["summary"]
        keeps = f"{s['keep_title_rows']}/{s['keep_unique_features']}"
        rasi = f"{s['reassign_in_title_rows']}/{s['reassign_in_unique_features']}"
        print(f"  {pid:<20} {p['csv_total']:>5} {p['current_total']:>5} {s['add']:>4} {keeps:>7} {rasi:>7} {s['reassign_out']:>6} {s['flag']:>5}")

    # Runtime-key invariant: view-map.jsx keys parcels as `property_id:loc`.
    # Per Codex post-merge audit (codex-post-merge-audit.md), the `(loc, rm)`
    # dedup is not strict enough — same-loc/different-rm pairs survive but
    # collide at the renderer. Assert no duplicate `property_id:loc` rows.
    print()
    print("Runtime-key invariant check (property_id:loc must be unique):")
    violations: list[tuple[str, str, list]] = []
    for pid, recs in quarters.items():
        from collections import defaultdict
        loc_to_pns: dict[str, list] = defaultdict(list)
        for r in recs:
            loc = r.get("loc")
            if not loc:
                continue
            loc_to_pns[loc].append(r.get("parcel_no"))
        for loc, pns in loc_to_pns.items():
            if len(pns) > 1:
                violations.append((pid, loc, pns))
    if violations:
        print(f"  FAIL: {len(violations)} duplicate property_id:loc groups found")
        for pid, loc, pns in violations:
            print(f"    {pid}:{loc} — parcel_nos: {pns}")
        print()
        print("  Each duplicate would render as a single feature (last-write-wins)")
        print("  at runtime. Run scripts/_dedup_quarters_by_loc_rm.py to collapse.")
        sys.exit(1)
    print(f"  PASS: 0 duplicate property_id:loc groups across {sum(len(r) for r in quarters.values())} records")


if __name__ == "__main__":
    main()
