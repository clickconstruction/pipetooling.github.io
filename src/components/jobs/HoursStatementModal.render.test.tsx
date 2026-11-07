// @vitest-environment jsdom
/**
 * Render smoke for the Hours statement window (punch list #212, PR 2): on a job the first person who clocked here is
 * picked with their span and the paper draws as a draft; the span line and the held line read; Save a draft writes the
 * row with the read as its snapshot and the paper then carries the record id; Print saves as printed and prints with
 * the id; the controller's pay switch is on and may be turned off; from a person the job is picked
 * instead. Since PR 3 (v2.6411): Send for signature… saves, draws the form and opens the channel sheet with the worker's
 * contact; a channel prepares, mints the link, hands it on its way and moves the statement to sent; Sign here now does
 * the in-person channel in one press; File a signed scan… files the paper path; a signed statement opens its PDF.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { HoursStatementJob, HoursStatementPerson, HoursStatementRead, HoursStatementReadArgs } from '../../lib/people/hoursStatementRead'
import type { HoursStatementRecordRow, HoursStatementSave } from '../../lib/people/hoursStatementsIo'
import { HOURS_STATEMENT_OPEN_WORDS, HOURS_STATEMENT_SENT_WORDS, HOURS_STATEMENT_SIGNED_WORDS } from '../../lib/people/hoursStatementSigning'
import type { HoursStatementSigningIo, PreparedSigning, ScanFiling } from '../../lib/people/hoursStatementSigningIo'
import { HoursStatementModal } from './HoursStatementModal'

// Every name, job and number here is made up.
let authRole = 'dev'
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-office', email: 'office@example.com' }, role: authRole, profileName: 'Dana Office' }) }))

const people: HoursStatementPerson[] = [
  { userId: 'u-marcus', name: 'Marcus Reyes', role: 'helpers', firstDay: '2026-06-01', lastDay: '2026-06-13', sessions: 3 },
  { userId: 'u-lena', name: 'Lena Ortiz', role: 'helpers', firstDay: '2026-06-08', lastDay: '2026-06-09', sessions: 1 },
  // A sub on the job's sheets (v2.6636): never clocked, so the sheets are the count.
  { userId: 'u-dale', name: 'Dale Whitfield', role: 'subcontractor', firstDay: '2026-05-04', lastDay: '2026-05-18', sessions: 2, kind: 'sheet' },
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
    charge: args.basis === 'charged' ? (chargedNobody.on ? { rate: 285, words: 'the crew on each day · $285.00 the crew’s hour', unpriced: ['Nobody out that day is charged to a customer.'], crewDays: 2, uncharged: [{ userId: 'u-marcus', name: 'Marcus', days: 2 }], unchargedDays: 2 } : { rate: 285, words: 'master with a helper throughout · $285.00 the crew’s hour', unpriced: [], crewDays: 2, uncharged: [], unchargedDays: 0 }) : null,
  }
}
/** The window's read as a saved row keeps it. */
function snapshotFor(args: HoursStatementReadArgs) {
  const r = readFor(args)
  return { input: r.input, worker: r.worker, job: { number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St', isOfficeJob: false }, approvedBy: r.approvedBy, preparedBy: 'Dana Office', preparedOn: 'October 29, 2026', asOf: 'October 29, 2026 3:00 pm' }
}
/** The charged read when nobody out counts as anything yet (the live pass). */
const chargedNobody = { on: false }
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

const prepareSpy = vi.fn((statementId: string, how: string): Promise<PreparedSigning> => Promise.resolve({ documentId: `doc-for-${statementId}-${how}`, documentStatus: 'unsent', recordId: 'HS-1042-0001', documentName: 'Hours statement HS-1042-0001', worker: { name: 'Marcus Reyes', email: 'marcus@example.com', phone: '(555) 555-0100' } }))
const sendSpy = vi.fn((_documentId: string, _args: { channel: string; email: string | null }) => Promise.resolve({ acceptUrl: 'https://clicktooling.com/contract/accept?t=tok', emailed: true, emailError: null }))
const markSentSpy = vi.fn((statementId: string) => Promise.resolve({ ...savedRow({ id: statementId, jobId: 'job-1', jobNumber: '1042', userId: 'u-marcus', personId: 'p-marcus', laborCompany: null, periodStart: '2026-06-01', periodEnd: '2026-06-13', withPay: true, kind: 'clock', statedDays: [], gap: null, snapshot: snapshotFor({ jobId: 'job-1', userId: 'u-marcus', periodStart: '2026-06-01', periodEnd: '2026-06-13', withPay: true }), state: 'sent', preparedBy: 'u-office' }), state: 'sent' as const }))
const fileScanSpy = vi.fn((_filing: ScanFiling) => Promise.resolve({ documentId: 'doc-paper' }))
const pdfSpy = vi.fn((documentId: string) => Promise.resolve(`https://files.example.com/${documentId}`))
const signingIo: HoursStatementSigningIo = {
  prepare: (id, how) => prepareSpy(id, how),
  send: (id, args) => sendSpy(id, args),
  markSent: (id) => markSentSpy(id),
  fileScan: (f) => fileScanSpy(f),
  openSignedPdf: (id) => pdfSpy(id),
}

const jobScope = { kind: 'job' as const, job: { id: 'job-1', number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St' } }
const payroll = { role: 'dev', canAccessPay: true }
const paper = () => screen.getByTestId('hours-statement-paper').getAttribute('srcdoc') ?? ''

describe('the Hours statement window (punch list #212, PR 2)', () => {
  beforeEach(() => {
    authRole = 'dev'
    loadSpy.mockClear()
    saveSpy.mockClear()
    printSpy.mockClear()
    prepareSpy.mockClear()
    sendSpy.mockClear()
    markSentSpy.mockClear()
    fileScanSpy.mockClear()
    pdfSpy.mockClear()
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

  it('a sub on the sheets is in the Who list by their sheets; picking them reads the sheet kind and holds the charged switch (v2.6636)', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    const who = screen.getByLabelText('Who') as HTMLSelectElement
    expect(Array.from(who.options).map((o) => o.textContent)).toEqual(['Marcus Reyes · 3 sessions', 'Lena Ortiz · 1 session', 'Dale Whitfield · 2 sheets'])
    loadSpy.mockClear()
    fireEvent.change(who, { target: { value: 'u-dale' } })
    await waitFor(() => expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-dale', periodStart: '2026-05-04', periodEnd: '2026-05-18', kind: 'sheet', basis: 'paid' })))
    const charged = screen.getByTestId('hours-statement-charged') as HTMLInputElement
    expect(charged.disabled).toBe(true)
    expect(screen.getByTestId('hours-statement-sheet-note').textContent).toBe('A sub’s sheet is agreed work, so the paper reads the sheet’s lines as paid.')
    // Back to a clock person: the switch is theirs again.
    fireEvent.change(who, { target: { value: 'u-lena' } })
    await waitFor(() => expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-lena', kind: 'clock' })))
    expect((screen.getByTestId('hours-statement-charged') as HTMLInputElement).disabled).toBe(false)
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

  it('the controller’s pay switch is on by default and may be turned off, which asks the read without pay and prints hours alone', async () => {
    authRole = 'controller'
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={{ role: 'controller', canAccessPay: true }} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    const pay = screen.getByLabelText(/Show the rate, the amount and what was paid/) as HTMLInputElement
    expect(pay.disabled).toBe(false)
    expect(pay.checked).toBe(true)
    expect(screen.queryByText(/The pay stays off/)).toBeNull()
    fireEvent.click(pay)
    await waitFor(() => expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ withPay: false })))
    await waitFor(() => expect(paper()).toContain('Statement of hours worked<'))
    expect(paper()).not.toContain('and paid')
  })

  it('Send for signature… saves the statement, draws its form and opens the channel sheet with the worker’s contact filled in', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} signingIo={signingIo} />)
    await screen.findByTestId('hours-statement-paper')
    expect(screen.getByText(HOURS_STATEMENT_OPEN_WORDS)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature…' }))
    await screen.findByTestId('hours-statement-send-sheet')
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ state: 'draft' }))
    expect(prepareSpy).toHaveBeenCalledWith('hs-1', 'email')
    expect((screen.getByLabelText('Worker’s email') as HTMLInputElement).value).toBe('marcus@example.com')
    expect((screen.getByLabelText('Worker’s cell') as HTMLInputElement).value).toBe('(555) 555-0100')
    expect(screen.getByRole('button', { name: 'Hand the phone to Marcus Reyes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy the link' })).toBeTruthy()
  })

  it('Email the link prepares the form for that channel, mints the link by email, moves the statement to sent and closes the sheet', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} signingIo={signingIo} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature…' }))
    await screen.findByTestId('hours-statement-send-sheet')
    fireEvent.click(screen.getByRole('button', { name: 'Email the link' }))
    await waitFor(() => expect(sendSpy).toHaveBeenCalledWith('doc-for-hs-1-email', { channel: 'email', email: 'marcus@example.com' }))
    expect(prepareSpy).toHaveBeenLastCalledWith('hs-1', 'email')
    await waitFor(() => expect(markSentSpy).toHaveBeenCalledWith('hs-1'))
    await screen.findByText('Saved as HS-1042-0001 · Waiting for a signature')
    expect(screen.queryByTestId('hours-statement-send-sheet')).toBeNull()
    expect(screen.getAllByText(HOURS_STATEMENT_SENT_WORDS).length).toBeGreaterThan(0)
    // A record now: Save is gone, the span is fixed, and it can still be sent again.
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect((screen.getByLabelText('From') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Send for signature…' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('an email with no address is held with its reason; Copy the link puts the link on the clipboard', async () => {
    prepareSpy.mockResolvedValueOnce({ documentId: 'doc-x', documentStatus: 'unsent', recordId: 'HS-1042-0001', documentName: 'Hours statement HS-1042-0001', worker: { name: 'Marcus Reyes', email: null, phone: null } })
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} signingIo={signingIo} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature…' }))
    await screen.findByTestId('hours-statement-send-sheet')
    const email = screen.getByRole('button', { name: 'Email the link' }) as HTMLButtonElement
    expect(email.disabled).toBe(true)
    expect(email.title).toBe('Add the worker’s email address first.')
    expect((screen.getByRole('button', { name: 'Text the link' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Copy the link' }))
    await waitFor(() => expect(sendSpy).toHaveBeenCalledWith('doc-for-hs-1-link', { channel: 'link', email: '' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://clicktooling.com/contract/accept?t=tok'))
    await waitFor(() => expect(markSentSpy).toHaveBeenCalledWith('hs-1'))
  })

  it('Sign here now saves, mints the link and opens the signing page on this device with the in-person flag', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}) as Window)
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} signingIo={signingIo} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.click(screen.getByRole('button', { name: 'Sign here now' }))
    await waitFor(() => expect(prepareSpy).toHaveBeenCalledWith('hs-1', 'in_person'))
    await waitFor(() => expect(sendSpy).toHaveBeenCalledWith('doc-for-hs-1-in_person', { channel: 'in_person', email: '' }))
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://clicktooling.com/contract/accept?t=tok&inperson=1', '_blank', 'noopener'))
    await screen.findByText('Saved as HS-1042-0001 · Waiting for a signature')
    openSpy.mockRestore()
  })

  it('File a signed scan… takes the paper, who signed, the day and the days written in the block, and files it as signed', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} signingIo={signingIo} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-09-15' } })
    await waitFor(() => expect(loadSpy).toHaveBeenLastCalledWith(expect.objectContaining({ periodStart: '2025-09-15' })))
    await waitFor(() => expect(paper()).toContain('Days the company’s records do not show'))
    fireEvent.click(screen.getByRole('button', { name: 'File a signed scan…' }))
    await screen.findByTestId('hours-statement-scan-sheet')
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'signed.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('The signed paper'), { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText('Signed on'), { target: { value: '2026-10-30' } })
    fireEvent.change(screen.getByLabelText('Stated day 1'), { target: { value: '2025-09-16' } })
    fireEvent.change(screen.getByLabelText('Stated hours 1'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Stated note 1'), { target: { value: 'Water lines' } })
    const press = screen.getByRole('button', { name: 'File the signed scan' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe('Confirm the days were typed exactly as the worker wrote them.')
    fireEvent.click(screen.getByLabelText(/typed exactly as the worker wrote them/))
    expect((screen.getByRole('button', { name: 'File the signed scan' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'File the signed scan' }))
    await waitFor(() => expect(fileScanSpy).toHaveBeenCalledTimes(1))
    const filing = fileScanSpy.mock.calls[0]![0]
    expect(filing).toMatchObject({ statementId: 'hs-1', signedOnYmd: '2026-10-30', signerPrintedName: 'Marcus Reyes', statedDays: [{ day: '2025-09-16', hours: '8', note: 'Water lines' }] })
    expect(filing.scan.mime).toBe('image/png')
    expect(filing.scan.base64.length).toBeGreaterThan(0)
    await screen.findByText('Saved as HS-1042-0001 · Signed')
    expect(screen.queryByTestId('hours-statement-scan-sheet')).toBeNull()
    expect(screen.getAllByText(HOURS_STATEMENT_SIGNED_WORDS).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Send for signature…' })).toBeNull()
  })

  it('a signed statement opens its PDF through the gate and offers no signing', async () => {
    const existing = { ...savedRow({ id: 'hs-7', jobId: 'job-1', jobNumber: '1042', userId: 'u-marcus', personId: 'p-marcus', laborCompany: null, periodStart: '2026-06-01', periodEnd: '2026-06-13', withPay: true, kind: 'clock', statedDays: [], gap: null, snapshot: snapshotFor({ jobId: 'job-1', userId: 'u-marcus', periodStart: '2026-06-01', periodEnd: '2026-06-13', withPay: true }), state: 'signed', preparedBy: 'u-office' }), contract_document_id: 'doc-7' }
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}) as Window)
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} existing={existing} onClose={() => undefined} signingIo={signingIo} />)
    await screen.findByTestId('hours-statement-paper')
    expect(screen.queryByRole('button', { name: 'Sign here now' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open the signed PDF' }))
    await waitFor(() => expect(pdfSpy).toHaveBeenCalledWith('doc-7'))
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://files.example.com/doc-7', '_blank', 'noopener'))
    openSpy.mockRestore()
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
    const existing = savedRow({ id: 'hs-9', jobId: 'job-1', jobNumber: '1042', userId: 'u-lena', personId: null, laborCompany: null, periodStart: '2026-06-08', periodEnd: '2026-06-09', withPay: true, kind: 'clock', statedDays: [], gap: null, snapshot: snapshotFor({ jobId: 'job-1', userId: 'u-lena', periodStart: '2026-06-08', periodEnd: '2026-06-09', withPay: true }), state: 'printed', preparedBy: 'u-office' })
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

describe('the charged paper (punch list #251, PR 2)', () => {
  it('the switch hands the read basis charged with the pay off, shows how the job charges its labor, and quiets the pay switch', async () => {
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={() => undefined} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.click(screen.getByTestId('hours-statement-charged'))
    await waitFor(() => expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ basis: 'charged', withPay: false })))
    await waitFor(() => expect(screen.getByTestId('hours-statement-charge-words').textContent).toContain('master with a helper throughout · $285.00 the crew’s hour'))
    expect(screen.getByTestId('hours-statement-charge-words').textContent).toContain('Change the job’s rule or the rate card in the Job Summary’s Charges window.')
    expect((screen.getByLabelText(/Show the rate, the amount and what was paid/) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('Off while the paper is charged to the customer.')).toBeTruthy()
  })

  it('when nobody out counts as anything, names who counts as nobody with the doors to fix it, in place of the paper’s neutral line', async () => {
    chargedNobody.on = true
    const onClose = vi.fn()
    renderWithProviders(<HoursStatementModal open scope={jobScope} maker={payroll} onClose={onClose} />)
    await screen.findByTestId('hours-statement-paper')
    fireEvent.click(screen.getByTestId('hours-statement-charged'))
    const callout = await screen.findByTestId('uncharged-callout')
    expect(callout.textContent).toContain('Marcus counts as nobody on the rate card yet. 2 days price at nothing until someone out counts as a master, a tech or a helper.')
    const words = screen.getByTestId('hours-statement-charge-words').textContent ?? ''
    expect(words).toBe('the crew on each day · $285.00 the crew’s hour')
    fireEvent.click(screen.getByRole('link', { name: 'Marcus’s desk · 2 days' }))
    expect(onClose).toHaveBeenCalled()
    chargedNobody.on = false
  })
})
