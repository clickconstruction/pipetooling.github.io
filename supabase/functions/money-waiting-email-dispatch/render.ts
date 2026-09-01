/**
 * HTML renderer for the Money waiting email (money-waiting-email-dispatch,
 * v2.2565). Mirrors the Pay speeds "Money waiting" list top-to-bottom:
 * color legend, then every off-pace customer slowest-first — their open-bills
 * bar sized by dollars, days waiting vs their usual pace, and EVERY open bill
 * spelled out beneath them (tone dot, job · full address with city, dollars,
 * wait) exactly like the app's expanded row (owner-approved mockup). Long
 * lists fold behind "+ N more jobs" with the leftover dollars. Jobs deep-link
 * to ?jobDetail=; the CTA opens the board's forecast modal (Pay speeds is its
 * strip). Email-safe markup: inline-styled <table>s, light colors only.
 */
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import {
  buildMoneyWaitingFromPayload,
  type MoneyWaiting,
  type MoneyWaitingEmailPayload,
  type MoneyWaitingRow,
  type OpenBill,
  type OpenBillTone,
} from '../_shared/moneyWaitingCore.ts'

export type { MoneyWaitingEmailPayload }

/** Prod app origin for deep links (billed-report-email precedent). */
export const APP_URL = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)

const TONE_COLORS: Record<OpenBillTone, string> = {
  ok: '#16a34a',
  warn: '#d97706',
  late: '#dc2626',
  undated: '#94a3b8',
}

/** Bills shown per customer before the "+ N more jobs" fold. */
const MAX_BILLS_PER_CUSTOMER = 8

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toLocaleString('en-US')}`
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

function jobLink(jobId: string | null): string | null {
  return jobId ? `${APP_URL}/jobs?jobDetail=${encodeURIComponent(jobId)}` : null
}

function build(p: MoneyWaitingEmailPayload): MoneyWaiting | null {
  return buildMoneyWaitingFromPayload(p)
}

export function moneyWaitingEmailSubject(p: MoneyWaitingEmailPayload): string {
  const mw = build(p)
  if (!mw || mw.rows.length === 0) return 'Money waiting — everyone is on pace'
  const total = mw.rows.reduce((s, r) => s + r.open, 0)
  return `Money waiting — ${mw.rows.length} customer${mw.rows.length === 1 ? '' : 's'} off pace, ${money(total)} open`
}

/** Plain-text alternative (deliverability + previews). */
export function moneyWaitingEmailText(p: MoneyWaitingEmailPayload): string {
  const mw = build(p)
  if (!mw) return 'Money waiting: pay-speed data unavailable — open ClickTooling to check.'
  const lines: string[] = ['Money waiting — slowest first', '']
  if (mw.rows.length === 0) {
    lines.push('Everyone with open billed money is on their usual pace this week.')
  }
  for (const r of mw.rows) {
    lines.push(
      `${r.name}: oldest bill waiting ${r.oldestWaitDays}d (${r.ownMedianDays != null ? `usually ~${r.ownMedianDays}d` : `no history — company ~${mw.companyMedianDays}d`}) · ${money(r.open)} open`,
    )
    for (const b of r.bills) {
      lines.push(
        `  - ${b.jobName}${b.address ? ` · ${b.address}` : ''} — ${money(b.open)}${b.waitDays != null ? `, waiting ${b.waitDays}d` : ', no bill date'}`,
      )
    }
  }
  lines.push('', `On pace: ${mw.onPaceCount} customer${mw.onPaceCount === 1 ? '' : 's'} · ${money(mw.onPaceOpen)} open`)
  return lines.join('\n')
}

function billRow(b: OpenBill): string {
  const link = jobLink(b.jobId)
  const jobLabel = `${esc(b.jobName)}${b.address ? ` &middot; ${esc(b.address)}` : ''}`
  const jobCell = link
    ? `<a href="${link}" style="color:#374151;text-decoration:none;">${jobLabel}</a>`
    : jobLabel
  return `<tr>
    <td style="padding:2px 0 2px 14px;font-size:12px;color:#374151;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${TONE_COLORS[b.tone]};margin-right:6px;"></span>${jobCell}
    </td>
    <td align="right" style="padding:2px 0;font-size:12px;color:#5b6472;white-space:nowrap;">
      <b style="color:#111827;">${money(b.open)}</b> &middot; ${b.waitDays != null ? `waiting ${b.waitDays}d` : 'no bill date'}
    </td>
  </tr>`
}

function customerBlock(r: MoneyWaitingRow, companyMedianDays: number): string {
  const segTag =
    r.segment === 'commercial'
      ? '<span style="font-size:10px;font-weight:bold;color:#92400e;background:#fef3c7;border-radius:9px;padding:1px 6px;">COMM</span>'
      : r.segment === 'residential'
        ? '<span style="font-size:10px;font-weight:bold;color:#1e40af;background:#dbeafe;border-radius:9px;padding:1px 6px;">RES</span>'
        : ''
  const barCells = r.bills
    .map((b) => {
      const pct = r.open > 0 ? Math.max((b.open / r.open) * 100, 3) : 3
      return `<td style="width:${pct.toFixed(1)}%;background:${TONE_COLORS[b.tone]};height:8px;border-radius:2px;"></td><td style="width:2px;"></td>`
    })
    .join('')
  const shown = r.bills.slice(0, MAX_BILLS_PER_CUSTOMER)
  const rest = r.bills.slice(MAX_BILLS_PER_CUSTOMER)
  const restOpen = rest.reduce((s, b) => s + b.open, 0)
  const usually =
    r.ownMedianDays != null ? `usually ~${r.ownMedianDays}d` : `no history — vs company ~${companyMedianDays}d`
  const jobs = new Set(r.bills.map((b) => b.jobId ?? b.jobName)).size
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef1f5;margin-top:6px;padding-top:6px;">
    <tr>
      <td style="font-size:13px;color:#111827;padding:6px 0 2px;"><b>${esc(r.name)}</b> ${segTag}</td>
      <td align="right" style="font-size:13px;padding:6px 0 2px;white-space:nowrap;"><b style="color:#dc2626;">${r.oldestWaitDays}d waiting</b></td>
    </tr>
    <tr><td colspan="2" style="padding:2px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${barCells}</tr></table></td></tr>
    <tr><td colspan="2" style="font-size:11px;color:#5b6472;padding:0 0 3px;">${esc(usually)} &middot; <b style="color:#111827;">${money(r.open)}</b> open on ${jobs} ${jobs === 1 ? 'job' : 'jobs'}</td></tr>
    <tr><td colspan="2"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${shown.map(billRow).join('')}
      ${rest.length > 0 ? `<tr><td style="padding:2px 0 2px 14px;font-size:12px;color:#5b6472;">+ ${rest.length} more ${rest.length === 1 ? 'job' : 'jobs'}&hellip;</td><td align="right" style="font-size:12px;color:#5b6472;"><b style="color:#111827;">${money(restOpen)}</b></td></tr>` : ''}
    </table></td></tr>
  </table>`
}

export function renderMoneyWaitingEmail(p: MoneyWaitingEmailPayload, senderName?: string): string {
  const mw = build(p)
  const legend = `<div style="font-size:11px;color:#5b6472;margin:0 0 8px;">
    <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${TONE_COLORS.ok};"></span> on their pace&nbsp;&nbsp;
    <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${TONE_COLORS.warn};"></span> past their pace&nbsp;&nbsp;
    <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${TONE_COLORS.late};"></span> way past&nbsp;&nbsp;
    <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${TONE_COLORS.undated};"></span> no bill date
  </div>`
  const bodyCore = !mw
    ? `<p style="font-size:13px;color:#5b6472;">Pay-speed data was unavailable when this was built — open ClickTooling to check the board directly.</p>`
    : mw.rows.length === 0
      ? `<p style="font-size:13px;color:#374151;">Everyone with open billed money is on their usual pace this week — ${mw.onPaceCount} customer${mw.onPaceCount === 1 ? '' : 's'}, ${money(mw.onPaceOpen)} open. Nothing needs chasing.</p>`
      : `${legend}${mw.rows.map((r) => customerBlock(r, mw.companyMedianDays)).join('')}
        <p style="font-size:11px;color:#5b6472;margin:10px 0 0;">On pace and not shown: ${mw.onPaceCount} customer${mw.onPaceCount === 1 ? '' : 's'} &middot; ${money(mw.onPaceOpen)} open.</p>`
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:18px 8px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:18px 20px 4px;">
        <h1 style="margin:0;font-size:18px;color:#111827;">Money waiting</h1>
        <p style="margin:2px 0 12px;font-size:12px;color:#5b6472;">slowest first &middot; bars are their open bills, sized by dollars &middot; ${esc(reportDate(p.generated_at))} &middot; Central time</p>
        ${bodyCore}
        <p style="margin:16px 0 4px;">
          <a href="${APP_URL}/jobs?tab=stages&amp;forecast=1" style="display:inline-block;background:#2563eb;color:#ffffff;border-radius:6px;padding:9px 18px;font-weight:bold;text-decoration:none;font-size:13px;">Open Pay speeds in ClickTooling</a>
        </p>
        <p style="margin:10px 0 14px;font-size:11px;color:#9aa2ae;">${senderName ? `Sent by ${esc(senderName)} &middot; ` : ''}Numbers rebuilt at send time from the live board.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`
}
