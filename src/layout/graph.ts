import type { CanvasElement } from '../types.js'
import type { LayoutGraph, LayoutNode, LayoutEdge } from './types.js'

const DEFAULT_NODE_WIDTH = 160
const DEFAULT_NODE_HEIGHT = 80
const MIN_NODE_SIZE = 40

function clampSize(value: number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback
  return Math.max(MIN_NODE_SIZE, value)
}

export function buildLayoutGraph(elements: CanvasElement[]): LayoutGraph {
  const elementMap = new Map(elements.map((el) => [el.id, el]))

  const nodes: LayoutNode[] = []
  const nodeIds = new Set<string>()

  for (const el of elements) {
    if (el.type === 'arrow' || el.type === 'line') continue

    const node: LayoutNode = {
      id: el.id,
      width: clampSize(el.width, DEFAULT_NODE_WIDTH),
      height: clampSize(el.height, DEFAULT_NODE_HEIGHT),
      element: el,
    }
    nodes.push(node)
    nodeIds.add(el.id)
  }

  const edges: LayoutEdge[] = []
  for (const el of elements) {
    if (el.type !== 'arrow' && el.type !== 'line') continue

    const sourceId = el.startElementId
    const targetId = el.endElementId

    if (!sourceId || !targetId) continue
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) continue

    edges.push({
      id: el.id,
      source: sourceId,
      target: targetId,
      arrow: el,
    })
  }

  return { nodes, edges }
}

export function buildGraphFromSelection(
  elements: CanvasElement[],
  elementIds: string[]
): LayoutGraph {
  const selected = elements.filter((el) => elementIds.includes(el.id))
  return buildLayoutGraph(selected)
}

export function computeBoundingBox(
  nodes: LayoutNode[],
  positions: Map<string, { x: number; y: number }>
): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (!pos) continue

    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + node.width)
    maxY = Math.max(maxY, pos.y + node.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}
