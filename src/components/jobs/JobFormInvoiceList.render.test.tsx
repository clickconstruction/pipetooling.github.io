// @vitest-environment jsdom
/**
 * Render-smoke tests for the Edit-Job Invoices table's draft-delete ✕
 * (v2.1072): the red ✕ renders only on non-primary ready_to_bill rows, opens
 * the "Delete draft invoice?" confirm, and Cancel closes it without calling
 * the delete RPC.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { createRef } from 'react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { JobFormInvoiceList } from './JobFormInvoiceList'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

function renderList(
  invoices: ReturnType<typeof makeInvoice>[],
  payments: Array<{ id: string; amount: number; paid_on: string | null; sent_on: string | null; note: string | null; payment_type: string | null; reference_number: string | null; invoice_id: string | null; mercury_transaction_id: string | null }> = [],
) {
  const job = makeJob({ invoices })
  return renderWithProviders(
    <JobFormInvoiceList
      editing={job}
      payments={payments}
      canApplyAgreedWriteDown={false}
      onClose={() => {}}
      onSavedRef={createRef<(() => void) | undefined>()}
      setEditing={() => {}}
      setBillViewInvoice={() => {}}
      setAgreedWriteDownInvoice={() => {}}
      refreshEditingJobAndHydratePayments={() => {}}
      onInvoiceDeleted={() => {}}
      onEditBillTo={() => {}}
      nestedOverlayZIndex={1000}
    />,
  )
}

describe('JobFormInvoiceList draft-delete ✕', () => {
  it('shows the ✕ on a non-primary draft and opens/closes the confirm', () => {
    renderList([
      makeInvoice({ id: 'inv-1', status: 'ready_to_bill', amount: 400, is_primary_rtb_bundle: false }),
    ])
    const x = screen.getByLabelText(/Delete draft invoice/)
    fireEvent.click(x)
    const dialog = screen.getByRole('dialog', { name: 'Delete draft invoice' })
    expect(within(dialog).getByText('Delete draft invoice?')).toBeTruthy()
    expect(within(dialog).getByText(/\$400\.00/)).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Delete draft invoice?')).toBeNull()
  })

  it('hides the ✕ on the primary RTB bundle and on billed rows', () => {
    renderList([
      makeInvoice({ id: 'inv-bundle', status: 'ready_to_bill', amount: 900, is_primary_rtb_bundle: true }),
      makeInvoice({ id: 'inv-billed', status: 'billed', amount: 500, is_primary_rtb_bundle: false }),
    ])
    expect(screen.queryByLabelText(/Delete draft invoice/)).toBeNull()
  })
})

describe('JobFormInvoiceList billed send-back (v2.1653)', () => {
  const payment = (invoice_id: string | null, amount: number) => ({
    id: `pay-${invoice_id}-${amount}`,
    amount,
    paid_on: null,
    sent_on: null,
    note: null,
    payment_type: null,
    reference_number: null,
    invoice_id,
    mercury_transaction_id: null,
  })

  it('offers Send back on an unpaid billed row and the confirm requires the acknowledgment', () => {
    renderList([makeInvoice({ id: 'inv-billed', status: 'billed', amount: 8900, is_primary_rtb_bundle: false })])
    const btn = screen.getByRole('button', { name: 'Send back' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(btn)
    const dialog = screen.getByRole('dialog', { name: 'Send bill back' })
    expect(within(dialog).getByText(/\$8,900\.00/)).toBeTruthy()
    // Confirm stays dead until the acknowledgment is checked.
    const confirm = within(dialog).getByRole('button', { name: 'Send back' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(dialog).getByRole('checkbox'))
    expect((confirm as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(within(dialog).getByText('Cancel'))
    expect(screen.queryByRole('dialog', { name: 'Send bill back' })).toBeNull()
  })

  it('disables Send back when payments reference the invoice, and never offers it on drafts', () => {
    renderList(
      [
        makeInvoice({ id: 'inv-paid', status: 'billed', amount: 6220, is_primary_rtb_bundle: false }),
        makeInvoice({ id: 'inv-draft', status: 'ready_to_bill', amount: 2680, is_primary_rtb_bundle: true }),
      ],
      [payment('inv-paid', 6220)],
    )
    const buttons = screen.getAllByRole('button', { name: 'Send back' })
    expect(buttons.length).toBe(1)
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true)
    expect((buttons[0] as HTMLButtonElement).title).toMatch(/Payments are applied/)
  })
})
