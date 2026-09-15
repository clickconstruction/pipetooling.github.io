/**
 * Page thumbnails for the sheet strip (Submittals stage 3a): every page of a
 * dropped vendor PDF as a small JPEG data URL, rendered with pdf.js the way
 * the Form Studio's page canvas does (lazy import, worker from the bundle).
 * Pure browser work; the strip's render smoke mocks it.
 */

type Pdfjs = typeof import('pdfjs-dist')

let pdfjsPromise: Promise<Pdfjs> | null = null

function loadPdfjs(): Promise<Pdfjs> {
  if (pdfjsPromise) return pdfjsPromise
  pdfjsPromise = (async () => {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    return pdfjs
  })()
  return pdfjsPromise
}

/** One data URL per page, in order; `width` is the thumbnail's CSS width in px. */
export async function renderPdfThumbnails(bytes: ArrayBuffer, width = 112, onPage?: (index: number, dataUrl: string) => void): Promise<string[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
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
