import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import { cashAhead, type CashAhead } from './gcOwnerBillingAhead'
import { barsChangeWords, expectedDraws, expectedThrough, lowestWeekWords, seenPct } from './gcCashForecast'

/**
 * GC mode design spike: the cash weeks follow the bars (the Gantt, G-140; the owner's yes,
 * 2026-10-06). On the made-up data, today Fri Oct 2: Fair Oaks D has a schedule (G-97 bills it Oct
 * 25 $368,744, Nov 25 $70,405, Dec 25 $40,043, and Cibolo pays in 38 days); Helotes has none.
 */

const r = (n: number) => Math.round(n)
const job = (s: GcState, id = 'fairoaksd') => s.projects.find((p) => p.id === id)!
const expectedMoves = (a: CashAhead) => [...a.weeks.flatMap((w) => w.moves), ...a.later, ...a.noDay].filter((m) => m.expected)

describe('the six weeks as the schedule stands', () => {
  const a = cashAhead(initialGcState())

  it('pays the trades on Nov 4 for the work the bars reach by Oct 25, so the week of Nov 2 goes to $323,600 carrying', () => {
    expect(a.weeks.map((w) => [w.start, r(w.in), r(w.out), r(w.standing)])).toEqual([
      ['2026-09-28', 0, 0, 80_428],
      ['2026-10-05', 0, 0, 80_428],
      ['2026-10-12', 0, 119_700, -39_272],
      ['2026-10-19', 0, 0, -39_272],
      ['2026-10-26', 0, 0, -39_272],
      ['2026-11-02', 0, 284_328, -323_600],
    ])
    expect([a.lowest?.start, r(a.lowest?.standing ?? 0)]).toEqual(['2026-11-02', -323_600])
    expect(
      a.weeks
        .flatMap((w) => w.moves)
        .filter((m) => m.why === 'nextDraw')
        .map((m) => [m.who, r(m.amount), m.on, m.billOn]),
    ).toEqual([
      ['Hill Country Interiors', 14_688, '2026-11-04', '2026-10-25'],
      ['Iron Horse Fabrication', 5_400, '2026-11-04', '2026-10-25'],
      ['Pecan Valley Electric', 61_200, '2026-11-04', '2026-10-25'],
      ['Summit Roofing', 118_800, '2026-11-04', '2026-10-25'],
      ['Cool Breeze Mechanical', 84_240, '2026-11-04', '2026-10-25'],
    ])
  })

  it('brings every bill it expects after the six weeks, on the day each customer usually pays', () => {
    expect(a.later.filter((m) => m.why === 'nextBill').map((m) => [m.who, r(m.amount), m.on, m.billOn])).toEqual([
      ['Dr. Priya Raman', 47_301, '2026-11-15', '2026-10-25'],
      ['Cibolo Creek Partners', 368_744, '2026-12-02', '2026-10-25'],
      ['Cibolo Creek Partners', 70_405, '2027-01-02', '2026-11-25'],
      ['Cibolo Creek Partners', 40_043, '2027-02-01', '2026-12-25'],
    ])
    expect(a.later.filter((m) => m.why === 'nextDraw').map((m) => [m.who, r(m.amount), m.on])).toEqual([
      ['Pecan Valley Electric', 41_400, '2026-12-05'],
      ['Cool Breeze Mechanical', 16_200, '2026-12-05'],
      ['Cool Breeze Mechanical', 12_600, '2027-01-04'],
    ])
    expect([r(a.expected.in), r(a.expected.out)]).toEqual([526_492, 354_528])
    expect([a.nextBills.on, r(a.nextBills.amount), a.nextBills.jobs]).toEqual(['2026-10-25', 416_045, 2])
    expect(expectedThrough(a)).toBe('2026-12-25')
  })

  it('marks what the bars carried, and leaves a job with no schedule as reported', () => {
    const moves = expectedMoves(a)
    expect(moves.filter((m) => m.project.id === 'fairoaksd').every((m) => m.fromBars === true)).toBe(true)
    expect(moves.filter((m) => m.project.id === 'helotes').some((m) => m.fromBars)).toBe(false)
    // Helotes has no schedule: its bill and Hill Country's draw are the same either way.
    const reported = cashAhead(initialGcState(), { bars: 'reported' })
    const helotes = (x: CashAhead) => expectedMoves(x).filter((m) => m.project.id === 'helotes').map((m) => [m.who, r(m.amount), m.on])
    expect(helotes(a)).toEqual(helotes(reported))
  })
})

describe('as reported so far: the weeks as they counted before', () => {
  it('gives today’s numbers through the same rule', () => {
    const a = cashAhead(initialGcState(), { bars: 'reported' })
    expect([r(a.expected.in), r(a.expected.out)]).toEqual([145_868, 78_408])
    expect([a.lowest?.start, r(a.lowest?.standing ?? 0)]).toEqual(['2026-11-02', -117_680])
    expect(expectedMoves(a).some((m) => m.fromBars)).toBe(false)
  })

  it('a trade’s expected draw is what its own pay application asks, on the same percents', () => {
    const state = initialGcState()
    const pkg = job(state).packages.find((k) => k.trade === 'HVAC')!
    const expected = expectedDraws(state, job(state), 'reported').find((m) => m.who === 'Cool Breeze Mechanical')!
    const sow = pkg.sow!
    const sent = gcReducer(state, {
      type: 'tradeSendPayApp',
      projectId: 'fairoaksd',
      packageId: pkg.id,
      toPct: Object.fromEntries(sow.sov.map((l) => [l.id, seenPct(sow, l)])),
      periodTo: '2026-10-25',
      address: '1 Main St',
      license: 'TACLA1',
      signedBy: 'Andre Wallace',
      signedTitle: 'Owner',
    })
    const draws = job(sent).packages.find((k) => k.id === pkg.id)!.sow!.draws
    const draw = draws[draws.length - 1]!
    expect(r(expected.amount)).toBe(9_720)
    expect(r(draw.net)).toBe(r(expected.amount))
    expect(draw.number).toBe(expected.number)
  })
})

describe('what following the bars says', () => {
  it('names the change beside the weeks as reported, and the draws that make the lowest week', () => {
    const state = initialGcState()
    const schedule = cashAhead(state)
    const reported = cashAhead(state, { bars: 'reported' })
    expect(barsChangeWords(schedule, reported)).toEqual([
      'As the schedule stands, $205,920 more goes to the trades in these weeks.',
      'The bills it expects bring $380,624 more, all of it after these weeks.',
    ])
    expect(barsChangeWords(reported, reported)).toEqual([])
    expect(lowestWeekWords(schedule)).toBe('Summit Roofing $118,800 and Cool Breeze Mechanical $84,240 are most of it.')
    // As reported, Summit's $54,000 is more than half that week's $78,408 by itself.
    expect(lowestWeekWords(reported)).toBe('Summit Roofing $54,000 is most of it.')
  })

  it('moves a draw when a bar moves: Summit’s late day pushes the rooftop units past Oct 25', () => {
    const state = initialGcState()
    const moved = gcReducer(state, { type: 'setScheduleActivity', projectId: 'fairoaksd', lineId: 'froof-1', start: '2026-09-21', finish: '2026-10-14', after: ['fsteel-2'], why: { reason: 'materials', note: 'The membrane ships Oct 12.', by: 'Robert' } })
    const breeze = (s: GcState) => expectedMoves(cashAhead(s)).filter((m) => m.who === 'Cool Breeze Mechanical').map((m) => [m.billOn, r(m.amount)])
    const before = Object.fromEntries(breeze(state))
    const after = Object.fromEntries(breeze(moved))
    expect(after['2026-10-25']).toBeLessThan(before['2026-10-25'] as number)
    expect(after['2026-11-25']).toBeGreaterThan(before['2026-11-25'] as number)
    // The same work, a month later: the total does not change.
    const sum = (o: Record<string, unknown>) => Object.values(o).reduce((t: number, v) => t + (v as number), 0)
    expect(Math.abs(sum(after) - sum(before))).toBeLessThan(2)
  })
})
