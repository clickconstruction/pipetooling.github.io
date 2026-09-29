/**
 * Page thumbnails for the sheet strip (Submittals stage 3a): every page of a
 * dropped vendor PDF as a small JPEG data URL, rendered with pdf.js through the
 * shared opener (`lib/pdfjsDocument.ts`: lazy import, worker from the bundle, the
 * wasm / CMap / font directories named so scanned pages decode, v2.4192).
 * Pure browser work; the strip's render smoke mocks it.
 */

import { getPdfDocument, getPdfLoadingTask } from '../pdfjsDocument'

/**
 * A vendor PDF opened once for the Assign pages walk (v2.4143): the page count, any page
 * drawn at a width, and any page's text (pdf.js text content joined with spaces). Call
 * `destroy` when the modal closes.
 */
export type OpenPdf = {
  numPages: number
  renderPage(page: number, width: number, quality?: number): Promise<string>
  pageText(page: number): Promise<string>
  destroy(): void
}

export async function openPdf(bytes: ArrayBuffer): Promise<OpenPdf> {
  const task = await getPdfLoadingTask(bytes)
  const doc = await task.promise
  return {
    numPages: doc.numPages,
    async renderPage(p, width, quality = 0.8) {
      const page = await doc.getPage(p)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: width / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas')
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      return canvas.toDataURL('image/jpeg', quality)
    },
    async pageText(p) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      return content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
    },
    destroy() {
      void task.destroy()
    },
  }
}

/** One data URL per page, in order; `width` is the thumbnail's CSS width in px. */
export async function renderPdfThumbnails(bytes: ArrayBuffer, width = 112, onPage?: (index: number, dataUrl: string) => void): Promise<string[]> {
  const doc = await getPdfDocument(bytes)
  const out: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const base = page.getViewport({ scale: 1 })
    const scale = width / base.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const url = canvas.toDataURL('image/jpeg', 0.6)
    out.push(url)
    onPage?.(p - 1, url)
  }
  return out
}
