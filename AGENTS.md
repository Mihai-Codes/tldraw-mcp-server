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
│   ├── index.ts          # MCP server entry point — 17 tools, Zod schemas
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
- **Route ordering matters**: specific routes such as `PUT /api/elements/batch` and `DELETE /api/elements/clear` must be registered BEFORE parameter routes like `PUT /api/elements/:id` and `DELETE /api/elements/:id` (Express matches first).
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
| `PUT` | `/api/elements/batch` | Atomic partial update for many elements (`{ updates: [{ id, changes }] }`) |
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
- `{ type: 'elements_batch_updated', elements }`
- `{ type: 'canvas_cleared' }`
- `{ type: 'viewport', params }` — zoom/scroll commands
- `{ type: 'screenshot_request', format, background, requestId }` — ask browser to render

Browser → Server:
- `{ type: 'screenshot_result', format, data, requestId, error? }` — base64 image data or error correlated by request ID

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

## tldraw v4 Breaking Changes & Future-Proofing Notes

These changes landed in tldraw v4.x and are **already handled** in `frontend/src/App.tsx`. Do not revert them.

### v4.0 — Arrow shapes now use `richText` instead of `text`
Arrow labels were the last shape type still using plain `text`. In v4.0 they joined geo/text/note:

```typescript
// ✅ Correct — all shapes now use richText
props: { richText: toRichText('my label') }

// ❌ Wrong — was valid in v3, breaks in v4
props: { text: 'my label' }
```

### v4.0 — CSS variables renamed to `--tl-` prefix
All tldraw CSS custom properties now start with `--tl-`. If you add custom CSS:
```css
/* ✅ v4 */  --tl-color-background: white;
/* ❌ v3 */  --color-background: white;
```

### v4.2 — TipTap upgraded from v2 → v3
Our `toRichText()` helper generates plain ProseMirror doc JSON (no TipTap-specific marks), so it's compatible with both versions. If you add rich text extensions or customize TipTap, follow [TipTap's v2→v3 migration guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2).

### v4.3 — Draw shape point encoding changed
`TLDrawShapeSegment.points` renamed to `.path` and changed from `VecModel[]` to `string` (base64-encoded delta encoding). New export: `getPointsFromDrawSegment()` helper to decode. **Not currently used, but required when adding draw shape support.**

### v4.3 — Custom shape type declaration pattern changed (TypeScript only)
Runtime behavior unchanged — TypeScript only. Use module augmentation instead of `TLBaseShape`:
```typescript
// ✅ v4.3+
declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'my-shape': { w: number; h: number }
  }
}
type MyShape = TLShape<'my-shape'>

// ❌ v4.2 and below
type MyShape = TLBaseShape<'my-shape', { w: number; h: number }>
```

### v4.4 — `options` prop consolidates `cameraOptions`/`textOptions`/`deepLinks`
The standalone props are deprecated (still work). Prefer `options={{}}` going forward:
```tsx
// ✅ v4.4+ preferred
<Tldraw options={{ camera: { isLocked: true }, deepLinks: true }} />

// 🔜 deprecated but still works
<Tldraw cameraOptions={{ isLocked: true }} deepLinks />
```

### v4.4 — `editor.spatialIndex` removed from public API
Use `editor.getShapesAtPoint()` / `editor.getShapeAtPoint()` instead.

### v4.5 — `EmbedShapeUtil.setEmbedDefinitions()` deprecated
Use `EmbedShapeUtil.configure({ embedDefinitions: [...] })` instead.

---

## tldraw v3 Breaking Changes (v3.10+)

These were introduced in tldraw v3.10–v3.13 and are **already handled** in `frontend/src/App.tsx`. Do not revert them.

### 1. `opacity` is a top-level shape property (not inside `props`)
tldraw validates `opacity` at the shape level alongside `x`, `y`, `isLocked`. Putting it inside `props` causes a `ValidationError: Unexpected property`.

```typescript
// ✅ Correct
editor.createShape({ id, type, x, y, opacity: 0.9, props: { color: 'blue', ... } })

// ❌ Wrong — causes ValidationError
editor.createShape({ id, type, x, y, props: { color: 'blue', opacity: 0.9, ... } })
```

### 2. `text` → `richText` on geo / text / note shapes (v3.10)
The `text` string prop was removed from `geo`, `text`, and `note` shapes. Use `richText` with TipTap/ProseMirror JSON instead. **Arrow shapes still use plain `text` strings.**

```typescript
// ✅ Correct — geo, text, note shapes
props: { richText: toRichText('Hello\nWorld') }

// ❌ Wrong — causes ValidationError: Unexpected property
props: { text: 'Hello' }
```

The `toRichText()` helper in `App.tsx` converts plain strings (including `\n`) to the required TipTap doc format:
```typescript
{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '...' }] }] }
```

### 3. Arrow bindings are separate records, not embedded in `props` (v3.10)
Arrow `props.start` and `props.end` are now plain `{ x: number, y: number }` vectors. Connections to other shapes are **separate binding records** created via `editor.createBinding()`.

```typescript
// ✅ Correct — v3 way
editor.createShape({ ..., props: { start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, ... } })
editor.createBinding({
  type: 'arrow',
  fromId: arrowShapeId,
  toId: targetShapeId,
  props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false }
})

// ❌ Wrong — v2-style, causes ValidationError: Expected number, got undefined
props: { start: { type: 'binding', boundShapeId: '...', normalizedAnchor: ... } }
```

### 4. Elbow arrows (v3.13)
Arrow shapes gained a `kind` prop (`'arc'` | `'elbow'`) and `elbowMidPoint`. The `buildShapeProps()` function doesn't set these — tldraw fills in defaults — so no action needed unless you want elbow-style arrows. If you create arrows and see `kind` validation errors, pass `kind: 'arc'` explicitly.
