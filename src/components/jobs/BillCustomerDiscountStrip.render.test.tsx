// @vitest-environment jsdom
/**
 * The Bill Customer discount strip (v2.3268): collapsed to a button; open,
 * "take off" reads 10% or 500 and "make this bill" a total; the sentence
 * says what it does and the new amount; the basis flips with one link on a
 * draw; Apply hands the parent the plan.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { BillCustomerDiscountStrip, type BillCustomerDiscountStripRow } from './BillCustomerDiscountStrip'
import type { BillDiscountPlan } from '../../lib/jobs/discountLine'
import { renderWithProviders } from '../../test/renderSmokeMocks'

afterEach(() => cleanup())

const rows: BillCustomerDiscountStripRow[] = [
  { id: 'a', name: 'Rough In', count: 1, line_unit_price: 15098, sequence_order: 0, invoice_id: 'inv-1' },
  { id: 'b', name: 'Top Out', count: 1, line_unit_price: 15098, sequence_order: 1, invoice_id: null },
  { id: 'c', name: 'Trim Set', count: 1, line_unit_price: 7549, sequence_order: 2, invoice_id: null },
]

describe('BillCustomerDiscountStrip', () => {
  it('opens from the button; "take off 10%" on a draw discounts that draw only and Apply hands over the plan', async () => {
    const onApply = vi.fn<(plan: BillDiscountPlan) => Promise<void>>(async () => {})
    renderWithProviders(<BillCustomerDiscountStrip rows={rows} scopedIds={['a']} billAmount={15098} onApply={onApply} />)
    fireEvent.click(screen.getByText('− Add discount'))
    fireEvent.change(screen.getByLabelText(/Take off/), { target: { value: '10%' } })
    expect(screen.getByTestId('bill-discount-sentence').textContent).toContain('10% off')
    expect(screen.getByTestId('bill-discount-sentence').textContent).toContain('this draw only')
    expect(screen.getByTestId('bill-discount-sentence').textContent).toContain('$13,588.20')
    fireEvent.click(screen.getByText('apply to the whole job instead'))
    expect(screen.getByTestId('bill-discount-sentence').textContent).toContain('rides this bill')
    fireEvent.click(screen.getByText('Negotiated'))
    fireEvent.click(screen.getByText('Apply'))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    const plan = onApply.mock.calls[0]![0]
    expect(plan.row).toMatchObject({ name: 'Negotiated discount', pct: 10, basisIds: null, reason: 'Negotiated' })
    expect(plan.newBillAmount).toBe(13588.2)
  })
  it('"make this bill 13500" lands exactly and clears the other field', () => {
    renderWithProviders(<BillCustomerDiscountStrip rows={rows} scopedIds={['a']} billAmount={15098} onApply={async () => {}} />)
    fireEvent.click(screen.getByText('− Add discount'))
    fireEvent.change(screen.getByLabelText(/Take off/), { target: { value: '5%' } })
    fireEvent.change(screen.getByLabelText(/Make this bill/), { target: { value: '13500' } })
    expect((screen.getByLabelText(/Take off/) as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('bill-discount-sentence').textContent).toContain('$1,598.00 off Rough In')
    expect(screen.queryByText('apply to the whole job instead')).toBeNull()
  })
  it('a total above the bill, or nothing typed, leaves Apply disabled', () => {
    renderWithProviders(<BillCustomerDiscountStrip rows={rows} scopedIds={null} billAmount={37745} onApply={async () => {}} />)
    fireEvent.click(screen.getByText('− Add discount'))
    expect((screen.getByText('Apply') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Make this bill/), { target: { value: '40000' } })
    expect((screen.getByText('Apply') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('bill-discount-sentence').textContent).toContain('below what the bill is now')
  })

  it('the standing-discount offer line (v2.3272): Use it fills the rate, the reason, and the whole job', () => {
    renderWithProviders(
      <BillCustomerDiscountStrip rows={rows} scopedIds={['a']} billAmount={15098} onApply={async () => {}} offer={{ pct: 5, reason: 'Repeat customer', customerName: 'Done Right Foundation' }} />,
    )
    fireEvent.click(screen.getByText('− Add discount'))
    expect(screen.getByTestId('bill-discount-offer').textContent).toContain('Done Right Foundation gets 5%')
    fireEvent.click(screen.getByText('Use it'))
    expect((screen.getByLabelText(/Take off/) as HTMLInputElement).value).toBe('5%')
    expect(screen.getByRole('button', { name: 'Repeat customer' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('bill-discount-sentence').textContent).toContain('5% off all 3 work lines')
    expect(screen.getByTestId('bill-discount-sentence').textContent).toContain('rides this bill')
  })
})
