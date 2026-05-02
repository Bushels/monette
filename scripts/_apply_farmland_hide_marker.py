"""
Phase 6 (post-shipment UX polish): hide map markers for ALL farmland
properties. Keep dots only for non-farmland facilities (Pea Plant, Seed
plants).

User directive: dots on the map should only represent things that are
NOT farmland — facilities like the Pea Plant or Seed facility. Farmland
properties are represented by parcel polygons (or left-rail cards if
no polygons yet). Notes for areas go into left-side hovers/UI, not
on-map labels.

Strategy:
  - Maintain a small allow-list of facility IDs that KEEP their dots.
  - For every other property record (identified by `{ id:"...", ` block
    start), insert `hideMapMarker:true,` on a new line right after the
    id-line if not already present (idempotent).

Idempotent: re-runs are no-ops once flags are in place.

Run:
  python scripts/_apply_farmland_hide_marker.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "data.js"

# Allow-list: properties that KEEP their dot on the map (non-farmland
# facilities). Everything else gets hideMapMarker:true.
FACILITY_KEEP_DOT = {
    "outlook-seeds",         # Outlook Seeds Plant
    "lethbridge-pea-protein", # Lethbridge Pea Protein Facility
    "tonopah",               # Tonopah Seeds Facility
}

# Aggregators are skipped from rendering anyway (line 682 in view-map.jsx);
# no point flagging them. Also: corporate entities, debt facilities,
# and the inline `yards:[{id:"wolfe", ...}]` sub-records inside
# regina-south/airdrie are NOT property records — they're nested arrays
# and don't render as dots.
SKIP_NON_PROPERTY_IDS = {
    "monette-farms-ltd", "monette-land-corp", "dmo-holdings-ltd",
    "goats-peak-winery-ltd", "monette-farms-bc-ltd",
    "sfa", "fcc", "soderglen-vtb", "scotiabank-bilateral-equipment",
    "scotia-newlife-policy-debt", "john-deere-pmsis",
    "third-party-equipment", "real-property-leases",
    "wolfe", "kambietz", "binyard-1",  # nested yard records
    "montana",  # aggregator, already skipped
}


def main():
    text = DATA_PATH.read_text(encoding="utf-8")

    # Scope to the `properties:` array only — NOT `soldProperties:` (which has
    # its own marker layer and `hideMapMarker` check at view-map.jsx line 781,
    # and which the user wants to keep visible: "red sold markers stay").
    # Find the bounds of the properties array and only operate inside it.
    props_start_match = re.search(r"\bproperties\s*:\s*\[", text)
    if not props_start_match:
        sys.exit("Could not find `properties: [` in data.js")

    # Find matching closing bracket via brace-depth tracking
    start = props_start_match.end() - 1  # the '[' itself
    depth = 0
    end = None
    for i in range(start, len(text)):
        c = text[i]
        if c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        sys.exit("Could not find matching `]` for `properties:` array")

    # Match property-record starts at array level: lines like
    #   { id:"<id>", name:"<name>", province:"<prov>", region:"<region>", lat:N, lng:N,
    property_block_re = re.compile(
        r'(\{\s*id:"([a-z][a-z0-9-]*)"[^\n]*lat:[^\n]*lng:[^\n]*\n)',
        re.MULTILINE,
    )

    # Search ONLY inside the properties array slice
    inside = text[start:end]
    matches_in = list(property_block_re.finditer(inside))
    # Translate match offsets back to global text coords
    matches = []
    for m in matches_in:
        global_start = start + m.start(1)
        global_end = start + m.end(1)
        # Build a mock match-like object: (full_line, pid, global_end)
        matches.append((m.group(1), m.group(2), global_end))
    flagged: list[str] = []
    skipped_already: list[str] = []
    skipped_facility: list[str] = []
    skipped_other: list[str] = []

    # Process matches in REVERSE so insertion offsets don't shift downstream
    # match positions.
    new_text = text
    for full_line, pid, insert_at in reversed(matches):
        if pid in FACILITY_KEEP_DOT:
            skipped_facility.append(pid)
            continue
        if pid in SKIP_NON_PROPERTY_IDS:
            skipped_other.append(pid)
            continue
        # Defensive: skip any id starting with "sold-" (these are sold-property
        # markers in soldProperties; even if scope check missed something).
        if pid.startswith("sold-"):
            skipped_other.append(pid)
            continue

        # Idempotent check: peek at the next line after the id-line.
        next_line_end = new_text.find("\n", insert_at)
        if next_line_end == -1:
            next_line_end = len(new_text)
        next_line = new_text[insert_at:next_line_end]
        if "hideMapMarker:true" in next_line:
            skipped_already.append(pid)
            continue

        # Insert hideMapMarker:true on its own line, indented to match data.js style
        # (6 spaces — the body of each property block uses that indent).
        insertion = "      hideMapMarker:true,\n"
        new_text = new_text[:insert_at] + insertion + new_text[insert_at:]
        flagged.append(pid)

    DATA_PATH.write_text(new_text, encoding="utf-8")

    print(f"Updated {DATA_PATH.name}")
    print(f"  Flagged hideMapMarker:true: {len(flagged)}")
    for pid in flagged:
        print(f"    + {pid}")
    print(f"  Already had flag (idempotent skip): {len(skipped_already)}")
    for pid in skipped_already:
        print(f"    = {pid}")
    print(f"  Facility (keep dot): {len(skipped_facility)}")
    for pid in skipped_facility:
        print(f"    . {pid}")
    if skipped_other:
        print(f"  Skipped (non-property records): {len(skipped_other)}")


if __name__ == "__main__":
    main()
