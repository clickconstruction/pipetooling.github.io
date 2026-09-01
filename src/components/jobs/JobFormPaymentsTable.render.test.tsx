// @vitest-environment jsdom
/**
 * Render tests for the ③ Payments received add-affordance placement: the add
 * (+) control lives centered BELOW the table (never inline in a row's action
 * cluster next to the trash icon), appearing while manual entry is open; when
 * it is closed, the centered "+ Record non-Stripe payment received" pill is
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
      setUnlinkMercuryConfirmRowId={() => {}}
      setBillViewInvoice={() => {}}
    />,
  )
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
    expect(screen.getByText('+ Record non-Stripe payment received')).toBeTruthy()
    expect(screen.queryByLabelText('Add payment line')).toBeNull()
    // The saved row keeps its pencil + trash cluster.
    expect(screen.getByLabelText('Toggle payment details')).toBeTruthy()
    expect(screen.getByLabelText('Remove payment row')).toBeTruthy()
  })

  it('opening manual entry swaps the pill for a centered + below the table', () => {
    const add = vi.fn()
    renderTable([paymentRow()], add)
    fireEvent.click(screen.getByText('+ Record non-Stripe payment received'))
    expect(add).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('+ Record non-Stripe payment received')).toBeNull()
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
