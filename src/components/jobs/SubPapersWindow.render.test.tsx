// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const io = vi.hoisted(() => ({ fileSentCopy: vi.fn(), printPdfAndFile: vi.fn(), saveBlobAs: vi.fn() }))
vi.mock('../../lib/sent/sentCopiesIo', () => ({ fileSentCopy: io.fileSentCopy, printPdfAndFile: io.printPdfAndFile }))
vi.mock('../../lib/storageSave', () => ({ saveBlobAs: io.saveBlobAs }))
// The register and the roster. `rows: null` is a database the migration has not reached: the read is refused and the mint is not found.
const db = vi.hoisted(() => ({ rows: null as unknown[] | null, reads: 0, mint: vi.fn(), invoke: vi.fn(), person: { email: 'harlan@harlanmechanical.example', phone: null } as { email: string | null; phone: string | null }, personError: null as { message: string } | null }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === 'people'
            ? { maybeSingle: async () => (db.personError ? { data: null, error: db.personError } : { data: db.person, error: null }) }
            : (async () => {
                db.reads += 1
                return db.rows === null ? { data: null, error: { code: '42P01', message: 'relation "sub_papers" does not exist' } } : { data: db.rows, error: null }
              })(),
      }),
    }),
    rpc: (...args: unknown[]) => db.mint(...args),
    functions: { invoke: (...args: unknown[]) => db.invoke(...args) },
  },
}))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve({ rowExists: true }),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Made-up Plumbing Co.', addressText: '1 Made-up Way\nAustin, TX', phone: '555-0100', email: 'office@example.com' }),
}))
// The papers' own check, with a switch: the kernel builds a set that agrees, so a test turns the refusal on.
const check = vi.hoisted(() => ({ refuse: false }))
vi.mock('../../../supabase/functions/_shared/subPapers', async (actual) => {
  const real = await actual<typeof import('../../../supabase/functions/_shared/subPapers')>()
  return { ...real, subPapersAddUp: (set: Parameters<typeof real.subPapersAddUp>[0]) => (check.refuse ? { ok: false, problems: ['Work statement 2057: the payments do not sum to Paid so far.'] } : real.subPapersAddUp(set)) }
})
const auth = vi.hoisted(() => ({ role: 'assistant', readOnly: false }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role, readOnly: auth.readOnly }) }))

import type { PaperContext } from '../../../supabase/functions/_shared/subPapers'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { paperSheetsFor } from '../../lib/subWorkOrders/subPapersInputs'
import type { LaborJob, LaborJobPayment } from '../../types/laborJob'
import { SubPapersWindowView, type SubPapersWindowViewProps } from './SubPapersWindow'
import { SubPapersWindow } from './SubPapersWindowConnected'
import { SCHEDULE_SHEET_Z } from '../schedule/ScheduleBlockSheet'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/** The connected window reads today from the clock; a month's statement closes on it. */
const todayYmdForTest = () => todayYmdInAppTz()

// Made-up people, jobs and money.
const ROSTER: NeedsWorkOrderRosterPerson[] = [{ id: 'harlan', name: 'Harlan Mechanical', kind: 'sub', accountRole: 'subcontractor' }]
const NAMES: Record<string, string> = { cedar: 'Cedar Hollow Clinic', ridge: 'Ridgeway Builders, Lot 12' }
type Pay = Partial<LaborJobPayment> & { id: string; amount: number }
function sheet(id: string, job: string, number: string, day: string, lines: Array<[string, number]>, pays: Pay[] = []): LaborJob {
  return {
    id,
    assigned_to_name: 'Harlan Mechanical',
    address: '1 Made-up Way',
    job_number: number,
    job_ledger_id: job,
    labor_rate: null,
    job_date: day,
    created_at: `${day}T15:00:00Z`,
    items: lines.map(([fixture, amount]) => ({ fixture, count: 1, hrs_per_unit: 0, direct_labor_amount: amount })),
    payments: pays.map((p, i) => ({ memo: null, created_at: `${p.payment_date ?? day}T16:0${i}:00Z`, ...p })),
    payment_events: [],
  }
}
const JOBS: LaborJob[] = [
  // $4,200.00 agreed, $1,500.00 paid, $100.00 back-charged: $2,600.00 still open.
  sheet('cedar-1', 'cedar', '2041', '2026-10-28', [['Rough-in', 2400], ['Top-out', 1800]], [
    { id: 'p226', amount: 1500, payment_date: '2026-10-31', method: 'check', method_ref: '1182', sending_id: 'snd226', sending_no: 226 },
    { id: 'b1', amount: -100, payment_date: '2026-11-10', memo: 'cleanup after top-out' },
  ]),
  // $2,500.00 agreed, nothing paid.
  sheet('ridge-1', 'ridge', '2057', '2026-11-03', [['Slab sleeves', 2500]]),
]
const ASSIGNEES = new Map(JOBS.map((j) => [j.id, [{ personId: 'harlan', personName: 'Harlan Mechanical' }]]))
const SHEETS = paperSheetsFor('id:harlan', JOBS, ASSIGNEES, NAMES, ROSTER)
const CTX: PaperContext = { company: { name: 'Made-up Plumbing Co.', lines: ['1 Made-up Way, Austin, TX'] }, sub: { name: 'Harlan Mechanical', lines: [] }, today: '2026-11-16', preparedAt: 'Nov 16, 2026 at 9:30 am', zone: 'Central time' }

function mountView(over: Partial<SubPapersWindowViewProps> = {}) {
  const props: SubPapersWindowViewProps = { open: { kind: 'statement' }, sheets: SHEETS, ctx: CTX, contact: { email: null, phone: null, portalUrl: null }, canSend: false, onDownload: vi.fn(), onPrint: vi.fn(), onClose: vi.fn(), ...over }
  render(<SubPapersWindowView {...props} />)
  return props
}

beforeEach(() => {
  check.refuse = false
  db.rows = null
  db.reads = 0
  db.mint.mockReset()
  db.invoke.mockReset()
  db.person = { email: 'harlan@harlanmechanical.example', phone: null }
  db.personError = null
  auth.role = 'assistant'
  auth.readOnly = false
  db.mint.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.mint_sub_paper' } })
  io.fileSentCopy.mockReset()
  io.printPdfAndFile.mockReset()
  io.saveBlobAs.mockReset()
})
afterEach(cleanup)

describe('SubPapersWindowView, with what its caller has not handed in left out', () => {
  it('opens on the statement of account: the period, what it will show, and the paper itself as the preview', () => {
    mountView()
    const dialog = screen.getByRole('dialog', { name: 'Papers for Harlan Mechanical' })
    expect(within(dialog).getAllByRole('heading')[0]!.textContent).toBe('Statement of account · Harlan Mechanical')
    expect(screen.getByTestId('sub-papers-will-show').textContent).toContain('2 work statements · 1 payment · 1 back-charge · $5,100.00 still open')
    expect(screen.getByTestId('sub-papers-will-show').textContent).toContain('No work statement carries a number yet. Each paper says the day and time it was prepared.')
    const paper = screen.getByTestId('sub-paper-preview')
    expect(paper.getAttribute('data-theme')).toBe('light')
    expect(paper.textContent).toContain('Statement of account')
    expect(paper.textContent).toContain('$5,100.00')
    expect(paper.textContent).toContain('Nov 16, 2026 at 9:30 am')
  })

  it('draws above the phone’s sheet, since People → Subs opens it from a press inside What we owe', () => {
    mountView()
    const overlay = screen.getByRole('dialog', { name: 'Papers for Harlan Mechanical' }).parentElement!
    expect(Number(overlay.style.zIndex)).toBeGreaterThan(SCHEDULE_SHEET_Z)
  })
  it('offers no payment record, no Send and no Since the last statement until their steps land', () => {
    mountView()
    expect(screen.queryByRole('combobox', { name: 'A payment record' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Send to/ })).toBeNull()
    expect(screen.queryByText('Attach')).toBeNull()
    const period = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed')).map((b) => b.textContent)
    expect(period).toEqual(['Statement of account', 'This month', 'This year', 'To date', 'Pick dates'])
    expect(screen.getByRole('dialog').textContent).not.toContain('This is their first statement')
  })

  it('no paper says invoice, receipt or owed, and the draft sentences are marked', () => {
    mountView()
    const statement = screen.getByTestId('sub-paper-preview').textContent ?? ''
    fireEvent.change(screen.getByRole('combobox', { name: 'A work statement' }), { target: { value: 'cedar-1' } })
    const work = screen.getByTestId('sub-paper-preview').textContent ?? ''
    for (const words of [statement, work]) {
      // Counsel's first sentence says what the paper is not; nothing else on a paper may use the three words.
      const rest = words.replace(/It is not an invoice from [^.]+\./g, '')
      expect(rest).not.toMatch(/\binvoice\b|\breceipt\b|\bowed\b/i)
    }
    expect(screen.getByRole('dialog').textContent).toContain('§ The boxed sentences are draft wording. They wait on counsel, and every copy prints them marked.')
  })

  it('a work statement shows the sheet: what was agreed, the back-charge, what was paid and what is still open', () => {
    mountView({ open: { kind: 'work', sheetId: 'cedar-1' } })
    const paper = screen.getByTestId('sub-paper-preview').textContent ?? ''
    expect(paper).toContain('Work statement')
    expect(paper).toContain('Cedar Hollow Clinic')
    expect(paper).toContain('$4,200.00')
    expect(paper).toContain('cleanup after top-out')
    expect(paper).toContain('$1,500.00')
    expect(paper).toContain('$2,600.00')
    // The period belongs to the statement of account only.
    expect(screen.queryByText('Period')).toBeNull()
  })

  it('Print and Download hand over the paper on the screen and its period', () => {
    const props = mountView()
    fireEvent.click(screen.getByRole('button', { name: 'This year' }))
    fireEvent.click(screen.getByRole('button', { name: 'Download the PDF' }))
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(props.onDownload).toHaveBeenCalledWith(expect.objectContaining({ kind: 'statement_of_account', stillOpen: 5100 }), { from: '2026-01-01', to: '2026-11-16' })
    expect(props.onPrint).toHaveBeenCalledWith(expect.objectContaining({ kind: 'statement_of_account' }), { from: '2026-01-01', to: '2026-11-16' })
    expect(screen.getByRole('dialog').textContent).toContain('The file is Statement of account.pdf')
  })

  it('This month and This year close on today, never on a day that has not come', () => {
    mountView()
    fireEvent.click(screen.getByRole('button', { name: 'This month' }))
    expect(screen.getByRole('dialog').textContent).toContain('Nov 1, 2026 to Nov 16, 2026.')
    expect(screen.getByTestId('sub-paper-preview').textContent).not.toContain('Nov 31')
  })

  it('a set that does not add up draws no paper, and its presses are dead', () => {
    check.refuse = true
    const props = mountView()
    expect(screen.getByTestId('sub-papers-refused').textContent).toContain('These papers do not add up, so none is drawn.')
    expect(screen.getByTestId('sub-papers-refused').textContent).toContain('Work statement 2057: the payments do not sum to Paid so far.')
    expect(screen.queryByTestId('sub-paper-preview')).toBeNull()
    const download = screen.getByRole('button', { name: 'Download the PDF' }) as HTMLButtonElement
    expect(download.disabled).toBe(true)
    fireEvent.click(download)
    expect(props.onDownload).not.toHaveBeenCalled()
  })

  it('the later steps draw from the same view: the payment record, Send and Since the last statement', () => {
    const onSend = vi.fn()
    mountView({ paymentRecords: true, canSend: true, onSend, lastStatement: null, contact: { email: 'harlan@example.com', phone: null, portalUrl: null } })
    expect(screen.getByRole('combobox', { name: 'A payment record' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Since the last statement' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('dialog').textContent).toContain('This is their first statement, so it runs to date.')
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend.mock.calls[0]![1]).toHaveLength(3)
  })
})

describe('SubPapersWindowView: the send step', () => {
  const sending = (over: Partial<SubPapersWindowViewProps> = {}) => mountView({ canSend: true, onSend: vi.fn(), lastStatement: null, contact: { email: 'harlan@example.com', phone: null, portalUrl: null }, ...over })

  it('offers email alone unless it is handed more ways, and names a phone only where a text is offered', () => {
    sending()
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    expect(screen.getByTestId('sub-papers-to').textContent).toBe('Harlan Mechanical · harlan@example.com')
    expect(screen.queryByText('By')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Text a link' })).toBeNull()
    cleanup()
    sending({ sendBy: ['email', 'text'] })
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    expect(screen.getByTestId('sub-papers-to').textContent).toBe('Harlan Mechanical · harlan@example.com · no phone on the roster')
    expect(screen.getByRole('button', { name: 'Text a link' })).toBeTruthy()
  })

  it('says what the press does before it is pressed: the files, where they go and the copy that is kept', () => {
    sending()
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    const dialog = screen.getByRole('dialog').textContent ?? ''
    expect(dialog).toContain('When you press Send')
    expect(dialog).toContain('The PDFs are made and numbered.')
    expect(dialog).toContain('The email goes to harlan@example.com with 3 files.')
    expect(dialog).toContain('A copy is filed under Sent copies, on the sub and on each job.')
    expect(screen.getByTestId('sub-papers-message').textContent).toContain('Your statement of account from Made-up Plumbing Co.')
  })

  it('a sub with no email has a dead press, the reason and the door it is handed', () => {
    const onPress = vi.fn()
    const props = sending({ contact: { email: null, phone: null, portalUrl: null }, emailDoor: { words: 'Add one on their desk.', press: { label: 'Open their desk', onPress } } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    expect(screen.getByTestId('sub-papers-to').textContent).toBe('Harlan Mechanical · no email on the roster')
    expect(screen.getByRole('alert').textContent).toBe('Harlan Mechanical has no email on the roster, so there is nowhere to send them. Add one on their desk. Open their desk')
    // A press that cannot go lists nothing it would do.
    expect(screen.getByRole('dialog').textContent).not.toContain('When you press Send')
    const press = screen.getByRole('button', { name: 'Cannot send yet' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(props.onSend).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Open their desk' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('once the papers went it offers Done, and Back to the paper brings Send back', async () => {
    const onClose = vi.fn()
    const onSend = vi.fn().mockResolvedValue(true)
    sending({ onSend, onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    const done = await screen.findByRole('button', { name: 'Done' })
    // No second Send by mistake: the press that sent is gone.
    expect(screen.queryByRole('button', { name: 'Send 3 papers by email' })).toBeNull()
    fireEvent.click(done)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back to the paper' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    expect(screen.getByRole('button', { name: 'Send 3 papers by email' })).toBeTruthy()
  })

  it('a send that did not go keeps its press', async () => {
    const onSend = vi.fn().mockResolvedValue(false)
    sending({ onSend })
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Send 3 papers by email' })).toBeTruthy()
  })

  it('one email carries 12 papers: the oldest ride, and the rest are held and named', () => {
    // Fourteen open sheets and the statement of account are fifteen papers.
    const many: LaborJob[] = Array.from({ length: 14 }, (_, i) => sheet(`s${i + 1}`, 'cedar', String(3001 + i), `2026-10-${String(i + 1).padStart(2, '0')}`, [['Rough-in', 100]]))
    const sheets = paperSheetsFor('id:harlan', many, new Map(many.map((j) => [j.id, [{ personId: 'harlan', personName: 'Harlan Mechanical' }]])), NAMES, ROSTER)
    const props = sending({ sheets })
    fireEvent.click(screen.getByRole('button', { name: 'Send to Harlan Mechanical…' }))
    expect(screen.getByTestId('sub-papers-held').textContent).toBe('3 more papers do not fit, since one email carries 12. Send them next: the work statement for #3012 Cedar Hollow Clinic, the work statement for #3013 Cedar Hollow Clinic, the work statement for #3014 Cedar Hollow Clinic.')
    fireEvent.click(screen.getByRole('button', { name: 'Send 12 papers by email' }))
    const sent = (props.onSend as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Array<{ kind: string; job?: { label: string } }>
    expect(sent).toHaveLength(12)
    expect(sent[0]!.kind).toBe('statement_of_account')
    expect(sent[11]!.job!.label).toBe('#3011 Cedar Hollow Clinic')
  })

  it('a paper made in the window does not move the window’s own period', () => {
    const props: SubPapersWindowViewProps = { open: { kind: 'statement' }, sheets: SHEETS, ctx: CTX, contact: { email: null, phone: null, portalUrl: null }, canSend: false, lastStatement: { number: 'SA-0003', endedOn: '2026-11-10' }, onDownload: vi.fn(), onPrint: vi.fn(), onClose: vi.fn() }
    const { rerender } = render(<SubPapersWindowView {...props} />)
    expect(screen.getByRole('dialog').textContent).toContain('Nov 11, 2026 to Nov 16, 2026.')
    // The statement just made is registered, and the register is read again while the window is still open.
    rerender(<SubPapersWindowView {...props} lastStatement={{ number: 'SA-0004', endedOn: '2026-11-16' }} />)
    expect(screen.getByRole('dialog').textContent).toContain('Nov 11, 2026 to Nov 16, 2026.')
    expect(screen.getByRole('dialog').textContent).toContain('The last statement, SA-0003, ended Nov 10, 2026.')
  })
})

describe('SubPapersWindow, on real rows', () => {
  const mount = (open: 'statement' | 'work' | 'payment' = 'statement') => {
    const onClose = vi.fn()
    render(<SubPapersWindow open={open === 'statement' ? { kind: 'statement' } : open === 'work' ? { kind: 'work', sheetId: 'ridge-1' } : { kind: 'payment', sendingKey: 'snd226' }} subKey="id:harlan" name="Harlan Mechanical" laborJobs={JOBS} assigneesByJobId={ASSIGNEES} namesByJobId={NAMES} roster={ROSTER} rule="owed" onClose={onClose} />)
    return { onClose }
  }

  it('draws the letterhead from Settings and the person’s own sheets', async () => {
    mount()
    const paper = await screen.findByTestId('sub-paper-preview')
    expect(paper.textContent).toContain('Made-up Plumbing Co.')
    expect(paper.textContent).toContain('$5,100.00')
  })

  it('Download makes the PDF, saves it under its name and files a copy on the person and the jobs', async () => {
    io.fileSentCopy.mockResolvedValue(true)
    mount('work')
    fireEvent.click(await screen.findByRole('button', { name: 'Download the PDF' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Work statement 2057 Ridgeway Builders, Lot 12.pdf is downloaded, and a copy is filed under Documents → Sent copies.'))
    expect(io.saveBlobAs).toHaveBeenCalledTimes(1)
    expect((io.saveBlobAs.mock.calls[0]![0] as Blob).type).toBe('application/pdf')
    expect(io.fileSentCopy).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sub_work_statement', how: 'download', recipientName: 'Harlan Mechanical', personId: 'harlan', jobIds: ['ridge'], source: { table: 'people_labor_jobs', id: 'ridge-1' } }), expect.objectContaining({ contentType: 'application/pdf' }))
  })

  it('a payment record shows the sending under its own number: how it went, what it was applied to and what stays open', async () => {
    io.fileSentCopy.mockResolvedValue(true)
    mount('payment')
    const paper = (await screen.findByTestId('sub-paper-preview')).textContent ?? ''
    expect(paper).toContain('Payment record')
    // The sending's own number, never reused (card #347). The names were settled on 2026-11-16, so it prints.
    expect(paper).toContain('No. PR-0226')
    expect(paper).toContain('Applied to')
    expect(paper).toContain('$1,500.00')
    expect(paper.replace(/It is not an invoice from [^.]+\./g, '')).not.toMatch(/\binvoice\b|\breceipt\b|\bowed\b/i)
    expect((screen.getByRole('combobox', { name: 'A payment record' }) as HTMLSelectElement).options[1]!.textContent).toBe('PR-0226 · Oct 31, 2026 · $1,500.00')
    fireEvent.click(screen.getByRole('button', { name: 'Download the PDF' }))
    await waitFor(() => expect(io.fileSentCopy).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sub_payment_record', how: 'download', personId: 'harlan', jobIds: ['cedar'] }), expect.anything()))
  })

  it('a work statement names the payment record each payment is on', async () => {
    render(<SubPapersWindow open={{ kind: 'work', sheetId: 'cedar-1' }} subKey="id:harlan" name="Harlan Mechanical" laborJobs={JOBS} assigneesByJobId={ASSIGNEES} namesByJobId={NAMES} roster={ROSTER} rule="owed" onClose={() => {}} />)
    const paper = (await screen.findByTestId('sub-paper-preview')).textContent ?? ''
    expect(paper).toContain('Paid on this statement')
    expect(paper).toContain('PR-0226')
    expect(paper).toContain('Not numbered yet')
  })

  it('says so when the copy could not be filed', async () => {
    io.fileSentCopy.mockResolvedValue(false)
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Download the PDF' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Statement of account.pdf is downloaded. The copy could not be filed under Documents → Sent copies.'))
  })

  it('a blocked print tab says how to get the paper', async () => {
    io.printPdfAndFile.mockResolvedValue('blocked')
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Print' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The browser blocked the print tab.'))
    expect(io.printPdfAndFile.mock.calls[0]![1]).toEqual(expect.objectContaining({ kind: 'sub_statement_of_account', personId: 'harlan' }))
  })
})

describe('SubPapersWindow, with the register on the database', () => {
  const NUMBERED = { kind: 'work_statement', number: 'WS-2041-1', revision: 1, labor_job_id: 'cedar-1', period_to: null, issued_at: '2026-10-29T15:00:00Z', replaced_by: null, voided_at: null }
  const open = (o: 'statement' | { sheet: string }) =>
    render(<SubPapersWindow open={o === 'statement' ? { kind: 'statement' } : { kind: 'work', sheetId: o.sheet }} subKey="id:harlan" name="Harlan Mechanical" laborJobs={JOBS} assigneesByJobId={ASSIGNEES} namesByJobId={NAMES} roster={ROSTER} rule="owed" onClose={() => {}} />)

  it('a sheet’s first work statement is registered as it is made, and the file and the copy carry its number', async () => {
    db.rows = []
    db.mint.mockResolvedValue({ data: [{ id: 'paper-1', number: 'WS-2057-1', revision: 1, reused: false }], error: null })
    io.fileSentCopy.mockResolvedValue(true)
    open({ sheet: 'ridge-1' })
    expect((await screen.findByTestId('sub-paper-preview')).textContent).toContain('Not numbered yet')
    expect(screen.getByRole('dialog').textContent).toContain('The file is named for the paper’s number, given as it is made.')
    fireEvent.click(screen.getByRole('button', { name: 'Download the PDF' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('WS-2057-1.pdf is downloaded, and a copy is filed under Documents → Sent copies.'))
    expect(db.mint).toHaveBeenCalledTimes(1)
    expect(db.mint).toHaveBeenCalledWith('mint_sub_paper', expect.objectContaining({ p_kind: 'work_statement', p_person_id: 'harlan', p_labor_job_id: 'ridge-1', p_comes_to: 2500, p_still_open: 2500, p_snapshot: expect.objectContaining({ kind: 'work_statement', sheetId: 'ridge-1' }) }))
    expect(io.saveBlobAs.mock.calls[0]![1]).toBe('WS-2057-1.pdf')
    expect(io.fileSentCopy.mock.calls[0]![0]).toMatchObject({ kind: 'sub_work_statement', title: 'Work statement WS-2057-1 · Harlan Mechanical · #2057 Ridgeway Builders, Lot 12' })
    // The register is read again, so the next preview carries the number.
    await waitFor(() => expect(db.reads).toBe(2))
  })

  it('a statement of account takes the next number, with its period, and says so before the press', async () => {
    db.rows = []
    db.mint.mockResolvedValue({ data: [{ id: 'paper-2', number: 'SA-0007', revision: 1, reused: false }], error: null })
    io.fileSentCopy.mockResolvedValue(true)
    open('statement')
    await screen.findByTestId('sub-paper-preview')
    expect(screen.getByTestId('sub-papers-will-show').textContent).toContain('This statement takes its number when you print, download or send it. 2 sheets have no work statement yet, and each takes its number the first time its paper is made.')
    // Nothing has been made for them yet, so the period cannot start from a last statement.
    expect((screen.getByRole('button', { name: 'Since the last statement' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'This month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Download the PDF' }))
    await waitFor(() => expect(io.saveBlobAs).toHaveBeenCalledTimes(1))
    expect(io.saveBlobAs.mock.calls[0]![1]).toBe('SA-0007 Statement of account.pdf')
    expect(db.mint).toHaveBeenCalledWith('mint_sub_paper', expect.objectContaining({ p_kind: 'statement_of_account', p_period_from: '2026-11-01', p_period_to: todayYmdForTest(), p_still_open: 5100 }))
  })

  it('a paper the register refuses is not made, and the window says why', async () => {
    db.rows = []
    db.mint.mockResolvedValue({ data: null, error: { code: '42501', message: 'A training account cannot make a sub paper.' } })
    open('statement')
    fireEvent.click(await screen.findByRole('button', { name: 'Download the PDF' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The PDF could not be made: A training account cannot make a sub paper.'))
    expect(io.saveBlobAs).not.toHaveBeenCalled()
    expect(io.fileSentCopy).not.toHaveBeenCalled()
  })

  it('a sheet already numbered previews under its number, and the period opens on Since the last statement', async () => {
    db.rows = [NUMBERED, { kind: 'statement_of_account', number: 'SA-0003', revision: 1, labor_job_id: null, period_to: '2026-11-10', issued_at: '2026-11-10T15:00:00Z', replaced_by: null, voided_at: null }]
    open('statement')
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('The last statement, SA-0003, ended Nov 10, 2026.'))
    // The card's call 5: a statement covers what happened since the last one, and to date the first time.
    expect(screen.getByRole('button', { name: 'Since the last statement' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('dialog').textContent).toContain('Nov 11, 2026 to ')
    fireEvent.change(screen.getByRole('combobox', { name: 'A work statement' }), { target: { value: 'cedar-1' } })
    expect(screen.getByTestId('sub-paper-preview').textContent).toContain('No. WS-2041-1')
    expect(screen.getByRole('dialog').textContent).toContain('The file is WS-2041-1.pdf')
  })

  it('Print registers the paper while its tab waits, and files it under its number', async () => {
    db.rows = []
    db.mint.mockResolvedValue({ data: [{ id: 'paper-3', number: 'WS-2057-1', revision: 1, reused: false }], error: null })
    const seen: { fileName: string; title: string }[] = []
    io.printPdfAndFile.mockImplementation(async (build: () => Promise<{ fileName: string }>, filing: { title: string }) => {
      const built = await build()
      seen.push({ fileName: built.fileName, title: filing.title })
      return 'opened'
    })
    open({ sheet: 'ridge-1' })
    fireEvent.click(await screen.findByRole('button', { name: 'Print' }))
    await waitFor(() => expect(seen).toEqual([{ fileName: 'WS-2057-1.pdf', title: 'Work statement WS-2057-1 · Harlan Mechanical · #2057 Ridgeway Builders, Lot 12' }]))
  })

  it('a refused print says the register’s reason', async () => {
    db.rows = []
    db.mint.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only the office roles who see sub pay can make a sub paper.' } })
    io.printPdfAndFile.mockImplementation(async (build: () => Promise<unknown>) => {
      try {
        await build()
        return 'opened'
      } catch {
        return 'failed'
      }
    })
    open('statement')
    fireEvent.click(await screen.findByRole('button', { name: 'Print' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The PDF could not be made: Only the office roles who see sub pay can make a sub paper.'))
  })
})

describe('SubPapersWindow: Send', () => {
  const open = (o: 'statement' | 'payment' = 'statement', over: { startOnSend?: boolean; onClose?: () => void } = {}) =>
    render(<SubPapersWindow open={o === 'statement' ? { kind: 'statement' } : { kind: 'payment', sendingKey: 'snd226' }} subKey="id:harlan" name="Harlan Mechanical" laborJobs={JOBS} assigneesByJobId={ASSIGNEES} namesByJobId={NAMES} roster={ROSTER} rule="owed" startOnSend={over.startOnSend} onClose={over.onClose ?? (() => {})} />)
  /** The register's answers, in the house's numbers: a work statement by its job, a statement of account from the sequence. */
  const mintAll = () => {
    db.mint.mockImplementation(async (_fn: string, args: { p_kind: string; p_snapshot: { job?: { label: string } } }) => ({
      data: [{ id: 'paper', number: args.p_kind === 'statement_of_account' ? 'SA-0007' : args.p_kind === 'payment_record' ? 'PR-0226' : `WS-${(args.p_snapshot.job?.label ?? '').slice(1, 5)}-1`, revision: 1, reused: false }],
      error: null,
    }))
  }

  it('shows where the papers will go and what goes, by email alone, then sends each paper under its number', async () => {
    db.rows = []
    mintAll()
    db.invoke.mockResolvedValue({ data: { ok: true, to: 'harlan@harlanmechanical.example', papers: 3 }, error: null })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' }))
    expect(screen.getByTestId('sub-papers-to').textContent).toBe('Harlan Mechanical · harlan@harlanmechanical.example')
    // A texted link is not built, so there is one way and no row to pick it from.
    expect(screen.queryByRole('button', { name: 'Text a link' })).toBeNull()
    expect(screen.queryByText('By')).toBeNull()
    expect(screen.getByTestId('sub-papers-message').textContent).toContain('Your statement of account from Made-up Plumbing Co.')
    // The files are shown as they are named now, and the line under them says the names follow the numbers.
    expect(screen.getByTestId('sub-papers-message').textContent).toContain('A paper with no number yet takes one as it is made, and its file is named for it.')
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sent 3 papers to Harlan Mechanical at harlan@harlanmechanical.example. The copies are under Documents → Sent copies.'))
    // Every work statement is registered first, then the statement of account that names them.
    expect(db.mint.mock.calls.map((c) => (c[1] as { p_kind: string }).p_kind)).toEqual(['work_statement', 'work_statement', 'statement_of_account'])
    expect(db.invoke).toHaveBeenCalledTimes(1)
    const [fn, opts] = db.invoke.mock.calls[0] as [string, { body: { person_id: string; by: string; subject: string; message: string; papers: Array<{ kind: string; number: string; title: string; file_name: string; job_ids: string[]; pdf_base64: string }> } }]
    expect(fn).toBe('send-sub-paper-email')
    expect(opts.body).toMatchObject({ person_id: 'harlan', by: 'email', subject: 'Your statement of account from Made-up Plumbing Co.' })
    // No address rides in the body: the function reads the roster's own.
    expect(Object.keys(opts.body).sort()).toEqual(['by', 'message', 'papers', 'person_id', 'subject'])
    expect(JSON.stringify(opts.body)).not.toContain('harlan@harlanmechanical.example')
    // The email keeps the order of the window: the statement, then what rides along.
    expect(opts.body.papers.map((p) => [p.kind, p.number, p.file_name, p.job_ids])).toEqual([
      ['sub_statement_of_account', 'SA-0007', 'SA-0007 Statement of account.pdf', ['cedar', 'ridge']],
      ['sub_work_statement', 'WS-2041-1', 'WS-2041-1.pdf', ['cedar']],
      ['sub_work_statement', 'WS-2057-1', 'WS-2057-1.pdf', ['ridge']],
    ])
    expect(opts.body.papers.every((p) => p.pdf_base64.length > 100 && !p.pdf_base64.startsWith('data:'))).toBe(true)
    // The statement was registered over the sheets as numbered: its snapshot names each work statement.
    const statement = db.mint.mock.calls[2]![1] as { p_snapshot: { rows: Array<{ sheetName: string }> } }
    expect(statement.p_snapshot.rows.map((r) => r.sheetName)).toEqual(['WS-2041-1', 'WS-2057-1'])
    // It went, so the step offers Done and no second Send.
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send 3 papers by email' })).toBeNull()
  })

  it('a second click before the press goes dead sends nothing more: one email, one statement number', async () => {
    db.rows = []
    mintAll()
    db.invoke.mockResolvedValue({ data: { ok: true, to: 'harlan@harlanmechanical.example', papers: 3 }, error: null })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' }))
    const press = screen.getByRole('button', { name: 'Send 3 papers by email' })
    // Two clicks before the page draws again, as a double click lands: the second finds a send under way.
    act(() => {
      press.click()
      press.click()
    })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sent 3 papers to Harlan Mechanical'))
    expect(db.invoke).toHaveBeenCalledTimes(1)
    expect(db.mint.mock.calls.filter((c) => (c[1] as { p_kind: string }).p_kind === 'statement_of_account')).toHaveLength(1)
  })

  it('after Record payment it opens on the send step, on the payment record alone', async () => {
    db.rows = []
    mintAll()
    db.invoke.mockResolvedValue({ data: { ok: true, to: 'harlan@harlanmechanical.example', papers: 1 }, error: null })
    open('payment', { startOnSend: true })
    expect((await screen.findByRole('heading')).textContent).toBe('Send the payment record')
    expect(screen.queryByTestId('sub-paper-preview')).toBeNull()
    expect(screen.getByTestId('sub-papers-message').textContent).toContain('Payment record PR-0226 from Made-up Plumbing Co.')
    fireEvent.click(screen.getByRole('button', { name: 'Send 1 paper by email' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sent 1 paper to Harlan Mechanical at harlan@harlanmechanical.example. A copy is under Documents → Sent copies.'))
    const [, opts] = db.invoke.mock.calls[0] as [string, { body: { papers: Array<{ kind: string; number: string; file_name: string; job_ids: string[] }> } }]
    expect(opts.body.papers.map((p) => [p.kind, p.number, p.file_name, p.job_ids])).toEqual([['sub_payment_record', 'PR-0226', 'PR-0226 Payment record.pdf', ['cedar']]])
    // Its number is its sending's own: the register is told the paper was made, and gives out none.
    expect(db.mint).toHaveBeenCalledWith('mint_sub_paper', expect.objectContaining({ p_kind: 'payment_record', p_sending_id: 'snd226' }))
  })

  it('a sub with no email on the roster has a dead press that says why, and the paper can still be printed', async () => {
    db.rows = []
    db.person = { email: null, phone: null }
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' }))
    expect(screen.getByRole('alert').textContent).toBe('Harlan Mechanical has no email on the roster, so there is nowhere to send them. Print or download the paper for now. A dev can add an email to their roster row.')
    const press = screen.getByRole('button', { name: 'Cannot send yet' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(db.mint).not.toHaveBeenCalled()
    expect(db.invoke).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the paper' }))
    expect(screen.getByRole('button', { name: 'Download the PDF' })).toBeTruthy()
  })

  it('a roster that could not be read is not a sub with no email: the press stays live and the function decides', async () => {
    db.rows = []
    db.personError = { message: 'Failed to fetch' }
    mintAll()
    db.invoke.mockResolvedValue({ data: { ok: true, to: 'harlan@harlanmechanical.example', papers: 3 }, error: null })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' }))
    expect(screen.getByTestId('sub-papers-to').textContent).toBe('Harlan Mechanical · the address on their roster row')
    expect(screen.getByRole('dialog').textContent).toContain('The email goes to the address on their roster row with 3 files.')
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    // The answer names the address it went to.
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sent 3 papers to Harlan Mechanical at harlan@harlanmechanical.example. The copies are under Documents → Sent copies.'))
  })

  it('an email that does not go says the function’s reason, names the statement number it spent, and nothing reads as sent', async () => {
    db.rows = []
    mintAll()
    db.invoke.mockResolvedValue({ data: { error: 'The email did not go: The domain is not verified' }, error: null })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Nothing was sent: The email did not go: The domain is not verified. SA-0007 took its number and did not go. The next send takes a new one.'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Send 3 papers by email' })).toBeTruthy()
  })

  it('no answer at all claims neither: it may have gone, and the window says where to look', async () => {
    db.rows = []
    mintAll()
    db.invoke.mockResolvedValue({ data: null, error: new Error('Failed to send a request to the Edge Function') })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No answer came back, so it is not known whether the email went. Look under Documents → Sent copies before you send again.'))
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
  })

  it('the window stays while a press is under way', async () => {
    db.rows = []
    mintAll()
    let answer: (v: unknown) => void = () => {}
    db.invoke.mockReturnValue(new Promise((r) => (answer = r)))
    const onClose = vi.fn()
    open('statement', { onClose })
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    await screen.findByRole('button', { name: 'Sending…' })
    expect((screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).not.toHaveBeenCalled()
    answer({ data: { ok: true, to: 'harlan@harlanmechanical.example', papers: 3 }, error: null })
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a paper the register refuses is not sent', async () => {
    db.rows = []
    db.mint.mockResolvedValue({ data: null, error: { code: '42501', message: 'An archived account cannot make a sub paper.' } })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 papers by email' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Nothing was sent: An archived account cannot make a sub paper.'))
    expect(db.invoke).not.toHaveBeenCalled()
  })

  it('only the office roles who see sub pay are offered Send: not an account in training, a superintendent or an estimator', async () => {
    for (const who of [{ role: 'assistant', readOnly: true }, { role: 'superintendent', readOnly: false }, { role: 'estimator', readOnly: false }, { role: 'subcontractor', readOnly: false }]) {
      auth.role = who.role
      auth.readOnly = who.readOnly
      open('statement', { startOnSend: true })
      // Asked to open on the send step, it still opens on the paper: there is no send step for them.
      await screen.findByTestId('sub-paper-preview')
      expect(screen.queryByRole('button', { name: /^Send/ })).toBeNull()
      cleanup()
    }
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
      auth.role = role
      auth.readOnly = false
      open()
      expect(await screen.findByRole('button', { name: 'Send to Harlan Mechanical…' })).toBeTruthy()
      cleanup()
    }
  })
})
