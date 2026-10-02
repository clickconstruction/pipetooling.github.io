// @vitest-environment jsdom
/**
 * Render smoke for the close-out wiring in BankPaymentsModal (v2.3529; v2.4363 Close out books
 * it): an untouched deposit whose memo says "refund" shows the strip with Vendor refund pressed;
 * the books line reads how Banking books it (`ar_deposit_booking`); pressing the button asks
 * once, and confirming calls `close_out_ar_deposit` with the reason and the label. Before the
 * migration is pushed the read fails and the strip closes out the old way
 * (`set_mercury_transaction_ar_closed`). A fully applied deposit shows no strip. The rules and
 * words live in arCloseOut.ts and arCloseBooking.ts.
 *
 * Waiting rule (v2.3551): the modal seeds the suggested reason in an EFFECT, so the strip
 * paints once with no reason before the pre-pick lands, and the booking read lands after that.
 * Every test goes through `openWithSuggestedReason()`, which waits for a pressed reason AND for
 * the footer to stop reading Banking. Asserting straight after the strip appeared is the race
 * that made this file flaky.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'

const calls = vi.hoisted(() => ({
  rpc: [] as Array<{ fn: string; args: unknown }>,
  /** 'pending' = a Ferguson rule match waits; 'missing' = ar_deposit_booking is not pushed yet. */
  booking: 'pending' as 'pending' | 'missing' | 'remembered',
}))

const COGS = { id: 'l-cogs', name: 'Cost of Goods Sold', default_key: 'cogs_part_iii', account_type: 'expense' }
const EQUITY = { id: 'l-eq', name: 'Owners Equity', default_key: null, account_type: 'equity' }
const LABELS = [COGS, { id: 'l-inc', name: 'Income', default_key: 'income_part_i', account_type: 'income' }, EQUITY]

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
    if (fn === 'ar_deposit_booking') {
      if (calls.booking === 'missing') {
        return Promise.resolve({ data: null, error: { message: 'Could not find the function public.ar_deposit_booking', code: 'PGRST202' } })
      }
      return Promise.resolve({
        data: {
          label: null,
          label_by: null,
          label_at: null,
          rule_name: null,
          pending:
            calls.booking === 'pending'
              ? { suggestion_id: 's-ferguson', rule_name: 'Ferguson - Cost of Goods Sold', label: COGS }
              : null,
          usual: null,
          last_close_out:
            calls.booking === 'remembered'
              ? { reason: 'owner_deposit', closed_at: '2026-09-02T15:00:00Z', posted_at: '2026-09-01T15:00:00Z', amount: 500 }
              : null,
          labels: LABELS,
        },
        error: null,
      })
    }
    if (fn === 'close_out_ar_deposit') {
      calls.rpc.push({ fn, args: rest[0] })
      return Promise.resolve({ data: { ok: true, closed: true, booked: 'approved', label_name: 'Cost of Goods Sold' }, error: null })
    }
    return baseRpc(fn, ...rest)
  }
  stub.from = (table: string, ...rest: unknown[]) => {
    if (table === 'mercury_transaction_ar_closed') return fixed({ data: [], error: null })
    if (table === 'app_settings') return fixed({ data: null, error: null })
    if (table === 'mercury_transaction_drag_sort_assignments') {
      // maybeSingle (the selected deposit's label) reads none; the list's .in() read finds the
      // Ferguson row labelled as an expense, so its row says so.
      const one = fixed({ data: null, error: null })
      const many = fixed({
        data: [{ mercury_transaction_id: 'mtx-ferguson', mercury_drag_sort_labels: { name: 'Cost of Goods Sold', account_type: 'expense' } }],
        error: null,
      })
      one.in = () => many
      return one
    }
    if (table === 'mercury_transaction_ar_income_labels') return fixed({ data: null, error: null })
    return baseFrom(table, ...rest)
  }
  return { supabase: stub }
})

function pressedReason(): string | null {
  const group = screen.getByRole('group', { name: "Why this deposit is not a customer's payment" })
  const on = group.querySelector('button[aria-pressed="true"]')
  return on ? on.getAttribute('data-testid')?.replace('ar-close-out-reason-', '') ?? null : null
}

/**
 * Render, wait for the strip, for the seeding effect to press the suggested reason, and for the
 * booking read to land (the footer stops reading Banking). Returns the strip.
 */
async function openWithSuggestedReason(): Promise<HTMLElement> {
  const { loaded: strip } = await renderSettled(
    <BankPaymentsModal open onClose={() => {}} authUserId="smoke-auth-user-1" authRole="assistant" billedRows={[]} onApplied={() => {}} />,
    {
      loaded: async () => {
        const el = await screen.findByTestId('ar-close-out')
        await waitFor(() => expect(pressedReason()).not.toBeNull())
        await waitFor(() => expect(screen.getByTestId('ar-close-out-footer').textContent).not.toContain('Reading how Banking'))
        return el
      },
    },
  )
  return strip
}

describe('BankPaymentsModal · close out with a reason (render smoke)', () => {
  it('an untouched refund deposit: Vendor refund pressed, the rule match is read back, asks once, then closes out and books it', async () => {
    calls.rpc.length = 0
    calls.booking = 'pending'
    const strip = await openWithSuggestedReason()
    expect(strip.textContent).toContain('Not a customer’s payment?')
    expect(pressedReason()).toBe('vendor_refund')
    expect(screen.getByTestId('ar-apply-sentence').textContent).toBe('Remaining $312.48 — pick a bill, link a recorded payment, or close it out with a reason.')

    const books = screen.getByTestId('ar-close-out-books')
    expect(books.getAttribute('data-state')).toBe('approve')
    expect(books.textContent).toContain('Your rule Ferguson says Cost of Goods Sold.')
    expect(books.textContent).toContain('Close out approves it, the same as Approve in Banking.')
    expect(screen.getByTestId('ar-close-out-parts').textContent).toContain('Supply houses')
    expect(screen.getByTestId('ar-close-out-footer').textContent).toBe('Takes $312.48 off To match as a vendor refund. Banking books it as Cost of Goods Sold.')
    expect(screen.getByTestId('ar-deposit-booked-note').textContent).toBe('Banking books it as Cost of Goods Sold')

    fireEvent.click(screen.getByTestId('ar-close-out-request'))
    expect(screen.getByTestId('ar-close-out').textContent).toContain('Close out $312.48 as a vendor refund?')
    expect(screen.getByTestId('ar-close-out-confirm-body').textContent).toBe('It leaves To match for everyone. Banking books it as Cost of Goods Sold. You can reopen it from All.')

    fireEvent.click(screen.getByTestId('ar-close-out-confirm'))
    await waitFor(() => {
      expect(calls.rpc).toEqual([
        {
          fn: 'close_out_ar_deposit',
          args: { p_mercury_transaction_id: 'mtx-ferguson', p_reason: 'vendor_refund', p_note: undefined, p_label_id: 'l-cogs' },
        },
      ])
    })
  })

  it('Change opens the picker, and another label goes with the close-out', async () => {
    calls.rpc.length = 0
    calls.booking = 'pending'
    await openWithSuggestedReason()
    fireEvent.click(screen.getByTestId('ar-close-out-change'))
    fireEvent.change(screen.getByLabelText('Banking label'), { target: { value: 'l-inc' } })
    expect(screen.getByTestId('ar-close-out-books').getAttribute('data-state')).toBe('set')
    expect(screen.getByTestId('ar-close-out-footer').textContent).toBe('Takes $312.48 off To match as a vendor refund. Banking books it as Income.')
    expect(screen.getByTestId('ar-close-out-books').textContent).toContain('A vendor refund goes under the expense it pays back.')
    fireEvent.click(screen.getByTestId('ar-close-out-request'))
    fireEvent.click(screen.getByTestId('ar-close-out-confirm'))
    await waitFor(() => {
      expect(calls.rpc[0]?.args).toMatchObject({ p_label_id: 'l-inc' })
    })
  })

  it('Something else needs a note before the button is live', async () => {
    calls.booking = 'pending'
    await openWithSuggestedReason()
    fireEvent.click(screen.getByTestId('ar-close-out-reason-other'))
    expect((screen.getByTestId('ar-close-out-request') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What it is'), { target: { value: 'Insurance payout' } })
    expect((screen.getByTestId('ar-close-out-request') as HTMLButtonElement).disabled).toBe(false)
  })

  it('the payee’s last close-out picks the reason and says so', async () => {
    calls.booking = 'remembered'
    await openWithSuggestedReason()
    await waitFor(() => expect(pressedReason()).toBe('owner_deposit'))
    expect(screen.getByTestId('ar-close-out-remembered').textContent).toBe('Ferguson Enterprises’s Sep 1 deposit was an owner deposit.')
    expect(screen.getByTestId('ar-close-out-footer').textContent).toBe('Takes $312.48 off To match as an owner deposit. Banking books it as Owners Equity.')
  })

  it('before the migration is pushed: no books line, and it closes out the old way', async () => {
    calls.rpc.length = 0
    calls.booking = 'missing'
    await openWithSuggestedReason()
    expect(screen.queryByTestId('ar-close-out-books')).toBeNull()
    expect(screen.getByTestId('ar-close-out-footer').textContent).toBe('Takes $312.48 off To match as a vendor refund. Banking is not changed.')
    fireEvent.click(screen.getByTestId('ar-close-out-request'))
    fireEvent.click(screen.getByTestId('ar-close-out-confirm'))
    await waitFor(() => {
      expect(calls.rpc).toEqual([
        { fn: 'set_mercury_transaction_ar_closed', args: { p_mercury_transaction_id: 'mtx-ferguson', p_reason: 'vendor_refund', p_note: undefined } },
      ])
    })
  })

  it('a fully applied deposit shows no strip', async () => {
    calls.booking = 'pending'
    await openWithSuggestedReason()
    fireEvent.click(screen.getByRole('button', { name: /1,855\.70 from Elaine Giesber/ }))
    await waitFor(() => {
      expect(screen.queryByTestId('ar-close-out')).toBeNull()
    })
  })
})
