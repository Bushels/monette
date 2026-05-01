# ISC vs quarters-data.js — Audit Summary

**Snapshot date:** 2026-01-18
**Generated:** 2026-05-01T21:54:36.585846Z

Title-row counts and unique-map-feature counts are NOT 1:1.
One legal location can have multiple CSV title rows (extension variants);
one current map feature is one polygon. KEEP/REASSIGN-in show both.

## Per-property reconciliation

| Property | CSV rows | Cur rows | ADD | KEEP rows / feats | REASSIGN-in rows / feats | REASSIGN-out feats | FLAG |
|---|---:|---:|---:|---:|---:|---:|---:|
| `__neville__` | 16 | 0 | 14 | 0 / 0 | 2 / 2 | 0 | 0 |
| `admiral` | 2 | 15 | 0 | 2 / 2 | 0 / 0 | 0 | 13 |
| `aguila` | 0 | 23 | 0 | 0 / 0 | 0 / 0 | 0 | 23 |
| `calderbank` | 141 | 110 | 3 | 138 / 110 | 0 / 0 | 0 | 0 |
| `eddystone` | 0 | 165 | 0 | 0 / 0 | 0 / 0 | 0 | 165 |
| `genoa` | 0 | 2 | 0 | 0 / 0 | 0 / 0 | 0 | 2 |
| `hafford` | 2 | 158 | 0 | 2 / 2 | 0 / 0 | 0 | 156 |
| `kamsack` | 40 | 77 | 4 | 36 / 35 | 0 / 0 | 0 | 42 |
| `montana` | 0 | 220 | 0 | 0 / 0 | 0 / 0 | 0 | 220 |
| `outlook` | 13 | 24 | 0 | 13 / 10 | 0 / 0 | 0 | 14 |
| `ponteix` | 85 | 130 | 0 | 85 / 85 | 0 / 0 | 0 | 45 |
| `prince-albert` | 12 | 20 | 0 | 12 / 12 | 0 / 0 | 0 | 8 |
| `raymore` | 4 | 121 | 0 | 4 / 4 | 0 / 0 | 0 | 117 |
| `regina-south` | 126 | 1 | 125 | 1 / 1 | 0 / 0 | 0 | 0 |
| `swift-current` | 31 | 30 | 0 | 31 / 30 | 0 / 0 | 0 | 0 |
| `vanguard` | 65 | 93 | 1 | 64 / 63 | 0 / 0 | 2 | 28 |
| `wymark` | 22 | 85 | 0 | 22 / 19 | 0 / 0 | 0 | 66 |

## Bucket meanings
- **ADD**: parcel is in CSV but not currently in the map for this property (not under any property by parcel_no/loc-rm) — net-new MFL-titled record for the property
- **KEEP**: parcel is in both CSV and current map under this property — confirmed MFL-titled, raise confidence
- **REASSIGN-in**: parcel is in CSV claiming this property, but currently filed under a *different* property — needs a property-id move (do not delete)
- **FLAG**: parcel is in current map under this property but not in CSV — could be (a) sold pre-2026-01-18, (b) leased/rented, (c) titled to a different Monette entity. Keep on map; flag for follow-up.

## Top decisions surfaced
- `__neville__`: 2 title rows arriving from other properties (2 unique features) — REASSIGN-in
- `__neville__`: 14 net-new ADD parcels — likely needs geometry computation
- `admiral`: 13 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `aguila`: 23 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `eddystone`: 165 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `hafford`: 156 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `kamsack`: 42 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `montana`: 220 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `outlook`: 14 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `ponteix`: 45 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `raymore`: 117 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `regina-south`: 125 net-new ADD parcels — likely needs geometry computation
- `vanguard`: 2 features moving out to another property — REASSIGN-out
- `vanguard`: 28 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
- `wymark`: 66 FLAG features — large unverified-by-CSV set; apply FLAG taxonomy in per-area pass
