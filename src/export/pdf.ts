import type { CanvasElement } from '../types.js'
import { generateSvg } from './svg.js'

export interface PdfExportOptions {
  background?: boolean
  format?: 'a4' | 'letter' | 'legal'
  landscape?: boolean
  scale?: number
}

interface PaperSize {
  width: number
  height: number
}

const PAPER_SIZES: Record<string, PaperSize> = {
  a4: { width: 210, height: 297 },
  letter: { width: 216, height: 279 },
  legal: { width: 216, height: 356 },
}

async function convertSvgToPdfWithPlaywright(
  svg: string,
  options: PdfExportOptions
): Promise<Buffer> {
  const playwright = await import('playwright').catch(() => null)
  if (!playwright) {
    throw new Error('Playwright not installed. Install with: npm install playwright')
  }

  const browser = await playwright.chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()

    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; }
    svg { display: block; }
  </style>
</head>
<body>${svg}</body>
</html>`

    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)

    const paper = PAPER_SIZES[options.format ?? 'a4']
    const isLandscape = options.landscape ?? false
    const pageWidth = isLandscape ? paper.height : paper.width
    const pageHeight = isLandscape ? paper.width : paper.height

    const pdf = await page.pdf({
      width: `${pageWidth}mm`,
      height: `${pageHeight}mm`,
      printBackground: options.background ?? true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

async function convertSvgToPdfWithPdfLib(
  svg: string,
  _options: PdfExportOptions
): Promise<Buffer> {
  const pdfLib = await import('pdf-lib')
  const { PDFDocument } = pdfLib

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])

  page.drawText('SVG Export (PDF-lib fallback)', {
    x: 50,
    y: 750,
    size: 12,
  })

  page.drawText('Full SVG rendering requires Playwright.', {
    x: 50,
    y: 730,
    size: 10,
  })

  page.drawText('Install playwright for high-fidelity PDF export.', {
    x: 50,
    y: 710,
    size: 10,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export async function exportPdf(
  elements: CanvasElement[],
  options: PdfExportOptions = {}
): Promise<{ buffer: Buffer; format: string }> {
  const svg = generateSvg(elements, options.background)

  let buffer: Buffer
  try {
    buffer = await convertSvgToPdfWithPlaywright(svg, options)
  } catch {
    buffer = await convertSvgToPdfWithPdfLib(svg, options)
  }

  return { buffer, format: 'pdf' }
}

export async function exportSvg(
  elements: CanvasElement[],
  background = true
): Promise<{ svg: string; format: string }> {
  const svg = generateSvg(elements, background)
  return { svg, format: 'svg' }
}
