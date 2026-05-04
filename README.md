# tldraw MCP Server

> Programmatic canvas toolkit for AI agents — create, read, update, and delete tldraw shapes in real time via the Model Context Protocol.

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

### AdaL CLI (Primary Target)

**Project-level** — the `.mcp.json` in this repo is pre-configured. Just open AdaL in this directory and the server is auto-discovered.

```bash
cd tldraw-mcp-server
adal
# AdaL auto-loads .mcp.json — tldraw tools are available immediately
```

Or add manually via the slash command:
```
/mcp
```

### Claude Code

```bash
# Project-level (commits .mcp.json to the repo)
claude mcp add tldraw --scope project \
  -e EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  -- node /absolute/path/to/tldraw-mcp-server/dist/index.js

# User-level (available across all projects)
claude mcp add tldraw --scope user \
  -e EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
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
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000"
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
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000"
      }
    }
  }
}
```

### Codex CLI

```bash
codex mcp add tldraw \
  --env EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  -- node /absolute/path/to/tldraw-mcp-server/dist/index.js
```

---

## MCP Tools

### ✅ Implemented (17 tools)

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

### 🗺️ Roadmap

| Category | Tools | Status |
|----------|-------|--------|
| **Grouping** | `group_elements`, `ungroup_elements` | Planned |

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

# Test MCP tools directly
npx @modelcontextprotocol/inspector --cli \
  -e EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  -- node dist/index.js --method tools/list
```

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

---

## License

[MIT](LICENSE)

## Acknowledgments

- [tldraw](https://tldraw.dev/) — The infinite canvas SDK
- [mcp_excalidraw](https://github.com/yctimlin/mcp_excalidraw) — Reference architecture
- [Model Context Protocol](https://modelcontextprotocol.io/) — Open standard for AI tool integration
