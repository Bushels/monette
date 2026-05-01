# ISC vs quarters-data.js — Audit Summary

**Snapshot date:** 2026-01-18
**Generated:** 2026-05-01T19:19:28.989926Z

## Per-property reconciliation

| Property | CSV parcels | Current parcels | ADD | KEEP | REASSIGN-in | FLAG |
|---|---:|---:|---:|---:|---:|---:|
| `__neville__` | 16 | 0 | 14 | 0 | 2 | 0 |
| `admiral` | 2 | 15 | 0 | 2 | 0 | 13 |
| `aguila` | 0 | 23 | 0 | 0 | 0 | 23 |
| `calderbank` | 141 | 110 | 3 | 138 | 0 | 0 |
| `eddystone` | 0 | 165 | 0 | 0 | 0 | 165 |
| `genoa` | 0 | 2 | 0 | 0 | 0 | 2 |
| `hafford` | 2 | 158 | 0 | 2 | 0 | 156 |
| `kamsack` | 40 | 77 | 4 | 36 | 0 | 42 |
| `montana` | 0 | 220 | 0 | 0 | 0 | 220 |
| `outlook` | 13 | 24 | 0 | 13 | 0 | 14 |
| `ponteix` | 85 | 130 | 0 | 85 | 0 | 45 |
| `prince-albert` | 12 | 20 | 0 | 12 | 0 | 8 |
| `raymore` | 4 | 122 | 0 | 4 | 0 | 118 |
| `regina-south` | 126 | 0 | 125 | 0 | 1 | 0 |
| `swift-current` | 31 | 0 | 14 | 0 | 17 | 0 |
| `vanguard` | 65 | 93 | 1 | 64 | 0 | 30 |
| `wymark` | 22 | 101 | 0 | 22 | 0 | 82 |

## Bucket meanings
- **ADD**: parcel is in CSV but not currently in the map for this property (not under any property by parcel_no/loc-rm) — net-new MFL-titled record for the property
- **KEEP**: parcel is in both CSV and current map under this property — confirmed MFL-titled, raise confidence
- **REASSIGN-in**: parcel is in CSV claiming this property, but currently filed under a *different* property — needs a property-id move (do not delete)
- **FLAG**: parcel is in current map under this property but not in CSV — could be (a) sold pre-2026-01-18, (b) leased/rented, (c) titled to a different Monette entity. Keep on map; flag for follow-up.

## Top decisions surfaced
- `__neville__`: 2 parcels arriving from other properties (REASSIGN)
- `__neville__`: 14 net-new ADD parcels — likely needs geometry computation
- `admiral`: 13 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `aguila`: 23 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `eddystone`: 165 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `hafford`: 156 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `kamsack`: 42 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `montana`: 220 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `outlook`: 14 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `ponteix`: 45 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `raymore`: 118 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `regina-south`: 1 parcels arriving from other properties (REASSIGN)
- `regina-south`: 125 net-new ADD parcels — likely needs geometry computation
- `swift-current`: 17 parcels arriving from other properties (REASSIGN)
- `swift-current`: 14 net-new ADD parcels — likely needs geometry computation
- `vanguard`: 30 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
- `wymark`: 82 FLAG parcels — large unverified-by-CSV set; investigate post-Codex
