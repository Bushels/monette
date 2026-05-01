# PROJECT_STATE.md

## Last verified commit (main)
c6725d4 docs(state,journal): add PROJECT_STATE.md + 2026-05 portfolio-cleanup journal entry

## Active task
GEE seeding-calibration pipeline — per-property smoke-test then full-run cadence with `--merge-existing` to avoid wiping `imagery-data.js`. **WIP lives on branch `feat/seeding-calibration`** (commit `2632275`, 12 files mid-iteration). To resume: `git checkout feat/seeding-calibration`.

Branch contents (will be split into atomic commits before merge):
- GEE pipeline: scripts/gee_pipeline/decision_rule.py, pipeline.py, qc.py + tests/gee_pipeline/test_decision_rule.py, test_qc.py
- Build: scripts/build_imagery_data_js.py
- UI: components.jsx, imagery-data.js, property-drawer.jsx, quarter-panel.jsx, view-map.jsx, styles.css
- Methodology log (already on main): docs/logs/seeding-calibration.md

## Known blockers
None active. Snow/freeze QC gate is in place after the Raymore false-positive episode (earlier runs showed ~639 likely-seeded acres that collapsed to 0 once the gate was added). Watch for similar QC gaps when adding new properties.

## Next action
Switch to `feat/seeding-calibration` and continue the audit-geometry -> 3-quarter smoke-test -> full-property-run loop per the operating pattern in `docs/logs/seeding-calibration.md`. Rebuild and verify served `public/imagery-data.js` after each full run.