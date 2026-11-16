// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SupplyPaymentWindow } from './SupplyPaymentWindow'
import type { SupplyPayment, SupplyPaymentLine } from '../../lib/materials/payments/supplyPayment'

// A made-up payment at a made-up house.
const payment: SupplyPayment = { id: 'p1', supply_house_id: 'h1', paid_on: '2026-11-12', amount: 5000, method: 'ach', method_ref: '88213', receipt_link: 'https://example.test/receipt', source: 'recorded', removed_at: null, created_by_name: 'Dana Whitfield' }
const lines: SupplyPaymentLine[] = [
  { id: 'l1', payment_id: 'p1', invoice_id: 'x', amount: 612.6 },
  { id: 'l2', payment_id: 'p1', invoice_id: 'y', amount: 2900 },
  { id: 'l3', payment_id: 'p1', invoice_id: 'z', amount: 300 },
  { id: 'l4', payment_id: 'p1', invoice_id: 'w', amount: 1000 },
]
const bills = [
  { id: 'x', invoice_number: 'S4390044', title: '214 · Hollis Street Clinic', amount: 612.6, is_paid: true },
  { id: 'y', invoice_number: 'S4391877', title: '201 · Maple Lofts', amount: 2900, is_paid: true },
  { id: 'z', invoice_number: 'S4402277', title: '201 · Maple Lofts', amount: 812.4, is_paid: false },
  { id: 'w', invoice_number: 'S4393015', title: '188 · Juniper Ridge Bldg C', amount: 1000, is_paid: true },
]
const open = (onRemove = vi.fn(async () => {}), onClose = vi.fn()) => {
  renderWithProviders(<SupplyPaymentWindow payment={payment} payments={[payment]} lines={lines} bills={bills} houseName="Pecan Supply" todayYmd="2026-11-16" onClose={onClose} onRemove={onRemove} />)
  return { onRemove, onClose }
}

describe('SupplyPaymentWindow', () => {
  it('shows the payment, every bill it touched, and what waits on account', () => {
    open()
    expect(screen.getByRole('dialog', { name: '$5,000.00 to Pecan Supply' })).toBeTruthy()
    expect(screen.getByTestId('supply-payment-window-sub').textContent).toBe('11/12 · ACH 88213 · recorded by Dana Whitfield · Receipt ›')
    const rows = screen.getAllByTestId('supply-payment-window-line').map((r) => r.textContent)
    expect(rows).toEqual(['S4391877 · 201 · Maple Loftspaid in full$2,900.00', 'S4393015 · 188 · Juniper Ridge Bldg Cpaid in full$1,000.00', 'S4390044 · 214 · Hollis Street Clinicpaid in full$612.60', 'S4402277 · 201 · Maple Loftspart payment · $512.40 left on the bill$300.00'])
    expect(screen.getByTestId('supply-payment-window-account').textContent).toBe('On account with Pecan Supplynot on a bill yet$187.40')
    expect(screen.getByText('$4,812.60 is on bills and $187.40 is on account.')).toBeTruthy()
  })

  it('removes the payment only after the confirm that says what it does', async () => {
    const { onRemove } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Remove this payment…' }))
    expect(await screen.findByText(/The \$5,000\.00 ACH 88213 payment of 11\/12 comes off the books\. Its 4 bills read unpaid again/)).toBeTruthy()
    expect(onRemove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove payment' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(payment))
  })

  it('says why when the removal is refused, and stays open', async () => {
    open(vi.fn(async () => Promise.reject({ message: 'new row violates row-level security policy' })))
    fireEvent.click(screen.getByRole('button', { name: 'Remove this payment…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove payment' }))
    expect((await screen.findByRole('alert')).textContent).toContain('row-level security')
    expect(screen.getByRole('button', { name: 'Remove this payment…' })).toBeTruthy()
  })

  it('closes', () => {
    const { onClose } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
