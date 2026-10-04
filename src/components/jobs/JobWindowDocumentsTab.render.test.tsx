// @vitest-environment jsdom
/**
 * Render smoke for the job window's Documents tab (v2.4491): the job's saved pay applications
 * with the link to each sent file, the row's Open handing the AIA window that application, New
 * application handing it none, the list reloading when the window closes, and the job's folders.
 * Since v2.4495 the tab also lists the job's bills and test reports.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { TestReportDocumentRow } from '../../lib/jobsDocuments/testReportDocumentRow'
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
      g702_n5_project: String(no),
      g702_n6_period_to: no === 1 ? '09/30/2026' : '10/31/2026',
      g702_h18_original_contract_sum: 48500,
      g702_c28_retainage_percent: 10,
      g702_h40_less_previous_certificates: certified,
      g703_d13_scheduled_value: 48500,
      g703_e13_from_previous: previous,
      g703_f13_this_period: thisPeriod,
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
})
