import { describe, expect, it } from 'vitest'
import { buildArExactMatchSweep, type SweepDepositSlice, type SweepTargetSlice } from './arExactMatchSweep'

const dep = (id: string, remaining: number | string, over: Partial<SweepDepositSlice> = {}): SweepDepositSlice => ({
  mercury_transaction_id: id,
  remaining_available: remaining,
  counterparty_name: 'ACME',
  posted_at: '2026-09-01T12:00:00Z',
  kind: 'checkDeposit',
  ...over,
})

const tgt = (key: string, remaining: number, stripeHosted = false): SweepTargetSlice => ({
  key,
  remaining,
  stripeHosted,
})

describe('buildArExactMatchSweep', () => {
  it('pairs a lone deposit with the lone bill of the same amount, largest first', () => {
    const sweep = buildArExactMatchSweep(
      [dep('d1', 1625), dep('d2', '2918.22')],
      [tgt('t-876', 1625), tgt('t-883', 2918.22), tgt('t-999', 250)],
    )
    expect(sweep.pairs).toEqual([
      { depositId: 'd2', targetKey: 't-883', amountCents: 291822 },
      { depositId: 'd1', targetKey: 't-876', amountCents: 162500 },
    ])
    expect(sweep.skipped).toEqual([])
    expect(sweep.totalCents).toBe(291822 + 162500)
  })

  it('skips amounts with several deposits or several bills — even matching counts', () => {
    const sweep = buildArExactMatchSweep(
      [dep('d1', 250), dep('d2', 250)],
      [tgt('a', 250), tgt('b', 250), tgt('c', 250)],
    )
    expect(sweep.pairs).toEqual([])
    expect(sweep.skipped).toEqual([{ amountCents: 25000, depositCount: 2, targetCount: 3 }])
  })

  it('ignores Stripe-hosted bills entirely (they keep the confirmation gate)', () => {
    const sweep = buildArExactMatchSweep([dep('d1', 555)], [tgt('t-s', 555, true)])
    expect(sweep.pairs).toEqual([])
    expect(sweep.skipped).toEqual([])
  })

  it('a Stripe twin does not make a non-Stripe bill ambiguous', () => {
    const sweep = buildArExactMatchSweep([dep('d1', 555)], [tgt('t-s', 555, true), tgt('t-n', 555)])
    expect(sweep.pairs).toEqual([{ depositId: 'd1', targetKey: 't-n', amountCents: 55500 }])
  })

  it('ignores returned deposits, zero remainders, and amounts with no counterpart', () => {
    const sweep = buildArExactMatchSweep(
      [dep('d-ret', 300, { returned: true }), dep('d-zero', 0), dep('d-lone', 42)],
      [tgt('t-300', 300), tgt('t-77', 77)],
    )
    expect(sweep.pairs).toEqual([])
    expect(sweep.skipped).toEqual([])
  })

  it('matches on cents exactly — a 1¢ difference is no pair', () => {
    const sweep = buildArExactMatchSweep([dep('d1', 100.01)], [tgt('t1', 100.02)])
    expect(sweep.pairs).toEqual([])
  })
})
