import type { JobDayLedger } from './jobDayLedger'
import { dayNumberToYmd, mondayOfYmd, ymdToDayNumber } from './jobRunningTimeline'

/**
 * The Capacity view kernel (v2.2828): were we full? Available field hours by
 * week — the field roster (masters and helpers active on each weekday) ×
 * hours per day — against approved field hours from the day ledger. When the
 * roster can't be read, available falls back to "who clocked in that week ×
 * workdays × hours per day" and says so. Pure.
 */
export type CapacityPerson = {
  id: string
  kind: string
  start_date: string | null
  end_date: string | null
  archived_at: string | null
}

/** The kinds that swing tools. Office kinds (assistant, controller, estimator…) are overhead, not capacity. */
export const CAPACITY_FIELD_KINDS: ReadonlySet<string> = new Set(['master_technician', 'helper'])
export const CAPACITY_HOURS_PER_DAY = 8

export type CapacityWeek = {
  weekStartYmd: string
  weekEndYmd: string
  /** Mon–Fri days inside the window. */
  workdays: number
  /** Field roster on the busiest weekday (roster source) or people who clocked field hours (clocked source). */
  people: number
  availableHours: number
  fieldHours: number
  peopleWorked: number
  utilizationPct: number | null
}

export type CapacitySeries = {
  source: 'roster' | 'clocked'
  weeks: CapacityWeek[]
  totals: { availableHours: number; fieldHours: number; utilizationPct: number | null }
  peak: CapacityWeek | null
  weeksUnder60: number
  weeksOver100: number
  /** Field roster active on the window's last day (roster) or people who clocked in the last full week (clocked). */
  crewNow: number
}

function isWeekday(ymd: string): boolean {
  const dow = new Date(ymdToDayNumber(ymd) * 86_400_000).getUTCDay()
  return dow >= 1 && dow <= 5
}

function activeOn(p: CapacityPerson, ymd: string): boolean {
  if (!CAPACITY_FIELD_KINDS.has(p.kind)) return false
  if (p.archived_at && p.archived_at.slice(0, 10) <= ymd) return false
  if (p.start_date && p.start_date.slice(0, 10) > ymd) return false
  if (p.end_date && p.end_date.slice(0, 10) < ymd) return false
  return true
}

export function buildCapacitySeries(args: { ledger: JobDayLedger | null; people: readonly CapacityPerson[] | null; hoursPerDay?: number }): CapacitySeries {
  const { ledger, people } = args
  const hoursPerDay = args.hoursPerDay ?? CAPACITY_HOURS_PER_DAY
  const source: CapacitySeries['source'] = people && people.some((p) => CAPACITY_FIELD_KINDS.has(p.kind)) ? 'roster' : 'clocked'
  const weeks: CapacityWeek[] = []
  if (!ledger || ledger.days.length === 0) return { source, weeks, totals: { availableHours: 0, fieldHours: 0, utilizationPct: null }, peak: null, weeksUnder60: 0, weeksOver100: 0, crewNow: 0 }
  const byWeek = new Map<string, CapacityWeek & { names: Set<string>; rosterByDay: number[] }>()
  for (const d of ledger.days) {
    const monday = mondayOfYmd(d.ymd)
    const w =
      byWeek.get(monday) ??
      byWeek
        .set(monday, { weekStartYmd: d.ymd < monday ? d.ymd : monday, weekEndYmd: d.ymd, workdays: 0, people: 0, availableHours: 0, fieldHours: 0, peopleWorked: 0, utilizationPct: null, names: new Set(), rosterByDay: [] })
        .get(monday)!
    w.weekEndYmd = d.ymd
    w.fieldHours += d.fieldHours
    for (const jd of d.byJob.values()) for (const n of jd.people) w.names.add(n)
    if (isWeekday(d.ymd)) {
      w.workdays += 1
      if (source === 'roster') w.rosterByDay.push(people!.filter((p) => activeOn(p, d.ymd)).length)
    }
  }
  for (const w of byWeek.values()) {
    w.peopleWorked = w.names.size
    if (source === 'roster') {
      w.people = w.rosterByDay.length ? Math.max(...w.rosterByDay) : 0
      w.availableHours = w.rosterByDay.reduce((a, n) => a + n * hoursPerDay, 0)
    } else {
      w.people = w.peopleWorked
      w.availableHours = w.peopleWorked * w.workdays * hoursPerDay
    }
    w.utilizationPct = w.availableHours > 0 ? (w.fieldHours / w.availableHours) * 100 : null
    const { names: _names, rosterByDay: _r, ...plain } = w
    void _names
    void _r
    weeks.push(plain)
  }
  weeks.sort((a, b) => a.weekStartYmd.localeCompare(b.weekStartYmd))
  const availableHours = weeks.reduce((a, w) => a + w.availableHours, 0)
  const fieldHours = weeks.reduce((a, w) => a + w.fieldHours, 0)
  const rated = weeks.filter((w) => w.utilizationPct != null && w.workdays >= 3)
  let peak: CapacityWeek | null = null
  for (const w of rated) if (!peak || (w.utilizationPct ?? 0) > (peak.utilizationPct ?? 0)) peak = w
  const lastYmd = ledger.days[ledger.days.length - 1]!.ymd
  const crewNow = source === 'roster' ? people!.filter((p) => activeOn(p, lastYmd)).length : (rated[rated.length - 1]?.peopleWorked ?? 0)
  return {
    source,
    weeks,
    totals: { availableHours, fieldHours, utilizationPct: availableHours > 0 ? (fieldHours / availableHours) * 100 : null },
    peak,
    weeksUnder60: rated.filter((w) => (w.utilizationPct ?? 0) < 60).length,
    weeksOver100: rated.filter((w) => (w.utilizationPct ?? 0) > 100).length,
    crewNow,
  }
}

/** Sunday of the week holding `ymd` (for labels). */
export function sundayOfYmd(ymd: string): string {
  return dayNumberToYmd(ymdToDayNumber(mondayOfYmd(ymd)) + 6)
}
