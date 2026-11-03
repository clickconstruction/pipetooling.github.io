// @vitest-environment jsdom
/**
 * Render smoke for the Statements of charges section (punch list #254, PR 2): the saved rows with their record id,
 * state, period, figures and who saved them; the press with its counts, dead with nothing to make one from; Print
 * again from a row's snapshot; Open handing the window the row; the empty section naming the press; who sees it.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { ChargeStatementRow } from '../../lib/charges/chargeStatementsIo'
import { statementOfChargesPressWords } from '../../lib/charges/statementOfCharges'
import { StatementsOfChargesSection } from './StatementsOfChargesSection'

// Every name, job and number here is made up.
let authRole = 'dev'
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-office', email: 'office@example.com' }, role: authRole, profileName: 'Dana Office' }) }))
let payAccess = true
vi.mock('../../hooks/usePeopleAccess', () => ({ usePeopleAccess: () => ({ canAccessPay: payAccess, accessResolved: true }) }))
let rows: ChargeStatementRow[] = []
vi.mock('../../lib/charges/chargeStatementsIo', () => ({ listChargeStatementsForJob: () => Promise.resolve(rows), saveChargeStatement: () => Promise.reject(new Error('not here')) }))
let peopleCount = 2
vi.mock('../../lib/people/hoursStatementRead', () => ({
  listHoursStatementPeople: () => Promise.resolve(Array.from({ length: peopleCount }, (_, i) => ({ userId: `u${i}`, name: `Person ${i}` }))),
  hoursStatementJobNumber: (j: { id: string; hcp_number: string | null; click_number: string | null }) => (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || j.id.slice(0, 8),
}))
let linesCount = 3
vi.mock('../../lib/charges/jobChargesRead', () => ({ loadMaterialLines: () => Promise.resolve(Array.from({ length: linesCount }, (_, i) => ({ id: `l${i}` }))) }))
const printSpy = vi.fn((build: () => Promise<string>) => build().then(() => true))
vi.mock('../../lib/jobsDocuments/printWindow', () => ({ openHtmlWindowWhenReady: (build: () => Promise<string>) => printSpy(build) }))
const buildSpy = vi.fn((args: { recordId: string | null; copy: string }) => `<p>paper ${args.recordId} ${args.copy}</p>`)
vi.mock('../../lib/charges/statementOfCharges', async () => {
  const real = await vi.importActual<typeof import('../../lib/charges/statementOfCharges')>('../../lib/charges/statementOfCharges')
  return { ...real, buildChargeStatementHtml: (args: { recordId: string | null; copy: string }) => buildSpy(args) }
})
vi.mock('./StatementOfChargesWindow', () => ({
  default: ({ job, existing, onClose }: { job: { number: string }; existing: { record_id: string } | null; onClose: () => void }) => (
    <div data-testid="window-stub">
      window for {job.number} on {existing?.record_id ?? 'a new one'}
      <button type="button" onClick={onClose}>
        close window
      </button>
    </div>
  ),
}))

const job = { id: 'j1', hcp_number: '1042', click_number: null, job_name: 'ROUGH IN', job_address: '1 Field Rd', customer_name: 'A customer' }
const row = (over: Partial<ChargeStatementRow>): ChargeStatementRow => ({
  id: 'r1',
  record_id: 'SC-1042-0001',
  job_ledger_id: 'j1',
  period_start: '2026-04-01',
  period_end: '2026-04-30',
  snapshot: { input: { sessions: [], lines: [], card: { rates: {}, extraPerson: null, materialsMarkupPct: null }, rule: { kind: 'crew' }, markupPct: null, adjustments: [], revenue: 0 }, period: { start: '2026-04-01', end: '2026-04-30' }, job: { number: '1042', name: 'ROUGH IN', customer: 'A customer', site: '1 Field Rd' }, preparedBy: 'Dana Office', preparedOn: 'November 3, 2026', asOf: 'Nov 3', nameImportedDays: true },
  labor_usd: 4970,
  materials_usd: 1778.85,
  charges_usd: 6748.85,
  premium_usd: 3251.15,
  state: 'printed',
  prepared_by: 'u-office',
  prepared_at: '2026-11-03T15:00:00Z',
  created_at: '2026-11-03T15:00:00Z',
  updated_at: '2026-11-03T15:00:00Z',
  prepared_by_user: { name: 'Dana Office' },
  ...over,
})

describe('StatementsOfChargesSection', () => {
  it('words the press with its counts, dead only with nothing', () => {
    expect(statementOfChargesPressWords(null, null)).toEqual({ label: 'Statement of charges…', dead: false })
    expect(statementOfChargesPressWords(6, 11)).toEqual({ label: 'Statement of charges… · 6 people, 11 material lines', dead: false })
    expect(statementOfChargesPressWords(1, 1)).toEqual({ label: 'Statement of charges… · 1 person, 1 material line', dead: false })
    expect(statementOfChargesPressWords(0, 0)).toEqual({ label: 'Statement of charges… · 0 people, 0 material lines', dead: true })
  })

  it('lists the rows with their figures, prints a row again from its snapshot, and Open hands the window the row', async () => {
    rows = [row({}), row({ id: 'r2', record_id: 'SC-1042-0002', state: 'draft', charges_usd: null, labor_usd: null, materials_usd: null })]
    renderWithProviders(<StatementsOfChargesSection job={job} />)
    await waitFor(() => expect(screen.getAllByTestId('soc-row')).toHaveLength(2))
    expect(screen.getByTestId('soc-press').textContent).toBe('Statement of charges… · 2 people, 3 material lines')
    const first = screen.getAllByTestId('soc-row')[0]!
    expect(first.textContent).toContain('SC-1042-0001')
    expect(first.textContent).toContain('Printed')
    expect(first.textContent).toContain('April 1 – April 30, 2026')
    expect(first.textContent).toContain('by Dana Office')
    expect(first.querySelector('[aria-label="$6,748.85"]')).toBeTruthy()
    expect(screen.getAllByTestId('soc-row')[1]!.textContent).toContain('Draft')
    fireEvent.click(screen.getByLabelText('Print SC-1042-0001'))
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1))
    expect(buildSpy).toHaveBeenCalledWith(expect.objectContaining({ recordId: 'SC-1042-0001', copy: 'office' }))
    fireEvent.click(screen.getByLabelText('Open SC-1042-0002'))
    expect(screen.getByTestId('window-stub').textContent).toContain('window for 1042 on SC-1042-0002')
    fireEvent.click(screen.getByText('close window'))
    expect(screen.queryByTestId('window-stub')).toBeNull()
    fireEvent.click(screen.getByTestId('soc-press'))
    expect(screen.getByTestId('window-stub').textContent).toContain('window for 1042 on a new one')
  })

  it('an empty section names the press, and with nothing to make one from the press is dead', async () => {
    rows = []
    renderWithProviders(<StatementsOfChargesSection job={job} />)
    await waitFor(() => expect(screen.getByText('Nothing charged into a statement yet.')).toBeTruthy())
    await waitFor(() => expect(screen.getByTestId('soc-press').textContent).toContain('2 people'))
    expect(screen.getAllByText('Statement of charges… · 2 people, 3 material lines')).toHaveLength(2)
  })

  it('with no one clocked and nothing bought the press is dead and the empty state offers nothing', async () => {
    rows = []
    peopleCount = 0
    linesCount = 0
    renderWithProviders(<StatementsOfChargesSection job={job} />)
    await waitFor(() => expect((screen.getByTestId('soc-press') as HTMLButtonElement).disabled).toBe(true))
    expect(screen.getAllByText(/Statement of charges…/)).toHaveLength(1)
    peopleCount = 2
    linesCount = 3
  })

  it('a helper without the pay gate sees no section', () => {
    authRole = 'helpers'
    payAccess = false
    const { container } = renderWithProviders(<StatementsOfChargesSection job={job} />)
    expect(container.querySelector('[data-testid="statements-of-charges-section"]')).toBeNull()
    authRole = 'dev'
    payAccess = true
  })
})
