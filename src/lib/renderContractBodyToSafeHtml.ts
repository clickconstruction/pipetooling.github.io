import { sanitizeContractSigningHtml } from './sanitizeContractSigningHtml'
import { markdownSourceToSafeHtml, parseContractBodyFormat } from './contractBodyFormat'

/** HTML-escape text for safe interpolation into an HTML string (titles, plain bodies). */
export function escapeHtmlText(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render a stored contract body (+ its format) to a safe HTML *fragment string*.
 *
 * Single source of truth shared by the in-modal `ContractBodyDisplay`, the
 * Contract Book full-page preview tab, and the rich-text (.doc) export — so all
 * three render a given entry identically.
 *
 * - `plain`    → HTML-escaped text wrapped so whitespace/newlines are preserved.
 * - `markdown` → marked → allowlist-sanitized HTML (`markdownSourceToSafeHtml`).
 * - `html`     → allowlist-sanitized HTML (`sanitizeContractSigningHtml`).
 *
 * Returns `''` when there is nothing renderable. Mirrors the format branching
 * that `ContractBodyDisplay` and `contractBodyHasRenderableDisplay` use.
 */
/**
 * v2.4150: in a plain body, `**a sentence**` is a statutory sentence — printed at 10 pt (the size
 * Texas names for an owner's waiver, Prop. Code § 53.256), regular weight, the asterisks dropped.
 * The only markup a plain body carries; a lone `**` stays as typed. The signed PDF prints the
 * same run at 10 pt through `parseStatutoryRuns` in `_shared/jobContractPdf.ts`.
 */
export const STATUTORY_SENTENCE_RE = /\*\*([^*\n]+?)\*\*/g

/** Wrap each `**…**` of already-escaped plain text in the statutory span. */
export function statutorySpans(escaped: string): string {
  return escaped.replace(STATUTORY_SENTENCE_RE, '<span class="statutory" style="font-size:max(10pt, 1em)">$1</span>')
}

export function renderContractBodyToSafeHtml(
  body: string | null | undefined,
  format: string | null | undefined,
): string {
  const raw = (body ?? '').trim()
  if (!raw) return ''
  const f = parseContractBodyFormat(format)
  if (f === 'plain') {
    return `<div style="white-space:pre-wrap;word-break:break-word">${statutorySpans(escapeHtmlText(raw))}</div>`
  }
  if (f === 'markdown') {
    return markdownSourceToSafeHtml(raw)
  }
  return sanitizeContractSigningHtml(raw)
}
