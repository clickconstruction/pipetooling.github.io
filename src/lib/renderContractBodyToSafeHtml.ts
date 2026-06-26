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
export function renderContractBodyToSafeHtml(
  body: string | null | undefined,
  format: string | null | undefined,
): string {
  const raw = (body ?? '').trim()
  if (!raw) return ''
  const f = parseContractBodyFormat(format)
  if (f === 'plain') {
    return `<div style="white-space:pre-wrap;word-break:break-word">${escapeHtmlText(raw)}</div>`
  }
  if (f === 'markdown') {
    return markdownSourceToSafeHtml(raw)
  }
  return sanitizeContractSigningHtml(raw)
}
