#!/usr/bin/env python3
"""Download PennDOT statewide crash zips and write bicycle deaths and injuries.

PennDOT's open-data experience publishes one zip per year:

  https://gis.penndot.pa.gov/gishub/crashZip/Statewide/Statewide_{year}.zip

The public extract has year and month, not the calendar day (PennDOT withholds
the date). Filings use the first of the month and say so. Names are not in the
public file. Statewide is preferred; a missing year is skipped.

Refresh:
  python3 scripts/fetch-penndot-bike.py
  node scripts/load-crash-imports.mjs
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from crash_import_common import OUT_DIR, update_manifest

UA = "cycling-fatalities-tracker/penndot"
DEFAULT_YEARS = [2022, 2023, 2024, 2025]
ZIP_URL = "https://gis.penndot.pa.gov/gishub/crashZip/Statewide/Statewide_{year}.zip"

# PennDOT county codes from the crash data dictionary.
COUNTIES = {
    "01": "Adams",
    "02": "Allegheny",
    "03": "Armstrong",
    "04": "Beaver",
    "05": "Bedford",
    "06": "Berks",
    "07": "Blair",
    "08": "Bradford",
    "09": "Bucks",
    "10": "Butler",
    "11": "Cambria",
    "12": "Cameron",
    "13": "Carbon",
    "14": "Centre",
    "15": "Chester",
    "16": "Clarion",
    "17": "Clearfield",
    "18": "Clinton",
    "19": "Columbia",
    "20": "Crawford",
    "21": "Cumberland",
    "22": "Dauphin",
    "23": "Delaware",
    "24": "Elk",
    "25": "Erie",
    "26": "Fayette",
    "27": "Forest",
    "28": "Franklin",
    "29": "Fulton",
    "30": "Greene",
    "31": "Huntingdon",
    "32": "Indiana",
    "33": "Jefferson",
    "34": "Juniata",
    "35": "Lackawanna",
    "36": "Lancaster",
    "37": "Lawrence",
    "38": "Lebanon",
    "39": "Lehigh",
    "40": "Luzerne",
    "41": "Lycoming",
    "42": "McKean",
    "43": "Mercer",
    "44": "Mifflin",
    "45": "Monroe",
    "46": "Montgomery",
    "47": "Montour",
    "48": "Northampton",
    "49": "Northumberland",
    "50": "Perry",
    "51": "Pike",
    "52": "Potter",
    "53": "Schuylkill",
    "54": "Snyder",
    "55": "Somerset",
    "56": "Sullivan",
    "57": "Susquehanna",
    "58": "Tioga",
    "59": "Union",
    "60": "Venango",
    "61": "Warren",
    "62": "Washington",
    "63": "Wayne",
    "64": "Westmoreland",
    "65": "Wyoming",
    "66": "York",
    "67": "Philadelphia",
}

# Lancaster and the Pennsylvania counties that border it on the traffic map.
REGION_CODES = {"36", "66", "22", "38", "06", "15"}

ILLUM = {
    "1": "daylight",
    "2": "dark, no streetlights",
    "3": "dark, streetlights",
    "4": "dusk",
    "5": "dawn",
    "6": "dark, unknown lighting",
    "8": "other",
    "9": "unknown",
}


def download(url: str) -> bytes | None:
    last: Exception | None = None
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as res:
                if res.status != 200:
                    return None
                return res.read()
        except Exception as err:  # noqa: BLE001
            last = err
            if getattr(err, "code", None) == 404:
                return None
    print(f"[penndot] skip {url}: {last}", file=sys.stderr)
    return None


def code(value: str | None) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text


def num(value: str | None) -> int:
    text = code(value)
    if text == "":
        return 0
    try:
        return int(float(text))
    except ValueError:
        return 0


def coord(value: str | None, kind: str) -> float | None:
    try:
        n = float(value) if value not in (None, "") else None
    except ValueError:
        return None
    if n is None:
        return None
    if kind == "lat" and not (39.6 <= n <= 42.4):
        return None
    if kind == "lon" and not (-80.6 <= n <= -74.6):
        return None
    return round(n, 5)


def crash_reader(blob: bytes) -> csv.DictReader:
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = [
            n
            for n in zf.namelist()
            if n.lower().endswith(".csv") and "crash" in Path(n).name.lower() and "flag" not in n.lower()
        ]
        if not names:
            raise RuntimeError("zip has no CRASH csv")
        # Prefer the plain crash table over roadway or unit extracts.
        names.sort(key=lambda n: (0 if Path(n).name.lower().startswith("crash") else 1, len(n)))
        raw = zf.read(names[0])
        print(f"[penndot] reading {names[0]}")
    text = raw.decode("utf-8-sig", errors="replace")
    return csv.DictReader(io.StringIO(text))


def build_year(year: int) -> list[dict]:
    url = ZIP_URL.format(year=year)
    print(f"[penndot] downloading {year}")
    blob = download(url)
    if blob is None:
        print(f"[penndot] {year} not published")
        return []
    filings: list[dict] = []
    for raw in crash_reader(blob):
        row = {str(k).strip().upper(): (v.strip() if isinstance(v, str) else "") for k, v in raw.items() if k}
        if num(row.get("BICYCLE_COUNT")) < 1:
            continue
        deaths = num(row.get("BICYCLE_DEATH_COUNT"))
        serious = num(row.get("BICYCLE_SUSP_SERIOUS_INJ_COUNT"))
        injuries = num(row.get("INJURY_COUNT")) or num(row.get("TOT_INJ_COUNT"))
        severity_code = code(row.get("MAX_SEVERITY_LEVEL"))
        injured_crash = injuries > 0 or severity_code in {"2", "3", "4", "8"}
        if deaths < 1 and serious < 1 and not injured_crash:
            continue
        county_code = code(row.get("COUNTY")).zfill(2)
        county = COUNTIES.get(county_code)
        if not county:
            continue
        month = num(row.get("CRASH_MONTH"))
        if not 1 <= month <= 12:
            continue
        file_year = num(row.get("CRASH_YEAR")) or year
        occurred = f"{file_year:04d}-{month:02d}-01"
        city = f"{county} County" if county != "Philadelphia" else "Philadelphia"
        lat = coord(row.get("DEC_LAT") or row.get("LATITUDE"), "lat")
        lon = coord(row.get("DEC_LONG") or row.get("LONGITUDE"), "lon")
        crn = code(row.get("CRN"))
        if not crn:
            continue
        if deaths > 0:
            outcome = "killed"
            severity = "critical"
            injured = serious
            title = f"{deaths} bicyclist{'s' if deaths != 1 else ''} killed in {city}"
        elif serious > 0:
            outcome = "serious_injury"
            severity = "high"
            injured = serious
            title = f"{serious} bicyclist{'s' if serious != 1 else ''} seriously injured in {city}"
        else:
            outcome = "serious_injury"
            severity = "moderate"
            injured = num(row.get("BICYCLE_COUNT")) or 1
            title = f"Bicyclist injured in {city}"
        crash_type = "hit-from-behind" if code(row.get("COLLISION_TYPE")) == "1" else "other"
        summary = (
            f"PennDOT statewide crash extract {file_year} records a bicycle-involved crash in {city} "
            f"during {file_year:04d}-{month:02d}. "
            f"Bicyclist fatalities: {deaths}. Bicyclist suspected serious injuries: {serious}. "
            f"People injured in the crash (all person types): {injuries}. "
            f"Crash record number {crn}. PennDOT does not publish the calendar day or a name in this extract."
        )
        filings.append(
            {
                "id": f"penndot-{crn}",
                "title": title,
                "locationName": f"{city}, Pennsylvania",
                "occurredOn": occurred,
                "datePrecision": "month",
                "country": "United States",
                "countryCode": "USA",
                "state": "Pennsylvania",
                "stateCode": "PA",
                "city": city,
                "region": "Northeast",
                "latitude": lat,
                "longitude": lon,
                "locationPrecision": "exact" if lat is not None and lon is not None else None,
                "crashType": crash_type,
                "outcome": outcome,
                "severity": severity,
                "fatalities": deaths,
                "injured": injured,
                "victimName": None,
                "victimAgeBand": None,
                "driverStatus": "unknown",
                "vehicleType": None,
                "roadwayType": None,
                "lighting": ILLUM.get(code(row.get("ILLUMINATION")), "unknown"),
                "helmet": "unknown",
                "policeReportId": crn,
                "summary": summary,
                "context": (
                    "Bulk PennDOT open data. The stored date is the first of the published month because "
                    "the public extract omits the calendar day. Coordinates are PennDOT decimal degrees when "
                    "they fall in Pennsylvania. Victim names are not in the file. "
                    + (
                        "This county is in the Lancaster traffic region (Lancaster, York, Dauphin, Lebanon, Berks, Chester)."
                        if county_code in REGION_CODES
                        else "Statewide Pennsylvania extract."
                    )
                ),
                "sourceName": "PennDOT",
                "sourceUrl": url,
                "verified": True,
                "ingestSource": "penndot",
                "reviewStatus": "published",
            }
        )
    print(f"[penndot] {year} bicycle injury or fatal crashes {len(filings)}")
    return filings


def main() -> None:
    parser = argparse.ArgumentParser(description="Import PennDOT bicycle crashes")
    parser.add_argument("--years", type=int, nargs="*", default=DEFAULT_YEARS)
    args = parser.parse_args()
    rows: list[dict] = []
    by_year: dict[str, int] = {}
    for year in args.years:
        year_rows = build_year(year)
        by_year[str(year)] = len(year_rows)
        rows.extend(year_rows)
    rows.sort(key=lambda row: (row["occurredOn"], row["id"]))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / "penndot.json"
    dest.write_text(json.dumps(rows, ensure_ascii=False))
    region_rows = sum(1 for row in rows if "Lancaster traffic region" in row["context"])
    update_manifest(
        "penndot",
        {
            "file": "data/crash-imports/penndot.json",
            "rows": len(rows),
            "byYear": by_year,
            "years": args.years,
            "scope": "Pennsylvania statewide, bicycle-involved crashes with a bicyclist death, suspected serious injury, or any injury",
            "lancasterRegionRows": region_rows,
            "names": "not published; victimName is null",
            "date": "year and month only; occurredOn is the first of the month",
            "verified": True,
            "source": ZIP_URL,
            "refresh": "python3 scripts/fetch-penndot-bike.py && node scripts/load-crash-imports.mjs",
        },
    )
    print(f"[penndot] wrote {len(rows)} rows ({region_rows} in the Lancaster region) to {dest}")


if __name__ == "__main__":
    main()
