/**
 * tldraw MCP Canvas Frontend
 *
 * Connects to the canvas server via WebSocket and applies
 * element CRUD operations to the tldraw editor in real time.
 */

import { useEffect, useRef, useCallback } from 'react'
import { Tldraw, Editor, createShapeId, TLShapeId, TLDefaultColorStyle } from 'tldraw'
import 'tldraw/tldraw.css'

const TLDRAW_LICENSE_KEY = import.meta.env.VITE_TLDRAW_LICENSE_KEY || ''
const WS_URL = import.meta.env.VITE_WS_URL || `ws://${location.host}/ws`

// ─── Types (mirror of src/types.ts — kept simple for the browser bundle) ──────

interface CanvasElement {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color?: string
  fill?: string
  dash?: string
  size?: string
  font?: string
  opacity?: number
  locked?: boolean
  startElementId?: string
  endElementId?: string
  startArrowhead?: string | null
  endArrowhead?: string | null
  endX?: number
  endY?: number
  points?: [number, number][]
}

type ServerMessage =
  | { type: 'full_sync'; elements: CanvasElement[] }
  | { type: 'element_created'; element: CanvasElement }
  | { type: 'element_updated'; element: CanvasElement }
  | { type: 'element_deleted'; id: string }
  | { type: 'elements_batch_created'; elements: CanvasElement[] }
  | { type: 'elements_batch_updated'; elements: CanvasElement[] }
  | { type: 'canvas_cleared' }
  | { type: 'viewport'; params: ViewportParams }
  | { type: 'screenshot_request'; format: 'png' | 'svg'; background: boolean; requestId: string }

interface ViewportParams {
  scrollToContent?: boolean
  scrollToElementId?: string
  zoom?: number
  offsetX?: number
  offsetY?: number
}

// ─── tldraw shape helpers ─────────────────────────────────────────────────────

/** Map API color names to tldraw color style values */
function toTldrawColor(color?: string): TLDefaultColorStyle {
  const map: Record<string, TLDefaultColorStyle> = {
    black: 'black',
    grey: 'grey',
    gray: 'grey',
    'light-violet': 'light-violet',
    violet: 'violet',
    blue: 'blue',
    'light-blue': 'light-blue',
    yellow: 'yellow',
    orange: 'orange',
    green: 'green',
    'light-green': 'light-green',
    'light-red': 'light-red',
    red: 'red',
    white: 'white',
  }
  return map[color ?? 'black'] ?? 'black'
}

/** Convert plain text to tldraw v3 richText (TipTap ProseMirror JSON) */
function toRichText(text: string): Record<string, unknown> {
  const lines = text.split('\n')
  const content = lines.map((line) => {
    if (!line) return { type: 'paragraph' }
    return { type: 'paragraph', content: [{ type: 'text', text: line }] }
  })
  return { type: 'doc', content }
}

/** Build tldraw shape props from a CanvasElement */
function buildShapeProps(el: CanvasElement): Record<string, unknown> {
  const color = toTldrawColor(el.color)
  const base = { color }

  if (el.type === 'text') {
    return {
      ...base,
      richText: toRichText(el.text ?? ''),
      size: el.size ?? 'm',
      font: el.font ?? 'draw',
      textAlign: 'middle',
      autoSize: true,
      w: el.width ?? 200,
    }
  }

  if (el.type === 'note') {
    return {
      ...base,
      richText: toRichText(el.text ?? ''),
      size: el.size ?? 'm',
      font: el.font ?? 'draw',
      color: el.color ? toTldrawColor(el.color) : 'yellow',
      align: 'middle',
    }
  }

  if (el.type === 'arrow' || el.type === 'line') {
    const pts = el.points
    const last = pts ? pts[pts.length - 1] : null
    const props: Record<string, unknown> = {
      ...base,
      dash: el.dash ?? 'draw',
      size: el.size ?? 'm',
      arrowheadStart: el.startArrowhead ?? 'none',
      arrowheadEnd: el.endArrowhead ?? (el.type === 'arrow' ? 'arrow' : 'none'),
      richText: toRichText(el.text ?? ''),
      font: el.font ?? 'draw',
      start: { x: 0, y: 0 },
      end: last ? { x: last[0], y: last[1] } : { x: (el.endX ?? el.x + 200) - el.x, y: (el.endY ?? el.y) - el.y },
    }
    return props
  }

  if (el.type === 'frame') {
    return { ...base, w: el.width ?? 400, h: el.height ?? 300, name: el.text ?? '' }
  }

  // Default geo shapes: rectangle, ellipse, diamond, triangle, star, cloud, hexagon
  return {
    ...base,
    geo: el.type,
    w: el.width ?? 160,
    h: el.height ?? 80,
    richText: toRichText(el.text ?? ''),
    fill: el.fill ?? 'none',
    dash: el.dash ?? 'draw',
    size: el.size ?? 'm',
    font: el.font ?? 'draw',
    align: 'middle',
    verticalAlign: 'middle',
    growY: 0,
  }
}

type TLShapeType = 'text' | 'draw' | 'note' | 'arrow' | 'line' | 'frame' | 'geo' | 'bookmark' | 'embed' | 'group' | 'highlight' | 'image' | 'video'

/** Determine the tldraw shape `type` string from a CanvasElement */
function toTldrawType(type: string): TLShapeType {
  if (type === 'text') return 'text'
  if (type === 'note') return 'note'
  if (type === 'arrow') return 'arrow'
  if (type === 'line') return 'line'
  if (type === 'frame') return 'frame'
  // rectangle, ellipse, diamond, triangle, star, cloud, hexagon → all use type "geo"
  return 'geo'
}

/** Apply a single element to the editor (create or update) */
function applyElement(editor: Editor, el: CanvasElement): void {
  const shapeId = createShapeId(el.id)
  const existing = editor.getShape(shapeId)
  const shapeType = toTldrawType(el.type)
  const props = buildShapeProps(el)

  if (existing) {
    if (existing.type !== shapeType) {
      // tldraw cannot change a shape's type in-place — delete and recreate
      editor.deleteShapes([shapeId])
      editor.createShape({
        id: shapeId,
        type: shapeType,
        x: el.x,
        y: el.y,
        opacity: (el.opacity ?? 100) / 100,
        props,
        isLocked: el.locked ?? false,
      })
    } else {
      editor.updateShape({
        id: shapeId,
        type: shapeType,
        x: el.x,
        y: el.y,
        opacity: (el.opacity ?? 100) / 100,
        props,
        isLocked: el.locked ?? false,
      })
    }
  } else {
    editor.createShape({
      id: shapeId,
      type: shapeType,
      x: el.x,
      y: el.y,
      opacity: (el.opacity ?? 100) / 100,
      props,
      isLocked: el.locked ?? false,
    })
  }

  // tldraw v3: arrow bindings are separate records, not embedded in props
  if (el.type === 'arrow' || el.type === 'line') {
    // Remove any existing bindings for this arrow
    const existingBindings = editor.getBindingsFromShape(shapeId, 'arrow')
    for (const b of existingBindings) {
      editor.deleteBinding(b.id)
    }
    // Create start binding
    if (el.startElementId) {
      const targetId = createShapeId(el.startElementId)
      if (editor.getShape(targetId)) {
        editor.createBinding({
          type: 'arrow',
          fromId: shapeId,
          toId: targetId,
          props: {
            terminal: 'start',
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
            isPrecise: false,
          },
        })
      }
    }
    // Create end binding
    if (el.endElementId) {
      const targetId = createShapeId(el.endElementId)
      if (editor.getShape(targetId)) {
        editor.createBinding({
          type: 'arrow',
          fromId: shapeId,
          toId: targetId,
          props: {
            terminal: 'end',
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isExact: false,
            isPrecise: false,
          },
        })
      }
    }
  }
}

// ─── App Component ────────────────────────────────────────────────────────────

export function App() {
  const editorRef = useRef<Editor | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Screenshot handler ──────────────────────────────────────────────────────
  const handleScreenshotRequest = useCallback(async (format: 'png' | 'svg', background: boolean, requestId?: string) => {
    const editor = editorRef.current
    const ws = wsRef.current
    if (!editor || !ws || ws.readyState !== WebSocket.OPEN) return

    try {
      // Export all shapes to an image blob
      const shapeIds = editor.getCurrentPageShapeIds()
      if (shapeIds.size === 0) {
        ws.send(JSON.stringify({ type: 'screenshot_result', format, data: '', requestId }))
        return
      }

      if (format === 'svg') {
        const result = await editor.getSvgString([...shapeIds], { background })
        if (result) {
          const b64 = btoa(unescape(encodeURIComponent(result.svg)))
          ws.send(JSON.stringify({ type: 'screenshot_result', format: 'svg', data: b64, requestId }))
        }
      } else {
        // toImage returns { blob, width, height }
        const result = await editor.toImage([...shapeIds], { format: 'png', background, pixelRatio: 2 })
        if (result) {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const b64 = dataUrl.split(',')[1] ?? ''
            ws.send(JSON.stringify({ type: 'screenshot_result', format: 'png', data: b64, requestId }))
          }
          reader.onerror = () => {
            ws.send(JSON.stringify({ type: 'screenshot_result', format, data: '', requestId, error: 'Failed to read image blob' }))
          }
          reader.readAsDataURL(result.blob)
        } else {
          ws.send(JSON.stringify({ type: 'screenshot_result', format, data: '', requestId, error: 'No image result returned' }))
        }
      }
    } catch (err) {
      console.error('[screenshot] failed:', err)
      ws.send(JSON.stringify({
        type: 'screenshot_result',
        format,
        data: '',
        requestId,
        error: err instanceof Error ? err.message : 'Unknown screenshot error',
      }))
    }
  }, [])

  // ── WebSocket connection ────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[ws] connected to canvas server')
    }

    ws.onmessage = (event) => {
      const editor = editorRef.current
      if (!editor) return

      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }

      switch (msg.type) {
        case 'full_sync': {
          // Replace the entire canvas with the server state
          editor.run(() => {
            // Remove shapes not in the new state
            const serverIds = new Set(msg.elements.map((e) => `shape:${e.id}`))
            const toDelete = [...editor.getCurrentPageShapeIds()]
              .filter((id) => !serverIds.has(id))
              .map((id) => id)
            if (toDelete.length > 0) editor.deleteShapes(toDelete)
            // Apply all server elements
            for (const el of msg.elements) applyElement(editor, el)
          }, { history: 'ignore' })
          break
        }

        case 'element_created':
        case 'element_updated': {
          editor.run(() => {
            applyElement(editor, msg.element)
          }, { history: 'ignore' })
          break
        }

        case 'elements_batch_created':
        case 'elements_batch_updated': {
          editor.run(() => {
            for (const el of msg.elements) applyElement(editor, el)
          }, { history: 'ignore' })
          break
        }

        case 'element_deleted': {
          const shapeId = createShapeId(msg.id)
          if (editor.getShape(shapeId)) {
            editor.run(() => {
              editor.deleteShapes([shapeId])
            }, { history: 'ignore' })
          }
          break
        }

        case 'canvas_cleared': {
          editor.run(() => {
            const all = [...editor.getCurrentPageShapeIds()]
            if (all.length > 0) editor.deleteShapes(all)
          }, { history: 'ignore' })
          break
        }

        case 'viewport': {
          handleViewport(editor, msg.params)
          break
        }

        case 'screenshot_request': {
          handleScreenshotRequest(msg.format, msg.background, msg.requestId)
          break
        }
      }
    }

    ws.onclose = () => {
      console.log('[ws] disconnected — reconnecting in 3s')
      reconnectTimer.current = setTimeout(connectWS, 3000)
    }

    ws.onerror = (err) => {
      console.error('[ws] error:', err)
    }
  }, [handleScreenshotRequest])

  // ── Viewport handler ────────────────────────────────────────────────────────
  function handleViewport(editor: Editor, params: ViewportParams): void {
    if (params.scrollToContent) {
      editor.zoomToFit()
      return
    }
    if (params.scrollToElementId) {
      const shapeId = createShapeId(params.scrollToElementId)
      const shape = editor.getShape(shapeId)
      if (shape) {
        editor.select(shapeId)
        editor.zoomToSelection()
      }
      return
    }
    if (params.zoom !== undefined) {
      editor.setCamera({ x: params.offsetX ?? 0, y: params.offsetY ?? 0, z: params.zoom })
    }
  }

  // ── Editor mount ────────────────────────────────────────────────────────────
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor

    // Expose editor globally for debugging
    ;(window as unknown as Record<string, unknown>).__tldraw_editor = editor

    // Notify canvas server
    fetch('/api/editor-ready', { method: 'POST' }).catch(() => {})

    // Connect WebSocket
    connectWS()
  }, [connectWS])

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        licenseKey={TLDRAW_LICENSE_KEY}
        persistenceKey="tldraw-mcp"
        onMount={handleMount}
      />
    </div>
  )
}
