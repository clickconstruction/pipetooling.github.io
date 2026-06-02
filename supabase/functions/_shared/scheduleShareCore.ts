/** Share Schedule core: day-set math + full-board email rendering (grouped by person). */

import { addDaysToYmd } from './recurringJobReportTimezone.ts'
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

export type ShareScope = 'none' | 'next_day' | 'rest_of_week'

export interface ShareDayConfig {
  includeCurrentDay: boolean
  scope: ShareScope
}

export interface ShareBlockRow {
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

/** 0=Sun … 6=Sat for a pure `YYYY-MM-DD` (timezone-agnostic). Returns 0 on parse failure. */
export function dowSun0FromYmd(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return 0
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCDay()
}

/**
 * Resolve the set of work dates a share email covers, relative to `baseYmd`.
 * - current day: `baseYmd` (when includeCurrentDay)
 * - next_day: baseYmd + 1
 * - rest_of_week: baseYmd + 1 .. the coming Sunday (week ends Sunday; empty when baseYmd is Sunday)
 * Returns a sorted, de-duplicated ascending list of `YYYY-MM-DD`.
 */
export function computeShareDates(baseYmd: string, config: ShareDayConfig): string[] {
  const set = new Set<string>()
  if (config.includeCurrentDay) set.add(baseYmd)
  if (config.scope === 'next_day') {
    const d = addDaysToYmd(baseYmd, 1)
    if (d) set.add(d)
  } else if (config.scope === 'rest_of_week') {
    const dow = dowSun0FromYmd(baseYmd)
    const daysUntilSunday = (7 - dow) % 7 // 0 when baseYmd is Sunday
    for (let i = 1; i <= daysUntilSunday; i += 1) {
      const d = addDaysToYmd(baseYmd, i)
      if (d) set.add(d)
    }
  }
  return [...set].sort()
}

/** At least one day-set selected, and next_day/rest_of_week are mutually exclusive (encoded by `scope`). */
export function isShareConfigValid(config: ShareDayConfig): boolean {
  return config.includeCurrentDay || config.scope !== 'none'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `HH:MM[:SS]` Postgres time → `h:MM AM/PM`. */
function formatPgTimeHm(pg: string): string {
  const parts = pg.trim().split(':')
  const h = Number(parts[0] ?? '0')
  const min = Number(parts[1] ?? '0')
  if (!Number.isFinite(h) || !Number.isFinite(min)) return pg
  const d = new Date(Date.UTC(2000, 0, 1, h, min, 0))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

/** `YYYY-MM-DD` → `Mon, Jun 2` (timezone-agnostic display). */
function formatDateLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function jobLabel(b: ShareBlockRow): string {
  const num = (b.job_hcp_number ?? '').trim() || '—'
  const name = (b.job_name ?? '').trim() || 'Job'
  return `${num} · ${name}`
}

function dateRangeLabel(dates: string[]): string {
  if (dates.length === 0) return '—'
  if (dates.length === 1) return formatDateLabel(dates[0]!)
  return `${formatDateLabel(dates[0]!)} – ${formatDateLabel(dates[dates.length - 1]!)}`
}

/**
 * Build a full-board schedule email grouped by Person, then by date.
 * Each row shows the time window, Job # · Name, address, and note.
 */
export function buildShareEmail(params: {
  dates: string[]
  blocks: ShareBlockRow[]
}): { subject: string; html: string; text: string } {
  const { dates, blocks } = params
  const multiDay = dates.length > 1
  const rangeLabel = dateRangeLabel(dates)
  const subject = `Dispatch schedule — ${rangeLabel}`

  if (blocks.length === 0) {
    const text = `No scheduled dispatch blocks for ${rangeLabel}.\n`
    const html =
      `<p style="font-family:system-ui,sans-serif;font-size:14px;color:#111">` +
      `No scheduled dispatch blocks for <strong>${escapeHtml(rangeLabel)}</strong>.</p>`
    return { subject, html, text }
  }

  // Group by assignee, preserving the RPC order (assignee_name, work_date, time_start).
  const byPerson = new Map<string, ShareBlockRow[]>()
  for (const b of blocks) {
    const key = (b.assignee_name || '(Unassigned)').trim() || '(Unassigned)'
    const arr = byPerson.get(key)
    if (arr) arr.push(b)
    else byPerson.set(key, [b])
  }

  const personSections = [...byPerson.entries()]
    .map(([person, rows]) => {
      const rowsHtml = rows
        .map((b) => {
          const window = `${formatPgTimeHm(b.time_start)}–${formatPgTimeHm(b.time_end)}`
          const addr = (b.job_address ?? '').trim().split('\n').map(escapeHtml).join('<br/>')
          const note = (b.note ?? '').trim()
          const dateCell = multiDay
            ? `<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap">${escapeHtml(
                formatDateLabel(b.work_date),
              )}</td>`
            : ''
          return `<tr>
${dateCell}<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap">${escapeHtml(
            window,
          )}</td>
<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(jobLabel(b))}${
            addr ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${addr}</div>` : ''
          }${note ? `<div style="font-size:12px;color:#374151;margin-top:2px">${escapeHtml(note)}</div>` : ''}</td>
</tr>`
        })
        .join('')
      // Header row is just the person's name (15px), spanning all columns —
      // no "Date"/"Window"/"Job" column labels.
      const colCount = multiDay ? 3 : 2
      const headerRow =
        `<th colspan="${colCount}" align="left" ` +
        `style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:15px">` +
        `${escapeHtml(person)}</th>`
      return (
        `<div style="margin:0 0 18px">` +
        `<table style="border-collapse:collapse;width:100%;max-width:720px">` +
        `<thead><tr style="background:#f9fafb">${headerRow}</tr></thead>` +
        `<tbody>${rowsHtml}</tbody></table></div>`
      )
    })
    .join('')

  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">` +
    `<p style="margin:0 0 14px">Dispatch schedule for <strong>${escapeHtml(rangeLabel)}</strong> (${APP_CALENDAR_TZ} times).</p>` +
    personSections +
    `</div>`

  const text = [
    `Dispatch schedule for ${rangeLabel} (${APP_CALENDAR_TZ})`,
    '',
    ...[...byPerson.entries()].flatMap(([person, rows]) => [
      person,
      ...rows.map((b) => {
        const window = `${formatPgTimeHm(b.time_start)}–${formatPgTimeHm(b.time_end)}`
        const datePrefix = multiDay ? `${formatDateLabel(b.work_date)}  ` : ''
        const addr = (b.job_address ?? '').trim()
        const note = (b.note ?? '').trim()
        return [
          `  ${datePrefix}${window}  ${jobLabel(b)}`,
          addr ? `    ${addr.split('\n').join('    \n')}` : '',
          note ? `    Note: ${note}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      }),
      '',
    ]),
  ].join('\n')

  return { subject, html, text }
}
