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
    attributeField?: string;
  };
  map?: {
    latitudeField?: string;
    longitudeField?: string;
    defaultZoom?: number;
  };
  dataSource?: {
    type: "supabase";
    url: string;
    serviceKeyEnv: string;
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
  attribute?: string | string[] | null;
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

type PizzazWidget = WidgetDefinition & {
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
      `[pizzaz] resolveAssetVariant hit direct file "${normalized}" -> ${directUrl.href}`
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
    `[pizzaz] resolveAssetVariant mapped "${normalized}" -> "${resolved}"`
  );
  return resolved;
}

const directoryConfig: DirectoryConfig = JSON.parse(
  readFileSync(new URL("./config/directory.json", serverRoot), "utf8")
);

const fallbackData: { items: DirectoryItem[] } = JSON.parse(
  readFileSync(new URL("./data/pizzaz-places.json", serverRoot), "utf8")
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
    const serviceKey = process.env[dataSource.serviceKeyEnv];

    if (!serviceKey) {
      console.warn(
        `Supabase key missing for env "${dataSource.serviceKeyEnv}". Falling back to bundled data.`
      );
    } else {
      try {
        if (!supabaseClient) {
          supabaseClient = createClient(dataSource.url, serviceKey, {
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
        if (locationFilter && filterConfig.locationField) {
          query.ilike(filterConfig.locationField, `%${locationFilter}%`);
        }

        const attributeFilter = filters?.attribute;
        if (attributeFilter && filterConfig.attributeField) {
          if (Array.isArray(attributeFilter)) {
            query.in(filterConfig.attributeField, attributeFilter);
          } else {
            query.eq(filterConfig.attributeField, attributeFilter);
          }
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
  const attributeFilter = filters?.attribute;

  return fallbackData.items.filter((item) => {
    let matchesLocation = true;
    if (locationFilter && filterConfig.locationField) {
      const value = getValueAtPath(item, filterConfig.locationField) ?? item[filterConfig.locationField];
      const valueString = value != null ? String(value).toLowerCase() : "";
      matchesLocation = valueString.includes(locationFilter);
    }

    let matchesAttribute = true;
    if (attributeFilter && filterConfig.attributeField) {
      const value = getValueAtPath(item, filterConfig.attributeField) ?? item[filterConfig.attributeField];
      if (Array.isArray(attributeFilter)) {
        matchesAttribute =
          value != null && attributeFilter.includes(String(value));
      } else {
        matchesAttribute = value != null && String(value) === String(attributeFilter);
      }
    }

    return matchesLocation && matchesAttribute;
  });
}

function widgetMeta(widget: PizzazWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true
  } as const;
}

console.log(`[pizzaz] Local assets directory: ${assetsRootUrl.href}`);

function extractAssetRevision(asset: string): string | null {
  const match = asset.match(/-([a-z0-9]+)\.[^.]+$/i);
  return match?.[1] ?? null;
}

function instantiateWidget(def: WidgetDefinition): PizzazWidget {
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

function buildWidgetHtml(widget: PizzazWidget) {
  const cssInline = widget.cssText;
  const jsInline = widget.jsText.replace(/<\/script/gi, "<\\/script");
  console.log(
    `[pizzaz] widget ${widget.id} embedded assets css=${widget.cssVariant} js=${widget.jsVariant}`
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
      // Build HTML once so asset URLs/logs are visible at startup.
      buildWidgetHtml(widget);
    });
  } catch (error) {
    console.warn("[pizzaz] Widget warmup failed", error);
  }
}

const widgetDefinitions: WidgetDefinition[] = [
  {
    id: "pizza-map",
    title: "Show Directory Map",
    templateUriBase: "ui://widget/directory-map.html",
    invoking: "Mapping the directory",
    invoked: "Rendered the directory map",
    rootId: "pizzaz-root",
    cssAsset: "pizzaz.css",
    jsAsset: "pizzaz.js",
    responseText: "Rendered a directory map!"
  },
  {
    id: "pizza-list",
    title: "Show Directory List",
    templateUriBase: "ui://widget/directory-list.html",
    invoking: "Listing directory items",
    invoked: "Rendered the directory list",
    rootId: "pizzaz-list-root",
    cssAsset: "pizzaz-list.css",
    jsAsset: "pizzaz-list.js",
    responseText: "Rendered a directory list!"
  },
  {
    id: "pizza-carousel",
    title: "Show Directory Carousel",
    templateUriBase: "ui://widget/directory-carousel.html",
    invoking: "Carousel some items",
    invoked: "Rendered the directory carousel",
    rootId: "pizzaz-carousel-root",
    cssAsset: "pizzaz-carousel.css",
    jsAsset: "pizzaz-carousel.js",
    responseText: "Rendered a directory carousel!"
  },
  {
    id: "pizza-albums",
    title: "Show Directory Album",
    templateUriBase: "ui://widget/directory-albums.html",
    invoking: "Hand-tossing an album",
    invoked: "Rendered the directory album",
    rootId: "pizzaz-albums-root",
    cssAsset: "pizzaz-albums.css",
    jsAsset: "pizzaz-albums.js",
    responseText: "Rendered a directory album!"
  }
];

const toolInputSchema = {
  type: "object",
  properties: {
    pizzaTopping: {
      type: "string",
      description: "Topping to mention when rendering the widget."
    },
    location: {
      type: "string",
      description: "Optional location or city filter."
    },
    attribute: {
      description: "Optional attribute filter such as price tier.",
      oneOf: [
        { type: "string" },
        {
          type: "array",
          items: { type: "string" }
        }
      ]
    }
  },
  required: ["pizzaTopping"],
  additionalProperties: false
} as const;

const toolInputParser = z.object({
  pizzaTopping: z.string(),
  location: z.string().optional(),
  attribute: z.union([z.string(), z.array(z.string())]).optional()
});

type WidgetState = {
  widgets: PizzazWidget[];
  widgetsById: Map<string, PizzazWidget>;
  widgetsByUri: Map<string, PizzazWidget>;
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
};

let widgetStateCache: WidgetState | null = null;

function buildWidgetState(): WidgetState {
  const widgets = widgetDefinitions.map(instantiateWidget);
  const widgetsById = new Map<string, PizzazWidget>();
  const widgetsByUri = new Map<string, PizzazWidget>();

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

function createPizzazServer(): Server {
  const server = new Server(
    {
      name: "pizzaz-node",
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
      attribute: args.attribute
    });

    return {
      content: [
        {
          type: "text",
          text: widget.responseText
        }
      ],
      structuredContent: {
        pizzaTopping: args.pizzaTopping,
        items,
        ui: directoryUi,
        directory: {
          label: directoryConfig.label,
          slug: directoryConfig.slug
        },
        appliedFilters: {
          location: args.location ?? null,
          attribute: args.attribute ?? null
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
  const server = createPizzazServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;
  console.log(`[pizzaz] Opening SSE session ${sessionId}`);

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    console.log(`[pizzaz] SSE session ${sessionId} closed`);
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
  console.log(`[pizzaz] POST /mcp/messages for session ${sessionId}`);

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
        `[pizzaz] Served asset "${assetPath}" as "${resolvedName}" (${contentType ?? "no content-type"})`
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
  console.log(`Pizzaz MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
  console.log(`  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`);
  console.log(`  Assets: GET http://localhost:${port}/assets/<file>`);
});
