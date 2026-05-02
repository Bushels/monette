"""
Phase 3 task 2 + 3: surgically update data.js property records with
post-SK-titles totals + mflTitleSnapshot blocks.

For each affected property:
- Update `parcels:N` field to current quarters-data.js record count
- Insert a new `mflTitleSnapshot:{...}` block after the parcels line,
  capturing the 2026-01-18 ISC reconciliation result
- For hafford specifically, the snapshot block carries the rented-back
  narrative significance per user task 3

The script is surgical (per-property regex matches on the property block
in data.js). It does not try to JSON-parse the JS file — data.js is
hand-written JS literal syntax.

Idempotent: re-running produces the same data.js (the mflTitleSnapshot
block is keyed by snapshotDate; existing block gets replaced if
snapshotDate matches).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
QUARTERS_PATH = REPO_ROOT / "quarters-data.js"
DATA_PATH = REPO_ROOT / "data.js"


def load_quarters() -> dict:
    text = QUARTERS_PATH.read_text(encoding="utf-8")
    m = re.search(r"window\.MONETTE_QUARTERS_REAL\s*=\s*(\{.*\})", text, re.DOTALL)
    return json.loads(m.group(1))


def reconciliation_stats(records: list[dict]) -> dict:
    """Tally reconciliation buckets in a property's quarter records."""
    buckets = {"KEEP": 0, "FLAG": 0, "ADD": 0, "REASSIGN_IN": 0, "REASSIGN_OUT": 0, "NONE": 0}
    flag_subtypes: dict[str, int] = {}
    for r in records:
        recon = r.get("reconciliation") or {}
        b = recon.get("bucket", "NONE")
        if b in buckets:
            buckets[b] += 1
        else:
            buckets["NONE"] += 1
        if b == "FLAG":
            sub = recon.get("flag_subtype", "unknown")
            flag_subtypes[sub] = flag_subtypes.get(sub, 0) + 1
    return {"buckets": buckets, "flag_subtypes": flag_subtypes}


# Per-property narrative significance for the mflTitleSnapshot block.
# Properties not in this map get a generic snapshot block.
NARRATIVE = {
    "hafford": (
        "RENTED-BACK THESIS VALIDATED. Only 2 of the 158 mapped Hafford "
        "quarters are titled to MONETTE FARMS LTD. as of 2026-01-18 — the "
        "other 156 are flagged because the title is not in MFL's name on "
        "the ISC register. This precisely matches the multi-source community "
        "intel that Walter Farms (rumored Hafford bulk buyer) and the "
        "Simmons/Raptor sale lineage purchased the footprint, with Monette "
        "operating as a rented-back tenant. See memory hafford_landowners.md "
        "for the full multi-source intel chain."
    ),
    "swift-current": (
        "First geometry landing for the court-file Swift Current property. "
        "Was point-only with a 49,775-acre headline claim and no parcel rows. "
        "The 2026-01-18 ISC snapshot adds 30 records: 16 reassigned in from "
        "wymark (Stewart Valley townships T13/R13-R14/W3 — clean quarters and "
        "LSDs that the older Wymark sale-package XLSX had absorbed) plus 14 "
        "net-new LSD ADDs. Geometry pending DLS LSD computation in Phase 4. "
        "The 49,775-acre court-file claim is NOT reconciled by this 31-CSV-row "
        "subset — the bulk likely sits under non-MFL Monette entities or "
        "leased land outside the ISC title-export scope."
    ),
    "regina-south": (
        "First geometry landing for the court-file Regina South property. "
        "Was point-only with a 32,056-acre headline claim and no parcel rows. "
        "The 2026-01-18 ISC snapshot adds 126 records covering RM Lajord 128 "
        "(Riceton/Drinkwater area, 65 parcels in T15-R18-W2M), RM Bratt's "
        "Lake 129 (Wilcox area, 46 parcels), RM Edenwold 158 (White City "
        "area, 14 parcels in T16-R18-W2M directly N of Lajord), and RM "
        "Longlaketon 219 (Lumsden area, 1 parcel reassigned from raymore). "
        "Lajord + Edenwold form a contiguous 79-parcel block south-then-"
        "north of Regina city. 125 records have geometry: null pending "
        "DLS quarter polygon computation in Phase 4."
    ),
    "wymark": (
        "Major reassignment in this snapshot: 16 features (T13/R13-R14/W3 "
        "Stewart Valley territory) moved out to swift-current per the ISC "
        "title-side anchor. The 22 KEEP title rows collapse to 19 unique "
        "features (3 duplicate-titled). 66 FLAG records remain — including "
        "the 5 Carefoot Acres / Waldeck rumored-sale quarters and the 4 "
        "Section 18-12-14-W3 feedlot-proposal parcels — none of which are "
        "MFL-titled per the snapshot. Public copy treats those as "
        "unresolved sale-status flags pending fresh ISC pulls."
    ),
    "calderbank": (
        "Largest title-row collapse in the dataset: 138 CSV title rows for "
        "RM Enfield 194 + RM Morse 165 collapse to 110 unique map features "
        "(28 duplicate-titled with extension variants). RM Morse 165's 64 "
        "parcels fold into calderbank per Codex round-1 endorsement (the "
        "townships are contiguous with RM Enfield 194 — same operating "
        "block). Plus 3 net-new ADDs awaiting Phase 4 polygon computation."
    ),
    "vanguard": (
        "Folded the 16 Village of Neville town-lot records into vanguard "
        "as the closest property anchor (~17km NE of Neville village). "
        "Includes 14 net-new town-lot ADDs in Plan N3619 (Lot/Block format, "
        "geometry pending Phase 4 town-lot math) plus 2 quarter-section "
        "records (SE/SW-6-12-12-W3) that were originally under vanguard, "
        "moved to __neville__ via Wave C reassign-out, then folded back here."
    ),
}


def render_snapshot_block(pid: str, stats: dict, total: int, indent: str = "      ") -> str:
    """Render an mflTitleSnapshot:{...} JS block for the given property."""
    b = stats["buckets"]
    subtypes = stats["flag_subtypes"]
    significance = NARRATIVE.get(pid)

    lines = [
        f"{indent}mflTitleSnapshot:{{",
        f'{indent}  source:"ISC title export — MONETTE FARMS LTD.",',
        f'{indent}  snapshotDate:"2026-01-18",',
        f"{indent}  totalRecords:{total},",
        f"{indent}  mflTitledRecords:{b['KEEP'] + b['ADD'] + b['REASSIGN_IN']},",
        f"{indent}  flaggedRecords:{b['FLAG']},",
        f"{indent}  buckets:{{"
        + f"keep:{b['KEEP']},flag:{b['FLAG']},add:{b['ADD']},reassignIn:{b['REASSIGN_IN']},reassignOut:{b['REASSIGN_OUT']}"
        + "},",
    ]
    if subtypes:
        items = ",".join(f'"{k}":{v}' for k, v in sorted(subtypes.items()))
        lines.append(f"{indent}  flagSubtypes:{{{items}}},")
    if significance:
        # Escape backticks for JS template literal compatibility (none expected) +
        # escape backslashes + escape double-quotes for inclusion in "..." JS string.
        safe = significance.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'{indent}  significance:"{safe}",')
    lines.append(
        f'{indent}  methodologyLog:"docs/logs/sk-titles-2026-01-18.md",'
    )
    lines.append(f"{indent}}},")
    return "\n".join(lines)


def update_property_block(text: str, pid: str, new_parcels: int, snapshot_block: str) -> tuple[str, str]:
    """Surgically update one property's record in data.js text. Returns (new_text, change_note)."""
    # Find this property's block start
    start_pattern = re.compile(r'\{\s*id:"' + re.escape(pid) + r'"', re.MULTILINE)
    sm = start_pattern.search(text)
    if not sm:
        return text, f"  {pid}: SKIP (block not found)"

    # Find the NEXT property's block start (any pid, not this one). The
    # generic boundary lets us scope edits correctly. Pid-specific
    # boundary search returns None for the last property in iteration
    # order, which would extend the block to end of file and clobber
    # earlier insertions via the existing_snapshot regex.
    any_property_start = re.compile(r'\{\s*id:"[a-z][a-z0-9-]*"', re.MULTILINE)
    next_start = any_property_start.search(text, sm.end())
    block_end = next_start.start() if next_start else len(text)
    block = text[sm.start():block_end]

    # Update parcels:N within the block. The pattern handles "parcels:0," and
    # "parcels: 131," etc.
    parcels_pattern = re.compile(r"parcels\s*:\s*(\d+)")
    pm = parcels_pattern.search(block)
    if not pm:
        return text, f"  {pid}: SKIP (parcels field not found)"

    old_parcels = int(pm.group(1))
    new_block = parcels_pattern.sub(f"parcels:{new_parcels}", block, count=1)

    # Strip any pre-existing mflTitleSnapshot block (idempotent re-runs).
    existing_snapshot = re.compile(
        r"\n\s*mflTitleSnapshot:\{[^}]*?(?:\{[^}]*?\}[^}]*?)*\},?",
        re.DOTALL,
    )
    new_block = existing_snapshot.sub("", new_block)

    # Insert the new snapshot block after the parcels line.
    # Find the end of the parcels line (the next newline after the parcels match).
    insertion_pattern = re.compile(r"(parcels\s*:\s*\d+\s*,[^\n]*\n)")
    im = insertion_pattern.search(new_block)
    if not im:
        return text, f"  {pid}: SKIP (could not locate parcels line for insert)"

    insert_at = im.end()
    new_block = new_block[:insert_at] + snapshot_block + "\n" + new_block[insert_at:]

    new_text = text[:sm.start()] + new_block + text[block_end:]
    return new_text, f"  {pid}: parcels {old_parcels} -> {new_parcels}, snapshot block added"


def main():
    quarters = load_quarters()
    text = DATA_PATH.read_text(encoding="utf-8")

    # Process every SK property that has reconciliation data
    sk_properties = [
        "wymark", "swift-current", "prince-albert", "raymore", "outlook",
        "kamsack", "calderbank", "ponteix", "vanguard", "regina-south",
        "hafford", "admiral",
    ]

    notes: list[str] = []
    for pid in sk_properties:
        recs = quarters.get(pid, [])
        stats = reconciliation_stats(recs)
        if stats["buckets"]["NONE"] == len(recs) and recs:
            # No reconciliation data — skip
            notes.append(f"  {pid}: SKIP (no reconciliation data)")
            continue
        snapshot_block = render_snapshot_block(pid, stats, len(recs))
        text, note = update_property_block(text, pid, len(recs), snapshot_block)
        notes.append(note)

    DATA_PATH.write_text(text, encoding="utf-8")
    print(f"Updated {DATA_PATH.name}")
    for n in notes:
        print(n)


if __name__ == "__main__":
    main()
