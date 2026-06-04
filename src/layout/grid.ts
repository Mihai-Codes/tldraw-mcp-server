import type { CanvasElement } from '../types.js'
import type { LayoutOptions, LayoutResult, LayoutPosition, GridOptions } from './types.js'
import { buildLayoutGraph, computeBoundingBox } from './graph.js'

const DEFAULT_GRID_OPTIONS: GridOptions = {
  columns: 0,
  gapX: 60,
  gapY: 60,
  direction: 'row',
}

function calculateColumns(nodeCount: number): number {
  if (nodeCount <= 1) return 1
  if (nodeCount <= 4) return 2
  if (nodeCount <= 9) return 3
  if (nodeCount <= 16) return 4
  return Math.ceil(Math.sqrt(nodeCount))
}

export function computeGridLayout(
  elements: CanvasElement[],
  options: LayoutOptions = { algorithm: 'grid' }
): LayoutResult {
  const graph = buildLayoutGraph(elements)
  const gridOpts = { ...DEFAULT_GRID_OPTIONS, ...options.grid }

  const columns = gridOpts.columns && gridOpts.columns > 0
    ? gridOpts.columns
    : calculateColumns(graph.nodes.length)

  const rows = Math.ceil(graph.nodes.length / columns)

  const positions: LayoutPosition[] = []
  const positionMap = new Map<string, { x: number; y: number }>()

  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i]
    let col: number
    let row: number

    if (gridOpts.direction === 'column') {
      col = Math.floor(i / rows)
      row = i % rows
    } else {
      col = i % columns
      row = Math.floor(i / columns)
    }

    let x = 0
    let y = 0

    for (let c = 0; c < col; c++) {
      const idx = gridOpts.direction === 'column'
        ? c * rows + row
        : row * columns + c
      if (idx < graph.nodes.length) {
        x += graph.nodes[idx].width + (gridOpts.gapX ?? 60)
      }
    }

    for (let r = 0; r < row; r++) {
      const idx = gridOpts.direction === 'column'
        ? col * rows + r
        : r * columns + col
      if (idx < graph.nodes.length) {
        y += graph.nodes[idx].height + (gridOpts.gapY ?? 60)
      }
    }

    positions.push({ id: node.id, x, y, width: node.width, height: node.height })
    positionMap.set(node.id, { x, y })
  }

  const bbox = computeBoundingBox(graph.nodes, positionMap)

  return {
    algorithm: 'grid',
    elementCount: positions.length,
    positions,
    bbox,
    meta: {
      columns,
      rows,
      direction: gridOpts.direction,
    },
  }
}
