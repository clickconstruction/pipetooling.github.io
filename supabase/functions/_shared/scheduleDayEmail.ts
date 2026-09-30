/**
 * The Dispatch schedule (one day) email — lifted verbatim out of
 * `schedule-day-email-dispatch/index.ts` in v2.4177 (punch list #60, lift 8 of 14) so
 * Settings → What the team sees renders it on sample data. Pure: the day's dispatch rows in,
 * subject + HTML + text out. Times are Postgres `time` strings, printed as-is (they are
 * already in the app's calendar zone).
 */
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

export type ScheduleDayBlockRow = {
  id: string
  job_id: string
  assignee_user_id: string
  work_date: string
  time_start: string
  time_end: string
  note: string | null
  assignee_name: string
  job_hcp_number: string | null
  job_name: string | null
  job_address: string | null
}

export function formatPgTimeHm(pg: string): string {
  const parts = pg.trim().split(':')
  const h = Number(parts[0] ?? '0')
  const min = Number(parts[1] ?? '0')
  let sec = 0
  if (parts[2] != null) {
    const secPart = String(parts[2]).split('.')[0] ?? '0'
    const n = Number(secPart)
    sec = Number.isFinite(n) ? n : 0
  }
  if (!Number.isFinite(h) || !Number.isFinite(min)) return pg
  const d = new Date(Date.UTC(2000, 0, 1, h, min, sec))
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildScheduleEmail(params: {
  workDateYmd: string
  blocks: ScheduleDayBlockRow[]
}): { html: string; text: string; subject: string } {
  const { workDateYmd, blocks } = params
  const subject = `Dispatch schedule — ${workDateYmd} (${APP_CALENDAR_TZ})`

  if (blocks.length === 0) {
    const plain = `No scheduled dispatch blocks for ${workDateYmd} (in your visibility).\n`
    const html =
      `<p style="font-family:system-ui,sans-serif;font-size:14px;color:#111">` +
      `No scheduled dispatch blocks for <strong>${escapeHtml(workDateYmd)}</strong> ` +
      `(nothing on file for you at send time).</p>`
    return { subject, html, text: plain }
  }

  const rowsHtml = blocks
    .map((b) => {
      const window = `${formatPgTimeHm(b.time_start)}–${formatPgTimeHm(b.time_end)}`
      const jobLabel = `${(b.job_hcp_number ?? '').trim() || '—'} · ${(b.job_name ?? '').trim() || 'Job'}`
      const addr = (b.job_address ?? '').trim().split('\n').map(escapeHtml).join('<br/>')
      const note = (b.note ?? '').trim()
      return `<tr>
<td style="padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap">${escapeHtml(
        window,
      )}</td>
<td style="padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(
        b.assignee_name || '(assignee)',
      )}</td>
<td style="padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(jobLabel)}${
        addr
          ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">${addr}</div>`
          : ''
      }${note ? `<div style="font-size:12px;color:#374151;margin-top:4px">${escapeHtml(note)}</div>` : ''}</td>
</tr>`
    })
    .join('')

  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">` +
    `<p style="margin:0 0 12px">Dispatch schedule for <strong>${escapeHtml(workDateYmd)}</strong> (${APP_CALENDAR_TZ} times).</p>` +
    `<table style="border-collapse:collapse;width:100%;max-width:720px">` +
    `<thead><tr style="background:#f9fafb">` +
    `<th align="left" style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Window</th>` +
    `<th align="left" style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Person</th>` +
    `<th align="left" style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Job</th>` +
    `</tr></thead><tbody>${rowsHtml}</tbody></table></div>`

  const text = [
    `Dispatch schedule for ${workDateYmd} (${APP_CALENDAR_TZ})`,
    '',
    ...blocks.map((b) => {
      const window = `${formatPgTimeHm(b.time_start)}–${formatPgTimeHm(b.time_end)}`
      const jobLabel = `${(b.job_hcp_number ?? '').trim() || '—'} · ${(b.job_name ?? '').trim() || 'Job'}`
      const addr = (b.job_address ?? '').trim()
      const note = (b.note ?? '').trim()
      return [
        `${window}  ${b.assignee_name || ''}  ${jobLabel}`,
        addr ? `  ${addr.split('\n').join('  \n')}` : '',
        note ? `  Note: ${note}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    }),
    '',
  ].join('\n')

  return { subject, html, text }
}
