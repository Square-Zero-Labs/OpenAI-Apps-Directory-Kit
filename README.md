# Apps SDK Examples Gallery

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

This repository showcases example UI components to be used with the Apps SDK, as well as example MCP servers that expose a collection of components as tools.
It is meant to be used as a starting point and source of inspiration to build your own apps for ChatGPT.

## MCP + Apps SDK overview

The Model Context Protocol (MCP) is an open specification for connecting large language model clients to external tools, data, and user interfaces. An MCP server exposes tools that a model can call during a conversation and returns results according to the tool contracts. Those results can include extra metadata—such as inline HTML—that the Apps SDK uses to render rich UI components (widgets) alongside assistant messages.

Within the Apps SDK, MCP keeps the server, model, and UI in sync. By standardizing the wire format, authentication, and metadata, it lets ChatGPT reason about your connector the same way it reasons about built-in tools. A minimal MCP integration for Apps SDK implements three capabilities:

1. **List tools** – Your server advertises the tools it supports, including their JSON Schema input/output contracts and optional annotations (for example, `readOnlyHint`).
2. **Call tools** – When a model selects a tool, it issues a `call_tool` request with arguments that match the user intent. Your server executes the action and returns structured content the model can parse.
3. **Return widgets** – Alongside structured content, return embedded resources in the response metadata so the Apps SDK can render the interface inline in the Apps SDK client (ChatGPT).

Because the protocol is transport agnostic, you can host the server over Server-Sent Events or streaming HTTP—Apps SDK supports both.

The MCP servers in this demo highlight how each tool can light up widgets by combining structured payloads with `_meta.openai/outputTemplate` metadata returned from the MCP servers.

## Repository structure

- `src/` – Source for each widget example.
- `assets/` – Generated HTML, JS, and CSS bundles after running the build step.
- `src/directory-utils.ts` & `src/directory-defaults.ts` – Shared helpers and default data used by the directory-style widgets.
- `pizzaz_server_node/` – MCP server implemented with the official TypeScript SDK.
  - `config/directory.json` – Runtime configuration that maps directory fields, theme colors, copy, filters, and data source credentials.
  - `data/*.json` – Local fallback data used when a remote data source is unavailable.
- `pizzaz_server_python/` – Python MCP server that returns the Pizzaz widgets.
- `solar-system_server_python/` – Python MCP server for the 3D solar system widget.
- `build-all.mts` – Vite build orchestrator that produces hashed bundles for every widget entrypoint.

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn
- Python 3.10+ (for the Python MCP server)

## Install dependencies

Clone the repository and install the workspace dependencies:

```bash
pnpm install
```

> Using npm or yarn? Install the root dependencies with your preferred client and adjust the commands below accordingly.

## Build the components gallery

The components are bundled into standalone assets that the MCP servers can serve as reusable UI resources.

```bash
pnpm run build
```

This command runs `build-all.mts`, producing versioned `.html`, `.js`, and `.css` files inside `assets/`. Each widget is wrapped with the CSS it needs so you can host the bundles directly or ship them with your own server.

To iterate locally, you can also launch the Vite dev server:

```bash
pnpm run dev
```

> This starts Vite on port `4044`. Stop the MCP server first, or run a separate tunnel if you need hot-module reload instead of the server’s bundled assets.

To serve the latest production bundles locally without rebuilding the MCP server, run:

```bash
pnpm run build
pnpm run serve   # serves ./assets on http://localhost:4044
```

The Pizzaz MCP server now inlines the generated CSS and JS into each widget, so ChatGPT does not need to fetch assets over the network during development.

To continuously rebuild the production bundles while the MCP server is running, use watch mode:

```bash
pnpm run build -- --watch
```

## Run the MCP servers

The repository ships several demo MCP servers that highlight different widget bundles:

- **Pizzaz (Node & Python)** – pizza-inspired collection of tools and components
- **Solar system (Python)** – 3D solar system viewer

Every tool response includes plain text content, structured JSON, and `_meta.openai/outputTemplate` metadata so the Apps SDK can hydrate the matching widget.

### Pizzaz Node server

The Node implementation now reads a directory configuration, fetches data from Supabase (or local JSON fallback), and serves the widget assets itself.

1. Build the widget bundles (if you have not already):

   ```bash
   pnpm run build
   ```

2. Configure environment variables (optional but recommended):

   ```bash
   export SUPABASE_SERVICE_ROLE_KEY=... # only if using Supabase
   ```

3. Optionally keep the build output fresh while the server runs:

   ```bash
   pnpm run build -- --watch
   ```

4. Start the server:

```bash
cd pizzaz_server_node
pnpm start
```

### Pizzaz Python server

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r pizzaz_server_python/requirements.txt
uvicorn pizzaz_server_python.main:app --port 8000
```

### Solar system Python server

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r solar-system_server_python/requirements.txt
uvicorn solar-system_server_python.main:app --port 8000
```

You can reuse the same virtual environment for all Python servers—install the dependencies once and run whichever entry point you need.

### Directory configuration & filters

The Pizzaz Node server is designed to power directory-style apps:

- `pizzaz_server_node/config/directory.json` defines UI copy, theme colors, Supabase connection details, and logical field mappings the widgets expect.
- `filters.locationField` and `filters.attributeField` allow the server (and ultimately the UI) to filter results when tool calls include `location` or `attribute` arguments.
- The server falls back to the JSON in `pizzaz_server_node/data/*.json` when remote data is unavailable, applying the same filter rules.

When the MCP tool is called with arguments such as:

```jsonc
{
  "pizzaTopping": "mushroom",
  "location": "North Beach",
  "attribute": "$$"
}
```

the server limits the returned `items` to matching rows and echoes the selected filters in `structuredContent.appliedFilters`. The React widgets (map, list, carousel) hydrate from this structured payload so the same components can power other directories—just swap the config and assets.

## Testing in ChatGPT

To add these apps to ChatGPT, enable [developer mode](https://platform.openai.com/docs/guides/developer-mode), and add your apps in Settings > Connectors.

To add your local server without deploying it, you can use a tool like [ngrok](https://ngrok.com/) to expose your local server to the internet.

For example, once your mcp servers are running, you can run:

```bash
ngrok http 8000
```

You will get a public URL that you can use to add your local server to ChatGPT in Settings > Connectors.

For example: `https://<custom_endpoint>.ngrok-free.app/mcp`

## Next steps

- Customize the widget data: edit the handlers in `pizzaz_server_node/src`, `pizzaz_server_python/main.py`, or the solar system server to fetch data from your systems.
- Create your own components and add them to the gallery: drop new entries into `src/` and they will be picked up automatically by the build script.

## Contributing

You are welcome to open issues or submit PRs to improve this app, however, please note that we may not review all suggestions.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
