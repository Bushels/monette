# PROJECT_STATE.md

## Last verified commit (this branch)
577888c feat(sk-titles): Phase 0 scaffolding — ISC parser + audit + per-property diffs

## Active task
**SK Titles Update from 2026-01-18 ISC snapshot.** WIP on branch `feat/sk-titles-2026-01-18`. Reconciling the parcel layer of the SK portion of the Monette Ledger atlas against a court-grade snapshot of land titled to MONETTE FARMS LTD. (559 surface parcels across 20 SK Rural Municipalities, current as of 2026-01-18).

Plan doc (local-only): `docs/superpowers/specs/2026-05-01-sk-titles-update-plan.md`
Methodology log (tracked): `docs/logs/sk-titles-2026-01-18.md`

Workflow:
- Phase 0 done: parser + audit + per-property diffs committed
- Codex 5.5/xhigh now working Wymark + Swift Current pair as worked example
- Claude will analyze Codex's methodology, then replicate the playbook for 12 remaining areas in 5 waves (high-confidence → combined → uncertain → new → town-lots)
- Final: Codex full-branch review + Vercel preview + merge

## Other branches in flight (not currently active)
- `feat/seeding-calibration` (commit `2632275`, 12 files mid-iteration) — GEE seeding-calibration pipeline. To resume: `git checkout feat/seeding-calibration` and follow `docs/logs/seeding-calibration.md`.

## Known blockers
None active. Codex `.codex/config.toml` was using TOML tables and rejected by the CLI — fixed in commit `577888c` with flat-key syntax. Per-call `xhigh` override on dispatches.

## Next action
Wait for Codex to return Wymark worked-example deliverables (`docs/logs/sk-titles/wymark/proposed-deltas.json`, `methodology.md`, two narratives, and an appended findings section in the methodology log). Then analyze, document the playbook, and replicate for Wave A (Prince Albert, Raymore — both have clean small CSV sets) before tackling Wave B/C.

Notable early signal from audit: most properties have very high FLAG counts (Raymore 118 of 122, Hafford 156 of 158, Wymark 82 of 101) — confirming most operational footprint is titled to non-MFL Monette entities. The FLAG taxonomy Codex builds will drive Phase 3 knowledge-layer work.