import {
  buildPhysicalInvoiceEmailBodies,
  physicalInvoiceEmailSubject,
  type PhysicalInvoiceDocument,
} from './physicalInvoiceDocument'

/**
 * Open the invoice email exactly as the customer would receive it, in a new
 * tab — nothing is sent (v2.2340; shared helper v2.2344). The bodies come
 * from the same builder the send path uses, so the preview is byte-for-byte
 * the send. Sync build, so the tab opens without pop-up-blocker games.
 */
export function openInvoiceEmailPreviewInNewTab(
  doc: PhysicalInvoiceDocument,
  opts: {
    toEmail: string
    /** The gray header's first words — e.g. "Preview — nothing has been sent". */
    contextNote: string
    onBlocked: () => void
  },
): boolean {
  const win = window.open('', '_blank')
  if (!win) {
    opts.onBlocked()
    return false
  }
  const esc = (s: string) => s.replace(/</g, '&lt;')
  const subject = physicalInvoiceEmailSubject(doc)
  const to = opts.toEmail.trim() || '—'
  const { html } = buildPhysicalInvoiceEmailBodies(doc)
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>Email preview — ${esc(subject)}</title></head><body style="margin:0;background:#f3f4f6"><div style="max-width:680px;margin:24px auto;background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-radius:8px"><div style="font-family:system-ui,sans-serif;font-size:12px;color:#9ca3af;border-bottom:1px solid #f3f4f6;padding-bottom:10px;margin-bottom:14px">${esc(opts.contextNote)} · To: ${esc(to)} · Subject: ${esc(subject)} · the invoice PDF rides along as an attachment</div>${html}</div></body></html>`
  const objectUrl = URL.createObjectURL(new Blob([page], { type: 'text/html' }))
  win.location.href = objectUrl
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  return true
}
