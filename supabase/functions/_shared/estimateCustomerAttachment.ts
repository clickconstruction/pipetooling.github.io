/** Shared validation + snapshot for estimates customer_attachment_* (Edge Functions). */

export const CUSTOMER_ATTACHMENT_URL_MAX_LEN = 2048
export const CUSTOMER_ATTACHMENT_LABEL_MAX_LEN = 200

/** Returns null if URL is empty/invalid; trimmed https URL otherwise. */
export function normalizeCustomerAttachmentUrl(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  if (s.length > CUSTOMER_ATTACHMENT_URL_MAX_LEN) return null
  return s
}

export function normalizeCustomerAttachmentLabel(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (s.length > CUSTOMER_ATTACHMENT_LABEL_MAX_LEN) return s.slice(0, CUSTOMER_ATTACHMENT_LABEL_MAX_LEN)
  return s
}

export type CustomerAttachmentPayload = { url: string; label: string | null }

/** Snapshot written at send (customer view). Null when no valid URL. */
export function buildCustomerAttachmentSentPayload(
  urlRaw: string | null | undefined,
  labelRaw: string | null | undefined,
): CustomerAttachmentPayload | null {
  const url = normalizeCustomerAttachmentUrl(urlRaw)
  if (!url) return null
  const label = normalizeCustomerAttachmentLabel(labelRaw)
  return { url, label }
}

export function parseCustomerAttachmentSent(value: unknown): CustomerAttachmentPayload | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  const url = normalizeCustomerAttachmentUrl(typeof o.url === 'string' ? o.url : null)
  if (!url) return null
  const label = normalizeCustomerAttachmentLabel(typeof o.label === 'string' ? o.label : null)
  return { url, label }
}
