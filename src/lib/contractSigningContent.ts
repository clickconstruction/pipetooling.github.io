/**
 * At least one of inline body, canonical URL, or legacy reference URL (for
 * signing context) — or a form template (Contract Forms v2.2794: the signer
 * fills the template's PDF, so there is no body to check).
 */
export function hasContractSigningContent(row: {
  signing_body_html?: string | null
  canonical_document_url?: string | null
  url?: string | null
  form_template_id?: string | null
}): boolean {
  if (row.form_template_id) return true
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
