/**
 * The Field report email — lifted verbatim out of `send-report-email/index.ts` in v2.4180
 * (punch list #60, lift 11 of 14) so Settings → What the team sees renders it on sample data.
 * Pure: the resolved report content in, subject + HTML + text out.
 */
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Signature fields are stored as data URIs; per product decision we show a placeholder, not the image. */
function renderFieldValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') {
    if (value.startsWith('data:image')) return '[signature captured]'
    return value
  }
  if (Array.isArray(value)) return value.map((v) => renderFieldValue(v)).filter(Boolean).join(', ')
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export interface ReportContent {
  templateName: string
  authorName: string
  jobDisplay: string
  createdAt: string
  fieldValues: Record<string, unknown>
}

export function buildReportEmail(content: ReportContent): { subject: string; html: string; text: string } {
  const when = new Date(content.createdAt).toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ })
  const subject = `${content.templateName} — ${content.jobDisplay}`

  const fieldEntries = Object.entries(content.fieldValues)
    .map(([label, value]) => [label, renderFieldValue(value)] as const)
    .filter(([, v]) => v.trim().length > 0)

  const fieldsHtml =
    fieldEntries.length > 0
      ? fieldEntries
          .map(
            ([label, value]) =>
              `<div style="margin-bottom:12px"><div style="color:#6b7280;font-weight:600;font-size:13px;margin-bottom:2px">${escapeHtml(
                label,
              )}</div><div style="white-space:pre-wrap;font-size:14px;color:#111827">${escapeHtml(
                value,
              )}</div></div>`,
          )
          .join('')
      : '<div style="color:#9ca3af;font-size:14px">No content</div>'

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:16px;color:#111827">
    <h2 style="font-size:18px;margin:0 0 4px">${escapeHtml(content.templateName)}</h2>
    <div style="font-size:14px;color:#374151;margin-bottom:2px">${escapeHtml(content.jobDisplay)}</div>
    <div style="font-size:13px;color:#6b7280;margin-bottom:16px">${escapeHtml(when)} · ${escapeHtml(
      content.authorName,
    )}</div>
    <div style="border-top:1px solid #e5e7eb;padding-top:16px">${fieldsHtml}</div>
    <div style="margin-top:24px;font-size:12px;color:#9ca3af">Sent by ClickTooling because you're subscribed to report emails.</div>
  </div>`

  const textLines = [
    content.templateName,
    content.jobDisplay,
    `${when} · ${content.authorName}`,
    '',
    ...(fieldEntries.length > 0
      ? fieldEntries.map(([label, value]) => `${label}:\n${value}\n`)
      : ['No content']),
  ]
  return { subject, html, text: textLines.join('\n') }
}
