/**
 * Get started on the board's own rows (the Board's B6-c-ii): `startChecklist` over the clinic as the mapper reads it,
 * ready, our own crew priced and not (call C), and Start anyway's owed list.
 */
import { describe, expect, it } from 'vitest'
import { withSchedules } from './billCustomer'
import { boardStateFromRows } from './boardRows'
import { awardedClinicBoardRows, readyClinicBoardRows } from './boardTestRows'
import { initialGcState } from './schedule/testState'
import { startChecklist } from './start'

const drawn = () => initialGcState().projects.find((p) => p.id === 'fairoaksd')!.schedule!
const checklist = (rows: ReturnType<typeof readyClinicBoardRows>, schedule = true) => {
  const state = boardStateFromRows(rows)
  const laid = schedule ? withSchedules(state, new Map([['p1', drawn()]])) : state
  return startChecklist(laid, laid.projects[0]!)
}

describe('Get started on mapped rows', () => {
  it('is ready once every step is in: our contract, the permit, a date, the schedule and each trade', () => {
    const list = checklist(readyClinicBoardRows())
    expect(list.missing).toEqual([])
    expect([list.ready, list.done, list.total]).toEqual([true, list.total, 3 + 1 + 5 + 1])
    expect(list.trades.map((t) => [t.pkg.trade, t.ready])).toEqual([
      ['Sitework', true],
      ['Plumbing', true],
    ])
  })

  it('our own crew is ready once its bid is priced, and names the bid; unpriced it asks for the price (call C)', () => {
    const priced = checklist(readyClinicBoardRows()).trades.find((t) => t.pkg.id === 'k3')!
    expect(priced.checks[0]?.detail).toBe('our own crew, BP7')
    const unpriced = checklist({ ...readyClinicBoardRows(), ownBids: [{ id: 'b7', bid_value: 0, bid_number: 'BP7' }] })
    expect(unpriced.trades.find((t) => t.pkg.id === 'k3')?.next).toBe('Price our own bid.')
    expect(unpriced.missing).toEqual(['Plumbing: Price our own bid.'])
  })

  it('a job started anyway keeps its owed list, and the checklist still names what is missing now', () => {
    const rows = awardedClinicBoardRows()
    const state = boardStateFromRows({
      ...rows,
      boardDates: { p1: { ...rows.boardDates.p1!, started_on: '2026-10-10', started_anyway_by: 'u1', started_anyway_reason: 'Rain coming.', started_anyway_missing: ['The permit is in hand: not yet.', 'Concrete: Pick a company and award the trade.'] } },
    })
    const project = state.projects[0]!
    expect(project.startedAnyway).toEqual({ by: 'Rosa', reason: 'Rain coming.', missing: ['The permit is in hand: not yet.', 'Concrete: Pick a company and award the trade.'] })
    const list = startChecklist(state, project)
    expect(list.ready).toBe(false)
    expect(list.missing).toContain('The permit is in hand: not yet.')
    expect(list.missing).toContain('Concrete: Pick a company and award the trade.')
  })
})
