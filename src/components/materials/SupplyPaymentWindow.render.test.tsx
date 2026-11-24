// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SupplyPaymentWindow } from './SupplyPaymentWindow'
import type { SupplyPayment, SupplyPaymentLine } from '../../lib/materials/payments/supplyPayment'
import type { MoveBill, SupplyPaymentEvent } from '../../lib/materials/payments/supplyPaymentMove'
import { moneyText } from '../../test/moneyText'

// A made-up payment at a made-up house.
const payment: SupplyPayment = { id: 'p1', supply_house_id: 'h1', paid_on: '2026-11-12', amount: 5000, method: 'ach', method_ref: '88213', receipt_link: 'https://example.test/receipt', source: 'recorded', removed_at: null, created_by_name: 'Dana Whitfield' }
const lines: SupplyPaymentLine[] = [
  { id: 'l1', payment_id: 'p1', invoice_id: 'x', amount: 612.6 },
  { id: 'l2', payment_id: 'p1', invoice_id: 'y', amount: 2900 },
  { id: 'l3', payment_id: 'p1', invoice_id: 'z', amount: 300 },
  { id: 'l4', payment_id: 'p1', invoice_id: 'w', amount: 1000 },
]
const bills: MoveBill[] = [
  { id: 'x', invoice_number: 'S4390044', title: '214 · Hollis Street Clinic', amount: 612.6, is_paid: true, due_date: '2026-10-20' },
  { id: 'y', invoice_number: 'S4391877', title: '201 · Maple Lofts', amount: 2900, is_paid: true, due_date: '2026-10-25' },
  { id: 'z', invoice_number: 'S4402277', title: '201 · Maple Lofts', amount: 812.4, is_paid: false, due_date: '2026-10-31' },
  { id: 'w', invoice_number: 'S4393015', title: '188 · Juniper Ridge Bldg C', amount: 1000, is_paid: true, due_date: '2026-10-28' },
  { id: 'e', invoice_number: 'S4398120', title: '188 · Juniper Ridge Bldg C', amount: 1240, is_paid: false, due_date: '2026-10-15' },
]
const moved: SupplyPaymentEvent = { id: 'ev1', payment_id: 'p1', kind: 'moved', from_invoice_id: 'y', to_invoice_id: 'z', from_invoice_number: 'S4391877', to_invoice_number: 'S4402277', amount: 100, reason: 'wrong_bill', undoes_event_id: null, undone_by_event_id: null, actor_name: 'Dana Whitfield', created_at: '2026-11-14T18:00:00Z' }

const open = (over: Partial<Parameters<typeof SupplyPaymentWindow>[0]> = {}) => {
  const props = { onRemove: vi.fn(async () => {}), onMove: vi.fn(async () => {}), onUndoMove: vi.fn(async () => {}), onClose: vi.fn() }
  renderWithProviders(<SupplyPaymentWindow payment={payment} payments={[payment]} lines={lines} bills={bills} houseName="Pecan Supply" todayYmd="2026-11-16" {...props} {...over} />)
  return { ...props, ...over }
}

describe('SupplyPaymentWindow', () => {
  it('shows the payment, every bill it touched, and what waits on account', () => {
    open()
    expect(screen.getByRole('dialog', { name: '$5,000.00 to Pecan Supply' })).toBeTruthy()
    expect(screen.getByTestId('supply-payment-window-sub').textContent).toBe('11/12 · ACH 88213 · recorded by Dana Whitfield · Receipt ›')
    const rows = screen.getAllByTestId('supply-payment-window-line').map((r) => r.textContent)
    expect(rows).toEqual(['S4391877 · 201 · Maple Loftspaid in full$2,900.00Move…', 'S4393015 · 188 · Juniper Ridge Bldg Cpaid in full$1,000.00Move…', 'S4390044 · 214 · Hollis Street Clinicpaid in full$612.60Move…', 'S4402277 · 201 · Maple Loftspart payment · $512.40 left on the bill$300.00Move…'])
    expect(screen.getByTestId('supply-payment-window-account').textContent).toBe('On account with Pecan Supplynot on a bill yet$187.40Put on a bill…')
    expect(screen.getByText(moneyText('$4,812.60 is on bills and $187.40 is on account.'))).toBeTruthy()
    expect(screen.queryByTestId('supply-payment-window-history')).toBeNull()
  })

  it('moves a line to another bill, with a panel that says what changes first', async () => {
    const { onMove } = open()
    fireEvent.click(screen.getByRole('button', { name: /Move the \$1,000\.00 on S4393015/ }))
    expect(screen.getByRole('dialog', { name: 'Move this payment' })).toBeTruthy()
    expect(screen.getByTestId('supply-payment-move-sub').textContent).toBe('$1,000.00 of the 11/12 ACH 88213 · now on S4393015')
    // The oldest open bill first, then the other, then on account.
    expect(screen.getAllByRole('radio').map((r) => r.parentElement?.textContent)).toEqual(['S4398120 · 188 · Juniper Ridge Bldg C · $1,240.00 open', 'S4402277 · 201 · Maple Lofts · $512.40 open', 'On account, no bill'])
    const press = () => screen.getByRole('button', { name: /^Move/ })
    expect(press().hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('supply-payment-move-why').textContent).toBe('Pick the bill it goes to.')
    fireEvent.click(screen.getAllByRole('radio')[0] as HTMLElement)
    expect(screen.getByTestId('supply-payment-move-why').textContent).toBe('Say why it is moving.')
    fireEvent.click(screen.getByRole('button', { name: 'The house applied it differently' }))
    expect(screen.getByTestId('supply-payment-move-changes').textContent).toContain('S4393015 · paid $1,000.00 → $0.00 · open $0.00 → $1,000.00 · reads unpaid again')
    expect(screen.getByTestId('supply-payment-move-changes').textContent).toContain('S4398120 · paid $0.00 → $1,000.00 · open $1,240.00 → $240.00')
    expect(press().textContent).toBe('Move $1,000.00 to S4398120')
    fireEvent.click(press())
    await waitFor(() => expect(onMove).toHaveBeenCalledWith({ paymentId: 'p1', fromInvoiceId: 'w', toInvoiceId: 'e', amount: 1000, reason: 'house_applied' }))
    // Back on the payment once it is moved.
    expect(await screen.findByRole('dialog', { name: '$5,000.00 to Pecan Supply' })).toBeTruthy()
  })

  it('puts money on account on a bill, and refuses more than the bill has open', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Put on a bill…' }))
    expect(screen.getByTestId('supply-payment-move-sub').textContent).toBe('$187.40 of the 11/12 ACH 88213 · now on account with Pecan Supply')
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('radio')[1] as HTMLElement)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '900' } })
    expect(screen.getByTestId('supply-payment-move-why').textContent).toBe('Only $187.40 of this payment is there to move.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('dialog', { name: '$5,000.00 to Pecan Supply' })).toBeTruthy()
  })

  it('lists what happened to it, and takes a move back after a confirm', async () => {
    const { onUndoMove } = open({ events: [moved] })
    const history = screen.getByTestId('supply-payment-window-history')
    expect(history.textContent).toContain('Moved $100.00 from S4391877 to S4402277 · 11/14 · Dana · picked the wrong bill')
    fireEvent.click(within(history).getByRole('button', { name: 'Take it back' }))
    // The confirm window's own press carries the same words: it is the second of the two.
    expect(await screen.findByText(/The same amount goes back where it was\./)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Take it back' })[1] as HTMLElement)
    await waitFor(() => expect(onUndoMove).toHaveBeenCalledWith('ev1'))
  })

  it('removes the payment with a reason, only after the window that says what it does', async () => {
    const { onRemove } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Remove this payment…' }))
    expect(await screen.findByText(moneyText(/The \$5,000\.00 ACH 88213 payment of 11\/12 comes off the books\. Its 4 bills read unpaid again/))).toBeTruthy()
    expect(onRemove).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText(/Typed twice/), { target: { value: ' typed twice ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove payment' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(payment, 'typed twice'))
  })

  it('says why when a write is refused, and stays open', async () => {
    open({ onRemove: vi.fn(async () => Promise.reject({ message: 'that payment was already removed' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Remove this payment…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove payment' }))
    expect((await screen.findByRole('alert')).textContent).toContain('already removed')
    expect(screen.getByRole('button', { name: 'Remove this payment…' })).toBeTruthy()
  })

  it('closes', () => {
    const { onClose } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
