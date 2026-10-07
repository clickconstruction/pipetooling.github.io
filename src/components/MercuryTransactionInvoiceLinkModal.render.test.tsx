// @vitest-environment jsdom
/**
 * Render smoke for v2.4566: an invoice ticked in Link invoices stays in view when the search
 * moves on, a second one joins it, the total says whether they add up to the charge, and both
 * are saved.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled } from '../test/renderSmokeMocks'
import MercuryTransactionInvoiceLinkModal from './MercuryTransactionInvoiceLinkModal'

const calls = vi.hoisted(() => ({ saved: [] as string[][] }))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseRpc = stub.rpc as (...args: unknown[]) => unknown
  const inv = (id: string, number: string, amount: number) => ({
    invoice_id: id, invoice_number: number, invoice_date: '2026-09-30', due_date: null, amount, is_paid: false,
    purchase_order_number: null, link: null, supply_house_id: 'sh1', supply_house_name: 'Home Depot',
    counterparty_match: true, already_linked: false, job_allocation_summary: 'JP1048 (100%)',
  })
  const all = [inv('i1', '88231', 412.1), inv('i2', '88240', 183.44)]
  stub.rpc = (fn: string, args?: Record<string, unknown>, ...rest: unknown[]) => {
    if (fn === 'list_supply_house_invoices_for_tally_link') {
      const q = String(args?.search_text ?? '')
      return Promise.resolve({ data: all.filter((r) => r.invoice_number.includes(q)), error: null })
    }
    if (fn === 'replace_mercury_transaction_invoice_links_as_staff') {
      calls.saved.push(args?.p_invoice_ids as string[])
      return Promise.resolve({ data: null, error: null })
    }
    return baseRpc(fn, args, ...rest)
  }
  return { supabase: stub }
})

const TX = { id: 'tx1', amount: -595.54, counterparty_name: 'The Home Depot' } as never

describe('MercuryTransactionInvoiceLinkModal', () => {
  it('keeps a ticked invoice above the search, totals the two, and saves both', async () => {
    const onSaved = vi.fn()
    await renderSettled(
      <MercuryTransactionInvoiceLinkModal open onClose={() => {}} transaction={TX} tallySelfService tallyActAsUserId="u1" onSaved={onSaved} />,
      { loaded: () => screen.findByText(/#88231/) },
    )
    fireEvent.click(screen.getAllByRole('checkbox')[0]!)
    expect(screen.getByTestId('invoice-link-total').textContent).toContain('$183.44 of the charge has no invoice yet')

    fireEvent.change(screen.getByLabelText('Search supply-house invoices'), { target: { value: '88240' } })
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2))
    // The first invoice no longer matches the search and is still on the page, chosen.
    expect(screen.getByTestId('invoice-link-chosen').textContent).toContain('#88231')
    fireEvent.click(screen.getAllByRole('checkbox')[1]!)

    expect(screen.getByTestId('invoice-link-total').textContent).toContain('The invoices add up to the charge')
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 invoices' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(calls.saved).toEqual([['i1', 'i2']])
  })
})
