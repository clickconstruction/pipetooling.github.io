/**
 * HTML renderer for the Payment forecast email
 * (payment-forecast-email-dispatch edge function, v2.2225).
 *
 * Mirrors the Stages "Payment forecast" modal top-to-bottom: the bucket tile
 * strip, the pay-speeds line, then each bucket's bills in modal order —
 * Past expected first (the follow-up queue is the actionable part, so it
 * leads). Every job number deep-links to ?jobDetail=; the CTA opens the
 * board with the forecast modal already up (?forecast=1, the client half of this train).
 *
 * Email-safe markup: inline-styled <table>s, light colors only, no external
 * assets (matches billed-report-email/render.ts).
 */

import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import {
  buildForecastFromPayload,
  formatYmdMonthDay,
  type ForecastBucket,
  type ForecastEmailPayload,
  type ForecastRow,
  type PaymentForecast,
} from '../_shared/paymentForecastCore.ts'

/** Prod app origin for deep links (billed-report-email precedent). */
export const APP_URL = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Whole dollars — the modal's formatUsdNoCents. */
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

function jobLink(r: ForecastRow): string {
  return `${APP_URL}/jobs?jobDetail=${encodeURIComponent(r.jobId)}`
}

/** The modal's row annotations: basis note + expected/late label. */
function rowBasis(r: ForecastRow): string {
  if (r.model?.source === 'customer') return `pays in ~${r.model.medianDays}d`
  if (r.model?.source === 'promised') return `promised · ${r.promisedBy ?? 'office'}`
  if (r.model) return 'company avg'
  return 'no history'
}

function rowDateHtml(r: ForecastRow): string {
  if (!r.model) return '<span style="color:#a8a29e;">no history</span>'
  if (r.model.source === 'promised') {
    return r.model.state === 'late'
      ? `<span style="color:#b91c1c;font-weight:bold;">${r.model.daysLate}d past promise</span>`
      : `<span style="color:#15803d;font-weight:bold;">&#10003; ${esc(formatYmdMonthDay(r.model.expectedYmd))}</span>`
  }
  if (r.model.state === 'late') return `<span style="color:#b91c1c;font-weight:bold;">${r.model.daysLate}d late</span>`
  return `<span style="color:#1e40af;font-weight:bold;">~${esc(formatYmdMonthDay(r.model.expectedYmd))}</span>`
}

function segTag(r: ForecastRow): string {
  if (!r.segment) return ''
  const comm = r.segment === 'commercial'
  return ` <span style="display:inline-block;background:${comm ? '#fef3c7' : '#dbeafe'};color:${
    comm ? '#92400e' : '#1e40af'
  };border-radius:9999px;padding:0 6px;font-size:9.5px;font-weight:bold;">${comm ? 'Comm' : 'Res'}</span>`
}

const TILE_BASE = 'border-radius:8px;padding:7px 4px;text-align:center;'

function tile(b: ForecastBucket): string {
  const colors =
    b.key === 'past' && b.rows.length > 0
      ? 'background:#fee2e2;border:1px solid #fca5a5;color:#b91c1c;'
      : b.key === 'thisWeek' && b.rows.length > 0
        ? 'background:#dbeafe;border:1px solid #93c5fd;color:#1e40af;'
        : 'background:#fafaf9;border:1px solid #e7e5e4;color:#57534e;'
  return `<td style="width:20%;padding:0 3px;"><div style="${TILE_BASE}${colors}">
    <div style="font-size:10px;">${esc(b.title)}</div>
    <div style="font-size:14px;font-weight:bold;">${money(b.sum)}</div>
    <div style="font-size:9.5px;">${b.rows.length === 0 ? '&mdash;' : `${b.rows.length} bill${b.rows.length === 1 ? '' : 's'}`}</div>
  </div></td>`
}

function renderBucket(b: ForecastBucket): string {
  if (b.rows.length === 0) return ''
  const red = b.key === 'past'
  const heading = `<div style="font-size:13.5px;font-weight:bold;color:${red ? '#b91c1c' : '#1c1917'};margin:18px 0 2px;padding-bottom:3px;border-bottom:1px solid ${red ? '#fca5a5' : '#e7e5e4'};">
    ${esc(b.title)} &middot; ${money(b.sum)} <span style="color:#57534e;font-weight:normal;">&middot; ${b.rows.length} bill${b.rows.length === 1 ? '' : 's'}${red ? ' &middot; follow up' : ''}</span>
  </div>`
  const body = b.rows
    .map(
      (r) => `
    <tr>
      <td style="padding:5px 4px;font-size:12px;border-top:1px solid #f0efee;color:#1c1917;">
        <a href="${jobLink(r)}" style="color:#2563eb;font-weight:bold;text-decoration:none;">${esc(r.label)}</a>${
          r.customerName ? ` <span style="color:#57534e;">&middot; ${esc(r.customerName)}</span>` : ''
        }${segTag(r)} <span style="color:#a8a29e;font-size:10.5px;">&middot; ${esc(rowBasis(r))}</span>
      </td>
      <td style="padding:5px 4px;font-size:12px;border-top:1px solid #f0efee;text-align:right;white-space:nowrap;">${rowDateHtml(r)}</td>
      <td style="padding:5px 4px;font-size:12px;border-top:1px solid #f0efee;text-align:right;white-space:nowrap;font-weight:bold;">${money(r.open)}</td>
    </tr>`,
    )
    .join('')
  return `${heading}<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">${body}</table>`
}

function paySpeedsLine(p: ForecastEmailPayload): string {
  const s = p.pay_speeds
  if (!s) return ''
  const part = (label: string, stat: { medianDays: number; samples: number } | null): string =>
    stat
      ? `${label} <b>~${stat.medianDays}d</b> <span style="color:#a8a29e;">(${stat.samples})</span>`
      : `${label} <span style="color:#a8a29e;">no data</span>`
  return `<div style="text-align:center;font-size:11px;color:#57534e;margin:8px 0 2px;">
    Pay speeds: ${part('Company', s.company)} &middot; ${part('Res', s.segments.residential)} &middot; ${part('Comm', s.segments.commercial)}
  </div>`
}

export function renderPaymentForecastEmail(p: ForecastEmailPayload, senderName?: string): string {
  const f = buildForecastFromPayload(p)
  const visible = f.buckets.filter((b) => b.key !== 'unknown' || b.rows.length > 0)
  const tiles = visible.slice(0, 5)
  const empty = f.rowCount === 0
  return `
  <div style="background:#f5f5f4;padding:16px;">
    <div style="margin:0 auto;max-width:640px;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;padding:22px;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
      <div style="text-align:center;border-bottom:2px solid #e7e5e4;padding-bottom:12px;">
        <h1 style="margin:0 0 2px;font-size:18px;">Payment forecast &mdash; ${esc(reportDate(p.generated_at))}</h1>
        <div style="font-size:12px;color:#57534e;">${
          empty
            ? 'Nothing open on the board. Nice.'
            : `${f.rowCount} open bill${f.rowCount === 1 ? '' : 's'} &middot; <b>${money(f.openTotal)}</b> total &middot; expected dates = bill date + each customer's median pay speed`
        }</div>
      </div>
      ${
        empty
          ? ''
          : `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:14px 0 4px;"><tr>${tiles
              .map(tile)
              .join('')}</tr></table>
      ${paySpeedsLine(p)}
      ${f.buckets.map(renderBucket).join('')}`
      }
      <p style="margin:18px 0 0;text-align:center;">
        <a href="${APP_URL}/jobs?tab=stages&amp;forecast=1" style="display:inline-block;background:#2563eb;color:#ffffff;border-radius:6px;padding:9px 18px;font-weight:bold;text-decoration:none;font-size:13px;">Open the forecast in PipeTooling</a>
      </p>
      <p style="margin:12px 0 0;font-size:10.5px;color:#a8a29e;text-align:center;">${
        senderName ? `Sent by ${esc(senderName)} from PipeTooling &middot; ` : 'PipeTooling &middot; '
      }numbers as of send time${f.skippedNoMoney > 0 ? ` &middot; ${f.skippedNoMoney} paid-to-zero row${f.skippedNoMoney === 1 ? '' : 's'} not shown` : ''}${
        p.pay_speeds == null ? ' &middot; pay speeds unavailable' : ''
      } &middot; click any job to open it in the app</p>
    </div>
  </div>`
}

export function paymentForecastEmailSubject(p: ForecastEmailPayload): string {
  const f = buildForecastFromPayload(p)
  if (f.rowCount === 0) return `Payment forecast — ${reportDate(p.generated_at)} — nothing open`
  const past = f.buckets.find((b) => b.key === 'past')
  const thisWeek = f.buckets.find((b) => b.key === 'thisWeek')
  const parts: string[] = []
  if (past && past.rows.length > 0) parts.push(`${money(past.sum)} past expected`)
  if (thisWeek && thisWeek.rows.length > 0) parts.push(`${money(thisWeek.sum)} this week`)
  const tail = parts.length > 0 ? parts.join(' · ') : `${money(f.openTotal)} open`
  return `Payment forecast — ${reportDate(p.generated_at)} — ${tail}`
}

export function paymentForecastEmailText(p: ForecastEmailPayload): string {
  const f = buildForecastFromPayload(p)
  const lines = [`Payment forecast — ${reportDate(p.generated_at)}`]
  if (f.rowCount === 0) {
    lines.push('Nothing open on the board.')
    return lines.join('\n')
  }
  lines.push(`${f.rowCount} open bills · ${money(f.openTotal)} total`, '')
  for (const b of f.buckets) {
    if (b.rows.length === 0) continue
    lines.push(`${b.title} · ${money(b.sum)} · ${b.rows.length} bills${b.key === 'past' ? ' · follow up' : ''}`)
    for (const r of b.rows) {
      const date = !r.model
        ? 'no history'
        : r.model.state === 'late'
          ? `${r.model.daysLate}d late`
          : `~${formatYmdMonthDay(r.model.expectedYmd)}`
      lines.push(`  ${r.label}${r.customerName ? ` · ${r.customerName}` : ''} · ${date} · ${money(r.open)} · ${jobLink(r)}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export type { ForecastEmailPayload, PaymentForecast }
