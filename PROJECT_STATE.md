# PROJECT_STATE.md

## Last verified commit
b6f8d5e docs(retro): append GREEN pre-deploy verdict from Claude parallel review

## Active task
GEE seeding-calibration pipeline — per-property smoke-test then full-run cadence with `--merge-existing` to avoid wiping `imagery-data.js`. Working files:
- scripts/gee_pipeline/decision_rule.py
- scripts/gee_pipeline/pipeline.py
- scripts/gee_pipeline/qc.py
- imagery-data.js, components.jsx, property-drawer.jsx, quarter-panel.jsx, view-map.jsx, styles.css
- docs/logs/seeding-calibration.md (methodology log, now tracked)

## Known blockers
None active. Snow/freeze QC gate is in place after the Raymore false-positive episode (earlier runs showed ~639 likely-seeded acres that collapsed to 0 once the gate was added). Watch for similar QC gaps when adding new properties.

## Next action
Continue the audit-geometry -> 3-quarter smoke-test -> full-property-run loop per the operating pattern in `docs/logs/seeding-calibration.md`. Rebuild and verify served `public/imagery-data.js` after each full run.