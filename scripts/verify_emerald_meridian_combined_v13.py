"""Verify V13 dimensions, print metadata, and GEE plate custody."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "out" / "raw_maps" / "authentic_satellite_plate_6480.png"
PNG = ROOT / "out" / "posters" / "the_emerald_meridian_combined_v13_36x24_200ppi.png"
PDF = ROOT / "out" / "posters" / "the_emerald_meridian_combined_v13_36x24.pdf"
REPORT = ROOT / "out" / "posters" / "the_emerald_meridian_combined_v13_verification.json"
PLATE_BOX = (360, 630, 6840, 4140)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    failures: list[str] = []
    source = np.asarray(Image.open(SOURCE).convert("RGB"))
    output = Image.open(PNG)
    poster = np.asarray(output.convert("RGB"))
    plate = poster[PLATE_BOX[1]:PLATE_BOX[3], PLATE_BOX[0]:PLATE_BOX[2]]

    # Only the declared 100°W two-pixel datum may differ from the cached GEE plate.
    meridian_x = round(((-100.0 + 125.0) / 61.0) * 6480)
    allowed = np.zeros(source.shape[:2], dtype=bool)
    allowed[:, max(0, meridian_x - 2):min(source.shape[1], meridian_x + 3)] = True
    diff = np.any(source != plate, axis=2)
    unauthorized = int(np.count_nonzero(diff & ~allowed))
    if unauthorized:
        failures.append(f"{unauthorized} GEE plate pixels changed outside the declared meridian overlay")

    dpi = tuple(round(float(v), 2) for v in output.info.get("dpi", (0, 0)))
    icc_bytes = len(output.info.get("icc_profile", b""))
    if output.size != (7200, 4800):
        failures.append(f"PNG size {output.size} is not 7200x4800")
    if not all(abs(v - 200) <= 0.1 for v in dpi):
        failures.append(f"PNG DPI {dpi} is not 200")
    if icc_bytes == 0:
        failures.append("PNG has no ICC profile")

    reader = PdfReader(str(PDF))
    page = reader.pages[0]
    page_points = (float(page.mediabox.width), float(page.mediabox.height))
    if len(reader.pages) != 1:
        failures.append(f"PDF has {len(reader.pages)} pages")
    if any(abs(a - b) > 0.1 for a, b in zip(page_points, (2592.0, 1728.0))):
        failures.append(f"PDF page is {page_points}, not 36x24 inches")

    report = {
        "status": "PASS" if not failures else "FAIL",
        "png": {"sha256": sha256(PNG), "dimensions": list(output.size), "dpi": list(dpi), "icc_bytes": icc_bytes},
        "pdf": {"sha256": sha256(PDF), "pages": len(reader.pages), "page_points": list(page_points)},
        "source_custody": {"source_sha256": sha256(SOURCE), "changed_pixels_total": int(np.count_nonzero(diff)), "unauthorized_changed_pixels": unauthorized},
        "failures": failures,
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if not failures else 1)


if __name__ == "__main__":
    main()
