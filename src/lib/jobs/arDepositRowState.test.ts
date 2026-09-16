import { describe, expect, it } from 'vitest'
import { arDepositRowStateLabel, arDepositRowStates, arDepositSummary, arDepositSummaryWords } from './arDepositRowState'
import type { ArExactMatchSweep } from './arExactMatchSweep'

const dep = (id: string, remaining: number, over: Partial<{ returned: boolean; closed: boolean; counterparty_name: string | null; note: string | null; external_memo: string | null }> = {}) => ({
  mercury_transaction_id: id,
  remaining_available: remaining,
  returned: false,
  counterparty_name: null,
  note: null,
  external_memo: null,
  ...over,
})

const targets = [
  { key: 'inv-992', customerName: 'Done Right Foundation', gcName: '', remaining: 250 },
  { key: 'inv-868', customerName: 'Done Right Foundation', gcName: '', remaining: 2650 },
  { key: 'inv-40', customerName: 'Weiss Services LLC', gcName: '', remaining: 1625 },
]

const noSweep: ArExactMatchSweep = { pairs: [], skipped: [], totalCents: 0 }

describe('arDepositRowStates', () => {
  it('names one state per row from the sweep, the recorded payments, the payer read and the balance', () => {
    const sweep: ArExactMatchSweep = {
      pairs: [{ depositId: 'd-weiss', targetKey: 'inv-40', amountCents: 162500 }],
      skipped: [{ amountCents: 25000, depositCount: 2, targetCount: 3 }],
      totalCents: 162500,
    }
    const states = arDepositRowStates({
      deposits: [
        dep('d-weiss', 1625, { counterparty_name: 'WEISS SERVICES LLC' }),
        dep('d-drf', 250, { counterparty_name: 'DRF' }),
        dep('d-elaine', 1855.7, { counterparty_name: 'Elaine Giesber' }),
        dep('d-done', 0, { counterparty_name: 'Anyone' }),
        dep('d-back', 400, { returned: true }),
        dep('d-payer', 900, { external_memo: 'Done Right Foundation repair' }),
        dep('d-hand', 77.5, { counterparty_name: 'Unknown Check' }),
      ],
      sweep,
      targets,
      recordedPayments: [{ amount: 1855.7 }],
    })
    expect(Object.fromEntries(states)).toEqual({
      'd-weiss': 'exact',
      'd-drf': 'ambiguous',
      'd-elaine': 'recorded',
      'd-done': 'applied',
      'd-back': 'returned',
      'd-payer': 'payer',
      'd-hand': 'hand',
    })
  })

  it('an exact sweep match outranks a same-amount recorded payment; returned outranks everything', () => {
    const sweep: ArExactMatchSweep = { pairs: [{ depositId: 'd1', targetKey: 'inv-40', amountCents: 162500 }], skipped: [], totalCents: 162500 }
    const states = arDepositRowStates({
      deposits: [dep('d1', 1625), dep('d2', 1625, { returned: true })],
      sweep,
      targets,
      recordedPayments: [{ amount: 1625 }],
    })
    expect(states.get('d1')).toBe('exact')
    expect(states.get('d2')).toBe('returned')
  })

  it('with no billed lines loaded, a live deposit is simply by hand', () => {
    const states = arDepositRowStates({ deposits: [dep('d1', 10, { counterparty_name: 'DRF' })], sweep: noSweep, targets: [], recordedPayments: [] })
    expect(states.get('d1')).toBe('hand')
  })
})

describe('arDepositRowStateLabel', () => {
  it('wears a chip for every state but by-hand', () => {
    expect(arDepositRowStateLabel('exact')).toEqual({ text: '1 exact match', tone: 'green' })
    expect(arDepositRowStateLabel('recorded')).toEqual({ text: 'probably recorded', tone: 'amber' })
    expect(arDepositRowStateLabel('ambiguous')?.tone).toBe('amber')
    expect(arDepositRowStateLabel('payer')).toEqual({ text: 'payer known', tone: 'blue' })
    expect(arDepositRowStateLabel('returned')?.tone).toBe('red')
    expect(arDepositRowStateLabel('applied')?.tone).toBe('muted')
    expect(arDepositRowStateLabel('hand')).toBeNull()
  })
})

describe('arDepositSummary', () => {
  it('counts deposits still carrying balance and sums their cents, skipping returned and applied ones', () => {
    const s = arDepositSummary([dep('a', 1855.7), dep('b', 250), dep('c', 0), dep('d', 99, { returned: true }), { remaining_available: '4091.50' }])
    expect(s).toEqual({ toMatch: 3, unappliedCents: 619720 })
    expect(arDepositSummaryWords(s)).toEqual({ count: '3 deposits', money: '$6,197.20' })
    expect(arDepositSummaryWords({ toMatch: 1, unappliedCents: 100 })).toEqual({ count: '1 deposit', money: '$1.00' })
    expect(arDepositSummaryWords({ toMatch: 0, unappliedCents: 0 })).toBeNull()
  })
})

describe('closed-out deposits (v2.3529)', () => {
  it('a close-out row wears its own chip, outranked only by returned', () => {
    const states = arDepositRowStates({
      deposits: [dep('d-refund', 312.48, { closed: true }), dep('d-both', 10, { closed: true, returned: true })],
      sweep: noSweep,
      targets,
      recordedPayments: [],
    })
    expect(states.get('d-refund')).toBe('closed')
    expect(states.get('d-both')).toBe('returned')
    expect(arDepositRowStateLabel('closed')).toEqual({ text: 'closed out', tone: 'muted' })
  })
})
