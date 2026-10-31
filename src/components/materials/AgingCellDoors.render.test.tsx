// @vitest-environment jsdom
/**
 * Render smoke for the aging cell modal's doors (punch list #132 PR 4, v2.6216): each press
 * hands its act back, a row with nothing to fix draws no fix-it door, a busy row's presses
 * are dead, and the footer's payment door follows the modal's decision.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AgingInvoiceDoor, AgingMakePaymentDoor, AgingRowDoors } from './AgingCellDoors'
import { agingCellModalDoors, agingCellRowDoors } from '../../lib/supplyHouseAging'

afterEach(cleanup)

describe('AgingCellDoors', () => {
  it('the invoice number opens the invoice', () => {
    const onOpen = vi.fn()
    render(<AgingInvoiceDoor invoiceNumber="S124687508.001" busy={false} onOpen={onOpen} />)
    const door = screen.getByRole('button', { name: 'Edit invoice S124687508.001' })
    expect(door.textContent).toBe('S124687508.001')
    fireEvent.click(door)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
  it('a no-due-date charge on no job offers both fix-it doors, each handing back its act', () => {
    const onAddDueDate = vi.fn()
    const onPickJob = vi.fn()
    render(<AgingRowDoors doors={agingCellRowDoors({ amount: 120, due_date: null }, 0)} busy={false} onAddDueDate={onAddDueDate} onPickJob={onPickJob} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add a due date ›' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pick a job ›' }))
    expect(onAddDueDate).toHaveBeenCalledTimes(1)
    expect(onPickJob).toHaveBeenCalledTimes(1)
  })
  it('a dated charge on one job draws no fix-it door at all', () => {
    const { container } = render(<AgingRowDoors doors={agingCellRowDoors({ amount: 120, due_date: '2026-07-10' }, 1)} busy={false} onAddDueDate={vi.fn()} onPickJob={vi.fn()} />)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
  it('while the house detail loads, the row’s presses are dead', () => {
    const onOpen = vi.fn()
    const onAddDueDate = vi.fn()
    render(
      <>
        <AgingInvoiceDoor invoiceNumber="88121" busy onOpen={onOpen} />
        <AgingRowDoors doors={{ addDueDate: true, pickJob: false }} busy onAddDueDate={onAddDueDate} onPickJob={vi.fn()} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit invoice 88121' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a due date ›' }))
    expect(onOpen).not.toHaveBeenCalled()
    expect(onAddDueDate).not.toHaveBeenCalled()
  })
  it('a house-scoped modal makes a payment; the credits cell and the footer row do not', () => {
    const onMakePayment = vi.fn()
    render(<AgingMakePaymentDoor doors={agingCellModalDoors('h1', 'past60_90')} busy={false} onMakePayment={onMakePayment} />)
    fireEvent.click(screen.getByRole('button', { name: 'Make a payment ›' }))
    expect(onMakePayment).toHaveBeenCalledTimes(1)
    cleanup()
    const credits = render(<AgingMakePaymentDoor doors={agingCellModalDoors('h1', 'credits')} busy={false} onMakePayment={vi.fn()} />)
    expect(credits.container.querySelectorAll('button')).toHaveLength(0)
    cleanup()
    const footer = render(<AgingMakePaymentDoor doors={agingCellModalDoors(null, 'owed')} busy={false} onMakePayment={vi.fn()} />)
    expect(footer.container.querySelectorAll('button')).toHaveLength(0)
  })
})
