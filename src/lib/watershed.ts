
const WATERSHED_QUERY_URL =
  "https://mdgeodata.md.gov/imap/rest/services/Hydrology/MD_Watersheds/MapServer/2/query";

export type WatershedInfo = {
  localName: string | null;
  localCode: string | null;
  broaderName: string | null;
  broaderCode: string | null;
  tributaryBasin: string | null;
  hydrologicUnitCode: string | null;
};

type ArcGisAttributes = Record<string, unknown>;

type ArcGisQueryResponse = {
  features?: Array<{
    attributes?: ArcGisAttributes;
  }>;
  error?: {
    message?: string;
    details?: string[];
  };
};

function cleanString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const result = String(value).trim();
  return result.length > 0 ? result : null;
}

/**
 * Finds the Maryland watershed polygon that contains a coordinate.
 *
 * Coordinates must be WGS84:
 * latitude = north/south, longitude = east/west.
 *
 * Returns null when no matching polygon is found.
 * Throws when the request fails, allowing the UI to show an error.
 */
export async function lookupWatershedAtPoint(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<WatershedInfo | null> {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid latitude or longitude.");
  }

  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      x: longitude,
      y: latitude,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields:
      "dnr12dig,mde8name,mde8digt,mde6name,mde6digt,straname,hua14,hua11,hua8",
    returnGeometry: "false",
    f: "json",
  });

  const response = await fetch(
    `${WATERSHED_QUERY_URL}?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Watershed service returned HTTP ${response.status}.`
    );
  }

  const result = (await response.json()) as ArcGisQueryResponse;

  if (result.error) {
    throw new Error(
      result.error.message || "The watershed service returned an error."
    );
  }

  const attributes = result.features?.[0]?.attributes;

  if (!attributes) {
    return null;
  }

  return {
    localName: cleanString(attributes.mde8name),
    localCode: cleanString(attributes.dnr12dig),
    broaderName: cleanString(attributes.mde6name),
    broaderCode: cleanString(attributes.mde6digt),
    tributaryBasin: cleanString(attributes.straname),
    hydrologicUnitCode:
      cleanString(attributes.hua14) ??
      cleanString(attributes.hua11) ??
      cleanString(attributes.hua8),
  };
}
