// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SupplyPaymentsToFinish } from './SupplyPaymentsToFinish'
import type { PaymentToFinish } from '../../lib/materials/payments/supplyPaymentsFinish'
import type { SupplyFinishIo } from '../../lib/materials/payments/supplyPaymentsFinishIo'

// Made-up houses, bills and payments.
const pay = (over: Partial<PaymentToFinish> & { id: string }): PaymentToFinish => ({ supply_house_id: 'h1', paid_on: '2026-11-14', amount: 412.8, method: null, method_ref: null, receipt_link: null, source: 'mark_paid', removed_at: null, houseName: 'Pecan Supply', billNumbers: ['S4388310'], ...over })
const waiting = [pay({ id: 'a' }), pay({ id: 'b', houseName: 'Cedar Fork Supply', billNumbers: ['77120', '77264'], amount: 1906.22, paid_on: '2026-11-10', source: 'recorded' })]

function fakeIo(rows: PaymentToFinish[]): SupplyFinishIo & { saved: unknown[] } {
  const saved: unknown[] = []
  let now = rows
  return {
    saved,
    loadToFinish: vi.fn(async () => now),
    countToFinish: vi.fn(async () => now.length),
    saveHowSent: vi.fn(async (id, patch) => {
      saved.push({ id, patch })
      now = now.filter((p) => p.id !== id)
    }),
  }
}

describe('SupplyPaymentsToFinish', () => {
  it('draws nothing while no payment waits', async () => {
    const io = fakeIo([])
    renderWithProviders(<SupplyPaymentsToFinish io={io} todayYmd="2026-11-16" />)
    await waitFor(() => expect(io.loadToFinish).toHaveBeenCalled())
    expect(screen.queryByTestId('supply-payments-to-finish')).toBeNull()
  })

  it('counts what waits, folded, and lists it when pressed, the longest wait first', async () => {
    renderWithProviders(<SupplyPaymentsToFinish io={fakeIo(waiting)} todayYmd="2026-11-16" />)
    const strip = await screen.findByTestId('supply-payments-to-finish')
    const head = within(strip).getByRole('button', { name: /2 payments need how they were paid/ })
    expect(head.getAttribute('aria-expanded')).toBe('false')
    expect(head.textContent).toContain('$2,319.02')
    expect(screen.queryByTestId('supply-payment-to-finish')).toBeNull()
    fireEvent.click(head)
    expect(screen.getAllByTestId('supply-payment-to-finish').map((r) => r.textContent)).toEqual(['Cedar Fork Supply · 2 billsrecorded 11/10$1,906.22Finish…', 'Pecan Supply · S4388310marked paid 11/14$412.80Finish…'])
  })

  it('opens from the Needs you door, and finishing a payment takes it off the list', async () => {
    const io = fakeIo(waiting)
    const onChanged = vi.fn()
    renderWithProviders(<SupplyPaymentsToFinish io={io} todayYmd="2026-11-16" openAtStart onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Finish Pecan Supply · S4388310' }))
    const editor = screen.getByRole('dialog', { name: 'How $412.80 was sent' })
    expect(editor.textContent).toContain('Pecan Supply · S4388310 · marked paid 11/14')
    const save = within(editor).getByRole('button', { name: 'Save how it was sent' })
    expect(save.hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('supply-payment-how-why').textContent).toBe('Pick how it was sent.')
    fireEvent.click(within(editor).getByRole('button', { name: 'ACH' }))
    fireEvent.change(within(editor).getByLabelText('Confirmation number (optional)'), { target: { value: '88213' } })
    fireEvent.change(within(editor).getByLabelText('Date sent'), { target: { value: '2026-11-13' } })
    fireEvent.click(save)
    await waitFor(() => expect(io.saved).toEqual([{ id: 'a', patch: { method: 'ach', method_ref: '88213', paid_on: '2026-11-13', receipt_link: null } }]))
    await waitFor(() => expect(screen.getAllByTestId('supply-payment-to-finish')).toHaveLength(1))
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /1 payment needs how it was paid/ })).toBeTruthy()
  })

  it('says why when the save is refused, and keeps the editor open', async () => {
    const io = fakeIo(waiting)
    io.saveHowSent = vi.fn(async () => Promise.reject({ message: 'new row violates row-level security policy' }))
    renderWithProviders(<SupplyPaymentsToFinish io={io} todayYmd="2026-11-16" openAtStart />)
    fireEvent.click(await screen.findByRole('button', { name: 'Finish Pecan Supply · S4388310' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save how it was sent' }))
    expect((await screen.findByRole('alert')).textContent).toContain('row-level security')
    expect(screen.getByRole('dialog', { name: 'How $412.80 was sent' })).toBeTruthy()
  })
})
