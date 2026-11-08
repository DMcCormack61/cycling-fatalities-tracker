export type GoogleMapsPlace = {
  latitude?: number | string | null;
  longitude?: number | string | null;
  locationName?: string | null;
  city?: string | null;
  state?: string | null;
};

/** Coordinate search when a pin is filed; otherwise an encoded place query. Null when neither exists. */
export function googleMapsSearchUrl(place: GoogleMapsPlace | null | undefined): string | null;
