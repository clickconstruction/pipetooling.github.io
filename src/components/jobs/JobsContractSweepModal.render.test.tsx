// @vitest-environment jsdom
/**
 * Render smoke for the Contract sweep (Contract sweep PR 1 / PR 2): the
 * header counts the pile, rows wear their readiness, the selected job's
 * agreement renders in the pane with a footer that follows its state, Send &
 * next lands on the next row, and Send all lives under ⋯, counts customers,
 * and takes only Ready rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobWithDetails } from '../../types/jobWithDetails'
import JobsContractSweepModal from './JobsContractSweepModal'
import { sweepDriveScanCache } from '../../lib/jobs/driveContractScanCache'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }),
}))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

/** What `drive-contract-scan` answers. Empty by default, so the older tests see the sweep as it was. */
const driveScan = vi.hoisted(() => ({ files: [] as unknown[] }))
/** Live `job_contracts` rows (v2.3707): a draft typed earlier, for the amount-differs case. Empty by default. */
const contractRows = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (table: string) => unknown }
  // A chainable builder over the fixture rows: any point in the chain resolves them; .maybeSingle() the first.
  const rowsBuilder = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) b[m] = () => b
    b.maybeSingle = () => rowsBuilder(true)
    b.then = (ok?: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: single ? (contractRows.rows[0] ?? null) : contractRows.rows, error: null }).then(ok, ko)
    return b
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) => (table === 'job_contracts' && contractRows.rows.length > 0 ? rowsBuilder(false) : stub.from(table)),
      functions: { invoke: async () => ({ data: { ok: true, files: driveScan.files }, error: null }) },
    },
  }
})
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'ClickTooling Plumbing', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' }),
}))

const sendSpy = vi.fn((_input: { job: { id: string } }) => Promise.resolve({ ok: true, emailed: true, signUrl: 'https://x' }))
vi.mock('../../lib/jobs/jobContractQuickSend', () => ({
  quickSendJobContract: (input: { job: { id: string } }) => sendSpy(input),
}))

const saveSpy = vi.fn((input: { existing: unknown; payload: { job_id: string; fields: { scope_lines: string[]; amount_cents: number | null } } }) =>
  Promise.resolve({ id: 'd1', job_id: input.payload.job_id, status: 'draft', revision: 1, fields: input.payload.fields, body_html: 'terms', body_format: 'plain', template_name: 'Built-in service agreement terms', recipient_name: null, recipient_email: null, created_at: '2026-09-14T00:00:00Z', updated_at: null, last_sent_at: null }),
)
vi.mock('../../lib/jobs/jobContractDraftWrite', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/jobContractDraftWrite')>('../../lib/jobs/jobContractDraftWrite')
  return { ...actual, saveJobContractDraft: (input: never) => saveSpy(input) }
})

vi.mock('../../lib/jobs/contractDraftPdf', () => ({
  fetchContractDraftPdf: () => Promise.resolve({ filename: 'agreement.pdf', bytes: new Uint8Array([1]) }),
  saveBytesAsFile: () => undefined,
}))
const handedSpy = vi.fn((input: { row: { id: string; job_id: string } }) => Promise.resolve({ ...input.row, status: 'sent', sent_channel: 'handed' }))
vi.mock('../../lib/jobs/jobContractHandoff', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/jobContractHandoff')>('../../lib/jobs/jobContractHandoff')
  return { ...actual, markJobContractHanded: (input: never) => handedSpy(input) }
})

vi.mock('./JobContractModal', () => ({
  default: ({ open, initialFilingOpen }: { open: boolean; initialFilingOpen?: boolean }) => (open ? <div data-testid="contract-modal">{initialFilingOpen ? 'filing' : 'sending'}</div> : null),
}))

function job(p: Partial<JobWithDetails> & { id: string; hcp_number: string }): JobWithDetails {
  return {
    click_number: '',
    job_name: 'Mission Hills',
    job_address: '2100 Independence Dr, New Braunfels, TX',
    customer_name: 'TF Harper',
    customer_email: 'kcallison@tfharper.com',
    customer_phone: null,
    customer_id: 'c1',
    gc_customer_id: null,
    status: 'working',
    revenue: 123600,
    created_at: '2026-09-01T00:00:00Z',
    bid_id: null,
    fixtures: [{ name: 'Water closet', count: 14, line_description: null } as never],
    materials: [],
    payments: [],
    invoices: [],
    team_members: [],
    ...p,
  } as unknown as JobWithDetails
}

const JOBS: JobWithDetails[] = [
  job({ id: 'j523', hcp_number: '523' }),
  job({ id: 'j363', hcp_number: '363', job_name: 'Michael Palmer', customer_name: 'Michael Palmer', customer_email: 'palmertexashomes@gmail.com', revenue: 31400, created_at: '2026-09-02T00:00:00Z' }),
  // v2.3707: the amount is the job's — a thin scope with a number on the job (no fixture rows: an import), so typing the scope alone makes it Ready.
  job({ id: 'j683', hcp_number: '683', job_name: 'Job', customer_name: 'The Learning Experience', customer_email: 'may@corewellpartners.com', revenue: 2400, fixtures: [] }),
  job({ id: 'j778', hcp_number: '778', job_name: 'Austin Real Estate', customer_email: null, revenue: null }),
  job({ id: 'j804', hcp_number: '804', job_name: 'Auto Zone', customer_name: 'Summit GC', customer_email: 'estimating@summitgc.net', customer_id: 'c9', gc_customer_id: 'gc1', gcCustomer: { id: 'gc1', name: 'Summit GC' }, revenue: 32600 }),
  job({ id: 'jpaid', hcp_number: '900', status: 'paid' }),
]
const COVERAGE = new Map(JOBS.map((j) => [j.id, { kind: 'none' as const }]))

function mount(onSent = vi.fn()) {
  return renderWithProviders(<JobsContractSweepModal open onClose={() => undefined} jobs={JOBS} coverage={COVERAGE} onEditJob={() => undefined} onSent={onSent} />)
}

describe('JobsContractSweepModal', () => {
  // The Drive scan is remembered for fifteen minutes across opens; each test starts without one.
  beforeEach(() => sweepDriveScanCache.clear())

  it('counts the pile, selects the first Ready row, and shows its agreement with a footer that says what Send will do', async () => {
    mount()
    // v2.3703: the header says the dollars; the counts live on the list's tabs, once each.
    await waitFor(() => expect(screen.getByTestId('sweep-summary').textContent).toContain('$190,000 of work has no contract on file'))
    expect(screen.getByTestId('sweep-summary').textContent).not.toContain('need a look')
    const tabs = within(screen.getByTestId('sweep-tabs'))
    expect(tabs.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Ready to send2', 'Needs a look3', 'All5'])
    expect(tabs.getByRole('tab', { name: /^Ready to send\s?2$/ }).getAttribute('aria-selected')).toBe('true')
    const rows = screen.getAllByTestId('sweep-row')
    expect(rows.map((r) => r.getAttribute('data-job'))).toEqual(['523', '363'])
    expect(rows[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(within(rows[0]!).getByText('Ready')).toBeTruthy()
    const frame = screen.getByTitle('The agreement as the customer will see it') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('Service agreement for 2100 Independence Dr')
    expect(frame.getAttribute('srcdoc')).toContain('14 × Water closet')
    expect(frame.getAttribute('srcdoc')).toContain('$123,600.00')
    // PR 5: a homeowner row leads with the PDF to sign by hand; the footer says so and the buttons follow.
    const ways = within(screen.getByTestId('sweep-signing-ways'))
    expect((ways.getByRole('radio', { name: /Email the PDF to sign by hand/ }) as HTMLInputElement).checked).toBe(true)
    expect(ways.getByRole('radio', { name: /Email a signing link/ })).toBeTruthy()
    expect(ways.getByRole('radio', { name: /Download to print/ })).toBeTruthy()
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toBe('Emails the PDF to kcallison@tfharper.com · then J363')
    expect(screen.getByRole('button', { name: 'Email PDF & next' })).toBeTruthy()
    // v2.3706: the ways are one row; the line under says what the chosen one does.
    expect(screen.getByTestId('sweep-way-detail').textContent).toContain('the signing link rides along as a second way')
    fireEvent.click(ways.getByRole('radio', { name: /Email a signing link/ }))
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toBe('Emails kcallison@tfharper.com · then J363')
    expect(screen.getByTestId('sweep-way-detail').textContent).toBe('They sign on screen, no printing')
    expect(screen.getByRole('button', { name: 'Send link & next' })).toBeTruthy()
    // One primary: the one-job send and the full editor sit under ⋯ More.
    expect(screen.queryByTestId('sweep-way-go')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open the full editor' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More for this job' }))
    expect(screen.getByRole('menuitem', { name: /Send the link — stay on this job/ }).textContent).toContain('without moving on to J363')
    fireEvent.click(screen.getByRole('menuitem', { name: /Open the full editor/ }))
    expect(screen.getByTestId('contract-modal').textContent).toBe('sending')
  })

  it('the footer follows the state: a thin row dims the primary, a GC job leads with filing, no email asks for a fix', async () => {
    mount()
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('tab', { name: /^Needs a look\s?3$/ }))
    const look = screen.getAllByTestId('sweep-row')
    expect(look.map((r) => r.getAttribute('data-job'))).toEqual(['683', '778', '804'])
    // The first row of the new list is selected: a thin scope.
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toContain("Work we'll do: Job")
    // Not Ready (v2.3706): the one-job send is the primary and goes as it reads; the fast path is not offered.
    expect((screen.getByTestId('sweep-way-go') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('sweep-way-go').textContent).toBe('Email the PDF')
    expect(screen.queryByTestId('sweep-way-go-next')).toBeNull()
    // No email: both email ways are out and the line under the row says why; download to print is the pick.
    fireEvent.click(look[1]!)
    const noEmail = within(screen.getByTestId('sweep-signing-ways'))
    expect((noEmail.getByRole('radio', { name: /Email the PDF to sign by hand/ }) as HTMLInputElement).disabled).toBe(true)
    expect((noEmail.getByRole('radio', { name: /Download to print/ }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByTestId('sweep-way-detail').textContent).toContain('Email the PDF to sign by hand and Email a signing link: needs a signer email — type one in To above')
    // The scope is real and a row follows, so Download & next is the primary; the one-job download waits under ⋯ More.
    expect(screen.getByTestId('sweep-way-go-next').textContent).toBe('Download & next')
    expect(screen.getByRole('button', { name: 'Fix email on the job' })).toBeTruthy()
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toContain('Nothing is emailed')
    fireEvent.click(screen.getByRole('button', { name: 'More for this job' }))
    expect(screen.getByRole('menuitem', { name: /Download & mark handed over — stay on this job/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'More for this job' }))
    // A builder's row opens straight on "We already have one": their paper is the agreement, so the
    // filing sheet is simply there (it used to take two clicks). Ours is one door away, not gone.
    fireEvent.click(look[2]!)
    await waitFor(() => expect(screen.getByTestId('contract-file-sheet')).toBeTruthy())
    expect(screen.getAllByText("File Summit GC's subcontract").length).toBeGreaterThan(0)
    const doors = within(screen.getByTestId('sweep-doors'))
    expect(doors.getByRole('button', { name: /We already have one/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(doors.getByRole('button', { name: /We need a signature/ }))
    expect(screen.queryByTestId('contract-file-sheet')).toBeNull()
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toBe("GC job · Summit GC's subcontract is the agreement")
    const gc = within(screen.getByTestId('sweep-signing-ways'))
    expect(gc.getAllByRole('radio')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('sweep-send-ours'))
    expect(gc.getAllByRole('radio')).toHaveLength(4)
  })

  it('the signing link: Send link & next sends the selected job and lands on the next row', async () => {
    sendSpy.mockClear()
    const onSent = vi.fn()
    mount(onSent)
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(within(screen.getByTestId('sweep-signing-ways')).getByRole('radio', { name: /Email a signing link/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Send link & next' }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(sendSpy.mock.calls[0]![0].job.id).toBe('j523')
    expect((sendSpy.mock.calls[0]![0] as { channel?: string }).channel).toBe('link')
    await waitFor(() => expect(screen.getAllByTestId('sweep-row').map((r) => r.getAttribute('data-job'))).toEqual(['363']))
    expect(screen.getAllByTestId('sweep-row')[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('sweep-summary').textContent).toContain('1 sent this sweep')
  })

  it('typing a scope for a thin row saves the draft, redraws the document, and makes the row Ready; the amount is the job’s, read out, never a box (PR 3 · v2.3707)', async () => {
    saveSpy.mockClear()
    mount()
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('tab', { name: /^Needs a look\s?3$/ }))
    await waitFor(() => expect(screen.getByTestId('sweep-pane-edit')).toBeTruthy())
    expect((screen.getByLabelText('Scope — one line per item') as HTMLTextAreaElement).value).toBe('Job')
    // v2.3707: no Contract amount box — the job's number with its source and one door to the job.
    expect(screen.queryByLabelText('Contract amount')).toBeNull()
    expect(screen.getByTestId('sweep-amount-value').textContent).toBe('$2,400')
    expect(screen.getByTestId('sweep-amount').textContent).toContain("from the job's amount")
    expect(screen.getByTestId('sweep-amount-door').textContent).toBe('Adjust line items ›')
    fireEvent.change(screen.getByLabelText('Scope — one line per item'), { target: { value: 'Water heater swap\nHaul away the old unit' } })
    const frame = screen.getByTitle('The agreement as the customer will see it') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('Water heater swap')
    expect(frame.getAttribute('srcdoc')).toContain('$2,400.00')
    await waitFor(() => expect(saveSpy).toHaveBeenCalled(), { timeout: 2000 })
    const payload = saveSpy.mock.calls[0]![0].payload
    expect(payload.job_id).toBe('j683')
    expect(payload.fields.scope_lines).toEqual(['Water heater swap', 'Haul away the old unit'])
    expect(payload.fields.amount_cents).toBe(240000)
    await waitFor(() => expect(screen.getByTestId('sweep-save-state').textContent).toBe('Saved to the job’s draft'))
    expect(screen.getByTestId('sweep-footer-sentence').textContent).toBe('Emails the PDF to may@corewellpartners.com · then J778')
    // Ready now, with a row after it: the fast path becomes the primary (v2.3706).
    await waitFor(() => expect(screen.getByTestId('sweep-way-go-next').textContent).toBe('Email PDF & next'))
    expect(within(screen.getAllByTestId('sweep-row')[0]!).getByText('Ready')).toBeTruthy()
  })

  it('filing happens in the pane: Already signed? File it opens the sheet, and a file dropped on a row opens it with the file (PR 4)', async () => {
    mount()
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    // The pane says which job it is about, and asks the first question first.
    expect(screen.getByTestId('sweep-pane-job').textContent).toContain('J523 · Mission Hills')
    expect(screen.queryByRole('button', { name: 'Already signed? File it' })).toBeNull() // no longer a buried footer link
    const doors = within(screen.getByTestId('sweep-doors'))
    expect(doors.getByRole('button', { name: /We need a signature/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(doors.getByRole('button', { name: /We already have one/ }))
    expect(screen.getByTestId('contract-file-sheet')).toBeTruthy()
    expect(screen.getByTestId('sweep-pane-footer').textContent).toContain('Filing replaces the send')
    expect(screen.queryByTestId('sweep-pane-edit')).toBeNull()
    expect(screen.getByTestId('contract-file-record').textContent).toBe('File it & next')
    // a contract already on file was signed some time ago — the date starts empty, never today's
    expect((screen.getByLabelText('Date the contract was signed') as HTMLInputElement).value).toBe('')
    fireEvent.click(doors.getByRole('button', { name: /We need a signature/ }))
    expect(screen.queryByTestId('contract-file-sheet')).toBeNull()

    const rows = screen.getAllByTestId('sweep-row')
    const file = new File(['%PDF'], 'Palmer subcontract (signed).pdf', { type: 'application/pdf' })
    fireEvent.drop(rows[1]!, { dataTransfer: { files: [file], types: ['Files'] } })
    await waitFor(() => expect(screen.getByTestId('contract-file-chosen').textContent).toContain('Palmer subcontract (signed).pdf'))
    expect(screen.getAllByTestId('sweep-row')[1]!.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('File a signed contract')).toBeTruthy()
  })

  it('Download to print downloads the page, stamps the hand-off without emailing, and the job leaves the pile; Preview PDF records nothing (PRs 2 + 5)', async () => {
    handedSpy.mockClear()
    saveSpy.mockClear()
    sendSpy.mockClear()
    const onSent = vi.fn()
    mount(onSent)
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByTestId('sweep-download-pdf'))
    await waitFor(() => expect(screen.getByTestId('sweep-download-pdf').textContent).toBe('Preview PDF'))
    expect(handedSpy).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByTestId('sweep-signing-ways')).getByRole('radio', { name: /Download to print/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Download & next' }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(saveSpy).toHaveBeenCalled()
    expect(handedSpy.mock.calls[0]![0].row.job_id).toBe('j523')
    expect(sendSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getAllByTestId('sweep-row').map((r) => r.getAttribute('data-job'))).toEqual(['363']))
  })

  it('the default way: Email PDF & next asks first, then sends through the PDF channel and the row leaves (PRs 3 + 5)', async () => {
    sendSpy.mockClear()
    const onSent = vi.fn()
    mount(onSent)
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Email PDF & next' }))
    expect(sendSpy).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, email it' }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect((sendSpy.mock.calls[0]![0] as { channel?: string }).channel).toBe('pdf_email')
    expect(sendSpy.mock.calls[0]![0].job.id).toBe('j523')
  })

  it('the pane tells the two kinds of terms apart: the payment line is this job\'s and saves to its draft; the standard terms say what they are (Signing it on paper PR 4)', async () => {
    saveSpy.mockClear()
    mount()
    await waitFor(() => expect(screen.getByTestId('sweep-pane-edit')).toBeTruthy())
    const pane = within(screen.getByTestId('sweep-pane-edit'))
    expect(pane.getByText('This job')).toBeTruthy()
    // No customer document in this stubbed Book: the row names the built-in wording and offers no Edit.
    const terms = within(screen.getByTestId('sweep-standard-terms'))
    expect(terms.getByText('Built-in service agreement terms')).toBeTruthy()
    expect(screen.queryByTestId('sweep-edit-standard-terms')).toBeNull()
    // The default is 50% down; pick Due on completion and the draft is saved with it.
    expect(pane.getByRole('button', { name: '50% down, balance on completion' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(pane.getByRole('button', { name: 'Due on completion' }))
    await waitFor(() => expect(saveSpy).toHaveBeenCalled())
    const saved = saveSpy.mock.calls[saveSpy.mock.calls.length - 1]![0].payload.fields as unknown as { payment_terms_key: string }
    expect(saved.payment_terms_key).toBe('on_completion')
  })

  it('the Drive pass runs by itself: a confident find marks the row, adds an In Drive tab, and opens that job on "We already have one" with the link and the file’s date filled in', async () => {
    driveScan.files = [
      { id: 'f1', name: 'TF Harper - Mission Hills Subcontract (signed).pdf', mimeType: 'application/pdf', modifiedTime: '2026-08-14T15:00:00Z', webViewLink: 'https://drive.google.com/file/d/abc123/view', size: 1000, folderId: 'fo1', folderName: 'J523 Mission Hills' },
    ]
    try {
      mount()
      // v2.3703: the In Drive tab appearing on the list is the sign the pass found something — the header no longer repeats it.
      await waitFor(() => expect(screen.getByRole('tab', { name: /In Drive\s?1$/ })).toBeTruthy())
      expect(screen.getByTestId('sweep-summary').textContent).not.toContain('Drive')
      const first = screen.getAllByTestId('sweep-row')[0]!
      expect(first.getAttribute('data-job')).toBe('523')
      expect(within(first).getByTestId('sweep-drive-chip').textContent).toBe('📄 in Drive')

      // J523 is selected first, and it has a confident find — so the pane is already on the filing door, pre-filled.
      await waitFor(() => expect(screen.getByTestId('sweep-drive-found').textContent).toContain('Mission Hills Subcontract (signed).pdf'))
      expect(within(screen.getByTestId('sweep-doors')).getByRole('button', { name: /We already have one/ }).getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByText(/Google Doc linked/)).toBeTruthy()
      expect((screen.getByLabelText('Date the contract was signed') as HTMLInputElement).value).toBe('2026-08-14')
      expect((screen.getByTestId('contract-file-record') as HTMLButtonElement).disabled).toBe(false) // a link + the customer as signer: ready to file

      // A job with nothing in Drive still opens on sending.
      fireEvent.click(screen.getAllByTestId('sweep-row')[1]!)
      await waitFor(() => expect(screen.queryByTestId('contract-file-sheet')).toBeNull())
    } finally {
      driveScan.files = []
    }
  })

  it('a "check" find is shown but never filled in for you — found live: a proposal in a folder many jobs matched', async () => {
    // Several fixture jobs share 2100 Independence Dr, so a folder named by the street alone is a tie → "check".
    driveScan.files = [
      { id: 'f2', name: 'Plumbing Proposal REVISED.pdf', mimeType: 'application/pdf', modifiedTime: '2025-12-15T15:00:00Z', webViewLink: 'https://drive.google.com/file/d/prop999/view', size: 1000, folderId: 'fo2', folderName: '2100 Independence Dr' },
    ]
    try {
      mount()
      await waitFor(() => expect(screen.getByTestId('sweep-drive-found').textContent).toContain('check it first'))
      expect(within(screen.getAllByTestId('sweep-row')[0]!).getByTestId('sweep-drive-chip').textContent).toBe('📄 in Drive? check')
      // Shown, with a way to open it — but the link is NOT filled in and nothing can be filed yet.
      expect(screen.queryByText(/Google Doc linked/)).toBeNull()
      expect((screen.getByTestId('contract-file-record') as HTMLButtonElement).disabled).toBe(true)
      expect((screen.getByLabelText('Date the contract was signed') as HTMLInputElement).value).toBe('')
      // The person looked, and says it is the one.
      fireEvent.click(screen.getByTestId('sweep-drive-use'))
      await waitFor(() => expect(screen.getByText(/Google Doc linked/)).toBeTruthy())
      expect((screen.getByLabelText('Date the contract was signed') as HTMLInputElement).value).toBe('2025-12-15')
      expect((screen.getByTestId('contract-file-record') as HTMLButtonElement).disabled).toBe(false)
    } finally {
      driveScan.files = []
    }
  })

  it('a draft typed earlier with a number other than the job’s is named, kept out of the send, and put right with one press (v2.3707)', async () => {
    saveSpy.mockClear()
    contractRows.rows = [
      { id: 'd523', job_id: 'j523', status: 'draft', revision: 1, voided_at: null, fields: { scope_lines: ['14 × Water closet'], amount_cents: 12_000_000, payment_terms_key: 'half_down', payment_terms_text: '' }, body_html: 'terms', body_format: 'plain', template_name: 'Built-in service agreement terms', recipient_name: null, recipient_email: null, created_at: '2026-09-14T00:00:00Z', updated_at: null, last_sent_at: null },
    ]
    try {
      const onSent = vi.fn()
      mount(onSent)
      // The row wears the state, and Send all no longer counts it.
      await waitFor(() => expect(within(screen.getByTestId('sweep-tabs')).getByRole('tab', { name: /^Needs a look\s?4$/ })).toBeTruthy())
      fireEvent.click(screen.getByRole('tab', { name: /^Needs a look\s?4$/ }))
      const row = screen.getAllByTestId('sweep-row').find((r) => r.getAttribute('data-job') === '523')!
      expect(within(row).getByText('Amount differs')).toBeTruthy()
      fireEvent.click(row)
      await waitFor(() => expect(screen.getByTestId('sweep-amount-differs')).toBeTruthy())
      // The pane shows the job's number, names what the draft says, and every way of sending waits.
      expect(screen.getByTestId('sweep-amount-value').textContent).toBe('$123,600')
      expect(screen.getByTestId('sweep-amount-differs').textContent).toContain('This draft still says $120,000.00')
      expect(screen.getByTestId('sweep-footer-sentence').textContent).toBe("This draft says $120,000.00, the job says $123,600.00 — use the job's number above")
      expect(screen.queryByTestId('sweep-way-go-next')).toBeNull()
      expect((screen.getByTestId('sweep-way-go') as HTMLButtonElement).disabled).toBe(true)
      // One press: the draft takes the job's number, saves, and the row is Ready again.
      fireEvent.click(screen.getByTestId('sweep-amount-use-job'))
      await waitFor(() => expect(saveSpy).toHaveBeenCalled(), { timeout: 2000 })
      expect(saveSpy.mock.calls[saveSpy.mock.calls.length - 1]![0].payload.fields.amount_cents).toBe(12_360_000)
      await waitFor(() => expect(screen.queryByTestId('sweep-amount-differs')).toBeNull())
      expect(within(row).queryByText('Amount differs')).toBeNull()
      expect(screen.getByTestId('sweep-way-go-next').textContent).toBe('Email PDF & next')
    } finally {
      contractRows.rows = []
    }
  })

  it('Send all lives under ⋯, names the customers, and sends only the Ready rows after a confirm', async () => {
    sendSpy.mockClear()
    const onSent = vi.fn()
    mount(onSent)
    await waitFor(() => expect(screen.getByTestId('sweep-summary')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Contract sweep tools' }))
    const item = screen.getByRole('menuitem', { name: /Send all 2 ready…/ })
    expect(item.textContent).toContain('2 customers')
    fireEvent.click(item)
    const confirm = screen.getByTestId('sweep-send-all-confirm')
    expect(confirm.textContent).toContain('Email 2 customers (2 agreements)')
    fireEvent.click(within(confirm).getByRole('button', { name: /Confirm — send 2 now/ }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(sendSpy.mock.calls.map((c) => c[0].job.id)).toEqual(['j523', 'j363'])
  })
})
