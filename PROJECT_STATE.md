# PROJECT_STATE.md

## Last verified commit (this branch)
da15e92 feat(sk-titles): Phase 4 — polygon computation + cache-bust

## Active task
**SK Titles Update from 2026-01-18 ISC snapshot.** Branch `feat/sk-titles-2026-01-18`, 13 commits ahead of main. **Phases 0-4 complete.** Codex 5.5/xhigh final architectural review running in background.

Plan doc (local): `docs/superpowers/specs/2026-05-01-sk-titles-update-plan.md`
Methodology log (tracked): `docs/logs/sk-titles-2026-01-18.md`
Methodology playbook (memory): `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/sk_titles_methodology.md`
Codex final-review prompt: `docs/logs/sk-titles/codex-final-review-prompt.md`

Final state:
- 559/559 CSV parcels reconciled (unmatched: 0)
- All 14 SK properties carry mflTitleSnapshot block in data.js
- 156 polygons computed for ADDs (128 quarters, 21 LSDs, 10 town-lot placeholders, 2 leftover null planned-parcels)
- index.html cache-bust bumped: data.js v=36, quarters-data.js v=2

## Phase status
- Phase 0 ✅: parser + audit + per-property diffs (577888c)
- Phase 1 ✅: RM-to-property crosswalk
- Phase 2 ✅: Wave A-E per-area reconciliation across 12 properties + worked example (b1b784a, 8766c61, 330a86a, ac86232)
- Phase 3 ✅: __neville__ folded into vanguard, data.js totals reconciled, hafford narrative surfaced (9f1a2da)
- Phase 4 ✅: DLS polygons + cache-bust (da15e92)
- Phase 5 🟡: Codex review running; pending Vercel preview + merge

## Other branches in flight
- `feat/seeding-calibration` (commit `2632275`, 12 files mid-iteration) — GEE seeding-calibration pipeline (separate workstream)

## Known blockers
None on this branch. Pre-existing main-branch layout bug (`useTalliesVersion is not defined`) is independent and not blocking SK Titles merge.

## Next action
Wait for Codex final review to complete. If GREENLIGHT-FOR-MERGE: Vercel preview + browser smoke test + merge to main. If BLOCKER or NEEDS-FIXES: address Codex's findings, re-run audit, then retry merge.

## Other branches in flight (not currently active)
- `feat/seeding-calibration` (commit `2632275`, 12 files mid-iteration) — GEE seeding-calibration pipeline. To resume: `git checkout feat/seeding-calibration` and follow `docs/logs/seeding-calibration.md`.

## Known blockers
None active.

## Next action
Awaiting user sign-off to begin Wave A replication: Prince Albert (12 KEEP / 8 FLAG, simple) + Raymore (4 KEEP / 1 REASSIGN-out / 117 FLAG, heaviest FLAG taxonomy work). The applied Wymark + Swift Current pair should be browser-verified first.