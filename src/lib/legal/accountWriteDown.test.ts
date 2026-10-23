import { describe, expect, it } from 'vitest'
import { billRowWords, planAccountWriteDown, writeDownButtonWords, writeDownResultWords, type AccountBill } from './accountWriteDown'

const bill = (jobLabel: string, billed: number, paid = 0, stripeHosted = false): AccountBill => ({
  jobId: `job-${jobLabel}`,
  jobLabel,
  invoiceId: `inv-${jobLabel}`,
  billed,
  billedOn: null,
  paid,
  open: Math.max(0, billed - paid),
  stripeHosted,
})

const money = (n: number) => `$${n.toFixed(2)}`

describe('planAccountWriteDown', () => {
  it('splits what we accept in proportion to what each bill owes, to the cent', () => {
    const plan = planAccountWriteDown([bill('707', 7502), bill('717', 6799.82), bill('718', 1480)], 10000)
    expect(plan.open).toBe(15781.82)
    expect(plan.accept).toBe(10000)
    expect(plan.forgive).toBe(5781.82)
    expect(plan.shares.reduce((s, x) => s + Math.round(x.accept * 100), 0)).toBe(1_000_000)
    for (const s of plan.shares) expect(s.accept).toBeCloseTo((10000 * s.open) / 15781.82, 1)
    expect(plan.writes).toHaveLength(3)
  })

  it('sets each new total to what was paid plus its share', () => {
    const plan = planAccountWriteDown([bill('707', 1000, 400)], 300)
    expect(plan.shares[0]).toMatchObject({ open: 600, accept: 300, forgive: 300, newTotal: 700 })
  })

  it('writes nothing when we accept everything, and everything when we accept nothing', () => {
    expect(planAccountWriteDown([bill('707', 500), bill('718', 250)], 750).writes).toHaveLength(0)
    const all = planAccountWriteDown([bill('707', 500), bill('718', 250)], 0)
    expect(all.forgive).toBe(750)
    expect(all.shares.map((s) => s.newTotal)).toEqual([0, 0])
  })

  it('clamps to the open total and leaves paid bills out', () => {
    const plan = planAccountWriteDown([bill('707', 500, 500), bill('718', 250)], 9999)
    expect(plan.shares).toHaveLength(1)
    expect(plan.accept).toBe(250)
    expect(plan.writes).toHaveLength(0)
  })

  it('gives a leftover cent to the largest remainder', () => {
    const plan = planAccountWriteDown([bill('a', 1), bill('b', 1), bill('c', 1)], 1)
    expect(plan.shares.map((s) => s.accept).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(plan.shares.map((s) => Math.round(s.accept * 100)).sort()).toEqual([33, 33, 34])
  })
})

describe('the words', () => {
  it('says exactly what Save will do', () => {
    expect(writeDownButtonWords(planAccountWriteDown([bill('707', 500), bill('718', 250)], 500), money)).toBe('Write down $250.00 across 2 bills')
    expect(writeDownButtonWords(planAccountWriteDown([bill('707', 500)], 100), money)).toBe('Write down $400.00 across 1 bill')
    expect(writeDownButtonWords(planAccountWriteDown([bill('707', 500)], 500), money)).toBe('Nothing to write down')
  })

  it('names a bill by its job alone, or with its amount and day when the job has more than one', () => {
    expect(billRowWords(bill('891', 16780.4), 1, money)).toEqual({ job: '891', bill: null })
    expect(billRowWords({ ...bill('891', 16780.4), billedOn: '2026-04-13' }, 2, money)).toEqual({ job: '891', bill: '$16780.40 bill, 04/13/26' })
    expect(billRowWords(bill('891', 350), 2, money)).toEqual({ job: '891', bill: '$350.00 bill' })
  })

  it('lists what was held with the reason', () => {
    expect(writeDownResultWords(2, [])).toBe('Wrote down 2 bills.')
    expect(writeDownResultWords(1, [{ jobLabel: '718', reason: 'Stripe refused it' }])).toBe('Wrote down 1 bill. Held 1: job 718, Stripe refused it.')
  })
})
