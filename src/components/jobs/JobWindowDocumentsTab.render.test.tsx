// @vitest-environment jsdom
/**
 * Render smoke for the job window's Documents tab (v2.4491): the job's saved pay applications
 * with the link to each sent file, the row's Open handing the AIA window that application, New
 * application handing it none, the list reloading when the window closes, and the job's folders.
 * Since v2.4495 the tab also lists the job's bills and test reports, and since v2.4496 its
 * contract and lien paper.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { TestReportDocumentRow } from '../../lib/jobsDocuments/testReportDocumentRow'
import type { JobContractRow } from '../../lib/jobs/jobContractLifecycle'
import type { JobLienPaper } from '../../lib/jobs/jobLienPaperRows'
import type { SentCopy } from '../../lib/sent/sentCopies'
import { JobWindowDocumentsTab } from './JobWindowDocumentsTab'
import { payApplicationWriteFromForm, savedPayApplicationFromRow, type PayApplicationRow, type SavedPayApplication } from '../../lib/aiaPayApplications'

let onJob: SavedPayApplication[] = []
const loadSpy = vi.fn((_jobId: string) => Promise.resolve(onJob))
vi.mock('../../lib/aiaPayApplicationsIo', () => ({ loadPayApplications: (jobId: string) => loadSpy(jobId) }))

// Test reports: the rows the tab is given, the PDF link, and the Test report window's opener.
let reports: TestReportDocumentRow[] = []
const signedUrlSpy = vi.fn((path: string) => Promise.resolve(`https://files.example/${path}`))
vi.mock('../../lib/jobs/testReportDocumentOpen', () => ({
  loadJobTestReportRows: () => Promise.resolve(reports),
  testReportPdfSignedUrl: (path: string) => signedUrlSpy(path),
}))
const externalSpy = vi.fn((_url: string) => undefined)
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => externalSpy(url) }))
const openTestReportSpy = vi.fn((_opts: { reportId?: string | null }) => undefined)
vi.mock('../../contexts/TestReportModalContext', () => ({
  useTestReportModalOptional: () => ({ openTestReport: openTestReportSpy, closeTestReport: () => undefined }),
}))

// Bills: View bill is a stub that names its bill and its layer; the PDF opener is watched.
vi.mock('./BilledBillViewModal', () => ({
  default: ({ invoice, onClose, overlayZIndex }: { invoice: { id: string } | null; onClose: () => void; overlayZIndex?: number }) =>
    invoice ? (
      <div data-testid="bill-view-stub">
        bill {invoice.id} at {overlayZIndex}
        <button type="button" onClick={onClose}>
          close bill
        </button>
      </div>
    ) : null,
}))
vi.mock('./HostedStripeBillPanel', () => ({ billingTypeLabel: () => 'Stripe' }))
const pdfSpy = vi.fn((_inv: { id: string; job_id: string }, _cb: unknown) => Promise.resolve(true))
vi.mock('../../lib/openBilledInvoicePdf', () => ({ openBilledInvoicePdfInNewTab: (inv: { id: string; job_id: string }, cb: unknown) => pdfSpy(inv, cb) }))

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'office@example.com' }, role: authRole, profileName: 'Dana Office' }) }))

// Contract and lien paper: the rows the tab is given; their windows are stubs that say what they were handed.
let contracts: JobContractRow[] = []
let lienPaper: JobLienPaper = { filings: [], letters: [], releases: [] }
vi.mock('../../lib/jobs/jobLienPaperIo', () => ({
  loadJobContractRows: () => Promise.resolve(contracts),
  loadJobLienPaper: () => Promise.resolve(lienPaper),
}))
vi.mock('./JobContractModal', () => ({
  default: ({ open, onClose, initialRecordId }: { open: boolean; onClose: () => void; initialRecordId?: string | null }) =>
    open ? (
      <div data-testid="contract-window-stub">
        contract window on {initialRecordId ?? 'no record'}
        <button type="button" onClick={onClose}>
          close contract
        </button>
      </div>
    ) : null,
}))
vi.mock('./JobContractRecordModal', () => ({ buildJobContractRecordHtml: (row: { id: string }) => `<p>contract ${row.id}</p>` }))
vi.mock('./LienInstrumentsModal', () => ({
  default: ({ open, onClose, initialTab, signerNameFallback, authEmail }: { open: boolean; onClose: () => void; initialTab?: string; signerNameFallback: string; authEmail: string }) =>
    open ? (
      <div data-testid="lien-window-stub">
        lien window on {initialTab} for {signerNameFallback} {authEmail}
        <button type="button" onClick={onClose}>
          close lien
        </button>
      </div>
    ) : null,
}))
const previewSpy = vi.fn((_html: string) => true)
const whenReadySpy = vi.fn((_build: () => Promise<string>) => Promise.resolve(true))
vi.mock('../../lib/jobsDocuments/printWindow', () => ({
  openHtmlPreviewWindow: (html: string) => previewSpy(html),
  openHtmlWindowWhenReady: (build: () => Promise<string>) => whenReadySpy(build),
}))
vi.mock('../../lib/jobs/lienReleaseInk', () => ({ lienReleaseRowSignatureWithInk: () => Promise.resolve(null) }))

// Sent from this job (v2.4554): the rows the tab is given, and the two doors to a kept copy.
let sent: SentCopy[] = []
let authRole = 'dev'
const openCopySpy = vi.fn((_row: { copyPath: string | null }, _label: string) => Promise.resolve(true))
const openFileSpy = vi.fn((_path: string) => Promise.resolve(true))
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  loadSentCopiesForJob: () => Promise.resolve(sent),
  openSentCopy: (row: { copyPath: string | null }, label: string) => openCopySpy(row, label),
  openSentFile: (path: string) => openFileSpy(path),
}))

// The AIA window has its own render test; here it is a stub that says what it was handed.
vi.mock('./AiaG702G703Modal', () => ({
  default: ({ open, onClose, initialApplicationNumber, zIndex }: { open: boolean; onClose: () => void; initialApplicationNumber?: number | null; zIndex?: number }) =>
    open ? (
      <div data-testid="aia-stub">
        application {initialApplicationNumber ?? 'new'} at {zIndex}
        <button type="button" onClick={onClose}>
          close aia
        </button>
      </div>
    ) : null,
}))

function app(no: number, thisPeriod: number, previous: number, certified: number, link = '', reason?: string): SavedPayApplication {
  const w = payApplicationWriteFromForm(
    'job-1',
    {
      values: {
        g702_n5_project: String(no),
        g702_n6_period_to: no === 1 ? '09/30/2026' : '10/31/2026',
        g702_h18_original_contract_sum: 48500,
        g702_c28_retainage_percent: 10,
        g702_h40_less_previous_certificates: certified,
      },
      lines: [{ id: 'line-1', label: 'Plumbing', scheduledValue: 48500, labor: null, stage: null, fromPrevious: previous, thisPeriod, stored: 0 }],
      splitLaborMaterial: false,
    },
    link,
    reason,
  )
  if (!w.ok) throw new Error(w.reason)
  return savedPayApplicationFromRow({ id: `app-${no}`, updated_at: null, ...w.row } as PayApplicationRow)
}

const job = makeJob({ id: 'job-1', google_drive_link: 'https://drive.google.com/drive/folders/abc', job_plans_link: '', job_pictures_link: null })

beforeEach(() => {
  onJob = []
  reports = []
  contracts = []
  lienPaper = { filings: [], letters: [], releases: [] }
  sent = []
  authRole = 'dev'
  openCopySpy.mockClear()
  openFileSpy.mockClear()
  previewSpy.mockClear()
  whenReadySpy.mockClear()
  loadSpy.mockClear()
  signedUrlSpy.mockClear()
  externalSpy.mockClear()
  openTestReportSpy.mockClear()
  pdfSpy.mockClear()
})

describe('JobWindowDocumentsTab', () => {
  it('lists the job\'s pay applications with their files, and opens one in the AIA window', async () => {
    onJob = [app(1, 19400, 0, 0, 'https://docs.google.com/spreadsheets/d/abc123/edit'), app(2, 9700, 19400, 17460)]
    const escSpy = vi.fn()
    renderWithProviders(<JobWindowDocumentsTab job={job} onOverlayOpenChange={escSpy} />)

    const rows = await screen.findAllByTestId('job-documents-pay-app')
    expect(rows.map((r) => r.textContent)).toEqual(['109/30/2026$17,460.00Open the fileOpen', '210/31/2026$8,730.00No linkOpen'])
    expect((screen.getByRole('link', { name: 'Open the file' }) as HTMLAnchorElement).href).toBe('https://docs.google.com/spreadsheets/d/abc123/edit')
    // 29,100 to date at 10%.
    expect(screen.getByText('Retainage held as of application 2: $2,910.00')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open application 2' }))
    expect(screen.getByTestId('aia-stub').textContent).toContain('application 2 at 1030')
    expect(escSpy).toHaveBeenLastCalledWith(true)

    // Closing the window reads the list again: what was saved in it shows here.
    onJob = [...onJob, app(3, 4850, 29100, 26190)]
    fireEvent.click(screen.getByRole('button', { name: 'close aia' }))
    expect(escSpy).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(screen.getAllByTestId('job-documents-pay-app')).toHaveLength(3))
    expect(loadSpy).toHaveBeenCalledTimes(2)
  })

  it('shows a saved application\'s name beside its number', async () => {
    onJob = [{ ...app(1, 19400, 0, 0), name: 'Sent to the GC' }, app(2, 9700, 19400, 17460)]
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    const rows = await screen.findAllByTestId('job-documents-pay-app')
    expect(rows[0]!.textContent).toContain('1 · Sent to the GC')
    expect(screen.getAllByTestId('job-documents-pay-app-name')).toHaveLength(1)
  })

  it('marks an application that no longer matches the one before it, with its reason', async () => {
    // Application 1 now reads 21,000 of work; 2 and 3 went out on 19,400.
    onJob = [app(1, 21000, 0, 0), app(2, 9700, 19400, 17460, '', 'It went out this way on Nov 2.'), app(3, 4850, 29100, 26190)]
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    await screen.findAllByTestId('job-documents-pay-app')
    const flags = screen.getAllByTestId('job-documents-pay-app-flag')
    // 2 differs from 1; 3 still follows 2 as 2 was saved.
    expect(flags.map((f) => f.textContent)).toEqual(['⚠ No longer matches application 1. Kept as it is: It went out this way on Nov 2.'])
  })

  it('says so when nothing is saved, and New application opens the window on a new one', async () => {
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    expect(await screen.findByText(/No pay applications are saved on this job\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New application' }))
    expect(screen.getByTestId('aia-stub').textContent).toContain('application new')
  })

  it('lists the job\'s folders that are set', async () => {
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    await screen.findByText(/No pay applications are saved/)
    expect((screen.getByRole('link', { name: 'Job folder' }) as HTMLAnchorElement).href).toBe('https://drive.google.com/drive/folders/abc')
    expect(screen.queryByRole('link', { name: 'Plans' })).toBeNull()
  })

  it('lists the bills that went out; a row opens View bill above the job window and PDF rebuilds it', async () => {
    const billed = makeJob({
      id: 'job-1',
      invoices: [
        makeInvoice({ id: 'inv-draft', job_id: 'job-1', status: 'ready_to_bill', sequence_order: 3, amount: 500 }),
        makeInvoice({ id: 'inv-1', job_id: 'job-1', status: 'paid', sequence_order: 1, amount: 17460, sent_to_customer_at: '2026-10-02T15:00:00Z' }),
        makeInvoice({ id: 'inv-2', job_id: 'job-1', status: 'billed', sequence_order: 2, amount: 8730, sent_to_customer_at: '2026-11-03T16:00:00Z', hosted_invoice_url: 'https://invoice.stripe.com/i/abc' }),
      ],
    })
    const escSpy = vi.fn()
    renderWithProviders(<JobWindowDocumentsTab job={billed} onOverlayOpenChange={escSpy} />)
    await screen.findByText(/No pay applications are saved/)

    expect(screen.getAllByTestId('job-documents-bill').map((r) => r.textContent)).toEqual([
      'Bill 1Stripe$17,460.00PaidPDF',
      "Bill 2Stripe$8,730.00Sent 11/03/2026 · Customer's pagePDF",
    ])
    expect((screen.getByRole('link', { name: "Customer's page" }) as HTMLAnchorElement).href).toBe('https://invoice.stripe.com/i/abc')

    fireEvent.click(screen.getByRole('button', { name: 'Bill 2' }))
    expect(screen.getByTestId('bill-view-stub').textContent).toContain('bill inv-2 at 1030')
    expect(escSpy).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'close bill' }))
    expect(screen.queryByTestId('bill-view-stub')).toBeNull()
    expect(escSpy).toHaveBeenLastCalledWith(false)

    fireEvent.click(screen.getByRole('button', { name: 'Open the PDF of Bill 1' }))
    expect(pdfSpy.mock.calls[0]![0]).toEqual({ id: 'inv-1', job_id: 'job-1' })
  })

  it('says so when no bill has gone out', async () => {
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    expect(await screen.findByText('No bill has gone out on this job.')).toBeTruthy()
  })

  it('lists the test reports: a sent one opens its stored PDF, a draft opens the Test report window', async () => {
    reports = [
      { id: 'tr-1', title: 'Sewer Pre-Test report', detail: 'tested Sep 10', chips: [{ label: 'PASS', tone: 'pass' }, { label: 'Sent Sep 11', tone: 'sent' }], door: { kind: 'pdf', path: 'job-1/tr-1.pdf' }, searchText: '' },
      { id: 'tr-2', title: 'Gas test report', detail: 'tested Oct 1', chips: [{ label: 'Draft', tone: 'draft' }], door: { kind: 'modal' }, searchText: '' },
    ]
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    const rows = await screen.findAllByTestId('job-documents-test-report')
    expect(rows.map((r) => r.textContent)).toEqual(['Sewer Pre-Test reporttested Sep 10PASSSent Sep 11', 'Gas test reporttested Oct 1Draft'])

    fireEvent.click(screen.getByRole('button', { name: 'Sewer Pre-Test report' }))
    await waitFor(() => expect(externalSpy).toHaveBeenCalledWith('https://files.example/job-1/tr-1.pdf'))
    expect(openTestReportSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Gas test report' }))
    await waitFor(() => expect(openTestReportSpy).toHaveBeenCalledTimes(1))
    expect(openTestReportSpy.mock.calls[0]![0]).toMatchObject({ reportId: 'tr-2' })

    // The heading's button starts one.
    fireEvent.click(screen.getByRole('button', { name: 'Test report' }))
    expect(openTestReportSpy).toHaveBeenCalledTimes(2)
    expect(openTestReportSpy.mock.calls[1]![0].reportId).toBeUndefined()
  })

  it('says so when the job has no test report', async () => {
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    expect(await screen.findByText('No test report is on this job.')).toBeTruthy()
  })

  it('lists the job\'s contracts: a signed one opens the Contract window on its record, one only sent opens the page', async () => {
    contracts = [
      { id: 'con-1', job_id: 'job-1', status: 'sent', revision: 1, template_name: 'Service Agreement', signed_at: null, last_sent_at: '2026-09-10T15:00:00Z', voided_at: null, signed_document_url: null },
      { id: 'con-2', job_id: 'job-1', status: 'signed', revision: 2, template_name: 'Service Agreement', signed_at: '2026-09-12T15:00:00Z', signer_mode: 'type', signer_printed_name: 'Pat Heron', last_sent_at: '2026-09-11T15:00:00Z', voided_at: null, signed_document_url: 'drive.google.com/file/d/signed' },
    ] as unknown as JobContractRow[]
    const escSpy = vi.fn()
    renderWithProviders(<JobWindowDocumentsTab job={job} onOverlayOpenChange={escSpy} />)
    const rows = await screen.findAllByTestId('job-documents-contract-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('Service Agreementrev 1')
    expect(rows[1]!.textContent).toContain('Service Agreementrev 2')
    expect((screen.getByRole('link', { name: 'Signed copy' }) as HTMLAnchorElement).href).toBe('https://drive.google.com/file/d/signed')

    const names = screen.getAllByRole('button', { name: 'Service Agreement' })
    fireEvent.click(names[0]!)
    expect(previewSpy).toHaveBeenCalledWith('<p>contract con-1</p>')
    expect(screen.queryByTestId('contract-window-stub')).toBeNull()

    fireEvent.click(names[1]!)
    expect(screen.getByTestId('contract-window-stub').textContent).toContain('contract window on con-2')
    expect(escSpy).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'close contract' }))
    expect(escSpy).toHaveBeenLastCalledWith(false)

    // The heading's button opens the window with no record picked.
    fireEvent.click(screen.getByRole('button', { name: 'Contract window' }))
    expect(screen.getByTestId('contract-window-stub').textContent).toContain('contract window on no record')
  })

  it('lists the job\'s lien paper: a filing or a letter opens the Lien window on its tab, a release opens its page', async () => {
    lienPaper = {
      filings: [{ id: 'f1', job_id: 'job-1', kind: 'notice_53_056', amount: 4200, months_covered: [], recording_number: '', document_url: 'drive.google.com/file/d/notice', filed_at: null, served_at: '2026-09-14T15:00:00Z', serve_due: null, voided_at: null, created_at: '2026-09-14T00:00:00Z' }],
      letters: [{ id: 'l1', job_id: 'job-1', amount: 4200, sent_at: '2026-09-30T16:00:00Z', sent_method: 'certified_mail', deadline_date: '2026-10-14', voided_at: null, created_at: '2026-09-30T00:00:00Z' }],
      releases: [{ id: 'r1', job_id: 'job-1', form_type: 'conditional_progress', status: 'signed', amount: 17460, voided_at: null, created_at: '2026-10-05T00:00:00Z', fields: {}, invoice_ids: [] }],
    } as unknown as JobLienPaper
    const escSpy = vi.fn()
    renderWithProviders(<JobWindowDocumentsTab job={job} onOverlayOpenChange={escSpy} />)
    const rows = await screen.findAllByTestId('job-documents-lien-row')
    expect(rows[0]!.textContent).toBe('§ 53.056 noticeServed 09/14/2026Saved copy$4,200.00')
    expect(rows[1]!.textContent).toBe('Demand letterSent 09/30/2026 by certified mail · reply by 10/14/2026$4,200.00')
    expect(rows[2]!.textContent).toContain('Release of lien')
    expect(rows[2]!.textContent).toContain('$17,460.00')
    expect((screen.getByRole('link', { name: 'Saved copy' }) as HTMLAnchorElement).href).toBe('https://drive.google.com/file/d/notice')

    fireEvent.click(screen.getByRole('button', { name: '§ 53.056 notice' }))
    expect(screen.getByTestId('lien-window-stub').textContent).toContain('lien window on notice for Dana Office office@example.com')
    expect(escSpy).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'close lien' }))
    expect(escSpy).toHaveBeenLastCalledWith(false)

    fireEvent.click(screen.getByRole('button', { name: 'Demand letter' }))
    expect(screen.getByTestId('lien-window-stub').textContent).toContain('lien window on demand')
    fireEvent.click(screen.getByRole('button', { name: 'close lien' }))

    fireEvent.click(screen.getByRole('button', { name: 'Release of lien' }))
    expect(whenReadySpy).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('lien-window-stub')).toBeNull()
  })

  it('lists what was sent from the job, newest first: a line opens its copy, a repeat folds, an email shows its attachment', async () => {
    const base: Omit<SentCopy, 'id' | 'sentAt'> = { kind: 'owner_records_packet', title: 'Records for 9703 Lenox Hill', how: 'print', recipientName: 'Umar Khan', recipientEmails: [], subject: '', sourceTable: '', sourceId: null, copyPath: 's1/copy.html', copyType: 'text/html', copyHash: 'h1', attachments: [], sentByName: 'Dana' }
    sent = [
      { ...base, id: 's1', sentAt: '2026-10-05T20:30:00Z' },
      { ...base, id: 's2', sentAt: '2026-10-05T20:34:00Z' },
      { ...base, id: 's3', kind: 'bill', title: 'Bill 2', how: 'email', recipientName: '', recipientEmails: ['ap@gc.example'], copyPath: 's3/copy.html', copyHash: 'h3', attachments: [{ name: 'Bill 2.pdf', path: 's3/Bill-2.pdf', type: 'application/pdf' }], sentAt: '2026-10-06T15:00:00Z' },
      { ...base, id: 's4', kind: 'demand_letter', title: 'Demand letter', how: 'mail', copyPath: null, copyType: '', copyHash: '', sentAt: '2026-10-01T15:00:00Z' },
    ]
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    const rows = await screen.findAllByTestId('job-documents-sent-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.textContent).toMatch(/^Bill 2Emailed Oct 6, 2026, .* · to ap@gc\.example · by DanaBill 2\.pdf$/)
    expect(rows[1]!.textContent).toMatch(/^Records for 9703 Lenox HillPrinted 2 times, last Oct 5, 2026, .* · to Umar Khan · by Dana$/)
    expect(rows[2]!.textContent).toMatch(/^Demand letterMailed Oct 1, 2026, .* · to Umar Khan · by DanaThe copy was not kept\.$/)

    fireEvent.click(screen.getByRole('button', { name: 'Records for 9703 Lenox Hill' }))
    await waitFor(() => expect(openCopySpy).toHaveBeenCalledTimes(1))
    expect(openCopySpy.mock.calls[0]![0]).toMatchObject({ id: 's2', copyPath: 's1/copy.html' })
    expect(openCopySpy.mock.calls[0]![1]).toMatch(/^Copy as it went out · Records for 9703 Lenox Hill · Printed 2 times/)
    fireEvent.click(screen.getByRole('button', { name: 'Bill 2.pdf' }))
    await waitFor(() => expect(openFileSpy).toHaveBeenCalledWith('s3/Bill-2.pdf'))
    // A row whose copy was not kept has nothing to open.
    expect(screen.queryByRole('button', { name: 'Demand letter' })).toBeNull()
  })

  it('says so when nothing has been filed, and leaves the list out for a role outside the office', async () => {
    const first = renderWithProviders(<JobWindowDocumentsTab job={job} />)
    expect((await screen.findByTestId('job-documents-sent-empty')).textContent).toBe('No copy is on file for this job yet. A copy is kept each time something about the job is printed or sent.')
    first.unmount()
    authRole = 'primary'
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    await screen.findByText('No contract has been sent or signed on this job.')
    expect(screen.queryByRole('heading', { name: 'Sent from this job' })).toBeNull()
  })

  it('says so when the job has no contract and no lien paper', async () => {
    renderWithProviders(<JobWindowDocumentsTab job={job} />)
    expect(await screen.findByText('No contract has been sent or signed on this job.')).toBeTruthy()
    expect(await screen.findByText('No lien notice, demand letter or release is on this job.')).toBeTruthy()
  })
})
