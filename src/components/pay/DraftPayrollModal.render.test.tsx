// @vitest-environment jsdom
/**
 * Draft Payroll's window (punch list #217, people-docs-1, built in 2026-10-30): the period's bar
 * under the dates in place of the Total | Left sentence, a Cash due column with a bar per row or a
 * blue Record payment for a report with nothing paid on it, the cents drawn smaller, salary 8h as
 * a line under the figure, an amber dot on the rows whose clock sessions still wait and one chip
 * in the button row, and the Open Tally note under the table.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DraftPayrollModal, type DraftPayrollModalProps } from './DraftPayrollModal'

const START = '2026-10-18'
const END = '2026-10-24'

function props(over: Partial<DraftPayrollModalProps> = {}): DraftPayrollModalProps {
  const cost: Record<string, number> = { 'Hal Sample': 1071 / 5, 'Rosa Sample': 1120 / 5, 'Paco Sample': 1245 / 5, 'Sid Sample': 1062 / 5, 'Eli Sample': 0 }
  const hours: Record<string, number> = { 'Hal Sample': 38.25 / 5, 'Rosa Sample': 8, 'Paco Sample': 41.5 / 5, 'Sid Sample': 36 / 5, 'Eli Sample': 0 }
  const weekday = (d: string) => {
    const n = new Date(`${d}T12:00:00`).getDay()
    return n >= 1 && n <= 5
  }
  return {
    open: true,
    onClose: () => {},
    zIndex: 10,
    periodStart: START,
    periodEnd: END,
    onChangePeriodStart: () => {},
    onChangePeriodEnd: () => {},
    onShiftWeek: () => {},
    bulkGenerating: false,
    pendingLoading: false,
    pendingError: null,
    pendingCount: 3,
    canAccessHours: true,
    onOpenHoursForPeriod: vi.fn(),
    peopleNames: ['Hal Sample', 'Rosa Sample', 'Paco Sample', 'Sid Sample', 'Eli Sample'],
    payStubs: [
      { id: 's-hal', person_name: 'Hal Sample', period_start: START, period_end: END, hours_total: 38.25, gross_pay: 1071, created_at: null, paid_at: '2026-10-23T18:00:00Z', paid_by: null, paid_note: null },
      { id: 's-paco', person_name: 'Paco Sample', period_start: START, period_end: END, hours_total: 41.5, gross_pay: 1245, created_at: null, paid_at: null, paid_by: null, paid_note: null },
      // A report with nothing paid on it yet: Record payment sits in Cash due.
      { id: 's-sid', person_name: 'Sid Sample', period_start: START, period_end: END, hours_total: 36, gross_pay: 1062, created_at: null, paid_at: null, paid_by: null, paid_note: null },
    ],
    payStubPaymentsByStubId: {
      's-hal': [{ id: 'p1', pay_stub_id: 's-hal', amount: 1071, paid_at: '2026-10-23T18:00:00Z', memo: null, created_at: null, created_by: null }],
      's-paco': [{ id: 'p2', pay_stub_id: 's-paco', amount: 373, paid_at: '2026-10-24T18:00:00Z', memo: null, created_at: null, created_by: null }],
    },
    payStubDeductionsByStubId: {},
    payStubAdditionalByStubId: {},
    getCostForPersonDate: (person, date) => (weekday(date) ? (cost[person] ?? 0) : 0),
    getEffectiveHours: (person, date) => (weekday(date) ? (hours[person] ?? 0) : 0),
    getRunPayrollReviewDayItems: () => [],
    onBulkGenerateRemaining: () => {},
    onGenerateReport: () => {},
    onViewStub: () => {},
    onRecordPayment: vi.fn(),
    canDeletePayReports: true,
    onRequestDeleteStub: () => {},
    deletingPayStubId: null,
    markingPayStubId: null,
    generatingPayStubPerson: null,
    showToast: () => {},
    onNavigateToHoursForReviewDate: () => {},
    onOpenHoursBreakdown: () => {},
    pendingByPerson: { 'Paco Sample': 2, 'Rosa Sample': 1 },
    isSalaryPerson: (person) => person === 'Rosa Sample',
    ...over,
  }
}

afterEach(cleanup)

describe('DraftPayrollModal', () => {
  it('draws the period bar, the chip and the bars in place of the sentence, the banner and the Status column', () => {
    renderWithProviders(<DraftPayrollModal {...props()} />)
    // The period bar: each part names its share, and the caption counts paid against the people with pay due.
    const period = screen.getByTestId('draft-payroll-period-bar')
    expect(screen.queryByText(/Total: \$4,498\.00/)).toBeNull()
    expect(screen.getByText('This period · $4,498.00 · 1 of 4 paid')).toBeTruthy()
    expect(within(period).getByTitle('$1,444.00 paid · 32% of the period')).toBeTruthy()
    expect(within(period).getByText('owed $1,934.00 (43%)')).toBeTruthy()
    expect(within(period).getByTitle('$1,120.00 no report yet · 25% of the period')).toBeTruthy()
    // The banner is one chip in the button row; the dots sit on the rows whose sessions wait; no count sentence.
    expect(screen.queryByText(/clock sessions in this period still need approval/)).toBeNull()
    const chip = screen.getByText('3 sessions await approval ›')
    fireEvent.click(chip)
    expect(screen.getByText('2 waiting', { exact: false })).toBeTruthy()
    expect(screen.getByText('1 waiting', { exact: false })).toBeTruthy()
    expect(screen.queryByText('1 with pay due and no report yet')).toBeNull()
    expect(screen.getByRole('button', { name: 'Generate 1 report' })).toBeTruthy()
    // The columns: no Paid, no Status; Cash due and $.
    expect(screen.queryByRole('columnheader', { name: 'Paid' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Cash due' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: '$' })).toBeTruthy()
  })

  it('a row per kind: paid on its day, part paid, an estimate with no report, salary 8h under the figure, no est. chip', () => {
    renderWithProviders(<DraftPayrollModal {...props()} />)
    const hal = screen.getByTestId('draft-payroll-row-bar-Hal Sample')
    expect(within(hal).getByTitle('$1,071.00 paid on Fri')).toBeTruthy()
    const paco = screen.getByTestId('draft-payroll-row-bar-Paco Sample')
    expect(within(paco).getByTitle('$373.00 paid on Sat')).toBeTruthy()
    expect(within(paco).getByTitle('$872.00 still owed on the report (its net less what is paid)')).toBeTruthy()
    const rosa = screen.getByTestId('draft-payroll-row-bar-Rosa Sample')
    expect(within(rosa).getByText('no report yet')).toBeTruthy()
    expect(screen.queryByText('est.')).toBeNull()
    expect(screen.getByTitle(/estimate from the hours and the wage/)).toBeTruthy()
    const salary = screen.getByText('salary 8h')
    expect(salary.closest('td')?.querySelector('[data-draft-payroll-money]')).toBeTruthy()
    const money = screen.getAllByText((_, el) => el?.hasAttribute('data-draft-payroll-money') === true && el.textContent === '$1,071.00')
    expect(money).toHaveLength(1)
    expect(money[0]?.querySelector('span')?.textContent).toBe('.00')
  })

  it('a report with nothing paid on it shows a blue Record payment in Cash due and not in Actions; a part-paid one keeps its bar', () => {
    const p = props()
    renderWithProviders(<DraftPayrollModal {...p} />)
    const sidRow = screen.getByText('Sid Sample').closest('tr') as HTMLElement
    const sidCells = sidRow.querySelectorAll('td')
    const record = within(sidCells[1] as HTMLElement).getByRole('button', { name: 'Record payment' })
    expect(record.getAttribute('data-draft-payroll-record-in-cash-due')).not.toBeNull()
    expect(within(sidCells[4] as HTMLElement).queryByRole('button', { name: 'Record payment' })).toBeNull()
    expect(within(sidCells[4] as HTMLElement).getByRole('button', { name: 'View' })).toBeTruthy()
    expect(within(sidCells[4] as HTMLElement).getByRole('button', { name: 'Delete pay report' })).toBeTruthy()
    expect(screen.queryByTestId('draft-payroll-row-bar-Sid Sample')).toBeNull()
    fireEvent.click(record)
    expect(p.onRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ id: 's-sid' }))
    const pacoRow = screen.getByText('Paco Sample').closest('tr') as HTMLElement
    expect(within(pacoRow.querySelectorAll('td')[4] as HTMLElement).getByRole('button', { name: 'Record payment' })).toBeTruthy()
  })

  it('once every report exists, the Open Tally note sits under the table', () => {
    renderWithProviders(<DraftPayrollModal {...props({ peopleNames: ['Hal Sample', 'Paco Sample', 'Sid Sample'] })} />)
    const note = screen.getByText(/Every report for this period is generated/).closest('[role="status"]') as HTMLElement
    const table = document.querySelector('table') as HTMLElement
    expect(note.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(screen.getByText('Open Tally →')).toBeTruthy()
    expect(screen.queryByText('No one needs a report for this period.')).toBeNull()
  })

  it('an empty roster says where the roster is', () => {
    renderWithProviders(<DraftPayrollModal {...props({ peopleNames: [], payStubs: [] })} />)
    expect(screen.getByText(/People → Users → Pay/)).toBeTruthy()
    expect(screen.queryByTestId('draft-payroll-period-bar')).toBeNull()
  })
})
