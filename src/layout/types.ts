/**
 * Layout engine types and interfaces
 */

import type { CanvasElement } from '../types.js'

// ─── Layout Algorithms ──────────────────────────────────────────────────────

export type LayoutAlgorithm = 'dagre' | 'force' | 'grid'

// ─── Layout Options ─────────────────────────────────────────────────────────

export interface DagreOptions {
  /** Layout direction: 'TB' (top-bottom), 'LR' (left-right), 'BT', 'RL' */
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL'
  /** Horizontal spacing between nodes in same rank */
  nodesep?: number
  /** Vertical spacing between ranks */
  ranksep?: number
  /** Edge spacing */
  edgesep?: number
  /** Margin around graph */
  marginx?: number
  /** Margin around graph */
  marginy?: number
}

export interface ForceOptions {
  /** Distance between linked nodes */
  linkDistance?: number
  /** Charge strength (negative = repulsion) */
  chargeStrength?: number
  /** Center gravity (0 = no pull to center) */
  centerStrength?: number
  /** Number of simulation ticks (higher = more stable) */
  iterations?: number
  /** Random seed for deterministic layouts (unused - d3-force is deterministic by default) */
  seed?: number
}

export interface GridOptions {
  /** Number of columns (auto-calculated if not specified) */
  columns?: number
  /** Horizontal gap between elements */
  gapX?: number
  /** Vertical gap between elements */
  gapY?: number
  /** Arrange direction: 'row' (left-to-right, then down) or 'column' (top-to-bottom, then right) */
  direction?: 'row' | 'column'
}

export interface LayoutOptions {
  /** Layout algorithm to use */
  algorithm: LayoutAlgorithm
  /** Algorithm-specific options */
  dagre?: DagreOptions
  force?: ForceOptions
  grid?: GridOptions
  /** Element IDs to layout (empty = all non-arrow elements) */
  elementIds?: string[]
  /** Whether to preserve locked elements' positions */
  respectLocked?: boolean
}

// ─── Layout Result ──────────────────────────────────────────────────────────

export interface LayoutPosition {
  id: string
  x: number
  y: number
  width?: number
  height?: number
}

export interface LayoutResult {
  /** Algorithm used */
  algorithm: LayoutAlgorithm
  /** Number of elements positioned */
  elementCount: number
  /** Computed positions (top-left corner) */
  positions: LayoutPosition[]
  /** Bounding box of laid out elements */
  bbox: { x: number; y: number; width: number; height: number }
  /** Layout metadata */
  meta?: Record<string, unknown>
}

// ─── Graph Building Helpers ─────────────────────────────────────────────────

export interface LayoutNode {
  id: string
  width: number
  height: number
  /** Original element for reference */
  element: CanvasElement
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
  /** Arrow element for reference */
  arrow: CanvasElement
}

export interface LayoutGraph {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

/**
 * Default layout options per algorithm
 */
export const DEFAULT_OPTIONS: Record<LayoutAlgorithm, LayoutOptions> = {
  dagre: {
    algorithm: 'dagre',
    dagre: {
      rankdir: 'LR',
      nodesep: 60,
      ranksep: 80,
      edgesep: 30,
      marginx: 40,
      marginy: 40,
    },
  },
  force: {
    algorithm: 'force',
    force: {
      linkDistance: 150,
      chargeStrength: -400,
      centerStrength: 0.1,
      iterations: 300,
    },
  },
  grid: {
    algorithm: 'grid',
    grid: {
      columns: 0, // auto-calculate
      gapX: 60,
      gapY: 60,
      direction: 'row',
    },
  },
}
