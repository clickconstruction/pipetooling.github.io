// @vitest-environment jsdom
/**
 * People → Review → Jobs Worked: the Labor contributors / Profit shares window (punch list #46
 * row 8, v2.4909), moved out of the tab with its rows and close as props. Made-up people.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReviewLaborBreakdownModal, type ReviewLaborBreakdownContext } from './ReviewLaborBreakdownModal'

afterEach(cleanup)

const ctx: ReviewLaborBreakdownContext = {
  mode: 'labor',
  jobId: 'job1',
  jobName: 'Elm St',
  jobAddress: '1 Elm St, San Antonio, TX 78209',
  jobNumberLabel: 'J101',
  totalLaborOnJob: 1000,
  revenueBeforeOverhead: 2000,
  userPersonName: 'Sam',
}
const rows = [
  { personName: 'Sam', hours: 10, laborCost: 600, subLaborCost: 0, crewLaborCost: 600 },
  { personName: 'Ana', hours: 5, laborCost: 400, subLaborCost: 400, crewLaborCost: 0 },
]

describe('ReviewLaborBreakdownModal', () => {
  it('labor: each person with hours, labor and share; the viewer marked; the totals', () => {
    render(<ReviewLaborBreakdownModal ctx={ctx} rows={rows} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Labor contributors' })).toBeTruthy()
    expect(dialog.textContent).toContain('J101 · Elm St')
    expect(dialog.textContent).toContain('1 Elm St, San Antonio')
    const body = dialog.querySelectorAll('tbody tr')
    expect(Array.from(body[0]!.querySelectorAll('td')).map((td) => td.textContent)).toEqual(['Sam(you)crew', '10.00', '$600.00', '60%'])
    expect(Array.from(body[1]!.querySelectorAll('td')).map((td) => td.textContent)).toEqual(['Anasub', '5.00', '$400.00', '40%'])
    expect(Array.from(dialog.querySelectorAll('tfoot td')).map((td) => td.textContent)).toEqual(['Total', '15.00', '$1,000.00', '100%'])
    expect(screen.queryByText(/should match/)).toBeNull()
  })

  it('profit: each person’s slice of the job’s profit', () => {
    render(<ReviewLaborBreakdownModal ctx={{ ...ctx, mode: 'profit' }} rows={rows} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Profit shares by person' })).toBeTruthy()
    const body = dialog.querySelectorAll('tbody tr')
    expect(body[0]!.querySelectorAll('td')[4]!.textContent).toBe('$1,200.00')
    expect(body[1]!.querySelectorAll('td')[4]!.textContent).toBe('$800.00')
  })

  it('says when the rows do not add up to the job header', () => {
    render(<ReviewLaborBreakdownModal ctx={{ ...ctx, totalLaborOnJob: 1200 }} rows={rows} onClose={vi.fn()} />)
    expect(screen.getByText(/the job header showed \$1,200\.00/)).toBeTruthy()
  })

  it('no rows: says so', () => {
    render(<ReviewLaborBreakdownModal ctx={ctx} rows={[]} onClose={vi.fn()} />)
    expect(screen.getByText('No labor recorded for this job.')).toBeTruthy()
  })

  it('× and the backdrop close it; a click inside does not', () => {
    const onClose = vi.fn()
    render(<ReviewLaborBreakdownModal ctx={ctx} rows={rows} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
