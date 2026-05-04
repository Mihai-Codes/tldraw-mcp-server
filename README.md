# tldraw MCP Server

> The most comprehensive MCP (Model Context Protocol) server for tldraw — programmatic canvas toolkit for AI agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What It Is

A full-featured MCP server that gives AI agents programmatic control over tldraw canvases. Create, read, update, and delete shapes, manage scenes, export diagrams, and enable real-time collaboration between AI agents and humans.

**Inspired by** [mcp_excalidraw](https://github.com/yctimlin/mcp_excalidraw) (1.9K+ ⭐) — we aim to bring the same level of quality and completeness to the tldraw ecosystem.

## Why This Exists

| | tldraw Official MCP App | This Project |
|---|---|---|
| **Approach** | 3 tools (create, edit, delete) | 25+ tools with full CRUD, layout, scene management |
| **State** | Cursor-only MCP App | Universal MCP server (stdio) — works with any client |
| **Persistence** | In-app only | `.tldr` file I/O with export/import |
| **AI Awareness** | Limited | `describe_scene`, `get_screenshot`, structured feedback |
| **Clients** | Cursor (VS Code, ChatGPT, Claude planned) | AdaL CLI, Claude Desktop, Cursor, Codex CLI, any MCP client |
| **Canvas** | Embedded in chat | Standalone web UI with WebSocket sync |

## Features

### MCP Tools (Planned: 25+)

| Category | Tools |
|----------|-------|
| **Element CRUD** | `create_element`, `get_element`, `update_element`, `delete_element`, `query_elements`, `batch_create_elements`, `duplicate_elements` |
| **Layout** | `align_elements`, `distribute_elements`, `group_elements`, `ungroup_elements`, `lock_elements`, `unlock_elements` |
| **Scene Awareness** | `describe_scene`, `get_canvas_screenshot` |
| **File I/O** | `export_scene`, `import_scene`, `export_to_image`, `export_to_url` |
| **State Management** | `clear_canvas`, `snapshot_scene`, `restore_snapshot` |
| **Viewport** | `set_viewport` |
| **Conversion** | `create_from_mermaid` |
| **Design Guide** | `read_diagram_guide` |

### Shape Types

- Rectangle, Ellipse, Diamond, Triangle, Arrow
- Text, Line, Frame, Star, Note
- Draw (freehand), Image, Group

## Quick Start

### Prerequisites

- Node.js >= 18
- npm

### Installation

```bash
git clone https://github.com/chindris-mihai-alexandru/tldraw-mcp-server.git
cd tldraw-mcp-server
npm install
npm run build
```

### Running

**Terminal 1 — Canvas Server:**
```bash
PORT=3000 npm run canvas
```
Open http://127.0.0.1:3000 to see the tldraw canvas.

**Terminal 2 — MCP Server (stdio):**
```bash
EXPRESS_SERVER_URL=http://127.0.0.1:3000 node dist/index.js
```

## MCP Client Configuration

### AdaL CLI

Use the `/mcp` command inside AdaL to add the server:
```
/mcp add tldraw
```

Or configure manually in AdaL settings.

### Claude Desktop

```json
{
  "mcpServers": {
    "tldraw": {
      "command": "node",
      "args": ["/path/to/tldraw-mcp-server/dist/index.js"],
      "env": {
        "EXPRESS_SERVER_URL": "http://127.0.0.1:3000"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "tldraw": {
      "command": "node",
      "args": ["/path/to/tldraw-mcp-server/dist/index.js"],
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
  -- node /path/to/tldraw-mcp-server/dist/index.js
```

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   MCP Client        │     │   Canvas Server       │
│   (AdaL, Claude,    │────▶│   (Express + tldraw)  │
│    Cursor, etc.)    │     │   Port 3000           │
└─────────┬───────────┘     └──────────┬───────────┘
          │ stdio                      │ WebSocket
          ▼                            ▼
┌─────────────────────┐     ┌──────────────────────┐
│   MCP Server        │────▶│   Browser UI          │
│   (Node.js)         │ HTTP│   (tldraw React app)  │
│   Tools & Resources │     │   Real-time sync      │
└─────────────────────┘     └──────────────────────┘
```

## Development Status

🚧 **Under active development** — contributions welcome!

### Roadmap

- [x] Repository setup and architecture design
- [ ] Canvas server with tldraw SDK
- [ ] Core MCP tools (create, get, update, delete)
- [ ] Batch operations and layout tools
- [ ] Scene awareness (describe, screenshot)
- [ ] File I/O (export/import `.tldr` files)
- [ ] State management (snapshots)
- [ ] Mermaid conversion
- [ ] Design guide resource
- [ ] Agent skill (SKILL.md)
- [ ] Docker support
- [ ] npm package publishing

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)

## Acknowledgments

- [tldraw](https://tldraw.dev/) — The infinite canvas SDK
- [mcp_excalidraw](https://github.com/yctimlin/mcp_excalidraw) — Inspiration and reference architecture
- [Model Context Protocol](https://modelcontextprotocol.io/) — The open standard for AI tool integration
