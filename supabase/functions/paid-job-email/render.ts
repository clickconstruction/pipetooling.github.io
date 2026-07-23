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

export type PaidJobEmailPayload = {
  job: {
    id: string
    display_number: string | null
    job_name: string | null
    job_address: string | null
    customer_name: string | null
    service_type_name: string | null
  }
  money: {
    revenue: number
    payments: Array<{ amount: number; payment_date: string | null; method: string | null }>
    payments_total: number
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
    timeZone: 'America/Chicago',
  })
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

const BADGE =
  '<span style="display:inline-block;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:9999px;padding:4px 14px;font-size:13px;font-weight:bold;letter-spacing:0.04em;">PAID IN FULL</span>'

/** Job identity header + PAID IN FULL badge + paid date (both variants). */
function renderHeader(p: PaidJobEmailPayload): string {
  const j = p.job
  const idLine = [j.display_number, j.job_name].filter(Boolean).map(esc).join(' &middot; ')
  const subLine = [j.customer_name, j.job_address].filter(Boolean).map(esc).join(' &middot; ')
  const paidDate = weekdayDate(p.dates.paid_at)
  return `
    <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #e7e5e4;margin-bottom:16px;">
      ${BADGE}
      <h1 style="margin:12px 0 4px;font-size:20px;color:#1c1917;">${idLine || 'Job'}</h1>
      ${subLine ? `<p style="margin:0 0 4px;font-size:13px;color:#57534e;">${subLine}</p>` : ''}
      ${j.service_type_name ? `<p style="margin:0 0 4px;font-size:12px;color:#78716c;">${esc(j.service_type_name)}</p>` : ''}
      ${paidDate ? `<p style="margin:8px 0 0;font-size:13px;color:#166534;font-weight:bold;">Paid ${esc(paidDate)}</p>` : ''}
    </div>`
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
export function renderPaidJobEmailDetailed(p: PaidJobEmailPayload): string {
  return `
  <div style="background:#f5f5f4;padding:16px;">
    <div style="${WRAP_STYLE}">
      ${renderHeader(p)}
      ${renderDatesBlock(p)}
      ${renderScoreboard(p)}
      ${renderTimeline(p)}
      <p style="margin:16px 0 0;font-size:11px;color:#a8a29e;text-align:center;">PipeTooling &mdash; sent when a job reaches Paid in Full.</p>
    </div>
  </div>`
}

/** Sterilized variant (everyone else): job identity + dates, zero dollar figures. */
export function renderPaidJobEmailSummary(p: PaidJobEmailPayload): string {
  return `
  <div style="background:#f5f5f4;padding:16px;">
    <div style="${WRAP_STYLE}">
      ${renderHeader(p)}
      ${renderDatesBlock(p)}
      <p style="margin:0;font-size:13px;color:#44403c;text-align:center;">This job has been paid in full. Nice work.</p>
      <p style="margin:16px 0 0;font-size:11px;color:#a8a29e;text-align:center;">PipeTooling &mdash; sent when a job reaches Paid in Full.</p>
    </div>
  </div>`
}

/** Plain-text fallback (both variants keep this money-free; detailed context lives in the HTML). */
export function paidJobEmailText(p: PaidJobEmailPayload): string {
  const j = p.job
  const parts = [
    `${j.display_number ?? ''} ${j.job_name ?? ''}`.trim(),
    'PAID IN FULL',
    j.customer_name ? `Customer: ${j.customer_name}` : '',
    j.job_address ? `Address: ${j.job_address}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

export function paidJobEmailSubject(p: PaidJobEmailPayload): string {
  const j = p.job
  const id = [j.display_number, j.job_name].filter(Boolean).join(' · ')
  return `Paid in full — ${id || 'job'}`
}
