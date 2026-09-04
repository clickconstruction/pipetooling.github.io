import { useEffect, useRef } from 'react'

/**
 * One PDF page rendered to a canvas with pdf.js (lazy-imported so the main
 * bundle does not pay for it). `scale` is CSS px per PDF point, the same
 * number the box layer uses, so boxes and the page line up.
 *
 * pdf.js takes ownership of the bytes it is handed (they are transferred to
 * the worker), so a copy is passed each time the document is opened.
 */

type Pdfjs = typeof import('pdfjs-dist')
type PdfDoc = Awaited<ReturnType<Pdfjs['getDocument']>['promise']>

let pdfjsPromise: Promise<Pdfjs> | null = null
const docCache = new WeakMap<ArrayBuffer, Promise<PdfDoc>>()

function loadPdfjs(): Promise<Pdfjs> {
  if (pdfjsPromise) return pdfjsPromise
  pdfjsPromise = (async () => {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    return pdfjs
  })()
  return pdfjsPromise
}

function openPdfDocument(bytes: ArrayBuffer): Promise<PdfDoc> {
  const cached = docCache.get(bytes)
  if (cached) return cached
  const p = loadPdfjs().then((pdfjs) => pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise)
  docCache.set(bytes, p)
  return p
}

export function PdfPageCanvas({ bytes, page, scale, onRendered, className }: { bytes: ArrayBuffer; page: number; scale: number; onRendered?: (size: { width: number; height: number }) => void; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onRenderedRef = useRef(onRendered)
  onRenderedRef.current = onRendered

  useEffect(() => {
    let cancelled = false
    let task: { cancel(): void } | null = null
    void (async () => {
      try {
        const doc = await openPdfDocument(bytes)
        if (cancelled) return
        const pdfPage = await doc.getPage(Math.min(Math.max(1, page), doc.numPages))
        if (cancelled) return
        const viewport = pdfPage.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        const ratio = Math.min(2, window.devicePixelRatio || 1)
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        const render = pdfPage.render({ canvas, canvasContext: ctx, viewport })
        task = render
        await render.promise
        if (!cancelled) onRenderedRef.current?.({ width: viewport.width, height: viewport.height })
      } catch (e) {
        if (!cancelled && !(e instanceof Error && /cancel/i.test(e.message))) console.error('pdf render failed', e)
      }
    })()
    return () => {
      cancelled = true
      try {
        task?.cancel()
      } catch {
        /* already done */
      }
    }
  }, [bytes, page, scale])

  return <canvas ref={canvasRef} className={className} aria-label={`Page ${page}`} style={{ display: 'block' }} />
}
