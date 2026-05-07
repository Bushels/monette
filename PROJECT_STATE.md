# PROJECT_STATE.md

## Last verified commit (main)
6de2e24 feat(atlas): farmland-wide hideMapMarker — only facilities show map dots

## Active task
**No active feature task.** SK Titles Update + atlas-hide-property-markers + Codex post-merge audit follow-up + farmland-wide marker hide + **Montana May 6 seeding rerun (+5,467 confidently-seeded ac, Codex-audited)** all shipped to main and pushed to origin (Bushels/monette).

## SK Titles shipped state (on main)
- 559/559 CSV parcels reconciled (unmatched: 0)
- 1,410 records across 14 SK property buckets carry mflTitleSnapshot metadata
- swift-current 0 → 28 records, regina-south 0 → 120 records (geometryStatus: "polygons")
- vanguard 93 → 105 records (Neville town lots folded in, 3 runtime-key collisions resolved across 2 sessions)
- 159 polygons computed via DLS quarter math + new LSD math + Plan N3619 placeholders
- hafford rented-back narrative surfaced (2 of 158 quarters MFL-titled)
- 24 farmland/farm-area properties carry `hideMapMarker:true` (atlas dot cleanup, 2026-05-02)
- 3 facilities keep their dots: outlook-seeds, lethbridge-pea-protein, tonopah
- Sold-marker layer untouched (red dots stay for sold-hafford-phase-2, sold-havre, sold-regina-i)
- Cache-bust: data.js v=39, quarters-data.js v=3

## Audit invariant (Codex recommendation 2026-05-02 round-3)
`scripts/audit_isc_vs_quarters.py` now asserts `property_id:loc` uniqueness on every run. Currently: PASS (0 duplicate runtime keys across 1,410 records). Future title-export waves can't merge with renderer-key collisions undetected.

## Records of work
- Codex final review: `docs/logs/sk-titles/codex-final-review.md` (round-2)
- Codex post-merge audit: `docs/logs/sk-titles/codex-post-merge-audit.md` (round-3)
- Methodology log (tracked): `docs/logs/sk-titles-2026-01-18.md`
- Methodology playbook (memory): `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/sk_titles_methodology.md`

## Other branches in flight (not active)
- `feat/seeding-calibration` (commit `ee4755a`) — GEE seeding-calibration pipeline. The 12 mid-iteration UI files remain WIP. Beyond that, 2026-05-04 added the v1.1 Backlog (now 5 quick-win items) and the CCD vs intensity dvh Codex pressure-test resolution (Option D — confidence booster only, shadow-only spike first). 2026-05-06 added the Montana full rerun + Codex independent audit. 2026-05-07 added the PA + Raymore re-smoke (no new SAR scene yet over SK). The data + reference + decision-record files have been brought to main as of this commit; the WIP UI files stay on the branch. To resume: `git checkout feat/seeding-calibration` and follow `docs/logs/seeding-calibration.md`.

## Known blockers
None active.

## Next action
None pending. `feat/seeding-calibration` is the next workstream when user is ready.
