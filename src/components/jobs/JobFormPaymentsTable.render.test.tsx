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

function renderTable(payments: PaymentRow[], addPaymentRow: () => void = () => {}) {
  return renderWithProviders(
    <JobFormPaymentsTable
      editing={null}
      payments={payments}
      persistedLedgerPaymentIds={new Set(payments.map((p) => p.id))}
      unlinkingMercuryPaymentId={null}
      updatePaymentRow={() => {}}
      addPaymentRow={addPaymentRow}
      requestRemovePaymentRow={() => {}}
      setUnlinkMercuryConfirmRowId={() => {}}
      setBillViewInvoice={() => {}}
    />,
  )
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
