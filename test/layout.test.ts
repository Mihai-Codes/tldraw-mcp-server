import { describe, it, expect } from 'vitest'
import { computeLayout } from '../src/layout/engine.js'
import { computeDagreLayout } from '../src/layout/dagre.js'
import { computeForceLayout } from '../src/layout/force.js'
import { computeGridLayout } from '../src/layout/grid.js'
import { buildLayoutGraph } from '../src/layout/graph.js'
import { generateSvg } from '../src/export/svg.js'
import type { CanvasElement } from '../src/types.js'

const makeElement = (overrides: Partial<CanvasElement> = {}): CanvasElement => ({
  id: `el-${Math.random().toString(36).slice(2, 8)}`,
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 160,
  height: 80,
  text: 'Test',
  color: 'black',
  fill: 'none',
  dash: 'draw',
  size: 'm',
  font: 'draw',
  opacity: 100,
  locked: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  ...overrides,
})

const makeArrow = (sourceId: string, targetId: string): CanvasElement =>
  makeElement({
    id: `arrow-${sourceId}-${targetId}`,
    type: 'arrow',
    startElementId: sourceId,
    endElementId: targetId,
  })

describe('Layout Engine', () => {
  describe('buildLayoutGraph', () => {
    it('builds graph from elements', () => {
      const elements = [
        makeElement({ id: 'a', x: 0, y: 0 }),
        makeElement({ id: 'b', x: 200, y: 0 }),
        makeArrow('a', 'b'),
      ]

      const graph = buildLayoutGraph(elements)

      expect(graph.nodes).toHaveLength(2)
      expect(graph.edges).toHaveLength(1)
      expect(graph.edges[0].source).toBe('a')
      expect(graph.edges[0].target).toBe('b')
    })

    it('ignores unbound arrows', () => {
      const elements = [
        makeElement({ id: 'a', x: 0, y: 0 }),
        makeElement({ id: 'arrow1', type: 'arrow', startElementId: 'a' }),
      ]

      const graph = buildLayoutGraph(elements)

      expect(graph.nodes).toHaveLength(1)
      expect(graph.edges).toHaveLength(0)
    })
  })

  describe('computeDagreLayout', () => {
    it('positions nodes in hierarchy', () => {
      const elements = [
        makeElement({ id: 'a', x: 0, y: 0 }),
        makeElement({ id: 'b', x: 0, y: 0 }),
        makeArrow('a', 'b'),
      ]

      const result = computeDagreLayout(elements)

      expect(result.algorithm).toBe('dagre')
      expect(result.elementCount).toBe(2)
      expect(result.positions).toHaveLength(2)
      expect(result.bbox.width).toBeGreaterThan(0)
    })

    it('respects LR direction', () => {
      const elements = [
        makeElement({ id: 'a', x: 0, y: 0 }),
        makeElement({ id: 'b', x: 0, y: 0 }),
        makeArrow('a', 'b'),
      ]

      const result = computeDagreLayout(elements, {
        algorithm: 'dagre',
        dagre: { rankdir: 'LR' },
      })

      const posA = result.positions.find((p) => p.id === 'a')
      const posB = result.positions.find((p) => p.id === 'b')

      expect(posA).toBeDefined()
      expect(posB).toBeDefined()
      expect(posB!.x).toBeGreaterThan(posA!.x)
    })
  })

  describe('computeForceLayout', () => {
    it('positions nodes with force simulation', () => {
      const elements = [
        makeElement({ id: 'a', x: 0, y: 0 }),
        makeElement({ id: 'b', x: 0, y: 0 }),
        makeElement({ id: 'c', x: 0, y: 0 }),
      ]

      const result = computeForceLayout(elements)

      expect(result.algorithm).toBe('force')
      expect(result.elementCount).toBe(3)
      expect(result.positions).toHaveLength(3)
    })
  })

  describe('computeGridLayout', () => {
    it('arranges nodes in grid', () => {
      const elements = [
        makeElement({ id: 'a', x: 0, y: 0 }),
        makeElement({ id: 'b', x: 0, y: 0 }),
        makeElement({ id: 'c', x: 0, y: 0 }),
        makeElement({ id: 'd', x: 0, y: 0 }),
      ]

      const result = computeGridLayout(elements, {
        algorithm: 'grid',
        grid: { columns: 2, gapX: 40, gapY: 40 },
      })

      expect(result.algorithm).toBe('grid')
      expect(result.elementCount).toBe(4)
      expect(result.meta).toMatchObject({ columns: 2, rows: 2 })
    })

    it('auto-calculates columns', () => {
      const elements = Array.from({ length: 9 }, (_, i) =>
        makeElement({ id: `el-${i}`, x: 0, y: 0 })
      )

      const result = computeGridLayout(elements)

      expect(result.elementCount).toBe(9)
      expect(result.meta).toMatchObject({ columns: 3, rows: 3 })
    })
  })

  describe('computeLayout (main entry)', () => {
    it('defaults to dagre', () => {
      const elements = [makeElement({ id: 'a' })]

      const result = computeLayout(elements)

      expect(result.algorithm).toBe('dagre')
    })

    it('filters by elementIds', () => {
      const elements = [
        makeElement({ id: 'a', x: 0, y: 0 }),
        makeElement({ id: 'b', x: 0, y: 0 }),
      ]

      const result = computeLayout(elements, { elementIds: ['a'] })

      expect(result.elementCount).toBe(1)
      expect(result.positions[0].id).toBe('a')
    })

    it('excludes arrows from layout', () => {
      const elements = [
        makeElement({ id: 'a' }),
        makeArrow('a', 'b'),
      ]

      const result = computeLayout(elements)

      expect(result.elementCount).toBe(1)
    })
  })
})

describe('SVG Export', () => {
  it('generates valid SVG', () => {
    const elements = [
      makeElement({ id: 'rect1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, text: 'Hello' }),
    ]

    const svg = generateSvg(elements)

    expect(svg).toContain('<svg')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('<rect')
    expect(svg).toContain('Hello')
  })

  it('includes background when requested', () => {
    const elements = [makeElement()]

    const svgWithBg = generateSvg(elements, true)
    const svgWithoutBg = generateSvg(elements, false)

    expect(svgWithBg).toContain('<rect x=')
    expect(svgWithoutBg).not.toMatch(/<rect x=.*fill="white"/)
  })

  it('renders different shape types', () => {
    const elements = [
      makeElement({ id: 'rect', type: 'rectangle' }),
      makeElement({ id: 'ell', type: 'ellipse' }),
      makeElement({ id: 'dia', type: 'diamond' }),
      makeElement({ id: 'tri', type: 'triangle' }),
    ]

    const svg = generateSvg(elements)

    expect(svg).toContain('<rect')
    expect(svg).toContain('<ellipse')
    expect(svg).toContain('<polygon')
  })

  it('renders arrows between shapes', () => {
    const elements = [
      makeElement({ id: 'a', x: 0, y: 0 }),
      makeElement({ id: 'b', x: 200, y: 0 }),
      makeArrow('a', 'b'),
    ]

    const svg = generateSvg(elements)

    expect(svg).toContain('<line')
  })
})
