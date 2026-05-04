/**
 * tldraw MCP Server
 *
 * Exposes tldraw canvas operations as MCP tools over stdio.
 * Communicates with the canvas server (Express) via REST API.
 * The canvas server syncs state to the browser frontend via WebSocket.
 */

// Disable ANSI color codes — they break JSON parsing over stdio
process.env.NODE_DISABLE_COLORS = '1'
process.env.NO_COLOR = '1'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { CanvasElement, ApiResponse, generateId, ELEMENT_TYPES } from './types.js'

// ─── Config ────────────────────────────────────────────────────────────────────

const EXPRESS_SERVER_URL = process.env.EXPRESS_SERVER_URL || 'http://127.0.0.1:3000'

// ─── Canvas HTTP Helpers ───────────────────────────────────────────────────────

async function canvasFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${EXPRESS_SERVER_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })
}

async function createElement(data: Partial<CanvasElement>): Promise<CanvasElement> {
  const res = await canvasFetch('/api/elements', { method: 'POST', body: JSON.stringify(data) })
  const json = (await res.json()) as ApiResponse
  if (!res.ok || !json.success || !json.element)
    throw new Error(json.error ?? `Create failed: ${res.status}`)
  return json.element
}

async function getElement(id: string): Promise<CanvasElement> {
  const res = await canvasFetch(`/api/elements/${id}`)
  const json = (await res.json()) as ApiResponse
  if (!res.ok || !json.success || !json.element)
    throw new Error(json.error ?? `Element ${id} not found`)
  return json.element
}

async function updateElement(id: string, updates: Partial<CanvasElement>): Promise<CanvasElement> {
  const res = await canvasFetch(`/api/elements/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
  const json = (await res.json()) as ApiResponse
  if (!res.ok || !json.success || !json.element)
    throw new Error(json.error ?? `Update failed: ${res.status}`)
  return json.element
}

async function deleteElement(id: string): Promise<void> {
  const res = await canvasFetch(`/api/elements/${id}`, { method: 'DELETE' })
  const json = (await res.json()) as ApiResponse
  if (!res.ok || !json.success) throw new Error(json.error ?? `Delete failed: ${res.status}`)
}

async function queryElements(params: {
  type?: string
  x_min?: number
  x_max?: number
  y_min?: number
  y_max?: number
}): Promise<CanvasElement[]> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v))
  }
  const res = await canvasFetch(`/api/elements/search?${qs}`)
  const json = (await res.json()) as ApiResponse
  if (!res.ok || !json.success) throw new Error(json.error ?? `Query failed: ${res.status}`)
  return json.elements ?? []
}

async function batchCreateElements(els: Partial<CanvasElement>[]): Promise<CanvasElement[]> {
  const res = await canvasFetch('/api/elements/batch', {
    method: 'POST',
    body: JSON.stringify({ elements: els }),
  })
  const json = (await res.json()) as ApiResponse
  if (!res.ok || !json.success) throw new Error(json.error ?? `Batch create failed: ${res.status}`)
  return json.elements ?? []
}

async function clearCanvas(): Promise<void> {
  const res = await canvasFetch('/api/elements/clear', { method: 'DELETE' })
  const json = (await res.json()) as ApiResponse
  if (!res.ok || !json.success) throw new Error(json.error ?? `Clear failed: ${res.status}`)
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const ElementTypeEnum = z.enum(ELEMENT_TYPES as [string, ...string[]])

const BaseElementProps = z.object({
  id: z.string().optional(),
  type: ElementTypeEnum,
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  text: z.string().optional(),
  color: z.string().optional(),
  fill: z.enum(['none', 'semi', 'solid', 'pattern']).optional(),
  dash: z.enum(['draw', 'solid', 'dashed', 'dotted']).optional(),
  size: z.enum(['s', 'm', 'l', 'xl']).optional(),
  font: z.enum(['draw', 'sans', 'serif', 'mono']).optional(),
  opacity: z.number().min(0).max(100).optional(),
  locked: z.boolean().optional(),
  startElementId: z.string().optional(),
  endElementId: z.string().optional(),
  startArrowhead: z
    .enum(['none', 'arrow', 'triangle', 'square', 'dot', 'pipe', 'diamond', 'inverted', 'bar'])
    .nullable()
    .optional(),
  endArrowhead: z
    .enum(['none', 'arrow', 'triangle', 'square', 'dot', 'pipe', 'diamond', 'inverted', 'bar'])
    .nullable()
    .optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
})

// ─── Shared Input Schema Properties ──────────────────────────────────────────

const ELEMENT_PROPS_INPUT = {
  id: { type: 'string', description: 'Custom element ID (auto-generated if omitted)' },
  type: { type: 'string', enum: ELEMENT_TYPES, description: 'Shape type' },
  x: { type: 'number', description: 'X position' },
  y: { type: 'number', description: 'Y position' },
  width: { type: 'number', description: 'Width in pixels (default 160)' },
  height: { type: 'number', description: 'Height in pixels (default 80)' },
  text: { type: 'string', description: 'Label / text content' },
  color: {
    type: 'string',
    description:
      "tldraw color name: 'black'|'grey'|'blue'|'light-blue'|'violet'|'light-violet'|'red'|'light-red'|'orange'|'yellow'|'green'|'light-green'|'white'",
  },
  fill: {
    type: 'string',
    enum: ['none', 'semi', 'solid', 'pattern'],
    description: 'Fill style (default: none)',
  },
  dash: {
    type: 'string',
    enum: ['draw', 'solid', 'dashed', 'dotted'],
    description: 'Stroke style (default: draw)',
  },
  size: {
    type: 'string',
    enum: ['s', 'm', 'l', 'xl'],
    description: 'Size preset (default: m)',
  },
  font: {
    type: 'string',
    enum: ['draw', 'sans', 'serif', 'mono'],
    description: 'Font family for text/note shapes',
  },
  opacity: { type: 'number', description: 'Opacity 0–100 (default: 100)' },
  locked: { type: 'boolean', description: 'Lock element from editing' },
  startElementId: { type: 'string', description: 'For arrows: bind start to this element ID' },
  endElementId: { type: 'string', description: 'For arrows: bind end to this element ID' },
  startArrowhead: {
    type: 'string',
    description: "Arrowhead at start: 'none'|'arrow'|'triangle'|'dot'|'square'|'pipe'|'diamond'|'bar'",
  },
  endArrowhead: {
    type: 'string',
    description: "Arrowhead at end: 'none'|'arrow'|'triangle'|'dot'|'square'|'pipe'|'diamond'|'bar'",
  },
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const tools: Tool[] = [
  {
    name: 'create_element',
    description:
      'Create a new tldraw shape/text/arrow on the canvas. ' +
      'For arrows use startElementId/endElementId to bind to shapes. ' +
      'Call read_diagram_guide first for color names and best practices.',
    inputSchema: {
      type: 'object',
      properties: ELEMENT_PROPS_INPUT,
      required: ['type', 'x', 'y'],
    },
  },
  {
    name: 'get_element',
    description: 'Get a single canvas element by ID.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Element ID' } },
      required: ['id'],
    },
  },
  {
    name: 'update_element',
    description: 'Update properties of an existing element (partial update — only provided fields change).',
    inputSchema: {
      type: 'object',
      properties: { ...ELEMENT_PROPS_INPUT, id: { type: 'string', description: 'Element ID (required)' } },
      required: ['id'],
    },
  },
  {
    name: 'delete_element',
    description: 'Delete a canvas element by ID.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Element ID' } },
      required: ['id'],
    },
  },
  {
    name: 'query_elements',
    description:
      'List/filter canvas elements. Supports type filter and bounding box. ' +
      'Returns all elements when called with no arguments.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ELEMENT_TYPES, description: 'Filter by element type' },
        bbox: {
          type: 'object',
          description: 'Bounding box filter (all fields optional)',
          properties: {
            x_min: { type: 'number' },
            x_max: { type: 'number' },
            y_min: { type: 'number' },
            y_max: { type: 'number' },
          },
        },
      },
    },
  },
  {
    name: 'batch_create_elements',
    description:
      'Create multiple elements in one atomic operation. ' +
      'Assign custom `id` to shapes so arrows can reference them via startElementId/endElementId. ' +
      'Much more efficient than multiple create_element calls.',
    inputSchema: {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          description: 'Array of element definitions',
          items: {
            type: 'object',
            properties: ELEMENT_PROPS_INPUT,
            required: ['type', 'x', 'y'],
          },
        },
      },
      required: ['elements'],
    },
  },
  {
    name: 'clear_canvas',
    description: 'Remove ALL elements from the canvas. This cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to execute (safety guard)' },
      },
      required: ['confirm'],
    },
  },
  {
    name: 'read_diagram_guide',
    description:
      "Returns tldraw's color names, fill/dash/size presets, layout patterns, " +
      'and anti-patterns. Call this before drawing to produce great diagrams.',
    inputSchema: { type: 'object', properties: {} },
  },
]

// ─── Diagram Design Guide ─────────────────────────────────────────────────────

const DIAGRAM_GUIDE = `# tldraw MCP — Diagram Design Guide

## Color Names (use in \`color\` field)
| Name         | Use for                              |
|--------------|--------------------------------------|
| black        | Default text & borders               |
| grey         | Secondary / annotations              |
| blue         | Primary actions, links               |
| light-blue   | Background zones (services)          |
| violet       | Middleware, services                 |
| light-violet | Soft highlight                       |
| red          | Errors, critical paths               |
| light-red    | Warning backgrounds                  |
| orange       | Async, queues, events                |
| yellow       | Warnings, highlights                 |
| green        | Success, healthy, approved           |
| light-green  | Positive backgrounds                 |
| white        | Inverse on dark backgrounds          |

## Fill Styles (\`fill\` field)
- \`none\`    — transparent interior (default)
- \`semi\`    — translucent fill
- \`solid\`   — opaque fill (matches \`color\`)
- \`pattern\` — cross-hatch pattern

## Dash Styles (\`dash\` field)
- \`draw\`    — hand-drawn style (default)
- \`solid\`   — clean solid line
- \`dashed\`  — dashed line (async, optional flows)
- \`dotted\`  — dotted line (weak dependency)

## Size Presets (\`size\` field)
- \`s\` — small annotations/labels
- \`m\` — medium / default
- \`l\` — large headings/primary shapes
- \`xl\` — extra-large titles

## Shape Types
- **rectangle / ellipse / diamond / triangle** — standard shapes, use \`text\` for labels
- **note** — sticky note (looks great with fill: solid, color: yellow)
- **text** — free-floating text label
- **arrow** — directed connection (always use startElementId/endElementId)
- **line** — undirected connector
- **frame** — named container zone (great for grouping)
- **star / cloud / hexagon** — decorative shapes

## Arrow Best Practices
- Always set \`startElementId\` + \`endElementId\` — tldraw auto-routes to element edges
- Default \`endArrowhead: "arrow"\` for directed flow
- \`dash: "dashed"\` for async/optional flows
- \`dash: "dotted"\` for weak dependencies

## Layout Rules
- Minimum gap between shapes: 40px
- Recommended shape size: width 160, height 80
- Use Frame shapes as named zones/containers
- Drawing order: frames → shapes → text labels → arrows → annotations

## batch_create_elements Tips
- Assign custom \`id\` to every shape (e.g. "svc-auth", "db-users")
- Reference those IDs in arrow \`startElementId\`/\`endElementId\`
- Create all shapes first, then arrows — order within the batch matters

## Anti-Patterns to Avoid
1. Unbound arrows — always use startElementId/endElementId
2. Overlapping elements — leave >= 40px gaps
3. Too many colors — 3–4 per diagram max
4. No text labels — every shape should have \`text\`
5. Tiny shapes — width < 80px / height < 40px
`

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'tldraw-mcp-server', version: '0.1.0' },
  {
    capabilities: {
      tools: Object.fromEntries(
        tools.map((t) => [t.name, { description: t.description, inputSchema: t.inputSchema }])
      ),
    },
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {

      case 'create_element': {
        const params = BaseElementProps.parse(args)
        const { id: customId, ...rest } = params
        const el = await createElement({ ...rest, id: customId ?? generateId() } as Partial<CanvasElement>)
        return { content: [{ type: 'text', text: `✅ Element created!\n\n${JSON.stringify(el, null, 2)}` }] }
      }

      case 'get_element': {
        const { id } = z.object({ id: z.string() }).parse(args)
        const el = await getElement(id)
        return { content: [{ type: 'text', text: JSON.stringify(el, null, 2) }] }
      }

      case 'update_element': {
        const { id, ...updates } = BaseElementProps.partial().extend({ id: z.string() }).parse(args)
        const el = await updateElement(id, updates as Partial<CanvasElement>)
        return { content: [{ type: 'text', text: `✅ Element updated!\n\n${JSON.stringify(el, null, 2)}` }] }
      }

      case 'delete_element': {
        const { id } = z.object({ id: z.string() }).parse(args)
        await deleteElement(id)
        return { content: [{ type: 'text', text: `✅ Element ${id} deleted.` }] }
      }

      case 'query_elements': {
        const { type, bbox } = z
          .object({
            type: ElementTypeEnum.optional(),
            bbox: z
              .object({
                x_min: z.number().optional(),
                x_max: z.number().optional(),
                y_min: z.number().optional(),
                y_max: z.number().optional(),
              })
              .optional(),
          })
          .parse(args ?? {})
        const results = await queryElements({ type, ...bbox })
        return {
          content: [
            { type: 'text', text: `Found ${results.length} element(s).\n\n${JSON.stringify(results, null, 2)}` },
          ],
        }
      }

      case 'batch_create_elements': {
        const { elements: rawEls } = z.object({ elements: z.array(BaseElementProps) }).parse(args)
        const payload = rawEls.map((el) => ({ ...el, id: el.id ?? generateId() })) as Partial<CanvasElement>[]
        const created = await batchCreateElements(payload)
        return {
          content: [
            { type: 'text', text: `✅ ${created.length} element(s) created!\n\n${JSON.stringify(created, null, 2)}` },
          ],
        }
      }

      case 'clear_canvas': {
        const { confirm } = z.object({ confirm: z.boolean() }).parse(args)
        if (!confirm) return { content: [{ type: 'text', text: 'Clear cancelled — set confirm: true to proceed.' }] }
        await clearCanvas()
        return { content: [{ type: 'text', text: '✅ Canvas cleared.' }] }
      }

      case 'read_diagram_guide': {
        return { content: [{ type: 'text', text: DIAGRAM_GUIDE }] }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (err) {
    const message = err instanceof z.ZodError
      ? `Invalid arguments: ${err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      : (err as Error).message
    return { content: [{ type: 'text', text: `❌ Error: ${message}` }], isError: true }
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`tldraw MCP server running (canvas: ${EXPRESS_SERVER_URL})`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
