# OpenAI Apps Directory Kit

The OpenAI Apps Directory Kit packages React directory widgets and a companion MCP server so you can build a specialized directory-style ChatGPT app without managing separate hosting for front-end assets.

## Prerequisites

- Node.js 18 or newer
- pnpm

## Install dependencies

```bash
pnpm install
```

This single install covers the widgets and the MCP server workspace.

## Build widget bundles for ChatGPT

```bash
pnpm run build
```

This command compiles the widgets into hashed bundles in `assets/`. Run it whenever you change code under `src/` or otherwise need fresh widget assets for the MCP server. After the build completes, restart the MCP server so it reloads the updated bundles. (Pure config or data edits do not require a build.)

## Start the widget dev server

```bash
pnpm run dev
```

The Vite dev server serves each widget at `http://localhost:4044/<widget>.html` with hot reloading. It also injects the current directory data into `window.openai.toolOutput`, so every preview renders with live content as you iterate. The dev script automatically keeps the generated defaults in sync—no manual sync step required.

### Preview widgets locally

Open `http://localhost:4044/` in your browser to browse the full list of widgets and load their individual previews.

## Start the MCP server

```bash
cd directory_server_node
pnpm start
```

The server listens on port `8000` by default and hot-reloads changes to `config/directory.json` and `data/directory-places.json`.

## Expose the MCP server with ngrok

```bash
ngrok http 8000
```

Copy the HTTPS forwarding URL that ngrok prints (for example, `https://<random>.ngrok-free.app`).

## Connect the MCP server to ChatGPT

1. Open ChatGPT in developer mode and create a custom connector.
2. Set the connector URL to your ngrok forwarding address with `/mcp` appended (e.g., `https://<random>.ngrok-free.app/mcp`).
3. Save the connector and invoke any of the directory tools (`directory-map`, `directory-list`, `directory-carousel`, or `directory-albums`). ChatGPT renders the widgets using the inlined assets delivered by the MCP server.

## Configure the directory

- Edit `directory_server_node/config/directory.json` to adjust copy, branding, theming, field mappings, and Supabase settings.
- Update `directory_server_node/data/directory-places.json` to change the bundled fallback dataset used by both the widgets and the MCP server.
- Wire up Supabase by copying `.env.example` to `.env` inside `directory_server_node` and filling in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. When either variable is missing the MCP server automatically serves the bundled JSON data instead.

The dev server and MCP server automatically pick up changes to these files—no manual sync or build steps are required.

## Production

Production deployment instructions coming soon.
