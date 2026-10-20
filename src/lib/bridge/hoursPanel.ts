/**
 * The Crew hours panel (link PR 10): hours by pay week stacked by what the
 * app has read (approved field, field waiting for approval, office and
 * bids), this week's hours as a waterfall (clocked, less what waits, is what
 * the page reads, split field and office), where each number comes from and
 * what can make it wrong, and the rule line. Pure: the page passes the two
 * weekly grids the headline draws.
 */
import type { VectorGrid } from './vectorDays'

export type HoursWeek = { start: string; label: string; approvedField: number; waitingField: number; office: number; total: number; current: boolean }
export type HoursWaterfallBar = { label: string; hours: number; kind: 'total' | 'step' | 'part'; fill: 'blue' | 'hatch' | 'grey' }
export type HoursSourceRow = { input: string; from: string; risk: string; tone: 'amber' | 'green'; door: { to: string; label: string } }

export type HoursPanel = {
  weeks: HoursWeek[]
  eightWeeks: string
  waterfall: HoursWaterfallBar[]
  sources: HoursSourceRow[]
  rule: string
  note: string
  noteTone: 'amber' | 'green'
}

export type HoursPanelInput = {
  recorded: VectorGrid
  approved: VectorGrid
  /** Office and bid hours by pay week start, counted by the page from the window's sessions (the grid keeps only field people). */
  officeByWeek: ReadonlyMap<string, number>
  todayYmd: string
  pendingClosedHours: number
  pendingClosedSessions: number
  officeBidHours7d: number
  jobsWorked: number
  noContractJobs: number
  /** Earned per approved field hour over the window. */
  fieldEarnedPerHour: number | null
  /** This week's recorded contribution from the headline, for the rule line. */
  thisWeekRecordedUsd: number | null
  weekLabel: (start: string) => string
}

export const HOURS_DOORS = {
  approvals: { to: '/people?tab=hours&approvals=1', label: 'Approve' },
  queue: { to: '/people?tab=hours&approvals=1', label: 'Open approvals' },
  overhead: { to: '/people?tab=overhead', label: 'Open overhead' },
  jobs: { to: '/jobs?tab=stages', label: 'Price the jobs' },
} as const

const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

export function buildHoursPanel(input: HoursPanelInput): HoursPanel {
  const cols = input.recorded.columns
  const weeks: HoursWeek[] = cols.map((c, i) => {
    const r = input.recorded.company.cells[i]
    const a = input.approved.company.cells[i]
    const approvedField = a?.fieldHours ?? 0
    const waitingField = Math.max(0, (r?.fieldHours ?? 0) - approvedField)
    const office = input.officeByWeek.get(c.start) ?? 0
    return { start: c.start, label: input.weekLabel(c.start), approvedField, waitingField, office, total: approvedField + waitingField + office, current: c.end >= input.todayYmd }
  })
  const last8 = weeks.slice(-8)
  const sumApproved = last8.reduce((s, w) => s + w.approvedField, 0)
  const sumWaiting = last8.reduce((s, w) => s + w.waitingField, 0)
  const sumOffice = last8.reduce((s, w) => s + w.office, 0)
  const settled = last8.filter((w) => w.waitingField === 0 && w.approvedField > 0)
  const lo = settled.length ? Math.min(...settled.map((w) => w.approvedField)) : null
  const hi = settled.length ? Math.max(...settled.map((w) => w.approvedField)) : null
  const waitingWeeks = last8.filter((w) => w.waitingField > 0)
  const eightWeeks = `${last8.length} weeks: ${hrs(sumApproved)} approved in the field, ${hrs(sumWaiting)} waiting, ${hrs(sumOffice)} office.${lo != null && hi != null ? ` The field ran ${hrs(lo)} to ${hrs(hi)} a week when every hour was read.` : ''}${waitingWeeks.length ? ` ${waitingWeeks.map((w) => `${hrs(w.approvedField + w.waitingField)} clocked`).join(' and ')} in the ${waitingWeeks.length === 1 ? 'week' : `${waitingWeeks.length} weeks`} still waiting.` : ''}`

  const tw = weeks[weeks.length - 1] ?? { approvedField: 0, waitingField: 0, office: 0 }
  const clocked = tw.approvedField + tw.waitingField + tw.office
  const read = tw.approvedField + tw.office
  const waterfall: HoursWaterfallBar[] = [
    { label: 'clocked', hours: clocked, kind: 'total', fill: 'blue' },
    { label: 'waiting, field', hours: -tw.waitingField, kind: 'step', fill: 'hatch' },
    { label: 'read by the page', hours: read, kind: 'total', fill: 'blue' },
    { label: 'field', hours: tw.approvedField, kind: 'part', fill: 'blue' },
    { label: 'office + bid', hours: tw.office, kind: 'part', fill: 'grey' },
  ]

  const pending = input.pendingClosedHours
  const sources: HoursSourceRow[] = [
    { input: 'field, approved', from: 'closed field sessions that were approved, by work date', risk: tw.waitingField > 0 ? `${hrs(tw.waitingField)} of this week’s field sessions are closed and not approved; they are not here` : 'every session this week is approved', tone: tw.waitingField > 0 ? 'amber' : 'green', door: HOURS_DOORS.approvals },
    { input: 'awaiting approval', from: `closed sessions not yet approved, every week: ${hrs(pending)} in ${input.pendingClosedSessions} ${plural(input.pendingClosedSessions, 'session', 'sessions')}`, risk: 'a session left open never closes and never shows here; the count is sessions, not people', tone: pending > 0 ? 'amber' : 'green', door: HOURS_DOORS.queue },
    { input: 'office + bid', from: `labor lines from the overhead pool, ${hrs(input.officeBidHours7d)} in the last 7 days`, risk: 'office hours clock against overhead, not a job; a bid’s hours reach no job’s cost until it is won', tone: 'amber', door: HOURS_DOORS.overhead },
    { input: 'jobs worked', from: `distinct jobs with a field session in the window: ${input.jobsWorked}`, risk: input.noContractJobs > 0 ? `${input.noContractJobs} open ${plural(input.noContractJobs, 'job carries', 'jobs carry')} no contract value, so their hours earn $0 on the page` : 'every open job carries a contract value', tone: input.noContractJobs > 0 ? 'amber' : 'green', door: HOURS_DOORS.jobs },
    { input: 'earned per hour', from: `each session × its job’s contract ÷ the job’s expected hours${input.fieldEarnedPerHour != null ? `, about $${Math.round(input.fieldEarnedPerHour)} an hour over the window` : ''}`, risk: 'a job with no contract or no expected hours earns $0 an hour', tone: input.noContractJobs > 0 ? 'amber' : 'green', door: HOURS_DOORS.jobs },
  ]

  const unreadUsd = input.fieldEarnedPerHour != null ? tw.waitingField * input.fieldEarnedPerHour : null
  const rule =
    tw.waitingField > 0
      ? `The field clocked ${hrs(tw.approvedField + tw.waitingField)} this week; the page reads ${hrs(tw.approvedField)}.${unreadUsd != null ? ` At about $${Math.round(input.fieldEarnedPerHour as number)} earned an hour, the unread ${hrs(tw.waitingField)} is about ${shortK(unreadUsd)}${input.thisWeekRecordedUsd != null ? ` of this week’s ${input.thisWeekRecordedUsd >= 0 ? '+' : ''}${shortK(input.thisWeekRecordedUsd)}` : ''}.` : ''} One press on the schedule reads it.`
      : `The field clocked ${hrs(tw.approvedField)} this week and the page reads all of it.`
  const note = sumWaiting > 0 ? `The field did not stop; the reading did. ${hrs(sumWaiting)} in the window wait on one approve press.` : 'Every field hour in the window is read.'
  return { weeks, eightWeeks, waterfall, sources, rule, note, noteTone: sumWaiting > 0 ? 'amber' : 'green' }
}
