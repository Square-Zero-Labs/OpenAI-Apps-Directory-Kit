# Directory MCP server (Node)

This package contains the Node.js Model Context Protocol (MCP) server for the **OpenAI Apps Directory Kit**. It exposes a set of configurable directory widgets—map, list, carousel, and albums—through the official TypeScript MCP SDK so you can test UI-bearing tools in ChatGPT developer mode.

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

## Install dependencies

```bash
pnpm install
```

## Run the server

```bash
pnpm start
```

The server listens on port `8000` by default (`PORT` can override). Connect ChatGPT to `http://localhost:8000/mcp` (or tunnel the port) to experiment with the widgets.

## Configuration

- `config/directory.json` controls copy, theming, field mapping, and optional Supabase connection details.
- `data/directory-places.json` provides fallback data when a remote source is unavailable.
- Set the `SUPABASE_SERVICE_ROLE_KEY` environment variable (and adjust the config) to fetch real data from Supabase.

Each tool response includes:

- `content`: a short text acknowledgement.
- `structuredContent`: the directory items, UI settings, and applied filters.
- `_meta.openai/outputTemplate`: metadata binding the response to the inlined widget markup.

Use this project as a starting point for your own directory-style connectors—swap the data source, theme, or copy to fit your use case.
