# `docs/superpowers/specs/` — index

Navigable index of design specs, plans, and session retrospectives for the Monette Ledger satellite seeding project. Updated 2026-04-29.

For project-level cross-session memory and standing workflow practices, see `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/MEMORY.md`.

---

## Canonical living docs

| Doc | Purpose |
|---|---|
| [`SATELLITE_SEEDING_PROJECT_STATUS.md`](SATELLITE_SEEDING_PROJECT_STATUS.md) | **Start here.** Living status of the project — current state, completed buckets, pending work, Codex review history, paste-able next-session kickoffs. |
| [`2026-04-28-monette-satellite-seeding-design.md`](2026-04-28-monette-satellite-seeding-design.md) | Design contract (rev 4). The producer-side architecture spec for the SAR + cropland-mask pipeline. Codex-audited; back-patched with implementation divergence notes. |
| [`2026-04-28-phenology-priors.md`](2026-04-28-phenology-priors.md) | Per-territory phenology calibration table (Gemini-produced). Used by `pipeline.py` applicability decisions. |

## Active project briefs

| Brief | Status |
|---|---|
| [`2026-04-29-homepage-redesign-plan.md`](2026-04-29-homepage-redesign-plan.md) | **In flight.** Codex pressure-test (`bvqyinxv4`) integrated; Session 2 (homepage shell + map mode reduction + Stewart Valley deletion) and Session 3 (Agnonymous Supabase live feed integration) paste-able. |

## Session retrospectives (reverse chronological)

Required reading for context when picking up the project after time away.

| Date | Topic | Codex review IDs |
|---|---|---|
| [`2026-04-29-satellite-pivot-retrospective.md`](2026-04-29-satellite-pivot-retrospective.md) | Community voting feature removed entirely; Atlas became satellite-driven main page; Farm Progress page killed; SQL migration applied | `b05w54lpy` (architect), `bwgf1888o` (review) |
| [`2026-04-29-bucket-b-retrospective.md`](2026-04-29-bucket-b-retrospective.md) | Schema completeness — `dvv_db`, `optical`, `baseline_quality`, `baseline_window`, precip-coupled confidence. Codex-as-architect debut workflow. | `b5ajsddp7` (architect), `bl5l9zfxa` (round-1), `beyzs2ym9` (final) |
| [`2026-04-28-bucket-a-cleanup-retrospective.md`](2026-04-28-bucket-a-cleanup-retrospective.md) | 3-round Codex review loop for math correctness fixes (ratio-of-means, snow QC, CDL semantics, common valid-pixel mask, Phase 5 fail-closed) | `b53izop76`, `b08awunq3`, `bd5gaxmye` |
| [`2026-04-28-session-retrospective.md`](2026-04-28-session-retrospective.md) | Phase 0–5 v1 producer ship + initial Codex post-shipping review | `b53izop76` (initial post-shipping audit) |

## Plans (in `docs/superpowers/plans/`)

| Plan | Status |
|---|---|
| [`2026-04-22-quarters-geojson-wiring.md`](../plans/2026-04-22-quarters-geojson-wiring.md) | Parcel pipeline foundation — how `quarters.geojson` is built from per-property XLSX. Reference; not actively executed. |
| [`2026-04-28-monette-satellite-seeding-foundation.md`](../plans/2026-04-28-monette-satellite-seeding-foundation.md) | Phase 0–3 implementation plan with divergence notes. Phases shipped; reference for how decisions were made. |
| [`2026-04-25-homepage-voting-board.md`](../plans/2026-04-25-homepage-voting-board.md) | 🗄️ **HISTORICAL** — voting feature was removed in the satellite pivot. Do not execute. |

## Historical (preserved for context, do not act on)

| Doc | Why kept |
|---|---|
| [`2026-04-25-homepage-voting-board-design.md`](2026-04-25-homepage-voting-board-design.md) | Voting design from before the satellite pivot. Removed feature; preserved for historical context. |

---

## Reading order for a fresh session

1. `SATELLITE_SEEDING_PROJECT_STATUS.md` — get the current state
2. `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/MEMORY.md` — auto-loads anyway, but skim for the standing practices section
3. The most recent retrospective for context on what just shipped
4. The active brief for the work you're picking up

For pure code reference: `2026-04-28-monette-satellite-seeding-design.md` (rev 4) is the producer-side contract — section 5 has the output schema, section 6 has the UI integration spec.
