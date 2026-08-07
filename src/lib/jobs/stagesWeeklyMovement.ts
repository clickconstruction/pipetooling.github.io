import { addDaysYmd, dowForYmd } from '../emailSchedule/emailScheduleWeek'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * Weekly movement kernel (v2.1436) — buckets job_status_events for one
 * Mon–Sun Central week into "entered stage X" sections plus a send-backs
 * section (backward transitions). Pure: the modal fetches events/jobs and
 * hands them in. Complete event coverage arrived with the v2.1435
 * single-writer trigger — before that, jobs going Paid left no event.
 */

export const WEEKLY_PIPELINE_ORDER = ['waiting', 'working', 'ready_to_bill', 'billed', 'paid'] as const

export const WEEKLY_STAGE_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to Bill',
  billed: 'Billed',
  paid: 'Paid in Full',
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type JobStatusEventLite = {
  id: string
  job_id: string
  from_status: string | null
  to_status: string
  changed_at: string
  changed_by_user_id: string | null
}

export type WeeklyJobLite = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  revenue: number | null
}

export type WeeklyMovementEntry = {
  eventId: string
  jobId: string
  /** "948 · Connect sink & disconnect bidet" (effective number, name optional). */
  display: string
  address: string
  /** Central weekday of the move ('Mon'…'Sun'; '?' on unparseable instants). */
  weekday: string
  /** Mover's name; 'Automatic' for service-role writers (Stripe webhook, dispatchers). */
  moverName: string
  revenue: number
}

export type WeeklyMovementSection = {
  toStatus: string
  label: string
  entries: WeeklyMovementEntry[]
  jobCount: number
  /** Sum of DISTINCT jobs' revenue in this section. */
  total: number
}

export type WeeklySendBackEntry = WeeklyMovementEntry & { fromLabel: string; toLabel: string }

export type WeeklyMovementData = {
  sections: WeeklyMovementSection[]
  sendBacks: WeeklySendBackEntry[]
  moveCount: number
  jobCount: number
}

/** Monday (Central-civil) of the week containing ymd. */
export function mondayOfWeekYmd(ymd: string): string {
  const dow = dowForYmd(ymd)
  return addDaysYmd(ymd, -((dow + 6) % 7))
}

/** "Aug 3 – 9" / "Aug 31 – Sep 6" for the week starting mondayYmd. */
export function weekLabel(mondayYmd: string): string {
  const sundayYmd = addDaysYmd(mondayYmd, 6)
  const fmt = (ymd: string, withMonth: boolean) => {
    const d = new Date(`${ymd}T12:00:00Z`)
    return d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      ...(withMonth ? { month: 'short' } : {}),
      day: 'numeric',
    })
  }
  const sameMonth = mondayYmd.slice(0, 7) === sundayYmd.slice(0, 7)
  return `${fmt(mondayYmd, true)} – ${fmt(sundayYmd, !sameMonth)}`
}

/** Central weekday label of an instant. */
export function chicagoWeekdayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '?'
  const name = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short' }).format(d)
  return DOW_SHORT.includes(name) ? name : '?'
}

const stageIndex = (s: string | null): number =>
  s == null ? -1 : (WEEKLY_PIPELINE_ORDER as readonly string[]).indexOf(s)

export function buildWeeklyMovement(
  events: JobStatusEventLite[],
  jobs: WeeklyJobLite[],
  users: Array<{ id: string; name: string }>,
): WeeklyMovementData {
  const jobsById = new Map(jobs.map((j) => [j.id, j]))
  const usersById = new Map(users.map((u) => [u.id, u.name]))

  const toEntry = (e: JobStatusEventLite): WeeklyMovementEntry => {
    const j = jobsById.get(e.job_id)
    const num = j ? effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—' : '—'
    const name = (j?.job_name ?? '').trim()
    return {
      eventId: e.id,
      jobId: e.job_id,
      display: name ? `${num} · ${name}` : num,
      address: (j?.job_address ?? '').trim(),
      weekday: chicagoWeekdayLabel(e.changed_at),
      moverName: e.changed_by_user_id ? (usersById.get(e.changed_by_user_id) ?? '—') : 'Automatic',
      revenue: Number(j?.revenue ?? 0),
    }
  }

  const ordered = [...events].sort((a, b) => a.changed_at.localeCompare(b.changed_at))
  const byDestination = new Map<string, WeeklyMovementEntry[]>()
  const sendBacks: WeeklySendBackEntry[] = []
  const allJobIds = new Set<string>()

  for (const e of ordered) {
    const toIdx = stageIndex(e.to_status)
    if (toIdx < 0) continue // unknown destination (defensive)
    allJobIds.add(e.job_id)
    const fromIdx = stageIndex(e.from_status)
    if (fromIdx > toIdx) {
      sendBacks.push({
        ...toEntry(e),
        fromLabel: WEEKLY_STAGE_LABELS[e.from_status ?? ''] ?? (e.from_status ?? '—'),
        toLabel: WEEKLY_STAGE_LABELS[e.to_status] ?? e.to_status,
      })
      continue
    }
    ;(byDestination.get(e.to_status) ?? byDestination.set(e.to_status, []).get(e.to_status)!).push(toEntry(e))
  }

  const sections: WeeklyMovementSection[] = []
  for (const toStatus of WEEKLY_PIPELINE_ORDER) {
    const entries = byDestination.get(toStatus)
    if (!entries || entries.length === 0) continue
    const distinct = new Map<string, number>()
    for (const en of entries) distinct.set(en.jobId, en.revenue)
    sections.push({
      toStatus,
      label: WEEKLY_STAGE_LABELS[toStatus] ?? toStatus,
      entries,
      jobCount: distinct.size,
      total: [...distinct.values()].reduce((s, r) => s + r, 0),
    })
  }

  return {
    sections,
    sendBacks,
    moveCount: sendBacks.length + sections.reduce((s, sec) => s + sec.entries.length, 0),
    jobCount: allJobIds.size,
  }
}

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Printable one-page report (openHtmlPrintWindow wraps it; light-pinned like other prints). */
export function buildWeeklyMovementReportHtml(data: WeeklyMovementData, weekLabelStr: string): string {
  const section = (title: string, meta: string, rows: string) => `<h2 style="font-size:15px;margin:18px 0 4px">${escapeHtml(title)} <span style="font-weight:normal;font-size:12px;color:#4b5563">${escapeHtml(meta)}</span></h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>`
  const sectionsHtml = data.sections
    .map((s) =>
      section(
        `Moved to ${s.label}`,
        `· ${s.jobCount} job${s.jobCount === 1 ? '' : 's'} · $${money(s.total)}`,
        s.entries
          .map(
            (e) => `<tr>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb">${escapeHtml(e.display)}${e.address ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(e.address)}</span>` : ''}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563;white-space:nowrap">${escapeHtml(e.weekday)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563">${escapeHtml(e.moverName)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:right">$${money(e.revenue)}</td>
    </tr>`,
          )
          .join(''),
      ),
    )
    .join('\n')
  const sendBacksHtml =
    data.sendBacks.length === 0
      ? ''
      : section(
          'Sent back',
          `· ${data.sendBacks.length} move${data.sendBacks.length === 1 ? '' : 's'}`,
          data.sendBacks
            .map(
              (e) => `<tr>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb">${escapeHtml(e.display)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563;white-space:nowrap">${escapeHtml(e.weekday)} · ${escapeHtml(e.fromLabel)} → ${escapeHtml(e.toLabel)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563;text-align:right">${escapeHtml(e.moverName)}</td>
    </tr>`,
            )
            .join(''),
        )
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px">
  <h1 style="font-size:18px;margin:0">Weekly movement — ${escapeHtml(weekLabelStr)}</h1>
  <p style="margin:2px 0 8px;font-size:12px;color:#4b5563">${data.moveCount} move${data.moveCount === 1 ? '' : 's'} · ${data.jobCount} job${data.jobCount === 1 ? '' : 's'}</p>
  ${sectionsHtml}
  ${sendBacksHtml}
</div>`
}
