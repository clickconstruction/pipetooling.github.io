/**
 * HTML renderer for the Billed Awaiting Payment report email
 * (billed-report-email edge function, v2.1315).
 *
 * Mirrors the Stages print report (src/lib/jobsDocuments/
 * billedAwaitingPaymentReport.ts): customer groups A→Z, per-group contact
 * line, HCP / Job·Address / Detail / Days past / Amount due, subtotals and a
 * grand total — with the email upgrades: tel:/mailto: contacts, every job
 * cell links to the app's ?jobDetail= deep link, and the header carries the
 * board's 30–90/90+ aging chips.
 *
 * Email-safe markup: inline-styled <table>s, light colors only, no external
 * assets (matches paid-job-email/render.ts).
 */

import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

/** Prod app origin for deep links (invite-user precedent; repo CNAME = pipetooling.com). */
export const APP_URL = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)

export type BilledReportRow = {
  job_id: string
  display_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  detail: string
  ref_date: string | null
  ref_is_estimate: boolean
  days_past: number | null
  remaining: number
  aging_bucket: '30_90' | '90' | null
}

export type BilledReportPayload = {
  generated_at: string
  totals: {
    row_count: number
    grand_total: number
    count30_90: number
    sum30_90: number
    count90: number
    sum90: number
  }
  rows: BilledReportRow[]
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

function reportDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_CALENDAR_TZ,
  })
}

function jobLink(row: BilledReportRow): string {
  return `${APP_URL}/jobs?jobDetail=${encodeURIComponent(row.job_id)}`
}

type Group = { displayName: string; rows: BilledReportRow[] }

/** Customer grouping — the print builder's key rule (customer_id, else normalized name, else '—'). */
export function groupBilledRows(rows: BilledReportRow[]): Group[] {
  const groups = new Map<string, Group>()
  for (const r of rows) {
    const nameNorm = (r.customer_name ?? '').trim().toLowerCase()
    const key = r.customer_id ?? (nameNorm.length > 0 ? `name:${nameNorm}` : '—')
    let g = groups.get(key)
    if (!g) {
      g = { displayName: (r.customer_name ?? '').trim() || '—', rows: [] }
      groups.set(key, g)
    }
    g.rows.push(r)
  }
  for (const g of groups.values()) {
    const named = g.rows.map((row) => (row.customer_name ?? '').trim()).find((n) => n.length > 0)
    if (named) g.displayName = named
  }
  return [...groups.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )
}

/** Oldest first, nulls last, then larger remaining — the print report's row order. */
function sortRows(rows: BilledReportRow[]): BilledReportRow[] {
  return [...rows].sort((a, b) => {
    const ad = a.days_past
    const bd = b.days_past
    if (ad != null || bd != null) {
      if (ad == null) return 1
      if (bd == null) return -1
      if (ad !== bd) return bd - ad
    }
    return b.remaining - a.remaining
  })
}

const TH = 'text-align:left;font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px;border-bottom:1px solid #e7e5e4;'
const TD = 'padding:5px 8px;font-size:12.5px;border-top:1px solid #f0efee;vertical-align:top;color:#1c1917;'

function chip(bg: string, fg: string, border: string, label: string): string {
  return `<span style="display:inline-block;background:${bg};color:${fg};border:1px solid ${border};border-radius:9999px;padding:1px 8px;font-size:11px;font-weight:bold;">${label}</span>`
}

function renderGroup(g: Group): string {
  const sorted = sortRows(g.rows)
  const first = sorted[0]
  const phone = (first?.customer_phone ?? '').trim()
  const email = (first?.customer_email ?? '').trim()
  const heading = g.displayName !== '—' ? g.displayName : 'Jobs with no customer linked'
  const contact =
    phone || email
      ? `<div style="font-size:12px;color:#57534e;margin:0 0 2px;">${
          phone ? `Phone: <a href="tel:${esc(phone.replace(/[^+\d]/g, ''))}" style="color:#2563eb;">${esc(phone)}</a>` : ''
        }${phone && email ? ' &middot; ' : ''}${
          email ? `Email: <a href="mailto:${esc(email)}" style="color:#2563eb;">${esc(email)}</a>` : ''
        }</div>`
      : ''
  const subtotal = sorted.reduce((s, r) => s + r.remaining, 0)
  const body = sorted
    .map((r) => {
      const days =
        r.days_past == null
          ? '<span style="color:#a8a29e;">&mdash;</span>'
          : r.days_past >= 90
            ? `<span style="color:#b91c1c;font-weight:bold;">${r.days_past}</span>`
            : String(r.days_past)
      const est = r.ref_is_estimate ? '<span style="color:#a8a29e;font-size:10px;"> (est.)</span>' : ''
      return `
    <tr>
      <td style="${TD}white-space:nowrap;"><a href="${jobLink(r)}" style="color:#2563eb;font-weight:bold;">${esc(r.display_number ?? '—')}</a></td>
      <td style="${TD}"><a href="${jobLink(r)}" style="color:#2563eb;">${esc((r.job_name ?? '').trim() || '—')}</a>${
        (r.job_address ?? '').trim() ? `<div style="color:#78716c;font-size:11px;">${esc(r.job_address)}</div>` : ''
      }</td>
      <td style="${TD}color:#57534e;">${esc(r.detail)}</td>
      <td style="${TD}text-align:center;white-space:nowrap;">${days}${est}</td>
      <td style="${TD}text-align:right;white-space:nowrap;">${money(r.remaining)}</td>
    </tr>`
    })
    .join('')
  return `
    <div style="font-size:14px;font-weight:bold;color:#1c1917;margin:14px 0 1px;">${esc(heading)}</div>
    ${contact}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:4px 0 2px;">
      <tr><th style="${TH}">HCP</th><th style="${TH}">Job &middot; Address</th><th style="${TH}">Detail</th><th style="${TH}text-align:center;">Days past</th><th style="${TH}text-align:right;">Amount due</th></tr>
      ${body}
      <tr>
        <td colspan="4" style="${TD}font-weight:bold;background:#fafaf9;">Subtotal</td>
        <td style="${TD}text-align:right;font-weight:bold;background:#fafaf9;">${money(subtotal)}</td>
      </tr>
    </table>`
}

export function renderBilledReportEmail(p: BilledReportPayload, senderName?: string): string {
  const groups = groupBilledRows(p.rows)
  const t = p.totals
  return `
  <div style="background:#f5f5f4;padding:16px;">
    <div style="margin:0 auto;max-width:640px;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;padding:22px;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
      <div style="text-align:center;border-bottom:2px solid #e7e5e4;padding-bottom:12px;margin-bottom:4px;">
        <h1 style="margin:0 0 2px;font-size:18px;">Billed awaiting payment &mdash; ${esc(reportDate(p.generated_at))}</h1>
        <div style="font-size:12px;color:#57534e;">${t.row_count} open billing line${t.row_count === 1 ? '' : 's'} &middot; <b>${money(t.grand_total)}</b> due</div>
        <div style="margin-top:8px;">
          ${chip('#fef3c7', '#92400e', '#fcd34d', `30&ndash;90 days &middot; ${t.count30_90} &middot; ${money(t.sum30_90)}`)}
          ${chip('#fee2e2', '#b91c1c', '#fca5a5', `90+ days &middot; ${t.count90} &middot; ${money(t.sum90)}`)}
        </div>
      </div>
      ${groups.length === 0 ? '<p style="text-align:center;color:#57534e;font-size:13px;">Nothing billed awaiting payment. Nice.</p>' : groups.map(renderGroup).join('')}
      <div style="text-align:center;margin-top:14px;padding-top:10px;border-top:2px solid #e7e5e4;font-size:14px;">
        Grand total due: <b>${money(t.grand_total)}</b>
      </div>
      <p style="margin:14px 0 0;text-align:center;">
        <a href="${APP_URL}/jobs?tab=stages" style="display:inline-block;background:#2563eb;color:#ffffff;border-radius:6px;padding:8px 16px;font-weight:bold;text-decoration:none;font-size:13px;">Open the board in PipeTooling</a>
      </p>
      <p style="margin:12px 0 0;font-size:10.5px;color:#a8a29e;text-align:center;">${
        senderName ? `Sent by ${esc(senderName)} from PipeTooling &middot; ` : 'PipeTooling &middot; '
      }numbers as of send time &middot; click any job to open its detail in the app</p>
    </div>
  </div>`
}

export function billedReportEmailSubject(p: BilledReportPayload): string {
  return `Billed awaiting payment — ${reportDate(p.generated_at)} — ${money(p.totals.grand_total)} due`
}

export function billedReportEmailText(p: BilledReportPayload): string {
  const groups = groupBilledRows(p.rows)
  const lines = [
    `Billed awaiting payment — ${reportDate(p.generated_at)}`,
    `${p.totals.row_count} open billing lines · ${money(p.totals.grand_total)} due`,
    '',
  ]
  for (const g of groups) {
    lines.push(g.displayName !== '—' ? g.displayName : 'Jobs with no customer linked')
    for (const r of sortRows(g.rows)) {
      lines.push(
        `  ${r.display_number ?? '—'} · ${(r.job_name ?? '').trim() || '—'} · ${
          r.days_past != null ? `${r.days_past}d` : '—'
        } · ${money(r.remaining)} · ${jobLink(r)}`,
      )
    }
  }
  lines.push('', `Grand total due: ${money(p.totals.grand_total)}`)
  return lines.join('\n')
}
