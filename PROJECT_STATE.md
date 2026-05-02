# PROJECT_STATE.md

## Last verified commit (this branch)
64d2e91 fix(sk-titles): address Codex final-review NEEDS-FIXES findings

## Active task
**SK Titles Update from 2026-01-18 ISC snapshot.** Branch `feat/sk-titles-2026-01-18`, 15 commits ahead of main. **Phases 0-5 effectively complete.** All Codex final-review findings addressed. Awaiting user Vercel preview verification + merge to main.

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
- Phase 5 ✅ (code): Codex final review delivered NEEDS-FIXES with 2 BLOCKERS + 2 SHOULD-FIXES; all addressed in commit 64d2e91
- Phase 5 🟡 (verify): pending user Vercel preview + browser smoke test + merge

## Final state
- 559/559 CSV parcels reconciled (unmatched: 0)
- 1,418 total records across 14 SK property buckets (down from 1,427 pre-dedup; -9 duplicate-loc records collapsed in Phase 5)
- All 14 SK properties carry mflTitleSnapshot block with accurate post-dedup totals
- swift-current + regina-south transitioned from `geometryStatus:"point-only"` to `geometryStatus:"polygons"` with 28 + 120 records mapped respectively
- 2 leftover null-geometry records (BLK-X-PLAN-N format) marked `planned_parcel_cadastral_pending` with note explaining SAMA cadastral data gap
- Cache-bust: data.js v=36, quarters-data.js v=2

Codex final review record: `docs/logs/sk-titles/codex-final-review.md`
Methodology playbook (memory): `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/sk_titles_methodology.md`

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