import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { plainWordsFailures } from '../plainWords'
import { walkItems } from './gcScheduleWalk'
import type { GanttHold } from './gcGantt'
import type { DailyLog, GcProject, GcState } from './gcTypes'
import { LOG_ABSENT_DAYS, logChartGaps, logChartNotes, type LogChartGap } from './gcLogVsChart'

/**
 * Fair Oaks Shops, Building D, being built; the made-up today is Fri Oct 2. This week's logs are
 * Mon Sep 28, Tue Sep 29 and Thu Oct 1 (Wednesday has none), and every crew on them has a bar running.
 */
const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd')!

function withLogs(state: GcState, change: (log: DailyLog) => DailyLog | null): GcState {
  return {
    ...state,
    projects: state.projects.map((p) => (p.id !== 'fairoaksd' ? p : { ...p, dailyLogs: (p.dailyLogs ?? []).flatMap((l) => (change(l) ? [change(l) as DailyLog] : [])) })),
  }
}

/** A trade left off the logs of these days. */
const leftOff = (packageId: string, dates: string[]) => (l: DailyLog) => (dates.includes(l.date) ? { ...l, crews: l.crews.filter((c) => c.packageId !== packageId) } : l)

const WEEK = ['2026-09-28', '2026-09-29', '2026-10-01']

/** Helotes Dental Office drawn from Mon Oct 5, started anyway today, and today's log with our own crew on site. */
function helotesOursEarly(): { state: GcState; project: GcProject } {
  let state = gcReducer(initialGcState(), { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-05' })
  state = gcReducer(state, { type: 'startProject', projectId: 'helotes', anyway: { reason: 'The slab before the rain', by: 'Robert' } })
  state = gcReducer(state, { type: 'saveDailyLog', projectId: 'helotes', log: { date: '2026-10-02', sky: 'clear', high: 84, low: 63, weatherStop: false, crews: [{ packageId: 'dplumb', workers: 3 }], done: 'Laid out the underground.', delays: [], visitors: '' } })
  return { state, project: state.projects.find((p) => p.id === 'helotes')! }
}

const row = (g: LogChartGap) => ({ kind: g.kind, pkg: g.pkg.id, days: g.days, words: g.words, todo: g.todo })

describe('the daily log and the chart (G-60)', () => {
  it('agree on the made-up job: every crew logged has a bar running, every running bar its crew', () => {
    const state = initialGcState()
    expect(logChartGaps(state, fairOaks(state))).toEqual([])
  })

  it('say when a running bar has nobody on site, on the days the log was written', () => {
    const state = withLogs(initialGcState(), leftOff('froof', WEEK))
    const gaps = logChartGaps(state, fairOaks(state))
    // Insulation is done and Roof curbs has not started: only TPO membrane is running.
    expect(gaps.map(row)).toEqual([
      {
        kind: 'absent',
        pkg: 'froof',
        days: WEEK,
        words: 'Summit Roofing was not on site Mon, Tue and Thu. The chart has TPO membrane running those days.',
        todo: 'Ask when the crew comes back. If the work slipped, move the bar and say why.',
      },
    ])
    expect([...logChartNotes(gaps)]).toEqual([['froof-1', { note: 'not on site this week', words: 'Nobody from Summit Roofing on the daily log Mon, Tue and Thu.' }]])
  })

  it('give the log’s own reason when it has one', () => {
    const state = withLogs(initialGcState(), (l) =>
      WEEK.includes(l.date)
        ? { ...l, crews: l.crews.filter((c) => c.packageId !== 'felec'), delays: [...l.delays.filter((d) => d.packageId !== 'felec'), { packageId: 'felec', reason: 'materials', note: 'Panel boards are two weeks out' }] }
        : l,
    )
    const [gap] = logChartGaps(state, fairOaks(state))
    expect(gap?.words).toBe('Pecan Valley Electric was not on site Mon, Tue and Thu. The chart has Panels and feeders, and Lighting running those days. The log says materials: Panel boards are two weeks out.')
    expect(gap?.todo).toBe("Move the bar, and give the log's reason.")
    expect(gap?.running.map((b) => b.lineId)).toEqual(['felec-2', 'felec-3'])
  })

  it('leave out the days the weather stopped them, as the daily log’s weather days do (G-58)', () => {
    // Read on Fri Sep 25: Thursday's rain held the roof, Friday's storm stopped the site.
    const sep25 = { ...withLogs(initialGcState(), leftOff('froof', ['2026-09-21', '2026-09-22', '2026-09-23'])), today: '2026-09-25' }
    const [gap] = logChartGaps(sep25, fairOaks(sep25))
    expect(gap).toMatchObject({ kind: 'absent', days: ['2026-09-21', '2026-09-22', '2026-09-23'], weatherDays: ['2026-09-24', '2026-09-25'] })
    expect(gap?.words).toBe('Summit Roofing was not on site Mon, Tue and Wed. The chart has TPO membrane running those days. The log says the weather stopped work Thu and Fri.')
    // Two weather days are not two days off.
    const onlyWeather = { ...withLogs(initialGcState(), (l) => (l.date >= '2026-09-21' && l.date <= '2026-09-23' ? null : l)), today: '2026-09-25' }
    expect(logChartGaps(onlyWeather, fairOaks(onlyWeather))).toEqual([])
  })

  it('need two weekdays off, and take a hold as the reason', () => {
    expect(LOG_ABSENT_DAYS).toBe(2)
    // Monday morning, one log so far: one day off is ordinary.
    const monday = { ...withLogs(initialGcState(), leftOff('froof', ['2026-09-28'])), today: '2026-09-28' }
    expect(logChartGaps(monday, fairOaks(monday))).toEqual([])
    // Held, the bar is not waiting on its crew.
    const state = withLogs(initialGcState(), leftOff('froof', WEEK))
    const holds = new Map<string, GanttHold>([['froof-1', { kind: 'submittal', words: 'submittal 07 54 23-01', late: false }]])
    expect(logChartGaps(state, fairOaks(state), holds)).toEqual([])
  })

  it('say when a crew is on site with none of its bars running, and what came last', () => {
    const state = withLogs(initialGcState(), (l) => (['2026-09-28', '2026-09-29'].includes(l.date) ? { ...l, crews: [...l.crews, { packageId: 'fconc', workers: 3 }] } : l))
    const gaps = logChartGaps(state, fairOaks(state))
    expect(gaps.map(row)).toEqual([
      {
        kind: 'noBar',
        pkg: 'fconc',
        days: ['2026-09-28', '2026-09-29'],
        words: 'Guadalupe Flatwork was on site Mon and Tue, 6 worker-days. Nothing of theirs runs on the chart those days. Their last bar, Sidewalks and curbs, finished Fri Sep 11.',
        todo: 'If it is punch work, nothing changes. If the work is new, add it with Add an activity.',
      },
    ])
    // Concrete is done and folded: there is no bar to write on, so only the card says it.
    expect(logChartNotes(gaps).size).toBe(0)
  })

  it('offer the real start when a crew is on site before its bar, and clear once it is kept', () => {
    const { state, project } = helotesOursEarly()
    const gaps = logChartGaps(state, project)
    expect(gaps.map(row)).toEqual([
      {
        kind: 'noBar',
        pkg: 'dplumb',
        days: ['2026-10-02'],
        words: 'Our own crew was on site Fri, 3 worker-days. Nothing of ours runs on the chart that day. Underground starts Mon Oct 5.',
        todo: 'If it started early, keep its real start. If not, fix the log.',
      },
    ])
    expect(gaps[0]?.next).toMatchObject({ lineId: 'dplumb-1', name: 'Underground', start: '2026-10-05' })
    expect([...logChartNotes(gaps)]).toEqual([['dplumb-1', { note: 'on site this week, before this starts', words: 'The daily log has our own crew on site Fri, before this starts.' }]])
    // It started Fri Oct 2: the bar runs that day now, and the row goes.
    const kept = gcReducer(state, { type: 'setActualDates', projectId: 'helotes', lineId: 'dplumb-1', actualStart: '2026-10-02', by: 'Robert' })
    expect(logChartGaps(kept, kept.projects.find((p) => p.id === 'helotes')!)).toEqual([])
  })

  it('never contradict the walk: a bar on this week’s walk and its row name the same days', () => {
    // TPO membrane is under way, so the walk lists it with the log's week beside it.
    const state = withLogs(initialGcState(), leftOff('froof', WEEK))
    const project = fairOaks(state)
    const [gap] = logChartGaps(state, project)
    const walked = walkItems(state, project, new Map()).find((i) => i.lineId === 'froof-1')
    expect(walked?.facts).toContain(`Not on site in the ${gap?.days.length} days logged that week.`)
    expect(gap?.days).toEqual(WEEK)
    // With the weather in it, the days off and the weather's days are the walk's logged days.
    const sep25 = { ...withLogs(initialGcState(), leftOff('froof', ['2026-09-21', '2026-09-22', '2026-09-23'])), today: '2026-09-25' }
    const [wet] = logChartGaps(sep25, fairOaks(sep25))
    const walkedWet = walkItems(sep25, fairOaks(sep25), new Map()).find((i) => i.lineId === 'froof-1')
    expect(walkedWet?.facts).toContain(`Not on site in the ${(wet?.days.length ?? 0) + (wet?.weatherDays.length ?? 0)} days logged that week.`)
  })

  it('says every sentence in plain words', () => {
    const fo = initialGcState()
    const states = [
      withLogs(fo, leftOff('froof', WEEK)),
      withLogs(fo, (l) => (WEEK.includes(l.date) ? { ...l, crews: l.crews.filter((c) => c.packageId !== 'felec'), delays: [...l.delays, { packageId: 'felec', reason: 'materials', note: 'Panel boards are two weeks out.' }] } : l)),
      { ...withLogs(fo, leftOff('froof', ['2026-09-21', '2026-09-22', '2026-09-23'])), today: '2026-09-25' },
      withLogs(fo, (l) => (['2026-09-28', '2026-09-29'].includes(l.date) ? { ...l, crews: [...l.crews, { packageId: 'fconc', workers: 3 }] } : l)),
    ]
    const h = helotesOursEarly()
    const gaps = [...states.flatMap((s) => logChartGaps(s, fairOaks(s))), ...logChartGaps(h.state, h.project)]
    expect(gaps.length).toBe(5)
    const sentences = gaps.flatMap((g) => [g.words, g.todo, ...[...logChartNotes([g]).values()].flatMap((n) => [n.note, n.words])])
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
