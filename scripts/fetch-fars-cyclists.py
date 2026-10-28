#!/usr/bin/env python3
"""Download NHTSA FARS annual files and write killed pedalcyclists.

The latest complete annual file is preferred. Configured years are the complete
files that exist as national CSV zips (2022–2024 as of this writing). 2025
early estimates from Crash Stats are national totals, not person rows, and the
Crash API will not return a census without an exact age, sex, seat, and injury.
Those estimates are recorded in the manifest and are not turned into filings.

Person type (PER_TYP) 6 is Bicyclist. PER_TYP 7 is Other Cyclist through 2021
and Other Pedalcyclist from 2022. A row is kept when injury severity is fatal
(INJ_SEV 4). FARS does not publish names.

Refresh:
  python3 scripts/fetch-fars-cyclists.py
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
from crash_import_common import OUT_DIR, REGIONS, STATES, age_band, update_manifest

UA = "cycling-fatalities-tracker/fars"
# Complete annual files. 2024 is the latest published national CSV.
DEFAULT_YEARS = [2022, 2023, 2024]
PEDAL_TYPES = {"6", "7"}
FARS_URL = "https://static.nhtsa.gov/nhtsa/downloads/FARS/{year}/National/FARS{year}NationalCSV.zip"
COUNTY_URL = "https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt"
CASE_URL = (
    "https://crashviewer.nhtsa.dot.gov/CrashAPI/crashes/GetCaseDetails"
    "?stateCase={case}&caseYear={year}&state={state}&format=json"
)

LGT = {
    "1": "daylight",
    "2": "dark, not lighted",
    "3": "dark, lighted",
    "4": "dawn",
    "5": "dusk",
    "6": "dark, unknown lighting",
    "7": "other",
    "8": "not reported",
    "9": "unknown",
}

FUNC = {
    "1": "interstate",
    "2": "freeway or expressway",
    "3": "principal arterial",
    "4": "minor arterial",
    "5": "major collector",
    "6": "minor collector",
    "7": "local",
}

# safetyeq.NMHELMET when that file is present in the zip.
HELMET = {
    "1": "no",
    "2": "yes",
    "8": "not reported",
    "9": "unknown",
}


def download(url: str) -> bytes:
    last: Exception | None = None
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as res:
                return res.read()
        except Exception as err:  # noqa: BLE001 — retry network and HTTP errors
            last = err
    raise RuntimeError(f"failed to download {url}: {last}")


def code(value: str | None) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text


def case_key(value: str | None) -> str:
    text = code(value).lstrip("0")
    return text or "0"


def open_zip_csv(blob: bytes, predicate) -> csv.DictReader | None:
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = [n for n in zf.namelist() if n.lower().endswith(".csv") and predicate(n.lower())]
        if not names:
            return None
        raw = zf.read(names[0])
    text = raw.decode("utf-8-sig", errors="replace")
    return csv.DictReader(io.StringIO(text))


def norm_row(row: dict) -> dict:
    return {str(k).strip().upper(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k}


def load_counties() -> dict[tuple[str, str], str]:
    try:
        raw = download(COUNTY_URL).decode("utf-8-sig", errors="replace")
    except Exception as err:  # noqa: BLE001
        print(f"[fars] county names unavailable ({err}); filings will use the county code", file=sys.stderr)
        return {}
    out: dict[tuple[str, str], str] = {}
    for line in raw.splitlines():
        if not line.strip() or line.lower().startswith("state"):
            continue
        parts = line.split("|") if "|" in line else line.split(",")
        if len(parts) < 4:
            continue
        # 2020 pipe file: STATE|STATEFP|COUNTYFP|COUNTYNS|COUNTYNAME|...
        if "|" in line and parts[1].isdigit() and len(parts) >= 5:
            statefp, countyfp, name = parts[1], parts[2], parts[4]
        elif parts[1].isdigit():
            statefp, countyfp, name = parts[1], parts[2], parts[3]
        elif parts[0].isdigit():
            statefp, countyfp, name = parts[0], parts[1], parts[2]
        else:
            continue
        label = name.strip()
        if label != "District of Columbia" and not any(
            label.endswith(suffix)
            for suffix in ("County", "Parish", "Borough", "Census Area", "Municipality", "City and Borough")
        ):
            label = f"{label} County"
        out[(statefp.zfill(2), countyfp.zfill(3))] = label
    print(f"[fars] county names {len(out)}")
    return out


def us_coord(value: str | None, kind: str) -> float | None:
    try:
        num = float(value) if value not in (None, "") else None
    except ValueError:
        return None
    if num is None:
        return None
    if kind == "lat" and not (17 <= num <= 72):
        return None
    if kind == "lon" and not (-180 <= num <= -65):
        return None
    return round(num, 5)


def build_year(year: int, counties: dict[tuple[str, str], str]) -> list[dict]:
    url = FARS_URL.format(year=year)
    print(f"[fars] downloading {year}")
    blob = download(url)
    accidents = open_zip_csv(blob, lambda name: "accident" in name and "auxiliary" not in name)
    people = open_zip_csv(blob, lambda name: name.endswith("/person.csv") or name.endswith("person.csv"))
    helmets = open_zip_csv(blob, lambda name: "safetyeq" in name)
    if accidents is None or people is None:
        raise RuntimeError(f"FARS {year} zip is missing accident.csv or person.csv")

    crash: dict[tuple[str, str], dict] = {}
    for raw in accidents:
        row = norm_row(raw)
        state = code(row.get("STATE")).zfill(2)
        case = case_key(row.get("ST_CASE"))
        if not case or state not in STATES:
            continue
        crash[(state, case)] = row

    helmet_by_person: dict[tuple[str, str, str], str] = {}
    if helmets is not None:
        for raw in helmets:
            row = norm_row(raw)
            if "NMHELMET" not in row:
                continue
            state = code(row.get("STATE")).zfill(2)
            case = case_key(row.get("ST_CASE"))
            per = code(row.get("PER_NO"))
            key = (state, case, per)
            if state and case and per and key not in helmet_by_person:
                helmet_by_person[key] = HELMET.get(code(row.get("NMHELMET")), "unknown")

    filings: list[dict] = []
    seen: set[str] = set()
    for raw in people:
        row = norm_row(raw)
        if code(row.get("PER_TYP")) not in PEDAL_TYPES:
            continue
        if code(row.get("INJ_SEV")) != "4":
            continue
        state = code(row.get("STATE")).zfill(2)
        case = case_key(row.get("ST_CASE"))
        per = code(row.get("PER_NO")) or "0"
        info = STATES.get(state)
        acc = crash.get((state, case))
        if not info or not acc:
            continue
        state_name, state_code = info
        month = code(acc.get("MONTH"))
        day = code(acc.get("DAY"))
        try:
            month_n = int(month)
            day_n = int(day)
        except ValueError:
            continue
        if not 1 <= month_n <= 12:
            continue
        date_precision = "day"
        if not 1 <= day_n <= 31:
            day_n = 1
            date_precision = "month"
        occurred = f"{year:04d}-{month_n:02d}-{day_n:02d}"
        county_code = code(acc.get("COUNTY")).zfill(3)
        county = counties.get((state, county_code))
        city = county if county else f"County {county_code}"
        lat = us_coord(acc.get("LATITUDE"), "lat")
        lon = us_coord(acc.get("LONGITUD") or acc.get("LONGITUDE"), "lon")
        per_typ = code(row.get("PER_TYP"))
        kind = "bicyclist" if per_typ == "6" else "other pedalcyclist"
        filing_id = f"fars-{year}-{case}-{per}"
        if filing_id in seen:
            continue
        seen.add(filing_id)
        place = f"{city}, {state_name}"
        band = age_band(row.get("AGE"))
        age_text = f" Age band on the person file: {band}." if band else ""
        summary = (
            f"NHTSA FARS {year} annual file records a {kind} killed on {occurred} in {place}. "
            f"Person type PER_TYP {per_typ}, fatal injury (INJ_SEV 4), case {case}."
            f"{age_text} FARS does not publish a name."
        )
        if date_precision == "month":
            summary += " The person file did not include a valid calendar day; the stored date is the first of the month."
        filings.append(
            {
                "id": filing_id,
                "title": f"{kind[:1].upper()}{kind[1:]} killed in {city}",
                "locationName": place,
                "occurredOn": occurred,
                "datePrecision": date_precision,
                "country": "United States",
                "countryCode": "USA",
                "state": state_name,
                "stateCode": state_code,
                "city": city,
                "region": REGIONS[state_code],
                "latitude": lat,
                "longitude": lon,
                "locationPrecision": "exact" if lat is not None and lon is not None else None,
                "crashType": "other",
                "outcome": "killed",
                "severity": "critical",
                "fatalities": 1,
                "injured": 0,
                "victimName": None,
                "victimAgeBand": band,
                "driverStatus": "unknown",
                "vehicleType": None,
                "roadwayType": FUNC.get(code(acc.get("FUNC_SYS"))),
                "lighting": LGT.get(code(acc.get("LGT_COND")), "unknown"),
                "helmet": helmet_by_person.get((state, case, per), "unknown"),
                "policeReportId": case,
                "summary": summary,
                "context": (
                    "Bulk federal fatality census. Coordinates are the FARS crash location when NHTSA published one. "
                    "This row is not a named curated report."
                ),
                "sourceName": "NHTSA FARS",
                "sourceUrl": CASE_URL.format(case=case, year=year, state=int(state)),
                "verified": True,
                "ingestSource": "fars",
                "reviewStatus": "published",
            }
        )
    print(f"[fars] {year} pedalcyclist fatalities {len(filings)}")
    return filings


def main() -> None:
    parser = argparse.ArgumentParser(description="Import FARS pedalcyclist fatalities")
    parser.add_argument("--years", type=int, nargs="*", default=DEFAULT_YEARS)
    args = parser.parse_args()
    counties = load_counties()
    rows: list[dict] = []
    by_year: dict[str, int] = {}
    for year in args.years:
        year_rows = build_year(year, counties)
        by_year[str(year)] = len(year_rows)
        rows.extend(year_rows)
    rows.sort(key=lambda row: (row["occurredOn"], row["id"]))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / "fars.json"
    dest.write_text(json.dumps(rows, ensure_ascii=False))
    update_manifest(
        "fars",
        {
            "file": "data/crash-imports/fars.json",
            "rows": len(rows),
            "byYear": by_year,
            "years": args.years,
            "latestCompleteYear": max(args.years) if args.years else None,
            "personTypes": ["6 Bicyclist", "7 Other pedalcyclist"],
            "injurySeverity": "4 fatal",
            "names": "not published; victimName is null",
            "verified": True,
            "earlyEstimate": {
                "usableForRows": False,
                "note": (
                    "NHTSA early estimates for 2025 (Crash Stats DOT HS 813 768 and 813 800) "
                    "report a pedalcyclist percentage change, not a person-level file. "
                    "GetCrashesByPerson requires an exact age, sex, seat, and injury, so it is not a census extract. "
                    "No 2025 FARS rows were created from those estimates."
                ),
            },
            "source": FARS_URL,
            "refresh": "python3 scripts/fetch-fars-cyclists.py && node scripts/load-crash-imports.mjs",
        },
    )
    print(f"[fars] wrote {len(rows)} rows to {dest}")


if __name__ == "__main__":
    main()
