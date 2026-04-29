/** Mirrors `accept-estimate` Edge Function PNG body cap — raw decoded bytes after base64. */
export const REPORT_SIGNATURE_MAX_DECODED_BYTES = 524_288

/** Placeholder when a signature is stored but must not be inlined as text. */
export const REPORT_SIGNATURE_ON_FILE = '[Signature on file]'

export function isReportSignatureImageDataUrl(s: string): boolean {
  const t = (s ?? '').trim()
  return t.startsWith('data:image/') && t.includes(';base64,')
}

/** Byte length of the decoded PNG (or null if not a valid data URL). */
export function reportSignatureDataUrlDecodedByteLength(dataUrl: string): number | null {
  const t = dataUrl.trim()
  const idx = t.indexOf(';base64,')
  if (idx === -1) return null
  const b64 = t.slice(idx + ';base64,'.length)
  try {
    const bin = atob(b64)
    return bin.length
  } catch {
    return null
  }
}

/** `null` = ok; otherwise a user-facing validation message. */
export function validateReportSignatureDataUrlForSubmit(dataUrl: string): string | null {
  const t = dataUrl.trim()
  if (!t) return 'Please sign in the signature box.'
  if (!/^data:image\/png;base64,/i.test(t)) return 'Signature must be a PNG image.'
  const len = reportSignatureDataUrlDecodedByteLength(t)
  if (len == null) return 'Invalid signature data.'
  if (len > REPORT_SIGNATURE_MAX_DECODED_BYTES) {
    return 'Signature image is too large. Clear and try a smaller drawing.'
  }
  return null
}

/** Expandable-row / dashboard one-line previews (omit megabyte base64). */
export function formatReportFieldValueInlineList(val: unknown): string {
  const v = String(val ?? '').trim()
  if (!v) return ''
  return isReportSignatureImageDataUrl(v) ? REPORT_SIGNATURE_ON_FILE : v
}
