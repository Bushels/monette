# Codex Final Review — SK Titles Update Branch

**Audience:** Codex CLI (gpt-5.5, model_reasoning_effort=xhigh)
**Branch:** `feat/sk-titles-2026-01-18`
**Working dir:** `C:\Users\kyle\Agriculture\Monette\`

---

## Project context

This is the closing review of the **SK Titles Update** branch on the Monette
Ledger (`https://github.com/Bushels/monette` / `https://monette-ledger.vercel.app`).

The branch reconciles the SK portion of the parcel layer (`quarters-data.js`)
against an ISC-style title export listing all land titled to MONETTE FARMS
LTD. as of **2026-01-18** (mid-CCAA snapshot — 559 surface parcels across
20 SK Rural Municipalities).

You did the round-1 worked example for Wymark + Swift Current
(`docs/logs/sk-titles/wymark/methodology.md`). Claude (Opus 4.7) replicated
your methodology mechanically across the remaining 12 areas using
`scripts/build_deltas_from_audit.py` and `scripts/apply_sk_titles_deltas.py`.

This is your **final architectural pass before merge to main**. The user
explicitly asked for this Codex review at the end of the work.

## Scope of branch (13 commits since main)

```
da15e92 Phase 4 — polygon computation + cache-bust
9f1a2da Phase 3 knowledge-layer pass — 3 user decisions applied
ac86232 Wave E + Phase 2 close — __neville__ town lots applied
330a86a Wave C complete — ponteix, vanguard, regina-south, hafford
8766c61 Wave B complete — outlook, kamsack, calderbank+morse
b1b784a Wave A complete — apply prince-albert + raymore + 1 regina-south reassign
c12bd2c docs(state): mark first SK-titles area pair applied
c571923 apply Wymark + Swift Current deltas to quarters-data.js
60e8d49 audit script — reassign_out view + title-rows vs map-features
5380074 Codex round-1 worked example outputs (Wymark + Swift Current)
6dc1310 docs(state): mark SK Titles Update as active task on this branch
577888c Phase 0 scaffolding — ISC parser + audit + per-property diffs
```

## What you should focus on

### 1. Methodology drift
Your round-1 deliverable was `docs/logs/sk-titles/wymark/methodology.md`.
Claude's replication was supposed to follow that playbook. Read your own
methodology and compare to what Claude actually did:

- `scripts/build_deltas_from_audit.py` — Claude's mechanization of your pattern
- `scripts/apply_sk_titles_deltas.py` — the apply pipeline (you saw an
  earlier version in your round-1 work)
- The 12 generated deltas at `docs/logs/sk-titles/<property>/proposed-deltas.json`

Did Claude faithfully follow your decision tree (KEEP/FLAG/REASSIGN/ADD)?
Did the FLAG taxonomy stay consistent (RM-name-based subtypes; bespoke
subtypes only for Wymark's Carefoot/feedlot intel)? Were duplicate-titled
features properly collapsed (your "title rows ≠ map features" trap)?

### 2. Cross-property reassign symmetry

The reassign pattern moves records across property buckets. There are
3 cross-property reassigns in this branch:
- wymark → swift-current (16 features, your worked example)
- raymore → regina-south (1 feature, SW-31-25-19-W2 — RM Longlaketon parcel)
- vanguard → __neville__ → folded into vanguard (2 features that round-tripped)

Verify each parcel exists in exactly one property's array. No silent
drops, no double-counting. Apply script must produce idempotent results
(re-running deltas should not duplicate records).

### 3. Phase 3 knowledge-layer surgery

Claude wrote `scripts/_update_data_js_totals.py` to surgically update
data.js property records. The script uses regex on JS literal source.
There was a bug where the boundary regex was pid-specific, causing the
LAST property's edit to clobber all earlier insertions; Claude caught
this and fixed it with a generic next-property regex.

Verify all 12 affected SK properties now carry an `mflTitleSnapshot:{}`
block. Spot-check that:
- `parcels` field matches actual `quarters['<pid>']` length
- `mflTitledRecords + flaggedRecords` adds up to `totalRecords`
- The hafford `significance` field carries the Walter-Farms / rented-back
  prose
- The data.js still parses as JS (no quote escaping issues, no missing
  commas, no orphaned blocks)

### 4. Polygon computation correctness

Claude wrote `scripts/compute_sk_titles_polygons.py` for Phase 4.
Quarters use your existing `dls_quarter_polygon`. LSDs use new
`dls_lsd_polygon` — fractal at 1/4 resolution with the same snake
pattern. Town lots in Plan N3619 use placeholder cluster math (small
squares around Neville centroid).

Pressure-test the LSD math:
- LSD-1 should be SE corner of the section (1/4 mile × 1/4 mile)
- LSD-16 should be NE corner
- LSDs 1-4 run east→west along the south edge
- LSDs 13-16 run west→east along the north edge

Any errors in the snake pattern will misplace 21 LSD polygons by 1/4 mile
(catastrophic for verification but visually obvious if wrong).

The 2 leftover null-geometry records are intentional skips. The renderer
treats null geometry as "don't render" — confirm this is correct.

### 5. Static-source-of-truth audit script changes

You recommended audit improvements in your round-1 findings. Claude
implemented:
- `reassign_out` view alongside `reassign_in`
- Title-rows-vs-features distinction in summary

Verify `scripts/audit_isc_vs_quarters.py` correctly distinguishes
"current parcel claimed by another property's CSV" (REASSIGN-out) from
"current parcel not in any CSV" (FLAG). Re-run the audit and confirm
`unmatched: 0` plus the per-property numbers match Claude's commit
messages.

### 6. Risks to flag (from your round-1 findings)

These were unresolved when round-1 closed:
- Wymark Section 18-12-14-W3 feedlot quarters absent from MFL CSV.
  Claude landed those as FLAG with subtype `lac_pelletier_not_in_mfl_csv`,
  not the bespoke `feedlot_proposal_title_gap` you'd suggested. Drift?
- Carefoot/Waldeck remains knowledge-layer only. Claude didn't promote
  to a bespoke subtype. Was that the right call?
- Hafford has 134 records with `rm` stored as int (legacy data quality
  issue). Claude made `slug_rm()` defensive; results in `rm_no_436_*` etc.
  Does this affect the public-facing copy?

### 7. Anything you didn't see coming

The user explicitly trusts your Codex 5.5/xhigh adversarial review here.
Surface architectural surprises, regressions, or hidden bugs Claude may
have introduced via mechanization that you'd have caught manually.

## Constraints

- **Do not modify any source files** — produce a written review only.
- **Do not commit, push, or merge anything.**
- **Do not run the build pipeline.**
- **Stay on branch `feat/sk-titles-2026-01-18`** — verify with
  `git branch --show-current`.
- **Run on `model_reasoning_effort = xhigh`**.

## Deliverable

Write a single review file:

**`docs/logs/sk-titles/codex-final-review.md`**

Structure (mirror your round-1 methodology format):

```markdown
# Codex Final Review — SK Titles Update

## Verdict
GREENLIGHT-FOR-MERGE | BLOCKER | NEEDS-FIXES (one of three; with one-paragraph rationale)

## Methodology fidelity
(How well did Claude's replication follow your round-1 playbook? What drifted?)

## Cross-property reassign correctness
(Verify all 3 reassigns are clean.)

## Phase 3 surgery audit
(data.js mflTitleSnapshot blocks correct? data.js parses?)

## Polygon math correctness
(LSD math right? Quarter math unchanged from your round-1? Skipped records OK?)

## Audit script coherence
(Final unmatched=0 holds? Per-property numbers consistent?)

## Open risks for merge
(Anything that should block merge or flag for follow-up?)

## Recommendations for follow-up (post-merge)
(Things to do later, NOT blocking merge.)
```

Be honest. The user values an adversarial review here — surface anything
Claude got wrong, even small things. The user has been organized about
this work all along; better to catch issues now than after merge.
