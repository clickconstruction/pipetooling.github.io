import { describe, expect, it } from 'vitest'
import { billingForecast } from '../billingForecast'
import { ownerPayApp } from '../ownerBilling'
import type { GcState } from '../types'
import { billMarks, billRing, billRiver, billToday, markTip, ownerNumber, ownerWords, riverHeading } from './summary'
import { billDayDates, billDayGates, tradeDraws, tradesSums, walkDraws } from './trades'
import { billDayJob, billDayState, WENDI_WALK, WHERE_ON_SITE } from '../../../test/fixtures/billDayDemo'
import { claimsToCheck } from './walk'

function stoneOak(today?: string) {
  const state = billDayState(today)
  const project = billDayJob(state, 'stoneoak')
  const dates = billDayDates(state, project)
  const rows = tradeDraws(state, project, dates)
  return { state, project, dates, rows }
}

describe('billRiver', () => {
  it('reads each draw in at what it asked, approved at what we approved, and the rest at the schedule’s expected', () => {
    const { state, project, dates, rows } = stoneOak()
    const river = billRiver(state, project, rows, dates)
    expect(river.segments.map((s) => [s.key, s.label, s.count, s.words])).toEqual([
      ['notin', 'Not in', 3, 'due Oct 19'],
      ['back', 'Sent back', 1, ''],
      ['waiting', 'Waiting on us', 1, '4 days'],
      ['approved', 'Approved', 1, ''],
    ])
    expect(river.segments.slice(1).map((s) => s.amount)).toEqual([34_560, 35_010, 13_500])
    expect(river.segments[0]?.amount).toBeCloseTo(rows.filter((r) => r.state === 'notin').reduce((s, r) => s + r.expected, 0), 6)
    expect(river.total).toBeCloseTo(tradesSums(rows).total, 6)
    expect(river.segments.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 9)
    expect(river.draws).toBe(6)
    expect(river.segments.map((s) => s.tip.split('|')[1])).toEqual([
      '$86,985 across 3 draws. What the schedule says each comes to by bill day, after retainage.',
      '$34,560 across 1 draw. What each asked, after retainage.',
      '$35,010 across 1 draw. What each asked, after retainage.',
      '$13,500 across 1 draw. What we approved, after retainage and back-charges.',
    ])
    expect(riverHeading(river)).toBe("The trades' draws · 6 · $170,055 as it stands")
  })

  it('keeps a trade not in on the river even when the schedule expects nothing of it, and drops one said to send nothing', () => {
    const state = billDayState()
    const helotes = billDayJob(state, 'helotes')
    const noBars = { ...helotes, schedule: helotes.schedule && { ...helotes.schedule, activities: [] } }
    const s2: GcState = { ...state, projects: state.projects.map((p) => (p.id === 'helotes' ? noBars : p)) }
    const dates = billDayDates(s2, noBars)
    const rows = tradeDraws(s2, noBars, dates)
    expect(billRiver(s2, noBars, rows, dates).segments.map((s) => [s.key, s.count, s.amount])).toEqual([['notin', 1, 0]])
    const said = tradeDraws(s2, noBars, dates, [{ sowId: 'sow-hcpaving', periodTo: '2026-10-25', saidBy: 'the office', at: '2026-10-02T15:00:00Z' }])
    expect(billRiver(s2, noBars, said, dates).segments).toEqual([])
  })
})

describe('ownerNumber', () => {
  it('reads the forecast for this bill day before it comes, never adding our fee by hand', () => {
    const { state, project, dates } = stoneOak()
    const owner = ownerNumber(state, project, dates)
    expect(owner.from).toBe('forecast')
    expect(owner.amount).toBe(billingForecast(state, project).months.find((m) => m.on === '2026-10-25')?.bill)
    // Our own crew, as the prototype has it: $27,900 this period, 62% done, on J1082.
    expect(owner.ours).toEqual({ amount: 27_900, pct: 62, ref: 'J1082' })
  })

  it('reads the draft from the work in on bill day, and the bill as it went once it went', () => {
    const state = billDayState('2026-10-25')
    const project = billDayJob(state, 'stoneoak')
    const dates = billDayDates(state, project)
    expect(ownerNumber(state, project, dates)).toMatchObject({ from: 'draft', amount: ownerPayApp(state, project).due })

    const went = {
      ...project,
      ownerBilling: project.ownerBilling && {
        ...project.ownerBilling,
        payApps: [...(project.ownerBilling.payApps ?? []), { number: 4, periodTo: '2026-10-25', sentOn: '2026-10-26', doneToDate: {}, workToDate: 0, retainagePct: 10, retainage: 0, due: 123_456, paidOn: null }],
      },
    }
    expect(ownerNumber(state, went, dates)).toMatchObject({ from: 'sent', amount: 123_456 })
  })

  it('says the trades and our crew under the owner’s number', () => {
    const { state, project, dates, rows } = stoneOak()
    expect(ownerWords(billRiver(state, project, rows, dates))).toBe('the trades $170,055 · our crew $27,900')
  })
})

describe('billMarks', () => {
  it('sets today among the dates in the order they come, with Trades by hot while a trade is not in', () => {
    const early = stoneOak()
    expect(billMarks(early.dates, early.state.today, early.rows).map((m) => [m.label, m.on, m.tone, m.when])).toEqual([
      ['Today', '2026-10-02', 'now', ''],
      ['Trades by', '2026-10-19', 'hot', ', in 17 days'],
      ['Walk by', '2026-10-23', '', ', in 21 days'],
      ['Bill day', '2026-10-25', '', ', in 23 days'],
      ['Owner pays', '2026-12-02', '', ', in 61 days'],
    ])
    const late = stoneOak('2026-10-22')
    const marks = billMarks(late.dates, late.state.today, late.rows)
    expect(marks.map((m) => m.label)).toEqual(['Trades by', 'Today', 'Walk by', 'Bill day', 'Owner pays'])
    expect(marks[0]).toMatchObject({ tone: 'hot', when: ', past' })
    expect(marks.filter((m) => m.key === 'walk').map(markTip)).toEqual(['Walk by|Fri Oct 23, in 1 day.|Evenly spaced. The order is what matters.'])
  })
})

describe('billToday and billRing', () => {
  it('lists the first three open gates with their presses, and the ring at 2 of 7', () => {
    const { state, project, dates, rows } = stoneOak()
    const gates = billDayGates(project, rows, dates, state.today, claimsToCheck(walkDraws(rows), [], (id) => WHERE_ON_SITE[id] ?? null), 'Wendi')
    const today = billToday(gates, state.today, dates.billDay)
    expect(today.items.map((i) => [i.dot, i.words, i.acts.map((a) => a.label)])).toEqual([
      ['r', 'Ask the 3 not in · due Mon Oct 19', ['Ask the 3 not in']],
      ['o', "Rio Paving's draw, sent back Thu Oct 1", ['Remind Rio Paving']],
      ['b', 'Lone Star Mechanical waits on us · 4 d', ['Open the lines', 'Ask Wendi to walk it']],
    ])
    expect(today.clear).toBeNull()
    expect(billRing(gates)).toEqual({ words: 'Can it go? Not yet.', count: '2 of 7', pct: 29, open: '5 gates open' })
  })

  it('moves to the conditional waivers once Wendi walks, at 3 of 7', () => {
    const { state, project, dates, rows } = stoneOak('2026-10-22')
    const gates = billDayGates(project, rows, dates, state.today, claimsToCheck(walkDraws(rows), WENDI_WALK, (id) => WHERE_ON_SITE[id] ?? null), 'Wendi')
    expect(billToday(gates, state.today, dates.billDay).items.map((i) => i.words)).toEqual(['Ask the 3 not in · due Mon Oct 19', "Rio Paving's draw, sent back Thu Oct 1", 'Conditional waivers · 3 of 6 in'])
    expect(billRing(gates)).toMatchObject({ count: '3 of 7', pct: 43 })
  })

  it('says it can go once every gate is clear: on bill day, send it', () => {
    const { state, project, dates, rows } = stoneOak()
    const clear = billDayGates(project, rows, dates, state.today, [], 'Wendi').map((g) => ({ ...g, ok: true }))
    expect(billToday(clear, '2026-10-20', dates.billDay)).toEqual({ items: [], clear: 'Every gate is clear. It goes on bill day.' })
    expect(billToday(clear, '2026-10-25', dates.billDay).clear).toBe('Every gate is clear. Send it.')
    expect(billRing(clear)).toEqual({ words: 'Can it go? Yes.', count: '7 of 7', pct: 100, open: '0 gates open' })
  })
})
