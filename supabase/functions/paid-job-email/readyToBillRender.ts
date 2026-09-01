/**
 * Renderers for the "Ready to Bill" notification (v2.1836) — the third stream
 * on the paid-job-email rail. Much lighter than the paid renderers: the point
 * is "billing can start on this job now", not a financial review.
 *
 * Same variant rule as the paid streams: detailed (dev / master_technician)
 * carries dollar amounts; summary is sterilized. The subject and plain-text
 * fallback are money-free for everyone (they reach summary-tier inboxes and
 * lock screens). Push bodies follow the same split.
 *
 * Email-safe markup: inline-styled <table>s, light colors only, no external
 * assets (matches render.ts).
 */

import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

export type ReadyToBillPayload = {
  job: {
    id: string
    display_number: string | null
    job_name: string | null
    job_address: string | null
    customer_name: string | null
    status: string | null
    service_type_name: string | null
    revenue: number
  }
  billing: {
    rtb_draft_total: number
    rtb_draft_count: number
    payments_total: number
  }
  moved_by: { name: string; at: string | null; from_status: string | null } | null
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function whenLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_CALENDAR_TZ,
  })
}

function jobIdLine(p: ReadyToBillPayload): string {
  return [p.job.display_number, p.job.job_name].filter(Boolean).join(' · ')
}

/** "$4,850.00 in draft bills" / "$4,850.00 revenue" — what's billable, best available number. */
function billableLine(p: ReadyToBillPayload): { amount: number; label: string } | null {
  if (p.billing.rtb_draft_total > 0) {
    return {
      amount: p.billing.rtb_draft_total,
      label: `in ${p.billing.rtb_draft_count} draft bill${p.billing.rtb_draft_count === 1 ? '' : 's'}`,
    }
  }
  if (p.job.revenue > 0) return { amount: p.job.revenue, label: 'job revenue' }
  return null
}

function movedByLine(p: ReadyToBillPayload): string {
  if (!p.moved_by) return ''
  const at = whenLabel(p.moved_by.at)
  const fromBilled = p.moved_by.from_status === 'billed'
  const verb = fromBilled ? 'Sent back to Ready to Bill by' : 'Moved to Ready to Bill by'
  return `${verb} ${p.moved_by.name}${at ? ` — ${at}` : ''}`
}

const WRAP = 'max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;padding:20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
const ROW_LABEL = 'padding:5px 10px 5px 0;font-size:13px;color:#78716c;white-space:nowrap;vertical-align:top;'
const ROW_VALUE = 'padding:5px 0;font-size:13px;color:#1c1917;'

function renderShell(p: ReadyToBillPayload, detailed: boolean, manualNote?: string): string {
  const billable = detailed ? billableLine(p) : null
  const moved = movedByLine(p)
  const rows: string[] = []
  if (p.job.customer_name) {
    rows.push(`<tr><td style="${ROW_LABEL}">Customer</td><td style="${ROW_VALUE}">${esc(p.job.customer_name)}</td></tr>`)
  }
  if (p.job.job_address) {
    rows.push(`<tr><td style="${ROW_LABEL}">Address</td><td style="${ROW_VALUE}">${esc(p.job.job_address)}</td></tr>`)
  }
  if (p.job.service_type_name) {
    rows.push(`<tr><td style="${ROW_LABEL}">Service</td><td style="${ROW_VALUE}">${esc(p.job.service_type_name)}</td></tr>`)
  }
  if (billable) {
    rows.push(
      `<tr><td style="${ROW_LABEL}">Billable</td><td style="${ROW_VALUE}font-weight:bold;">${money(billable.amount)} <span style="font-weight:normal;color:#78716c;">${esc(billable.label)}</span></td></tr>`,
    )
  }
  if (detailed && p.billing.payments_total > 0) {
    rows.push(`<tr><td style="${ROW_LABEL}">Paid so far</td><td style="${ROW_VALUE}">${money(p.billing.payments_total)}</td></tr>`)
  }
  if (moved) {
    rows.push(`<tr><td style="${ROW_LABEL}">Moved</td><td style="${ROW_VALUE}">${esc(moved)}</td></tr>`)
  }
  return `
  <div style="background:#f5f5f4;padding:16px;">
    <div style="${WRAP}">
      <p style="margin:0 0 2px;font-size:12px;font-weight:bold;letter-spacing:0.04em;text-transform:uppercase;color:#b45309;">Ready to bill</p>
      <p style="margin:0 0 12px;font-size:17px;font-weight:bold;color:#1c1917;">${esc(jobIdLine(p) || 'Job')}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        ${rows.join('')}
      </table>
      <p style="margin:14px 0 0;font-size:13px;color:#44403c;">Open Jobs &rarr; Pipeline &rarr; Ready to Bill to bill the customer.</p>
      ${manualNote ? `<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;text-align:center;">${esc(manualNote)}</p>` : ''}
      <p style="margin:16px 0 0;font-size:11px;color:#a8a29e;text-align:center;">ClickTooling &mdash; sent when a job moves to Ready to Bill.</p>
    </div>
  </div>`
}

/** Detailed variant (dev / master_technician): includes the billable dollars. */
export function renderReadyToBillDetailed(p: ReadyToBillPayload, manualNote?: string): string {
  return renderShell(p, true, manualNote)
}

/** Sterilized variant (everyone else): job identity + mover, zero dollar figures. */
export function renderReadyToBillSummary(p: ReadyToBillPayload, manualNote?: string): string {
  return renderShell(p, false, manualNote)
}

/** Subject is money-free — it reaches summary-tier inboxes too. */
export function readyToBillSubject(p: ReadyToBillPayload): string {
  return `Ready to bill — ${jobIdLine(p) || 'job'}`
}

/** Plain-text fallback (money-free for both variants, like the paid streams). */
export function readyToBillText(p: ReadyToBillPayload): string {
  return [jobIdLine(p), movedByLine(p), p.job.customer_name ? `Customer: ${p.job.customer_name}` : '', p.job.job_address ? `Address: ${p.job.job_address}` : '']
    .filter(Boolean)
    .join('\n')
}

/** Web-push title (money-free; shows on lock screens). */
export function readyToBillPushTitle(p: ReadyToBillPayload): string {
  return readyToBillSubject(p)
}

/** Web-push body: dollars for the detailed tier only. */
export function readyToBillPushBody(p: ReadyToBillPayload, detailed: boolean): string {
  const moved = p.moved_by ? `moved by ${p.moved_by.name}` : ''
  if (detailed) {
    const billable = billableLine(p)
    return [billable ? `${money(billable.amount)} ready to bill` : 'Ready to bill', moved]
      .filter(Boolean)
      .join(' · ')
  }
  return moved ? `Moved to Ready to Bill — ${moved.replace(/^moved by /, 'by ')}` : 'A job moved to Ready to Bill.'
}
