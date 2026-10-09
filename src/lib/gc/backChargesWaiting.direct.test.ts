/**
 * The back-charges waiting on the office (P4b-iii, lifted from the prototype's `gcBackChargesWaiting.ts`): which charges
 * are our move, and the dashboard's Needs you line the Board's B2b draws. The prototype's own test plays its reducer and
 * stays on the spike; this one builds the states by hand.
 */
import { describe, expect, it } from 'vitest'
import { BACK_CHARGE_LATE_DAYS, backChargeShort, backChargesWaiting, gcBackChargesNeedsYou } from './backChargesWaiting'
import { initialGcState } from './schedule/testState'
import type { BackCharge, Draw, GcState, Partner, TradePackage } from './types'

const partner: Partner = {
  id: 'p1',
  company: 'Iron Horse Drywall',
  contact: 'Dana Whitfield',
  trades: ['Drywall'],
  msa: 'none',
  msaSignedOn: null,
  coiExpires: '2026-12-31',
  w9: true,
  invited: 1,
  bids: 1,
  promisesMade: 0,
  promisesKept: 0,
  base: null,
  maxMiles: null,
}
const approved: Draw = { id: 'd2', number: 2, requestedOn: '2026-10-01', approvedOn: '2026-10-06', gross: 5500, retainage: 500, net: 5000, status: 'approved', waiver: 'conditional', lines: [] }
const charge: BackCharge = { id: 'bc1', amount: 1250, reason: 'Cleanup after the rough-in', photo: null, sentOn: '2026-10-01', answerBy: '2026-10-06', status: 'open' }

function stateWith(charges: BackCharge[], today: string, over: { draws?: Draw[]; closedOn?: string | null; lostOn?: string | null } = {}): GcState {
  const s = initialGcState()
  const base = s.projects[0]
  if (!base) throw new Error('no project in the test data')
  const pkg: TradePackage = {
    id: 'drywall',
    trade: 'Drywall',
    scope: [],
    budget: 0,
    bidTab: null,
    selfPerform: null,
    invites: [{ id: 'i1', partnerId: 'p1', status: 'bid', invitedOn: '2026-09-01', seenRev: 0, bid: null }],
    carried: 'i1',
    awardedInviteId: 'i1',
    sow: { price: 48000, retainagePct: 10, basedOnRev: 0, signedOn: '2026-09-20', sov: [], draws: over.draws ?? [], status: 'signed', backCharges: charges },
  }
  return { ...s, today, partners: [partner], projects: [{ ...base, name: 'Fair Oaks Shops', closedOn: over.closedOn ?? null, lostOn: over.lostOn ?? null, packages: [pkg] }] }
}

describe('back-charges waiting on the office (P4b-iii)', () => {
  it('leaves an open charge before its answer day to the company', () => {
    const state = stateWith([charge], '2026-10-04')
    expect(backChargesWaiting(state)).toEqual([])
    expect(gcBackChargesNeedsYou(state)).toBeNull()
  })

  it('lists a dispute from the day it came, to keep or drop', () => {
    const state = stateWith([{ ...charge, status: 'disputed', answer: { on: '2026-10-02', note: 'We swept before we left.' } }], '2026-10-05')
    const [w] = backChargesWaiting(state)
    expect([w?.why, w?.waited, w?.company]).toEqual(['disputed', 3, 'Iron Horse Drywall'])
    expect(gcBackChargesNeedsYou(state)).toEqual({
      count: 1,
      late: false,
      title: '1 back-charge to settle in GC mode',
      detail: 'Iron Horse Drywall disputed $1,250 on Fair Oaks Shops. Keep it or drop it with a reason.',
      projectId: state.projects[0]!.id,
      chargeId: 'bc1',
    })
  })

  it('lists a charge never answered from its answer day', () => {
    const [w] = backChargesWaiting(stateWith([charge], '2026-10-09'))
    expect([w?.why, w?.waited]).toEqual(['noAnswer', 3])
    expect(w && backChargeShort(w)).toBe('Iron Horse Drywall never answered $1,250 on Fair Oaks Shops')
  })

  it('lists an agreed charge only once an approved draw can take it, from the later of the two days', () => {
    const agreed: BackCharge = { ...charge, status: 'agreed', answer: { on: '2026-10-02', note: '' } }
    expect(backChargesWaiting(stateWith([agreed], '2026-10-08'))).toEqual([])
    const state = stateWith([agreed], '2026-10-08', { draws: [approved] })
    const [w] = backChargesWaiting(state)
    expect([w?.why, w?.drawNumber, w?.waited]).toEqual(['take', 2, 2])
    expect(gcBackChargesNeedsYou(state)?.detail).toBe('$1,250 from Iron Horse Drywall can come off draw 2 on Fair Oaks Shops. Take it off the draw before the draw is paid.')
  })

  it(`reads late past ${BACK_CHARGE_LATE_DAYS} days`, () => {
    const disputed: BackCharge = { ...charge, status: 'disputed', answer: { on: '2026-10-02', note: 'No.' } }
    expect(gcBackChargesNeedsYou(stateWith([disputed], '2026-10-09'))?.late).toBe(false)
    expect(gcBackChargesNeedsYou(stateWith([disputed], '2026-10-10'))?.late).toBe(true)
  })

  it('leaves out a job that is closed or lost', () => {
    expect(backChargesWaiting(stateWith([charge], '2026-10-09', { closedOn: '2026-10-08' }))).toEqual([])
    expect(backChargesWaiting(stateWith([charge], '2026-10-09', { lostOn: '2026-10-08' }))).toEqual([])
  })
})
