/**
 * One way to open a PDF with pdf.js in the browser (v2.4192): the library loaded lazily,
 * the worker from the bundle, and the run-time asset directories (`src/lib/pdfjsAssets.ts`)
 * named on every document so scanned (JBIG2 / JPEG 2000) pages decode instead of
 * rendering blank. The Submittals thumbnails and walk, the Form Studio's page canvas and
 * the RFQ reply reader all open documents here.
 */
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'

import { pdfjsDocumentOptions } from './pdfjsAssets'

type Pdfjs = typeof import('pdfjs-dist')

let pdfjsPromise: Promise<Pdfjs> | null = null

export function loadPdfjs(): Promise<Pdfjs> {
  if (pdfjsPromise) return pdfjsPromise
  pdfjsPromise = (async () => {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    return pdfjs
  })()
  return pdfjsPromise
}

/**
 * Start loading a document from its bytes (copied, so pdf.js's transfer never detaches
 * the caller's buffer). The task is what closes the document: `task.destroy()`.
 */
export async function getPdfLoadingTask(bytes: ArrayBuffer): Promise<PDFDocumentLoadingTask> {
  const pdfjs = await loadPdfjs()
  return pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), ...pdfjsDocumentOptions(import.meta.env.BASE_URL) })
}

/** The loaded document, for a caller that reads it and lets it go with the page. */
export async function getPdfDocument(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  return (await getPdfLoadingTask(bytes)).promise
}
