// @vitest-environment jsdom
/**
 * Render smoke for v2.4333 (punch list #76): Bill Customer says when the payer's checks came
 * back this past year, by the one who-pays rule, and says nothing for anyone else.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderSettled, renderWithProviders } from '../../test/renderSmokeMocks'
import { BillCustomerReturnedChecksLine } from './BillCustomerReturnedChecksLine'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseRpc = stub.rpc as (...args: unknown[]) => unknown
  const thisYear = `${new Date().getFullYear()}-04-13T15:00:00Z`
  const row = (tx: string) => ({ mercury_transaction_id: tx, came_back_at: thisYear, job_id: 'job-440', job_customer_id: 'cust-poolcorp', job_gc_customer_id: null, job_bill_to_party: 'customer', invoice_bill_to_party: null, invoice_bill_to_email: null })
  stub.rpc = (fn: string, ...rest: unknown[]) => {
    if (fn === 'list_ar_returned_check_payers') return Promise.resolve({ data: [row('a'), row('b')], error: null })
    return baseRpc(fn, ...rest)
  }
  return { supabase: stub }
})

describe('BillCustomerReturnedChecksLine', () => {
  it('the payer with two returns this year reads them, with the faster ways to pay', async () => {
    const { loaded } = await renderSettled(<BillCustomerReturnedChecksLine payerCustomerId="cust-poolcorp" />, { loaded: () => screen.findByTestId('bill-customer-returned-checks') })
    expect(loaded.textContent).toBe('2 checks came back · Apr. A card or a bank transfer clears faster.')
  })
  it('another payer, or none, shows nothing', async () => {
    const { container } = renderWithProviders(<BillCustomerReturnedChecksLine payerCustomerId="someone-else" />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.textContent).toBe('')
    const none = renderWithProviders(<BillCustomerReturnedChecksLine payerCustomerId={null} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(none.container.textContent).toBe('')
  })
})
