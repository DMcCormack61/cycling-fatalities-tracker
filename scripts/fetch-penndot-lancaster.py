#!/usr/bin/env python3
"""Replace the Lancaster-region HPMS sample with PennDOT roadway volumes.

Counties are Lancaster and the Pennsylvania counties that border it: York,
Dauphin, Lebanon, Berks, and Chester. Codes come from src/lib/penndot-region.mjs.
Cecil and Harford counties in Maryland are not on these PennDOT services.

State routes come from PennDOT RMS roadway segments (CUR_AADT, street name),
joined to roadway admin for posted speed and roadway shoulder for width.
Local roads come from the Pennsylvania local-road inventory
(EST_AVERAGE_DAILY_TRAFFIC, name, and speed or shoulder when that record has them).

Other places in public/traffic-corridors.json stay.
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "traffic-corridors.json"
REGION_JS = ROOT / "src" / "lib" / "penndot-region.mjs"
UA = "cycling-fatalities-tracker/penndot-lancaster"
PAGE = 1000

LAYERS = {
    "local": "https://gis.penndot.gov/gis/rest/services/opendata/pennsylvanialocalroads/MapServer/0/query",
    "segments": "https://gis.penndot.gov/gis/rest/services/opendata/roadwaysegments/MapServer/0/query",
    "admin": "https://gis.penndot.gov/gis/rest/services/opendata/roadwayadmin/MapServer/0/query",
    "shoulder": "https://gis.penndot.gov/gis/rest/services/opendata/roadwayshoulder/MapServer/0/query",
}

FSYS = {
    1: "Interstate",
    2: "Freeway or expressway",
    3: "Principal arterial",
    4: "Minor arterial",
    5: "Major collector",
    6: "Minor collector",
    7: "Local",
}

ADMIN_CLASS = {
    "01": "Interstate",
    "02": "Principal arterial",
    "06": "Minor arterial",
    "07": "Major collector",
    "08": "Minor collector",
    "09": "Local",
    "11": "Interstate",
    "12": "Freeway or expressway",
    "14": "Principal arterial",
    "16": "Minor arterial",
    "17": "Major collector",
    "19": "Local",
}


def counties() -> list[tuple[str, str]]:
    text = REGION_JS.read_text()
    found = re.findall(r'code:\s*"(\d+)",\s*name:\s*"([^"]+)"', text)
    if len(found) < 6:
        raise RuntimeError(f"expected PennDOT counties in {REGION_JS}")
    return found


def get(url: str) -> dict:
    last: Exception | None = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as res:
                return json.loads(res.read().decode())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last = err
            print(f"  retry {attempt + 1}: {err}", flush=True)
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(last)


def pages(layer: str, where: str, fields: str, geometry: bool) -> list[dict]:
    offset = 0
    found: list[dict] = []
    while True:
        params = {
            "where": where,
            "outFields": fields,
            "returnGeometry": "true" if geometry else "false",
            "outSR": "4326",
            "geometryPrecision": "5",
            "resultRecordCount": str(PAGE),
            "resultOffset": str(offset),
            "f": "json",
        }
        if geometry:
            params["maxAllowableOffset"] = "0.00008"
        data = get(LAYERS[layer] + "?" + urllib.parse.urlencode(params))
        if data.get("error"):
            raise RuntimeError(f"{layer}: {data['error']}")
        batch = data.get("features") or []
        found.extend(batch)
        print(f"  {layer} +{len(batch)} total {len(found)}", flush=True)
        if not batch or not data.get("exceededTransferLimit"):
            break
        offset += len(batch)
    return found


def title_name(value: str | None) -> str:
    text = (value or "").strip()
    if not text or text.upper() == "NO NAME":
        return ""
    return " ".join(part.capitalize() for part in text.split())


def simplify(coords: list[list[float]], limit: int = 12) -> list[list[float]]:
    cleaned: list[list[float]] = []
    for pt in coords:
        rounded = [round(pt[0], 5), round(pt[1], 5)]
        if not cleaned or rounded != cleaned[-1]:
            cleaned.append(rounded)
    if len(cleaned) <= limit:
        return cleaned
    step = (len(cleaned) - 1) / (limit - 1)
    picked = [cleaned[round(i * step)] for i in range(limit)]
    if picked[-1] != cleaned[-1]:
        picked[-1] = cleaned[-1]
    return picked


def paths_of(feature: dict) -> list[list[float]]:
    paths = (feature.get("geometry") or {}).get("paths") or []
    if not paths:
        return []
    return simplify(paths[0])


def as_int(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(str(value).strip())
    except ValueError:
        return None


def as_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def index_ranges(features: list[dict], value_field: str) -> dict[str, list[tuple[int, int, float, str]]]:
    index: dict[str, list[tuple[int, int, float, str]]] = {}
    for feature in features:
        attrs = feature.get("attributes") or {}
        route = str(attrs.get("ST_RT_NO") or "").strip()
        start = as_int(attrs.get("SEG_BGN"))
        end = as_int(attrs.get("SEG_END"))
        value = as_float(attrs.get(value_field))
        if not route or start is None or end is None or value is None:
            continue
        if end < start:
            start, end = end, start
        label = str(attrs.get("FUNC_CLS") or "").strip()
        index.setdefault(route, []).append((start, end, value, label))
    return index


def lookup(index: dict[str, list[tuple[int, int, float, str]]], route: str, segment: int | None):
    rows = index.get(route) or []
    if segment is None:
        return None
    hits = [row for row in rows if row[0] <= segment <= row[1]]
    if not hits:
        return None
    hits.sort(key=lambda row: (row[1] - row[0], row[0]))
    return hits[0]


def state_name(attrs: dict) -> str:
    prefix = str(attrs.get("TRAF_RT_NO_PREFIX") or "").strip()
    number = str(attrs.get("TRAF_RT_NO") or "").strip()
    street = title_name(attrs.get("STREET_NAME"))
    route = ""
    if prefix and number:
        parsed = as_int(number)
        route = f"{prefix} {parsed if parsed is not None else number}"
    if route and street:
        return f"{route} · {street}"
    if route or street:
        return route or street
    raw = str(attrs.get("ST_RT_NO") or "").lstrip("0")
    return f"SR {raw}" if raw else "State route"


def local_name(attrs: dict) -> str:
    road = title_name(attrs.get("LR_NAME")) or "Local road"
    town = title_name(attrs.get("MUNICIPAL_NAME"))
    return f"{road}, {town}" if town else road


def chain_same_road(features: list[dict]) -> list[dict]:
    """Join touching pieces that share a name and the same published numbers.

    PennDOT splits one street into many short segments. At county zoom those
    pieces are only a pixel or two, so the municipal network disappears.
    Pieces stay separate when volume, speed, or shoulder width differ.
    """
    groups: dict[tuple, list[dict]] = {}
    for feature in features:
        key = (
            feature.get("place"),
            feature.get("service"),
            feature.get("name"),
            feature.get("aadt"),
            feature.get("speedMph"),
            feature.get("shoulderFt"),
            feature.get("accessControl"),
        )
        groups.setdefault(key, []).append(feature)

    merged: list[dict] = []
    for parts in groups.values():
        unused = [list(part["coordinates"]) for part in parts]
        chains: list[list[list[float]]] = []
        while unused:
            line = unused.pop()
            grew = True
            while grew:
                grew = False
                for index, other in enumerate(unused):
                    start = (round(line[0][0], 4), round(line[0][1], 4))
                    end = (round(line[-1][0], 4), round(line[-1][1], 4))
                    other_start = (round(other[0][0], 4), round(other[0][1], 4))
                    other_end = (round(other[-1][0], 4), round(other[-1][1], 4))
                    if end == other_start:
                        line = line + other[1:]
                    elif end == other_end:
                        line = line + other[-2::-1]
                    elif start == other_end:
                        line = other + line[1:]
                    elif start == other_start:
                        line = other[::-1] + line[1:]
                    else:
                        continue
                    unused.pop(index)
                    grew = True
                    break
            chains.append(line)
        for line in chains:
            base = dict(parts[0])
            base["id"] = f"{parts[0]['id']}-{len(merged)}"
            base["coordinates"] = simplify(line, limit=24)
            merged.append(base)
    return merged


def county_features(code: str, name: str) -> list[dict]:
    print(f"=== {name} ({code})", flush=True)
    print("local roads", flush=True)
    local = pages(
        "local",
        f"CTY_CODE='{code}' AND EST_AVERAGE_DAILY_TRAFFIC>0",
        "OBJECTID,LR_NAME,MUNICIPAL_NAME,EST_AVERAGE_DAILY_TRAFFIC,SPEED_LIMIT,SHOULDER_WIDTH,FUNCTIONAL_CLASS",
        True,
    )
    print("state segments", flush=True)
    segments = pages(
        "segments",
        f"CTY_CODE='{code}' AND CUR_AADT>0",
        "OBJECTID,ST_RT_NO,SEG_NO,STREET_NAME,TRAF_RT_NO,TRAF_RT_NO_PREFIX,CUR_AADT,ACCESS_CTRL",
        True,
    )
    print("posted speed", flush=True)
    admin = pages(
        "admin",
        f"CTY_CODE='{code}' AND SPEED_LIMIT>0",
        "ST_RT_NO,SEG_BGN,SEG_END,SPEED_LIMIT,FUNC_CLS",
        False,
    )
    print("shoulders", flush=True)
    shoulders = pages(
        "shoulder",
        f"CTY_CODE='{code}'",
        "ST_RT_NO,SEG_BGN,SEG_END,SHLD_TOTAL_WIDTH",
        False,
    )
    speeds = index_ranges(admin, "SPEED_LIMIT")
    widths = index_ranges(shoulders, "SHLD_TOTAL_WIDTH")

    features: list[dict] = []
    speed_hits = 0
    shoulder_hits = 0

    for feature in local:
        attrs = feature.get("attributes") or {}
        coords = paths_of(feature)
        aadt = as_float(attrs.get("EST_AVERAGE_DAILY_TRAFFIC"))
        if len(coords) < 2 or aadt is None or aadt <= 0:
            continue
        speed = as_float(attrs.get("SPEED_LIMIT"))
        shoulder = as_float(attrs.get("SHOULDER_WIDTH"))
        if speed is not None and (speed <= 0 or speed > 85):
            speed = None
        if shoulder is not None and shoulder < 0:
            shoulder = None
        klass = as_int(attrs.get("FUNCTIONAL_CLASS"))
        if speed is not None:
            speed_hits += 1
        if shoulder is not None:
            shoulder_hits += 1
        features.append(
            {
                "id": f"pa-{code}-local-{attrs.get('OBJECTID')}",
                "place": name,
                "state": "Pennsylvania",
                "stateAbbr": "PA",
                "name": local_name(attrs),
                "aadt": int(round(aadt)),
                "speedMph": int(round(speed)) if speed is not None else None,
                "shoulderFt": round(shoulder, 1) if shoulder is not None else None,
                "functionalClass": FSYS.get(klass or -1, "Local road"),
                "routeId": str(attrs.get("OBJECTID") or ""),
                "service": "PennDOT local roads",
                "coordinates": coords,
            }
        )

    for feature in segments:
        attrs = feature.get("attributes") or {}
        coords = paths_of(feature)
        aadt = as_float(attrs.get("CUR_AADT"))
        if len(coords) < 2 or aadt is None or aadt <= 0:
            continue
        route = str(attrs.get("ST_RT_NO") or "").strip()
        segment = as_int(attrs.get("SEG_NO"))
        speed_row = lookup(speeds, route, segment)
        shoulder_row = lookup(widths, route, segment)
        speed = speed_row[2] if speed_row and 0 < speed_row[2] <= 85 else None
        shoulder = shoulder_row[2] if shoulder_row and shoulder_row[2] >= 0 else None
        func_code = (speed_row[3] if speed_row else "").strip()
        klass = ADMIN_CLASS.get(func_code, ADMIN_CLASS.get(func_code.zfill(2), "State route"))
        access = str(attrs.get("ACCESS_CTRL") or "").strip()
        if access not in {"1", "2", "3"}:
            access = ""
        if speed is not None:
            speed_hits += 1
        if shoulder is not None:
            shoulder_hits += 1
        features.append(
            {
                "id": f"pa-{code}-rms-{attrs.get('OBJECTID')}",
                "place": name,
                "state": "Pennsylvania",
                "stateAbbr": "PA",
                "name": state_name(attrs),
                "aadt": int(round(aadt)),
                "speedMph": int(round(speed)) if speed is not None else None,
                "shoulderFt": round(shoulder, 1) if shoulder is not None else None,
                "functionalClass": klass,
                "accessControl": access or None,
                "routeId": f"{route}-{attrs.get('SEG_NO') or ''}",
                "service": "PennDOT RMS",
                "coordinates": coords,
            }
        )

    chained = chain_same_road(features)
    print(
        name,
        "chained",
        len(chained),
        "from",
        len(features),
        "pieces; speed",
        speed_hits,
        "shoulder",
        shoulder_hits,
        flush=True,
    )
    return chained


def main() -> None:
    chosen = counties()
    names = {name for _, name in chosen}
    features: list[dict] = []
    for code, name in chosen:
        features.extend(county_features(code, name))
    catalog = json.loads(OUT.read_text()) if OUT.exists() else {"features": []}
    kept = [row for row in catalog.get("features") or [] if row.get("place") not in names]
    listed = ", ".join(f"{name} ({code})" for code, name in chosen)
    catalog["sourceName"] = "FHWA HPMS 2023, plus PennDOT roadway volumes for the Lancaster region"
    catalog["sourceUrl"] = "https://gis.penndot.gov/gis/rest/services/opendata/roadwaysegments/MapServer"
    catalog["retrieved"] = "2026-10-28"
    catalog["note"] = (
        "Most places are FHWA HPMS sections with annual average daily traffic and a posted speed. "
        "The Lancaster region replaces that sample with PennDOT open data for Lancaster County and "
        "the Pennsylvania counties that border it: "
        + listed
        + ". Each county uses RMS state-route segments (CUR_AADT) joined to posted speed "
        "(roadway admin) and shoulder width in feet (roadway shoulder), plus the Pennsylvania "
        "local-road inventory (EST_AVERAGE_DAILY_TRAFFIC, road name, and speed or shoulder when "
        "the record includes them). Cecil and Harford counties, Maryland, also border Lancaster "
        "and are not in this file. RMS ACCESS_CTRL 1 is limited access. Geometry is simplified."
    )
    catalog["features"] = kept + features
    OUT.write_text(json.dumps(catalog, separators=(",", ":")))
    print("wrote", len(features), "region features; bytes", OUT.stat().st_size, "kept other", len(kept))


def stamp_access() -> None:
    """Add ACCESS_CTRL onto RMS features already stored in the bundle."""
    import re

    chosen = counties()
    codes = ",".join(f"'{code}'" for code, _name in chosen)
    lookup: dict[str, str] = {}
    print("access control", flush=True)
    rows = pages(
        "segments",
        f"CTY_CODE IN ({codes}) AND CUR_AADT>0",
        "OBJECTID,ACCESS_CTRL",
        False,
    )
    for row in rows:
        attrs = row.get("attributes") or {}
        access = str(attrs.get("ACCESS_CTRL") or "").strip()
        if access in {"1", "2", "3"}:
            lookup[str(attrs.get("OBJECTID"))] = access
    catalog = json.loads(OUT.read_text())
    stamped = 0
    missing = 0
    for feature in catalog.get("features") or []:
        if feature.get("service") != "PennDOT RMS":
            continue
        match = re.search(r"rms-(\d+)", str(feature.get("id") or ""))
        if not match:
            missing += 1
            continue
        access = lookup.get(match.group(1))
        if not access:
            missing += 1
            continue
        feature["accessControl"] = access
        stamped += 1
    note = catalog.get("note") or ""
    if "ACCESS_CTRL 1" not in note:
        catalog["note"] = note.rstrip() + " RMS ACCESS_CTRL 1 is limited access."
    OUT.write_text(json.dumps(catalog, separators=(",", ":")))
    print("stamped", stamped, "missing", missing, "lookup", len(lookup), "bytes", OUT.stat().st_size)


if __name__ == "__main__":
    import sys

    if "--stamp-access" in sys.argv:
        stamp_access()
    else:
        main()
