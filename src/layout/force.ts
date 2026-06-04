import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import type { CanvasElement } from '../types.js'
import type { LayoutOptions, LayoutResult, LayoutPosition, ForceOptions } from './types.js'
import { buildLayoutGraph, computeBoundingBox } from './graph.js'

interface ForceNode {
  id: string
  x?: number
  y?: number
  width: number
  height: number
}

interface ForceLink {
  source: string
  target: string
}

const DEFAULT_FORCE_OPTIONS: ForceOptions = {
  linkDistance: 150,
  chargeStrength: -400,
  centerStrength: 0.1,
  iterations: 300,
}

export function computeForceLayout(
  elements: CanvasElement[],
  options: LayoutOptions = { algorithm: 'force' }
): LayoutResult {
  const graph = buildLayoutGraph(elements)
  const forceOpts = { ...DEFAULT_FORCE_OPTIONS, ...options.force }

  const nodes: ForceNode[] = graph.nodes.map((node) => ({
    id: node.id,
    x: node.element.x,
    y: node.element.y,
    width: node.width,
    height: node.height,
  }))

  const links: ForceLink[] = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }))

  const simulation = forceSimulation(nodes as any)
    .force(
      'link',
      forceLink(links as any)
        .id((d: any) => d.id)
        .distance(forceOpts.linkDistance!)
    )
    .force('charge', forceManyBody().strength(forceOpts.chargeStrength!))
    .force('center', forceCenter(0, 0).strength(forceOpts.centerStrength!))
    .force(
      'collide',
      forceCollide().radius((d: any) => Math.max(d.width, d.height) / 2 + 20)
    )
    .stop()

  const iterations = forceOpts.iterations ?? 300
  for (let i = 0; i < iterations; i++) {
    simulation.tick()
  }

  const positions: LayoutPosition[] = []
  const positionMap = new Map<string, { x: number; y: number }>()

  for (const node of nodes) {
    const x = (node.x ?? 0) - node.width / 2
    const y = (node.y ?? 0) - node.height / 2

    positions.push({ id: node.id, x, y, width: node.width, height: node.height })
    positionMap.set(node.id, { x, y })
  }

  const bbox = computeBoundingBox(graph.nodes, positionMap)

  return {
    algorithm: 'force',
    elementCount: positions.length,
    positions,
    bbox,
    meta: {
      linkDistance: forceOpts.linkDistance,
      chargeStrength: forceOpts.chargeStrength,
      iterations,
    },
  }
}
