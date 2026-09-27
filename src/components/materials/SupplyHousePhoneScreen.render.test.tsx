// @vitest-environment jsdom
/**
 * Render smokes for a supply house on a phone (v2.3888): the balance and Call
 * on top, the notes saved in place, invoices as rows by tab, and a row's
 * verbs in one bottom sheet.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SupplyHousePhoneScreen, type SupplyHousePhoneScreenProps } from './SupplyHousePhoneScreen'

vi.mock('../dispatchMode/DispatchModeFooter', () => ({ DISPATCH_MODE_FOOTER_HEIGHT_PX: 56 }))

afterEach(cleanup)

function props(over: Partial<SupplyHousePhoneScreenProps> = {}): SupplyHousePhoneScreenProps {
  return {
    house: { id: 'a', name: 'House A', phone: '(210) 555-0100', address: '1200 Commerce St', notes: 'Ask for will-call before 2.' },
    money: { outstanding: 4462, payDayWords: 'pays on the 10th', segments: [{ key: 'current', label: 'Current', amount: 1592, share: 0.36 }, { key: 'past1_30', label: '1–30', amount: 2870, share: 0.64 }] },
    loading: false,
    invoices: [
      { id: '1', invoice_number: '88121', purchase_order_number: 'PO-1041', due_date: '2026-10-02', amount: 1204, is_paid: false, link: 'https://example.test/88121.pdf', job_allocations: [{ job_id: 'j1', pct: 100 }] },
      { id: '2', invoice_number: '87990', purchase_order_number: null, due_date: '2026-09-05', amount: 2870, is_paid: false },
      { id: '4', invoice_number: 'CM-4471', purchase_order_number: null, due_date: null, amount: -150, is_paid: false },
      { id: '5', invoice_number: '87001', purchase_order_number: null, due_date: '2026-08-01', amount: 900, is_paid: true },
    ],
    jobLabel: (id) => id.toUpperCase(),
    todayYmd: '2026-09-27',
    formatMoney: (n) => `$${n.toLocaleString('en-US')}`,
    onClose: vi.fn(),
    onEditHouse: vi.fn(),
    onAddInvoice: vi.fn(),
    onMakePayment: vi.fn(),
    onTogglePaid: vi.fn(),
    onEditInvoice: vi.fn(),
    onSaveNotes: vi.fn(async () => true),
    ...over,
  }
}

describe('SupplyHousePhoneScreen', () => {
  it('leads with the balance, the pay day and Call; lists unpaid invoices as rows', () => {
    render(<SupplyHousePhoneScreen {...props()} />)
    expect(screen.getByRole('dialog', { name: 'House A' })).toBeTruthy()
    expect(document.querySelector('[data-supply-house-phone-balance]')?.textContent).toBe('$4,462')
    expect(screen.getByText(/pays on the 10th/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Call counter/ }).getAttribute('href')).toMatch(/^tel:/)
    expect(screen.getByRole('tab', { name: 'Unpaid 2' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Credits 1' })).toBeTruthy()
    expect([...document.querySelectorAll('[data-supply-house-phone-invoice]')].map((r) => r.getAttribute('data-supply-house-phone-invoice'))).toEqual(['1', '2'])
    expect(document.querySelector('[data-supply-house-phone-invoice="2"] [data-past-due]')?.textContent).toBe('22 d past due')
  })

  it('a row opens one sheet: Mark paid, View, Edit — and each calls back with the invoice', () => {
    const p = props()
    render(<SupplyHousePhoneScreen {...p} />)
    fireEvent.click(document.querySelector('[data-supply-house-phone-invoice="1"]') as HTMLElement)
    const sheet = screen.getByRole('dialog', { name: '88121 · PO-1041' })
    expect([...sheet.querySelectorAll('button')].map((b) => b.querySelector('span')?.textContent ?? b.textContent)).toEqual(['Mark paid', 'View the invoice', 'Edit', 'Close'])
    fireEvent.click(screen.getByText('Mark paid'))
    expect(p.onTogglePaid).toHaveBeenCalledWith('1')
    expect(screen.queryByRole('dialog', { name: '88121 · PO-1041' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Paid 1' }))
    fireEvent.click(document.querySelector('[data-supply-house-phone-invoice="5"]') as HTMLElement)
    expect(screen.getByText('Mark unpaid')).toBeTruthy()
    const paidSheet = screen.getByRole('dialog', { name: '87001' })
    fireEvent.click([...paidSheet.querySelectorAll('button')].find((b) => b.querySelector('span')?.textContent === 'Edit') as HTMLElement)
    expect(p.onEditInvoice).toHaveBeenCalledWith('5')
  })

  it('the notes save in place, and say so; Save waits for a change', async () => {
    const p = props()
    render(<SupplyHousePhoneScreen {...p} />)
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(box.value).toBe('Ask for will-call before 2.')
    const save = screen.getByRole('button', { name: 'Save notes' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'Credit memo 4471 promised by Friday.' } })
    expect(screen.getByText('not saved yet')).toBeTruthy()
    fireEvent.click(save)
    expect(p.onSaveNotes).toHaveBeenCalledWith('Credit memo 4471 promised by Friday.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save notes' })).toBeTruthy())
  })

  it('a house with no phone has no Call, and Back closes', () => {
    const p = props({ house: { id: 'b', name: 'House B', phone: null, address: null, notes: null }, money: null, invoices: [] })
    render(<SupplyHousePhoneScreen {...p} />)
    expect(screen.queryByRole('link', { name: /Call counter/ })).toBeNull()
    expect(screen.getByText('Nothing unpaid with this house.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to supply houses' }))
    expect(p.onClose).toHaveBeenCalled()
  })
})
