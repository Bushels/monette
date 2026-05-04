# Codex-as-Architect Pressure Test — InSAR CCD vs Intensity ΔVH

**Date:** 2026-05-01
**Codex effort:** xhigh (override of project-pinned medium for design pressure-test)
**Status:** sent — awaiting Codex response
**Decision owner:** Kyle, with Codex design input

---

## Background

The Monette satellite seeding pipeline detects whether agricultural parcels have been seeded by analyzing Sentinel-1 SAR data. Current implementation computes a backscatter *intensity* delta:

```python
# scripts/gee_pipeline/pipeline.py:536
mean_dvh_db_value = 10 * math.log10(mean_t1_vh_val / mean_t0_vh_val)
```

Where:
- `mean_t1_vh_val` is the parcel-mean VH backscatter from a 14-day rolling median composite of recent S1 GRD_FLOAT scenes
- `mean_t0_vh_val` is the parcel-mean VH backscatter from a fixed-window T0 baseline (Feb 15 – Apr 15 for SK/MB, Feb 1 – Mar 15 for MT/CO), median-composited and exported as a GEE Asset
- The result is a per-parcel ΔVH in decibels; +1.5 dB → seeded=True, -1.5 dB → seeded=False, otherwise null (subject to confidence floor of 65)

This is intensity-based change detection. It measures *how much* radar power comes back from the parcel, comparing T1 to T0.

A 2026-05-04 literature review (Google Deep Research output, archived at `docs/Satellite Imagery for Seeding Detection.docx`, curated at `docs/references/satellite-imagery-seeding-detection-2026-05-04.md`) recommends a fundamentally different approach: **InSAR Coherent Change Detection (CCD)**.

CCD measures *phase* coherence between two consecutive SAR scenes — whether scattering elements within each pixel have moved at the millimeter scale (a fraction of the C-band 5.6 cm wavelength). The mechanism for seeding detection: a no-till drill's coulters and press wheels physically displace soil and residue at sub-centimeter scale, dropping interferometric coherence sharply even when the bulk surface roughness barely changes.

The doc cites Singh et al. 2025 (IEEE JSTARS, https://ieeexplore.ieee.org/document/11130190/) achieving RMSE 5.59 days on dual-orbit Sentinel-1 coherence over 3,000+ Ontario fields. The doc doesn't cite a comparable benchmark for intensity-based ΔVH on the same problem.

---

## Our specific operating context

| Constraint | Value |
|---|---|
| Total parcels in dataset | 1,260 |
| Active SAR-eligible parcels (current) | 533 |
| Properties (geographic clusters) | 14 across SK, MB, MT, CO, AZ |
| Use case | CCAA creditor monitoring — "is this parcel seeded as of date D, yes / no / withheld" |
| Decision granularity | Per-parcel boolean + confidence + reason, NOT seeding-date regression |
| Update cadence | Property-scoped reruns triggered by smoke validation; not real-time |
| Compute environment | Google Earth Engine via Python `ee` API |
| GEE assets in use | `COPERNICUS/S1_GRD_FLOAT`, `COPERNICUS/S2_SR_HARMONIZED`, `ECMWF/ERA5_LAND/DAILY_AGGR`, USDA/CDL/2025, AAFC/ACI/2024, custom T0 baseline assets |
| Auditability requirement | High — calls may need to be defended in court / creditor disputes |
| Ground truth | None yet (planned for v1.5 vote-label loop) |
| Active branch | `feat/seeding-calibration` at commit `2632275` |

Today (2026-05-01) we ran 3-parcel smokes on PA + Raymore. Results showed the intensity ΔVH method *is* detecting signal — borderline parcels move from confidence=54 to confidence=100 as snow gates clear, decisive negatives are stable, the per-parcel local-AOI snow gate fires correctly. We have a working v1 system. The question is whether CCD would meaningfully improve it for our specific use case.

---

## The decision space

| Option | Description |
|---|---|
| **A. Stay with intensity ΔVH** | Don't introduce CCD. Our current method works, RMSE 5.59 days is for date-of-seeding regression which is a different problem from our boolean classification. |
| **B. Layer CCD alongside intensity ΔVH** | Compute both. Use them as independent signals that must agree before calling seeded. Disagreement → null with diagnostic info. |
| **C. Switch to CCD as primary, retire intensity ΔVH** | Adopt the literature's recommended state-of-the-art. Risk: we lose the working v1 method while transitioning. |
| **D. CCD as confidence booster only** | Keep intensity ΔVH as the decision rule. Compute coherence as a quality signal that *upgrades* confidence when it agrees with the intensity call. |

---

## Specific design questions for Codex

Please respond to each question independently with your reasoning, evidence cited, and a clear position.

### Q1. Problem-method fit

For the *specific use case* of "is this parcel seeded as of date D" (boolean classification with optional withhold), is InSAR coherence actually a better signal than intensity ΔVH? The literature benchmark (RMSE 5.59 days) is for seeding-date *regression* across 3,000+ Ontario fields. Does that performance translate to per-parcel boolean classification at our scale (~533 active parcels)? What's the strongest counter-argument for staying with intensity ΔVH?

### Q2. GEE feasibility cost

Sentinel-1 SLC products (required for coherence) are available in GEE as `COPERNICUS/S1_GRD` only after preprocessing — true SLC interferometry requires either ESA's SNAP toolbox externally or the limited GEE-native coherence implementations. What's the realistic GEE-native path to compute parcel-level coherence at production scale (533+ parcels, weekly update cadence)? Are there hybrid approaches (precompute coherence asset externally, ingest into GEE) that are practical?

### Q3. Coherence's own gotchas

Our intensity ΔVH pipeline has known traps: rolling 14-day window slide, S1 orbit-coverage gaps for territories >3° latitude, ERA5 publication lag, snow/freeze contamination. What are the analogous traps for coherence-based detection? Specifically:
- Does coherence have the same per-pixel masking requirements (cropland, polygon quality) as intensity?
- Is coherence equally sensitive to snow/freeze contamination, or does it have different failure modes?
- What's the temporal baseline (days between scenes) sweet spot for spring seeding detection in C-band?
- Does coherence work on parcels at the edge of S1 swath coverage (where intensity also struggles)?

### Q4. Combination logic if we layer them (Option B/D)

If we compute both intensity ΔVH and coherence per parcel, what's the right combination logic?
- Logical AND (both must indicate seeded)?
- Logical OR (either indicates seeded)?
- Confidence-weighted (intensity is primary, coherence is a tiebreaker)?
- Disagreement-as-signal (intensity says seeded, coherence says no → null with reason)?

What does the literature suggest, and what's your design recommendation given our auditability requirement?

### Q5. Transition path if we adopt (Options B, C, or D)

If we decide to adopt CCD in some form, what's the safest transition path?
- Parallel implementation in a separate module (`coherence.py`) with no schema impact, allowing offline comparison runs?
- Add coherence as a new schema field that doesn't affect the decision rule until calibrated?
- Full migration with feature flag?
- Staged property-by-property rollout?

How do we avoid losing the working v1 method while adopting the new one?

### Q6. Effort estimate

For your recommended option, what's a realistic effort estimate (Codex-as-architect prep + Claude implementation + smoke validation cycles) to ship to production? We have a Bucket A/B/C/D milestone pattern from prior retrospectives — does this fit as a "Bucket E" or is it a smaller layered increment?

### Q7. What you'd need to verify before committing

Are there specific empirical tests we should run *before* committing to a path? Examples:
- Compare coherence vs intensity on the same parcels we've smoked today (PA NW-32-51-23-W2, Raymore SW-7-26-20-W2)
- Run the IEEE Singh et al. methodology on a small Saskatchewan subset and compare RMSE to our existing data
- Stress-test coherence on the snow/freeze-blocked properties (Hafford, Eddystone) to see if it has different failure modes than intensity

---

## Reference materials

- **Source literature review:** `docs/references/satellite-imagery-seeding-detection-2026-05-04.md` (curated) and `docs/Satellite Imagery for Seeding Detection.docx` (full original)
- **Current pipeline:**
  - `scripts/gee_pipeline/pipeline.py` (especially line 536 for the dvh formula)
  - `scripts/gee_pipeline/t0_baseline.py` (T0 construction)
  - `scripts/gee_pipeline/decision_rule.py` (tri-state classification)
  - `scripts/gee_pipeline/qc.py` (snow/freeze/precip predicates)
- **Methodology log:** `docs/logs/seeding-calibration.md`
- **Today's smoke results:**
  - `scripts/gee_pipeline/_pa_smoke_2026_05_01_results.json`
  - `scripts/gee_pipeline/_raymore_smoke_2026_05_01_results.json`
- **Prior Codex-as-architect precedents:**
  - `docs/superpowers/specs/2026-04-29-bucket-b-retrospective.md` (Codex `b5ajsddp7` — first architect role; established the pattern)
  - `docs/superpowers/specs/2026-04-28-bucket-a-cleanup-retrospective.md` (Codex review-only loop)
- **Key citations from doc:**
  - Singh et al. 2025 IEEE JSTARS: https://ieeexplore.ieee.org/document/11130190/
  - AAFC RCM + S1 harvest detection: https://www.tandfonline.com/doi/full/10.1080/01431161.2026.2612904
  - Mahdianpari RCM compact pol crops: https://www.tandfonline.com/doi/full/10.1080/07038992.2022.2121271

---

## Requested output format

For each Q1–Q7, provide:
1. **Position** — clear one-sentence recommendation
2. **Reasoning** — 2-4 paragraphs of supporting evidence and analysis
3. **Confidence** — high / medium / low, with what would move you to higher confidence

End with a **Final Recommendation** section that synthesizes your answers into one of the four options (A/B/C/D) plus a concrete first step. Use web search where needed to verify recent GEE capabilities, the Singh et al. paper specifics, or other technical claims. Cite sources for any specific performance numbers or implementation details.
