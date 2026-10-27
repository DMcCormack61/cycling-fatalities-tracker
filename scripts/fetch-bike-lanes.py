#!/usr/bin/env python3
"""Download dedicated bike lanes from OpenStreetMap for the desk's map places.

A dedicated lane here is highway=cycleway, or a cycleway / cycleway:left /
cycleway:right / cycleway:both tag of lane or track (including opposite_*).
Shared-lane markings are left out. Writes public/bike-lanes.json and keeps
earlier places if a later box fails.
"""
from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "bike-lanes.json"
UA = "cycling-fatalities-tracker/bike-lanes"
ENDPOINTS = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]

# west, south, east, north — frames around each map focus and crash pin.
# Kept near 0.08° so Overpass can return geometry before the public timeout.
BOXES = [
    ("Chicago Loop", -87.66, 41.86, -87.60, 41.91),
    ("Chicago Garfield", -87.76, 41.86, -87.68, 41.91),
    ("Philadelphia", -75.22, 39.94, -75.14, 40.02),
    ("Cambridge", -71.14, 42.34, -71.06, 42.38),
    ("Fort Worth", -97.32, 32.74, -97.25, 32.79),
    ("Sacramento", -121.42, 38.50, -121.34, 38.55),
    ("San Carlos", -122.28, 37.50, -122.23, 37.54),
    ("Albuquerque", -106.58, 35.07, -106.51, 35.12),
    ("Denver", -105.02, 39.73, -104.96, 39.77),
    ("Minneapolis", -93.30, 44.96, -93.24, 45.00),
    ("Miami", -80.22, 25.76, -80.16, 25.80),
    ("Spokane", -117.44, 47.65, -117.38, 47.69),
    ("Oldmans Township", -75.42, 39.68, -75.35, 39.73),
    ("Bedford", -71.32, 42.47, -71.26, 42.51),
    ("North Highlands", -121.40, 38.64, -121.34, 38.68),
    ("West Plains", -117.60, 47.57, -117.54, 47.61),
    ("Lancaster", -76.34, 40.02, -76.28, 40.06),
    ("East Hempfield", -76.43, 40.08, -76.36, 40.13),
    ("Ephrata", -76.20, 40.16, -76.15, 40.20),
    ("Elizabethtown", -76.63, 40.14, -76.58, 40.18),
    ("Lititz", -76.33, 40.14, -76.28, 40.18),
    ("Quarryville", -76.18, 39.87, -76.13, 39.91),
]


def query(south: float, west: float, north: float, east: float) -> str:
    box = f"{south},{west},{north},{east}"
    dedicated = "^(lane|track|opposite_lane|opposite_track)$"
    return f"""
[out:json][timeout:25];
(
  way["highway"="cycleway"]({box});
  way["cycleway"~"{dedicated}"]({box});
  way["cycleway:right"~"{dedicated}"]({box});
  way["cycleway:left"~"{dedicated}"]({box});
  way["cycleway:both"~"{dedicated}"]({box});
);
out geom;
"""


def fetch(ql: str) -> dict:
    last = None
    for endpoint in ENDPOINTS:
        try:
            req = urllib.request.Request(
                endpoint,
                data=ql.encode(),
                headers={"User-Agent": UA, "Content-Type": "text/plain"},
            )
            with urllib.request.urlopen(req, timeout=40) as res:
                return json.loads(res.read().decode())
        except Exception as exc:  # noqa: BLE001
            last = exc
            print("  ", endpoint, "failed:", exc, flush=True)
            time.sleep(1.5)
    raise RuntimeError(str(last))


def simplify(coords: list[list[float]], limit: int = 12) -> list[list[float]]:
    cleaned: list[list[float]] = []
    for pt in coords:
        if not cleaned or pt != cleaned[-1]:
            cleaned.append(pt)
    if len(cleaned) <= limit:
        return cleaned
    step = (len(cleaned) - 1) / (limit - 1)
    picked = [cleaned[round(i * step)] for i in range(limit)]
    if picked[-1] != cleaned[-1]:
        picked[-1] = cleaned[-1]
    return picked


def ways_to_features(data: dict, seen: set[int]) -> list[dict]:
    features = []
    for el in data.get("elements") or []:
        if el.get("type") != "way":
            continue
        way_id = int(el.get("id") or 0)
        if not way_id or way_id in seen:
            continue
        geom = el.get("geometry") or []
        coords = [[round(p["lon"], 5), round(p["lat"], 5)] for p in geom if "lon" in p and "lat" in p]
        coords = simplify(coords)
        if len(coords) < 2:
            continue
        seen.add(way_id)
        features.append({"id": f"osm-{way_id}", "coordinates": coords})
    return features


def load_existing() -> tuple[list[dict], set[int]]:
    if not OUT.exists():
        return [], set()
    payload = json.loads(OUT.read_text())
    features = payload.get("features") or []
    seen = set()
    for feature in features:
        raw = str(feature.get("id") or "")
        if raw.startswith("osm-") and raw[4:].isdigit():
            seen.add(int(raw[4:]))
    return features, seen


def write(features: list[dict]) -> None:
    payload = {
        "sourceName": "OpenStreetMap dedicated bicycle ways",
        "sourceUrl": "https://www.openstreetmap.org/copyright",
        "retrieved": "2026-10-27",
        "note": (
            "Each line is an OpenStreetMap way tagged highway=cycleway, or cycleway / "
            "cycleway:left / cycleway:right / cycleway:both = lane or track "
            "(including opposite lane and opposite track). Shared-lane markings are excluded. "
            "Geometry is simplified. The same file is drawn on the United States atlas, the "
            "traffic map, and crash street maps. A closer map can also ask Overpass for the "
            "frame in view."
        ),
        "features": features,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))


def main() -> None:
    features, seen = load_existing()
    for name, west, south, east, north in BOXES:
        print("query", name, flush=True)
        try:
            data = fetch(query(south, west, north, east))
        except Exception as exc:  # noqa: BLE001
            print(name, "FAIL", exc, flush=True)
            continue
        added = ways_to_features(data, seen)
        features.extend(added)
        write(features)
        print(f"{name}: +{len(added)} total {len(features)}", flush=True)
        time.sleep(1.2)
    print("wrote", OUT, "features", len(features), "bytes", OUT.stat().st_size if OUT.exists() else 0)


if __name__ == "__main__":
    main()
