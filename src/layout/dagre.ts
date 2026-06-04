import dagre from '@dagrejs/dagre'
import type { CanvasElement } from '../types.js'
import type { LayoutOptions, LayoutResult, LayoutPosition, DagreOptions } from './types.js'
import { buildLayoutGraph, computeBoundingBox } from './graph.js'

const DEFAULT_DAGRE_OPTIONS: DagreOptions = {
  rankdir: 'LR',
  nodesep: 60,
  ranksep: 80,
  edgesep: 30,
  marginx: 40,
  marginy: 40,
}

export function computeDagreLayout(
  elements: CanvasElement[],
  options: LayoutOptions = { algorithm: 'dagre' }
): LayoutResult {
  const graph = buildLayoutGraph(elements)
  const dagreOpts = { ...DEFAULT_DAGRE_OPTIONS, ...options.dagre }

  const g = new dagre.graphlib.Graph({ multigraph: false })
  g.setGraph({
    rankdir: dagreOpts.rankdir,
    nodesep: dagreOpts.nodesep,
    ranksep: dagreOpts.ranksep,
    edgesep: dagreOpts.edgesep,
    marginx: dagreOpts.marginx,
    marginy: dagreOpts.marginy,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: node.width, height: node.height })
  }

  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const positions: LayoutPosition[] = []
  const positionMap = new Map<string, { x: number; y: number }>()

  for (const node of graph.nodes) {
    const dagreNode = g.node(node.id)
    if (!dagreNode || !isFinite(dagreNode.x) || !isFinite(dagreNode.y)) continue

    const x = dagreNode.x - node.width / 2
    const y = dagreNode.y - node.height / 2

    positions.push({ id: node.id, x, y, width: node.width, height: node.height })
    positionMap.set(node.id, { x, y })
  }

  const bbox = computeBoundingBox(graph.nodes, positionMap)

  return {
    algorithm: 'dagre',
    elementCount: positions.length,
    positions,
    bbox,
    meta: {
      rankdir: dagreOpts.rankdir,
      nodesep: dagreOpts.nodesep,
      ranksep: dagreOpts.ranksep,
    },
  }
}
