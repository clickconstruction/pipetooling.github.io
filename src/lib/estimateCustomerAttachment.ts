/** Client validation + Google Drive preview URL for estimate customer attachments. */

export const CUSTOMER_ATTACHMENT_URL_MAX_LEN = 2048
export const CUSTOMER_ATTACHMENT_LABEL_MAX_LEN = 200

export type CustomerAttachmentPayload = { url: string; label: string | null }

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

/** DB draft columns: null clears. */
export function normalizeCustomerAttachmentDraftForDb(
  urlRaw: string | null | undefined,
  labelRaw: string | null | undefined,
): { url: string | null; label: string | null } {
  const url = normalizeCustomerAttachmentUrl(urlRaw)
  const label = url ? normalizeCustomerAttachmentLabel(labelRaw) : null
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

const DRIVE_FILE_ID_IN_PATH = /\/file\/d\/([^/]+)/i
const OPEN_ID_PARAM = /^[a-zA-Z0-9_-]+$/

/** Embed URL for Google Drive file previews; null if not a recognized Drive link. */
export function googleDrivePreviewEmbedUrl(openUrl: string): string | null {
  const s = openUrl.trim()
  try {
    const u = new URL(s)
    const pathMatch = u.pathname.match(DRIVE_FILE_ID_IN_PATH)
    if (pathMatch?.[1]) {
      return `https://drive.google.com/file/d/${pathMatch[1]}/preview`
    }
    if (u.hostname.includes('drive.google.com')) {
      const id = u.searchParams.get('id')
      if (id && OPEN_ID_PARAM.test(id)) {
        return `https://drive.google.com/file/d/${id}/preview`
      }
    }
  } catch {
    return null
  }
  return null
}
