# PROJECT_STATE.md

## Last verified commit (main)
194dd32 Merge feat/atlas-hide-property-markers — UX polish over SK Titles work
(includes fdd806c Merge feat/sk-titles-2026-01-18 — SK Titles Update)

## Active task
**No active feature task.** SK Titles Update + atlas-hide-property-markers shipped to main and pushed to origin (Bushels/monette).

## SK Titles shipped state (on main)
- 559/559 CSV parcels reconciled (unmatched: 0)
- 1,418 records across 14 SK property buckets carry mflTitleSnapshot metadata
- swift-current 0 → 28 records, regina-south 0 → 120 records (geometryStatus: "polygons")
- 159 polygons computed via DLS quarter math + new LSD math + Plan N3619 placeholders
- hafford rented-back narrative surfaced (2 of 158 quarters MFL-titled)
- 5 Montana sub-properties given hideMapMarker:true (UX polish)
- Cache-bust: data.js v=37, quarters-data.js v=2

Codex final review record: `docs/logs/sk-titles/codex-final-review.md`
Methodology log (tracked): `docs/logs/sk-titles-2026-01-18.md`
Methodology playbook (memory): `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/sk_titles_methodology.md`

## Other branches in flight (not active)
- `feat/seeding-calibration` (commit `2632275`, 12 files mid-iteration) — GEE seeding-calibration pipeline. To resume: `git checkout feat/seeding-calibration` and follow `docs/logs/seeding-calibration.md`.

## Known blockers
None active.

## Next action
None pending. `feat/seeding-calibration` is the next workstream when user is ready.

Optional housekeeping: local feature branches `feat/sk-titles-2026-01-18` + `feat/atlas-hide-property-markers` can be deleted (both merged into main). Run `git branch -d feat/sk-titles-2026-01-18 feat/atlas-hide-property-markers` when ready.
