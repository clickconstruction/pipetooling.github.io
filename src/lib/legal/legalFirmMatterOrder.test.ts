import { describe, expect, it } from 'vitest'
import { orderFirmMatters } from './legalFirmMatterOrder'

type M = { id: string; releasedAt: string | null; balance: number | null }
const m = (id: string, balance: number | null, releasedAt: string | null): M => ({ id, balance, releasedAt })
const order = (ms: M[]) => orderFirmMatters(ms, (x) => x.balance).map((x) => x.id)

describe('orderFirmMatters · punch list #85 item 11 · largest balance first', () => {
  it('largest balance first, whatever order the function sent', () => {
    expect(order([m('dental', 2100, '2026-09-18'), m('sample', 14400, '2026-09-29'), m('mid', 5000, '2026-09-20')])).toEqual(['sample', 'mid', 'dental'])
  })

  it('two balances that match: the newest referral first', () => {
    expect(order([m('sample', 14400, '2026-09-29'), m('riverbend', 14400, '2026-10-02')])).toEqual(['riverbend', 'sample'])
  })

  it('the same balance and day keep the function’s order', () => {
    expect(order([m('a', 100, '2026-10-01'), m('b', 100, '2026-10-01')])).toEqual(['a', 'b'])
  })

  it('a matter with no packet keeps its place after the rest; no referral date sorts last in a tie', () => {
    expect(order([m('broken', null, '2026-10-03'), m('small', 10, '2026-09-01'), m('nodate', 10, null)])).toEqual(['small', 'nodate', 'broken'])
  })

  it('does not change the list it was given', () => {
    const ms = [m('a', 1, null), m('b', 2, null)]
    orderFirmMatters(ms, (x) => x.balance)
    expect(ms.map((x) => x.id)).toEqual(['a', 'b'])
  })
})
