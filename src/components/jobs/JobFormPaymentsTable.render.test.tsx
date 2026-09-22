// @vitest-environment jsdom
/**
 * Render tests for the ③ Payments received add-affordance placement: the add
 * (+) control lives centered BELOW the table (never inline in a row's action
 * cluster next to the trash icon), appearing while manual entry is open; when
 * it is closed, the centered "+ Record a cash or check payment" pill is
 * the single add affordance instead.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { JobFormPaymentsTable } from './JobFormPaymentsTable'
import type { PaymentRow } from '../../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'p1',
    amount: 3000,
    paid_on: '2026-02-26',
    sent_on: null,
    note: null,
    payment_type: null,
    reference_number: null,
    invoice_id: null,
    mercury_transaction_id: null,
    ...overrides,
  }
}

const moveRequests: string[] = []

const handoffs: Array<{ invoiceId: string; amount: number; draftRowId: string }> = []

function renderTable(
  payments: PaymentRow[],
  addPaymentRow: () => void = () => {},
  editing: JobWithDetails | null = null,
  updatePaymentRow: (id: string, updates: Partial<PaymentRow>) => void = () => {},
) {
  return renderWithProviders(
    <JobFormPaymentsTable
      editing={editing}
      payments={payments}
      persistedLedgerPaymentIds={new Set(payments.map((p) => p.id))}
      unlinkingMercuryPaymentId={null}
      updatePaymentRow={updatePaymentRow}
      addPaymentRow={addPaymentRow}
      requestRemovePaymentRow={() => {}}
      requestMovePaymentRow={(row) => moveRequests.push(row.id)}
      setUnlinkMercuryConfirmRowId={() => {}}
      setBillViewInvoice={() => {}}
      onRecordPaymentOnBill={(inv, o) => handoffs.push({ invoiceId: inv.id, amount: o.amount, draftRowId: o.draftRowId })}
    />,
  )
}

/** Job 1022's shape: one open bill, and it went out through Stripe. */
function jobWithOneStripeBill(): JobWithDetails {
  return {
    id: 'job1022',
    invoices: [
      { id: 'inv-s', status: 'billed', amount: 1500, sent_to_customer_at: '2026-09-21T12:00:00Z', stripe_invoice_id: 'in_1', external_send_channel: 'stripe' },
    ],
  } as unknown as JobWithDetails
}

/** A job with two open bills — the ambiguous case every flagged payment sits on. */
function jobWithTwoBills(): JobWithDetails {
  return {
    id: 'job1',
    invoices: [
      { id: 'inv-a', status: 'billed', amount: 4720, sent_to_customer_at: '2026-08-27T12:00:00Z' },
      { id: 'inv-b', status: 'billed', amount: 9440, sent_to_customer_at: '2026-07-06T12:00:00Z' },
    ],
  } as unknown as JobWithDetails
}

describe('JobFormPaymentsTable add-affordance placement', () => {
  it('shows the record-payment pill (and no + button) while manual entry is closed', () => {
    renderTable([paymentRow()])
    expect(screen.getByText('+ Record a cash or check payment')).toBeTruthy()
    expect(screen.queryByLabelText('Add payment line')).toBeNull()
    // The saved row keeps its pencil + trash cluster.
    expect(screen.getByLabelText('Toggle payment details')).toBeTruthy()
    expect(screen.getByLabelText('Remove payment row')).toBeTruthy()
  })

  it('opening manual entry swaps the pill for a centered + below the table', () => {
    const add = vi.fn()
    renderTable([paymentRow()], add)
    fireEvent.click(screen.getByText('+ Record a cash or check payment'))
    expect(add).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('+ Record a cash or check payment')).toBeNull()
    const plus = screen.getByLabelText('Add payment line')
    // The + must sit below the table, never inside a row's action cluster.
    expect(plus.closest('table')).toBeNull()
    fireEvent.click(plus)
    expect(add).toHaveBeenCalledTimes(2)
  })
})

describe('JobFormPaymentsTable bill-apply chips (v2.2570)', () => {
  it('one unapplied payment: inline chips with the amount match first, one tap applies', () => {
    const update = vi.fn()
    renderTable([paymentRow({ amount: 9440 })], () => {}, jobWithTwoBills(), update)
    expect(screen.getByText(/Which bill does this \$9,440\.00 pay/)).toBeTruthy()
    const chips = screen.getAllByTitle(/Apply this payment to the/)
    // Match ($9,440 bill) sorts before the older non-match.
    expect(chips[0]?.textContent).toContain('9,440.00 bill')
    expect(chips[0]?.textContent).toContain('matches this payment')
    fireEvent.click(chips[0]!)
    expect(update).toHaveBeenCalledWith('p1', { invoice_id: 'inv-b' })
    // Deliberate-unassigned stays available and collapses to the compact chip.
    fireEvent.click(screen.getByText('Keep as job payment'))
    expect(screen.getByText('⚠ Not applied — pick bill')).toBeTruthy()
  })

  it('two unapplied payments: the match bar carries the explanation and opens the panel', () => {
    renderTable(
      [paymentRow({ id: 'p1', amount: 9440 }), paymentRow({ id: 'p2', amount: 9440, paid_on: '2026-03-12' })],
      () => {},
      jobWithTwoBills(),
    )
    expect(screen.getByText(/2 payments aren’t applied to a bill/)).toBeTruthy()
    // Rows shrink to compact chips; no inline chip lists yet.
    expect(screen.getAllByText('⚠ Not applied — pick bill')).toHaveLength(2)
    expect(screen.queryByTitle(/Apply this payment to the/)).toBeNull()
    fireEvent.click(screen.getByText('Match payments…'))
    // Panel: one chip pair per payment, with live remaining balances.
    expect(screen.getAllByTitle(/Apply this payment to the/)).toHaveLength(4)
    expect(screen.getAllByText(/received Feb 26, 2026/).length).toBeGreaterThan(0)
  })

  it('no bar and no chips when payments are applied or the job has no open bills', () => {
    renderTable([paymentRow({ invoice_id: 'inv-a', amount: 4720 })], () => {}, jobWithTwoBills())
    expect(screen.queryByText(/aren’t applied to a bill/)).toBeNull()
    expect(screen.queryByTitle(/Apply this payment to the/)).toBeNull()
    // Applied rows summarize what they pay.
    expect(screen.getByText(/✓ pays the \$4,720\.00 bill · sent Aug 27, 2026/)).toBeTruthy()
  })
})

describe('JobFormPaymentsTable — cash on a Stripe bill (v2.3692)', () => {
  it('a real unlinked row on a Stripe-only job gets the hand-off note, not a bill chip, and stays editable', () => {
    handoffs.length = 0
    renderTable([paymentRow({ id: 'draft', amount: 1500, invoice_id: null })], () => {}, jobWithOneStripeBill())
    // No chip and no "which bill" flag — the Stripe bill is not a hand-typed target.
    expect(screen.queryByTitle(/Apply this payment to the/)).toBeNull()
    expect(screen.queryByText(/Which bill does this/)).toBeNull()
    expect(screen.getByText(/The \$1,500\.00 bill went out through Stripe/)).toBeTruthy()
    // The amount box is still a box: the row did not lock.
    expect(screen.getByLabelText('Payment amount')).toBeTruthy()
    expect(screen.getByLabelText('Remove payment row')).toBeTruthy()
    fireEvent.click(screen.getByText('Record on the $1,500.00 bill →'))
    expect(handoffs).toEqual([{ invoiceId: 'inv-s', amount: 1500, draftRowId: 'draft' }])
  })

  it('Applies to never lists a Stripe bill; with nothing else open the selector is not shown', () => {
    renderTable([paymentRow({ id: 'draft', amount: 1500, invoice_id: null })], () => {}, jobWithOneStripeBill())
    // The draft is unsaved in spirit but rendered with details open by the toggle.
    fireEvent.click(screen.getByLabelText('Toggle payment details'))
    expect(screen.queryByLabelText('Apply this payment to a specific invoice')).toBeNull()
  })

  it('a mixed job keeps the plain bill as a chip and still offers the Stripe hand-off', () => {
    handoffs.length = 0
    const mixed = {
      id: 'jobmix',
      invoices: [
        ...jobWithOneStripeBill().invoices,
        { id: 'inv-plain', status: 'billed', amount: 400, sent_to_customer_at: '2026-09-01T12:00:00Z' },
      ],
    } as unknown as JobWithDetails
    renderTable([paymentRow({ id: 'draft', amount: 400, invoice_id: null })], () => {}, mixed)
    const chips = screen.getAllByTitle(/Apply this payment to the/)
    expect(chips).toHaveLength(1)
    expect(chips[0]?.textContent).toContain('400.00 bill')
    expect(screen.getByText('Record on the $1,500.00 bill →')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Toggle payment details'))
    const select = screen.getByLabelText('Apply this payment to a specific invoice') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['', 'inv-plain'])
  })

  it('a row already on the Stripe bill keeps its lock (Stripe wrote it)', () => {
    renderTable([paymentRow({ id: 'p-stripe', amount: 1500, invoice_id: 'inv-s' })], () => {}, jobWithOneStripeBill())
    expect(screen.queryByLabelText('Payment amount')).toBeNull()
    expect(screen.getByLabelText('Payment amount 1,500.00 dollars')).toBeTruthy()
    expect(screen.queryByText(/went out through Stripe/)).toBeNull()
  })
})

describe('JobFormPaymentsTable — Move to job… (v2.3576)', () => {
  it('a saved manual row offers Move to job… and reports; an unsaved draft does not', () => {
    moveRequests.length = 0
    const { unmount } = renderTable([paymentRow({ id: 'p1', amount: 2400 })], () => {}, jobWithTwoBills())
    const move = screen.getByText('Move to job…') as HTMLButtonElement
    expect(move.disabled).toBe(false)
    fireEvent.click(move)
    expect(moveRequests).toEqual(['p1'])
    unmount()
    renderWithProviders(
      <JobFormPaymentsTable
        editing={jobWithTwoBills()}
        payments={[paymentRow({ id: 'draft-1', amount: 100 })]}
        persistedLedgerPaymentIds={new Set()}
        unlinkingMercuryPaymentId={null}
        updatePaymentRow={() => {}}
        addPaymentRow={() => {}}
        requestRemovePaymentRow={() => {}}
        requestMovePaymentRow={() => {}}
        setUnlinkMercuryConfirmRowId={() => {}}
        setBillViewInvoice={() => {}}
      />,
    )
    expect(screen.queryByText('Move to job…')).toBeNull()
  })

  it('a payment a sent bill counted keeps Move to job… but disabled, saying to unlink first', () => {
    renderTable([paymentRow({ id: 'p2', amount: 4720, invoice_id: 'inv-a' })], () => {}, jobWithTwoBills())
    const move = screen.getByText('Move to job…') as HTMLButtonElement
    expect(move.disabled).toBe(true)
    expect(move.getAttribute('title')).toBe('A sent bill counted it — unlink it from the $4,720 bill first')
  })
})
