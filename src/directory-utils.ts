type DirectoryFields = Record<string, string | undefined>;
type MapConfig = {
  latitudeField?: string;
  longitudeField?: string;
  defaultZoom?: number;
};

type DirectoryUi = {
  theme?: Record<string, string | undefined>;
  fields?: Record<string, string | undefined>;
  copy?: Record<string, string | undefined>;
  map?: MapConfig;
};

export function resolvePathValue(
  item: Record<string, unknown>,
  path?: string
): unknown {
  if (!item || !path) return undefined;
  const segments = path.split(".");
  let current: any = item;
  for (const segment of segments) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
      continue;
    }
    current = current[segment];
  }
  return current;
}

export function getFieldValue<T = unknown>(
  item: Record<string, unknown>,
  fields: DirectoryFields | undefined,
  key: string,
  fallback?: T
): T | undefined {
  const candidate = resolvePathValue(item, fields?.[key]);
  if (candidate !== undefined && candidate !== null) {
    return candidate as T;
  }
  const direct = item[key];
  if (direct !== undefined && direct !== null) {
    return direct as T;
  }
  return fallback;
}

export function getCoordinates(
  item: Record<string, unknown>,
  mapConfig: MapConfig | undefined
): [number, number] | null {
  const lat = resolvePathValue(item, mapConfig?.latitudeField);
  const lng = resolvePathValue(item, mapConfig?.longitudeField);

  const parseNumber = (value: unknown) => {
    const num =
      typeof value === "string" ? Number.parseFloat(value) : (value as number);
    return Number.isFinite(num) ? num : null;
  };

  if (lat !== undefined && lng !== undefined) {
    const parsedLat = parseNumber(lat);
    const parsedLng = parseNumber(lng);
    if (parsedLat != null && parsedLng != null) {
      return [parsedLng, parsedLat];
    }
  }

  const coords = item.coords;
  if (Array.isArray(coords) && coords.length >= 2) {
    const parsedLng = parseNumber(coords[0]);
    const parsedLat = parseNumber(coords[1]);
    if (parsedLat != null && parsedLng != null) {
      return [parsedLng, parsedLat];
    }
  }

  if (coords && typeof coords === "object") {
    const { lat: objLat, latitude, lng: objLng, lon, long, longitude } =
      coords as Record<string, unknown>;
    const parsedLat =
      parseNumber(objLat ?? latitude) ?? parseNumber((coords as any)[1]);
    const parsedLng =
      parseNumber(objLng ?? lon ?? long ?? longitude) ??
      parseNumber((coords as any)[0]);
    if (parsedLat != null && parsedLng != null) {
      return [parsedLng, parsedLat];
    }
  }

  return null;
}

export function themeStyleVars(theme?: Record<string, string | undefined>) {
  if (!theme) return {};
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme)) {
    if (typeof value === "string" && value.trim()) {
      style[`--directory-${key}`] = value;
    }
  }
  return style;
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export type NormalizedDirectoryItem = {
  id: string;
  coords: [number, number] | null;
  title: string;
  subtitle?: string;
  description?: string;
  rating?: number | null;
  price?: string | null;
  thumbnail?: string | null;
  raw: Record<string, unknown>;
};

export function normalizeDirectoryItems(
  items: Record<string, unknown>[],
  ui: DirectoryUi
): NormalizedDirectoryItem[] {
  const fields = ui.fields ?? {};
  const mapConfig = ui.map;

  return items
    .map((item) => {
      const id = String(item.id ?? "");
      if (!id) return null;

      const coords = getCoordinates(item, mapConfig);
      const title =
        String(
          getFieldValue(item, fields, "title") ??
            item.name ??
            item.title ??
            "Untitled"
        ) || "Untitled";
      const subtitle = getFieldValue<string>(item, fields, "subtitle");
      const description = getFieldValue<string>(item, fields, "description");
      const rating = toNumber(getFieldValue(item, fields, "rating"));
      const price = getFieldValue<string>(item, fields, "price");
      const thumbnail = getFieldValue<string>(item, fields, "thumbnail");

      const normalized: NormalizedDirectoryItem = {
        id,
        coords,
        title,
        raw: item
      };

      if (subtitle != null && subtitle !== "") {
        normalized.subtitle = subtitle;
      }
      if (description != null && description !== "") {
        normalized.description = description;
      }
      if (rating != null) {
        normalized.rating = rating;
      }
      if (price != null && price !== "") {
        normalized.price = price;
      }
      if (thumbnail != null && thumbnail !== "") {
        normalized.thumbnail = thumbnail;
      }

      return normalized;
    })
    .filter((item): item is NormalizedDirectoryItem => item !== null);
}
