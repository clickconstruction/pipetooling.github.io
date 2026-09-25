// @vitest-environment jsdom
/**
 * Render smoke for the tally "Mark payroll" confirm (v2.3837): the "Create rule…"
 * shortcut renders only when the caller can open the payroll rules modal (dev) —
 * for a controller or pay-approved master it used to close the confirm and open nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TallyMarkPayrollConfirmModal } from './TallyMarkPayrollConfirmModal'

const base = {
  open: true,
  busy: false,
  counterpartyName: 'GUSTO PAYROLL',
  bankDescription: 'GUSTO NET 250925',
  amountLabel: '$4,210.00',
  postedLabel: 'Sep 25 · Thu',
  onCancel: () => {},
  onConfirm: () => {},
}

describe('TallyMarkPayrollConfirmModal', () => {
  it('offers Create rule… when a rules door is passed, and calls it', () => {
    const onCreateRule = vi.fn()
    render(<TallyMarkPayrollConfirmModal {...base} onCreateRule={onCreateRule} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create rule…' }))
    expect(onCreateRule).toHaveBeenCalledTimes(1)
  })

  it('has no Create rule… without one — the mark itself is still offered', () => {
    const onConfirm = vi.fn()
    render(<TallyMarkPayrollConfirmModal {...base} onConfirm={onConfirm} />)
    expect(screen.queryByRole('button', { name: 'Create rule…' })).toBeNull()
    expect(screen.getByText('GUSTO PAYROLL')).toBeTruthy()
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(2)
    fireEvent.click(buttons[1]!)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
