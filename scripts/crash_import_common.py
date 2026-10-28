"""Shared paths for the crash import scripts."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "crash-imports"
MANIFEST = OUT_DIR / "manifest.json"

# Census regions used by the crashes table.
REGIONS = {
    "CT": "Northeast",
    "ME": "Northeast",
    "MA": "Northeast",
    "NH": "Northeast",
    "RI": "Northeast",
    "VT": "Northeast",
    "NJ": "Northeast",
    "NY": "Northeast",
    "PA": "Northeast",
    "IL": "Midwest",
    "IN": "Midwest",
    "MI": "Midwest",
    "OH": "Midwest",
    "WI": "Midwest",
    "IA": "Midwest",
    "KS": "Midwest",
    "MN": "Midwest",
    "MO": "Midwest",
    "NE": "Midwest",
    "ND": "Midwest",
    "SD": "Midwest",
    "DE": "South",
    "FL": "South",
    "GA": "South",
    "MD": "South",
    "NC": "South",
    "SC": "South",
    "VA": "South",
    "WV": "South",
    "AL": "South",
    "KY": "South",
    "MS": "South",
    "TN": "South",
    "AR": "South",
    "LA": "South",
    "OK": "South",
    "TX": "South",
    "DC": "South",
    "AZ": "West",
    "CO": "West",
    "ID": "West",
    "MT": "West",
    "NV": "West",
    "NM": "West",
    "UT": "West",
    "WY": "West",
    "AK": "West",
    "CA": "West",
    "HI": "West",
    "OR": "West",
    "WA": "West",
}

# FIPS state code -> (name, postal).
STATES = {
    "01": ("Alabama", "AL"),
    "02": ("Alaska", "AK"),
    "04": ("Arizona", "AZ"),
    "05": ("Arkansas", "AR"),
    "06": ("California", "CA"),
    "08": ("Colorado", "CO"),
    "09": ("Connecticut", "CT"),
    "10": ("Delaware", "DE"),
    "11": ("District of Columbia", "DC"),
    "12": ("Florida", "FL"),
    "13": ("Georgia", "GA"),
    "15": ("Hawaii", "HI"),
    "16": ("Idaho", "ID"),
    "17": ("Illinois", "IL"),
    "18": ("Indiana", "IN"),
    "19": ("Iowa", "IA"),
    "20": ("Kansas", "KS"),
    "21": ("Kentucky", "KY"),
    "22": ("Louisiana", "LA"),
    "23": ("Maine", "ME"),
    "24": ("Maryland", "MD"),
    "25": ("Massachusetts", "MA"),
    "26": ("Michigan", "MI"),
    "27": ("Minnesota", "MN"),
    "28": ("Mississippi", "MS"),
    "29": ("Missouri", "MO"),
    "30": ("Montana", "MT"),
    "31": ("Nebraska", "NE"),
    "32": ("Nevada", "NV"),
    "33": ("New Hampshire", "NH"),
    "34": ("New Jersey", "NJ"),
    "35": ("New Mexico", "NM"),
    "36": ("New York", "NY"),
    "37": ("North Carolina", "NC"),
    "38": ("North Dakota", "ND"),
    "39": ("Ohio", "OH"),
    "40": ("Oklahoma", "OK"),
    "41": ("Oregon", "OR"),
    "42": ("Pennsylvania", "PA"),
    "44": ("Rhode Island", "RI"),
    "45": ("South Carolina", "SC"),
    "46": ("South Dakota", "SD"),
    "47": ("Tennessee", "TN"),
    "48": ("Texas", "TX"),
    "49": ("Utah", "UT"),
    "50": ("Vermont", "VT"),
    "51": ("Virginia", "VA"),
    "53": ("Washington", "WA"),
    "54": ("West Virginia", "WV"),
    "55": ("Wisconsin", "WI"),
    "56": ("Wyoming", "WY"),
}


def update_manifest(key: str, info: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    current = {}
    if MANIFEST.exists():
        current = json.loads(MANIFEST.read_text())
    current[key] = info
    MANIFEST.write_text(json.dumps(current, indent=2) + "\n")


def age_band(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        age = int(float(value))
    except ValueError:
        return None
    if age < 0 or age >= 120:
        return None
    if age >= 90:
        return "90+"
    start = (age // 10) * 10
    return f"{start}–{start + 9}"
