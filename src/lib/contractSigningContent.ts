/** At least one of inline body, canonical URL, or legacy reference URL (for signing context). */
export function hasContractSigningContent(row: {
  signing_body_html?: string | null
  canonical_document_url?: string | null
  url?: string | null
}): boolean {
  if (row.signing_body_html?.trim()) return true
  if (row.canonical_document_url?.trim()) return true
  if (row.url?.trim()) return true
  return false
}

export function effectiveCanonicalDocumentUrl(row: {
  canonical_document_url?: string | null
  url?: string | null
}): string | null {
  const c = row.canonical_document_url?.trim()
  if (c) return c
  const u = row.url?.trim()
  if (u) return u
  return null
}
