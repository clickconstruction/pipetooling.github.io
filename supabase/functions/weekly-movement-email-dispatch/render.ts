/**
 * Weekly movement email rendering (v2.1437). KEEP IN SYNC with
 * src/lib/jobs/stagesWeeklyMovement.ts buildWeeklyMovementReportHtml — same
 * sections/rows, email-wrapped. Builds from the
 * get_weekly_movement_email_payload RPC shape.
 */

export type WeeklyMovementPayloadEntry = {
  event_id: string
  job_id: string
  display: string
  address: string
  weekday: string
  mover_name: string
  revenue: number
  from_label?: string
  to_label?: string
}

export type WeeklyMovementPayload = {
  generated_at: string
  week_monday: string
  sections: Array<{
    to_status: string
    label: string
    entries: WeeklyMovementPayloadEntry[]
    job_count: number
    total: number
  }>
  send_backs: WeeklyMovementPayloadEntry[]
  move_count: number
  job_count: number
}

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "Aug 3 – 9" / "Aug 31 – Sep 6" from the week's Monday (YYYY-MM-DD). */
export function weekLabelFromMonday(mondayYmd: string): string {
  const monday = new Date(`${mondayYmd}T12:00:00Z`)
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString('en-US', { timeZone: 'UTC', ...(withMonth ? { month: 'short' as const } : {}), day: 'numeric' })
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth()
  return `${fmt(monday, true)} – ${fmt(sunday, !sameMonth)}`
}

export function weeklyMovementSubject(weekLabel: string): string {
  return `Weekly movement — ${weekLabel} — Click Plumbing and Electrical`
}

export function renderWeeklyMovementHtml(payload: WeeklyMovementPayload, weekLabel: string, senderName?: string): string {
  const section = (title: string, meta: string, rows: string) => `<h2 style="font-size:15px;margin:18px 0 4px;color:#111827">${escapeHtml(title)} <span style="font-weight:normal;font-size:12px;color:#4b5563">${escapeHtml(meta)}</span></h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>`
  const sectionsHtml = payload.sections
    .map((s) =>
      section(
        `Moved to ${s.label}`,
        `· ${s.job_count} job${s.job_count === 1 ? '' : 's'} · $${money(s.total)}`,
        s.entries
          .map(
            (e) => `<tr>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#111827">${escapeHtml(e.display)}${e.address ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(e.address)}</span>` : ''}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563;white-space:nowrap">${escapeHtml(e.weekday)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563">${escapeHtml(e.mover_name)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#111827;text-align:right">$${money(e.revenue)}</td>
    </tr>`,
          )
          .join(''),
      ),
    )
    .join('\n')
  const sendBacksHtml =
    payload.send_backs.length === 0
      ? ''
      : section(
          'Sent back',
          `· ${payload.send_backs.length} move${payload.send_backs.length === 1 ? '' : 's'}`,
          payload.send_backs
            .map(
              (e) => `<tr>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#111827">${escapeHtml(e.display)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563;white-space:nowrap">${escapeHtml(e.weekday)} · ${escapeHtml(e.from_label ?? '—')} → ${escapeHtml(e.to_label ?? '—')}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563;text-align:right">${escapeHtml(e.mover_name)}</td>
    </tr>`,
            )
            .join(''),
        )
  const body =
    payload.move_count === 0
      ? `<p style="font-size:13px;color:#4b5563">No stage moves this week.</p>`
      : sectionsHtml + '\n' + sendBacksHtml
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px">
  <h1 style="font-size:18px;margin:0;color:#111827">Weekly movement — ${escapeHtml(weekLabel)}</h1>
  <p style="margin:2px 0 8px;font-size:12px;color:#4b5563">${payload.move_count} move${payload.move_count === 1 ? '' : 's'} · ${payload.job_count} job${payload.job_count === 1 ? '' : 's'} · Click Plumbing and Electrical</p>
  ${body}
  <p style="margin:14px 0 0;font-size:11px;color:#6b7280">${senderName ? `Sent by ${escapeHtml(senderName)} · ` : ''}Rebuilt fresh at send time from the Jobs Pipeline.</p>
</div>`
}

export function renderWeeklyMovementText(payload: WeeklyMovementPayload, weekLabel: string): string {
  const lines: string[] = [`Weekly movement — ${weekLabel}`, `${payload.move_count} moves · ${payload.job_count} jobs`, '']
  for (const s of payload.sections) {
    lines.push(`Moved to ${s.label} · ${s.job_count} job${s.job_count === 1 ? '' : 's'} · $${money(s.total)}`)
    for (const e of s.entries) lines.push(`- ${e.display} — ${e.weekday} — ${e.mover_name} — $${money(e.revenue)}`)
    lines.push('')
  }
  if (payload.send_backs.length > 0) {
    lines.push(`Sent back · ${payload.send_backs.length}`)
    for (const e of payload.send_backs) lines.push(`- ${e.display} — ${e.weekday} · ${e.from_label ?? '—'} → ${e.to_label ?? '—'} — ${e.mover_name}`)
  }
  if (payload.move_count === 0) lines.push('No stage moves this week.')
  return lines.join('\n')
}
