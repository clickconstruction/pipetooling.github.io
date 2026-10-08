/**
 * Main's own tests for Compare quotes' exclusion rows (the Board's B5-b), on a hand-built trade: the
 * test data's quotes carry no exclusions. Each exclusion any company named is a row, a Known
 * exclusion is expected of everyone, and a company's answer reads from its list and the names it
 * answered about.
 */
import { describe, expect, it } from 'vitest'
import { exclusionRows } from './exclusions'
import type { Invite, SubBid, TradePackage } from './types'

const bid = (over: Partial<SubBid>): SubBid => ({ amount: 50000, basedOnRev: 0, submittedOn: '2026-10-05', includes: {}, plugs: {}, note: '', ...over })
const ask = (id: string, b: SubBid | null): Invite => ({ id, partnerId: `co-${id}`, status: b ? 'bid' : 'opened', invitedOn: '2026-10-01', bid: b, seenRev: 0 })

function trade(invites: Invite[], excludes: TradePackage['excludes'] = []): TradePackage {
  return { id: 'k1', trade: 'Sitework', budget: 60000, scope: [], invites, excludes, carried: null, awardedInviteId: null, selfPerform: null, sow: null, bidTab: null } as unknown as TradePackage
}

describe('Compare quotes’ exclusion rows', () => {
  it('lists each exclusion once, in the order the companies named them, with each company’s answer and cover', () => {
    const rows = exclusionRows(
      trade([
        ask('a', bid({ exclusions: [{ name: 'Dewatering' }, { name: 'Rock removal', unitPrice: { amount: 85, unit: 'cy' } }], exclusionCovers: { Dewatering: 2500 } })),
        ask('b', bid({ exclusions: [{ name: 'dewatering' }], exclusionsAnswered: ['Rock removal'] })),
        ask('c', null),
      ]),
    )
    expect(rows.map((r) => r.name)).toEqual(['Dewatering', 'Rock removal'])
    expect(rows[0]!.cells.map((c) => [c.invite.id, c.state, c.cover])).toEqual([
      ['a', 'excluded', 2500],
      ['b', 'excluded', null],
    ])
    expect(rows[1]!.cells.map((c) => [c.invite.id, c.state])).toEqual([
      ['a', 'excluded'],
      ['b', 'included'],
    ])
    expect(rows[1]!.cells[0]!.exclusion?.unitPrice).toEqual({ amount: 85, unit: 'cy' })
  })

  it('marks a Known exclusion expected of everyone, and says nothing for a company that did not answer', () => {
    const rows = exclusionRows(trade([ask('a', bid({ exclusions: [{ name: 'Landscaping' }, { name: 'Testing' }] })), ask('b', bid({}))], [{ label: 'Landscaping', by: 'Owner' }]))
    expect(rows[0]).toMatchObject({ name: 'Landscaping', known: { by: 'Owner' } })
    expect(rows[0]!.cells.map((c) => c.state)).toEqual(['expected', 'expected'])
    expect(rows[1]!.cells.map((c) => c.state)).toEqual(['excluded', 'unsaid'])
  })

  it('has no rows when no quote names an exclusion', () => {
    expect(exclusionRows(trade([ask('a', bid({}))]))).toEqual([])
  })
})
