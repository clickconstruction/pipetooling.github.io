/**
 * The tests of `gcStageHealth.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data, moved word for
 * word (the Board's B2b-vi). The data is `schedule/testState.ts`. The tests that play the prototype's reducer stay on the spike,
 * where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { quotesWantedOn } from './planQuestions'
import { projectPeople } from './projectPeople'
import { initialGcState } from './schedule/testState'
import { stageHealth, tradeHasNumber, weekIsQuiet, weekWorkingDays, workingDaysLeft } from './stageHealth'
import type { GcState } from './types'

const project = (state: GcState, id: string) => {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no project ${id}`)
  return p
}

describe('how the stage is going: bidding', () => {
  it('is behind with trades that have no quote this close to the bid, and says which', () => {
    const state = initialGcState()
    const h = stageHealth(state, project(state, 'boerne'))
    expect(h?.verdict).toBe('behind')
    expect(h?.why).toBe('6 days left and 2 trades have no quote: Structural steel and Fire sprinkler.')
    expect(h?.next).toEqual({ words: 'Ask more companies for Structural steel', tab: 'packages' })
    expect(h?.tiles.map((t) => `${t.trade}:${t.state}`)).toEqual([
      'Sitework:good',
      'Concrete:good',
      'Structural steel:bad',
      'Roofing:warn',
      'Plumbing:ours',
      'HVAC:warn',
      'Electrical:warn',
      'Fire sprinkler:bad',
    ])
    expect(h?.tiles.find((t) => t.trade === 'HVAC')?.dots).toEqual(['wait', 'on'])
    // The calendar: a square a day from the bid set to the bid date, Monday to Sunday.
    const days = h?.calendar.weeks.flat() ?? []
    expect(h?.calendar.mode).toBe('days')
    expect(days[0]?.on).toBe('2026-09-14')
    expect(days[days.length - 1]?.on).toBe('2026-10-11')
    expect(days.filter((d) => d.label).map((d) => `${d.on} ${d.label}`)).toEqual([
      '2026-09-18 Bid set',
      '2026-09-29 Addendum 1',
      '2026-10-02 Today',
      '2026-10-05 Questions close · quotes wanted',
      '2026-10-08 Bid due',
    ])
    const day = (on: string) => days.find((d) => d.on === on)
    expect(day('2026-10-01')?.came).toEqual(['Tri-County Site', 'Guadalupe Flatwork', 'Kendall Air', 'Brightline Electric'])
    expect(day('2026-09-30')?.questions).toBe(1)
    expect(day('2026-09-29')?.tag).toBe('A1')
    expect(day('2026-09-19')?.events).toContain('14 companies invited.')
    expect(day('2026-09-17')?.inStage).toBe(false)
    expect(day('2026-09-19')?.weekend).toBe(true)
    expect(h?.calendar.summary.map((x) => `${x.value} ${x.label}`)).toEqual(['5 working days left, counting today', '9 of 14 quotes in', '2 questions open'])
    expect(h?.numbers[0]).toMatchObject({ label: 'Trades with a number', value: '3 of 8' })
    // The same count of people as the board row.
    const people = projectPeople(state, project(state, 'boerne'))
    expect(h?.numbers.find((n) => n.label === 'People to call')).toMatchObject({ value: String(people.count), note: `${people.late} late` })
  })

  it('does not count a carried quote with a line that has no cost: one rule for the header, the ring and the strip', () => {
    const state = initialGcState()
    const roofing = project(state, 'boerne').packages.find((p) => p.trade === 'Roofing')
    expect(roofing && tradeHasNumber(state, roofing)).toBe(false)
  })

  it('watches a bid with time left, and is on track once our bid is in', () => {
    const state = initialGcState()
    expect(stageHealth(state, project(state, 'padb'))?.verdict).toBe('watch')
    const sent = { ...state, projects: state.projects.map((p) => (p.id === 'boerne' ? { ...p, ourBidSentOn: '2026-10-02' } : p)) }
    const h = stageHealth(sent, project(sent, 'boerne'))
    expect(h?.verdict).toBe('on track')
    expect(h?.next).toBeNull()
  })
})

describe('how the stage is going: buying out', () => {
  it('watches a job with no start date, names what waits on us, and asks for the date', () => {
    const state = initialGcState()
    const h = stageHealth(state, project(state, 'helotes'))
    expect(h?.verdict).toBe('watch')
    expect(h?.why).toBe('No start date yet. 2 of 5 trades are ready. Millwork is not awarded.')
    expect(h?.next).toEqual({ words: 'Award Millwork', tab: 'contracts' })
    expect(h?.askStartDate).toBe(true)
    expect(h?.calendar.openEnd).toBe('No start date')
    expect(h?.calendar.weeks.flat().find((d) => d.on === '2026-09-04')).toBeUndefined()
    const hvac = h?.tiles.find((t) => t.trade === 'HVAC')
    expect(hvac?.state).toBe('bad')
    expect(hvac?.dots).toEqual(['on', 'wait', 'on', 'on', 'us'])
    expect(hvac?.note).toBe('Statement of work drafted, not sent')
    expect(h?.numbers[1]).toMatchObject({ value: '2 of 5', note: '2 papers wait on companies, 2 on us' })
  })
})

describe('how the stage is going: building', () => {
  it('watches a job behind the plan, puts work against time and money against work, and names what waits on us', () => {
    const state = initialGcState()
    const h = stageHealth(state, project(state, 'fairoaksd'))
    expect(h?.verdict).toBe('watch')
    expect(h?.why).toBe('3 days behind the plan. Dry-in is 7 days late. The finish holds at Dec 11.')
    expect(h?.next?.tab).toBe('submittals')
    // Building is a square a week: the dry-in week late, the finish week marked, this week ringed.
    expect(h?.calendar.mode).toBe('weeks')
    const weeks = h?.calendar.squares ?? []
    expect(weeks.find((w) => w.start === '2026-09-21')?.kind).toBe('late')
    expect(weeks.find((w) => w.start === '2026-12-07')?.kind).toBe('end')
    expect(weeks.find((w) => w.current)?.start).toBe('2026-09-28')
    expect(h?.bars.map((b) => `${b.label} ${b.value}`)).toEqual(['Work done 72% · plan 76%', 'Time used 93 of 163 days', 'Billed the customer 64% · work 74%', 'Paid us 38% of the price'])
    expect(h?.numbers.find((n) => n.label === 'Not billed yet')?.value).toBe('about $149,000')
    expect(h?.numbers.find((n) => n.label === 'Waiting on us')?.value).toBe('6')
    expect(h?.tiles.find((t) => t.trade === 'Electrical')).toMatchObject({ state: 'bad', pct: 54 })
    // Money rows are marked, so a teammate's strip can leave them out in the real build.
    expect(h?.bars.filter((b) => b.money).map((b) => b.kind)).toEqual(['billed', 'paid'])
  })

  it('is on track once every trade has reported all its work', () => {
    const state = initialGcState()
    expect(stageHealth(state, project(state, 'stoneoak'))?.verdict).toBe('on track')
  })
})

describe('the calendar\'s helpers', () => {
  it('wants every quote on the day questions close, and counts working days with today', () => {
    const state = initialGcState()
    expect(quotesWantedOn(project(state, 'boerne'))).toBe('2026-10-05')
    expect(quotesWantedOn(project(state, 'helotes'))).toBeNull()
    expect(workingDaysLeft('2026-10-02', '2026-10-08')).toBe(5)
    expect(workingDaysLeft('2026-10-03', '2026-10-05')).toBe(1)
  })
})

describe('quiet weeks', () => {
  it('folds a week with nothing in it into one rectangle, and keeps every week with something', () => {
    const state = initialGcState()
    const padB = stageHealth(state, project(state, 'padb'))?.calendar.weeks ?? []
    // Pad B: the pricing set and today in the first week, nothing for two weeks, the deadlines in the last.
    expect(padB.map((w) => weekIsQuiet(w))).toEqual([false, true, true, false])
    expect(weekWorkingDays(padB[1] ?? [])).toBe(5)
    const boerne = stageHealth(state, project(state, 'boerne'))?.calendar.weeks ?? []
    expect(boerne.every((w) => !weekIsQuiet(w))).toBe(true)
  })
})
