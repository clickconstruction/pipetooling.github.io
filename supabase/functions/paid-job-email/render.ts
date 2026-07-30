/**
 * HTML renderers for the "Customer paid" email (paid-job-email edge function).
 *
 * Two variants from one payload (get_paid_job_email_payload RPC):
 * - detailed  — the full financial scoreboard (dev / master_technician)
 * - summary   — sterilized: job identity + dates, zero dollar figures
 *
 * Email-safe markup: inline-styled <table>s, light colors only, no external
 * assets (matches the other Resend emails in this repo).
 */

import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

export type PaidJobEmailPayload = {
  job: {
    id: string
    display_number: string | null
    job_name: string | null
    job_address: string | null
    customer_name: string | null
    /** jobs_ledger.status (payload v3, v2.1102). Absent on the pre-v3 payload — treated as paid. */
    status?: string | null
    service_type_name: string | null
  }
  /** Fixture rows + linked-invoice status (payload v3, v2.1102). Absent on the pre-v3 payload. */
  line_items?: Array<{
    name: string
    count: number
    unit_price: number
    amount: number
    description: string | null
    /** 'paid' | 'billed' | 'ready_to_bill' | null (null = not on any invoice). */
    invoice_status: string | null
  }>
  money: {
    revenue: number
    payments: Array<{ amount: number; payment_date: string | null; method: string | null }>
    payments_total: number
    last_payment: { amount: number; at: string | null } | null
  }
  costs: {
    team_labor: {
      total: number
      people: Array<{ name: string; hours: number; wage: number; cost: number }>
    }
    sub_labor_total: number
    parts_total: number
  }
  profit: number
  timeline: Array<{ month: string; labor_cost: number; parts_cost: number; payments: number }>
  dates: { job_start: string | null; last_work: string | null; paid_at: string | null }
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
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function hoursFmt(n: number): string {
  return `${(Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} hr`
}

/** Weekday-formatted date, e.g. "Tuesday, Jul 22, 2026". Empty string for null/garbage. */
function weekdayDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_CALENDAR_TZ,
  })
}

/** Weekday date + exact Chicago time, e.g. "Wednesday, Jul 23, 2026 · 2:41 PM". */
function weekdayDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_CALENDAR_TZ,
  })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
  return `${date} &middot; ${time}`
}

function daysAgoNote(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000))
  return ` <span style="color:#78716c;">(${days} day${days === 1 ? '' : 's'} ago)</span>`
}

function shortMonth(ym: string): string {
  const d = new Date(`${ym}-15T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ym
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const WRAP_STYLE =
  'margin:0 auto;max-width:640px;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1c1917;'

/**
 * Payment state (v2.1103): the email now tells the truth for jobs that are not
 * Paid in Full, so the office can send progress emails at their leisure.
 * A payload without `job.status` (pre-v3 RPC) renders as paid — the exact old
 * behavior — so deploy order vs the migration can't produce a wrong banner.
 */
type PaidJobPaymentState =
  | { kind: 'paid' }
  | { kind: 'partial'; paid: number; revenue: number; pct: number }
  | { kind: 'unpaid' }

function paymentState(p: PaidJobEmailPayload): PaidJobPaymentState {
  if (p.job.status === undefined) return { kind: 'paid' }
  const revenue = Number.isFinite(p.money.revenue) ? p.money.revenue : 0
  const paid = Number.isFinite(p.money.payments_total) ? p.money.payments_total : 0
  if (String(p.job.status) === 'paid' || (revenue > 0 && paid >= revenue - 0.005)) return { kind: 'paid' }
  if (paid > 0.005) {
    return { kind: 'partial', paid, revenue, pct: revenue > 0 ? Math.round((paid / revenue) * 100) : 0 }
  }
  return { kind: 'unpaid' }
}

const PILL_BASE =
  'display:inline-block;border-radius:9999px;padding:4px 14px;font-size:13px;font-weight:bold;letter-spacing:0.04em;'

const BADGE = `<span style="${PILL_BASE}background:#dcfce7;color:#166534;border:1px solid #86efac;">PAID IN FULL</span>`

/** State-aware header pill: green PAID IN FULL / amber progress / gray NOT PAID. */
function renderStateBadge(state: PaidJobPaymentState): string {
  if (state.kind === 'paid') return BADGE
  if (state.kind === 'partial') {
    return `<span style="${PILL_BASE}background:#fef3c7;color:#92400e;border:1px solid #fcd34d;">${money(state.paid)} (${state.pct}%) OF ${money(state.revenue)} PAID</span>`
  }
  return `<span style="${PILL_BASE}background:#f5f5f4;color:#57534e;border:1px solid #d6d3d1;">NOT PAID</span>`
}

/**
 * The completing payment's exact amount + timestamp (v2.969) — shown on BOTH
 * variants: the paid amount is cleared for all recipients; every other dollar
 * figure stays detailed-only. Falls back to payments_total + queue paid_at.
 */
function renderPaidLine(p: PaidJobEmailPayload): string {
  const state = paymentState(p)
  if (state.kind === 'unpaid') return ''
  const lp = p.money.last_payment
  const amount = lp?.amount ?? p.money.payments_total
  if (!Number.isFinite(amount) || amount <= 0) return ''
  if (state.kind === 'partial') {
    // Progress framing (amber): the last payment received, not a "Paid" claim.
    const at = weekdayDateTime(lp?.at ?? null)
    return `
    <p style="margin:0 0 16px;text-align:center;font-size:15px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;">
      Last payment <strong>${money(amount)}</strong>${at ? ` &mdash; ${at}` : ''}
    </p>`
  }
  const at = weekdayDateTime(lp?.at ?? p.dates.paid_at)
  return `
    <p style="margin:0 0 16px;text-align:center;font-size:15px;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 12px;">
      Paid <strong>${money(amount)}</strong>${at ? ` &mdash; ${at}` : ''}
    </p>`
}

/** Job identity header + state badge + paid date (paid jobs only; both variants). */
function renderHeader(p: PaidJobEmailPayload): string {
  const j = p.job
  const state = paymentState(p)
  const idLine = [j.display_number, j.job_name].filter(Boolean).map(esc).join(' &middot; ')
  const subLine = [j.customer_name, j.job_address].filter(Boolean).map(esc).join(' &middot; ')
  // paid_at is now()-stamped by the RPC, so it is only a real paid date on paid jobs.
  const paidDate = state.kind === 'paid' ? weekdayDate(p.dates.paid_at) : ''
  return `
    <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #e7e5e4;margin-bottom:16px;">
      ${renderStateBadge(state)}
      <h1 style="margin:12px 0 4px;font-size:20px;color:#1c1917;">${idLine || 'Job'}</h1>
      ${subLine ? `<p style="margin:0 0 4px;font-size:13px;color:#57534e;">${subLine}</p>` : ''}
      ${j.service_type_name ? `<p style="margin:0 0 4px;font-size:12px;color:#78716c;">${esc(j.service_type_name)}</p>` : ''}
      ${paidDate ? `<p style="margin:8px 0 0;font-size:13px;color:#166534;font-weight:bold;">Paid ${esc(paidDate)}</p>` : ''}
    </div>`
}

/** Small status chip for one line item's linked-invoice state. */
function lineItemChip(invoiceStatus: string | null): string {
  const chip = (bg: string, fg: string, border: string, label: string) =>
    `<span style="display:inline-block;background:${bg};color:${fg};border:1px solid ${border};border-radius:9999px;padding:1px 8px;font-size:11px;font-weight:bold;">${label}</span>`
  if (invoiceStatus === 'paid') return chip('#dcfce7', '#166534', '#86efac', 'PAID')
  if (invoiceStatus === 'billed') return chip('#dbeafe', '#1e40af', '#93c5fd', 'BILLED')
  if (invoiceStatus === 'ready_to_bill') return chip('#fef3c7', '#92400e', '#fcd34d', 'DRAFT')
  return chip('#f5f5f4', '#57534e', '#d6d3d1', 'UNBILLED')
}

/**
 * Line items with per-item invoice status (payload v3). Detailed shows amounts;
 * summary shows names + status only (redaction decision, v2.1103). Renders
 * nothing on a pre-v3 payload or a job with no line items.
 */
function renderLineItems(p: PaidJobEmailPayload, withAmounts: boolean): string {
  const items = p.line_items ?? []
  if (items.length === 0) return ''
  const rows = items
    .map((it) => {
      const qty = Number.isFinite(it.count) && it.count > 1 ? ` &times;${it.count}` : ''
      const desc = it.description
        ? `<div style="font-size:11px;color:#78716c;">${esc(it.description)}</div>`
        : ''
      return `
    <tr>
      <td style="${CHILD_TD}padding-left:10px;">${esc(it.name)}${qty}${desc}</td>
      ${withAmounts ? `<td style="${NUM_TD}">${money(it.amount)}</td>` : ''}
      <td style="padding:5px 10px;text-align:right;white-space:nowrap;">${lineItemChip(it.invoice_status)}</td>
    </tr>`
    })
    .join('')
  return `
    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#1c1917;">Line items</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e7e5e4;margin-bottom:16px;">
      ${rows}
    </table>`
}

/** "Job Start / Last Work" two-column block with weekday dates and "(N days ago)" (both variants). */
function renderDatesBlock(p: PaidJobEmailPayload): string {
  const start = weekdayDate(p.dates.job_start)
  const last = weekdayDate(p.dates.last_work)
  const cell = (label: string, value: string, note: string) => `
    <td style="width:50%;padding:10px 12px;border:1px solid #e7e5e4;background:#fafaf9;vertical-align:top;">
      <div style="font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:4px;">${label}</div>
      <div style="font-size:14px;color:#1c1917;">${value ? esc(value) + note : '&mdash;'}</div>
    </td>`
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:16px;">
      <tr>
        ${cell('Job Start', start, daysAgoNote(p.dates.job_start))}
        ${cell('Last Work', last, daysAgoNote(p.dates.last_work))}
      </tr>
    </table>`
}

const TH = 'padding:6px 10px;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;text-align:left;border-bottom:1px solid #e7e5e4;'
const SECTION_TD =
  'padding:8px 10px;font-size:13px;font-weight:bold;color:#1c1917;background:#f5f5f4;border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;'
const CHILD_TD = 'padding:5px 10px 5px 24px;font-size:13px;color:#44403c;'
const NUM_TD = 'padding:5px 10px;font-size:13px;color:#44403c;text-align:right;white-space:nowrap;'

/** The scoreboard: Revenue / Payments received / Costs / Profit with per-section totals. */
function renderScoreboard(p: PaidJobEmailPayload): string {
  const costsTotal = p.costs.team_labor.total + p.costs.sub_labor_total + p.costs.parts_total
  const profitColor = p.profit >= 0 ? '#166534' : '#b91c1c'

  const sectionRow = (label: string, total: string, color = '#1c1917') => `
    <tr>
      <td style="${SECTION_TD}" colspan="2">${label}</td>
      <td style="${SECTION_TD}text-align:right;color:${color};">${total}</td>
    </tr>`

  const laborRows = p.costs.team_labor.people
    .map(
      (person) => `
    <tr>
      <td style="${CHILD_TD}">${esc(person.name)}</td>
      <td style="${NUM_TD}">${hoursFmt(person.hours)} &times; ${money(person.wage)}/hr</td>
      <td style="${NUM_TD}">${money(person.cost)}</td>
    </tr>`,
    )
    .join('')

  const paymentRows = p.money.payments
    .map(
      (pay) => `
    <tr>
      <td style="${CHILD_TD}">${esc(weekdayDate(pay.payment_date) || 'Payment')}</td>
      <td style="${NUM_TD}">${pay.method ? esc(pay.method) : ''}</td>
      <td style="${NUM_TD}">${money(pay.amount)}</td>
    </tr>`,
    )
    .join('')

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e7e5e4;margin-bottom:16px;">
      <tr>
        <th style="${TH}">&nbsp;</th>
        <th style="${TH}text-align:right;">Value per</th>
        <th style="${TH}text-align:right;">Total</th>
      </tr>
      ${sectionRow('Revenue', money(p.money.revenue))}
      ${sectionRow('Payments received', money(p.money.payments_total))}
      ${paymentRows}
      ${sectionRow('Costs', money(costsTotal))}
      <tr>
        <td style="${CHILD_TD}font-weight:bold;">Team labor</td>
        <td style="${NUM_TD}"></td>
        <td style="${NUM_TD}font-weight:bold;">${money(p.costs.team_labor.total)}</td>
      </tr>
      ${laborRows}
      <tr>
        <td style="${CHILD_TD}">Sub labor</td>
        <td style="${NUM_TD}"></td>
        <td style="${NUM_TD}">${money(p.costs.sub_labor_total)}</td>
      </tr>
      <tr>
        <td style="${CHILD_TD}">Parts (bank card charges)</td>
        <td style="${NUM_TD}"></td>
        <td style="${NUM_TD}">${money(p.costs.parts_total)}</td>
      </tr>
      ${sectionRow('Profit', money(p.profit), profitColor)}
    </table>`
}

/** Monthly timeline table (month, labor, parts, payments). */
function renderTimeline(p: PaidJobEmailPayload): string {
  if (p.timeline.length === 0) return ''
  const rows = p.timeline
    .map(
      (t) => `
    <tr>
      <td style="padding:5px 10px;font-size:13px;color:#44403c;border-top:1px solid #f5f5f4;">${esc(shortMonth(t.month))}</td>
      <td style="${NUM_TD}border-top:1px solid #f5f5f4;">${money(t.labor_cost)}</td>
      <td style="${NUM_TD}border-top:1px solid #f5f5f4;">${money(t.parts_cost)}</td>
      <td style="${NUM_TD}border-top:1px solid #f5f5f4;">${money(t.payments)}</td>
    </tr>`,
    )
    .join('')
  return `
    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#1c1917;">Month by month</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e7e5e4;">
      <tr>
        <th style="${TH}">Month</th>
        <th style="${TH}text-align:right;">Labor</th>
        <th style="${TH}text-align:right;">Parts</th>
        <th style="${TH}text-align:right;">Payments</th>
      </tr>
      ${rows}
    </table>`
}

/** Detailed variant (dev / master_technician): full financial review. */
export function renderPaidJobEmailDetailed(p: PaidJobEmailPayload, manualNote?: string): string {
  return `
  <div style="background:#f5f5f4;padding:16px;">
    <div style="${WRAP_STYLE}">
      ${renderHeader(p)}
      ${renderPaidLine(p)}
      ${renderLineItems(p, true)}
      ${renderDatesBlock(p)}
      ${renderScoreboard(p)}
      ${renderTimeline(p)}
      ${manualNote ? `<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;text-align:center;">${esc(manualNote)}</p>` : ''}
      <p style="margin:16px 0 0;font-size:11px;color:#a8a29e;text-align:center;">${footerLine(p)}</p>
    </div>
  </div>`
}

/** Sterilized variant (everyone else): job identity + dates, zero dollar figures. */
export function renderPaidJobEmailSummary(p: PaidJobEmailPayload, manualNote?: string): string {
  return `
  <div style="background:#f5f5f4;padding:16px;">
    <div style="${WRAP_STYLE}">
      ${renderHeader(p)}
      ${renderPaidLine(p)}
      ${renderLineItems(p, false)}
      ${renderDatesBlock(p)}
      ${
        paymentState(p).kind === 'paid'
          ? '<p style="margin:0;font-size:13px;color:#44403c;text-align:center;">This job has been paid in full. Nice work.</p>'
          : ''
      }
      ${manualNote ? `<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;text-align:center;">${esc(manualNote)}</p>` : ''}
      <p style="margin:16px 0 0;font-size:11px;color:#a8a29e;text-align:center;">${footerLine(p)}</p>
    </div>
  </div>`
}

function footerLine(p: PaidJobEmailPayload): string {
  return paymentState(p).kind === 'paid'
    ? 'PipeTooling &mdash; sent when a job reaches Paid in Full.'
    : 'PipeTooling &mdash; payment progress for this job.'
}

/** One-line status for subject/plain-text: "PAID IN FULL" / "$X (Y%) of $Z paid" / "NOT PAID". */
function statusLine(p: PaidJobEmailPayload): string {
  const state = paymentState(p)
  if (state.kind === 'paid') return 'PAID IN FULL'
  if (state.kind === 'partial') return `${money(state.paid)} (${state.pct}%) of ${money(state.revenue)} paid`
  return 'NOT PAID'
}

/** Plain-text fallback (both variants keep this money-free; detailed context lives in the HTML). */
export function paidJobEmailText(p: PaidJobEmailPayload): string {
  const j = p.job
  const parts = [
    `${j.display_number ?? ''} ${j.job_name ?? ''}`.trim(),
    statusLine(p),
    (() => {
      const state = paymentState(p)
      if (state.kind === 'unpaid') return ''
      const lp = p.money.last_payment
      const amount = lp?.amount ?? p.money.payments_total
      if (!Number.isFinite(amount) || amount <= 0) return ''
      if (state.kind === 'partial') {
        const at = weekdayDateTime(lp?.at ?? null).replace('&middot;', '\u00b7')
        return `Last payment ${money(amount)}${at ? ` — ${at}` : ''}`
      }
      const at = weekdayDateTime(lp?.at ?? p.dates.paid_at).replace('&middot;', '\u00b7')
      return `Paid ${money(amount)}${at ? ` — ${at}` : ''}`
    })(),
    j.customer_name ? `Customer: ${j.customer_name}` : '',
    j.job_address ? `Address: ${j.job_address}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

export function paidJobEmailSubject(p: PaidJobEmailPayload): string {
  const j = p.job
  const id = [j.display_number, j.job_name].filter(Boolean).join(' · ')
  const state = paymentState(p)
  if (state.kind === 'partial') {
    return `Payment progress — ${id || 'job'} — ${money(state.paid)} of ${money(state.revenue)} paid`
  }
  if (state.kind === 'unpaid') {
    return `Not paid — ${id || 'job'}`
  }
  const amount = p.money.last_payment?.amount ?? p.money.payments_total
  const amountPart = Number.isFinite(amount) && amount > 0 ? ` — ${money(amount)}` : ''
  return `Paid in full — ${id || 'job'}${amountPart}`
}
