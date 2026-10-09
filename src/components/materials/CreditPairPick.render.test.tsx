// @vitest-environment jsdom
/**
 * Render smoke for the credit form's Credits invoice… pick (v2.5035): this house's invoices,
 * newest first, never a credit or the credit itself, and the choice handed back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CreditPairPick } from './CreditPairPick'

afterEach(cleanup)

const rows = [
  { id: 'i1', invoice_number: 'S123148787.003', amount: 2496.94, document_kind: 'invoice', invoice_date: '2026-04-06' },
  { id: 'i2', invoice_number: '88121', amount: 1204, document_kind: 'invoice', invoice_date: '2026-09-12' },
  { id: 'c1', invoice_number: 'CM-4471', amount: -150, document_kind: 'credit', invoice_date: '2026-09-20' },
]

describe('CreditPairPick', () => {
  it('lists the house’s invoices and hands back the one picked', () => {
    const onChange = vi.fn()
    render(<CreditPairPick rows={rows} creditId="c1" value="" onChange={onChange} />)
    const pick = screen.getByLabelText('Credits invoice…') as HTMLSelectElement
    expect([...pick.options].map((o) => o.textContent)).toEqual(['Not paired yet', '88121 · $1,204.00 · Sep 12, 2026', 'S123148787.003 · $2,496.94 · Apr 6, 2026'])
    fireEvent.change(pick, { target: { value: 'i1' } })
    expect(onChange).toHaveBeenCalledWith('i1')
  })
  it('shows the pair it holds, and says so when there is nothing to pair to', () => {
    render(<CreditPairPick rows={rows} creditId="c1" value="i2" onChange={vi.fn()} />)
    expect((screen.getByLabelText('Credits invoice…') as HTMLSelectElement).value).toBe('i2')
    cleanup()
    render(<CreditPairPick rows={[rows[2]!]} creditId="c1" value="" onChange={vi.fn()} />)
    expect(screen.getByTestId('credit-credits-invoice').textContent).toContain('This house has no invoice on file to pair it to yet.')
  })
})
