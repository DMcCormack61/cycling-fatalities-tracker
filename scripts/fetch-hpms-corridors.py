#!/usr/bin/env python3
"""Pull a real FHWA HPMS sample: AADT + posted speed for US city corridors.

Writes public/traffic-corridors.json. Spatial queries use maxAllowableOffset so
geo.dot.gov returns simplified section lines instead of timing out.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "traffic-corridors.json"
UA = "cycling-fatalities-tracker/traffic-corridors"

# west, south, east, north
PLACES = [
    ("Fort Worth", "Texas", "TX", "HPMS_FULL_TX_2023", -97.46, 32.68, -97.22, 32.86),
    ("Albuquerque", "New Mexico", "NM", "HPMS_FULL_NM_2023", -106.72, 35.02, -106.48, 35.16),
    ("Sacramento", "California", "CA", "HPMS_FULL_CA_2023", -121.55, 38.50, -121.38, 38.64),
    ("San Carlos", "California", "CA", "HPMS_FULL_CA_2023", -122.30, 37.48, -122.22, 37.54),
    ("Cambridge", "Massachusetts", "MA", "HPMS_FULL_MA_2023", -71.16, 42.35, -71.06, 42.41),
    ("Chicago", "Illinois", "IL", "HPMS_FULL_IL_2023", -87.78, 41.84, -87.60, 41.96),
    ("Philadelphia", "Pennsylvania", "PA", "HPMS_FULL_PA_2023", -75.22, 39.93, -75.10, 40.04),
    ("Oldmans Township", "New Jersey", "NJ", "HPMS_FULL_NJ_2023", -75.48, 39.66, -75.28, 39.76),
    ("Spokane", "Washington", "WA", "HPMS_FULL_WA_2023", -117.62, 47.55, -117.32, 47.72),
    ("Denver", "Colorado", "CO", "HPMS_FULL_CO_2023", -105.05, 39.68, -104.90, 39.80),
    ("Minneapolis", "Minnesota", "MN", "HPMS_FULL_MN_2023", -93.32, 44.94, -93.20, 45.02),
    ("Miami", "Florida", "FL", "HPMS_FULL_FL_2023", -80.28, 25.74, -80.16, 25.84),
]

STRATA = [
    "aadt>=60000",
    "aadt>=12000 AND aadt<60000",
    "aadt>0 AND aadt<12000",
]
FSYS = {
    1: "Interstate",
    2: "Freeway or expressway",
    3: "Principal arterial",
    4: "Minor arterial",
    5: "Major collector",
    6: "Minor collector",
    7: "Local",
}
SIGN = {2: "I", 3: "US", 4: "State", 5: "Business", 6: "County", 8: "Municipal"}


def fetch(service: str, params: dict) -> dict:
    url = (
        "https://geo.dot.gov/server/rest/services/Hosted/"
        + service
        + "/FeatureServer/0/query?"
        + urllib.parse.urlencode(params)
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as res:
                return json.loads(res.read().decode())
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(str(last))


def road_name(attrs: dict) -> str:
    number = attrs.get("route_number")
    sign = attrs.get("route_signing")
    prefix = SIGN.get(sign)
    if prefix and number:
        return f"{prefix}-{number}" if prefix == "I" else f"{prefix} {number}"
    route = (attrs.get("routeid") or "").strip()
    return route or "Unnumbered segment"


def main() -> None:
    features = []
    seen = set()
    for place, state, abbr, service, west, south, east, north in PLACES:
        envelope = f"{west},{south},{east},{north}"
        got = 0
        for stratum in STRATA:
            where = f"({stratum}) AND speed_limit>0 AND speed_limit<=85"
            try:
                data = fetch(
                    service,
                    {
                        "where": where,
                        "geometry": envelope,
                        "geometryType": "esriGeometryEnvelope",
                        "inSR": "4326",
                        "spatialRel": "esriSpatialRelIntersects",
                        "outFields": "aadt,speed_limit,routeid,f_system,route_number,route_signing,stateid",
                        "returnGeometry": "true",
                        "outSR": "4326",
                        "maxAllowableOffset": "0.0004",
                        "geometryPrecision": "5",
                        "resultRecordCount": "36",
                        "f": "json",
                    },
                )
            except Exception as exc:  # noqa: BLE001
                print(place, stratum, "FAIL", exc, flush=True)
                continue
            if data.get("error"):
                print(place, stratum, "ERR", data["error"].get("message"), flush=True)
                continue
            for feat in data.get("features") or []:
                attrs = feat.get("attributes") or {}
                paths = (feat.get("geometry") or {}).get("paths") or []
                if not paths:
                    continue
                coords = [[round(x, 5), round(y, 5)] for x, y in paths[0]]
                if len(coords) < 2:
                    continue
                aadt = attrs.get("aadt")
                speed = attrs.get("speed_limit")
                if not aadt or not speed:
                    continue
                key = (abbr, aadt, speed, coords[0][0], coords[0][1], coords[-1][0], coords[-1][1])
                if key in seen:
                    continue
                seen.add(key)
                features.append(
                    {
                        "id": f"{abbr.lower()}-{len(features)+1}",
                        "place": place,
                        "state": state,
                        "stateAbbr": abbr,
                        "name": road_name(attrs),
                        "aadt": int(aadt),
                        "speedMph": int(speed),
                        "functionalClass": FSYS.get(attrs.get("f_system"), "Unclassified"),
                        "routeId": (attrs.get("routeid") or "").strip(),
                        "service": service,
                        "coordinates": coords,
                    }
                )
                got += 1
        print(f"{place}: {got}", flush=True)
        time.sleep(0.4)

    payload = {
        "sourceName": "FHWA Highway Performance Monitoring System, 2023 state submissions",
        "sourceUrl": "https://geo.dot.gov/server/rest/services/Hosted/",
        "retrieved": "2026-10-27",
        "note": (
            "Each feature is a reported HPMS section with annual average daily traffic (AADT) "
            "and the posted speed limit. Geometry is simplified. HPMS covers federal-aid roads "
            "(interstates through many collectors), not every residential block. The Traffic page "
            "can also query the same FeatureServer for the state under the map."
        ),
        "features": features,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print("wrote", OUT, "features", len(features), "bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()
