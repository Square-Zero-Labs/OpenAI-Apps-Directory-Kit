import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fg from "fast-glob";
import path from "node:path";
import fs from "node:fs";
import tailwindcss from "@tailwindcss/vite";

// @ts-ignore Runtime helper implemented in JavaScript only
const directoryConfigModule = await import("./scripts/directory-config.mjs");
const { syncDirectoryConfig, directoryConfigPaths } =
  directoryConfigModule as typeof import("./scripts/directory-config-types");

function buildInputs() {
  const files = fg.sync("src/**/index.{tsx,jsx}", { dot: false });
  return Object.fromEntries(
    files.map((f) => [path.basename(path.dirname(f)), path.resolve(f)])
  );
}

const toFs = (abs: string) => "/@fs/" + abs.replace(/\\/g, "/");

const toServerRoot = (abs: string) => {
  const rel = path.relative(process.cwd(), abs).replace(/\\/g, "/");
  // If it's not really relative (different drive or absolute), fall back to fs URL
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return toFs(abs);
  return "./" + rel;
};

function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

function buildDevStructuredContent(): Record<string, unknown> | null {
  try {
    const configRaw = fs.readFileSync(directoryConfigPaths.config, {
      encoding: "utf8",
    });
    const dataRaw = fs.readFileSync(directoryConfigPaths.data, {
      encoding: "utf8",
    });

    const config = JSON.parse(configRaw) as Record<string, any>;
    const data = JSON.parse(dataRaw) as Record<string, any>;

    const ui = {
      theme: config?.theme ?? {},
      copy: config?.copy ?? {},
      branding: config?.branding ?? {},
      fields: config?.fields ?? {},
      map: config?.map ?? {},
      filters: config?.filters ?? {},
    } satisfies Record<string, unknown>;

    const items = Array.isArray(data?.items) ? data.items : [];

    const resultsTitle =
      config?.copy?.listTitle ??
      config?.copy?.appTitle ??
      config?.label ??
      "Directory Results";

    const structured: Record<string, unknown> = {
      resultsTitle,
      items,
      ui,
    };

    if (config?.label || config?.slug) {
      structured.directory = {
        label: config?.label ?? null,
        slug: config?.slug ?? null,
      };
    }

    return structured;
  } catch (error) {
    console.warn("[directory] Failed to load dev tool output", error);
    return null;
  }
}

function multiEntryDevEndpoints(options: {
  entries: Record<string, string>;
  globalCss?: string[];
  perEntryCssGlob?: string;
  perEntryCssIgnore?: string[];
  getDevToolOutput?: () => Record<string, unknown> | null;
}): Plugin {
  const {
    entries,
    globalCss = ["src/index.css"],
    perEntryCssGlob = "**/*.{css,pcss,scss,sass}",
    perEntryCssIgnore = ["**/*.module.*"],
    getDevToolOutput,
  } = options;

  const V_PREFIX = "\0multi-entry:"; // Rollup “virtual module” prefix

  const HIDE_FROM_HOME = new Set(["flashcards", "daw"]);

  const renderIndexHtml = (names: string[]): string => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ecosystem ui examples</title>
  <style>
    body { font: 15px/1.5 system-ui, sans-serif; margin: 32px; color: #1f2933; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    ul { padding-left: 18px; }
    li { margin-bottom: 6px; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; margin-left: 6px; color: #64748b; }
  </style>
</head>
<body>
  <h1>Examples</h1>
  <ul>
    ${names
      .filter((n) => !HIDE_FROM_HOME.has(n))
      .toSorted()
      .map(
        (name) =>
          `<li><a href="/${name}.html">${name}</a><code>/${name}.html</code></li>`
      )
      .join("\n    ")}
  </ul>
</body>
</html>`;

  const renderDevHtml = (name: string, toolOutputScript: string | null): string => `<!doctype html>
<html>
<head>
  ${toolOutputScript ?? ""}
  <script type="module" src="/${name}.js"></script>
  <link rel="stylesheet" href="/${name}.css">
  </head>
<body>
  <div id="${name}-root"></div>
</body>
</html>`;

  return {
    name: "multi-entry-dev-endpoints",
    configureServer(server) {
      const names = Object.keys(entries);
      const list = names
        .map((n) => `/${n}.html, /${n}.js, /${n}.css`)
        .join("\n  ");
      server.config.logger.info(`\nDev endpoints:\n  ${list}\n`);

      const toolScriptForRequest = (): string | null => {
        if (server.config.command !== "serve") return null;
        const injected = getDevToolOutput?.();
        if (!injected) return null;
        const toolOutputJson = serializeForScript(injected);
        return `<script>\n(function(){\n  const toolOutput = ${toolOutputJson};\n  window.__DIRECTORY_DEV_TOOL_OUTPUT__ = toolOutput;\n  window.openai = window.openai ?? {};\n  if (!window.openai.toolOutput) {\n    window.openai.toolOutput = toolOutput;\n  }\n  window.openai.displayMode = window.openai.displayMode ?? "inline";\n  window.openai.maxHeight = window.openai.maxHeight ?? 640;\n  window.openai.theme = window.openai.theme ?? "light";\n  window.oai = window.oai ?? {};\n  if (!window.oai.toolOutput) {\n    window.oai.toolOutput = toolOutput;\n  }\n})();\n</script>`;
      };

      server.middlewares.use((req, res, next) => {
        try {
          if (req.method !== "GET" || !req.url) return next();
          const url = req.url.split("?")[0];
          if (url === "/" || url === "" || url === "/index.html") {
            const html = renderIndexHtml(names);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            return;
          }
          const bareMatch = url.match(/^\/?([\w-]+)\/?$/);
          if (bareMatch && entries[bareMatch[1]]) {
            const name = bareMatch[1];
            const toolScript = toolScriptForRequest();
            const html = renderDevHtml(name, toolScript);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            return;
          }

          if (!url.endsWith(".html")) return next();

          const m = url.match(/^\/?([\w-]+)\.html$/);
          if (!m) return next();
          const name = m[1];
          if (!entries[name]) return next();

          const toolScript = toolScriptForRequest();
          const html = renderDevHtml(name, toolScript);
          res.setHeader("Content-Type", "text/html");
          res.end(html);
          return;
        } catch {
          // fall through
        }
        next();
      });
    },
    resolveId(id: string) {
      // Map request paths to virtual ids
      if (id.startsWith("/")) id = id.slice(1);
      if (id.endsWith(".js")) {
        const name = id.slice(0, -3);
        if (entries[name]) return `${V_PREFIX}entry:${name}`;
      }
      if (id.endsWith(".css")) {
        const name = id.slice(0, -4);
        if (entries[name]) return `${V_PREFIX}style:${name}.css`;
      }
      if (id.startsWith(V_PREFIX)) return id;
      return null;
    },
    load(id: string) {
      if (!id.startsWith(V_PREFIX)) return null;

      const rest = id.slice(V_PREFIX.length); // "entry:foo" or "style:foo.css"
      const [kind, nameWithExt] = rest.split(":", 2);
      const name = nameWithExt.replace(/\.css$/, "");
      const entry = entries[name];
      if (!entry) return null;

      const entryDir = path.dirname(entry);

      // Collect CSS (global first for stable cascade)
      const globals = globalCss
        .map((p) => path.resolve(p))
        .filter((p) => fs.existsSync(p));
      const perEntry = fg.sync(perEntryCssGlob, {
        cwd: entryDir,
        absolute: true,
        dot: false,
        ignore: perEntryCssIgnore,
      });

      if (kind === "style") {
        const allCss = [...globals, ...perEntry]; // absolute paths on disk
        const lines = [
          `@source "./src";`,
          ...allCss.map((p) => `@import "${toServerRoot(p)}";`),
        ];
        return lines.join("\n");
      }

      if (kind === "entry") {
        const spec = toFs(entry);

        const lines: string[] = [];

        // Import Vite HMR client from root
        lines.push(`import "/@vite/client";`);

        lines.push(`
import RefreshRuntime from "/@react-refresh";

if (!window.__vite_plugin_react_preamble_installed__) {
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
}
`);

        lines.push(`import "/${name}.css";`);
        lines.push(`await import(${JSON.stringify(spec)});`);

        return lines.join("\n");
      }

      return null;
    },
  };
}

const inputs = buildInputs();

function directoryConfigPlugin(): Plugin {
  const watched = new Set(
    [directoryConfigPaths.config, directoryConfigPaths.data].map((p) =>
      path.resolve(p)
    )
  );

  const maybeSync = async () => {
    await syncDirectoryConfig({ log: true });
  };

  return {
    name: "directory-config-sync",
    async buildStart() {
      await maybeSync();
    },
    configureServer(server) {
      for (const file of watched) {
        server.watcher.add(file);
      }
      const handler = async (file: string) => {
        if (!watched.has(path.resolve(file))) return;
        await maybeSync();
      };
      server.watcher.on("change", handler);
      server.watcher.on("add", handler);
    }
  };
}

export default defineConfig(({}) => ({
  plugins: [
    directoryConfigPlugin(),
    tailwindcss(),
    react(),
    multiEntryDevEndpoints({
      entries: inputs,
      getDevToolOutput: () => (process.env.NODE_ENV === "development" ? buildDevStructuredContent() : null),
    }),
  ],
  cacheDir: "node_modules/.vite-react",
  server: {
    port: 4044,
    strictPort: true,
    cors: true,
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
    target: "es2022",
  },
  build: {
    target: "es2022",
    sourcemap: true,
    minify: "esbuild",
    outDir: "assets",
    assetsDir: ".",
    rollupOptions: {
      input: inputs,
      preserveEntrySignatures: "strict",
    },
  },
}));
