// @vitest-environment jsdom
/**
 * Print the copies to mail (punch list #366): a filed lien affidavit's cover letters and, behind each, the clerk's
 * stamped copy, printed from the Lien window and filed on the job. The copy is the filing's saved copy (v2.7916): a
 * filing with none, or with one the app cannot print, is held with its reason, and nothing is printed in its place.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import type { LienCopyLoaded } from '../../lib/jobs/lienStampedCopyIo'
import type { LienServePrintResult, printLienServeRun } from '../../lib/jobs/lienServePrintIo'
import { LIEN_COPY_NOT_PRINTABLE_HOLD } from '../../lib/jobs/lienStampedCopy'
import { LienServeCopiesPress } from './LienServeCopiesPress'

const updates: Array<{ row: Record<string, unknown>; id: unknown }> = []

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (row: Record<string, unknown>) => ({
        eq: async (_col: string, id: unknown) => {
          updates.push({ row, id })
          return { data: null, error: null }
        },
      }),
    }),
  },
}))
vi.mock('../../lib/sent/sentCopiesIo', () => ({ fileSentCopy: async () => true }))

afterEach(() => {
  cleanup()
  updates.length = 0
  window.localStorage.clear()
})

// Every name, address and figure here is made up.
const FIELDS = {
  county: 'Alder',
  claimantPersonName: 'Pat Marlow',
  claimantCompany: 'Sample Plumbing LLC',
  claimantAddress: 'PO Box 100, Marlow, TX 78000',
  legalDescription: 'LOT 1 BLK 2 ALDER SUBD',
  propertyAddress: '12 Alder St, Marlow, TX 78000',
  contractedWithName: 'Brightline Builders',
  workDescription: 'Plumbing labor and materials',
  workStart: '2026-08-01',
  workEnd: '2026-08-28',
  ownerName: 'Alder Holdings LLC',
  ownerAddress: '1 Owner Way, Marlow, TX 78000',
  originalContractorName: 'Brightline Builders',
  originalContractorAddress: '12 Example Pkwy, Marlow, TX 78000',
  contractAmount: '9000.00',
  paidAmount: '0.00',
  unpaidAmount: '9000.00',
  includeNoticesSworn: true,
  form: 'short',
  isSub: true,
}

const filing = (over: Record<string, unknown> = {}) =>
  ({ id: 'a1', job_id: 'job-77', kind: 'affidavit', fields: FIELDS, county: 'Alder', recording_number: '2026-0001', filed_at: '2026-11-13', serve_due: '2026-11-18', served_at: null, voided_at: null, sends: [], document_url: 'https://drive.google.com/file/d/1SampleStampedScan77/view', ...over }) as unknown as JobLienFilingRow

const issuer = { companyName: 'Sample Plumbing LLC', addressText: 'PO Box 100\nMarlow, TX 78000', phone: '(512) 555-0142', email: '', licenseLine: '' } as never

const scan = (pages = 2, bytes = 450_000): LienCopyLoaded => ({ read: { state: 'ok', file: { kind: 'pdf', pages, bytes, sha256: 'made-up' } }, bytes: new Uint8Array([1, 2, 3]) })
const readFake = (loaded: LienCopyLoaded = scan()) => vi.fn(async () => loaded)
type PrintArgs = Parameters<typeof printLienServeRun>
const printFake = () => vi.fn(async (run: PrintArgs[0], _bytesOf: PrintArgs[1], _opts: PrintArgs[2]): Promise<LienServePrintResult> => ({ how: 'opened', printed: run.ready.map((r) => ({ jobId: r.job.jobId, filingId: r.job.filing.id })), notPrinted: [] }))
const press = () => screen.getByRole('button', { name: 'Print the copies to mail' }) as HTMLButtonElement
const ready = () => waitFor(() => expect(press().disabled).toBe(false))

describe('LienServeCopiesPress', () => {
  it('reads the stamped copy, then prints each reader’s letter in front of it and tells the window', async () => {
    const readCopy = readFake()
    const printRun = printFake()
    const onPrinted = vi.fn()
    renderWithProviders(<LienServeCopiesPress filing={filing()} jobId="job-77" jobNumber="77" isSub issuer={issuer} onPrinted={onPrinted} readCopy={readCopy} printRun={printRun} />)
    // Until the copy is read the press is dead and says what it is waiting on.
    expect(press().disabled).toBe(true)
    expect(screen.getByText('Reading the stamped copy…')).toBeTruthy()
    await ready()
    expect(readCopy).toHaveBeenCalledWith('job-77', '1SampleStampedScan77')
    expect(screen.getByText('Two envelopes: the owner and the original contractor. Mail each envelope by certified mail. Then press Enter mail numbers… and type each number.')).toBeTruthy()
    expect(document.querySelector('[data-lien-serve-copy-is]')?.textContent).toBe('Stamped copy: 2 pages. The copy in each envelope is the clerk’s stamped scan, every page of it. The print opens as one PDF in a new tab.')
    fireEvent.click(press())
    await waitFor(() => expect(onPrinted).toHaveBeenCalledWith('a1'))
    const [run, bytesOf, opts] = printRun.mock.calls[0]!
    expect(run.ready.map((r) => [r.job.jobId, r.job.jobNumber, r.copy.fileId, r.file.pages, r.envelopes.map((e) => e.recipient).join()])).toEqual([['job-77', '77', '1SampleStampedScan77', 2, 'owner,original_contractor']])
    expect(Array.from(bytesOf('a1') ?? [])).toEqual([1, 2, 3])
    expect(opts.letter).toBe(true)
  })

  it('says counsel has not read the letter yet, and nothing of a page drawn in the copy’s place', async () => {
    renderWithProviders(<LienServeCopiesPress filing={filing()} jobId="job-77" jobNumber="77" isSub issuer={issuer} readCopy={readFake()} printRun={printFake()} />)
    await ready()
    expect(screen.getByText('Counsel has not read this letter yet.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('this page counts as the copy')
  })

  it('leaves the letter out when its box is unticked, and never the copy', async () => {
    const printRun = printFake()
    renderWithProviders(<LienServeCopiesPress filing={filing()} jobId="job-77" jobNumber="77" isSub={false} issuer={issuer} readCopy={readFake()} printRun={printRun} />)
    await ready()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Print the cover letter in front of each copy' }))
    expect(screen.queryByText('Counsel has not read this letter yet.')).toBeNull()
    fireEvent.click(press())
    await waitFor(() => expect(printRun).toHaveBeenCalledTimes(1))
    const [run, , opts] = printRun.mock.calls[0]!
    expect(opts.letter).toBe(false)
    // The filing's own answer wins over the job's: the paper on file names an original contractor. Both envelopes take the copy.
    expect(run.ready[0]?.envelopes).toHaveLength(2)
  })

  it('holds a filing with no stamped copy, says why and where to add it, and reads nothing', async () => {
    const readCopy = readFake()
    const printRun = printFake()
    renderWithProviders(<LienServeCopiesPress filing={filing({ document_url: null })} jobId="job-77" jobNumber="77" isSub issuer={issuer} readCopy={readCopy} printRun={printRun} />)
    expect(press().disabled).toBe(true)
    expect(screen.getByText('Held: no stamped copy saved.')).toBeTruthy()
    expect(screen.getByText('Add the clerk’s stamped scan on the job’s Lien window.')).toBeTruthy()
    fireEvent.click(press())
    expect(printRun).not.toHaveBeenCalled()
    expect(readCopy).not.toHaveBeenCalled()
  })

  it('holds a saved copy the app cannot print, with the reason', async () => {
    renderWithProviders(<LienServeCopiesPress filing={filing()} jobId="job-77" jobNumber="77" isSub issuer={issuer} readCopy={readFake({ read: { state: 'held', hold: LIEN_COPY_NOT_PRINTABLE_HOLD }, bytes: null })} printRun={printFake()} />)
    expect(await screen.findByText('Held: the saved copy is not a PDF, a JPEG or a PNG.')).toBeTruthy()
    expect(press().disabled).toBe(true)
  })

  it('asks about a saved copy that looks like more than one lien, and prints it on the reader’s word', async () => {
    const printRun = printFake()
    renderWithProviders(<LienServeCopiesPress filing={filing()} jobId="job-77" jobNumber="77" isSub issuer={issuer} readCopy={readFake(scan(18))} printRun={printRun} />)
    expect(await screen.findByText('Held: the saved copy has 18 pages, and a stamped lien is usually 2.')).toBeTruthy()
    expect(press().disabled).toBe(true)
    expect(screen.getByRole('link', { name: 'Open the saved copy ›' }).getAttribute('href')).toBe('https://drive.google.com/file/d/1SampleStampedScan77/view')
    fireEvent.click(screen.getByRole('button', { name: 'It is this lien alone. Print it' }))
    await ready()
    fireEvent.click(press())
    await waitFor(() => expect(printRun).toHaveBeenCalledTimes(1))
  })

  it('prints the stamped copy of an affidavit the app did not draw, with no letter, and says so', async () => {
    const printRun = printFake()
    renderWithProviders(<LienServeCopiesPress filing={filing({ fields: null })} jobId="job-77" jobNumber="77" isSub issuer={issuer} to={{ owner: { name: 'Alder Holdings LLC', address: '1 Owner Way, Marlow, TX 78000' }, contractor: { name: 'Brightline Builders', address: '12 Example Pkwy, Marlow, TX 78000' } }} readCopy={readFake()} printRun={printRun} />)
    await ready()
    expect(screen.getByText('No cover letter for this lien. The app holds no record of the affidavit’s words.')).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Print the cover letter in front of each copy' })).toBeNull()
    fireEvent.click(press())
    await waitFor(() => expect(printRun).toHaveBeenCalledTimes(1))
    expect(printRun.mock.calls[0]![0].ready[0]).toMatchObject({ letter: false })
  })

  it('holds a filing with no recording number, says why, and takes the number right there', async () => {
    const onChanged = vi.fn()
    const printRun = printFake()
    renderWithProviders(<LienServeCopiesPress filing={filing({ recording_number: '' })} jobId="job-77" jobNumber="77" isSub issuer={issuer} onChanged={onChanged} readCopy={readFake()} printRun={printRun} />)
    expect(press().disabled).toBe(true)
    expect(screen.getByText('Held: no recording number yet.')).toBeTruthy()
    expect(screen.getByText('Type the number the clerk gave.')).toBeTruthy()
    fireEvent.click(press())
    expect(printRun).not.toHaveBeenCalled()
    const save = screen.getByRole('button', { name: 'Save the number' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Recording number' }), { target: { value: ' 2026-0042 ' } })
    fireEvent.click(save)
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(updates).toEqual([{ row: { recording_number: '2026-0042' }, id: 'a1' }])
  })

  it('mails to the owner’s address on the property record today', async () => {
    const printRun = printFake()
    renderWithProviders(<LienServeCopiesPress filing={filing({ fields: { ...FIELDS, ownerAddress: '' } })} jobId="job-77" jobNumber="77" isSub issuer={issuer} to={{ owner: { name: 'Alder Holdings LLC', address: '500 New Owner Blvd, Marlow, TX 78000' }, contractor: { name: '', address: '' } }} readCopy={readFake()} printRun={printRun} />)
    await ready()
    fireEvent.click(press())
    await waitFor(() => expect(printRun).toHaveBeenCalledTimes(1))
    expect(printRun.mock.calls[0]![0].ready[0]?.envelopes[0]).toEqual({ recipient: 'owner', name: 'Alder Holdings LLC', address: '500 New Owner Blvd, Marlow, TX 78000' })
  })

  it('says where a missing address is added', () => {
    renderWithProviders(<LienServeCopiesPress filing={filing({ fields: { ...FIELDS, ownerAddress: '' } })} jobId="job-77" jobNumber="77" isSub issuer={issuer} readCopy={readFake()} printRun={printFake()} />)
    expect(screen.getByText('Held: no mailing address for the owner.')).toBeTruthy()
    expect(screen.getByText('Add it on the property record.')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Recording number' })).toBeNull()
  })

  it('draws nothing for a row that is not a filed affidavit', () => {
    const { container } = renderWithProviders(<LienServeCopiesPress filing={filing({ filed_at: null })} jobId="job-77" jobNumber="77" isSub issuer={issuer} readCopy={readFake()} printRun={printFake()} />)
    expect(container.querySelector('[data-lien-serve-copies]')).toBeNull()
  })
})
