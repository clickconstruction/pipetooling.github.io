// @vitest-environment jsdom
/**
 * Render smoke for the close-out wiring in BankPaymentsModal (v2.3529): an untouched
 * deposit whose memo says "refund" shows the strip with Vendor refund pre-picked; pressing
 * the button asks once, and confirming calls `set_mercury_transaction_ar_closed` with the
 * reason. A fully applied deposit shows no strip. The rule and words live in arCloseOut.ts.
 *
 * Waiting rule (v2.3551): the modal seeds the suggested reason in an EFFECT, so the strip
 * paints once with an empty select before the pre-pick lands. `findByTestId('ar-close-out')`
 * only proves the strip exists — every test here must go through `openWithSuggestedReason()`,
 * which also waits for the select to hold a reason. Asserting on the select (or changing it)
 * straight after the strip appeared is the race that made this file flaky.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'

const calls = vi.hoisted(() => ({ rpc: [] as Array<{ fn: string; args: unknown }> }))

const DEPOSITS = [
  {
    mercury_transaction_id: 'mtx-ferguson',
    amount: 312.48,
    counterparty_name: 'Ferguson Enterprises',
    note: null,
    external_memo: 'REFUND INV 8842710 RETURN',
    posted_at: '2026-09-14T15:00:00Z',
    kind: 'externalTransfer',
    mercury_account_id: 'acct-1',
    raw: {},
    mercury_id: 'm-1',
    consumed: 0,
    remaining_available: 312.48,
    returned: false,
  },
  {
    mercury_transaction_id: 'mtx-applied',
    amount: 1855.7,
    counterparty_name: 'Elaine Giesber',
    note: null,
    external_memo: null,
    posted_at: '2026-09-11T15:00:00Z',
    kind: 'checkDeposit',
    mercury_account_id: 'acct-1',
    raw: {},
    mercury_id: 'm-2',
    consumed: 1855.7,
    remaining_available: 0,
    returned: false,
  },
]

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseRpc = stub.rpc as (...args: unknown[]) => unknown
  const baseFrom = stub.from as (...args: unknown[]) => unknown
  const fixed = (result: { data: unknown; error: null }) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'neq', 'is']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve(result)
    b.single = () => Promise.resolve(result)
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
    return b
  }
  stub.rpc = (fn: string, ...rest: unknown[]) => {
    if (fn === 'list_mercury_transactions_for_bank_payments') return Promise.resolve({ data: DEPOSITS, error: null })
    if (fn === 'list_ar_allocations_for_mercury_transaction') return Promise.resolve({ data: [], error: null })
    if (fn === 'set_mercury_transaction_ar_closed') {
      calls.rpc.push({ fn, args: rest[0] })
      return Promise.resolve({ data: { ok: true, closed: true }, error: null })
    }
    return baseRpc(fn, ...rest)
  }
  stub.from = (table: string, ...rest: unknown[]) => {
    if (table === 'mercury_transaction_ar_closed') return fixed({ data: [], error: null })
    if (table === 'app_settings') return fixed({ data: null, error: null })
    if (table === 'mercury_transaction_drag_sort_assignments') return fixed({ data: null, error: null })
    if (table === 'mercury_transaction_ar_income_labels') return fixed({ data: null, error: null })
    return baseFrom(table, ...rest)
  }
  return { supabase: stub }
})

function reasonSelect(): HTMLSelectElement {
  return screen.getByLabelText("Why this deposit is not a customer's payment") as HTMLSelectElement
}

/**
 * Render, wait for the strip, and wait for the seeding effect to put the suggested reason in
 * the select. Returns the strip. Without the second wait the assertions below can read the
 * one render where the strip exists and the reason is still empty.
 */
async function openWithSuggestedReason(): Promise<HTMLElement> {
  const { loaded: strip } = await renderSettled(
    <BankPaymentsModal open onClose={() => {}} authUserId="smoke-auth-user-1" authRole="assistant" billedRows={[]} onApplied={() => {}} />,
    {
      loaded: async () => {
        const el = await screen.findByTestId('ar-close-out')
        await waitFor(() => expect(reasonSelect().value).not.toBe(''))
        return el
      },
    },
  )
  return strip
}

describe('BankPaymentsModal · close out with a reason (render smoke)', () => {
  it('an untouched refund deposit: the strip shows with the reason pre-picked, asks once, then writes the reason', async () => {
    calls.rpc.length = 0
    const strip = await openWithSuggestedReason()
    expect(strip.textContent).toContain('Not a customer’s payment?')
    expect(reasonSelect().value).toBe('vendor_refund')
    expect(screen.getByTestId('ar-apply-sentence').textContent).toBe('Remaining $312.48 — pick a bill, link a recorded payment, or close it out with a reason.')

    fireEvent.click(screen.getByTestId('ar-close-out-request'))
    expect(screen.getByTestId('ar-close-out').textContent).toContain('Close out this deposit as Vendor refund?')

    fireEvent.click(screen.getByTestId('ar-close-out-confirm'))
    await waitFor(() => {
      expect(calls.rpc).toEqual([
        { fn: 'set_mercury_transaction_ar_closed', args: { p_mercury_transaction_id: 'mtx-ferguson', p_reason: 'vendor_refund', p_note: undefined } },
      ])
    })
  })

  it('Something else needs a note before the button is live', async () => {
    await openWithSuggestedReason()
    fireEvent.change(reasonSelect(), { target: { value: 'other' } })
    expect((screen.getByTestId('ar-close-out-request') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What it is'), { target: { value: 'Insurance payout' } })
    expect((screen.getByTestId('ar-close-out-request') as HTMLButtonElement).disabled).toBe(false)
  })

  it('a fully applied deposit shows no strip', async () => {
    await openWithSuggestedReason()
    fireEvent.click(screen.getByRole('button', { name: /1,855\.70 from Elaine Giesber/ }))
    await waitFor(() => {
      expect(screen.queryByTestId('ar-close-out')).toBeNull()
    })
  })
})
