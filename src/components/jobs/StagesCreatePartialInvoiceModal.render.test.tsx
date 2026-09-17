// @vitest-environment jsdom
/**
 * Render smoke for the Create partial invoice dialog (Stages tab decomposition PR 7): the
 * job line and remaining figure, the amount box wiring, the Create gate, the error line,
 * and the busy label.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StagesCreatePartialInvoiceModal } from './StagesCreatePartialInvoiceModal'
import { makeJob } from '../../test/renderSmokeMocks'

const job = makeJob({ hcp_number: '878', job_name: 'Acme Plaza', status: 'ready_to_bill', revenue: 10000, payments_made: 3000, invoices: [] })

describe('StagesCreatePartialInvoiceModal', () => {
  it('shows the job and the carvable remainder, wires the amount box, and gates Create on a positive amount', () => {
    const onAmountChange = vi.fn()
    const onAmountBlur = vi.fn()
    const onCreate = vi.fn()
    const onCancel = vi.fn()
    const { rerender } = render(<StagesCreatePartialInvoiceModal job={job} amount="" onAmountChange={onAmountChange} onAmountBlur={onAmountBlur} error={null} creating={false} onCancel={onCancel} onCreate={onCreate} />)
    expect(screen.getByText('Create partial invoice')).toBeTruthy()
    expect(screen.getByText('878 · Acme Plaza')).toBeTruthy()
    expect(screen.getByText('Remaining: $7,000.00')).toBeTruthy()
    const input = screen.getByPlaceholderText('0') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2500' } })
    expect(onAmountChange).toHaveBeenCalledWith('2500')
    fireEvent.blur(input)
    expect(onAmountBlur).toHaveBeenCalledTimes(1)
    expect((screen.getByText('Create invoice') as HTMLButtonElement).disabled).toBe(true)
    rerender(<StagesCreatePartialInvoiceModal job={job} amount="2500" onAmountChange={onAmountChange} onAmountBlur={onAmountBlur} error={null} creating={false} onCancel={onCancel} onCreate={onCreate} />)
    expect((screen.getByText('Create invoice') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByText('Create invoice'))
    expect(onCreate).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows the error line and the busy label', () => {
    render(<StagesCreatePartialInvoiceModal job={job} amount="2500" onAmountChange={vi.fn()} onAmountBlur={vi.fn()} error="No remaining balance to bill" creating onCancel={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText('No remaining balance to bill')).toBeTruthy()
    expect((screen.getByText('…') as HTMLButtonElement).disabled).toBe(true)
  })
})
