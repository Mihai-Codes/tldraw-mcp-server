/**
 * Shared types for tldraw MCP Server
 */

// ─── Element Types ─────────────────────────────────────────────────────────────

/** Geometric/visual shape types supported by the API */
export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'text'
  | 'arrow'
  | 'line'
  | 'note'
  | 'frame'
  | 'star'
  | 'cloud'
  | 'hexagon'

/**
 * Color names supported by tldraw.
 * Use these string values in `color` / `strokeColor` fields.
 */
export type TldrawColor =
  | 'black'
  | 'grey'
  | 'light-violet'
  | 'violet'
  | 'blue'
  | 'light-blue'
  | 'yellow'
  | 'orange'
  | 'green'
  | 'light-green'
  | 'light-red'
  | 'red'
  | 'white'

export type FillStyle = 'none' | 'semi' | 'solid' | 'pattern'
export type DashStyle = 'draw' | 'solid' | 'dashed' | 'dotted'
export type SizeStyle = 's' | 'm' | 'l' | 'xl'
export type FontStyle = 'draw' | 'sans' | 'serif' | 'mono'
export type ArrowheadStyle =
  | 'none'
  | 'arrow'
  | 'triangle'
  | 'square'
  | 'dot'
  | 'pipe'
  | 'diamond'
  | 'inverted'
  | 'bar'

// ─── Core Canvas Element ───────────────────────────────────────────────────────

export interface CanvasElement {
  /** Unique element ID (auto-generated if not provided) */
  id: string
  /** Shape type */
  type: ElementType
  /** X position (canvas coordinates) */
  x: number
  /** Y position (canvas coordinates) */
  y: number
  /** Width in pixels (default: 160 for shapes, auto for text) */
  width?: number
  /** Height in pixels (default: 80 for shapes) */
  height?: number
  /** Text content / label */
  text?: string
  /**
   * tldraw color name for stroke/text.
   * Values: 'black' | 'grey' | 'blue' | 'red' | 'green' | 'orange' | 'violet' | etc.
   */
  color?: TldrawColor | string
  /** Fill style: 'none' | 'semi' | 'solid' | 'pattern' (default: 'none') */
  fill?: FillStyle
  /** Stroke dash style: 'draw' | 'solid' | 'dashed' | 'dotted' (default: 'draw') */
  dash?: DashStyle
  /** Size preset: 's' | 'm' | 'l' | 'xl' (default: 'm') */
  size?: SizeStyle
  /** Font style: 'draw' | 'sans' | 'serif' | 'mono' (default: 'draw') */
  font?: FontStyle
  /** Opacity 0-100 (default: 100) */
  opacity?: number
  /** Whether element is locked from editing */
  locked?: boolean
  /** Group membership IDs */
  groupIds?: string[]
  /** For arrows: ID of element to bind the arrow start to */
  startElementId?: string
  /** For arrows: ID of element to bind the arrow end to */
  endElementId?: string
  /** Arrowhead at start (default: 'none') */
  startArrowhead?: ArrowheadStyle | null
  /** Arrowhead at end (default: 'arrow' for type=arrow, 'none' for line) */
  endArrowhead?: ArrowheadStyle | null
  /** Custom points for lines/arrows [[x,y], ...] */
  points?: [number, number][]
  /** ISO timestamp when created */
  createdAt: string
  /** ISO timestamp when last updated */
  updatedAt: string
  /** Monotonic version counter for conflict detection */
  version: number
}

// ─── WebSocket Message Protocol ───────────────────────────────────────────────

export type WSMessageFromServer =
  | { type: 'full_sync'; elements: CanvasElement[] }
  | { type: 'element_created'; element: CanvasElement }
  | { type: 'element_updated'; element: CanvasElement }
  | { type: 'element_deleted'; id: string }
  | { type: 'elements_batch_created'; elements: CanvasElement[] }
  | { type: 'elements_batch_updated'; elements: CanvasElement[] }
  | { type: 'canvas_cleared' }
  | { type: 'viewport'; params: ViewportParams }
  | { type: 'screenshot_request'; format: 'png' | 'svg'; background: boolean; requestId: string }

export type WSMessageFromClient =
  | { type: 'screenshot_result'; format: 'png' | 'svg'; data: string; requestId?: string; error?: string }
  | { type: 'ping' }

export interface ViewportParams {
  scrollToContent?: boolean
  scrollToElementId?: string
  zoom?: number
  offsetX?: number
  offsetY?: number
}

// ─── API Response Types ────────────────────────────────────────────────────────

export interface ApiResponse {
  success: boolean
  element?: CanvasElement
  elements?: CanvasElement[]
  message?: string
  error?: string
  count?: number
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Generate a short random ID */
export function generateId(): string {
  return (
    Math.random().toString(36).slice(2, 9) +
    Date.now().toString(36)
  )
}

/** All supported element type names */
export const ELEMENT_TYPES: ElementType[] = [
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'text',
  'arrow',
  'line',
  'note',
  'frame',
  'star',
  'cloud',
  'hexagon',
]
