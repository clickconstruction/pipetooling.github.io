// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const io = vi.hoisted(() => ({ fileSentCopy: vi.fn(), printPdfAndFile: vi.fn(), saveBlobAs: vi.fn() }))
vi.mock('../../lib/sent/sentCopiesIo', () => ({ fileSentCopy: io.fileSentCopy, printPdfAndFile: io.printPdfAndFile }))
vi.mock('../../lib/storageSave', () => ({ saveBlobAs: io.saveBlobAs }))
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
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'assistant', readOnly: false }) }))

import type { PaperContext } from '../../../supabase/functions/_shared/subPapers'
import type { NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/rosterSub'
import { paperSheetsFor } from '../../lib/subWorkOrders/subPapersInputs'
import type { LaborJob, LaborJobPayment } from '../../types/laborJob'
import { SubPapersWindowView, type SubPapersWindowViewProps } from './SubPapersWindow'
import { SubPapersWindow } from './SubPapersWindowConnected'

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
  io.fileSentCopy.mockReset()
  io.printPdfAndFile.mockReset()
  io.saveBlobAs.mockReset()
})
afterEach(cleanup)

describe('SubPapersWindowView, as the first step ships it', () => {
  it('opens on the statement of account: the period, what it will show, and the paper itself as the preview', () => {
    mountView()
    const dialog = screen.getByRole('dialog', { name: 'Papers for Harlan Mechanical' })
    expect(within(dialog).getAllByRole('heading')[0]!.textContent).toBe('Statement of account · Harlan Mechanical')
    expect(screen.getByTestId('sub-papers-will-show').textContent).toContain('2 work statements · 1 payment · 1 back-charge · $5,100.00 still open')
    expect(screen.getByTestId('sub-papers-will-show').textContent).toContain('No paper carries a number yet. Each one says the day and time it was prepared.')
    const paper = screen.getByTestId('sub-paper-preview')
    expect(paper.getAttribute('data-theme')).toBe('light')
    expect(paper.textContent).toContain('Statement of account')
    expect(paper.textContent).toContain('$5,100.00')
    expect(paper.textContent).toContain('Nov 16, 2026 at 9:30 am')
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

describe('SubPapersWindow, on real rows', () => {
  const mount = (open: 'statement' | 'work' = 'statement') => {
    const onClose = vi.fn()
    render(<SubPapersWindow open={open === 'statement' ? { kind: 'statement' } : { kind: 'work', sheetId: 'ridge-1' }} subKey="id:harlan" name="Harlan Mechanical" laborJobs={JOBS} assigneesByJobId={ASSIGNEES} namesByJobId={NAMES} roster={ROSTER} rule="owed" onClose={onClose} />)
    return { onClose }
  }

  it('draws the letterhead from Settings and the person’s own sheets, with no Send', async () => {
    mount()
    const paper = await screen.findByTestId('sub-paper-preview')
    expect(paper.textContent).toContain('Made-up Plumbing Co.')
    expect(paper.textContent).toContain('$5,100.00')
    expect(screen.queryByRole('button', { name: /^Send to/ })).toBeNull()
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
