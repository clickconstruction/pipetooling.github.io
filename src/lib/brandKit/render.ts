/**
 * Cards and footers (punch list #313) — from a drawing to a file, in the browser.
 *
 * `drawKit` returns an SVG string. A person needs a picture to upload as a mail signature and
 * a PDF to hand a print shop. A browser turns an SVG into pixels by drawing it onto a canvas
 * as an image, and an image may not reach outside itself: no web font, no linked picture. So
 * before a drawing is made into a file, the font is written into it as data, and the kit's
 * pictures are handed to `drawKit` as data too.
 *
 * The page's own previews use the same data, so what a person sees is what they download.
 */
import type { KitDrawOptions } from './draw'
import { KIT_ASSET_PATHS, KIT_FONT_FAMILY, KIT_FONT_FILES } from './assets'
import type { KitAsset } from './layouts'

/** What a screen needs to draw and to make files. Injected, so a test hands in a fake. */
export interface KitRenderer {
  /** The kit's pictures as data, and the real font's measure. Loads the font once. */
  ready(): Promise<Required<Pick<KitDrawOptions, 'assets' | 'measure'>>>
  /** The drawing as a PNG, `width` by `height` pixels. */
  png(svg: string, width: number, height: number): Promise<Blob>
  /** The drawings as the pages of one PDF, each `widthIn` by `heightIn` inches at `dpi`. */
  pdf(pages: KitPdfPage[]): Promise<Blob>
}

export type KitPdfPage = { svg: string; widthIn: number; heightIn: number; dpi: number }

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'))
    reader.readAsDataURL(blob)
  })
}

async function fetchDataUrl(path: string): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`)
  if (!res.ok) throw new Error(`The file ${path} did not load.`)
  return blobToDataUrl(await res.blob())
}

/** The `<style>` that carries the font inside a drawing, as data. */
export function fontStyleTag(fonts: { cssWeight: number; dataUrl: string }[]): string {
  const faces = fonts.map((f) => `@font-face{font-family:'${KIT_FONT_FAMILY}';font-weight:${f.cssWeight};src:url(${f.dataUrl}) format('woff2');}`).join('')
  return `<style>${faces}</style>`
}

/** The drawing with the font written into it, right after its opening tag. */
export function withFonts(svg: string, styleTag: string): string {
  const at = svg.indexOf('>')
  return at < 0 ? svg : svg.slice(0, at + 1) + styleTag + svg.slice(at + 1)
}

/** The drawing at an exact pixel size, whatever width it was drawn for. */
export function sizedSvg(svg: string, width: number, height: number): string {
  const open = svg.slice(0, svg.indexOf('>') + 1)
  const cleaned = open.replace(/\s(width|height)="[^"]*"/g, '')
  return cleaned.replace(/^<svg/, `<svg width="${width}" height="${height}"`) + svg.slice(open.length)
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

/** The renderer the app uses: the files under `public/`, the page's canvas, pdf-lib loaded when a PDF is asked for. */
export function browserKitRenderer(): KitRenderer {
  let loading: Promise<{ assets: Record<KitAsset, string>; styleTag: string }> | null = null
  let measureCtx: CanvasRenderingContext2D | null = null

  const load = () => {
    loading ??= (async () => {
      const [mark, cardFrontPhoto, ...fonts] = await Promise.all([
        fetchDataUrl(KIT_ASSET_PATHS.mark),
        fetchDataUrl(KIT_ASSET_PATHS.cardFrontPhoto),
        ...KIT_FONT_FILES.map((f) => fetchDataUrl(f.path)),
      ])
      const faces = KIT_FONT_FILES.map((f, i) => ({ cssWeight: f.cssWeight, dataUrl: fonts[i] ?? '' }))
      // the page's own previews set their words in the same font
      await Promise.all(
        faces.map(async (f) => {
          const face = new FontFace(KIT_FONT_FAMILY, `url(${f.dataUrl})`, { weight: String(f.cssWeight) })
          document.fonts.add(await face.load())
        }),
      )
      return { assets: { mark: mark ?? '', cardFrontPhoto: cardFrontPhoto ?? '' }, styleTag: fontStyleTag(faces) }
    })().catch((e) => {
      loading = null
      throw e
    })
    return loading
  }

  const measure = (text: string, weight: number, size: number): number => {
    measureCtx ??= document.createElement('canvas').getContext('2d')
    if (!measureCtx) return text.length * size * 0.6
    measureCtx.font = `${weight} ${size}px '${KIT_FONT_FAMILY}'`
    return measureCtx.measureText(text).width
  }

  const canvasOf = async (svg: string, width: number, height: number): Promise<HTMLCanvasElement> => {
    const { styleTag } = await load()
    const url = URL.createObjectURL(new Blob([withFonts(sizedSvg(svg, width, height), styleTag)], { type: 'image/svg+xml' }))
    try {
      const img = new Image()
      img.decoding = 'sync'
      img.src = url
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('This browser could not draw the picture.')
      // Safari may draw an SVG's own font and pictures a beat late, so draw, wait, and draw again.
      ctx.drawImage(img, 0, 0, width, height)
      await wait(120)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      return canvas
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const pngOf = async (svg: string, width: number, height: number): Promise<Blob> => {
    const canvas = await canvasOf(svg, width, height)
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This browser could not make the picture.'))), 'image/png'))
  }

  return {
    async ready() {
      const { assets } = await load()
      return { assets, measure }
    },
    png: pngOf,
    async pdf(pages) {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      for (const p of pages) {
        const png = await pngOf(p.svg, Math.round(p.widthIn * p.dpi), Math.round(p.heightIn * p.dpi))
        const img = await doc.embedPng(await png.arrayBuffer())
        const page = doc.addPage([p.widthIn * 72, p.heightIn * 72])
        page.drawImage(img, { x: 0, y: 0, width: p.widthIn * 72, height: p.heightIn * 72 })
      }
      const bytes = await doc.save()
      return new Blob([bytes as BlobPart], { type: 'application/pdf' })
    },
  }
}
