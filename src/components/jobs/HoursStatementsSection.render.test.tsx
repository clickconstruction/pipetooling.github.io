// @vitest-environment jsdom
/**
 * Render smoke for the Hours statements section (punch list #212, PR 2): the saved rows with their record id, state,
 * kind and who saved them; the press with its count; Print again from a row's snapshot; Open handing the window the
 * row; the empty section naming the press, or saying why there is no one to make a statement for; who sees it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { HoursStatementRecordRow, HoursStatementSnapshot } from '../../lib/people/hoursStatementsIo'
import { HoursStatementsSection } from './HoursStatementsSection'

// Every name, job and number here is made up.
let authRole = 'dev'
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-office', email: 'office@example.com' }, role: authRole, profileName: 'Dana Office' }) }))
let payAccess = true
vi.mock('../../hooks/usePeopleAccess', () => ({ usePeopleAccess: () => ({ canAccessPay: payAccess, accessResolved: true }) }))

let rows: HoursStatementRecordRow[] = []
vi.mock('../../lib/people/hoursStatementsIo', () => ({
  listHoursStatementsForJob: () => Promise.resolve(rows),
  listHoursStatementsForUser: () => Promise.resolve(rows),
  saveHoursStatement: () => Promise.reject(new Error('not here')),
}))
let peopleCount = 2
let jobsCount = 3
vi.mock('../../lib/people/hoursStatementRead', () => ({
  listHoursStatementPeople: () => Promise.resolve(Array.from({ length: peopleCount }, (_, i) => ({ userId: `u${i}`, name: `Person ${i}`, role: 'helpers', firstDay: '2026-06-01', lastDay: '2026-06-02', sessions: 1 }))),
  listHoursStatementJobs: () => Promise.resolve(Array.from({ length: jobsCount }, (_, i) => ({ jobId: `j${i}`, number: `${1040 + i}`, name: `Job ${i}`, customer: null, site: '', firstDay: '2026-06-01', lastDay: '2026-06-02', sessions: 1 }))),
  hoursStatementJobNumber: (j: { id: string; hcp_number: string | null; click_number: string | null }) => (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || j.id.slice(0, 8),
}))
const printSpy = vi.fn((build: () => Promise<string>) => build().then(() => true))
const buildSpy = vi.fn((_snap: HoursStatementSnapshot, recordId: string | null) => `<p>paper ${recordId}</p>`)
vi.mock('../../lib/people/hoursStatementPrint', () => ({
  buildHoursStatementPaper: (snap: HoursStatementSnapshot, id: string | null) => buildSpy(snap, id),
  printHoursStatementPaper: (build: () => Promise<string>) => printSpy(build),
}))
vi.mock('./HoursStatementModal', () => ({
  HoursStatementModal: ({ scope, maker, existing, onClose }: { scope: { kind: string }; maker: { role: string | null; canAccessPay: boolean }; existing: { record_id: string } | null; onClose: () => void }) => (
    <div data-testid="window-stub">
      window from {scope.kind} for {maker.role} pay {String(maker.canAccessPay)} on {existing?.record_id ?? 'a new one'}
      <button type="button" onClick={onClose}>
        close window
      </button>
    </div>
  ),
}))

const snapshot: HoursStatementSnapshot = {
  input: { kind: 'clock', periodStart: '2026-06-01', periodEnd: '2026-06-13', rows: [], withPay: true, worker: { name: 'Marcus Reyes' } },
  worker: { name: 'Marcus Reyes', standing: 'helper' },
  job: { number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St', isOfficeJob: false },
  approvedBy: 'Dana Office',
  preparedBy: 'Dana Office',
  preparedOn: 'October 29, 2026',
  asOf: 'October 29, 2026 3:00 pm',
}
function row(p: Partial<HoursStatementRecordRow> = {}): HoursStatementRecordRow {
  return {
    id: 'hs-1',
    record_id: 'HS-1042-0001',
    job_ledger_id: 'job-1',
    person_id: 'p-marcus',
    user_id: 'u-marcus',
    labor_company: null,
    period_start: '2026-06-01',
    period_end: '2026-06-13',
    with_pay: true,
    kind: 'clock',
    stated_days: [],
    gap_from: null,
    gap_to: null,
    snapshot,
    prepared_by: 'u-office',
    prepared_at: '2026-10-29T20:00:00Z',
    contract_document_id: null,
    matter_document_id: null,
    state: 'draft',
    created_at: '2026-10-29T20:00:00Z',
    updated_at: '2026-10-29T20:00:00Z',
    worker: { name: 'Marcus Reyes' },
    prepared_by_user: { name: 'Dana Office' },
    job: { hcp_number: '1042', click_number: null, job_name: 'Ridgeway Lofts' },
    ...p,
  }
}
const job = makeJob({ id: 'job-1', hcp_number: '1042', job_name: 'Ridgeway Lofts', job_address: '12 Elm St', customer_name: 'Ridgeway Builders' })
const jobScope = { kind: 'job' as const, job: { id: job.id, hcp_number: job.hcp_number, click_number: job.click_number, job_name: job.job_name, job_address: job.job_address, customer_name: job.customer_name ?? null } }

describe('the Hours statements section (punch list #212, PR 2)', () => {
  beforeEach(() => {
    authRole = 'dev'
    payAccess = true
    rows = []
    peopleCount = 2
    jobsCount = 3
    printSpy.mockClear()
    buildSpy.mockClear()
  })

  it('lists a saved statement with its record, state, kind and who saved it; the press carries its count; Print prints it again; Open hands the window the row', async () => {
    rows = [row(), row({ id: 'hs-2', record_id: 'HS-1042-0002', state: 'printed', with_pay: false, worker: { name: 'Lena Ortiz' } })]
    renderWithProviders(<HoursStatementsSection scope={jobScope} />)
    const list = await screen.findAllByTestId('hours-statement-row')
    expect(list).toHaveLength(2)
    expect(list[0]!.textContent).toContain('HS-1042-0001')
    expect(list[0]!.textContent).toContain('Draft')
    expect(list[0]!.textContent).toContain('Marcus Reyes')
    expect(list[0]!.textContent).toContain('June 1 – June 13, 2026')
    expect(list[0]!.textContent).toContain('hours and pay')
    expect(list[0]!.textContent).toContain('October 29, 2026 by Dana Office')
    expect(list[1]!.textContent).toContain('Printed')
    expect(list[1]!.textContent).toContain('hours only')
    expect(screen.getByRole('button', { name: 'Hours statement… · 2 people clocked here' })).toBeTruthy()
    fireEvent.click(within(list[0]!).getByRole('button', { name: 'Print HS-1042-0001' }))
    expect(buildSpy).toHaveBeenCalledWith(snapshot, 'HS-1042-0001')
    expect(printSpy).toHaveBeenCalledTimes(1)
    fireEvent.click(within(list[1]!).getByRole('button', { name: 'Open HS-1042-0002' }))
    expect(screen.getByTestId('window-stub').textContent).toContain('window from job for dev pay true on HS-1042-0002')
    fireEvent.click(screen.getByRole('button', { name: 'close window' }))
    expect(screen.queryByTestId('window-stub')).toBeNull()
  })

  it('an empty section names the press, and the press opens the window on a new statement', async () => {
    renderWithProviders(<HoursStatementsSection scope={jobScope} />)
    await screen.findByText(/No hours statements are saved on this job yet\./)
    const presses = screen.getAllByRole('button', { name: 'Hours statement… · 2 people clocked here' })
    expect(presses).toHaveLength(2)
    fireEvent.click(presses[1]!)
    expect(screen.getByTestId('window-stub').textContent).toContain('on a new one')
  })

  it('with nobody clocked on the job, the press is dead and the section says why', async () => {
    peopleCount = 0
    renderWithProviders(<HoursStatementsSection scope={jobScope} />)
    await screen.findByText('Nothing is clocked on this job yet, so there is no one to make a statement for.')
    const press = screen.getByRole('button', { name: 'Hours statement…' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
  })

  it('on a person, the job column reads the job and the press counts jobs', async () => {
    rows = [row()]
    renderWithProviders(<HoursStatementsSection scope={{ kind: 'person', userId: 'u-marcus', name: 'Marcus Reyes' }} canAccessPay={false} desk />)
    const list = await screen.findAllByTestId('hours-statement-row')
    expect(list[0]!.textContent).toContain('1042 · Ridgeway Lofts')
    expect(screen.getByRole('button', { name: 'Hours statement… · 3 jobs clocked' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hours statement… · 3 jobs clocked' }))
    expect(screen.getByTestId('window-stub').textContent).toContain('window from person for dev pay false')
  })

  it('a helper and a master without pay access see nothing; an assistant sees it with the pay off', async () => {
    authRole = 'helpers'
    const first = renderWithProviders(<HoursStatementsSection scope={jobScope} />)
    expect(first.container.textContent).toBe('')
    first.unmount()
    authRole = 'master_technician'
    payAccess = false
    const second = renderWithProviders(<HoursStatementsSection scope={jobScope} />)
    expect(second.container.textContent).toBe('')
    second.unmount()
    authRole = 'assistant'
    renderWithProviders(<HoursStatementsSection scope={jobScope} />)
    await screen.findByText(/No hours statements are saved on this job yet\./)
    fireEvent.click(screen.getAllByRole('button', { name: 'Hours statement… · 2 people clocked here' })[0]!)
    expect(screen.getByTestId('window-stub').textContent).toContain('for assistant pay false')
  })
})
