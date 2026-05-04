# AGENTS.md — tldraw MCP Server

> Guidance for AI agents (AdaL, Claude Code, Codex CLI, etc.) working in this repository.

## What This Project Is

An MCP (Model Context Protocol) server that gives AI agents programmatic control over a live **tldraw** infinite canvas. Two processes run together:

1. **Canvas Server** (`src/canvas-server.ts`) — Express HTTP + WebSocket server on port 3000. Owns the in-memory element store and broadcasts mutations to connected browsers.
2. **MCP Server** (`src/index.ts`) — Stdio MCP server. Validates tool calls with Zod and proxies them to the canvas server via HTTP REST.
3. **Frontend** (`frontend/src/App.tsx`) — React + tldraw app. Connects to canvas server via WebSocket, applies all mutations to the tldraw editor in real time.

## Repository Layout

```
tldraw-mcp-server/
├── src/
│   ├── index.ts          # MCP server entry point — 8 tools, Zod schemas
│   ├── canvas-server.ts  # Express + WebSocket canvas server — REST CRUD + snapshot
│   └── types.ts          # Shared types: CanvasElement, WSMessage, ApiResponse, generateId
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # React component — WS sync, tldraw shape mapping
│   │   └── main.tsx      # React entry point
│   ├── index.html
│   ├── vite.config.ts    # Dev proxy /api → :3000, build → dist/public
│   ├── tsconfig.json
│   └── package.json
├── dist/                 # Compiled backend (tsc output) — gitignored
│   └── public/           # Compiled frontend (vite build output) — gitignored
├── .mcp.json             # Project-level MCP config for AdaL CLI / Claude Code
├── package.json          # Root — backend deps + build scripts
└── tsconfig.json         # Backend TS config
```

## Key Design Decisions

- **Relative path in `.mcp.json`**: `args: ["dist/index.js"]` — works when AdaL/Claude is opened from the project root. For global installs use absolute path.
- **Route ordering matters**: `DELETE /api/elements/clear` must be registered BEFORE `DELETE /api/elements/:id` (Express matches first).
- **Geo shapes**: tldraw uses a single `geo` shape type for rectangle, ellipse, diamond, triangle, star, cloud, hexagon — the `geo` prop selects the variant. The frontend `toTldrawType()` maps all these to `"geo"`.
- **Arrow bindings**: Use `startElementId`/`endElementId` in the API. The frontend converts these to tldraw's `{ type: 'binding', boundShapeId }` format.
- **WebSocket broadcast**: Every REST mutation calls `broadcast()` immediately — the browser reacts within one event loop tick.
- **In-memory store**: Elements live in `Map<string, CanvasElement>` in `canvas-server.ts`. Restarting the server clears all elements. Use `snapshot_scene`/`restore_snapshot` for persistence.

## Currently Implemented MCP Tools

| Tool | Description |
|------|-------------|
| `create_element` | Create any shape/text/arrow |
| `get_element` | Fetch element by ID |
| `update_element` | Partial update (only supplied fields change) |
| `delete_element` | Remove element by ID |
| `query_elements` | Filter by type and/or bounding box |
| `batch_create_elements` | Atomic multi-create — assign custom IDs for arrow bindings |
| `clear_canvas` | Wipe all elements (`confirm: true` required) |
| `read_diagram_guide` | Return color names, fill/dash/size presets, layout rules |

## REST API (Canvas Server)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check |
| `GET` | `/api/elements` | List all elements |
| `GET` | `/api/elements/search` | Filter: `?type=&x_min=&x_max=&y_min=&y_max=` |
| `GET` | `/api/elements/:id` | Get one |
| `POST` | `/api/elements` | Create one (`type`, `x`, `y` required) |
| `POST` | `/api/elements/batch` | Create many (`{ elements: [...] }`) |
| `PUT` | `/api/elements/:id` | Partial update |
| `DELETE` | `/api/elements/clear` | Wipe all |
| `DELETE` | `/api/elements/:id` | Delete one |
| `POST` | `/api/viewport` | Broadcast viewport command to browser |
| `POST` | `/api/export/image` | Request screenshot from browser (`format`, `background`) |
| `POST` | `/api/snapshots` | Save named snapshot |
| `GET` | `/api/snapshots/:name` | Retrieve snapshot |

## WebSocket Protocol

Server → Browser:
- `{ type: 'full_sync', elements }` — sent on new connection
- `{ type: 'element_created', element }`
- `{ type: 'element_updated', element }`
- `{ type: 'element_deleted', id }`
- `{ type: 'elements_batch_created', elements }`
- `{ type: 'canvas_cleared' }`
- `{ type: 'viewport', params }` — zoom/scroll commands
- `{ type: 'screenshot_request', format, background }` — ask browser to render

Browser → Server:
- `{ type: 'screenshot_result', format, data }` — base64 image data

## Common Tasks

### Add a new MCP tool
1. Add the Zod schema and tool definition in `src/index.ts` (follow existing pattern)
2. Add the REST endpoint in `src/canvas-server.ts` if needed
3. Update `AGENTS.md` tool table and `README.md` roadmap

### Change element schema
1. Edit `CanvasElement` interface in `src/types.ts`
2. Update `buildShapeProps()` in `frontend/src/App.tsx` if tldraw shape props change
3. Run `npm run type-check` to catch propagation errors

### Run everything in dev mode
```bash
# Terminal 1
npm run dev:canvas

# Terminal 2
npm run dev:frontend   # Vite on :5173 with HMR

# Terminal 3 (optional — test MCP tools directly)
npm run dev
```

### Build for production
```bash
npm run build:all
npm run canvas   # serves frontend from dist/public
```

## Type Check & Build

```bash
npm run type-check   # zero errors expected
npm run build        # backend only
npm run build:all    # backend + frontend
```

## Important: Don't Break These

- `DELETE /api/elements/clear` must stay above `DELETE /api/elements/:id` in `canvas-server.ts`
- `satisfies ApiResponse` type assertions in canvas-server — keep these, they catch response shape bugs at compile time
- `process.env.NODE_DISABLE_COLORS = '1'` at the top of `src/index.ts` — ANSI codes break JSON stdio parsing
- `{ history: 'ignore' }` in all `editor.run()` calls in App.tsx — prevents WS mutations from appearing in undo history
