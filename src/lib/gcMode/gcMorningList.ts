/**
 * GC mode design spike: the superintendent's morning list, the Gantt's Phase 4 (G-118; the mock-up
 * and plan are `to-dos/gc-mode/mockups/G-118.md`). The chart read for one day: every company with
 * work running, what it is doing and where that stands, who the daily log last had on site, and the
 * day's inspections and arrivals. Once the day's log is written, a company it does not have goes
 * first, in red: the call to make.
 *
 * No trade reports a crew count, so the count is the log's own, said as the log's. A bar runs on a
 * day by G-60's rule (`runsOn`), and its holds are the chart's (`chartHolds`), so the list never
 * argues with the chart.
 *
 * Its own file, out of the barrel: it reads the schedule, the chart's holds, the waits, G-117's late
 * notices and the daily log.
 */
import type { DailyLog, GcProject, GcState, TradePackage } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleMeasures } from './gcBuildingSchedule'
import { ganttBars, workingDays, type GanttBar, type GanttHold } from './gcGantt'
import { runsOn } from './gcLogVsChart'
import { openLateNotices } from './gcLateNotices'
import { waitRows } from './gcScheduleWaits'
import { partnerById } from './gcLookups'
import { partnerReach } from './gcFollowUpSheet'
import { weekdayDate } from './gcWords'

export interface MorningBar {
  lineId: string
  /** "TPO membrane". */
  name: string
  /** "first day", "last day", "day 12 of 19", "2 days past its finish". */
  dayWords: string
  pct: number
  /** The chart's pill, then its hold or a late notice. The pill only on today's list: it is the chart's standing now. */
  flags: { words: string; tone: 'red' | 'amber' | 'green' | 'grey' }[]
  held: boolean
}

export interface MorningCompany {
  pkg: TradePackage
  /** "Summit Roofing", or "Our own crew". */
  company: string
  partnerId: string | null
  /** Its contact's first name and phone. Null: our own crew. */
  call: { first: string; phone: string } | null
  bars: MorningBar[]
  /** The log's last count before the day. Null: never on the log before. */
  lastOnLog: { on: string; workers: number } | null
  /** The day's own log, once written: its count, or 0 when written without them. Null: no log that day. */
  onTheDay: number | null
  /** The line under its name. */
  logWords: string
  /** Expected, and not on the day's written log: called first. */
  missing: boolean
}

export interface MorningList {
  day: string
  /** Companies with work running that is not held: the missing first, then the job's trades in order. */
  expected: MorningCompany[]
  /** Companies whose every bar that day is held: not expected. */
  heldOff: MorningCompany[]
  inspections: { lineId: string; words: string }[]
  /** The waits expected that day, in words: "The transformer, from CPS Energy." */
  arriving: string[]
  logWritten: boolean
  summary: string
  /** Under the list while the day has no log. Null once it does. */
  foot: string | null
}

const ARRIVING_KINDS = new Set(['delivery', 'utility', 'permit'])

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function sentence(s: string): string {
  const t = s.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}

/** Where the day sits in a bar: "first day", "day 12 of 19", "2 days past its finish". */
function dayWordsOf(start: string, finish: string, day: string): string {
  if (day > finish) {
    const n = daysBetween(finish, day)
    return `${n} ${n === 1 ? 'day' : 'days'} past its finish`
  }
  if (day < start) return 'under way early'
  if (start === finish) return 'its one day'
  if (day === start) return 'first day'
  if (day === finish) return 'last day'
  return `day ${daysBetween(start, day) + 1} of ${workingDays(start, finish)}`
}

/** The chart's pill in its own words, where it says something to the superintendent. */
function pillOf(b: GanttBar): MorningBar['flags'][number] | null {
  if (b.status === 'late') return { words: b.statusWords, tone: 'red' }
  if (b.status === 'behind') return { words: b.statusWords, tone: 'amber' }
  if (b.status === 'ahead') return { words: b.statusWords, tone: 'green' }
  return null
}

function workersOn(log: DailyLog, packageId: string): number {
  return log.crews.find((c) => c.packageId === packageId)?.workers ?? 0
}

/** The superintendent's list for one day (today by default): who should be on site, doing what. */
export function morningList(state: GcState, project: GcProject, holds: Map<string, GanttHold>, day: string = state.today): MorningList {
  const today = state.today
  const empty = (summary: string): MorningList => ({ day, expected: [], heldOff: [], inspections: [], arriving: [], logWritten: false, summary, foot: null })
  if (project.stage !== 'building' || !project.startedOn || !project.schedule) return empty('The list starts once work starts.')
  if (day < project.startedOn) return empty(`Work started ${weekdayDate(project.startedOn)}.`)
  const m = scheduleMeasures(state, project)
  const bars = ganttBars(m.items, m.float, holds, today, true)
  const notices = openLateNotices(project)
  const logs = [...(project.dailyLogs ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const dayLog = logs.find((l) => l.date === day) ?? null
  const dayLogName = day === today ? "today's log" : `the log for ${weekdayDate(day)}`

  const companies: MorningCompany[] = []
  for (const pkg of project.packages) {
    const own = bars.filter((b) => b.item.pkg?.id === pkg.id && !b.item.activity.inspection && !b.item.activity.added)
    const running = own.filter((b) => {
      const a = b.item.activity
      if (!runsOn(b.item, day)) return false
      return b.item.actual < 100 || Boolean(a.actualFinish && a.actualFinish >= day)
    })
    if (running.length === 0) continue
    const morningBars: MorningBar[] = running.map((b) => {
      const a = b.item.activity
      const flags: MorningBar['flags'] = []
      const pill = day === today ? pillOf(b) : null
      if (pill) flags.push(pill)
      const hold = holds.get(a.lineId)
      if (hold) flags.push({ words: `waits on ${hold.words}${hold.late ? ', late' : ''}`, tone: hold.late ? 'red' : 'amber' })
      const notice = notices.find((n) => n.lineId === a.lineId)
      if (notice) flags.push({ words: notice.started ? `says it will finish ${weekdayDate(notice.day)}` : `says it can start ${weekdayDate(notice.day)}`, tone: 'amber' })
      return { lineId: a.lineId, name: b.item.label, dayWords: dayWordsOf(a.start, a.finish, day), pct: Math.round(b.item.actual), flags, held: Boolean(hold) }
    })
    const partnerId = pkg.selfPerform ? null : (pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId ?? null)
    const partner = partnerId ? partnerById(state, partnerId) : undefined
    const before = logs.filter((l) => l.date < day && workersOn(l, pkg.id) > 0).pop()
    const lastOnLog = before ? { on: before.date, workers: workersOn(before, pkg.id) } : null
    const onTheDay = dayLog ? workersOn(dayLog, pkg.id) : null
    const last = lastOnLog ? `Last on the log ${weekdayDate(lastOnLog.on)} with ${lastOnLog.workers}.` : 'Not on the daily log before.'
    const logWords = onTheDay === null ? last : onTheDay > 0 ? `On ${dayLogName} with ${onTheDay}.` : `Not on ${dayLogName}.${lastOnLog ? ` Last on it ${weekdayDate(lastOnLog.on)} with ${lastOnLog.workers}.` : ''}`
    const expected = morningBars.some((b) => !b.held)
    const reach = partner ? partnerReach(partner) : null
    companies.push({
      pkg,
      company: pkg.selfPerform ? 'Our own crew' : (partner?.company ?? pkg.trade),
      partnerId: partner?.id ?? null,
      call: reach ? { first: reach.first, phone: reach.phone } : null,
      bars: morningBars,
      lastOnLog,
      onTheDay,
      logWords,
      missing: expected && onTheDay === 0,
    })
  }
  const expected = companies.filter((c) => c.bars.some((b) => !b.held))
  const ordered = [...expected.filter((c) => c.missing), ...expected.filter((c) => !c.missing)]
  const heldOff = companies.filter((c) => !c.bars.some((b) => !b.held))

  const inspections = (project.schedule.activities ?? []).flatMap((a) => {
    const insp = a.inspection
    if (!insp || a.start > day || a.finish < day || (insp.passedOn && insp.passedOn <= day)) return []
    const failed = (insp.failed ?? []).filter((f) => f.on < day)
    const lastFail = failed[failed.length - 1]
    const whose = lastFail
      ? lastFail.packageIds.flatMap((id) => {
          const k = project.packages.find((p) => p.id === id)
          if (!k) return []
          if (k.selfPerform) return ['our own crew']
          const pid = k.invites.find((i) => i.id === k.awardedInviteId)?.partnerId
          return [(pid ? partnerById(state, pid)?.company : undefined) ?? k.trade]
        })
      : []
    const when = day === today ? 'today' : weekdayDate(day)
    const words = [
      `${insp.label}, the city.`,
      ...(lastFail ? [`It is seen again ${when}.`, `It failed ${weekdayDate(lastFail.on)}: ${sentence(lastFail.note)}`] : []),
      ...(whose.length > 0 ? [`That was ${whose.join(' and ')}'s work.`] : []),
    ].join(' ')
    return [{ lineId: a.lineId, words }]
  })

  const arriving = waitRows(state, project)
    .filter((r) => r.state !== 'done' && ARRIVING_KINDS.has(r.wait.kind) && r.wait.expectedOn === day)
    .map((r) => `${cap(r.wait.title)}, from ${r.wait.who}.`)

  const activities = expected.reduce((n, c) => n + c.bars.length, 0)
  const inspectionWords = inspections.length === 1 ? 'an inspection' : `${inspections.length} inspections`
  const head =
    expected.length > 0
      ? `${expected.length} ${expected.length === 1 ? 'company' : 'companies'} on ${activities} ${activities === 1 ? 'activity' : 'activities'}${inspections.length > 0 ? `, and ${inspectionWords}` : ''}.`
      : inspections.length > 0
        ? `No trade's work runs this day. There is ${inspectionWords}.`
        : 'Nothing on the chart runs this day.'
  const foot = dayLog ? null : day === today ? "No log for today yet. Each company's count comes in when it is written." : `No log for ${weekdayDate(day)}.`
  return { day, expected: ordered, heldOff, inspections, arriving, logWritten: Boolean(dayLog), summary: head, foot }
}

/** The days the list can step to: the day before, not before work started, and the day after, not after today. */
export function morningSteps(project: GcProject, day: string, today: string): { before: string | null; after: string | null } {
  const before = addDays(day, -1)
  const after = addDays(day, 1)
  return { before: project.startedOn && before >= project.startedOn ? before : null, after: after <= today ? after : null }
}
