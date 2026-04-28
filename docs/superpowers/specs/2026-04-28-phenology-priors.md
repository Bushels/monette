# Sentinel-1 Phenology Calibration Table

Based on radar scattering principles and empirical data from AAFC, SMAPVEX campaigns, and USDA ARS research, here is the calibration table for your Sentinel-1 SAR change-detection seeding-event classifier, broken down by territory.

---

### 1. Saskatchewan (Vanguard, Ponteix, Admiral, Hafford, Kamsack, Outlook, Prince Albert, Raymore, Wymark, Calderbank)
* **Typical Planting Window:** Early May to early June (peak mid-May).
* **Typical T0 Residue:** Wheat stubble or canola stalks (predominantly no-till or minimum-till). 
* **Expected T0 VH Backscatter:** -20 to -24 dB (Davidson et al., 2006; SMAPVEX16-SK). Bare/harvested soil cross-pol is extremely low due to a lack of volume scattering.
* **Expected ΔVH Magnitude (Seeding/Tillage):** +3 to +5 dB. Tillage-induced roughness (RMS height ~2.5 cm) significantly increases backscatter (Davidson et al., 2000). 
* **Expected ΔVV Magnitude:** +3 to +5 dB. VV is highly sensitive to the initial surface disturbance before crop emergence attenuates the signal.
* **Adjustments to Spec (+1.5 dB default):** **Stricter (`≥ +2.0 dB`)**. The default +1.5 dB threshold is too sensitive in this region. Early spring rains and snowmelt drastically alter the soil's dielectric constant, causing moisture-driven backscatter spikes that mimic tillage. *Recommendation: Pair a +2.0 dB VH increase with a requirement for InSAR Coherence to drop below 0.20 (McNairn & Robertson et al., 2023) to achieve ~85% detection accuracy.*
* **Confounders:** Spring snowmelt, prairie potholes (sloughs), and early moisture spikes.
* **Scene Availability Advice:** Combining Ascending and Descending orbits is mandatory to achieve a 4-to-5 day revisit time during the critical late-April to early-June window. 

### 2. Manitoba (Eddystone)
* **Typical Planting Window:** Mid-May to early June.
* **Typical T0 Residue:** Grassland, perennial forage, and mixed grain stubble.
* **Expected T0 VH Backscatter:** -20 to -25 dB for dormant forage/grassland (SMAPVEX12/16).
* **Expected ΔVH Magnitude (Seeding/Tillage):** +1.5 to +2.5 dB. Seeding into perennial forage or pasture utilizing no-till causes less soil disturbance than the deep tillage seen in row crops.
* **Expected ΔVV Magnitude:** +1.5 to +3.0 dB.
* **Adjustments to Spec (+1.5 dB default):** **Slightly Looser (`≥ +1.0 to +1.5 dB`)**. Because Eddystone is heavily weighted toward forage and mixed grains, soil disturbance is lower. Use the VH/VV ratio to confirm vegetative emergence, which suppresses soil moisture noise.
* **Confounders:** Proximity to Lake Manitoba means high soil moisture and localized flooding. Saturated soils will mask surface roughness changes, as the high dielectric constant dominates the SAR signal.
* **Scene Availability Advice:** May is historically cloudy in Manitoba, making Sentinel-1 your primary workhorse. Look for sharp upward trends in the VH/VV cross-ratio to signify emergence when moisture noise is high.

### 3. Montana (Big Horn County)
* **Typical Planting Window:** April (sugar beets) to May (spring wheat). Winter wheat is planted in autumn and greens up in spring.
* **Typical T0 Residue:** Extremely smooth bare soil (beets) or dry wheat stubble.
* **Expected T0 VH Backscatter:** -18 to -22 dB.
* **Expected ΔVH Magnitude (Seeding/Tillage):** > +3.0 dB for beets (heavy tillage); +1.5 to +2.0 dB for wheat (no-till).
* **Expected ΔVV Magnitude:** Highly variable, largely driven by irrigation events.
* **Adjustments to Spec (+1.5 dB default):** **Keep Default, but apply crop-specific masking.** Sugar beet preparation causes a massive structural change (ΔVH), but winter wheat simply exhibits a steady volume-scattering increase as it breaks dormancy. A blanket threshold will fail without a crop-type mask. 
* **Confounders:** Big Horn River flooding and scheduled irrigation events create sudden backscatter spikes (+2 to +4 dB in VV) completely independent of a tractor entering the field.
* **Scene Availability Advice:** Cloud cover is lower here than in Canada. Rely heavily on optical Sentinel-2 data (NDVI green-up) fused with S1 roughness data to disambiguate irrigation moisture from true seeding.

### 4. Arizona (Maricopa Co - Aguila)
* **Typical Planting Window:** March to April (cotton); alfalfa varies.
* **Typical T0 Residue:** Extremely dry bare soil or sparse alfalfa stubble.
* **Expected T0 VH Backscatter:** < -25 dB. The bone-dry desert soil possesses an extremely low dielectric constant (USDA ARS, Walnut Gulch/Maricopa studies).
* **Expected ΔVH Magnitude (Seeding/Tillage):** +5 to +10 dB.
* **Expected ΔVV Magnitude:** +2.0 to +4.0 dB, strictly driven by the massive influx of irrigation water.
* **Adjustments to Spec (+1.5 dB default):** **Much Stricter (`≥ +3.0 dB`)**. The combination of pre-planting tillage and the initial irrigation pulse creates a massive, unmistakable radar signature. A +1.5 dB threshold is too sensitive and will trigger on minor wind-blown roughness or morning dew.
* **Confounders:** Flood vs. subsurface drip irrigation. Flood irrigation briefly creates a mirror-like surface of standing water, causing *specular reflection* (a sudden, massive drop in VV and VH backscatter) before sharply rebounding as the water infiltrates the soil.
* **Scene Availability Advice:** Cloud cover is practically zero during planting. S1 is more useful here for tracking irrigation frequency (estimating $K_c$ and $ET_c$) than purely for phenology. 

### 5. Colorado (Lincoln Co - Genoa)
* **Typical Planting Window:** April to May (spring crops). Winter wheat planted in September.
* **Typical T0 Residue:** Very dry, sparse wheat/corn stubble.
* **Expected T0 VH Backscatter:** -20 to -25 dB.
* **Expected ΔVH Magnitude (Seeding/Tillage):** +1.0 to +2.0 dB. 
* **Expected ΔVV Magnitude:** +1.0 to +2.0 dB.
* **Adjustments to Spec (+1.5 dB default):** **Looser (`≥ +1.0 dB`)**. High-plains dryland agriculture relies heavily on minimal-disturbance no-till drills. Because the soil is exceptionally dry, the dielectric constant does not jump; therefore, the subtle radar changes are entirely reliant on minor geometric roughness changes.
* **Confounders:** High winds. Severe wind erosion can alter surface roughness enough to mimic a tillage event in the radar signature. Furthermore, the low soil moisture dampens the overall radar return.
* **Scene Availability Advice:** Very good optical availability. Rely on S1 ascending/descending pairs to mathematically isolate the subtle geometric changes caused by the no-till drills.
