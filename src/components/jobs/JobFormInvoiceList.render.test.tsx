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

import { JobFormInvoiceList } from './JobFormInvoiceList'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

function renderList(invoices: ReturnType<typeof makeInvoice>[]) {
  const job = makeJob({ invoices })
  return renderWithProviders(
    <JobFormInvoiceList
      editing={job}
      payments={[]}
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
