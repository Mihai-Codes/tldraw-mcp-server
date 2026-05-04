/**
 * tldraw Canvas Server
 *
 * Express server that hosts the tldraw React app and provides:
 *   - REST API for element CRUD (used by MCP server)
 *   - WebSocket server for real-time sync to the browser frontend
 *   - Static file serving for the built React frontend
 */

import express, { Request, Response, NextFunction } from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  CanvasElement,
  ApiResponse,
  WSMessageFromServer,
  ViewportParams,
  generateId,
} from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '127.0.0.1'

// ─── In-Memory Store ──────────────────────────────────────────────────────────

/** Primary element store: id → CanvasElement */
const elements = new Map<string, CanvasElement>()

/** Named snapshots */
const snapshots = new Map<string, { name: string; elements: CanvasElement[]; createdAt: string }>()

// ─── WebSocket Setup ──────────────────────────────────────────────────────────

const app = express()
const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

/** Active WebSocket clients */
const wsClients = new Set<WebSocket>()

/** Broadcast a message to all connected WebSocket clients */
function broadcast(msg: WSMessageFromServer): void {
  const payload = JSON.stringify(msg)
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  }
}

wss.on('connection', (ws) => {
  wsClients.add(ws)
  console.log(`[ws] client connected (total: ${wsClients.size})`)

  // Send full current state to new client immediately
  ws.send(
    JSON.stringify({
      type: 'full_sync',
      elements: Array.from(elements.values()),
    } satisfies WSMessageFromServer)
  )

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'screenshot_result') {
        screenshotResolvers.forEach((resolve) => resolve(msg))
        screenshotResolvers.clear()
      }
    } catch {
      // ignore malformed messages
    }
  })

  ws.on('close', () => {
    wsClients.delete(ws)
    console.log(`[ws] client disconnected (total: ${wsClients.size})`)
  })

  ws.on('error', (err) => {
    console.error('[ws] error:', err.message)
    wsClients.delete(ws)
  })
})

// ─── Screenshot Promise Registry ─────────────────────────────────────────────

const screenshotResolvers = new Set<(result: { format: string; data: string }) => void>()

function requestScreenshot(format: 'png' | 'svg', background: boolean): Promise<{ format: string; data: string }> {
  return new Promise((resolve, reject) => {
    if (wsClients.size === 0) {
      reject(new Error('No browser clients connected. Open the canvas in a browser first.'))
      return
    }
    const timeout = setTimeout(() => {
      screenshotResolvers.delete(resolve)
      reject(new Error('Screenshot timeout: browser did not respond within 10s'))
    }, 10_000)

    screenshotResolvers.add((result) => {
      clearTimeout(timeout)
      resolve(result)
    })

    // Ask the browser frontend to render and return image data
    const payload = JSON.stringify({ type: 'screenshot_request', format, background })
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    }
  })
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json())

// CORS — allow Vite dev server on :5173 during development
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  next()
})
app.options('*', (_req, res) => res.sendStatus(204))

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    elements: elements.size,
    wsClients: wsClients.size,
  })
})

// ─── Editor Ready ─────────────────────────────────────────────────────────────

app.post('/api/editor-ready', (_req: Request, res: Response) => {
  console.log('[api] editor ready — browser canvas connected')
  res.json({ success: true })
})

// ─── REST: Elements ───────────────────────────────────────────────────────────

/** GET /api/elements — list all elements */
app.get('/api/elements', (_req: Request, res: Response) => {
  const all = Array.from(elements.values())
  res.json({ success: true, elements: all, count: all.length } satisfies ApiResponse)
})

/** GET /api/elements/search — filtered query */
app.get('/api/elements/search', (req: Request, res: Response) => {
  let results = Array.from(elements.values())
  const { type, x_min, x_max, y_min, y_max } = req.query as Record<string, string | undefined>
  if (type) results = results.filter((el) => el.type === type)
  if (x_min !== undefined) results = results.filter((el) => el.x >= Number(x_min))
  if (x_max !== undefined) results = results.filter((el) => el.x <= Number(x_max))
  if (y_min !== undefined) results = results.filter((el) => el.y >= Number(y_min))
  if (y_max !== undefined) results = results.filter((el) => el.y <= Number(y_max))
  res.json({ success: true, elements: results, count: results.length } satisfies ApiResponse)
})

/** GET /api/elements/:id — get one element */
app.get('/api/elements/:id', (req: Request, res: Response) => {
  const el = elements.get(req.params.id as string)
  if (!el) {
    res.status(404).json({ success: false, error: `Element ${req.params.id as string} not found` } satisfies ApiResponse)
    return
  }
  res.json({ success: true, element: el } satisfies ApiResponse)
})

/** POST /api/elements — create one element */
app.post('/api/elements', (req: Request, res: Response) => {
  const body = req.body as Partial<CanvasElement>
  if (!body.type || body.x === undefined || body.y === undefined) {
    res.status(400).json({ success: false, error: 'type, x, y are required' } satisfies ApiResponse)
    return
  }
  const now = new Date().toISOString()
  const element: CanvasElement = {
    width: 160,
    height: 80,
    color: 'black',
    fill: 'none',
    dash: 'draw',
    size: 'm',
    font: 'draw',
    opacity: 100,
    ...body,
    id: body.id || generateId(),
    createdAt: now,
    updatedAt: now,
    version: 1,
  } as CanvasElement
  elements.set(element.id, element)
  broadcast({ type: 'element_created', element })
  res.status(201).json({ success: true, element } satisfies ApiResponse)
})

/** POST /api/elements/batch — create multiple elements atomically */
app.post('/api/elements/batch', (req: Request, res: Response) => {
  const body = req.body as { elements?: Partial<CanvasElement>[] }
  if (!Array.isArray(body.elements)) {
    res.status(400).json({ success: false, error: '`elements` array required' } satisfies ApiResponse)
    return
  }
  const now = new Date().toISOString()
  const created: CanvasElement[] = []
  for (const raw of body.elements) {
    if (!raw.type || raw.x === undefined || raw.y === undefined) continue
    const element: CanvasElement = {
      width: 160,
      height: 80,
      color: 'black',
      fill: 'none',
      dash: 'draw',
      size: 'm',
      font: 'draw',
      opacity: 100,
      ...raw,
      id: raw.id || generateId(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    } as CanvasElement
    elements.set(element.id, element)
    created.push(element)
  }
  broadcast({ type: 'elements_batch_created', elements: created })
  res.status(201).json({ success: true, elements: created, count: created.length } satisfies ApiResponse)
})

/** PUT /api/elements/:id — partial update */
app.put('/api/elements/:id', (req: Request, res: Response) => {
  const existing = elements.get(req.params.id as string)
  if (!existing) {
    res.status(404).json({ success: false, error: `Element ${req.params.id as string} not found` } satisfies ApiResponse)
    return
  }
  const updated: CanvasElement = {
    ...existing,
    ...(req.body as Partial<CanvasElement>),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  }
  elements.set(updated.id, updated)
  broadcast({ type: 'element_updated', element: updated })
  res.json({ success: true, element: updated } satisfies ApiResponse)
})

/** DELETE /api/elements/clear — remove all elements */
app.delete('/api/elements/clear', (_req: Request, res: Response) => {
  elements.clear()
  broadcast({ type: 'canvas_cleared' })
  res.json({ success: true, message: 'Canvas cleared' } satisfies ApiResponse)
})

/** DELETE /api/elements/:id — delete one element */
app.delete('/api/elements/:id', (req: Request, res: Response) => {
  const id = req.params.id as string
  if (!elements.has(id)) {
    res.status(404).json({ success: false, error: `Element ${id} not found` } satisfies ApiResponse)
    return
  }
  elements.delete(id)
  broadcast({ type: 'element_deleted', id })
  res.json({ success: true, message: `Element ${id} deleted` } satisfies ApiResponse)
})

// ─── REST: Viewport ───────────────────────────────────────────────────────────

app.post('/api/viewport', (req: Request, res: Response) => {
  const params = req.body as ViewportParams
  broadcast({ type: 'viewport', params })
  res.json({ success: true, message: 'Viewport command sent' })
})

// ─── REST: Export/Screenshot ──────────────────────────────────────────────────

app.post('/api/export/image', async (req: Request, res: Response) => {
  const { format = 'png', background = true } = req.body as { format?: 'png' | 'svg'; background?: boolean }
  try {
    const result = await requestScreenshot(format, background)
    res.json({ success: true, format: result.format, data: result.data })
  } catch (err) {
    res.status(503).json({ success: false, error: (err as Error).message } satisfies ApiResponse)
  }
})

// ─── REST: Snapshots ──────────────────────────────────────────────────────────

app.post('/api/snapshots', (req: Request, res: Response) => {
  const { name } = req.body as { name?: string }
  if (!name) {
    res.status(400).json({ success: false, error: '`name` is required' } satisfies ApiResponse)
    return
  }
  const snapshot = { name, elements: Array.from(elements.values()), createdAt: new Date().toISOString() }
  snapshots.set(name, snapshot)
  res.json({ success: true, name, elementCount: snapshot.elements.length, createdAt: snapshot.createdAt })
})

app.get('/api/snapshots/:name', (req: Request, res: Response) => {
  const snap = snapshots.get(req.params.name as string)
  if (!snap) {
    res.status(404).json({ success: false, error: `Snapshot "${req.params.name}" not found` } satisfies ApiResponse)
    return
  }
  res.json({ success: true, snapshot: snap })
})

// ─── Static Frontend ──────────────────────────────────────────────────────────

const publicDir = path.join(__dirname, 'public')
app.use(express.static(publicDir))

// SPA fallback
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    res.status(404).json({ success: false, error: 'Not found' })
    return
  }
  const indexPath = path.join(publicDir, 'index.html')
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send('Frontend not built. Run `npm run build:frontend` first.')
  })
})

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, HOST, () => {
  console.log(`tldraw canvas server running at http://${HOST}:${PORT}`)
  console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/ws`)
})

export { app, httpServer, wss, elements, broadcast }
