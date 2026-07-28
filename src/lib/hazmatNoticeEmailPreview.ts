import { hazmatNoticeEmailSubject, hazmatNoticeEmailText } from './sendHazmatNoticeEmail'

/**
 * "Preview email" for the Biohazard Remediation Fee Notice companion email
 * (v2.1037 — the Bill Customer ☣ box's preview link). Renders exactly what the
 * customer receives: envelope (To / Subject / attachment chip), the body text
 * from the SAME helpers the sender uses, and the attached notice inlined via a
 * sandboxed iframe per incident. Customer-facing → pinned light theme.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type HazmatNoticeEmailPreviewSection = {
  jobNumber: string
  customerEmail: string
  attachmentFilename: string
  /** Full HTML document of the notice (buildHazmatFeeNoticeHtml) — inlined via iframe srcdoc. */
  noticeHtml: string
  invoiceReference?: string | null
}

export function buildHazmatNoticeEmailPreviewHtml(sections: readonly HazmatNoticeEmailPreviewSection[]): string {
  const blocks = sections
    .map((sec, i) => {
      const subject = hazmatNoticeEmailSubject(sec.jobNumber)
      const body = hazmatNoticeEmailText(sec.jobNumber, sec.invoiceReference)
      const heading =
        sections.length > 1 ? `<h2 style="font-size:15px;margin:28px 0 10px">Email ${i + 1} of ${sections.length}</h2>` : ''
      return `${heading}
<div style="border:1px solid #d1d5db;border-radius:8px;overflow:hidden;margin-bottom:24px">
  <div style="background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:12px 16px;font-size:13px;color:#374151">
    <div><span style="color:#6b7280">To:</span> ${escapeHtml(sec.customerEmail)}</div>
    <div style="margin-top:2px"><span style="color:#6b7280">Subject:</span> <strong>${escapeHtml(subject)}</strong></div>
    <div style="margin-top:6px"><span style="display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;border-radius:999px;padding:2px 10px;font-size:12px">📎 ${escapeHtml(sec.attachmentFilename)}</span></div>
  </div>
  <div style="padding:16px;font-size:14px;line-height:1.55;color:#111827">${escapeHtml(body)}</div>
  <div style="border-top:1px dashed #d1d5db;padding:10px 16px 4px;font-size:12px;font-weight:600;letter-spacing:.03em;color:#6b7280">ATTACHMENT PREVIEW — ${escapeHtml(sec.attachmentFilename)}</div>
  <iframe sandbox="" srcdoc="${escapeHtml(sec.noticeHtml)}" style="width:100%;height:900px;border:none;display:block" title="Notice attachment preview"></iframe>
</div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Notice email preview</title></head>
<body style="margin:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:760px;margin:0 auto;padding:24px 16px">
<h1 style="font-size:17px;margin:0 0 4px">What the customer will receive</h1>
<p style="font-size:13px;color:#6b7280;margin:0 0 18px">This email is sent right after the Stripe invoice is created (when the box is checked). The notice travels as the attached PDF.</p>
${blocks}
</div></body></html>`
}
