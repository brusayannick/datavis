#!/usr/bin/env python3
"""
Download a one-time offline basemap of Madrid + ~15 km buffer.

Sources (no API key required):
  - OpenStreetMap via the Overpass API (data (c) OpenStreetMap contributors, ODbL)

Outputs (committed, served locally at runtime — zero network requests in app):
  public/data/basemap/admin.geojson   municipality polygons (Madrid + neighbors)
  public/data/basemap/water.geojson   rivers / canals / reservoirs
  public/data/basemap/green.geojson   parks, gardens, forests
  public/data/basemap/roads.geojson   motorway..secondary + rail
  public/data/basemap/labels.json     city/town/major district label points

Usage:
    .venv/bin/python scripts/download_basemap.py
"""

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data" / "basemap"

# Madrid center + ~15 km buffer (deg)
BBOX = (40.24, -3.94, 40.60, -3.47)  # south, west, north, east
CENTER = (40.4168, -3.7038)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]

# Major Madrid districts to keep as suburb labels (rest of the bbox: city/town only)
MADRID_DISTRICTS = {
    "Centro", "Salamanca", "Chamberí", "Chamartín", "Retiro",
    "Arganzuela", "Latina", "Carabanchel", "Usera", "Villaverde",
    "Puente de Vallecas", "Villa de Vallecas", "Hortaleza",
    "Fuencarral-El Pardo", "Moncloa - Aravaca", "Tetuán",
    "Ciudad Lineal", "San Blas-Canillejas", "Vicálvaro", "Moratalaz",
    "Barajas",
}


def run_query(ql: str) -> dict:
    data = urllib.parse.urlencode({"data": ql}).encode()
    last_err = None
    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    endpoint, data=data,
                    headers={"User-Agent": "BiciMAD-viz-coursework/1.0"},
                )
                with urllib.request.urlopen(req, timeout=300) as resp:
                    return json.load(resp)
            except Exception as err:  # noqa: BLE001
                last_err = err
                print(f"  retry ({endpoint}): {err}")
                time.sleep(5)
    raise RuntimeError(f"Overpass query failed: {last_err}")


def r5(x: float) -> float:
    return round(x, 5)


def way_coords(el) -> list:
    return [[r5(p["lon"]), r5(p["lat"])] for p in el.get("geometry", [])]


def extent(coords) -> tuple:
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (max(lons) - min(lons), max(lats) - min(lats))


def big_enough(coords, min_span=0.002) -> bool:
    dx, dy = extent(coords)
    return dx >= min_span or dy >= min_span


def fc(features) -> dict:
    return {"type": "FeatureCollection", "features": features}


def line(el, props) -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": way_coords(el)},
        "properties": props,
    }


def poly(el, props) -> dict:
    coords = way_coords(el)
    if not coords:
        return None
    if coords[0] != coords[-1]:
        coords = coords + [coords[0]]
    return {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [coords]},
        "properties": props,
    }


def save(name: str, obj) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"  -> {path.name} ({path.stat().st_size / 1e6:.2f} MB)")


def bbox_str() -> str:
    s, w, n, e = BBOX
    return f"{s},{w},{n},{e}"


def main():
    b = bbox_str()
    print("Downloading offline basemap for Madrid + buffer...")

    def needed(name: str) -> bool:
        if (OUT_DIR / name).exists():
            print(f"  (skip {name}: already downloaded)")
            return False
        return True

    # --- 1. Municipal admin boundaries (admin_level=8) ---
    if needed("admin.geojson"):
        print("[1/5] admin boundaries")
        res = run_query(
            f'[out:json][timeout:300];rel["boundary"="administrative"]["admin_level"="8"]({b});out geom;'
        )
        features = []
        for el in res["elements"]:
            tags = el.get("tags", {})
            name = tags.get("name", "")
            rings = []
            for m in el.get("members", []):
                if m.get("type") != "way":
                    continue
                role = m.get("role", "outer")
                coords = [[r5(p["lon"]), r5(p["lat"])] for p in m.get("geometry", [])]
                if len(coords) < 3:
                    continue
                rings.append((role, coords))
            # Assemble outer rings into (Multi)Polygons; skip inner (holes) for simplicity
            polys = []
            outer = [c for role, c in rings if role != "inner"]
            for coords in outer:
                if coords[0] != coords[-1]:
                    coords = coords + [coords[0]]
                polys.append([coords])
            if not polys:
                continue
            geom = ({"type": "Polygon", "coordinates": polys[0]} if len(polys) == 1
                    else {"type": "MultiPolygon", "coordinates": polys})
            features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "name": name,
                    "isMadrid": name.startswith("Madrid"),
                },
            })
        features.sort(key=lambda f: not f["properties"]["isMadrid"])
        save("admin.geojson", fc(features))
        print(f"  {len(features)} municipalities")
        time.sleep(3)

    # --- 2. Water ---
    if needed("water.geojson"):
        print("[2/5] water")
        features = []
        # 2a. River/canal lines (light query)
        res = run_query(
            f'[out:json][timeout:300];way["waterway"~"^(river|canal)$"]({b});out geom;'
        )
        for el in res["elements"]:
            tags = el.get("tags", {})
            coords = way_coords(el)
            if len(coords) < 2 or not big_enough(coords):
                continue
            features.append(line(el, {"kind": tags["waterway"], "name": tags.get("name", "")}))
        print(f"  {len(features)} river/canal lines")
        time.sleep(3)
        # 2b. Water areas (ways; relations are heavy — tolerate failure)
        try:
            res = run_query(
                f'[out:json][timeout:180];way["natural"="water"]({b});out geom;'
            )
            for el in res["elements"]:
                tags = el.get("tags", {})
                coords = way_coords(el)
                if len(coords) < 3 or not big_enough(coords):
                    continue
                p = poly(el, {"kind": "water", "name": tags.get("name", "")})
                if p:
                    features.append(p)
        except RuntimeError as err:
            print(f"  water areas skipped: {err}")
        save("water.geojson", fc(features))
        print(f"  {len(features)} water features total")
        time.sleep(3)

    # --- 3. Green ---
    if needed("green.geojson"):
        print("[3/5] green areas")
        features = []
        for selector in (
            f'way["leisure"~"^(park|garden)$"]({b})',
            f'way["landuse"~"^(forest|grass|meadow|recreation_ground)$"]({b})',
        ):
            res = run_query(f"[out:json][timeout:300];{selector};out geom;")
            for el in res["elements"]:
                tags = el.get("tags", {})
                kind = tags.get("leisure") or tags.get("landuse")
                coords = way_coords(el)
                if len(coords) < 3 or not big_enough(coords, 0.004):
                    continue
                p = poly(el, {"kind": kind, "name": tags.get("name", "")})
                if p:
                    features.append(p)
            time.sleep(3)
        save("green.geojson", fc(features))
        print(f"  {len(features)} green areas")
        time.sleep(3)

    # --- 4. Roads + rail ---
    if needed("roads.geojson"):
        print("[4/5] roads & rail")
        features = []
        for selector in (
            f'way["highway"~"^(motorway|trunk|primary|secondary)$"]({b})',
            f'way["railway"="rail"]({b})',
        ):
            res = run_query(f"[out:json][timeout:300];{selector};out geom;")
            for el in res["elements"]:
                tags = el.get("tags", {})
                cls = tags.get("highway") or "rail"
                if "tunnel" in tags:
                    continue
                coords = way_coords(el)
                if len(coords) < 2:
                    continue
                features.append(line(el, {"class": cls, "name": tags.get("name", "")}))
            print(f"  {len(features)} segments so far")
            time.sleep(3)
        save("roads.geojson", fc(features))
        time.sleep(3)

    # --- 5. Labels ---
    if needed("labels.json"):
        print("[5/5] labels")
        res = run_query(
            f'[out:json][timeout:180];node["place"~"^(city|town|suburb)$"]["name"]({b});out;'
        )
        labels = []
        for el in res["elements"]:
            tags = el.get("tags", {})
            place = tags.get("place")
            name = tags.get("name", "")
            if place == "suburb" and name not in MADRID_DISTRICTS:
                continue
            labels.append({
                "name": name,
                "lat": r5(el["lat"]),
                "lon": r5(el["lon"]),
                "kind": place,
            })
        # Drop duplicate names keeping the first
        seen, uniq = set(), []
        for lb in labels:
            if lb["name"] in seen:
                continue
            seen.add(lb["name"])
            uniq.append(lb)
        save("labels.json", uniq)
        print(f"  {len(uniq)} labels")

    # --- 6. Local streets (tertiary network everywhere, residential in Madrid) ---
    def bbox_join(bb):
        return ",".join(str(v) for v in bb)

    def madrid_bbox():
        admin = json.loads((OUT_DIR / "admin.geojson").read_text())
        for f in admin["features"]:
            if f["properties"].get("isMadrid"):
                coords = []
                geom = f["geometry"]
                polys = geom["coordinates"] if geom["type"] == "MultiPolygon" \
                    else [geom["coordinates"]]
                for poly in polys:
                    for ring in poly:
                        coords.extend(ring)
                lons = [c[0] for c in coords]
                lats = [c[1] for c in coords]
                return (min(lats), min(lons), max(lats), max(lons))
        raise RuntimeError("Madrid municipality not found")

    def fetch_ways(label, selector, bbox, features, min_points=2):
        b = bbox_join(bbox)
        res = run_query(
            f"[out:json][timeout:300];{selector.replace('BBOX', b)};out geom;"
        )
        added = 0
        for el in res["elements"]:
            tags = el.get("tags", {})
            cls = tags.get("highway")
            if not cls or "tunnel" in tags:
                continue
            coords = way_coords(el)
            if len(coords) < min_points:
                continue
            features.append(line(el, {"class": cls, "name": tags.get("name", "")}))
            added += 1
        print(f"  {label}: {added} ways")

    if needed("streets.geojson"):
        print("[6/6] local streets")
        mbb = madrid_bbox()
        features = []
        # Tertiary + unclassified across the whole buffer
        fetch_ways(
            "tertiary/unclassified (buffer)",
            'way["highway"~"^(tertiary|unclassified)$"](BBOX)',
            BBOX, features,
        )
        time.sleep(3)
        # Residential core inside Madrid city, split into 4 quadrants
        s, w, n, e = mbb
        mid_lat, mid_lon = (s + n) / 2, (w + e) / 2
        quads = [
            (s, w, mid_lat, mid_lon), (s, mid_lon, mid_lat, e),
            (mid_lat, w, n, mid_lon), (mid_lat, mid_lon, n, e),
        ]
        for i, q in enumerate(quads):
            fetch_ways(
                f"residential quad{i + 1}",
                'way["highway"~"^(residential|living_street)$"](BBOX)',
                q, features,
            )
            time.sleep(3)
        save("streets.geojson", fc(features))

    print("Basemap download complete. Attribution: (c) OpenStreetMap contributors (ODbL).")


if __name__ == "__main__":
    main()
