// @vitest-environment jsdom
/**
 * Render-smoke tests for the Edit-Job Invoices list (v2.3478 row grammar):
 * every bill is chip · amount · actions / who / money; the rare and
 * destructive actions (delete draft, send back, who else sees it) sit under
 * the row's ⋯ menu; paid bills stay in the list; the sum line adds up.
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
// The expected-pay math is the Stages card's; here we pin one late model so the
// money line can be asserted without the two RPCs.
vi.mock('../../hooks/useJobBilledExpectedPay', () => ({
  useJobBilledExpectedPay: () => (inv: { billed_at: string | null }) =>
    inv.billed_at
      ? { expectedYmd: '2026-08-25', state: 'late', source: 'customer', medianDays: 21, daysLate: 21, label: '', title: '' }
      : null,
}))

import { JobFormInvoiceList } from './JobFormInvoiceList'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

type Payment = { id: string; amount: number; paid_on: string | null; sent_on: string | null; note: string | null; payment_type: string | null; reference_number: string | null; invoice_id: string | null; mercury_transaction_id: string | null }

const payment = (invoice_id: string | null, amount: number, paid_on: string | null = null): Payment => ({
  id: `pay-${invoice_id}-${amount}`,
  amount,
  paid_on,
  sent_on: null,
  note: null,
  payment_type: null,
  reference_number: null,
  invoice_id,
  mercury_transaction_id: null,
})

function renderList(job: ReturnType<typeof makeJob>, payments: Payment[] = []) {
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

function openMenu(row: HTMLElement) {
  fireEvent.click(within(row).getByTestId('invoice-row-menu'))
  return screen.getByRole('menu')
}

describe('JobFormInvoiceList row grammar (v2.3478)', () => {
  it('an open bill reads chip · amount, then who, then money with the expected-pay detail', () => {
    renderList(
      makeJob({
        customer_name: 'Maria Delgado',
        invoices: [makeInvoice({ id: 'inv-open', status: 'billed', amount: 9800, is_primary_rtb_bundle: false, sent_to_customer_at: '2026-09-04T15:00:00Z', billed_at: '2026-09-04T15:00:00Z' })],
      }),
    )
    const row = screen.getByTestId('invoice-row')
    expect(row.getAttribute('data-state')).toBe('open')
    expect(within(row).getByText('Billed')).toBeTruthy()
    expect(within(row).getByText('$9,800.00')).toBeTruthy()
    expect(within(row).getByText('sent Sep 4 to Maria Delgado')).toBeTruthy()
    expect(within(row).getByText('$9,800 open')).toBeTruthy()
    expect(within(row).getByText('21 d past expected')).toBeTruthy()
  })

  it('paid bills stay in the list, muted, with how long they took; the sum line adds up to the tiles', () => {
    renderList(
      makeJob({
        customer_name: 'Maria Delgado',
        invoices: [
          makeInvoice({ id: 'inv-paid', status: 'paid', amount: 8000, is_primary_rtb_bundle: false, sent_to_customer_at: '2026-08-12T15:00:00Z', billed_at: '2026-08-12T15:00:00Z' }),
          makeInvoice({ id: 'inv-open', status: 'billed', amount: 9800, is_primary_rtb_bundle: false, sent_to_customer_at: '2026-09-04T15:00:00Z', billed_at: '2026-09-04T15:00:00Z' }),
        ],
      }),
      [payment('inv-paid', 8000, '2026-08-26')],
    )
    const rows = screen.getAllByTestId('invoice-row')
    // open before paid
    expect(rows.map((r) => r.getAttribute('data-state'))).toEqual(['open', 'paid'])
    const paid = rows[1]!
    expect(within(paid).getByText('Paid')).toBeTruthy()
    expect(within(paid).getByText('$8,000 paid')).toBeTruthy()
    expect(within(paid).getByText('Aug 26 · 14 days')).toBeTruthy()
    // a paid row offers no chase cluster and no send-back
    expect(within(paid).queryByRole('group', { name: 'Payment link' })).toBeNull()
    const menu = openMenu(paid)
    expect(within(menu).queryByText(/Send back/)).toBeNull()
    expect(within(menu).getByText('See in Pipeline')).toBeTruthy()
    const sum = screen.getByTestId('invoice-sum')
    expect(sum.textContent).toBe('paid $8,000.00open $9,800.00= billed $17,800.00')
  })

  it('an open Stripe bill shows the labeled chase cluster with Email dimmed when the job has no email', () => {
    renderList(
      makeJob({
        customer_email: null,
        invoices: [makeInvoice({ id: 'inv-open', status: 'billed', amount: 500, is_primary_rtb_bundle: false, stripe_invoice_id: 'in_1', hosted_invoice_url: 'https://pay.example/x' })],
      }),
    )
    const cluster = screen.getByRole('group', { name: 'Payment link' })
    const buttons = within(cluster).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Text', 'Copy link', 'Email'])
    expect(buttons[2]!.getAttribute('aria-disabled')).toBe('true')
    expect(buttons[2]!.title).toMatch(/No customer email on the job/)
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy()
  })

  it('a draft reads not sent · to bill and offers Send bill…; the auto remainder is named and cannot be deleted', () => {
    renderList(
      makeJob({
        customer_name: 'Maria Delgado',
        invoices: [
          makeInvoice({ id: 'inv-bundle', status: 'ready_to_bill', amount: 900, is_primary_rtb_bundle: true }),
          makeInvoice({ id: 'inv-draft', status: 'ready_to_bill', amount: 400, is_primary_rtb_bundle: false }),
        ],
      }),
    )
    const rows = screen.getAllByTestId('invoice-row')
    const bundle = rows.find((r) => within(r).queryByText('$900.00'))!
    expect(within(bundle).getByText('not sent · bills Maria Delgado')).toBeTruthy()
    expect(within(bundle).getByText(/auto remainder/)).toBeTruthy()
    expect(within(bundle).getByText('$900 to bill')).toBeTruthy()
    expect(within(bundle).getByRole('button', { name: 'Send bill…' })).toBeTruthy()
    let menu = openMenu(bundle)
    expect(within(menu).queryByText('Delete draft')).toBeNull()
    fireEvent.mouseDown(document.body)
    const draft = rows.find((r) => within(r).queryByText('$400.00'))!
    menu = openMenu(draft)
    fireEvent.click(within(menu).getByText('Delete draft'))
    const dialog = screen.getByRole('dialog', { name: 'Delete draft invoice' })
    expect(within(dialog).getByText(/\$400\.00/)).toBeTruthy()
    fireEvent.click(within(dialog).getByText('Cancel'))
    expect(screen.queryByText('Delete draft invoice?')).toBeNull()
  })
})

describe('JobFormInvoiceList billed send-back (v2.1653, under ⋯)', () => {
  it('offers Send back on an unpaid billed row and the confirm requires the acknowledgment', () => {
    renderList(makeJob({ invoices: [makeInvoice({ id: 'inv-billed', status: 'billed', amount: 8900, is_primary_rtb_bundle: false })] }))
    const menu = openMenu(screen.getByTestId('invoice-row'))
    const btn = within(menu).getByRole('menuitem', { name: /Send back/ })
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

  it('disables Send back when a payment short of the amount references the invoice, and never offers it on drafts', () => {
    renderList(
      makeJob({
        invoices: [
          makeInvoice({ id: 'inv-part', status: 'billed', amount: 6220, is_primary_rtb_bundle: false }),
          makeInvoice({ id: 'inv-draft', status: 'ready_to_bill', amount: 2680, is_primary_rtb_bundle: true }),
        ],
      }),
      [payment('inv-part', 6000)],
    )
    const rows = screen.getAllByTestId('invoice-row')
    const draft = rows.find((r) => r.getAttribute('data-state') === 'draft')!
    let menu = openMenu(draft)
    expect(within(menu).queryByText(/Send back/)).toBeNull()
    fireEvent.mouseDown(document.body)
    const part = rows.find((r) => r.getAttribute('data-state') === 'open')!
    // never in practice — but a short payment reads as such, not as a fourth state
    expect(within(part).getByText('$220 open')).toBeTruthy()
    expect(within(part).getByText(/\$220 short/)).toBeTruthy()
    menu = openMenu(part)
    const btn = within(menu).getByRole('menuitem', { name: /Send back/ })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect((btn as HTMLButtonElement).title).toMatch(/Payments are applied/)
  })

  it('share this bill (v2.3376): the who line names who else sees a stamped bill, and ⋯ offers the other party or only the payer', () => {
    renderList(
      makeJob({
        customer_id: 'cust-1',
        customer_name: 'Maria Delgado',
        gc_customer_id: 'gc-1',
        gcCustomer: { id: 'gc-1', name: 'Done Right Foundation' },
        bill_to_party: 'customer',
        invoices: [
          makeInvoice({ id: 'inv-shared', status: 'billed', amount: 6420, is_primary_rtb_bundle: true, shown_to_party: 'gc' }),
          makeInvoice({ id: 'inv-quiet', status: 'billed', amount: 1180, is_primary_rtb_bundle: false, shown_to_party: null }),
        ],
      }),
    )
    const chips = screen.getAllByTestId('invoice-shown-to-chip')
    expect(chips.map((c) => c.textContent)).toEqual([' · 👁 shown to Done Right Foundation'])
    const shared = screen.getAllByTestId('invoice-row').find((r) => within(r).queryByText('$6,420.00'))!
    const menu = openMenu(shared)
    expect(within(menu).getByText('✓ Shown on Done Right Foundation’s statement')).toBeTruthy()
    expect(within(menu).getByText('Only the payer')).toBeTruthy()
    // A customer-pays job never offers the customer as the "other" party.
    expect(within(menu).queryByText(/Maria Delgado/)).toBeNull()
  })
})
