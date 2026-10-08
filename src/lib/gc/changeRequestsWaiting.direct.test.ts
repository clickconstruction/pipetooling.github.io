/**
 * The change requests waiting on us (P4b-iii, lifted from the prototype's `gcChangeRequestsWaiting.ts`): a trade's request
 * from its portal, until the office makes it a change order or turns it down, and the dashboard's Needs you line the
 * Board's B2b draws. The prototype's own test plays its reducer and stays on the spike; this one builds the states by hand.
 */
import { describe, expect, it } from 'vitest'
import { CHANGE_REQUEST_LATE_DAYS, changeRequestLine, changeRequestLinesFor, changeRequestsWaiting, gcChangeRequestsNeedsYou } from './changeRequestsWaiting'
import { initialGcState } from './schedule/testState'
import type { GcState, Partner, TradeChangeRequest } from './types'

const partner: Partner = {
  id: 'p1',
  company: 'Tri-County Site',
  contact: 'Dana Whitfield',
  trades: ['Sitework'],
  msa: 'none',
  msaSignedOn: null,
  coiExpires: '2026-12-31',
  w9: true,
  invited: 1,
  bids: 1,
  won: 0,
  promisesMade: 0,
  promisesKept: 0,
  base: null,
  maxMiles: null,
}
const request: TradeChangeRequest = {
  id: 'cr1',
  packageId: 'site',
  partnerId: 'p1',
  askedOn: '2026-10-05',
  description: 'Rock in the pad.',
  reason: 'field',
  amount: 14820,
  days: 2,
  file: null,
  changeOrderId: null,
  turnedDown: null,
}

function stateWith(requests: TradeChangeRequest[], today: string, over: { closedOn?: string | null } = {}): GcState {
  const s = initialGcState()
  const base = s.projects[0]
  if (!base) throw new Error('no project in the test data')
  const site = { id: 'site', trade: 'Sitework', scope: [], budget: 0, bidTab: null, selfPerform: null, invites: [], carried: null, awardedInviteId: null, sow: null }
  return { ...s, today, partners: [partner], projects: [{ ...base, name: 'Fair Oaks Shops', closedOn: over.closedOn ?? null, lostOn: null, packages: [site], changeRequests: requests, changeOrders: [] }] }
}

describe('change requests waiting on us (P4b-iii)', () => {
  it('lists a request the office has not answered, with how long it waited', () => {
    const state = stateWith([request], '2026-10-08')
    const [w] = changeRequestsWaiting(state)
    expect([w?.company, w?.trade, w?.waited]).toEqual(['Tri-County Site', 'Sitework', 3])
    expect(w && changeRequestLine(w)).toBe('Tri-County Site asked for a change 3 days ago: Rock in the pad, $14,820. Answer it on Bill the customer.')
    expect(changeRequestLinesFor(state, state.projects[0]!)).toHaveLength(1)
    expect(gcChangeRequestsNeedsYou(state)).toEqual({
      count: 1,
      late: false,
      title: '1 change request waiting on you in GC mode',
      detail: 'Tri-County Site asked for $14,820 on Fair Oaks Shops. A trade asked from its portal; make it a change order or turn it down.',
      projectId: state.projects[0]!.id,
    })
  })

  it('clears a request once it is turned down or a change order is drafted from it', () => {
    expect(changeRequestsWaiting(stateWith([{ ...request, turnedDown: { on: '2026-10-07', note: 'It was in the geotech report.' } }], '2026-10-08'))).toEqual([])
    const drafted = stateWith([{ ...request, changeOrderId: 'co1' }], '2026-10-08')
    const withOrder: GcState = {
      ...drafted,
      projects: drafted.projects.map((p) => ({ ...p, changeOrders: [{ id: 'co1', number: 4, description: 'Rock', reason: 'field', schedule: '', packageId: 'site', cost: 14820, price: 16302, status: 'draft', sentOn: null, answeredOn: null, pctDone: 0 }] })),
    }
    expect(changeRequestsWaiting(withOrder)).toEqual([])
  })

  it(`reads late past ${CHANGE_REQUEST_LATE_DAYS} days, and leaves out a closed job`, () => {
    expect(gcChangeRequestsNeedsYou(stateWith([request], '2026-10-12'))?.late).toBe(false)
    expect(gcChangeRequestsNeedsYou(stateWith([request], '2026-10-13'))?.late).toBe(true)
    expect(gcChangeRequestsNeedsYou(stateWith([request], '2026-10-13', { closedOn: '2026-10-10' }))).toBeNull()
  })
})
