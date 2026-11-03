/**
 * Our own OCR for scans (punch list #240, PR 3): the rules, pure, so `src/lib/documents/ocrKernel.test.ts` reads them as
 * `_shared/ocr.ts` does. The provider is Google Document AI's Document OCR processor (the card's recommended default),
 * named by the secret `GOOGLE_DOCAI_PROCESSOR` (`projects/<n>/locations/<loc>/processors/<id>`); this file knows which
 * files it takes, where its endpoint is, what one request carries, how its answer and its refusal read, and when a
 * scan is tried again. No imports.
 */

/** Pages OCR'd per file: Document AI's online limit for the OCR processor, and the card's cost cap for the backfill. */
export const OCR_MAX_PAGES = 15
/** Over this a file is not sent: the online request limit. */
export const OCR_MAX_BYTES = 20 * 1024 * 1024
/** A scan that OCR could not read is tried again after this long, so a provider blip costs a day, never a loop. */
export const OCR_RETRY_MS = 24 * 60 * 60 * 1000
/** The secret that names the processor; unset means OCR is not set up and every scan stays `scan`. */
export const OCR_PROCESSOR_SECRET = 'GOOGLE_DOCAI_PROCESSOR'
/** The scope the service account's token needs for Document AI. */
export const OCR_TOKEN_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'
/** The processor's answer is waited for this long; past it the scan is refused for the day, never a request held open. */
export const OCR_READ_MS = 20_000
/** OCR calls one index pass makes at most, whoever runs it (a press, the backfill, the sweep's first step): the rest of a pass's scans wait for the next call, so one pass never spends the request's CPU on base64 and the provider's answers, and the spend is paced. */
export const OCR_PER_PASS_MAX = 5
/** The fields the answer carries: the text and the page numbers alone, never each page's image or its layout. */
export const OCR_FIELD_MASK = 'text,pages.pageNumber'
/** The `mime` values a row may hold that Document AI reads, for the sweep's queue; a kind outside it is never due. */
export const OCR_MIMES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/gif', 'image/bmp', 'image/webp'] as const
/** The note a scan of a kind Document AI does not read keeps, so its row says why it stays a scan. */
export const OCR_KIND_NOTE = 'A kind Document AI does not read (HEIC, HEIF, SVG, …); the scan stays a scan.'

/** The kinds Document AI reads: a PDF and the common pictures. Null for a kind it refuses (HEIC among them). */
export function ocrMimeOf(f: { name: string; mimeType: string }): string | null {
  const mime = f.mimeType.toLowerCase()
  const name = f.name.toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'application/pdf'
  if (mime === 'image/jpeg' || mime === 'image/jpg' || /\.jpe?g$/.test(name)) return 'image/jpeg'
  if (mime === 'image/png' || name.endsWith('.png')) return 'image/png'
  if (mime === 'image/tiff' || /\.tiff?$/.test(name)) return 'image/tiff'
  if (mime === 'image/gif' || name.endsWith('.gif')) return 'image/gif'
  if (mime === 'image/bmp' || name.endsWith('.bmp')) return 'image/bmp'
  if (mime === 'image/webp' || name.endsWith('.webp')) return 'image/webp'
  return null
}

/** Whether Document AI can take this file at all: a kind it reads, within the inline cap. One it cannot take is stamped once with the reason and is never due again. */
export function ocrTakes(f: { name: string; mimeType: string; size?: string | null }): boolean {
  if (!ocrMimeOf(f)) return false
  const bytes = f.size == null || f.size === '' ? 0 : Number(f.size) || 0
  return bytes <= OCR_MAX_BYTES
}

/** The processor name's shape, and the endpoint it answers at: the location is the host's prefix. */
export function ocrEndpoint(processor: string): { ok: true; url: string; location: string } | { ok: false; error: string } {
  const m = /^projects\/([^/]+)\/locations\/([a-z0-9-]+)\/processors\/([A-Za-z0-9_-]+)$/.exec(processor.trim())
  if (!m) return { ok: false, error: `${OCR_PROCESSOR_SECRET} must read projects/<number>/locations/<location>/processors/<id>; it reads "${processor.slice(0, 60)}".` }
  const location = m[2]!
  return { ok: true, url: `https://${location}-documentai.googleapis.com/v1/${m[0]}:process`, location }
}

/** One request: the bytes inline, no human review, the first pages alone, the text and the page numbers back and no page images. */
export function ocrRequestBody(contentBase64: string, mime: string, maxPages = OCR_MAX_PAGES): Record<string, unknown> {
  return {
    rawDocument: { content: contentBase64, mimeType: mime },
    skipHumanReview: true,
    fieldMask: OCR_FIELD_MASK,
    imagelessMode: true,
    processOptions: { fromStart: maxPages },
  }
}

export type OcrAnswer = { ok: true; text: string; pages: number } | { ok: false; error: string }

/** Document AI's answer as the index reads it: the text and the page count, or its own reason in one line. */
export function ocrReadAnswer(status: number, body: unknown): OcrAnswer {
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const err = o.error && typeof o.error === 'object' ? (o.error as Record<string, unknown>) : null
  if (status < 200 || status >= 300 || err) {
    const code = err && typeof err.status === 'string' ? err.status : `HTTP ${status}`
    const message = err && typeof err.message === 'string' ? err.message : typeof body === 'string' ? body.slice(0, 300) : 'no reason given'
    return { ok: false, error: `Document AI answered ${code}: ${message}`.slice(0, 1000) }
  }
  const doc = o.document && typeof o.document === 'object' ? (o.document as Record<string, unknown>) : null
  if (!doc) return { ok: false, error: 'Document AI answered with no document.' }
  const text = typeof doc.text === 'string' ? doc.text : ''
  const pages = Array.isArray(doc.pages) ? doc.pages.length : 0
  return { ok: true, text, pages }
}

/** Whether a scan's row is due for OCR: never tried, or tried longer ago than the retry window. */
export function ocrDue(ocrTriedAt: string | null | undefined, now: Date, retryMs = OCR_RETRY_MS): boolean {
  if (!ocrTriedAt) return true
  const t = Date.parse(ocrTriedAt)
  return !Number.isFinite(t) || now.getTime() - t >= retryMs
}

/** The words the probe and the report use for the provider's state. */
export function ocrStateWords(processorSet: boolean): string {
  return processorSet ? 'OCR is set up: Document AI reads scans into the index.' : `OCR is not set up: set the secret ${OCR_PROCESSOR_SECRET} to the Document OCR processor (docs/DRIVE_INTAKE_SETUP.md → Our own OCR) and every scan is read from then on.`
}
