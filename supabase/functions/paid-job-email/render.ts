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
  /**
   * Edit Job's "Invoices" table, mirrored (payload v5): the job's drafts
   * (ready_to_bill) and sent bills (billed/paid), drafts first — same order and
   * columns the office sees in the modal. Absent pre-v5 ⇒ block not rendered.
   */
  invoices?: Array<{
    status: string
    amount: number
    /** Σ jobs_ledger_payments.amount for this invoice. */
    paid: number
    /** sent_to_customer_at (YYYY-MM-DD); null on drafts. */
    sent_at: string | null
    /** Calendar days from created_at to sent_at — the modal's "(+N)". */
    sent_day_offset?: number | null
    /** external_send_channel: stripe | housecallpro | physical | null. */
    channel: string | null
    /** stripe_invoice_memo / external_send_note — the modal's detail line. */
    detail: string | null
    /** Bill-to override label when the invoice bills someone other than the job customer. */
    bill_to: string | null
    is_hazmat?: boolean
  }>
  /** The Edit Job Cost Timeline's six streams, dated (payload v4, v2.1106). Absent pre-v4. */
  charge_events?: Array<{
    source: string
    /** Chicago YYYY-MM-DD, or null when the source row has no date. */
    date_key: string | null
    amount: number
    label: string
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
    /** Payload v4 (v2.1106): the three streams the scoreboard previously omitted. */
    supply_house_total?: number
    tally_total?: number
    other_total?: number
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

/** Status chip for one invoice row — the Edit Job Draft/Billed pill, plus Paid. */
function invoiceStatusChip(status: string, amount: number, paid: number): string {
  const chip = (bg: string, fg: string, border: string, label: string) =>
    `<span style="display:inline-block;background:${bg};color:${fg};border:1px solid ${border};border-radius:9999px;padding:1px 8px;font-size:11px;font-weight:bold;">${label}</span>`
  if (status === 'ready_to_bill') return chip('#fef3c7', '#92400e', '#fcd34d', 'Draft')
  if (paid >= amount - 0.005 && amount > 0) return chip('#dcfce7', '#166534', '#86efac', 'Paid')
  return chip('#dbeafe', '#1e40af', '#93c5fd', 'Billed')
}

const CHANNEL_LABEL: Record<string, string> = {
  stripe: 'Stripe',
  housecallpro: 'HouseCall Pro',
  physical: 'Physical invoice',
  stripe_manual: 'Stripe',
}

/**
 * The Edit Job "Invoices" table, rendered for email (payload v5): the same
 * Status / Date / Amount columns the office reads in the modal, with the
 * Actions column replaced by Paid-vs-open (an email can't act). Detailed shows
 * dollars; summary shows status + date only, matching the line-items redaction
 * rule (v2.1103). Renders nothing on a pre-v5 payload or a job with no invoices.
 */
function renderInvoices(p: PaidJobEmailPayload, withAmounts: boolean): string {
  const rows = p.invoices ?? []
  if (rows.length === 0) return ''
  const body = rows
    .map((inv) => {
      const isDraft = inv.status === 'ready_to_bill'
      const dateText = isDraft
        ? 'not sent'
        : inv.sent_at
          ? `${weekdayDate(inv.sent_at)}${
              inv.sent_day_offset != null && inv.sent_day_offset > 0 ? ` (+${inv.sent_day_offset})` : ''
            }`
          : '&mdash;'
      const open = inv.amount - inv.paid
      const paidCell = isDraft
        ? '<span style="color:#a8a29e;">&mdash;</span>'
        : open <= 0.005
          ? `<span style="color:#166534;">${money(inv.paid)}</span>`
          : `${money(inv.paid)}<div style="font-size:11px;color:#b91c1c;">${money(open)} open</div>`
      const chips = [
        inv.is_hazmat
          ? '<span style="display:inline-block;margin-left:4px;background:#fef2f2;color:#b91c1c;border:1px solid #dc2626;border-radius:9999px;padding:1px 8px;font-size:11px;font-weight:bold;">&#9763; Hazmat</span>'
          : '',
        inv.bill_to
          ? `<div style="margin-top:3px;"><span style="display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #d6d3d1;border-radius:9999px;padding:1px 8px;font-size:11px;font-weight:bold;">&rarr; ${esc(inv.bill_to)}</span></div>`
          : '',
      ].join('')
      const channel = !isDraft && inv.channel ? CHANNEL_LABEL[inv.channel] ?? inv.channel : ''
      const detail = [channel, inv.detail ?? ''].filter(Boolean).map(esc).join(' &middot; ')
      return `
    <tr>
      <td style="padding:6px 10px;vertical-align:top;border-top:1px solid #e7e5e4;">${invoiceStatusChip(inv.status, inv.amount, inv.paid)}${chips}</td>
      <td style="padding:6px 10px;font-size:13px;color:${isDraft ? '#a8a29e' : '#44403c'};vertical-align:top;border-top:1px solid #e7e5e4;">${dateText}${
        detail ? `<div style="font-size:11px;color:#78716c;margin-top:2px;">${detail}</div>` : ''
      }</td>
      ${withAmounts ? `<td style="${NUM_TD}border-top:1px solid #e7e5e4;vertical-align:top;">${money(inv.amount)}</td>` : ''}
      ${withAmounts ? `<td style="${NUM_TD}border-top:1px solid #e7e5e4;vertical-align:top;">${paidCell}</td>` : ''}
    </tr>`
    })
    .join('')
  const totalInvoiced = rows.reduce((s, r) => s + r.amount, 0)
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
  const totalsRow = withAmounts
    ? `
    <tr>
      <td colspan="2" style="${SECTION_TD}">Total invoiced</td>
      <td style="${SECTION_TD}text-align:right;">${money(totalInvoiced)}</td>
      <td style="${SECTION_TD}text-align:right;">${money(totalPaid)}</td>
    </tr>`
    : ''
  return `
    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#1c1917;">Invoices</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e7e5e4;margin-bottom:16px;">
      <tr>
        <th style="${TH}">Status</th>
        <th style="${TH}">Date</th>
        ${withAmounts ? `<th style="${TH}text-align:right;">Amount</th>` : ''}
        ${withAmounts ? `<th style="${TH}text-align:right;">Paid</th>` : ''}
      </tr>
      ${body}
      ${totalsRow}
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
  const costsTotal =
    p.costs.team_labor.total +
    p.costs.sub_labor_total +
    p.costs.parts_total +
    (p.costs.supply_house_total ?? 0) +
    (p.costs.tally_total ?? 0) +
    (p.costs.other_total ?? 0)
  const profitColor = p.profit >= 0 ? '#166534' : '#b91c1c'

  // Payload v4 streams — rendered only when present (pre-v4 payloads keep the old 3-row costs).
  const extraCostRow = (label: string, total: number | undefined) =>
    total !== undefined
      ? `
    <tr>
      <td style="${CHILD_TD}">${label}</td>
      <td style="${NUM_TD}"></td>
      <td style="${NUM_TD}">${money(total)}</td>
    </tr>`
      : ''

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
      ${extraCostRow('Supply house invoices', p.costs.supply_house_total)}
      ${extraCostRow('Tally parts', p.costs.tally_total)}
      ${extraCostRow('Other job charges', p.costs.other_total)}
      ${sectionRow('Profit', money(p.profit), profitColor)}
    </table>`
}

const CHARGE_SOURCE_ICON: Record<string, string> = {
  team_labor: '👷',
  sub_labor: '🔧',
  mercury_card: '💳',
  supply_house: '🧾',
  tally_part: '📦',
  billed_material: '🧱',
}

type TimelineRowEvent = {
  dateKey: string | null
  /** Charges negative, payments positive. */
  delta: number
  icon: string
  label: string
}

/** "Jul 6" from YYYY-MM-DD (UTC-noon anchored — date keys are already Chicago days). */
function shortDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return dateKey
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Monday of the date's week (UTC math on Chicago date keys). */
function weekStartKey(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return dateKey
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

/**
 * The email Cost Timeline (v2.1107): the Edit Job step chart retold email-safe.
 * Month header rows carry a center-$0 running-net bar (payments in − costs out,
 * dated events only); the rows beneath are that month's events. Team labor is
 * folded to one row per person per week; each month keeps its largest rows and
 * folds the rest into one reconciling line, so the bars stay exact under any
 * capping. Undated events land in a barless "No date" group so the ending net
 * still ties to the scoreboard (payments − costs). Falls back to the old
 * monthly table when the payload predates v4.
 */
function renderChargeTimeline(p: PaidJobEmailPayload): string {
  const raw = p.charge_events
  if (!raw || raw.length === 0) return renderTimeline(p)

  // Fold team labor per person per week; other charges stay itemized.
  const laborByPersonWeek = new Map<string, TimelineRowEvent>()
  const events: TimelineRowEvent[] = []
  for (const e of raw) {
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount === 0) continue
    const icon = CHARGE_SOURCE_ICON[e.source] ?? '💲'
    if (e.source === 'team_labor' && e.date_key) {
      const person = String(e.label).split(' — ')[0] ?? 'Team labor'
      const wk = weekStartKey(e.date_key)
      const key = `${person}|${wk}`
      const existing = laborByPersonWeek.get(key)
      if (existing) {
        existing.delta -= amount
        // Keep the earliest day of the week the person worked as the row date.
        if (e.date_key < (existing.dateKey ?? '')) existing.dateKey = e.date_key
      } else {
        laborByPersonWeek.set(key, {
          dateKey: e.date_key,
          delta: -amount,
          icon,
          label: `${person} — team labor (week of ${shortDayLabel(wk)})`,
        })
      }
    } else {
      events.push({ dateKey: e.date_key, delta: -amount, icon, label: String(e.label) })
    }
  }
  events.push(...laborByPersonWeek.values())
  for (const pay of p.money.payments) {
    const amount = Number(pay.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    events.push({
      dateKey: pay.payment_date ? String(pay.payment_date).slice(0, 10) : null,
      delta: amount,
      icon: '💵',
      label: pay.method ? `Payment — ${pay.method}` : 'Payment',
    })
  }

  const monthKeys = Array.from(
    new Set(events.filter((e) => e.dateKey).map((e) => e.dateKey!.slice(0, 7))),
  ).sort()
  const undated = events.filter((e) => !e.dateKey)
  if (monthKeys.length === 0) return renderTimeline(p)

  // Running net per month (dated events only), then the bar scale.
  let running = 0
  const monthNets: Array<{ month: string; net: number; running: number }> = []
  for (const m of monthKeys) {
    const net = events
      .filter((e) => e.dateKey?.slice(0, 7) === m)
      .reduce((s, e) => s + e.delta, 0)
    running += net
    monthNets.push({ month: m, net, running })
  }
  const maxAbs = Math.max(1, ...monthNets.map((x) => Math.abs(x.running)))
  const undatedNet = undated.reduce((s, e) => s + e.delta, 0)
  const endNet = running + undatedNet

  const MAX_ROWS_PER_MONTH = 6
  const bar = (net: number) => {
    const pct = Math.max(2, Math.round((Math.abs(net) / maxAbs) * 100))
    return net >= 0
      ? `<td style="width:24%;padding:0;"></td><td style="width:24%;padding:0;"><div style="background:#bbf7d0;border-left:2px solid #166534;width:${pct}%;height:13px;font-size:0;">&nbsp;</div></td>`
      : `<td style="width:24%;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td>&nbsp;</td><td style="width:${pct}%;padding:0;"><div style="background:#fecaca;border-right:2px solid #b91c1c;height:13px;font-size:0;">&nbsp;</div></td></tr></table></td><td style="width:24%;padding:0;"></td>`
  }
  const netColor = (n: number) => (n >= 0 ? '#166534' : '#b91c1c')
  const signedMoney = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n)).replace('-', '')}`

  const eventRow = (e: TimelineRowEvent) => `
    <tr${e.delta > 0 ? ' style="background:#f0fdf4;"' : ''}>
      <td style="${CHILD_TD}padding-left:18px;white-space:nowrap;">${e.dateKey ? shortDayLabel(e.dateKey) : '—'} &middot; ${e.icon} ${esc(e.label)}</td>
      <td colspan="2" style="padding:0;"></td>
      <td style="${NUM_TD}color:${netColor(e.delta)};">${signedMoney(e.delta)}</td>
    </tr>`

  const monthGroup = (m: { month: string; net: number; running: number }) => {
    const inMonth = events
      .filter((e) => e.dateKey?.slice(0, 7) === m.month)
      .sort((a, b) => (a.dateKey! < b.dateKey! ? -1 : a.dateKey! > b.dateKey! ? 1 : 0))
    const paymentsInMonth = inMonth.filter((e) => e.delta > 0)
    const charges = inMonth
      .filter((e) => e.delta <= 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    const chargeBudget = Math.max(1, MAX_ROWS_PER_MONTH - paymentsInMonth.length)
    const kept = new Set(charges.slice(0, chargeBudget))
    const folded = charges.filter((c) => !kept.has(c))
    const foldedSum = folded.reduce((s, e) => s + e.delta, 0)
    const shownRows = inMonth.filter((e) => e.delta > 0 || kept.has(e)).map(eventRow).join('')
    const foldRow =
      folded.length > 0
        ? `
    <tr>
      <td style="${CHILD_TD}padding-left:18px;color:#a8a29e;">&hellip;and ${folded.length} smaller charge${folded.length === 1 ? '' : 's'}</td>
      <td colspan="2" style="padding:0;"></td>
      <td style="${NUM_TD}color:#b91c1c;">${signedMoney(foldedSum)}</td>
    </tr>`
        : ''
    return `
    <tr style="background:#fafaf9;border-top:1px solid #e7e5e4;">
      <td style="padding:5px 6px;font-size:12px;font-weight:bold;white-space:nowrap;">${esc(shortMonth(m.month))}</td>
      ${bar(m.running)}
      <td style="${NUM_TD}font-weight:bold;color:${netColor(m.running)};">${signedMoney(m.running)}</td>
    </tr>
    ${shownRows}
    ${foldRow}`
  }

  const undatedGroup =
    undated.length > 0
      ? `
    <tr style="background:#fafaf9;border-top:1px solid #e7e5e4;">
      <td style="padding:5px 6px;font-size:12px;font-weight:bold;">No date</td>
      <td colspan="2" style="padding:2px 6px;font-size:11px;color:#a8a29e;">not on the bars</td>
      <td style="${NUM_TD}font-weight:bold;color:${netColor(undatedNet)};">${signedMoney(undatedNet)}</td>
    </tr>
    ${undated.map(eventRow).join('')}`
      : ''

  return `
    <p style="margin:0 0 2px;font-size:13px;font-weight:bold;color:#1c1917;">Cost &amp; payment timeline</p>
    <p style="margin:0 0 6px;font-size:11px;color:#78716c;">Each month&rsquo;s bar is the running total &mdash; payments in minus costs out, $0 down the middle. Green right of the line = collected more than it cost so far.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e7e5e4;font-size:12px;">
      ${monthNets.map(monthGroup).join('')}
      ${undatedGroup}
      <tr style="border-top:2px solid #e7e5e4;">
        <td style="padding:6px;font-size:12px;font-weight:bold;">Job end</td>
        <td colspan="2" style="padding:0;"></td>
        <td style="${NUM_TD}font-weight:bold;color:${netColor(endNet)};">${signedMoney(endNet)}</td>
      </tr>
    </table>`
}

/** Monthly timeline table (month, labor, parts, payments) — pre-v4 payload fallback. */
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
      ${renderInvoices(p, true)}
      ${renderLineItems(p, true)}
      ${renderDatesBlock(p)}
      ${renderScoreboard(p)}
      ${renderChargeTimeline(p)}
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
      ${renderInvoices(p, false)}
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
    ? 'ClickTooling &mdash; sent when a job reaches Paid in Full.'
    : 'ClickTooling &mdash; payment progress for this job.'
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
