# Pizzaz Directory MCP Example

This repository contains a single configurable “directory” experience for ChatGPT developer mode. The Node MCP server returns Pizzaz-themed widgets (map, list, carousel, albums) together with structured data, so the Apps SDK can render them alongside assistant messages. All widget assets are bundled in `assets/` and inlined by the server, which keeps development setup simple.

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn

## Install dependencies

```bash
pnpm install
```

## Build the widgets

```bash
pnpm run build
```

The `build-all.mts` script produces hashed `.html`, `.js`, and `.css` files for the directory widgets inside `assets/`. Each bundle is self-contained so the MCP server can embed the CSS/JS directly into responses.

To iterate with hot reload:

```bash
pnpm run dev
```

> Vite runs on port `4044`. Run it alongside the MCP server (for example, start the server in another terminal) if you want live reloading.

To serve the latest production bundles without rerunning Vite:

```bash
pnpm run build
pnpm run serve   # serves ./assets on http://localhost:4044
```

The MCP server reads the hashed bundles from disk on startup and inlines them into each widget response, so ChatGPT does not need network access to fetch assets during development.

## Run the MCP server

```bash
pnpm run build        # make sure assets exist
cd pizzaz_server_node
pnpm start
```

The server exposes three widgets (`pizza-map`, `pizza-list`, `pizza-carousel`, and `pizza-albums`) as tools. Responses include plain text, structured content for the model, and `_meta.openai/outputTemplate` metadata that points at the embedded widget HTML.

### Configuration

- `pizzaz_server_node/config/directory.json` controls directory copy, theme colors, map configuration, and optional Supabase settings.
- `pizzaz_server_node/data/*.json` provides fallback data if Supabase is unavailable.
- Set `SUPABASE_SERVICE_ROLE_KEY` (and adjust the config) to fetch live data; otherwise the bundled JSON is used.

Edits to `config/directory.json` are picked up the next time you restart the server.

## Testing in ChatGPT Developer Mode

1. Enable developer mode in ChatGPT and add a custom connector.
2. Point it at your MCP server (for example, `https://<your-ngrok-subdomain>.ngrok-free.app/mcp`).
3. Invoke one of the tools—ChatGPT will render the Pizzaz widgets using the embedded assets.

## Project structure

- `src/` – React widgets and shared utilities for the directory experience.
- `assets/` – Generated bundles after `pnpm run build`.
- `pizzaz_server_node/` – Node MCP server.
- `build-all.mts` – Build orchestrator that bundles the widgets and emits hashed outputs.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
