import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { scheduleMeasures } from './gcBuildingSchedule'
import {
  NO_FILTERS,
  ganttAxis,
  ganttBars,
  ganttCounts,
  ganttFilter,
  ganttGroups,
  ganttLinks,
  ganttNeighbors,
  holidayOn,
  holidaysIn,
  holidaysOf,
  isWorkingDay,
  linkPath,
  workingDays,
  type GanttHold,
} from './gcGantt'

/** Fair Oaks Shops, Building D: the made-up job being built, today Fri Oct 2 2026. */
function fairOaks(holds = new Map<string, GanttHold>()) {
  const state = initialGcState()
  const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')
  if (!project) throw new Error('the made-up data lost Fair Oaks D')
  const m = scheduleMeasures(state, project)
  return { state, m, bars: ganttBars(m.items, m.float, holds, state.today, true) }
}

describe('the calendar (the owner, 2026-10-05: anyone can work 365 days a year)', () => {
  it('knows the six holidays it marks in 2026', () => {
    expect(holidaysOf(2026).map((h) => h.on)).toEqual(['2026-01-01', '2026-05-25', '2026-07-04', '2026-09-07', '2026-11-26', '2026-12-25'])
    expect(holidayOn('2026-11-26')).toBe('Thanksgiving')
    expect(holidayOn('2026-11-27')).toBeNull()
  })

  it('works a weekend and a holiday like any other day', () => {
    expect(isWorkingDay('2026-10-03')).toBe(true) // a Saturday
    expect(isWorkingDay('2026-10-04')).toBe(true) // a Sunday
    expect(isWorkingDay('2026-09-07')).toBe(true) // Labor Day
    expect(isWorkingDay('2026-12-25')).toBe(true) // Christmas Day
  })

  it('counts every day, both ends in, and names the holidays a stretch runs over', () => {
    expect(workingDays('2026-10-05', '2026-10-11')).toBe(7)
    expect(workingDays('2026-11-23', '2026-11-29')).toBe(7) // Thanksgiving week
    expect(holidaysIn('2026-11-23', '2026-11-29')).toEqual(['Thanksgiving'])
    expect(holidaysIn('2026-10-05', '2026-10-11')).toEqual([])
    expect(workingDays('2026-10-05', '2026-10-04')).toBe(0)
  })
})

describe("each bar's standing", () => {
  it('has one bar per activity, inspections too', () => {
    const { m, bars } = fairOaks()
    expect(bars.length).toBe(m.items.length)
    expect(bars.some((b) => b.item.activity.inspection)).toBe(true)
  })

  it('says done, late, behind or its spare days', () => {
    const { state, bars } = fairOaks()
    for (const b of bars) {
      if (b.item.actual >= 100) expect(b.status).toBe('done')
      if (b.status === 'late') {
        expect(b.item.activity.finish < state.today).toBe(true)
        expect(b.statusWords).toMatch(/^\d+ days? late$/)
      }
      if (b.critical) expect(b.spare).toBe(0)
      if (b.critical) expect(b.tight).toBe(true)
      if (b.status === 'notStarted') expect(b.statusWords).toMatch(/spare day/)
    }
    expect(bars.some((b) => b.status === 'done')).toBe(true)
    expect(bars.some((b) => b.critical)).toBe(true)
    // Erection is due today at 80%; the roof is far behind; top out, 2 points off, is on track.
    expect(bars.find((b) => b.item.label === 'Erection')?.statusWords).toBe('due today')
    expect(bars.find((b) => b.item.label === 'TPO membrane')?.statusWords).toBe('behind')
    expect(bars.find((b) => b.item.label === 'Top out')?.status).toBe('onTrack')
    expect(bars.find((b) => b.item.label === 'Ductwork')?.status).toBe('ahead')
    // Trim has 2 spare days: tight, drawn with the chain that sets the finish, though not critical.
    const trim = bars.find((b) => b.item.label === 'Trim')
    expect(trim?.critical).toBe(false)
    expect(trim?.tight).toBe(true)
    // The electrical service inspection failed Sep 28 and is seen again today.
    expect(bars.find((b) => b.item.label === 'Electrical service inspection')?.status).toBe('failed')
  })

  it('marks a bar that moved from the plan at Start', () => {
    const { bars } = fairOaks()
    const tpo = bars.find((b) => b.item.label === 'TPO membrane')
    expect(tpo?.moved).toBe(true)
    expect(tpo?.item.slipDays).toBe(7)
  })

  it('a hold shows on work not done, and never on work that is', () => {
    const first = fairOaks().bars
    const open = first.find((b) => b.status === 'notStarted')!
    const done = first.find((b) => b.status === 'done')!
    const hold: GanttHold = { kind: 'submittal', words: 'submittal 07 62 00-01', late: false }
    const { bars } = fairOaks(new Map([[open.id, hold], [done.id, hold]]))
    expect(bars.find((b) => b.id === open.id)?.status).toBe('held')
    expect(bars.find((b) => b.id === done.id)?.hold).toBeNull()
  })

  it('while buying out nothing is late or behind', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
    const m = scheduleMeasures(state, project)
    const bars = ganttBars(m.items, m.float, new Map(), state.today, false)
    expect(bars.every((b) => ['done', 'notStarted', 'failed'].includes(b.status))).toBe(true)
  })
})

describe('the filters, whose counts are the summary', () => {
  it('counts what each would show, and shows exactly that', () => {
    const { bars } = fairOaks()
    const counts = ganttCounts(bars)
    expect(ganttFilter(bars, NO_FILTERS).length).toBe(bars.length)
    for (const key of ['critical', 'late', 'held', 'soon', 'moved'] as const) {
      expect(ganttFilter(bars, { ...NO_FILTERS, [key]: true }).length).toBe(counts[key])
    }
    expect(counts.critical).toBeGreaterThan(0)
    expect(counts.late).toBeGreaterThan(0)
  })

  it('two filters on show only what passes both', () => {
    const { bars } = fairOaks()
    const both = ganttFilter(bars, { ...NO_FILTERS, late: true, moved: true })
    expect(both.every((b) => b.moved && ['late', 'behind', 'failed'].includes(b.status))).toBe(true)
  })
})

describe('the groups', () => {
  it('by trade keeps the order drawn, with the company after the trade', () => {
    const { bars } = fairOaks()
    const groups = ganttGroups(bars, 'trade')
    expect(groups.flatMap((g) => g.bars).length).toBe(bars.length)
    const roofing = groups.find((g) => g.title === 'Roofing')
    expect(roofing?.sub).toBe('Summit Roofing')
    expect(roofing && roofing.start <= roofing.finish).toBe(true)
    expect(roofing && roofing.pct > 0 && roofing.pct < 100).toBe(true)
    expect(groups[groups.length - 1]?.title).toBe('Inspections')
  })

  it('by stage runs in the order a job is built, inspections last', () => {
    const { bars } = fairOaks()
    const groups = ganttGroups(bars, 'stage')
    expect(groups.flatMap((g) => g.bars).length).toBe(bars.length)
    expect(groups[groups.length - 1]?.title).toBe('Inspections')
    expect(groups.length).toBeGreaterThan(3)
  })

  it('by company puts the company with the most late work first', () => {
    const { bars } = fairOaks()
    const groups = ganttGroups(bars, 'company')
    expect(groups.flatMap((g) => g.bars).length).toBe(bars.length)
    for (let i = 1; i < groups.length; i++) expect(groups[i - 1]!.late).toBeGreaterThanOrEqual(groups[i]!.late)
  })
})

describe('the links', () => {
  it('draws one for every wait among the bars shown', () => {
    const { bars } = fairOaks()
    const links = ganttLinks(bars)
    const waits = bars.reduce((n, b) => n + b.item.activity.after.filter((a) => bars.some((x) => x.id === a)).length, 0)
    expect(links.length).toBe(waits)
    expect(links.length).toBeGreaterThan(0)
    // A filtered chart keeps only the links between bars still on it.
    const some = bars.slice(0, 3)
    expect(ganttLinks(some).every((l) => some.some((b) => b.id === l.from) && some.some((b) => b.id === l.to))).toBe(true)
  })

  it('names what a bar waits on and what waits on it', () => {
    const { bars } = fairOaks()
    const waiting = bars.find((b) => b.item.activity.after.length > 0)!
    const n = ganttNeighbors(bars, waiting.id)
    expect(n.waitsOn.length).toBe(waiting.item.activity.after.length)
    const before = bars.find((b) => b.id === waiting.item.activity.after[0])!
    expect(ganttNeighbors(bars, before.id).holdsUp.length).toBeGreaterThan(0)
  })

  it('goes straight across when there is room, and leaves the row when there is not', () => {
    expect(linkPath(100, 15, 140, 45, 30)).toBe('M100 15 H106 V45 H140 l-4 -3 m4 3 l-4 3')
    expect(linkPath(100, 15, 90, 45, 30)).toBe('M100 15 H106 V30 H82 V45 H90 l-4 -3 m4 3 l-4 3')
  })
})

describe('the time axis', () => {
  it('starts on a Monday and covers every bar and milestone', () => {
    const { state, m, bars } = fairOaks()
    const axis = ganttAxis(bars, m.milestones, state.today, 'weeks')
    expect(new Date(`${axis.first}T00:00:00Z`).getUTCDay()).toBe(1)
    expect(bars.every((b) => b.item.activity.start >= axis.first)).toBe(true)
    expect(axis.months.reduce((n, mo) => n + mo.days, 0)).toBe(axis.days)
    expect(axis.marked.some((d) => d.holiday === 'Thanksgiving')).toBe(true)
    expect(axis.marked.some((d) => d.weekend && !d.holiday)).toBe(true)
  })

  it('marks every day, every Monday, or the 1st and 15th', () => {
    const { state, m, bars } = fairOaks()
    const days = ganttAxis(bars, m.milestones, state.today, 'days')
    const weeks = ganttAxis(bars, m.milestones, state.today, 'weeks')
    const months = ganttAxis(bars, m.milestones, state.today, 'months')
    expect(days.ticks.length).toBe(days.days)
    expect(weeks.ticks.length).toBe(Math.floor(weeks.days / 7) + (weeks.days % 7 > 0 ? 1 : 0))
    expect(months.ticks.every((t) => t.label === '1' || t.label === '15')).toBe(true)
  })
})
