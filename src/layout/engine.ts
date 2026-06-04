import type { CanvasElement } from '../types.js'
import type { LayoutOptions, LayoutResult } from './types.js'
import { DEFAULT_OPTIONS } from './types.js'
import { computeDagreLayout } from './dagre.js'
import { computeForceLayout } from './force.js'
import { computeGridLayout } from './grid.js'

export function computeLayout(
  elements: CanvasElement[],
  options: Partial<LayoutOptions> = {}
): LayoutResult {
  const algorithm = options.algorithm ?? 'dagre'
  const mergedOptions: LayoutOptions = {
    ...DEFAULT_OPTIONS[algorithm],
    ...options,
    algorithm,
  }

  const elementsToLayout = mergedOptions.elementIds && mergedOptions.elementIds.length > 0
    ? elements.filter((el) => mergedOptions.elementIds!.includes(el.id))
    : elements.filter((el) => el.type !== 'arrow' && el.type !== 'line')

  switch (algorithm) {
    case 'dagre':
      return computeDagreLayout(elementsToLayout, mergedOptions)
    case 'force':
      return computeForceLayout(elementsToLayout, mergedOptions)
    case 'grid':
      return computeGridLayout(elementsToLayout, mergedOptions)
    default:
      throw new Error(`Unknown layout algorithm: ${algorithm}`)
  }
}

export function computeLayoutWithArrows(
  elements: CanvasElement[],
  options: Partial<LayoutOptions> = {}
): LayoutResult {
  return computeLayout(elements, options)
}
