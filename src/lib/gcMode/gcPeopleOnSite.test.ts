import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { plainWordsFailures } from '../plainWords'
import type { DailyLog, GcState } from './gcTypes'
import { ASSUMED_CREW, SHORT_BY, peopleOnSite, type TradeCount } from './gcPeopleOnSite'

/** Fair Oaks Shops, Building D; the made-up today is Fri Oct 2, and the daily log runs Sep 21 to Oct 1. */
const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd')!
const weeksOf = (state: GcState, from: string, to: string, told?: TradeCount[]) => peopleOnSite(state, fairOaks(state), from, to, told)

describe('people on site per week (G-84)', () => {
  it('reads Fair Oaks D: the plan’s busiest day against the daily log’s, week by week', () => {
    const weeks = weeksOf(initialGcState(), '2026-09-21', '2026-10-26')
    expect(weeks.map((w) => [w.weekOf, w.planned.count, w.planned.on, w.logged ? [w.logged.count, w.logged.on, w.logged.days] : null, w.short])).toEqual([
      ['2026-09-21', 15, '2026-09-21', [19, '2026-09-22', 5], false],
      ['2026-09-28', 15, '2026-09-28', [18, '2026-09-28', 3], false],
      ['2026-10-05', 12, '2026-10-05', null, false],
      ['2026-10-12', 9, '2026-10-12', null, false],
      ['2026-10-19', 9, '2026-10-19', null, false],
      ['2026-10-26', 2, '2026-10-26', null, false],
    ])
    // Each count is the daily log's last one for that trade.
    expect(weeks[0]?.planned.by.map((b) => [b.company, b.count, b.from])).toEqual([
      ['Iron Horse Fabrication', 3, 'log'],
      ['Pecan Valley Electric', 2, 'log'],
      ['Summit Roofing', 4, 'log'],
      ['our own crew', 3, 'log'],
      ['Cool Breeze Mechanical', 3, 'log'],
    ])
    expect(weeks[0]?.rows).toEqual([
      { label: 'Plan', text: '15 at the busiest, Mon Sep 21.' },
      { label: 'Who', text: 'Iron Horse Fabrication 3, Pecan Valley Electric 2, Summit Roofing 4, our own crew 3, Cool Breeze Mechanical 3' },
      { label: 'Log', text: '19 at the busiest, Tue Sep 22, 5 days logged.' },
      { label: 'Counts', text: "Each is the daily log's last count for that trade. A trade with no count yet is counted as 3." },
    ])
  })

  it('counts a trade never on the log as the assumption, named', () => {
    expect(ASSUMED_CREW).toBe(3)
    // Late July: Tri-County's sitework and Guadalupe's foundations, before any daily log.
    const [jul20] = weeksOf(initialGcState(), '2026-07-20', '2026-07-20')
    expect(jul20?.planned.by.map((b) => [b.company, b.count, b.from])).toEqual([
      ['Tri-County Site', 3, 'assumed'],
      ['Guadalupe Flatwork', 3, 'assumed'],
    ])
    expect(jul20?.rows.find((r) => r.label === 'Who')?.text).toBe('Tri-County Site 3, assumed, Guadalupe Flatwork 3, assumed')
    expect(jul20?.rows.find((r) => r.label === 'Log')?.text).toBe('No daily log this week.')
  })

  it('reads the plan on its own dates: a late bar does not fill the weeks ahead', () => {
    // Erection is 80% done past its Oct 2 finish: in the week it was to finish, not after.
    const [sep28, oct5] = weeksOf(initialGcState(), '2026-09-28', '2026-10-05')
    expect(sep28?.planned.by.map((b) => b.company)).toContain('Iron Horse Fabrication')
    expect(oct5?.planned.by.map((b) => b.company)).not.toContain('Iron Horse Fabrication')
  })

  it('counts one trade once a day, our own crew too, and never an inspection', () => {
    // Week of Sep 7: Iron Horse has Joists and deck and Erection running together; it counts once.
    const [sep7] = weeksOf(initialGcState(), '2026-09-07', '2026-09-07')
    expect(sep7?.planned.by.map((b) => [b.company, b.count])).toEqual([
      ['Guadalupe Flatwork', 3],
      ['Iron Horse Fabrication', 3],
      ['Pecan Valley Electric', 2],
    ])
    expect(sep7?.planned.count).toBe(8)
    // The electrical service inspection on Fri Oct 2 is the city's, with no crew of ours to count.
    const [sep28] = weeksOf(initialGcState(), '2026-09-28', '2026-09-28')
    expect(sep28?.planned.by.map((b) => b.company)).toContain('our own crew')
    expect(sep28?.planned.by.map((b) => b.company)).not.toContain('The city')
  })

  it('takes a trade’s own count for its week first, when G-142 gives one', () => {
    const told: TradeCount[] = [{ packageId: 'froof', partnerId: 'summit', weekOf: '2026-10-05', count: 6, on: '2026-10-02' }]
    const [oct5, oct12] = weeksOf(initialGcState(), '2026-10-05', '2026-10-12', told)
    expect(oct5?.planned.count).toBe(14)
    expect(oct5?.planned.by.find((b) => b.company === 'Summit Roofing')).toMatchObject({ count: 6, from: 'told' })
    expect(oct5?.rows.find((r) => r.label === 'Counts')?.text).toBe("A trade's own count for the week comes first, then the daily log's last count. A trade with no count yet is counted as 3.")
    // Another week falls back to the log.
    expect(oct12?.planned.by.find((b) => b.company === 'Summit Roofing')).toMatchObject({ count: 4, from: 'log' })
  })

  it('reads a week short when its busiest logged day falls SHORT_BY or more below the plan', () => {
    expect(SHORT_BY).toBe(3)
    // Summit Roofing left off the logs of Sep 28, Sep 29 and Oct 1: its last count is Sep 23's 5.
    const base = initialGcState()
    const off = (l: DailyLog): DailyLog => (['2026-09-28', '2026-09-29', '2026-10-01'].includes(l.date) ? { ...l, crews: l.crews.filter((c) => c.packageId !== 'froof') } : l)
    const state: GcState = { ...base, projects: base.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, dailyLogs: (p.dailyLogs ?? []).map(off) } : p)) }
    const [sep28] = weeksOf(state, '2026-09-28', '2026-09-28')
    expect(sep28).toMatchObject({ planned: { count: 16 }, logged: { count: 13, on: '2026-09-28' }, short: true })
    expect(sep28?.rows.find((r) => r.label === 'Short')?.text).toBe('The log had 3 fewer people than the plan.')
  })

  it('says every sentence in plain words', () => {
    const told: TradeCount[] = [{ packageId: 'froof', partnerId: 'summit', weekOf: '2026-10-05', count: 6, on: '2026-10-02' }]
    const weeks = [...weeksOf(initialGcState(), '2026-07-20', '2026-10-26', told)]
    const sentences = weeks.flatMap((w) => w.rows.filter((r) => r.label !== 'Who').map((r) => r.text))
    expect(sentences.length).toBeGreaterThan(30)
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
