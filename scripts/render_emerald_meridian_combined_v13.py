"""Render the single-print Emerald Meridian V13 from the authentic GEE plate."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "out" / "raw_maps" / "authentic_satellite_plate_6480.png"
OUT = ROOT / "out" / "posters"

WIDTH, HEIGHT = 7200, 4800
DPI = 200
PAGE_W, PAGE_H = 36 * 72, 24 * 72
PLATE_X, PLATE_Y = 360, 630
PLATE_W, PLATE_H = 6480, 3510
BBOX = (-125.0, 24.5, -64.0, 57.5)

BG = (5, 7, 12)
INK = (242, 241, 231)
GOLD = (198, 166, 91)
EMERALD = (77, 190, 121)
MUTED = (137, 153, 169)
QUIET = (83, 101, 117)
RULE = (42, 55, 69)

FONTS = Path(r"C:\Windows\Fonts")
TITLE_FONT = FONTS / "georgiab.ttf"
SERIF_FONT = FONTS / "georgia.ttf"
META_FONT = FONTS / "CascadiaMono.ttf"
SRGB = Path(r"C:\Windows\System32\spool\drivers\color\sRGB Color Space Profile.icm")


def text_right(draw: ImageDraw.ImageDraw, right: int, y: int, text: str, font: ImageFont.FreeTypeFont, fill: tuple[int, int, int]) -> None:
    box = draw.textbbox((0, 0), text, font=font)
    draw.text((right - (box[2] - box[0]), y), text, font=font, fill=fill)


def draw_ramp(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    stops = [
        (216, 243, 229),
        (163, 240, 194),
        (78, 203, 130),
        (30, 176, 88),
        (15, 143, 67),
        (2, 107, 40),
    ]
    width = x1 - x0
    for i in range(width):
        pos = (i / max(1, width - 1)) * (len(stops) - 1)
        idx = min(int(pos), len(stops) - 2)
        frac = pos - idx
        a, b = stops[idx], stops[idx + 1]
        colour = tuple(round(a[c] + frac * (b[c] - a[c])) for c in range(3))
        draw.line((x0 + i, y0, x0 + i, y1), fill=colour, width=1)
    draw.rectangle(box, outline=GOLD, width=2)


def render() -> tuple[Path, Path, Path]:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    plate = Image.open(SOURCE).convert("RGB")
    if plate.size != (PLATE_W, PLATE_H):
        raise ValueError(f"Unexpected GEE plate size {plate.size}")

    poster = Image.new("RGB", (WIDTH, HEIGHT), BG)
    poster.paste(plate, (PLATE_X, PLATE_Y))
    draw = ImageDraw.Draw(poster)

    title = ImageFont.truetype(TITLE_FONT, 126)
    subject = ImageFont.truetype(SERIF_FONT, 38)
    small_caps = ImageFont.truetype(META_FONT, 24)
    meta = ImageFont.truetype(META_FONT, 20)
    micro = ImageFont.truetype(META_FONT, 17)

    # Header: left-aligned and readable at storefront distance.
    draw.text((360, 105), "THE", font=small_caps, fill=GOLD)
    draw.text((360, 145), "EMERALD MERIDIAN", font=title, fill=INK)
    draw.text((365, 305), "NORTH AMERICAN CROPLAND · PEAK SUMMER VIGOR", font=subject, fill=EMERALD)
    draw.text((365, 375), "ONE CONTINENT · ONE OBSERVED FIELD", font=small_caps, fill=MUTED)

    text_right(draw, 6840, 120, "COMBINED EXHIBITION EDITION / 2026", small_caps, GOLD)
    text_right(draw, 6840, 170, "OBSERVATION WINDOW / 01 JUL—15 AUG 2024", meta, MUTED)
    text_right(draw, 6840, 212, "CROPLAND MASK / ESA WORLDCOVER 2021", meta, MUTED)

    # Heirloom frame. The restrained double rule is the only ornamental system.
    outer = (320, 590, 6880, 4180)
    inner = (340, 610, 6860, 4160)
    draw.rectangle(outer, outline=GOLD, width=4)
    draw.rectangle(inner, outline=RULE, width=2)
    bracket = 62
    for x, y, dx, dy in ((320, 590, 1, 1), (6880, 590, -1, 1), (320, 4180, 1, -1), (6880, 4180, -1, -1)):
        draw.line((x, y, x + dx * bracket, y), fill=GOLD, width=5)
        draw.line((x, y, x, y + dy * bracket), fill=GOLD, width=5)

    # Exact equirectangular longitude placement for the conceptual datum.
    frac_100 = (-100.0 - BBOX[0]) / (BBOX[2] - BBOX[0])
    meridian_x = round(PLATE_X + frac_100 * PLATE_W)
    y = PLATE_Y
    while y < PLATE_Y + PLATE_H:
        draw.line((meridian_x, y, meridian_x, min(y + 16, PLATE_Y + PLATE_H)), fill=(56, 100, 80), width=2)
        y += 28
    draw.text((meridian_x + 16, 596), "100°W · EMERALD MERIDIAN", font=micro, fill=EMERALD)
    draw.text((meridian_x + 475, 596), "HISTORIC CONTINENTAL CLIMATE THRESHOLD", font=micro, fill=QUIET)

    # Archival footer: only describe variables the plate actually encodes.
    footer_y = 4260
    draw.text((360, footer_y), "OBSERVED PEAK VEGETATION INDEX", font=small_caps, fill=GOLD)
    draw_ramp(draw, (360, footer_y + 52, 2240, footer_y + 78))
    draw.text((360, footer_y + 94), "LOWER OBSERVED PEAK NDVI", font=micro, fill=MUTED)
    text_right(draw, 2240, footer_y + 94, "HIGHER OBSERVED PEAK NDVI", micro, MUTED)
    draw.text((360, footer_y + 146), "Colour is MODIS peak NDVI within mapped cropland—not crop type, yield, soil fertility or irrigation status.", font=micro, fill=QUIET)
    draw.text((360, footer_y + 180), "Permanent water and selected major rivers are rendered as obsidian negative space.", font=micro, fill=QUIET)

    source_x = 4060
    draw.text((source_x, footer_y), "SOURCE & CONSTRUCTION", font=small_caps, fill=GOLD)
    lines = (
        "NASA MODIS MOD13Q1 V061 · 250 m · peak NDVI, 01 Jul—15 Aug 2024",
        "ESA WorldCover v200 · 2021 cropland class · JRC Global Surface Water",
        "WWF HydroSHEDS free-flowing rivers · GMTED2010 relief · WGS84",
        "Equirectangular display · 7200 × 4800 master · recommended 36 × 24 in at 200 PPI",
    )
    for i, line in enumerate(lines):
        draw.text((source_x, footer_y + 52 + i * 36), line, font=micro, fill=MUTED if i < 3 else EMERALD)

    OUT.mkdir(parents=True, exist_ok=True)
    icc = SRGB.read_bytes()
    png = OUT / "the_emerald_meridian_combined_v13_36x24_200ppi.png"
    pdf = OUT / "the_emerald_meridian_combined_v13_36x24.pdf"
    proof = OUT / "the_emerald_meridian_combined_v13_proof.png"
    poster.save(png, format="PNG", dpi=(DPI, DPI), icc_profile=icc, compress_level=7)
    poster.resize((2400, 1600), Image.Resampling.LANCZOS).save(proof, format="PNG", icc_profile=icc, optimize=True)

    # Physical-size print PDF. The 200-PPI master remains intact inside one page.
    buffer = BytesIO()
    poster.save(buffer, format="PNG", icc_profile=icc, compress_level=7)
    buffer.seek(0)
    page = canvas.Canvas(str(pdf), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    page.drawImage(ImageReader(buffer), 0, 0, width=PAGE_W, height=PAGE_H, preserveAspectRatio=False)
    page.showPage()
    page.save()
    return png, pdf, proof


if __name__ == "__main__":
    for output in render():
        print(output)
