// @vitest-environment jsdom
/**
 * Draft Payroll's bars (punch list #217, people-docs-1, a prototype): the window reads as today
 * with the switch off; with it on, the period bar replaces the Total | Left sentence, the Status
 * column becomes a bar per row, the estimates wear est., the salaried rows salary 8h, the pending
 * sessions sit as an amber dot on their rows and as one chip in the button row; a dev with `?sbs=1`
 * sees both one above the other.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../contexts/ToastContext'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { DRAFT_PAYROLL_BARS_SHAPE_KEY, DraftPayrollModal, type DraftPayrollModalProps } from './DraftPayrollModal'
import { shapeViewStorageKey } from '../prototypes/SideBySide'

const auth = vi.hoisted(() => ({ role: 'controller' as string, userId: 'u-controller' }))
vi.mock('../../hooks/useAuth', () => ({
  useOptionalAuth: () => ({ user: { id: auth.userId }, role: auth.role }),
  useAuth: () => ({ user: { id: auth.userId }, role: auth.role }),
}))

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
    onRecordPayment: () => {},
    canDeletePayReports: false,
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

function mount(ui: ReactNode, path = '/people?tab=pay_stubs') {
  return render(
    <ToastProvider>
      <ConfirmDialogProvider>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
      </ConfirmDialogProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  auth.role = 'controller'
  auth.userId = 'u-controller'
  window.localStorage.clear()
})
afterEach(cleanup)

describe('DraftPayrollModal with the bars', () => {
  it('reads as today with the switch off: the sentence, the Status column and the banner', () => {
    mount(<DraftPayrollModal {...props()} />)
    expect(screen.getByText(/1 of 5 paid · Total: \$4,498\.00 \| Left: \$3,054\.00/)).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Paid' })).toBeTruthy()
    expect(screen.getByText(/clock sessions in this period still need approval/)).toBeTruthy()
    expect(screen.queryByTestId('draft-payroll-period-bar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the bars' })).toBeTruthy()
  })

  it('draws the bars once the switch is on, and remembers it for the person', () => {
    mount(<DraftPayrollModal {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the bars' }))
    expect(window.localStorage.getItem(shapeViewStorageKey(DRAFT_PAYROLL_BARS_SHAPE_KEY, 'u-controller'))).toBe('1')
    expect(screen.getByRole('button', { name: 'Show today’s look' })).toBeTruthy()

    // The period bar in place of the sentence, with the same three kinds of money.
    const period = screen.getByTestId('draft-payroll-period-bar')
    expect(screen.queryByText(/Total: \$4,498\.00/)).toBeNull()
    expect(screen.getByText('This period · $4,498.00 · 1 of 5 paid')).toBeTruthy()
    expect(within(period).getByTitle('$1,444.00 paid')).toBeTruthy()
    expect(within(period).getByTitle('$1,934.00 owed on a report')).toBeTruthy()
    expect(within(period).getByTitle('$1,120.00 no report yet')).toBeTruthy()

    // The banner is one chip in the button row; the dots sit on the rows whose sessions wait.
    expect(screen.queryByText(/clock sessions in this period still need approval/)).toBeNull()
    const chip = screen.getByText('3 sessions await approval ›')
    fireEvent.click(chip)
    expect(screen.getByText('Cash due')).toBeTruthy()
    expect(screen.queryByText('Status')).toBeNull()
    // The Paid column goes with the bars (the owner, 2026-10-30): the green bar and Record payment say it.
    expect(screen.queryByRole('columnheader', { name: 'Paid' })).toBeNull()
    expect(screen.getByText('2 waiting', { exact: false })).toBeTruthy()
    expect(screen.getByText('1 waiting', { exact: false })).toBeTruthy()

    // A row per kind: Hal paid Fri, Paco part paid, Rosa an estimate wearing est. and salary 8h.
    const hal = screen.getByTestId('draft-payroll-row-bar-Hal Sample')
    expect(within(hal).getByTitle('$1,071.00 paid on Fri')).toBeTruthy()
    const paco = screen.getByTestId('draft-payroll-row-bar-Paco Sample')
    expect(within(paco).getByTitle('$373.00 paid on Sat')).toBeTruthy()
    expect(within(paco).getByTitle('$872.00 still owed on the report (its net less what is paid)')).toBeTruthy()
    const rosa = screen.getByTestId('draft-payroll-row-bar-Rosa Sample')
    expect(within(rosa).getByText('no report yet')).toBeTruthy()
    expect(screen.getAllByText('est.')).toHaveLength(1)
    // salary 8h sits under the $ figure, not beside the name (the owner, 2026-10-30).
    const salary = screen.getByText('salary 8h')
    expect(salary.closest('td')?.querySelector('[data-draft-payroll-money]')).toBeTruthy()
    // The owner (2026-10-30): no legend under the period bar and no key paragraph under the table; the words are inside the parts and on the hover.
    expect(screen.queryByText(/A green bar is money sent/)).toBeNull()
    expect(within(period).getByText('owed $1,934.00')).toBeTruthy()
    // A report with nothing paid on it: Record payment, blue, in Cash due, and not in Actions (the owner, 2026-10-30).
    const sidRow = screen.getByText('Sid Sample').closest('tr') as HTMLElement
    const sidCells = sidRow.querySelectorAll('td')
    const recordInCashDue = within(sidCells[1] as HTMLElement).getByRole('button', { name: 'Record payment' })
    expect(recordInCashDue.getAttribute('data-draft-payroll-record-in-cash-due')).not.toBeNull()
    expect(within(sidCells[4] as HTMLElement).queryByRole('button', { name: 'Record payment' })).toBeNull()
    expect(screen.queryByTestId('draft-payroll-row-bar-Sid Sample')).toBeNull()
    // A part-paid report keeps its bar and its Record payment in Actions.
    const pacoRow = screen.getByText('Paco Sample').closest('tr') as HTMLElement
    expect(within(pacoRow.querySelectorAll('td')[4] as HTMLElement).getByRole('button', { name: 'Record payment' })).toBeTruthy()
    // The $ column draws its cents smaller.
    const money = screen.getAllByText((_, el) => el?.hasAttribute('data-draft-payroll-money') === true && el.textContent === '$1,071.00')
    expect(money).toHaveLength(1)
    expect(money[0]?.querySelector('span')?.textContent).toBe('.00')
  })

  it('a dev with ?sbs=1 sees today over the bars, with no switch', () => {
    auth.role = 'dev'
    mount(<DraftPayrollModal {...props()} />, '/people?tab=pay_stubs&sbs=1')
    const both = screen.getByTestId('draft-payroll-side-by-side')
    expect(within(both).getByText('Today')).toBeTruthy()
    expect(within(both).getByText('With the bars')).toBeTruthy()
    expect(within(both).getByText(/Total: \$4,498\.00/)).toBeTruthy()
    expect(within(both).getByTestId('draft-payroll-period-bar')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show the bars' })).toBeNull()
  })

  it('?sbs=1 does nothing for anyone but a dev', () => {
    mount(<DraftPayrollModal {...props()} />, '/people?tab=pay_stubs&sbs=1')
    expect(screen.queryByTestId('draft-payroll-side-by-side')).toBeNull()
    expect(screen.getByText(/Total: \$4,498\.00/)).toBeTruthy()
  })
})
