/**
 * PennDOT counties drawn together on the Lancaster region traffic map.
 * County codes are PennDOT CTY_CODE values, confirmed against roadway
 * segments at Lancaster, York, Harrisburg, Lebanon, Reading, and West Chester.
 * Cecil and Harford counties, Maryland, also border Lancaster. They are not
 * listed here; this map stays on the PennDOT open-data services.
 * scripts/fetch-penndot-lancaster.py reads this list.
 */
export const PENNDOT_COUNTIES = [
  { code: "36", name: "Lancaster County" },
  { code: "66", name: "York County" },
  { code: "22", name: "Dauphin County" },
  { code: "38", name: "Lebanon County" },
  { code: "06", name: "Berks County" },
  { code: "15", name: "Chester County" },
];

export const PENNDOT_REGION_LABEL = "Lancaster region";

/** [west, south, east, north]. Union of those counties' RMS extents, padded. */
export const PENNDOT_REGION_BOUNDS = [-77.13, 39.7, -75.35, 40.68];

export const PENNDOT_PLACE_NAMES = new Set(PENNDOT_COUNTIES.map((county) => county.name));
