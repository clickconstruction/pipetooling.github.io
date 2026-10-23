import { describe, expect, it, vi } from 'vitest'
import { planAccountWriteDown, writeDownResultWords, type AccountBill, type AccountBillShare } from './accountWriteDown'
import { runAccountWriteDown } from './accountWriteDownRun'

const bill = (jobLabel: string, billed: number, stripeHosted = false): AccountBill => ({ jobId: `job-${jobLabel}`, jobLabel, invoiceId: `inv-${jobLabel}`, billed, billedOn: null, paid: 0, open: billed, stripeHosted })

describe('runAccountWriteDown', () => {
  it('sends each bill through its own door with its share and the note', async () => {
    const plan = planAccountWriteDown([bill('707', 500), bill('718', 250, true)], 300)
    const stripe = vi.fn(async (_s: AccountBillShare, _n: string): Promise<string | null> => null)
    const rpc = vi.fn(async (_s: AccountBillShare, _n: string): Promise<string | null> => null)
    const r = await runAccountWriteDown(plan.writes, 'Settled by phone', { stripe, rpc })
    expect(r).toEqual({ done: 2, held: [] })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0]?.[0]).toMatchObject({ jobLabel: '707', newTotal: 200 })
    expect(stripe.mock.calls[0]?.[0]).toMatchObject({ jobLabel: '718', newTotal: 100 })
    expect(stripe.mock.calls[0]?.[1]).toBe('Settled by phone')
  })

  it('does what is ready: a refusal or a throw holds that bill with the reason, the rest still go', async () => {
    const plan = planAccountWriteDown([bill('707', 500), bill('718', 250, true), bill('891', 100)], 0)
    const r = await runAccountWriteDown(plan.writes, 'note', {
      stripe: async () => 'Stripe refused it',
      rpc: async (s) => { if (s.jobLabel === '891') throw new Error('New total cannot be less than payments on this invoice'); return null },
    })
    expect(r.done).toBe(1)
    expect(r.held).toEqual([
      { jobLabel: '718', reason: 'Stripe refused it' },
      { jobLabel: '891', reason: 'New total cannot be less than payments on this invoice' },
    ])
    expect(writeDownResultWords(r.done, r.held)).toBe('Wrote down 1 bill. Held 2: job 718, Stripe refused it; job 891, New total cannot be less than payments on this invoice.')
  })
})
