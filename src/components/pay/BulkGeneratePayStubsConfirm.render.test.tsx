// @vitest-environment jsdom
/**
 * Render smoke for Draft Payroll → Generate N reports (v2.3988): `useBulkGeneratePayStubs` picks
 * who is asked about, the confirm says how many, and the run makes them one after another. Since
 * punch list #184 (sweep A, PR 2) the run goes on past a person whose report fails and keeps each
 * one with the reason and a Try again door.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BulkGeneratePayStubsConfirm } from './BulkGeneratePayStubsConfirm'
import { useBulkGeneratePayStubs, type UseBulkGeneratePayStubsInput } from '../../hooks/useBulkGeneratePayStubs'
import type { PayReportRun } from '../../lib/pay/bulkPayReports'

const generateReport = vi.fn((_person: string): Promise<PayReportRun> => Promise.resolve({ ok: true }))
const setError = vi.fn()
const showToast = vi.fn()

// Weekdays pay the person's figure; Out is a salaried person out unpaid all week.
const RATES: Record<string, number> = { Alex: 240, Sam: 200, Out: 0, Done: 240 }
function costForPersonDate(person: string, workDate: string): number {
  const day = new Date(workDate + 'T12:00:00').getDay()
  return day === 0 || day === 6 ? 0 : (RATES[person] ?? 0)
}

const BASE: UseBulkGeneratePayStubsInput = {
  periodStart: '2026-09-20',
  periodEnd: '2026-09-26',
  peopleNames: ['Alex', 'Sam', 'Out', 'Done'],
  payStubs: [{ person_name: 'Done', period_start: '2026-09-20', period_end: '2026-09-26' }],
  costForPersonDate,
  generateReport,
  setError,
  showToast,
}

function Harness(props: Partial<UseBulkGeneratePayStubsInput>) {
  const bulk = useBulkGeneratePayStubs({ ...BASE, ...props })
  return (
    <>
      <button type="button" onClick={bulk.bulkGenerateMissingPayStubsInModal}>
        generate remaining
      </button>
      <span data-testid="busy">{bulk.bulkGeneratingPayStubs ? 'busy' : 'idle'}</span>
      <ul data-testid="failed">
        {bulk.bulkFailures.map((f) => (
          <li key={f.person}>
            {f.person}: {f.why}
            <button type="button" onClick={() => void bulk.retryBulkFailure(f.person)}>
              try {f.person} again
            </button>
          </li>
        ))}
      </ul>
      <BulkGeneratePayStubsConfirm
        confirm={bulk.bulkGenerateConfirm}
        onCancel={() => bulk.setBulkGenerateConfirm(null)}
        onConfirm={(candidates) => {
          bulk.setBulkGenerateConfirm(null)
          void bulk.runBulkGeneratePayStubs(candidates)
        }}
      />
    </>
  )
}

beforeEach(() => {
  generateReport.mockReset()
  generateReport.mockImplementation(() => Promise.resolve({ ok: true }))
  setError.mockClear()
  showToast.mockClear()
})
afterEach(cleanup)

describe('Generate Remaining', () => {
  it('asks about the people with pay due and no report — not the one with a report, not the one at $0', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).toBeNull() // first paint
    fireEvent.click(screen.getByText('generate remaining'))
    expect(screen.getByRole('dialog').textContent).toContain('Generate 2 pay reports for 2026-09-20 through 2026-09-26?')
    expect(screen.getByRole('button', { name: 'Generate 2 reports' })).toBeTruthy()
  })

  it('makes each report in turn and says how many', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('generate remaining'))
    fireEvent.click(screen.getByRole('button', { name: 'Generate 2 reports' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Generated 2 reports.', 'success'))
    expect(generateReport.mock.calls.map((c) => c[0])).toEqual(['Alex', 'Sam'])
    expect(screen.getByTestId('failed').textContent).toBe('')
    expect(setError).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('busy').textContent).toBe('idle')
  })

  it('goes on past a report that fails and keeps that person with the reason', async () => {
    generateReport.mockImplementation((person: string) => Promise.resolve(person === 'Alex' ? { ok: false, why: 'Failed to create pay report: no pay config' } : { ok: true }))
    render(<Harness />)
    fireEvent.click(screen.getByText('generate remaining'))
    fireEvent.click(screen.getByRole('button', { name: 'Generate 2 reports' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Generated 1 report. 1 did not generate.', 'warning'))
    // Alex failed first; Sam still generated.
    expect(generateReport.mock.calls.map((c) => c[0])).toEqual(['Alex', 'Sam'])
    expect(screen.getByTestId('failed').textContent).toContain('Alex: Failed to create pay report: no pay config')
    expect(screen.getByTestId('failed').textContent).not.toContain('Sam')
  })

  it('Try again makes the one report and takes them off the list', async () => {
    generateReport.mockImplementation((person: string) => Promise.resolve(person === 'Alex' ? { ok: false, why: 'timed out' } : { ok: true }))
    render(<Harness />)
    fireEvent.click(screen.getByText('generate remaining'))
    fireEvent.click(screen.getByRole('button', { name: 'Generate 2 reports' }))
    await screen.findByRole('button', { name: 'try Alex again' })
    generateReport.mockImplementation(() => Promise.resolve({ ok: true }))
    fireEvent.click(screen.getByRole('button', { name: 'try Alex again' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Generated Alex's report.", 'success'))
    expect(screen.getByTestId('failed').textContent).toBe('')
  })

  it('says nothing generated when every report fails', async () => {
    generateReport.mockImplementation(() => Promise.resolve({ ok: false, why: 'offline' }))
    render(<Harness />)
    fireEvent.click(screen.getByText('generate remaining'))
    fireEvent.click(screen.getByRole('button', { name: 'Generate 2 reports' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Nothing generated. 2 did not generate.', 'error'))
    expect(screen.getByTestId('failed').textContent).toContain('Alex: offline')
    expect(screen.getByTestId('failed').textContent).toContain('Sam: offline')
  })

  it('Cancel closes the confirm and makes nothing', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('generate remaining'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(generateReport).not.toHaveBeenCalled()
  })

  it('says so, and asks nothing, when no one is missing a report', () => {
    render(<Harness peopleNames={['Out', 'Done']} />)
    fireEvent.click(screen.getByText('generate remaining'))
    expect(showToast).toHaveBeenCalledWith('No missing pay reports with hours for this period.', 'info')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refuses a period whose start is after its end', () => {
    render(<Harness periodStart="2026-09-27" />)
    fireEvent.click(screen.getByText('generate remaining'))
    expect(showToast).toHaveBeenCalledWith('Invalid date range.', 'warning')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
