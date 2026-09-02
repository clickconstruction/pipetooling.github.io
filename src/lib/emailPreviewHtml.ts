/**
 * "Open as email" preview (v2.2662): builds a standalone HTML document showing
 * how a template's wording reads inside an email — light chrome, From/To/Subject
 * header, variables filled with sample data — opened in a new tab from the
 * Settings → Email templates editor. Client-composed emails render close to the
 * real send; digest emails only edit the subject + intro here, so their preview
 * shows the intro above a clearly-labeled SAMPLE data table (the real tables
 * are built server-side from live jobs and can't be reproduced in the browser).
 * "Send test to me" stays the byte-for-byte truth.
 */
import { escapeEmailHtml, renderEmailWording } from './emailWording'

/** Sample values for every variable any email template advertises. */
export const EMAIL_PREVIEW_SAMPLE_VARS: Record<string, string> = {
  name: 'Jordan Reyes',
  email: 'jordan@example.com',
  role: 'estimator',
  link: 'https://example.com/sample-link',
  project_name: 'Kent — 414 Candelaria, Helotes, TX',
  stage_name: 'Rough-in',
  assigned_to_name: 'Malachi Douglas',
  workflow_link: 'https://example.com/sample-workflow',
  previous_stage_name: 'Underground',
  rejection_reason: 'Sample rejection reason',
  offered_by: 'Diane',
  responder: 'Malachi Douglas',
  amount: '$1,250.00',
  window: 'Thu 8–10 AM',
  reason: 'Schedule conflict',
  project: 'Kent — 414 Candelaria, Helotes, TX',
  form_label: 'Conditional · progress',
  signer: 'Malachi Douglas',
  job_number: '1003',
  invoice_reference: 'Stripe invoice for job 1003',
  week: 'Sep 1 – Sep 5',
  date: 'Tue, Sep 2',
}

/**
 * Digest-style types: the editable wording is subject + intro only — the data
 * below the intro is built server-side, so the preview substitutes a labeled
 * sample table.
 */
const DIGEST_PREVIEW_TYPES = new Set([
  'paid_job',
  'ready_to_bill',
  'money_waiting',
  'billed_awaiting',
  'payment_forecast',
  'crew_day',
  'weekly_money',
  'weekly_movement',
  'schedule_day',
  'gc_statement_scheduled',
])

/** Sample built-in subject per digest type — what {{default_subject}} resolves to. */
const SAMPLE_DEFAULT_SUBJECTS: Record<string, string> = {
  paid_job: 'Payment received — Kent — 414 Candelaria (job 1003)',
  ready_to_bill: 'Ready to bill — Kent — 414 Candelaria (job 1003)',
  money_waiting: 'Money waiting — Tue, Sep 2',
  billed_awaiting: 'Billed awaiting payment — Tue, Sep 2',
  payment_forecast: 'Payment forecast — Tue, Sep 2',
  crew_day: 'Crew day — Tue, Sep 2',
  weekly_money: 'Weekly money movement — Sep 1 – Sep 5',
  weekly_movement: 'Weekly movement — Sep 1 – Sep 5',
  schedule_day: "Tomorrow's schedule — Tue, Sep 2",
  gc_statement_scheduled: 'Click Plumbing open balances: Acme General Contracting',
}

/** Attachment-carrying types get a fake attachment chip in the preview. */
const SAMPLE_ATTACHMENTS: Record<string, string> = {
  lien_release_to_customer: 'lien-release-conditional-progress-1003.pdf',
  hazmat_notice: 'biohazard-fee-notice-job-1003.pdf',
}

export function isDigestPreviewType(templateType: string): boolean {
  return DIGEST_PREVIEW_TYPES.has(templateType)
}

/** Sample vars for a type — digests also get their {{default_subject}}. */
export function emailPreviewSampleVarsFor(templateType: string): Record<string, string> {
  const base = { ...EMAIL_PREVIEW_SAMPLE_VARS }
  const defaultSubject = SAMPLE_DEFAULT_SUBJECTS[templateType]
  if (defaultSubject) base.default_subject = defaultSubject
  return base
}

const SAMPLE_TABLE_HTML = `<div style="margin-top:16px;border:1px dashed #d1d5db;border-radius:8px;overflow:hidden;">
<div style="background:#fef3c7;color:#92400e;font-size:12px;font-weight:600;padding:6px 12px;">SAMPLE DATA — the real send builds this section from live jobs; only the subject and intro above are editable.</div>
<table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;">
<tr style="background:#f9fafb;"><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb;">Job</th><th style="text-align:right;padding:8px 12px;border-bottom:1px solid #e5e7eb;">Amount</th></tr>
<tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">Kent — 414 Candelaria, Helotes, TX (job 1003)</td><td style="text-align:right;padding:8px 12px;border-bottom:1px solid #f3f4f6;">$1,250.00</td></tr>
<tr><td style="padding:8px 12px;">Alvarez — 98 Ledgestone Pass, Boerne, TX (job 1004)</td><td style="text-align:right;padding:8px 12px;">$3,480.00</td></tr>
</table>
</div>`

/**
 * The full preview document for a template's current (possibly unsaved)
 * subject + body. Always light — emails don't follow the app theme.
 */
export function buildEmailPreviewHtml(templateType: string, subject: string, body: string): string {
  const vars = emailPreviewSampleVarsFor(templateType)
  const renderedSubject = renderEmailWording(subject, vars)
  const renderedBody = renderEmailWording(body, vars)
  const bodyHtml = escapeEmailHtml(renderedBody).replace(/\n/g, '<br>')
  const attachment = SAMPLE_ATTACHMENTS[templateType]
  const attachmentHtml = attachment
    ? `<div style="margin-top:16px;display:inline-block;border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;font-size:13px;color:#374151;background:#f9fafb;">&#128206; ${escapeEmailHtml(attachment)}</div>`
    : ''
  const digestHtml = isDigestPreviewType(templateType) ? SAMPLE_TABLE_HTML : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email preview — ${escapeEmailHtml(renderedSubject)}</title>
</head>
<body style="margin:0;background:#fafafa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827;">
<div style="max-width:640px;margin:32px auto;padding:0 16px;">
<p style="font-size:12px;color:#6b7280;margin:0 0 8px;">Preview with sample data — the real send fills variables from the job. &ldquo;Send test to me&rdquo; is the byte-for-byte check.</p>
<div style="border:1px solid #e5e7eb;border-radius:10px;background:#fff;overflow:hidden;">
<div style="padding:14px 20px;border-bottom:1px solid #f3f4f6;font-size:13px;line-height:1.6;color:#374151;">
<div><strong>From:</strong> ClickTooling &lt;billing@clicktooling.com&gt;</div>
<div><strong>To:</strong> [recipient]</div>
<div><strong>Subject:</strong> ${escapeEmailHtml(renderedSubject)}</div>
</div>
<div style="padding:20px;font-size:14px;line-height:1.5;">
${bodyHtml}
${digestHtml}
${attachmentHtml}
</div>
</div>
</div>
</body>
</html>`
}
