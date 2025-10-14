import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { URL } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type DirectoryConfig = {
  label: string;
  slug: string;
  theme?: Record<string, string>;
  copy?: Record<string, string>;
  fields?: Record<string, string>;
  filters?: {
    locationField?: string;
    locationFields?: string[];
    attributeField?: string;
    priceField?: string;
    ratingField?: string;
  };
  map?: {
    latitudeField?: string;
    longitudeField?: string;
    defaultZoom?: number;
  };
  dataSource?: {
    type: "supabase";
    url?: string;
    table: string;
    select?: string;
    orderBy?: {
      column: string;
      ascending?: boolean;
    };
  };
};

type DirectoryItem = Record<string, unknown> & {
  id: string;
};

function hasStringId(value: unknown): value is DirectoryItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = (value as { id?: unknown }).id;
  return typeof candidate === "string";
}

type DirectoryFilterInput = {
  location?: string | null;
  price?: string | string[] | null;
  minRating?: number | null;
  limit?: number | null;
};

type WidgetDefinition = {
  id: string;
  title: string;
  templateUriBase: string;
  invoking: string;
  invoked: string;
  rootId: string;
  cssAsset: string;
  jsAsset: string;
  responseText: string;
};

type DirectoryWidget = WidgetDefinition & {
  templateUri: string;
  cssVariant: string;
  jsVariant: string;
  cssText: string;
  jsText: string;
};

const serverRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../", serverRoot);
const assetsRootUrl = new URL("./assets/", repoRoot);
const assetVariantCache = new Map<string, string>();

function normalizeAssetPath(assetPath: string): string {
  return assetPath.replace(/\\/g, "/").replace(/^\//, "");
}

function resolveAssetVariant(assetPath: string): string {
  const normalized = normalizeAssetPath(assetPath);

  if (normalized.includes("..")) {
    throw Object.assign(new Error(`Invalid asset path: ${assetPath}`), { code: "ENOENT" });
  }

  const directUrl = new URL(normalized, assetsRootUrl);
  if (existsSync(directUrl)) {
    assetVariantCache.set(normalized, normalized);
    console.log(
      `[directory] resolveAssetVariant hit direct file "${normalized}" -> ${directUrl.href}`
    );
    return normalized;
  }

  const cached = assetVariantCache.get(normalized);
  if (cached && cached !== normalized) {
    const cachedUrl = new URL(cached, assetsRootUrl);
    if (existsSync(cachedUrl)) {
      return cached;
    }
    assetVariantCache.delete(normalized);
  }

  const lastSlash = normalized.lastIndexOf("/");
  const directory = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "";
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const dot = fileName.lastIndexOf(".");

  if (dot === -1) {
    throw Object.assign(new Error(`Unsupported asset: ${assetPath}`), { code: "ENOENT" });
  }

  const base = fileName.slice(0, dot);
  const extWithDot = fileName.slice(dot);
  const searchDirUrl = directory ? new URL(`${directory}/`, assetsRootUrl) : assetsRootUrl;
  let entries: string[];
  try {
    entries = readdirSync(searchDirUrl);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return normalized;
    }
    throw error;
  }
  const matcherPrefix = `${base}-`;
  const match = entries.find(
    (entry) => entry.startsWith(matcherPrefix) && entry.endsWith(extWithDot)
  );

  if (!match) {
    throw Object.assign(new Error(`Asset not found for ${assetPath}`), { code: "ENOENT" });
  }

  const resolved = directory ? `${directory}/${match}` : match;
  assetVariantCache.set(normalized, resolved);
  console.log(
    `[directory] resolveAssetVariant mapped "${normalized}" -> "${resolved}"`
  );
  return resolved;
}

const directoryConfig: DirectoryConfig = JSON.parse(
  readFileSync(new URL("./config/directory.json", serverRoot), "utf8")
);

const fallbackData: { items: DirectoryItem[] } = JSON.parse(
  readFileSync(new URL("./data/directory-places.json", serverRoot), "utf8")
);

const directoryUi = {
  theme: directoryConfig.theme ?? {},
  copy: directoryConfig.copy ?? {},
  fields: directoryConfig.fields ?? {},
  map: directoryConfig.map ?? {}
};

let supabaseClient: SupabaseClient | null = null;

function getValueAtPath(record: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const segments = path.split(".");
  let current: any = record;
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

async function fetchDirectoryItems(
  filters?: DirectoryFilterInput
): Promise<DirectoryItem[]> {
  const dataSource = directoryConfig.dataSource;

  if (dataSource?.type === "supabase") {
    const supabaseUrl = process.env.SUPABASE_URL ?? dataSource.url;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      const missingParts = [
        !supabaseUrl ? "Supabase URL" : null,
        !serviceKey ? "service role key" : null
      ]
        .filter(Boolean)
        .join(" and ");
      console.warn(
        `Supabase configuration missing (${missingParts}). Falling back to bundled data.`
      );
    } else {
      try {
        if (!supabaseClient) {
          supabaseClient = createClient(supabaseUrl, serviceKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false
            }
          });
        }

        const query = supabaseClient
          .from(dataSource.table)
          .select(dataSource.select ?? "*");

        const filterConfig = directoryConfig.filters ?? {};
        const locationFilter = filters?.location?.trim();
        const locationFields =
          Array.isArray(filterConfig.locationFields) && filterConfig.locationFields.length > 0
            ? filterConfig.locationFields
            : filterConfig.locationField
              ? [filterConfig.locationField]
              : [];
        if (locationFilter && locationFields.length > 0) {
          if (locationFields.length === 1) {
            query.ilike(locationFields[0], `%${locationFilter}%`);
          } else {
            const orClause = locationFields
              .map((field) => `${field}.ilike.%${locationFilter}%`)
              .join(",");
            query.or(orClause);
          }
        }

        const priceField = filterConfig.priceField ?? filterConfig.attributeField;
        const priceFilter = filters?.price;
        if (priceFilter && priceField) {
          if (Array.isArray(priceFilter)) {
            query.in(priceField, priceFilter);
          } else {
            query.eq(priceField, priceFilter);
          }
        }

        const ratingFilter = filters?.minRating;
        if (typeof ratingFilter === "number" && filterConfig.ratingField) {
          query.gte(filterConfig.ratingField, ratingFilter);
        }

        if (filters?.limit && Number.isFinite(filters.limit)) {
          query.limit(Math.max(1, Math.min(100, filters.limit)));
        }

        if (dataSource.orderBy?.column) {
          query.order(dataSource.orderBy.column, {
            ascending: dataSource.orderBy.ascending ?? true
          });
        }

        const { data, error } = await query;

        if (error) {
          console.error("Supabase fetch failed:", error);
        } else if (Array.isArray(data)) {
          const rows = data as unknown[];
          return rows.filter(hasStringId);
        }
      } catch (error) {
        console.error("Supabase query error", error);
      }
    }
  }

  const filterConfig = directoryConfig.filters ?? {};
  const locationFilter = filters?.location?.trim()?.toLowerCase();
  const locationFields =
    Array.isArray(filterConfig.locationFields) && filterConfig.locationFields.length > 0
      ? filterConfig.locationFields
      : filterConfig.locationField
        ? [filterConfig.locationField]
        : [];
  const priceField = filterConfig.priceField ?? filterConfig.attributeField;
  const priceFilter = filters?.price;
  const ratingFilter = filters?.minRating;
  const limit = filters?.limit;

  const filtered = fallbackData.items.filter((item) => {
    let matchesLocation = true;
    if (locationFilter && locationFields.length > 0) {
      matchesLocation = locationFields.some((field) => {
        const value = getValueAtPath(item, field) ?? (item as Record<string, unknown>)[field];
        const valueString = value != null ? String(value).toLowerCase() : "";
        return valueString.includes(locationFilter);
      });
    }

    let matchesPrice = true;
    if (priceFilter && priceField) {
      const value = getValueAtPath(item, priceField) ?? (item as Record<string, unknown>)[priceField];
      if (Array.isArray(priceFilter)) {
        matchesPrice = value != null && priceFilter.includes(String(value));
      } else {
        matchesPrice = value != null && String(value) === String(priceFilter);
      }
    }

    let matchesRating = true;
    if (typeof ratingFilter === "number" && filterConfig.ratingField) {
      const value = getValueAtPath(item, filterConfig.ratingField) ?? (item as Record<string, unknown>)[filterConfig.ratingField];
      const numericValue =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number.parseFloat(value)
            : null;
      matchesRating = numericValue != null && Number.isFinite(numericValue) && numericValue >= ratingFilter;
    }

    return matchesLocation && matchesPrice && matchesRating;
  });

  if (limit && Number.isFinite(limit)) {
    return filtered.slice(0, Math.max(0, Math.min(100, limit)));
  }

  return filtered;
}

function widgetMeta(widget: DirectoryWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true
  } as const;
}

console.log(`[directory] Local assets directory: ${assetsRootUrl.href}`);

function extractAssetRevision(asset: string): string | null {
  const match = asset.match(/-([a-z0-9]+)\.[^.]+$/i);
  return match?.[1] ?? null;
}

function instantiateWidget(def: WidgetDefinition): DirectoryWidget {
  let cssVariant = def.cssAsset;
  let jsVariant = def.jsAsset;
  let cssText = "";
  let jsText = "";

  try {
    cssVariant = resolveAssetVariant(def.cssAsset);
    cssText = readFileSync(new URL(cssVariant, assetsRootUrl), "utf8");
  } catch (error) {
    console.warn(`Failed to resolve CSS asset for ${def.id}`, error);
  }

  try {
    jsVariant = resolveAssetVariant(def.jsAsset);
    jsText = readFileSync(new URL(jsVariant, assetsRootUrl), "utf8");
  } catch (error) {
    console.warn(`Failed to resolve JS asset for ${def.id}`, error);
  }

  const revision =
    extractAssetRevision(jsVariant) ??
    extractAssetRevision(cssVariant) ??
    "dev";
  const templateUri =
    revision && !def.templateUriBase.includes("?")
      ? `${def.templateUriBase}?rev=${revision}`
      : `${def.templateUriBase}&rev=${revision}`;

  return {
    ...def,
    templateUri,
    cssVariant,
    jsVariant,
    cssText,
    jsText
  };
}

function buildWidgetHtml(widget: DirectoryWidget) {
  const cssInline = widget.cssText;
  const jsInline = widget.jsText.replace(/<\/script/gi, "<\\/script");
  console.log(
    `[directory] widget ${widget.id} embedded assets css=${widget.cssVariant} js=${widget.jsVariant}`
  );

  return `
<div id="${widget.rootId}"></div>
<style>${cssInline}</style>
<script type="module">
${jsInline}
</script>
  `.trim();
}

function warmupWidgetAssets() {
  try {
    const { widgets } = ensureWidgetState();
    widgets.forEach((widget) => {
      buildWidgetHtml(widget);
    });
  } catch (error) {
    console.warn("[directory] Widget warmup failed", error);
  }
}

const widgetDefinitions: WidgetDefinition[] = [
  {
    id: "directory-map",
    title: "Show Directory Map",
    templateUriBase: "ui://widget/directory-map.html",
    invoking: "Mapping the directory",
    invoked: "Rendered the directory map",
    rootId: "directory-map-root",
    cssAsset: "directory-map.css",
    jsAsset: "directory-map.js",
    responseText: "Rendered a directory map!"
  },
  {
    id: "directory-list",
    title: "Show Directory List",
    templateUriBase: "ui://widget/directory-list.html",
    invoking: "Listing directory items",
    invoked: "Rendered the directory list",
    rootId: "directory-list-root",
    cssAsset: "directory-list.css",
    jsAsset: "directory-list.js",
    responseText: "Rendered a directory list!"
  },
  {
    id: "directory-carousel",
    title: "Show Directory Carousel",
    templateUriBase: "ui://widget/directory-carousel.html",
    invoking: "Carousel some items",
    invoked: "Rendered the directory carousel",
    rootId: "directory-carousel-root",
    cssAsset: "directory-carousel.css",
    jsAsset: "directory-carousel.js",
    responseText: "Rendered a directory carousel!"
  },
  {
    id: "directory-albums",
    title: "Show Directory Album",
    templateUriBase: "ui://widget/directory-albums.html",
    invoking: "Rendering the directory album",
    invoked: "Rendered the directory album",
    rootId: "directory-albums-root",
    cssAsset: "directory-albums.css",
    jsAsset: "directory-albums.js",
    responseText: "Rendered a directory album!"
  }
];

const toolInputSchema = {
  type: "object",
  properties: {
    resultsTitle: {
      type: "string",
      description: "Optional title to display above the directory results."
    },
    location: {
      type: "string",
      description: "Optional location, city, or neighborhood filter."
    },
    price: {
      description: "Optional price tier filter such as $, $$.",
      oneOf: [
        { type: "string" },
        {
          type: "array",
          items: { type: "string" }
        }
      ]
    },
    minRating: {
      type: "number",
      description: "Optional minimum rating (0-5)."
    },
    limit: {
      type: "number",
      minimum: 1,
      maximum: 100,
      description: "Optional maximum number of items to return (defaults to all)."
    }
  },
  required: [],
  additionalProperties: false
} as const;

const toolInputParser = z.object({
  resultsTitle: z.string().optional(),
  location: z.string().optional(),
  price: z.union([z.string(), z.array(z.string())]).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

type WidgetState = {
  widgets: DirectoryWidget[];
  widgetsById: Map<string, DirectoryWidget>;
  widgetsByUri: Map<string, DirectoryWidget>;
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
};

let widgetStateCache: WidgetState | null = null;

function buildWidgetState(): WidgetState {
  const widgets = widgetDefinitions.map(instantiateWidget);
  const widgetsById = new Map<string, DirectoryWidget>();
  const widgetsByUri = new Map<string, DirectoryWidget>();

  widgets.forEach((widget) => {
    widgetsById.set(widget.id, widget);
    widgetsByUri.set(widget.templateUri, widget);
  });

  const tools: Tool[] = widgets.map((widget) => ({
    name: widget.id,
    description: widget.title,
    inputSchema: toolInputSchema,
    title: widget.title,
    _meta: widgetMeta(widget)
  }));

  const resources: Resource[] = widgets.map((widget) => ({
    uri: widget.templateUri,
    name: widget.title,
    description: `${widget.title} widget markup`,
    mimeType: "text/html+skybridge",
    _meta: widgetMeta(widget)
  }));

  const resourceTemplates: ResourceTemplate[] = widgets.map((widget) => ({
    uriTemplate: widget.templateUri,
    name: widget.title,
    description: `${widget.title} widget markup`,
    mimeType: "text/html+skybridge",
    _meta: widgetMeta(widget)
  }));

  return {
    widgets,
    widgetsById,
    widgetsByUri,
    tools,
    resources,
    resourceTemplates
  };
}

function ensureWidgetState(): WidgetState {
  if (!widgetStateCache) {
    widgetStateCache = buildWidgetState();
  }
  return widgetStateCache;
}

warmupWidgetAssets();

function createDirectoryServer(): Server {
  const server = new Server(
    {
      name: "directory-node",
      version: "0.2.0"
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async (_request: ListResourcesRequest) => {
    const { resources } = ensureWidgetState();
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const { widgetsByUri } = ensureWidgetState();
    const widget = widgetsByUri.get(request.params.uri);

    if (!widget) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }

    return {
      contents: [
        {
          uri: widget.templateUri,
          mimeType: "text/html+skybridge",
          text: buildWidgetHtml(widget),
          _meta: widgetMeta(widget)
        }
      ]
    };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async (_request: ListResourceTemplatesRequest) => {
    const { resourceTemplates } = ensureWidgetState();
    return { resourceTemplates };
  });

  server.setRequestHandler(ListToolsRequestSchema, async (_request: ListToolsRequest) => {
    const { tools } = ensureWidgetState();
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { widgetsById } = ensureWidgetState();
    const widget = widgetsById.get(request.params.name);

    if (!widget) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const args = toolInputParser.parse(request.params.arguments ?? {});
    const items = await fetchDirectoryItems({
      location: args.location,
      price: args.price,
      minRating: args.minRating ?? null,
      limit: args.limit ?? null
    });

    return {
      content: [
        {
          type: "text",
          text: widget.responseText
        }
      ],
      structuredContent: {
        resultsTitle: args.resultsTitle ?? null,
        items,
        ui: directoryUi,
        directory: {
          label: directoryConfig.label,
          slug: directoryConfig.slug
        },
        appliedFilters: {
          location: args.location ?? null,
          price: args.price ?? null,
          minRating: args.minRating ?? null,
          limit: args.limit ?? null
        }
      },
      _meta: widgetMeta(widget)
    };
  });

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";

async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createDirectoryServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;
  console.log(`[directory] Opening SSE session ${sessionId}`);

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    console.log(`[directory] SSE session ${sessionId} closed`);
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);
  console.log(`[directory] POST /mcp/messages for session ${sessionId}`);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && (url.pathname === ssePath || url.pathname === postPath)) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === ssePath) {
    await handleSseRequest(res);
    return;
  }

  if (req.method === "POST" && url.pathname === postPath) {
    await handlePostMessage(req, res, url);
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/assets/")) {
    try {
      const assetPath = url.pathname.replace("/assets/", "");
      const resolvedName = resolveAssetVariant(assetPath);
      const fileUrl = new URL(resolvedName, assetsRootUrl);
      const fileContents = readFileSync(fileUrl);
      const ext = resolvedName.split(".").pop() ?? "";
      const mimeMap: Record<string, string> = {
        css: "text/css; charset=utf-8",
        js: "text/javascript; charset=utf-8",
        html: "text/html; charset=utf-8",
        map: "application/json; charset=utf-8"
      };
      const contentType = mimeMap[ext];
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      console.log(
        `[directory] Served asset "${assetPath}" as "${resolvedName}" (${contentType ?? "no content-type"})`
      );
      res.writeHead(200);
      if (req.method === "HEAD") {
        res.end();
      } else {
        res.end(fileContents);
      }
      return;
    } catch (error) {
      console.error(`Failed to serve asset "${url.pathname}"`, error);
      res.writeHead(404).end("Asset not found");
      return;
    }
  }

  res.writeHead(404).end("Not Found");
});

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
  console.log(`Directory MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
  console.log(`  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`);
  console.log(`  Assets: GET http://localhost:${port}/assets/<file>`);
});
