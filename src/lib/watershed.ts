const USGS_WATERSHED_URL =
  "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/FeatureServer";

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

async function queryWatershedLayer(
  layerId: number,
  outFields: string,
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<ArcGisAttributes | null> {
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
    outFields,
    returnGeometry: "false",
    f: "json",
  });

  const response = await fetch(
    `${USGS_WATERSHED_URL}/${layerId}/query?${params.toString()}`,
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
      `USGS watershed service returned HTTP ${response.status}.`
    );
  }

  const result = (await response.json()) as ArcGisQueryResponse;

  if (result.error) {
    throw new Error(
      result.error.message || "The USGS watershed service returned an error."
    );
  }

  return result.features?.[0]?.attributes ?? null;
}

/**
 * Finds the national watershed information for a coordinate.
 * Coordinates use WGS84:
 * latitude = north/south, longitude = east/west.
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

  const [subwatershed, watershed, subbasin, basin] =
    await Promise.all([
      queryWatershedLayer(6, "name,huc12", latitude, longitude, signal),
      queryWatershedLayer(5, "name,huc10", latitude, longitude, signal),
      queryWatershedLayer(4, "name,huc8", latitude, longitude, signal),
      queryWatershedLayer(3, "name,huc6", latitude, longitude, signal),
    ]);

  if (!subwatershed && !watershed && !subbasin && !basin) {
    return null;
  }

  return {
    localName: cleanString(subwatershed?.name),
    localCode: cleanString(subwatershed?.huc12),
    broaderName: cleanString(watershed?.name),
    broaderCode: cleanString(watershed?.huc10),
    tributaryBasin: cleanString(basin?.name),
    hydrologicUnitCode: cleanString(subbasin?.huc8),
  };
}
