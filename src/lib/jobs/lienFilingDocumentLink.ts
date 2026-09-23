/**
 * The saved copy on a lien filing (v2.3763, punch list #35 PR 1): a link to
 * the paper as it went out or was filed — a Drive link, plain text — and a
 * line beside it. Pure: the URL rule, the words, and the insert/update
 * payload (keys only when they carry a value, so a client deployed before
 * the push still records — the column is what the push adds).
 */

/** The two columns as the client reads them; absent on rows typed before the regen. */
export type LienFilingDocument = { document_url?: string | null; document_note?: string | null }

/** Trim; take http(s) as typed; give a bare host or path a scheme; anything else (a note, "n/a") is no link. */
export function normalizeDocumentUrl(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s) && !/\s/.test(s)) return `https://${s}`
  return ''
}

/** Where the copy lives, from the host: "Drive", "Dropbox", "OneDrive", else the host itself. */
export function documentHostWord(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (/(^|\.)(drive|docs)\.google\.com$/.test(host)) return 'Drive'
    if (/dropbox\.com$/.test(host)) return 'Dropbox'
    if (/(1drv\.ms|onedrive\.live\.com|sharepoint\.com)$/.test(host)) return 'OneDrive'
    return host
  } catch {
    return ''
  }
}

/** "Saved copy · Drive" / "Saved copy · Drive — the scan with the green card" — '' when there is no link. */
export function documentLinkWords(doc: LienFilingDocument | null | undefined): string {
  const url = normalizeDocumentUrl(doc?.document_url)
  if (!url) return (doc?.document_note ?? '').trim() ? `Note: ${(doc?.document_note ?? '').trim()}` : ''
  const host = documentHostWord(url)
  const note = (doc?.document_note ?? '').trim()
  return `Saved copy${host ? ` · ${host}` : ''}${note ? ` — ${note}` : ''}`
}

/** The insert/update keys — only the ones that carry a value. */
export function filingDocumentPayload(input: { url?: string | null; note?: string | null }, opts: { clear?: boolean } = {}): Record<string, string> {
  const url = normalizeDocumentUrl(input.url)
  const note = (input.note ?? '').trim()
  if (opts.clear) return { document_url: url, document_note: note }
  return { ...(url ? { document_url: url } : {}), ...(note ? { document_note: note } : {}) }
}
