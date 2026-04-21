import { marked } from 'marked'
import { sanitizeContractSigningHtml } from './sanitizeContractSigningHtml'

marked.setOptions({ gfm: true, breaks: false })

export type ContractBodyFormat = 'html' | 'plain' | 'markdown'

export function parseContractBodyFormat(v: string | null | undefined): ContractBodyFormat {
  if (v === 'plain') return 'plain'
  if (v === 'markdown') return 'markdown'
  return 'html'
}

export function isPlainBodyFormat(v: string | null | undefined): boolean {
  return parseContractBodyFormat(v) === 'plain'
}

export function isMarkdownBodyFormat(v: string | null | undefined): boolean {
  return parseContractBodyFormat(v) === 'markdown'
}

/** Markdown source → HTML → same allowlist sanitizer as HTML contract bodies. */
export function markdownSourceToSafeHtml(source: string): string {
  const raw = source.trim()
  if (!raw) return ''
  const html = marked.parse(raw, { async: false }) as string
  return sanitizeContractSigningHtml(html)
}

/** Whether the body should show a non-empty preview (public page, signed record modal). */
export function contractBodyHasRenderableDisplay(
  source: string | null | undefined,
  format: string | null | undefined,
): boolean {
  const t = (source ?? '').trim()
  if (!t) return false
  const f = parseContractBodyFormat(format)
  if (f === 'plain') return true
  if (f === 'markdown') return Boolean(markdownSourceToSafeHtml(t).trim())
  return Boolean(sanitizeContractSigningHtml(t).trim())
}

/** Persist staff body: HTML is sanitized; plain and markdown store trimmed source (no HTML sanitizer on raw). */
export function normalizeContractBodyForSave(raw: string, format: ContractBodyFormat): string | null {
  const t = raw.trim()
  if (!t) return null
  if (format === 'plain' || format === 'markdown') return t
  const s = sanitizeContractSigningHtml(raw)
  return s.trim() ? s : null
}
