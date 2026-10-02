// @vitest-environment jsdom
/**
 * Render smoke for Book it as Income (v2.4369): a deposit that paid a bill but that a Banking
 * rule labelled as an expense (the City of Seguin's $4,890 for #908, booked as Taxes and
 * Licenses) shows the words, the rule that did it and one button; pressing it calls
 * `ar_book_applied_deposit_income`, and once the label reads Income the box is gone. An
 * untouched deposit keeps the old quiet note. The words come from arBankLabel.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'

const scenario = vi.hoisted(() => ({
  label: { name: 'Taxes and Licenses', default_key: 'taxes_licenses' } as { name: string; default_key: string | null },
  rpc: [] as Array<{ fn: string; args: unknown }>,
}))

const DEPOSITS = [
  {
    mercury_transaction_id: 'mtx-seguin',
    amount: 4890,
    counterparty_name: 'City of Seguin',
    note: null,
    external_memo: null,
    posted_at: '2026-08-26T15:00:00Z',
    kind: 'other',
    returned: false,
    consumed: 4890,
    remaining_available: 0,
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
    if (fn === 'ar_deposit_booking') {
      return Promise.resolve({
        data: {
          label: { id: 'l-tax', name: scenario.label.name, default_key: scenario.label.default_key, account_type: 'expense' },
          label_by: 'rule',
          label_at: '2026-09-06T15:00:00Z',
          rule_name: 'City of Seguin - Taxes and Licenses',
          pending: null,
          usual: null,
          last_close_out: null,
          labels: [],
        },
        error: null,
      })
    }
    if (fn === 'ar_book_applied_deposit_income') {
      scenario.rpc.push({ fn, args: rest[0] })
      scenario.label = { name: 'Income', default_key: 'income_part_i' }
      return Promise.resolve({ data: { ok: true, booked: 'set', previous_label_name: 'Taxes and Licenses' }, error: null })
    }
    return baseRpc(fn, ...rest)
  }
  stub.from = (table: string, ...rest: unknown[]) => {
    if (table === 'app_settings') return fixed({ data: { value_text: 'true' }, error: null })
    if (table === 'mercury_transaction_ar_closed') return fixed({ data: [], error: null })
    if (table === 'mercury_transaction_drag_sort_assignments') {
      return fixed({ data: { label_id: 'l-tax', mercury_drag_sort_labels: scenario.label }, error: null })
    }
    if (table === 'mercury_transaction_ar_income_labels') return fixed({ data: null, error: null })
    return baseFrom(table, ...rest)
  }
  return { supabase: stub }
})

describe('BankPaymentsModal · Book it as Income (render smoke)', () => {
  it('a deposit that paid a bill under a rule’s expense label: the words, the rule, one press, then gone', async () => {
    renderWithProviders(
      <BankPaymentsModal open onClose={() => {}} authUserId="smoke-auth-user-1" authRole="assistant" billedRows={[]} onApplied={() => {}} />,
    )
    const box = await screen.findByTestId('ar-applied-income-fix')
    expect(box.textContent).toContain('Banking books it as Taxes and Licenses. It paid a bill, so it is income.')
    await waitFor(() => {
      expect(screen.getByTestId('ar-applied-income-fix').textContent).toContain(
        'Your rule City of Seguin labelled it. In Banking, that rule can be limited to money going out.',
      )
    })
    expect(screen.queryByTestId('ar-bank-label-note')).toBeNull()

    fireEvent.click(screen.getByTestId('ar-applied-income-fix-button'))
    await waitFor(() => {
      expect(scenario.rpc).toEqual([{ fn: 'ar_book_applied_deposit_income', args: { p_mercury_transaction_id: 'mtx-seguin' } }])
    })
    await waitFor(() => {
      expect(screen.queryByTestId('ar-applied-income-fix')).toBeNull()
    })
  })
})
