# PROJECT_STATE.md

## Last verified commit (this branch)
c571923 feat(sk-titles): apply Wymark + Swift Current deltas to quarters-data.js

## Active task
**SK Titles Update from 2026-01-18 ISC snapshot.** WIP on branch `feat/sk-titles-2026-01-18`. 6 commits land Phase 0 + worked example + first applied area. Awaiting user sign-off to proceed with bulk replication for the remaining 12 SK areas.

Plan doc (local): `docs/superpowers/specs/2026-05-01-sk-titles-update-plan.md`
Methodology log (tracked): `docs/logs/sk-titles-2026-01-18.md`
Methodology playbook (memory): `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/sk_titles_methodology.md`

Done so far:
- Phase 0: parser + audit + per-property diffs (commit 577888c)
- Codex 5.5/xhigh worked example for Wymark + Swift Current (commit 5380074)
- Audit script improvements per Codex feedback — `reassign_out` view + title-rows-vs-features distinction (commit 60e8d49)
- Delta-application script `scripts/apply_sk_titles_deltas.py` + applied first area pair (commit c571923)

Effect on map: wymark 101 → 85 records (16 features moved to swift-current), swift-current 0 → 30 records (was point-only). Cache-bust deferred until Phase 4 pipeline rebuild lands LSD polygon computations.

Remaining: replicate methodology for 12 areas in 4 waves, then knowledge-layer pass + pipeline rebuild + Codex full-branch review + merge.

## Other branches in flight (not currently active)
- `feat/seeding-calibration` (commit `2632275`, 12 files mid-iteration) — GEE seeding-calibration pipeline. To resume: `git checkout feat/seeding-calibration` and follow `docs/logs/seeding-calibration.md`.

## Known blockers
None active.

## Next action
Awaiting user sign-off to begin Wave A replication: Prince Albert (12 KEEP / 8 FLAG, simple) + Raymore (4 KEEP / 1 REASSIGN-out / 117 FLAG, heaviest FLAG taxonomy work). The applied Wymark + Swift Current pair should be browser-verified first.