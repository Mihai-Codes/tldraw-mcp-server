<p align="center">
  <img src="assets/tldraw-mcp-logo.png" alt="tldraw MCP Server logo" width="720" />
</p>

# tldraw MCP Server

> Programmatic canvas toolkit for AI agents - create, read, update, and delete tldraw shapes in real time via the Model Context Protocol.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![tldraw](https://img.shields.io/badge/tldraw-4.5-000000)](https://tldraw.dev/)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-Server-5E5CE6)](https://modelcontextprotocol.io/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-ws_8.21-010101)](https://github.com/websockets/ws)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What It Is

An MCP server that gives AI agents (AdaL, Claude, Cursor, Codex CLI…) programmatic control over a live tldraw canvas. Draw diagrams, architecture charts, and flowcharts by just describing what you want.

**Inspired by** [mcp_excalidraw](https://github.com/yctimlin/mcp_excalidraw) — the same quality and completeness, built for the tldraw ecosystem.

## Quick Start

### Prerequisites

- Node.js >= 18

### 1 — Install & Build

```bash
git clone https://github.com/chindris-mihai-alexandru/tldraw-mcp-server.git
cd tldraw-mcp-server
npm install
npm run build
npm run build:frontend
```

### 2 — Start the Canvas Server

```bash
npm run canvas
# Canvas running at http://127.0.0.1:3000
```

Open **http://127.0.0.1:3000** in your browser — this is the live canvas.

### 3 — Connect an MCP Client

The `.mcp.json` at the repo root works out-of-the-box for any project-level MCP client:

```json
{
  "mcpServers": {
    "tldraw": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000"
      }
    }
  }
}
```

---

## MCP Client Configuration

The default launch mode is still **stdio**, so existing AdaL/Claude/Cursor configs continue to work. Set `MCP_TRANSPORT=http` only when you want a shared Streamable HTTP endpoint.

### Transport and adapter options

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_TRANSPORT` | `stdio` | `stdio` for subprocess clients, `http` for Streamable HTTP |
| `MCP_CLIENT` | `generic` | Optional client hint: `adal`, `claude`, `cursor`, `openai`, `generic` |
| `MCP_SERVER_NAME` | `tldraw` | Server name used for optional tool prefixes |
| `INCLUDE_SERVER_IN_TOOL_NAMES` | `false` | Expose tools as `tldraw__create_element` while still accepting prefixed calls |
| `MCP_PERFORMANCE_MODE` | `false` | Compact tool descriptions to reduce discovery context |
| `MCP_HTTP_HOST` | `127.0.0.1` | HTTP bind host |
| `MCP_HTTP_PORT` | `3333` | HTTP bind port |
| `MCP_HTTP_PATH` | `/mcp` | Streamable HTTP MCP path |
| `MCP_ALLOWED_ORIGINS` | local origins | Comma-separated Origin allowlist for HTTP |
| `MCP_ALLOWED_HOSTS` | local hosts | Comma-separated Host allowlist for HTTP |
| `MCP_AUTH_TOKEN` | unset | Optional bearer-token auth for HTTP |

HTTP auth is disabled by default for local development. For shared endpoints, set `MCP_AUTH_TOKEN` and send `Authorization: Bearer <token>`.

### AdaL CLI

**Project-level** — the `.mcp.json` in this repo is pre-configured. Just open AdaL in this directory and the server is auto-discovered.

```bash
cd tldraw-mcp-server
adal
# AdaL auto-loads .mcp.json — tldraw tools are available immediately
```

Example `.mcp.json`:

```json
{
  "mcpServers": {
    "tldraw": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000",
        "MCP_TRANSPORT": "stdio",
        "MCP_CLIENT": "adal"
      }
    }
  }
}
```

Performance mode for lower discovery overhead:

```json
{
  "mcpServers": {
    "tldraw": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000",
        "MCP_TRANSPORT": "stdio",
        "MCP_CLIENT": "adal",
        "MCP_PERFORMANCE_MODE": "true"
      }
    }
  }
}
```

### Claude Code

```bash
# Project-level (commits .mcp.json to the repo)
claude mcp add tldraw --scope project \
  -e EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  -e MCP_TRANSPORT=stdio \
  -e MCP_CLIENT=claude \
  -- node /absolute/path/to/tldraw-mcp-server/dist/index.js

# User-level (available across all projects)
claude mcp add tldraw --scope user \
  -e EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  -e MCP_TRANSPORT=stdio \
  -e MCP_CLIENT=claude \
  -- node /absolute/path/to/tldraw-mcp-server/dist/index.js
```

### Claude Desktop

Config: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "tldraw": {
      "command": "node",
      "args": ["/absolute/path/to/tldraw-mcp-server/dist/index.js"],
      "env": {
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000",
        "MCP_TRANSPORT": "stdio",
        "MCP_CLIENT": "claude"
      }
    }
  }
}
```

### Cursor

Config: `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global)

```json
{
  "mcpServers": {
    "tldraw": {
      "command": "node",
      "args": ["/absolute/path/to/tldraw-mcp-server/dist/index.js"],
      "env": {
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000",
        "MCP_TRANSPORT": "stdio",
        "MCP_CLIENT": "cursor",
        "INCLUDE_SERVER_IN_TOOL_NAMES": "false"
      }
    }
  }
}
```

If a gateway/client expects server-prefixed tool names, set:

```json
{
  "mcpServers": {
    "tldraw": {
      "command": "node",
      "args": ["/absolute/path/to/tldraw-mcp-server/dist/index.js"],
      "env": {
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000",
        "INCLUDE_SERVER_IN_TOOL_NAMES": "true"
      }
    }
  }
}
```

### OpenAI Agents SDK

Use Streamable HTTP for OpenAI Agents SDK and other shared-agent environments:

```bash
MCP_TRANSPORT=http \
MCP_HTTP_HOST=127.0.0.1 \
MCP_HTTP_PORT=3333 \
MCP_HTTP_PATH=/mcp \
EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
MCP_CLIENT=openai \
node dist/index.js
```

Example Agents SDK server entry:

```ts
import { Agent } from '@openai/agents'

const agent = new Agent({
  name: 'diagram-agent',
  instructions: 'Use the tldraw MCP server to create and inspect diagrams.',
  mcpServers: [
    {
      name: 'tldraw',
      url: 'http://127.0.0.1:3333/mcp',
      headers: process.env.MCP_AUTH_TOKEN
        ? { Authorization: `Bearer ${process.env.MCP_AUTH_TOKEN}` }
        : undefined,
    },
  ],
})
```

### Codex CLI

```bash
codex mcp add tldraw \
  --env EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  --env MCP_TRANSPORT=stdio \
  -- node /absolute/path/to/tldraw-mcp-server/dist/index.js
```

### Supergateway / systemd example

If you need an HTTP endpoint while keeping the stdio server path, `supergateway` can wrap the existing command:

```bash
npx -y supergateway \
  --stdio "node /opt/tldraw-mcp-server/dist/index.js" \
  --port 3333 \
  --baseUrl http://127.0.0.1:3333 \
  --ssePath /mcp \
  --messagePath /messages
```

Example `systemd` unit:

```ini
[Unit]
Description=tldraw MCP HTTP Gateway
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/tldraw-mcp-server
Environment=EXPRESS_SERVER_URL=http://127.0.0.1:3000
Environment=MCP_PERFORMANCE_MODE=true
ExecStart=/usr/bin/npx -y supergateway --stdio "node dist/index.js" --port 3333 --baseUrl http://127.0.0.1:3333 --ssePath /mcp --messagePath /messages
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Migration and rollback

No migration is required for existing AdaL users: stdio remains the default. To roll back optional behavior, unset `MCP_TRANSPORT`, `MCP_PERFORMANCE_MODE`, and `INCLUDE_SERVER_IN_TOOL_NAMES`, then use the original `.mcp.json` shape with only `EXPRESS_SERVER_URL`.

---

## MCP Tools

### Implemented (20 tools)

| Tool | Description |
|------|-------------|
| `create_element` | Create a shape, text, arrow, or note on the canvas |
| `get_element` | Get a single element by ID |
| `update_element` | Partially update any element property |
| `delete_element` | Delete an element by ID |
| `query_elements` | List/filter elements by type and bounding box |
| `batch_create_elements` | Create multiple elements atomically (efficient for diagrams) |
| `clear_canvas` | Remove all elements (requires `confirm: true`) |
| `read_diagram_guide` | Return tldraw color names, presets, and layout best practices |
| `describe_scene` | Summarize the current canvas elements, positions, labels, and connections |
| `get_canvas_screenshot` | Capture a PNG screenshot from the live browser canvas |
| `export_scene` | Export all elements as a JSON snapshot |
| `import_scene` | Import a JSON scene in replace or merge mode |
| `snapshot_scene` | Save the current canvas as a named in-memory snapshot |
| `restore_snapshot` | Restore a previously saved named snapshot |
| `set_viewport` | Zoom, pan, zoom-to-fit, or center on a specific element |
| `align_elements` | Align multiple elements using an atomic batch update |
| `distribute_elements` | Distribute multiple elements evenly using an atomic batch update |
| `auto_layout` | Automatically arrange elements using dagre, force-directed, or grid layout |
| `export_svg` | Export the current canvas as an SVG string |
| `export_pdf` | Export the current canvas as a PDF file (requires Playwright for full fidelity) |

### Roadmap

| Category | Tools | Status |
|----------|-------|--------|
| **Grouping** | `group_elements`, `ungroup_elements` | Planned |
| **Advanced Export** | `export_png` (via Playwright), `export_jpg` | Planned |

---

## Shape Types

`rectangle` · `ellipse` · `diamond` · `triangle` · `text` · `arrow` · `line` · `note` · `frame` · `star` · `cloud` · `hexagon`

## Element Properties

| Property | Values | Default |
|----------|--------|---------|
| `color` | `black` · `grey` · `blue` · `light-blue` · `violet` · `light-violet` · `red` · `light-red` · `orange` · `yellow` · `green` · `light-green` · `white` | `black` |
| `fill` | `none` · `semi` · `solid` · `pattern` | `none` |
| `dash` | `draw` · `solid` · `dashed` · `dotted` | `draw` |
| `size` | `s` · `m` · `l` · `xl` | `m` |
| `font` | `draw` · `sans` · `serif` · `mono` | `draw` |

---

## Architecture

```
┌─────────────────────┐         ┌─────────────────────────┐
│   MCP Client        │  stdio  │   MCP Server             │
│   AdaL, Claude,     │◀───────▶│   src/index.ts           │
│   Cursor, etc.      │         │   17 tools · Zod validate│
└─────────────────────┘         └────────────┬────────────┘
                                             │ HTTP REST
                                             ▼
                                ┌─────────────────────────┐
                                │   Canvas Server          │
                                │   src/canvas-server.ts   │
                                │   Express · Port 3000    │
                                └────────────┬────────────┘
                                             │ WebSocket /ws
                                             ▼
                                ┌─────────────────────────┐
                                │   Browser UI             │
                                │   frontend/src/App.tsx   │
                                │   tldraw React app       │
                                └─────────────────────────┘
```

**Flow:** MCP client calls a tool → MCP server validates with Zod → HTTP POST to canvas server → canvas server broadcasts via WebSocket → browser frontend applies to tldraw editor in real time.

---

## Development

```bash
# Type check
npm run type-check

# Backend (watch mode)
npm run dev:canvas   # canvas server on :3000
npm run dev          # MCP server on stdio

# Frontend (watch mode with hot reload)
npm run dev:frontend # Vite dev server on :5173

# Build everything
npm run build:all

# Run regression tests once
npm test -- --run

# Test MCP tools directly
npx @modelcontextprotocol/inspector --cli \
  -e EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  -- node dist/index.js --method tools/list
```

### Testing

```bash
# Run the Vitest regression suite once
npm test -- --run
```

The tests cover REST edge cases such as duplicate custom IDs, atomic batch create validation, and atomic batch updates.

### Testing a Tool

```bash
# Create a rectangle
npx @modelcontextprotocol/inspector --cli \
  -e EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  -- node dist/index.js --method tools/call \
  --tool-name create_element \
  --tool-arg type=rectangle --tool-arg x=100 --tool-arg y=100 \
  --tool-arg width=200 --tool-arg height=80 \
  --tool-arg text="Hello" --tool-arg color=blue --tool-arg fill=semi
```

## Troubleshooting

### Screenshot tools return an error

`get_canvas_screenshot` requires a live browser client because screenshots are rendered by the tldraw frontend, not by the MCP stdio process. Start the canvas server with `npm run canvas`, open `http://127.0.0.1:3000` in a browser, wait for the canvas to load, then call the screenshot tool again.

---

## License

[MIT](LICENSE)

## Acknowledgments

- [tldraw](https://tldraw.dev/) — The infinite canvas SDK
- [mcp_excalidraw](https://github.com/yctimlin/mcp_excalidraw) — Reference architecture
- [Model Context Protocol](https://modelcontextprotocol.io/) — Open standard for AI tool integration
