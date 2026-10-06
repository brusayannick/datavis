#!/usr/bin/env python3
"""
Pre-download Madrid + buffer aerial imagery (Esri World Imagery, EPSG:3857)
plus Noto Sans glyph ranges from OpenFreeMap, then store everything locally.

Runtime cost afterwards: zero network. Tiles live at
    public/data/basemap/ortho/{z}/{x}/{y}.jpg
Glyphs at
    public/data/glyphs/Noto Sans Regular/{range}.pbf

Zoom strategy (keeps the folder small but sharp where it matters):
    z11-z13: whole Madrid + ~15 km buffer
    z14:     Madrid municipality only

Attribution (shown in app):
    Imagery (c) Esri, Maxar, Earthstar Geographics
    Glyphs (c) Google/Noto (SIL OFL), via OpenFreeMap

Usage:
    .venv/bin/python scripts/download_ortho.py
"""

import json
import math
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data" / "basemap" / "ortho"
GLYPH_DIR = ROOT / "public" / "data" / "glyphs" / "Noto Sans Regular"

# south, west, north, east (buffer around Madrid)
BUFFER_BBOX = (40.24, -3.94, 40.60, -3.47)

TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

GLYPH_RANGES = ["0-255", "256-511", "512-767"]
GLYPH_URL = "https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/{r}.pbf"

UA = {"User-Agent": "BiciMAD-viz-coursework/1.0"}


def deg2tile(lat, lon, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return min(int(x), n - 1), min(int(y), n - 1)


def tile_range(bbox, z):
    s, w, n, e = bbox
    x0, y0 = deg2tile(n, w, z)   # NW corner: max lat, min lon
    x1, y1 = deg2tile(s, e, z)   # SE corner
    return range(min(x0, x1), max(x0, x1) + 1), range(min(y0, y1), max(y0, y1) + 1)


def fetch_tile(args):
    z, x, y = args
    path = OUT_DIR / str(z) / str(x) / f"{y}.jpg"
    if path.exists():
        return "skip"
    url = TILE_URL.format(z=z, x=x, y=y)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return "ok"
        except Exception:  # noqa: BLE001
            import time
            time.sleep(2 + attempt * 3)
    return "fail"


def madrid_bbox():
    """Bounding box of the Madrid municipality polygon from admin.geojson."""
    admin = json.loads(
        (ROOT / "public" / "data" / "basemap" / "admin.geojson").read_text()
    )
    for f in admin["features"]:
        if f["properties"].get("isMadrid"):
            coords = []
            geom = f["geometry"]
            polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
            for poly in polys:
                for ring in poly:
                    coords.extend(ring)
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            return min(lats), min(lons), max(lats), max(lons)
    raise RuntimeError("Madrid municipality not found in admin.geojson")


def main():
    print("Downloading aerial imagery (Esri World Imagery)...")
    jobs = []
    for z in (11, 12, 13):
        xs, ys = tile_range(BUFFER_BBOX, z)
        jobs += [(z, x, y) for x in xs for y in ys]
    z14_xs, z14_ys = tile_range(madrid_bbox(), 14)
    jobs += [(14, x, y) for x in z14_xs for y in z14_ys]
    # z15 for central Madrid only (sharp core for street-level reading)
    CENTER_BBOX = (40.36, -3.85, 40.52, -3.55)
    z15_xs, z15_ys = tile_range(CENTER_BBOX, 15)
    jobs += [(15, x, y) for x in z15_xs for y in z15_ys]
    print(f"  {len(jobs)} tiles planned")

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(fetch_tile, jobs))
    ok, skip, fail = (results.count(k) for k in ("ok", "skip", "fail"))
    print(f"  fetched {ok}, skipped {skip}, failed {fail}")
    if fail:
        raise SystemExit("Some tiles failed; rerun the script to retry them.")

    print("Downloading glyphs (OpenFreeMap Noto Sans Regular)...")
    GLYPH_DIR.mkdir(parents=True, exist_ok=True)
    for r in GLYPH_RANGES:
        dst = GLYPH_DIR / f"{r}.pbf"
        if dst.exists():
            print(f"  (skip {r}.pbf)")
            continue
        req = urllib.request.Request(GLYPH_URL.format(r=r), headers=UA)
        with urllib.request.urlopen(req, timeout=60) as resp:
            dst.write_bytes(resp.read())
        print(f"  -> {dst.name} ({dst.stat().st_size / 1e3:.0f} KB)")

    total_mb = sum(p.stat().st_size for p in OUT_DIR.rglob("*.jpg")) / 1e6
    print(f"Ortho store total: {total_mb:.1f} MB")
    print("Done.")


if __name__ == "__main__":
    main()
