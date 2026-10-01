// @vitest-environment jsdom
/**
 * Render tests for ③ — since v2.4288 the block for money on no bill. A payment
 * a bill counts is drawn under that bill in the Invoices block (see
 * JobFormInvoiceList.render.test.tsx and JobFormPaymentLine.render.test.tsx),
 * so what lives here is the entry flow, the rows still being typed, the
 * bill-apply chips for money the office has to place, and the Stripe hand-off.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { JobFormPaymentsTable } from './JobFormPaymentsTable'
import type { PaymentRow } from '../../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())
vi.mock('../../hooks/useJobPaymentTrace', () => ({ useJobPaymentTrace: () => ({ events: [], labelFor: () => null }) }))

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

const handoffs: Array<{ invoiceId: string; amount: number; draftRowId: string }> = []

function renderTable(
  payments: PaymentRow[],
  opts: {
    addPaymentRow?: () => void
    editing?: JobWithDetails | null
    updatePaymentRow?: (id: string, updates: Partial<PaymentRow>) => void
    /** Which rows are saved; default: all of them. */
    persisted?: Set<string>
  } = {},
) {
  return renderWithProviders(
    <JobFormPaymentsTable
      editing={opts.editing ?? null}
      payments={payments}
      persistedLedgerPaymentIds={opts.persisted ?? new Set(payments.map((p) => p.id))}
      unlinkingMercuryPaymentId={null}
      updatePaymentRow={opts.updatePaymentRow ?? (() => {})}
      addPaymentRow={opts.addPaymentRow ?? (() => {})}
      requestRemovePaymentRow={() => {}}
      requestMovePaymentRow={() => {}}
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

function openRowMenu(amountText: string) {
  fireEvent.click(screen.getByLabelText(`More for the ${amountText} payment`))
  return screen.getByRole('menu')
}

describe('JobFormPaymentsTable add-affordance placement', () => {
  it('shows the record-payment pill (and no + button) while manual entry is closed', () => {
    renderTable([paymentRow()])
    expect(screen.getByText('+ Record a cash or check payment')).toBeTruthy()
    expect(screen.queryByLabelText('Add payment line')).toBeNull()
    // The saved row is one line with its ⋯ menu; the boxes wait behind Edit details.
    expect(screen.getByLabelText('More for the $3,000.00 payment')).toBeTruthy()
    expect(screen.queryByLabelText('Payment amount')).toBeNull()
    expect(screen.getByText('③ Payments received')).toBeTruthy()
  })

  it('opening manual entry swaps the pill for a centered + below the list', () => {
    const add = vi.fn()
    renderTable([paymentRow()], { addPaymentRow: add })
    fireEvent.click(screen.getByText('+ Record a cash or check payment'))
    expect(add).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('+ Record a cash or check payment')).toBeNull()
    const plus = screen.getByLabelText('Add payment line')
    expect(plus.closest('[data-testid="payment-line"]')).toBeNull()
    fireEvent.click(plus)
    expect(add).toHaveBeenCalledTimes(2)
  })
})

describe('JobFormPaymentsTable — a payment a bill counts leaves ③ (v2.4288)', () => {
  it('a saved payment on a bill is not listed here; the block says where it went and takes the other heading', () => {
    renderTable([paymentRow({ invoice_id: 'inv-a', amount: 4720 })], { editing: jobWithTwoBills() })
    expect(screen.queryByTestId('payment-line')).toBeNull()
    expect(screen.getByTestId('payments-all-under-bills')).toBeTruthy()
    expect(screen.getByText('③ Other money on the job')).toBeTruthy()
    expect(screen.queryByText(/aren’t applied to a bill/)).toBeNull()
  })

  it('a saved payment with no bill picked that the oldest bill counts leaves ③ too; one no bill needs stays', () => {
    renderTable(
      [paymentRow({ id: 'placed', amount: 9440 }), paymentRow({ id: 'placed2', amount: 4720, paid_on: '2026-03-01' }), paymentRow({ id: 'extra', amount: 100, paid_on: '2026-03-12' })],
      { editing: jobWithTwoBills() },
    )
    const lines = screen.getAllByTestId('payment-line')
    expect(lines.map((l) => l.getAttribute('data-payment-id'))).toEqual(['extra'])
  })

  it('a row still being typed stays here whatever the rule would count it toward', () => {
    renderTable([paymentRow({ id: 'draft', amount: 9440 })], { editing: jobWithTwoBills(), persisted: new Set() })
    expect(screen.getByTestId('payment-line').getAttribute('data-payment-id')).toBe('draft')
    // A draft opens its boxes at once.
    expect(screen.getByLabelText('Payment amount')).toBeTruthy()
  })
})

describe('JobFormPaymentsTable — the check date (v2.4244, now behind Edit details)', () => {
  it('a date picked in the check-date box is handed to the form as the row’s Sent date, and clearing it as none', () => {
    const update = vi.fn()
    renderTable([paymentRow({ sent_on: '2026-02-20' })], { updatePaymentRow: update })
    const menu = openRowMenu('$3,000.00')
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Edit details/ }))
    const sent = screen.getByLabelText('Payment sent date') as HTMLInputElement
    expect(sent.value).toBe('2026-02-20')
    fireEvent.change(sent, { target: { value: '2026-02-24' } })
    expect(update).toHaveBeenLastCalledWith('p1', { sent_on: '2026-02-24' })
    fireEvent.change(sent, { target: { value: '' } })
    expect(update).toHaveBeenLastCalledWith('p1', { sent_on: null })
  })
})

describe('JobFormPaymentsTable bill-apply chips (v2.2570) — for money still being placed', () => {
  it('one unapplied draft: inline chips with the amount match first, one tap applies', () => {
    const update = vi.fn()
    renderTable([paymentRow({ amount: 9440 })], { editing: jobWithTwoBills(), updatePaymentRow: update, persisted: new Set() })
    expect(screen.getByText(/Which bill does this \$9,440\.00 pay/)).toBeTruthy()
    const chips = screen.getAllByTitle(/Apply this payment to the/)
    expect(chips[0]?.textContent).toContain('9,440.00 bill')
    expect(chips[0]?.textContent).toContain('matches this payment')
    fireEvent.click(chips[0]!)
    expect(update).toHaveBeenCalledWith('p1', { invoice_id: 'inv-b' })
    fireEvent.click(screen.getByText('Keep as job payment'))
    expect(screen.getByText('⚠ Not applied — pick bill')).toBeTruthy()
  })

  it('two unapplied drafts: the match bar carries the explanation and opens the panel', () => {
    renderTable(
      [paymentRow({ id: 'p1', amount: 9440 }), paymentRow({ id: 'p2', amount: 9440, paid_on: '2026-03-12' })],
      { editing: jobWithTwoBills(), persisted: new Set() },
    )
    expect(screen.getByText(/2 payments aren’t applied to a bill/)).toBeTruthy()
    expect(screen.getAllByText('⚠ Not applied — pick bill')).toHaveLength(2)
    expect(screen.queryByTitle(/Apply this payment to the/)).toBeNull()
    fireEvent.click(screen.getByText('Match payments…'))
    expect(screen.getAllByTitle(/Apply this payment to the/)).toHaveLength(4)
    expect(screen.getAllByText(/received Feb 26, 2026/).length).toBeGreaterThan(0)
  })
})

describe('JobFormPaymentsTable — cash on a Stripe bill (v2.3692)', () => {
  it('a real unlinked draft on a Stripe-only job gets the hand-off note, not a bill chip, and stays editable', () => {
    handoffs.length = 0
    renderTable([paymentRow({ id: 'draft', amount: 1500 })], { editing: jobWithOneStripeBill(), persisted: new Set() })
    expect(screen.queryByTitle(/Apply this payment to the/)).toBeNull()
    expect(screen.queryByText(/Which bill does this/)).toBeNull()
    expect(screen.getByText(/The \$1,500\.00 bill went out through Stripe/)).toBeTruthy()
    expect(screen.getByLabelText('Payment amount')).toBeTruthy()
    fireEvent.click(screen.getByText('Record on the $1,500.00 bill →'))
    expect(handoffs).toEqual([{ invoiceId: 'inv-s', amount: 1500, draftRowId: 'draft' }])
  })

  it('Pays never lists a Stripe bill; with nothing else open the selector is not shown', () => {
    renderTable([paymentRow({ id: 'draft', amount: 1500 })], { editing: jobWithOneStripeBill(), persisted: new Set() })
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
    renderTable([paymentRow({ id: 'draft', amount: 400 })], { editing: mixed, persisted: new Set() })
    const chips = screen.getAllByTitle(/Apply this payment to the/)
    expect(chips).toHaveLength(1)
    expect(chips[0]?.textContent).toContain('400.00 bill')
    expect(screen.getByText('Record on the $1,500.00 bill →')).toBeTruthy()
    const select = screen.getByLabelText('Apply this payment to a specific invoice') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['', 'inv-plain'])
  })
})

describe('JobFormPaymentsTable — Move to job… lives in the ⋯ menu (v2.3576)', () => {
  it('a saved row on no bill offers it; a draft does not', () => {
    const { unmount } = renderTable([paymentRow({ id: 'p1', amount: 2400 })])
    const menu = openRowMenu('$2,400.00')
    expect(menu.textContent).toContain('Move to job…')
    unmount()
    renderTable([paymentRow({ id: 'draft-1', amount: 100 })], { persisted: new Set() })
    const draftMenu = openRowMenu('$100.00')
    expect(draftMenu.textContent).not.toContain('Move to job…')
  })
})
