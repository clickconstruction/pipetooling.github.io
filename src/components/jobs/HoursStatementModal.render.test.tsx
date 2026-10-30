// @vitest-environment jsdom
/**
 * Render smoke for the Hours statement window (punch list #212, PR 2): on a job the first person who clocked here is
 * picked with their span and the paper draws as a draft; the span line and the held line read; Save a draft writes the
 * row with the read as its snapshot and the paper then carries the record id; Print saves as printed and prints with
 * the id; an assistant's pay switch is fixed off and the read is asked without pay; Send for signature… and Sign here
 * now are held with their reason; from a person the job is picked instead.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { HoursStatementJob, HoursStatementPerson, HoursStatementRead, HoursStatementReadArgs } from '../../lib/people/hoursStatementRead'
import type { HoursStatementRecordRow, HoursStatementSave } from '../../lib/people/hoursStatementsIo'
import { HOURS_STATEMENT_PAY_FIXED_OFF, HOURS_STATEMENT_SIGNING_HELD } from '../../lib/people/hoursStatementWindow'
import { HoursStatementModal } from './HoursStatementModal'

// Every name, job and number here is made up.
let authRole = 'dev'
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-office', email: 'office@example.com' }, role: authRole, profileName: 'Dana Office' }) }))

const people: HoursStatementPerson[] = [
  { userId: 'u-marcus', name: 'Marcus Reyes', role: 'helpers', firstDay: '2026-06-01', lastDay: '2026-06-13', sessions: 3 },
  { userId: 'u-lena', name: 'Lena Ortiz', role: 'helpers', firstDay: '2026-06-08', lastDay: '2026-06-09', sessions: 1 },
]
const jobs: HoursStatementJob[] = [
  { jobId: 'job-1', number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St', firstDay: '2026-06-01', lastDay: '2026-06-13', sessions: 3 },
  { jobId: 'job-2', number: '1050', name: 'Maple Court', customer: null, site: '4 Maple Ct', firstDay: '2026-05-01', lastDay: '2026-05-02', sessions: 1 },
]
function readFor(args: HoursStatementReadArgs): HoursStatementRead {
  return {
    input: {
      kind: 'clock',
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      rows: [
        { day: '2026-06-01', hours: 8, note: 'Rough-in', inLabel: '7:00 am', outLabel: '3:30 pm' },
        { day: '2026-06-02', hours: 8, note: 'Rough-in', inLabel: '7:00 am', outLabel: '3:30 pm' },
        { day: '2026-06-03', hours: 4, note: 'Water lines', inLabel: '7:00 am', outLabel: '11:00 am', pending: true },
      ],
      withPay: args.withPay,
      dayRates: { '2026-06-01': 24, '2026-06-02': 24 },
      payGroups: [{ key: 'stub-1', label: 'Week of May 31', from: '2026-05-31', to: '2026-06-06', due: 500, payments: [{ on: '2026-06-12', amount: 500, memo: null, sourceKind: 'cashapp', sourceId: 'D-1' }] }],
      firstRecordedDay: '2026-03-12',
      addStatedBlock: args.addStatedBlock === true,
      worker: { name: 'Marcus Reyes' },
    },
    worker: { name: 'Marcus Reyes', standing: 'helper' },
    approvedBy: 'Dana Office',
    isOfficeJob: false,
    personId: 'p-marcus',
    payName: 'Marcus Reyes',
    counts: { approved: 2, pending: 1, typedDays: 1, quickAddsLeftOff: 0 },
  }
}
const loadSpy = vi.fn((args: HoursStatementReadArgs) => Promise.resolve(readFor(args)))
vi.mock('../../lib/people/hoursStatementRead', () => ({
  listHoursStatementPeople: () => Promise.resolve(people),
  listHoursStatementJobs: () => Promise.resolve(jobs),
  loadHoursStatementInputs: (args: HoursStatementReadArgs) => loadSpy(args),
}))

function savedRow(args: HoursStatementSave): HoursStatementRecordRow {
  return {
    id: args.id ?? 'hs-1',
    record_id: 'HS-1042-0001',
    job_ledger_id: args.jobId,
    person_id: args.personId,
    user_id: args.userId,
    labor_company: null,
    period_start: args.periodStart,
    period_end: args.periodEnd,
    with_pay: args.withPay,
    kind: args.kind,
    stated_days: args.statedDays,
    gap_from: args.gap?.from ?? null,
    gap_to: args.gap?.to ?? null,
    snapshot: args.snapshot,
    prepared_by: args.preparedBy,
    prepared_at: '2026-10-29T20:00:00Z',
    contract_document_id: null,
    matter_document_id: null,
    state: args.state,
    created_at: '2026-10-29T20:00:00Z',
    updated_at: '2026-10-29T20:00:00Z',
    worker: { name: 'Marcus Reyes' },
    prepared_by_user: { name: 'Dana Office' },
    job: { hcp_number: '1042', click_number: null, job_name: 'Ridgeway Lofts' },
  }
}
const saveSpy = vi.fn((args: HoursStatementSave) => Promise.resolve(savedRow(args)))
vi.mock('../../lib/people/hoursStatementsIo', () => ({ saveHoursStatement: (args: HoursStatementSave) => saveSpy(args) }))

let printedHtml: string | null = null
const printSpy = vi.fn(async (build: () => Promise<string>) => {
  try {
    printedHtml = await build()
    return true
  } catch {
    return false
  }
})
vi.mock('../../lib/jobsDocuments/printWindow', () => ({ openHtmlWindowWhenReady: (build: () => Promise<string>) => printSpy(build) }))

const jobScope = { kind: 'job' as const, job: { id: 'job-1', number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St' } }
const payroll = { role: 'dev', canAccessPay: true }
const paper = () => screen.getByTestId('hours-statement-paper').getAttribute('srcdoc') ?? ''

describe('the Hours statement window (punch list #212, PR 2)', () => {
  beforeEach(() => {
    authRole = 'dev'
    loadSpy.mockClear()
    saveSpy.mockClear()
    printSpy.mockClear()
    printedHtml = null
  })

  it('on a job, the first person who clocked here is picked with their span, the paper draws as a draft, and the span and held lines read', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    expect((screen.getByLabelText('Who') as HTMLSelectElement).value).toBe('u-marcus')
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-06-01')
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('2026-06-13')
    expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1', userId: 'u-marcus', periodStart: '2026-06-01', periodEnd: '2026-06-13', withPay: true }))
    expect(paper()).toContain('Marcus Reyes')
    expect(paper()).toContain('draft, not yet filed')
    expect(paper()).toContain('Statement of hours worked and paid')
    expect(screen.getByTestId('hours-statement-span').textContent).toContain('The app has 2 approved sessions on this job in this span. 1 day was typed by hand.')
    expect(screen.getByTestId('hours-statement-span').textContent).toContain('1 session is still waiting for approval.')
  })

  it('Save a draft writes the row with the read as its snapshot and mints the record id; the paper then carries it', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.click(screen.getByRole('button', { name: 'Save a draft' }))
    await screen.findByText('Saved as HS-1042-0001 · Draft')
    expect(saveSpy).toHaveBeenCalledTimes(1)
    const args = saveSpy.mock.calls[0]![0]
    expect(args).toMatchObject({ id: null, jobId: 'job-1', jobNumber: '1042', userId: 'u-marcus', personId: 'p-marcus', periodStart: '2026-06-01', periodEnd: '2026-06-13', withPay: true, kind: 'clock', state: 'draft', preparedBy: 'u-office' })
    expect(args.snapshot.worker).toEqual({ name: 'Marcus Reyes', standing: 'helper' })
    expect(args.snapshot.job).toEqual({ number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St', isOfficeJob: false })
    expect(args.snapshot.input.rows).toHaveLength(3)
    expect(args.gap).toBeNull()
    await waitFor(() => expect(paper()).toContain('HS-1042-0001'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('a span that starts before the app’s first day saves its gap', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-09-15' } })
    await waitFor(() => expect(loadSpy).toHaveBeenLastCalledWith(expect.objectContaining({ periodStart: '2025-09-15' })))
    await waitFor(() => expect(paper()).toContain('Days the company’s records do not show'))
    fireEvent.click(screen.getByRole('button', { name: 'Save a draft' }))
    await screen.findByText('Saved as HS-1042-0001 · Draft')
    expect(saveSpy.mock.calls[0]![0].gap).toEqual({ from: '2025-09-15', to: '2026-03-11' })
  })

  it('Print saves the statement as printed and prints the paper with its record id, filing nothing', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(printedHtml).toContain('HS-1042-0001'))
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ state: 'printed' }))
    await screen.findByText('Saved as HS-1042-0001 · Printed')
  })

  it('an assistant’s pay switch is fixed off, the read is asked without pay, and the paper carries hours alone', async () => {
    authRole = 'assistant'
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={{ role: 'assistant', canAccessPay: false }} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    const pay = screen.getByLabelText(/Show the rate, the amount and what was paid/) as HTMLInputElement
    expect(pay.disabled).toBe(true)
    expect(pay.checked).toBe(false)
    expect(screen.getByText(HOURS_STATEMENT_PAY_FIXED_OFF)).toBeTruthy()
    expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ withPay: false }))
    expect(paper()).toContain('Statement of hours worked<')
    expect(paper()).not.toContain('and paid')
  })

  it('Send for signature… and Sign here now are drawn and held with their reason', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    const send = screen.getByRole('button', { name: 'Send for signature…' }) as HTMLButtonElement
    const sign = screen.getByRole('button', { name: 'Sign here now' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(sign.disabled).toBe(true)
    expect(send.title).toBe(HOURS_STATEMENT_SIGNING_HELD)
    expect(screen.getByText(HOURS_STATEMENT_SIGNING_HELD)).toBeTruthy()
  })

  it('from a person, the job is picked instead, newest first, and the read names it', async () => {
    renderWithProviders(<HoursStatementModal open scope={{ kind: 'person', userId: 'u-marcus', name: 'Marcus Reyes' }} maker={payroll} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    const job = screen.getByLabelText('Job') as HTMLSelectElement
    expect(job.value).toBe('job-1')
    expect(Array.from(job.options).map((o) => o.textContent)).toEqual(['1042 · Ridgeway Lofts · 3 sessions', '1050 · Maple Court · 1 session'])
    expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1', userId: 'u-marcus' }))
    fireEvent.change(job, { target: { value: 'job-2' } })
    await waitFor(() => expect(loadSpy).toHaveBeenLastCalledWith(expect.objectContaining({ jobId: 'job-2', periodStart: '2026-05-01', periodEnd: '2026-05-02' })))
    await waitFor(() => expect(paper()).toContain('Maple Court'))
  })

  it('opened on a saved statement, its who and span fill in and Save keeps its record', async () => {
    const existing = savedRow({ id: 'hs-9', jobId: 'job-1', jobNumber: '1042', userId: 'u-lena', personId: null, laborCompany: null, periodStart: '2026-06-08', periodEnd: '2026-06-09', withPay: true, kind: 'clock', statedDays: [], gap: null, snapshot: readFor({ jobId: 'job-1', userId: 'u-lena', periodStart: '2026-06-08', periodEnd: '2026-06-09', withPay: true }) as never, state: 'printed', preparedBy: 'u-office' })
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} existing={existing} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    expect((screen.getByLabelText('Who') as HTMLSelectElement).value).toBe('u-lena')
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-06-08')
    expect(screen.getByTestId('hours-statement-saved').textContent).toBe('Saved as HS-1042-0001 · Printed')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'hs-9', state: 'printed' })))
  })

  it('Escape and the backdrop close it; the panel does not', async () => {
    const onClose = vi.fn()
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={onClose} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.click(screen.getByTestId('hours-statement-window'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
