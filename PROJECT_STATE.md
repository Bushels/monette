# PROJECT_STATE.md

## Last verified commit (this branch)
330a86a feat(sk-titles): Wave C complete — ponteix, vanguard, regina-south, hafford
(plus Wave E pending commit for __neville__'s 14 ADDs)

## Active task
**SK Titles Update from 2026-01-18 ISC snapshot.** WIP on branch `feat/sk-titles-2026-01-18`. 10 commits in. **Phase 2 (per-area reconciliation) complete** — every one of the 559 titled-to-MFL parcels accounted for; final audit shows `unmatched: 0`.

Plan doc (local): `docs/superpowers/specs/2026-05-01-sk-titles-update-plan.md`
Methodology log (tracked): `docs/logs/sk-titles-2026-01-18.md`
Methodology playbook (memory): `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/sk_titles_methodology.md`

Done so far:
- Phase 0: parser + audit + per-property diffs (577888c)
- Codex 5.5/xhigh worked example: Wymark + Swift Current (5380074)
- Audit script: reassign_out + title-rows-vs-features (60e8d49)
- apply_sk_titles_deltas.py + Wymark+SC applied (c571923)
- Wave A: prince-albert + raymore + regina-south reassign (b1b784a)
- Wave B: outlook + kamsack + calderbank+morse (8766c61)
- Wave C: ponteix + vanguard + regina-south + hafford (330a86a)
- Wave E: __neville__ town lots (pending commit)

Net effect on map: 176 new MFL-titled records added across 5 properties; 19 records reassigned across property boundaries; every record in the 14 SK property buckets + __neville__ now carries reconciliation metadata (KEEP/FLAG/ADD/REASSIGN with snapshot_date 2026-01-18).

156 records have geometry: null pending Phase 4 (LSD/town-lot/quarter polygon computation): regina-south 125 + kamsack 4 + calderbank 3 + neville 14 ADDs + 10 already-resolved ADDs.

## Remaining work
- Phase 3: Knowledge layer pass — neville anchor decision, data.js property-totals updates, hafford rented-back narrative copy
- Phase 4: Pipeline rebuild — compute polygons for the 156 ADDs, cache-bust index.html
- Phase 5: Codex final review (full-branch architectural pass) + Vercel preview + browser smoke test + merge to main

## Other branches in flight (not currently active)
- `feat/seeding-calibration` (commit `2632275`, 12 files mid-iteration) — GEE seeding-calibration pipeline.

## Known blockers
None active. Pre-existing layout bug in main's index.html (the `useTalliesVersion is not defined` ReferenceError + 2-column grid stale build) is independent of this branch and surfaces in the local preview when run from G:.

## Next action
Wave E commit + decide whether to proceed to Phase 3+4+5 or hand back for user review of the 10-commit branch and the methodology log.

## Other branches in flight (not currently active)
- `feat/seeding-calibration` (commit `2632275`, 12 files mid-iteration) — GEE seeding-calibration pipeline. To resume: `git checkout feat/seeding-calibration` and follow `docs/logs/seeding-calibration.md`.

## Known blockers
None active.

## Next action
Awaiting user sign-off to begin Wave A replication: Prince Albert (12 KEEP / 8 FLAG, simple) + Raymore (4 KEEP / 1 REASSIGN-out / 117 FLAG, heaviest FLAG taxonomy work). The applied Wymark + Swift Current pair should be browser-verified first.