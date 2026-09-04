/**
 * HTML/text renderer for the "Your statement round" email
 * (statement-round-email-dispatch, v2.2771). The GC Review round overlay as a
 * morning note: each certified GC waiting on the recipient with its amount,
 * job count, and age, one Start round link, and the held-on-certification
 * count so the sender knows what is coming. Email-safe markup: inline
 * styles, light colors, no scripts.
 */
export type StatementRoundPayload = {
  week_start: string
  user_id: string
  ready: Array<{ gc_id: string; gc_name: string; amount: number; job_count: number; oldest_age_days: number | null; certified_by_name: string | null }>
  held: { count: number; total: number }
  assigned_to_me: number
  sent_by_me: number
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const usd = (n: number): string =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usdRound = (n: number): string => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`

export function roundTotal(p: StatementRoundPayload): number {
  return p.ready.reduce((t, r) => t + Number(r.amount || 0), 0)
}

export function statementRoundSubject(p: StatementRoundPayload, dateLabel: string): string {
  const n = p.ready.length
  if (n === 0) return `Your statement round — nothing waiting (${dateLabel})`
  return `Your statement round — ${n} GC${n === 1 ? '' : 's'}, ${usdRound(roundTotal(p))} (${dateLabel})`
}

export function statementRoundText(p: StatementRoundPayload, dateLabel: string, roundUrl: string, recipientName: string | null): string {
  const lines: string[] = []
  lines.push(`Your statement round — ${dateLabel}${recipientName ? ` — ${recipientName}` : ''}`)
  lines.push('')
  if (p.ready.length === 0) {
    lines.push('Nothing is waiting on you right now.')
  } else {
    lines.push(`${p.ready.length} GC${p.ready.length === 1 ? '' : 's'} certified and ready — a personal email from you, not the system:`)
    for (const r of p.ready) {
      lines.push(
        `  - ${r.gc_name}: ${usd(r.amount)} · ${r.job_count} job${r.job_count === 1 ? '' : 's'}${r.oldest_age_days != null ? ` · oldest ${r.oldest_age_days}d` : ''}${r.certified_by_name ? ` · certified by ${r.certified_by_name}` : ''}`,
      )
    }
    lines.push('')
    lines.push(`Start round: ${roundUrl}`)
  }
  if (p.held.count > 0) {
    lines.push('')
    lines.push(`${p.held.count} more GC${p.held.count === 1 ? '' : 's'} (${usdRound(p.held.total)}) wait on certification and will join your round once signed off.`)
  }
  if (p.sent_by_me > 0) {
    lines.push('')
    lines.push(`Already sent this week: ${p.sent_by_me}.`)
  }
  lines.push('')
  lines.push('Manage this email in Settings → My email schedule.')
  return lines.join('\n')
}

export function renderStatementRoundHtml(p: StatementRoundPayload, dateLabel: string, roundUrl: string, recipientName: string | null): string {
  const rows = p.ready
    .map(
      (r) => `
        <tr>
          <td style="padding:7px 0;border-top:1px solid #e2e8f0;font-size:14px;color:#0f172a;">
            <b>${esc(r.gc_name)}</b>
            <div style="font-size:12px;color:#64748b;margin-top:1px;">${r.job_count} job${r.job_count === 1 ? '' : 's'}${r.oldest_age_days != null ? ` · oldest ${r.oldest_age_days}d` : ''}${r.certified_by_name ? ` · certified by ${esc(r.certified_by_name)}` : ''}</div>
          </td>
          <td style="padding:7px 0;border-top:1px solid #e2e8f0;font-size:14px;color:#0f172a;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;"><b>${esc(usd(r.amount))}</b></td>
        </tr>`,
    )
    .join('')
  const body =
    p.ready.length === 0
      ? `<p style="margin:0 0 8px;font-size:14px;color:#334155;">Nothing is waiting on you right now.</p>`
      : `<p style="margin:0 0 8px;font-size:14px;color:#334155;">${p.ready.length} GC${p.ready.length === 1 ? '' : 's'} certified and ready — a personal email from you, not the system.</p>
      <table style="width:100%;border-collapse:collapse;">${rows}
        <tr>
          <td style="padding:8px 0 0;border-top:2px solid #cbd5e1;font-size:13px;color:#64748b;">Total</td>
          <td style="padding:8px 0 0;border-top:2px solid #cbd5e1;font-size:14px;color:#0f172a;text-align:right;white-space:nowrap;"><b>${esc(usd(roundTotal(p)))}</b></td>
        </tr>
      </table>
      <p style="margin:14px 0 4px;">
        <a href="${esc(roundUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:9px 16px;border-radius:6px;">Start round &#8594;</a>
      </p>
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Opens GC Review on your first GC: preview, copy for email, send from your own inbox, mark sent.</p>`
  const held =
    p.held.count > 0
      ? `<p style="margin:12px 0 0;font-size:12.5px;color:#b45309;">&#128274; ${p.held.count} more GC${p.held.count === 1 ? '' : 's'} (${esc(usdRound(p.held.total))}) wait on certification and will join your round once signed off.</p>`
      : ''
  const sent = p.sent_by_me > 0 ? `<p style="margin:6px 0 0;font-size:12.5px;color:#15803d;">Already sent this week: ${p.sent_by_me}.</p>` : ''
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:20px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;">
      <h1 style="margin:0 0 2px;font-size:18px;color:#0f172a;">Your statement round — ${esc(dateLabel)}</h1>
      <p style="margin:0 0 12px;font-size:12.5px;color:#64748b;">Rebuilt fresh at send time${recipientName ? ` · for ${esc(recipientName)}` : ''}</p>
      ${body}
      ${held}
      ${sent}
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:10px 4px;">Manage this email in Settings &#8594; My email schedule.</p>
  </div>
</body></html>`
}
