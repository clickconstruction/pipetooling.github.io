/**
 * Main's own tests for the dates a company gave us for things other than a quote (question 8; the
 * Board's B2-i): their words, the open one for the same thing, insurance to ask for, papers owed,
 * and the count Follow up chases, run through the kernels on the test data. The spike's own cases:
 * today Fri Oct 2, Voltage Brothers' and Pecan Valley Electric's insurance ran out Sep 15, and
 * Brightline Electric's statement of work on Helotes Dental Office waits on its signature.
 */
import { describe, expect, it } from 'vitest'
import { PROMISE_WHAT, insuranceRenewalWords, insuranceRenewals, openPromiseFor, paperAsks, promisePartner, promisesToChase, tradePromiseWords, tradePromisesOf } from './promises'
import { initialGcState } from './schedule/testState'
import type { GcState, TradePromise } from './types'

const PROMISES: TradePromise[] = [
  { id: 'tp-1', partnerId: 'voltage', kind: 'insurance', what: 'the renewed insurance certificate', by: '2026-10-06', madeOn: '2026-09-30', from: 'office' },
  { id: 'tp-2', partnerId: 'brightline', kind: 'sow', projectId: 'helotes', packageId: 'delec', what: 'the signed statement of work', by: '2026-09-30', madeOn: '2026-09-25', from: 'trade' },
]
const withPromises = (s: GcState): GcState => ({ ...s, tradePromises: PROMISES })

describe('promises other than a quote', () => {
  it('reads each in a sentence, and finds the open one for the same company, kind, job and trade', () => {
    const s = withPromises(initialGcState())
    expect(tradePromisesOf(initialGcState())).toEqual([])
    expect(PROMISES.map((p) => tradePromiseWords(p, s.today))).toEqual([
      'Promised the renewed insurance certificate by Tue Oct 6, in 4 days.',
      'Promised the signed statement of work by Wed Sep 30. That was 2 days ago.',
    ])
    expect(openPromiseFor(s, { partnerId: 'brightline', kind: 'sow', projectId: 'helotes', packageId: 'delec' })?.id).toBe('tp-2')
    expect(openPromiseFor(s, { partnerId: 'brightline', kind: 'sow' })).toBeUndefined()
    expect(promisePartner(s, PROMISES[0]!)?.company).toBe('Voltage Brothers')
    expect(PROMISE_WHAT.msa).toBe('the signed master agreement')
  })

  it('asks for insurance that ran out, with the day a company gave', () => {
    const s = withPromises(initialGcState())
    expect(insuranceRenewals(s).map((r) => [r.partner.id, r.days, r.promise?.id ?? null, insuranceRenewalWords(r)])).toEqual([
      ['voltage', -17, 'tp-1', 'Their insurance ran out Sep 15. Nothing they do for us is covered.'],
      ['pecanvalley', -17, null, 'Their insurance ran out Sep 15. Nothing they do for us is covered.'],
    ])
  })

  it('lists papers owed, with the day given, and counts what Follow up chases', () => {
    const s = withPromises(initialGcState())
    expect(paperAsks(s).map((a) => [a.kind, a.partner.id, a.projectId, a.promise?.id, a.words])).toEqual([
      ['sow', 'brightline', 'helotes', 'tp-2', 'The Electrical statement of work on Helotes Dental Office is waiting on their signature.'],
    ])
    expect([promisesToChase(initialGcState()), promisesToChase(s)]).toEqual([2, 2])
  })
})

describe('a certificate waiting for the office (P5b-2m, "Office looks first")', () => {
  it('leaves the insurance on Follow up while a certificate from the portal waits for a look', () => {
    const state = initialGcState()
    const before = insuranceRenewals(state).map((r) => r.partner.id)
    expect(before.length).toBeGreaterThan(0)
    const id = before[0]!
    const waiting: GcState = {
      ...state,
      partners: state.partners.map((p) => (p.id === id ? { ...p, coiReceived: { id: 'paper-1', sentOn: state.today, expires: '2027-10-01' } } : p)),
    }
    expect(insuranceRenewals(waiting).map((r) => r.partner.id)).toEqual(before)
  })
})
