import type { CanvasElement } from '../types.js'

const PLAYWRIGHT_TIMEOUT = 15_000

const SVG_NS = 'http://www.w3.org/2000/svg'

const COLOR_MAP: Record<string, string> = {
  black: '#1d1d1d',
  grey: '#a4a4a4',
  blue: '#3b82f6',
  'light-blue': '#93c5fd',
  violet: '#8b5cf6',
  'light-violet': '#c4b5fd',
  red: '#ef4444',
  'light-red': '#fca5a5',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  'light-green': '#86efac',
  white: '#ffffff',
}

function getColor(color: string | undefined): string {
  return COLOR_MAP[color ?? 'black'] ?? '#1d1d1d'
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface SvgBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function computeBounds(elements: CanvasElement[]): SvgBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const el of elements) {
    if (el.type === 'arrow' || el.type === 'line') {
      if (el.startElementId || el.endElementId) continue
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + 1)
      maxY = Math.max(maxY, el.y + 1)
      continue
    }

    minX = Math.min(minX, el.x)
    minY = Math.min(minY, el.y)
    maxX = Math.max(maxX, el.x + (el.width ?? 160))
    maxY = Math.max(maxY, el.y + (el.height ?? 80))
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 }
  }

  const padding = 40
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  }
}

function renderShape(el: CanvasElement): string {
  const x = el.x
  const y = el.y
  const w = el.width ?? 160
  const h = el.height ?? 80
  const color = getColor(el.color)
  const fill = el.fill === 'solid' ? color : el.fill === 'semi' ? `${color}40` : 'none'
  const stroke = color
  const strokeWidth = el.dash === 'dashed' ? 2 : el.dash === 'dotted' ? 2 : 2
  const strokeDash = el.dash === 'dashed' ? '8 4' : el.dash === 'dotted' ? '4 4' : 'none'

  let shape = ''

  switch (el.type) {
    case 'rectangle':
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash !== 'none' ? `stroke-dasharray="${strokeDash}"` : ''}/>`
      break
    case 'ellipse':
      shape = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash !== 'none' ? `stroke-dasharray="${strokeDash}"` : ''}/>`
      break
    case 'diamond':
      shape = `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash !== 'none' ? `stroke-dasharray="${strokeDash}"` : ''}/>`
      break
    case 'triangle':
      shape = `<polygon points="${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash !== 'none' ? `stroke-dasharray="${strokeDash}"` : ''}/>`
      break
    case 'note':
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill || '#fef08a'}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
      break
    case 'star': {
      const cx = x + w / 2
      const cy = y + h / 2
      const outerR = Math.min(w, h) / 2
      const innerR = outerR * 0.4
      const points: string[] = []
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 72 - 90) * (Math.PI / 180)
        const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180)
        points.push(`${cx + outerR * Math.cos(outerAngle)},${cy + outerR * Math.sin(outerAngle)}`)
        points.push(`${cx + innerR * Math.cos(innerAngle)},${cy + innerR * Math.sin(innerAngle)}`)
      }
      shape = `<polygon points="${points.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
      break
    }
    case 'hexagon': {
      const cx = x + w / 2
      const cy = y + h / 2
      const rx = w / 2
      const ry = h / 2
      const points: string[] = []
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * (Math.PI / 180)
        points.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`)
      }
      shape = `<polygon points="${points.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
      break
    }
    case 'cloud': {
      const cx = x + w / 2
      const cy = y + h / 2
      const rx = w / 2 * 0.8
      const ry = h / 2 * 0.7
      shape = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
      break
    }
    default:
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
  }

  return shape
}

function renderText(el: CanvasElement): string {
  if (!el.text) return ''

  const x = el.x + (el.width ?? 160) / 2
  const y = el.y + (el.height ?? 80) / 2
  const color = getColor(el.color)
  const fontSize = el.size === 's' ? 12 : el.size === 'l' ? 20 : el.size === 'xl' ? 24 : 16

  const lines = el.text.split('\n')
  const lineHeight = fontSize * 1.2
  const startY = y - ((lines.length - 1) * lineHeight) / 2

  return lines
    .map((line, i) => `<text x="${x}" y="${startY + i * lineHeight}" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="${fontSize}" font-family="sans-serif">${escapeXml(line)}</text>`)
    .join('\n  ')
}

function renderArrow(
  el: CanvasElement,
  elementMap: Map<string, CanvasElement>
): string {
  if (!el.startElementId || !el.endElementId) return ''

  const from = elementMap.get(el.startElementId)
  const to = elementMap.get(el.endElementId)
  if (!from || !to) return ''

  const fromCx = from.x + (from.width ?? 160) / 2
  const fromCy = from.y + (from.height ?? 80) / 2
  const toCx = to.x + (to.width ?? 160) / 2
  const toCy = to.y + (to.height ?? 80) / 2

  const color = getColor(el.color)
  const strokeWidth = 2
  const strokeDash = el.dash === 'dashed' ? '8 4' : el.dash === 'dotted' ? '4 4' : 'none'

  let markerEnd = ''
  if (el.endArrowhead && el.endArrowhead !== 'none') {
    markerEnd = `marker-end="url(#arrowhead-${el.id})"`
  }

  const markerDef = el.endArrowhead && el.endArrowhead !== 'none'
    ? `<marker id="arrowhead-${el.id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${color}"/></marker>`
    : ''

  const line = `<line x1="${fromCx}" y1="${fromCy}" x2="${toCx}" y2="${toCy}" stroke="${color}" stroke-width="${strokeWidth}" ${strokeDash !== 'none' ? `stroke-dasharray="${strokeDash}"` : ''} ${markerEnd}/>`

  return markerDef + '\n  ' + line
}

export function generateSvg(elements: CanvasElement[], background = true): string {
  const bounds = computeBounds(elements)
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY

  const elementMap = new Map(elements.map((el) => [el.id, el]))

  const shapes: string[] = []
  const arrows: string[] = []
  const texts: string[] = []

  for (const el of elements) {
    if (el.type === 'arrow' || el.type === 'line') {
      arrows.push(renderArrow(el, elementMap))
    } else {
      shapes.push(renderShape(el))
      const textEl = renderText(el)
      if (textEl) texts.push(textEl)
    }
  }

  return `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="${bounds.minX} ${bounds.minY} ${width} ${height}">
  ${background ? `<rect x="${bounds.minX}" y="${bounds.minY}" width="${width}" height="${height}" fill="white"/>` : ''}
  <g>
    ${shapes.join('\n    ')}
  </g>
  <g>
    ${arrows.join('\n    ')}
  </g>
  <g>
    ${texts.join('\n    ')}
  </g>
</svg>`
}

/**
 * Server-side PNG export using Playwright.
 * Works without a browser open — uses the SVG generator + headless Chromium.
 */
export async function exportPng(elements: CanvasElement[], background = true): Promise<{ data: string; format: string }> {
  return exportRasterImage(elements, 'png', background)
}

/**
 * Server-side JPEG export using Playwright.
 * Works without a browser open — uses the SVG generator + headless Chromium.
 */
export async function exportJpg(elements: CanvasElement[], background = true): Promise<{ data: string; format: string }> {
  return exportRasterImage(elements, 'jpeg', background)
}

async function exportRasterImage(
  elements: CanvasElement[],
  type: 'png' | 'jpeg',
  background: boolean
): Promise<{ data: string; format: string }> {
  const svg = generateSvg(elements, background)

  let playwright: typeof import('playwright') | null = null
  try {
    playwright = await import('playwright')
  } catch {
    throw new Error(
      'Playwright is not installed. Install it with: npm install playwright && npx playwright install chromium'
    )
  }

  const browser = await playwright.chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()

    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${background ? '#ffffff' : 'transparent'}; }
  svg { display: block; }
</style>
</head>
<body>${svg}</body>
</html>`

    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)

    const data = await page.screenshot({ type, omitBackground: !background })
    return { data: Buffer.from(data).toString('base64'), format: type === 'jpeg' ? 'jpg' : 'png' }
  } finally {
    await browser.close()
  }
}
