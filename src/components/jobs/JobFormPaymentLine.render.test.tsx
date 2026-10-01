// @vitest-environment jsdom
/**
 * Render tests for one payment line (v2.4293): the words a bank, Stripe and
 * hand-typed row get, and which doors each one's ⋯ menu holds — the check
 * date, Move to job…, Unlink and remove, Undo part payment, Check didn't
 * clear…, Pin it to this bill, Edit details, Remove.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { JobFormPaymentLine, type PaymentLineActions } from './JobFormPaymentLine'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { MercuryDepositFacts } from '../../lib/jobs/billsAndPayments'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'p1',
    amount: 11700,
    paid_on: '2026-09-14',
    sent_on: null,
    note: null,
    payment_type: null,
    reference_number: null,
    invoice_id: 'inv-a',
    mercury_transaction_id: null,
    ...overrides,
  }
}

const billA = { id: 'inv-a', status: 'billed', amount: 26800, sent_to_customer_at: '2026-07-15T12:00:00Z' } as unknown as JobsLedgerInvoiceRow
const stripeBill = { id: 'inv-s', status: 'billed', amount: 1500, sent_to_customer_at: '2026-09-21T12:00:00Z', stripe_invoice_id: 'in_1', external_send_channel: 'stripe' } as unknown as JobsLedgerInvoiceRow
const job = (invoices: JobsLedgerInvoiceRow[]) => ({ id: 'job1', invoices }) as unknown as JobWithDetails
const bank: MercuryDepositFacts = { postedYmd: '2026-09-14', counterparty: 'Loberg Contracting', kind: 'checkDeposit', status: 'sent', failureReason: null }

function actions(over: Partial<PaymentLineActions> = {}): PaymentLineActions {
  return {
    updatePaymentRow: vi.fn(),
    requestRemovePaymentRow: vi.fn(),
    requestMovePaymentRow: vi.fn(),
    setUnlinkMercuryConfirmRowId: vi.fn(),
    setBillViewInvoice: vi.fn(),
    requestUndoPartPayment: vi.fn(),
    requestCheckDidNotClear: vi.fn(),
    ...over,
  }
}

function renderLine(row: PaymentRow, opts: { bill?: JobsLedgerInvoiceRow | null; job?: JobWithDetails | null; bankFacts?: Record<string, MercuryDepositFacts>; persisted?: boolean; actions?: PaymentLineActions } = {}) {
  const acts = opts.actions ?? actions()
  const r = renderWithProviders(
    <JobFormPaymentLine
      row={row}
      bill={opts.bill ?? billA}
      job={opts.job ?? job([billA])}
      bankFacts={opts.bankFacts ?? {}}
      persisted={opts.persisted ?? true}
      unlinking={false}
      actions={acts}
    />,
  )
  return { ...r, acts }
}

function openMenu(amountText: string) {
  fireEvent.click(screen.getByLabelText(`More for the ${amountText} payment`))
  return screen.getByRole('menu')
}

describe('JobFormPaymentLine — a bank deposit', () => {
  it('reads amount · date · check from the payer · days after the bill, and its menu holds the bank date, the check date, Move and Unlink', () => {
    const row = paymentRow({ mercury_transaction_id: 'mt1', payment_type: 'checkDeposit', reference_number: '4ed0c1d2-0000-4000-8000-0000000003c1' })
    const { acts } = renderLine(row, { bankFacts: { mt1: bank } })
    const line = screen.getByTestId('payment-line')
    expect(line.getAttribute('data-source')).toBe('bank')
    expect(within(line).getByLabelText('Payment amount 11,700.00 dollars').textContent).toBe('$11,700.00')
    expect(within(line).getByText(/Sep 14 · check from Loberg Contracting/)).toBeTruthy()
    expect(within(line).getByText('· 61 d')).toBeTruthy()
    expect(line.textContent).not.toContain('4ed')
    expect(within(line).queryByLabelText('Payment amount')).toBeNull()
    const menu = openMenu('$11,700.00')
    expect(menu.textContent).toContain('Use the bank date as the check date')
    expect(menu.textContent).toContain('Add the check date')
    // A sent bill counted it: Move waits on the unlink.
    const move = within(menu).getByRole('menuitem', { name: /Move to job…/ }) as HTMLButtonElement
    expect(move.disabled).toBe(true)
    expect(move.getAttribute('title')).toBe('A sent bill counted it — unlink it from the $26,800 bill first')
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Use the bank date/ }))
    expect(acts.updatePaymentRow).toHaveBeenCalledWith('p1', { sent_on: '2026-09-14' })
    fireEvent.click(screen.getByLabelText('More for the $11,700.00 payment'))
    fireEvent.click(within(screen.getByRole('menu')).getByLabelText('Unlink bank deposit and remove this payment line'))
    expect(acts.setUnlinkMercuryConfirmRowId).toHaveBeenCalledWith('p1')
  })

  it('a deposit the bank returned wears the red chip and shows Unlink and remove in the open', () => {
    const row = paymentRow({ mercury_transaction_id: 'mt1' })
    renderLine(row, { bankFacts: { mt1: { ...bank, status: 'failed', failureReason: 'Insufficient funds' } } })
    expect(screen.getByTestId('edit-job-payment-bank-returned-p1').textContent).toBe('Returned by the bank · Insufficient funds')
    expect(screen.getByRole('button', { name: 'Unlink bank deposit and remove this payment line' })).toBeTruthy()
  })

  it('Add the check date opens one box, and a picked date is handed over as the Sent date', () => {
    const row = paymentRow({ mercury_transaction_id: 'mt1' })
    const { acts } = renderLine(row, { bankFacts: { mt1: bank } })
    fireEvent.click(within(openMenu('$11,700.00')).getByRole('menuitemcheckbox', { name: /Add the check date/ }))
    const sent = screen.getByLabelText('Payment sent date') as HTMLInputElement
    fireEvent.change(sent, { target: { value: '2026-09-10' } })
    expect(acts.updatePaymentRow).toHaveBeenCalledWith('p1', { sent_on: '2026-09-10' })
    expect(screen.queryByLabelText('Payment amount')).toBeNull()
  })
})

describe('JobFormPaymentLine — a Stripe row', () => {
  it('a card payment is locked, says Stripe wrote it, and offers the Stripe bill; no Undo on a plain row', () => {
    const row = paymentRow({ id: 'p-stripe', amount: 1500, invoice_id: 'inv-s', note: 'Stripe' })
    const { acts } = renderLine(row, { bill: stripeBill, job: job([stripeBill]) })
    expect(screen.getByLabelText('Payment amount 1,500.00 dollars')).toBeTruthy()
    expect(screen.queryByLabelText('Payment amount')).toBeNull()
    expect(screen.getByText(/card through Stripe/)).toBeTruthy()
    expect(screen.getByText('Stripe wrote this row')).toBeTruthy()
    const menu = openMenu('$1,500.00')
    expect(menu.textContent).not.toContain('Undo part payment')
    expect(menu.textContent).not.toContain('Edit details')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'View the Stripe bill' }))
    expect(acts.setBillViewInvoice).toHaveBeenCalled()
  })

  it('a part payment on an open Stripe bill offers Undo part payment; a paid bill does not', () => {
    const row = paymentRow({ id: 'p-part', amount: 1000, invoice_id: 'inv-s', stripe_credit_note_id: 'cn_1', payment_type: 'check' })
    const { acts, unmount } = renderLine(row, { bill: stripeBill, job: job([stripeBill]) })
    expect(screen.getByText(/check recorded in Stripe/)).toBeTruthy()
    fireEvent.click(within(openMenu('$1,000.00')).getByRole('menuitem', { name: /Undo part payment/ }))
    expect(acts.requestUndoPartPayment).toHaveBeenCalledWith(row)
    unmount()
    const paid = { ...stripeBill, status: 'paid' } as JobsLedgerInvoiceRow
    renderLine(row, { bill: paid, job: job([paid]) })
    expect(openMenu('$1,000.00').textContent).not.toContain('Undo part payment')
  })

  it('a Stripe-held check on a Paid bill offers Check didn’t clear…, a Billed bill does not', () => {
    const row = paymentRow({ id: 'p-check', amount: 1500, invoice_id: 'inv-s', payment_type: 'Check' })
    const paid = { ...stripeBill, status: 'paid', stripe_invoice_status: 'paid' } as unknown as JobsLedgerInvoiceRow
    const { acts, unmount } = renderLine(row, { bill: paid, job: job([paid]) })
    fireEvent.click(within(openMenu('$1,500.00')).getByRole('menuitem', { name: "Check didn't clear…" }))
    expect(acts.requestCheckDidNotClear).toHaveBeenCalledWith(row)
    unmount()
    const billed = { ...stripeBill, status: 'billed', stripe_invoice_status: 'paid' } as unknown as JobsLedgerInvoiceRow
    renderLine(row, { bill: billed, job: job([billed]) })
    expect(openMenu('$1,500.00').textContent).not.toContain("Check didn't clear…")
  })
})

describe('JobFormPaymentLine — a hand-typed row', () => {
  it('reads its check number and memo, warns when it came before the bill, and Edit details opens the boxes', () => {
    const row = paymentRow({ amount: 1800, paid_on: '2026-07-02', payment_type: 'Check', reference_number: '1017', note: 'deposit for the rough-in' })
    const { acts } = renderLine(row)
    expect(screen.getByText(/Jul 2 · check · typed by hand/)).toBeTruthy()
    expect(screen.getByText('check 1017 · deposit for the rough-in')).toBeTruthy()
    expect(screen.getByText(/Received 13 d before the bill went out/)).toBeTruthy()
    const menu = openMenu('$1,800.00')
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Edit details/ }))
    expect(screen.getByLabelText('Payment amount')).toBeTruthy()
    expect(screen.getByLabelText('Payment date')).toBeTruthy()
    expect(screen.getByLabelText('Payment reference')).toBeTruthy()
    const select = screen.getByLabelText('Apply this payment to a specific invoice') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['', 'inv-a'])
    fireEvent.change(screen.getByLabelText('Payment memo'), { target: { value: 'rough-in' } })
    expect(acts.updatePaymentRow).toHaveBeenCalledWith('p1', { note: 'rough-in' })
    // A row a bill holds is removed through the RPC confirm, so Remove stays live.
    fireEvent.click(screen.getByLabelText('More for the $1,800.00 payment'))
    fireEvent.click(within(screen.getByRole('menu')).getByLabelText('Remove payment row'))
    expect(acts.requestRemovePaymentRow).toHaveBeenCalledWith(row)
  })

  it('a draft opens its boxes at once and offers no Move', () => {
    renderLine(paymentRow({ id: 'draft', amount: 100, invoice_id: null }), { bill: null, persisted: false })
    expect(screen.getByLabelText('Payment amount')).toBeTruthy()
    expect(openMenu('$100.00').textContent).not.toContain('Move to job…')
  })

  it('a saved row the oldest bill counts wears "no bill picked" and Pin it to this bill pins it', () => {
    const row = paymentRow({ amount: 500, invoice_id: null, paid_on: '2026-09-22' })
    const { acts } = renderLine(row)
    expect(screen.getByText('no bill picked')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pin it to this bill' }))
    expect(acts.updatePaymentRow).toHaveBeenCalledWith('p1', { invoice_id: 'inv-a' })
    const menu = openMenu('$500.00')
    const move = within(menu).getByRole('menuitem', { name: /Move to job…/ }) as HTMLButtonElement
    expect(move.disabled).toBe(false)
    fireEvent.click(move)
    expect(acts.requestMovePaymentRow).toHaveBeenCalledWith(row)
  })
})
