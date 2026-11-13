// @vitest-environment jsdom
/**
 * The Lien window's help sheets (punch list #314): a short-form affidavit prints behind a cover sheet with the job's
 * facts, the copy filed on the job is the paper alone, the box turns the sheet off, and **Print a guide copy** prints
 * the marked copy and files nothing. Made-up names and addresses only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/lienNoticeByHandIo', () => ({ loadJobsAtProperty: async () => [], recordLienNoticeByHand: async () => ({ packetId: 'p1', filingIds: ['f1'] }) }))

const openPrintMock = vi.fn((_html: string) => true)
vi.mock('../../lib/jobsDocuments/printWindow', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobsDocuments/printWindow')>('../../lib/jobsDocuments/printWindow')
  return { ...actual, openHtmlPrintWindow: (html: string) => openPrintMock(html) }
})
const fileCopyMock = vi.fn(async (_filing: { kind: string; title: string; how: string; jobIds?: ReadonlyArray<string> }, _body: { html: string }) => true)
vi.mock('../../lib/sent/sentCopiesIo', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sent/sentCopiesIo')>('../../lib/sent/sentCopiesIo')
  return {
    ...actual,
    fileSentCopy: (filing: { kind: string; title: string; how: string; jobIds?: ReadonlyArray<string> }, body: { html: string }) => fileCopyMock(filing, body),
    printAndFile: (html: string, filing: { kind: string; title: string; jobIds?: ReadonlyArray<string> }) => {
      if (!openPrintMock(html)) return false
      void fileCopyMock({ ...filing, how: 'print' }, { html })
      return true
    },
  }
})

const job = makeJob({ id: 'job-412', click_number: '412', job_name: 'Ridgeway Builders', job_address: '18 Sample Ln, Marlow, TX 75001', status: 'billed', revenue: 2650, payments_made: 0, created_at: '2026-08-18T05:40:28Z', first_work_date: null, last_work_date: null, lien_last_work_on: null })
const address = { id: 'addr-1', county: 'Alder', legal_description: 'SAMPLE ESTATES, BLOCK 2, LOT 4', owner_name: 'Jordan and Casey Sample', owner_company: '', owner_mailing_address: '9 Placeholder Ct, Marlow, TX 75001', owner_mode: 'homeowner', homestead: false, property_kind: 'non_residential' }
const notice = { id: 'f-n', job_id: 'job-412', kind: 'notice_53_056', filed_at: null, serve_due: null, served_at: null, voided_at: null, county: '', recording_number: null, months_covered: ['2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-10-14' }], fields: {}, created_at: '2026-10-14T15:00:00Z' }

type Props = Parameters<typeof LienFilingTabs>[0]
const props = (over: Partial<Props> = {}): Props => ({
  job,
  jobNumber: '412',
  activeTab: 'affidavit',
  issuer: null,
  signerNameFallback: 'Pat Sample, Master Plumber',
  linkedAddress: address as never,
  jobOwnerRow: null,
  filings: [notice as never],
  clock: { workMonth: '2026-08', noticeDeadline: '2026-10-15', filingDeadline: '2026-11-16' },
  isSub: true,
  originalContractorName: 'Ridgeway Builders',
  originalContractorAddress: '40 Example Pkwy, Marlow, TX 75001',
  ownerEmail: '',
  originalContractorEmail: '',
  onChanged: () => {},
  ...over,
})

beforeEach(() => {
  openPrintMock.mockClear()
  fileCopyMock.mockClear()
  window.localStorage.removeItem('pt.lienHelpSheet.v1')
  window.localStorage.removeItem('pt.lienNoticeRecord.v1')
})
afterEach(() => {
  cleanup()
  window.localStorage.removeItem('pt.lienHelpSheet.v1')
  window.localStorage.removeItem('pt.lienNoticeRecord.v1')
})

describe('LienFilingTabs · the affidavit prints behind its help sheet (punch list #314)', () => {
  it('Print for notarization prints the cover sheet first, with the job’s facts, and files the paper alone', () => {
    renderWithProviders(<LienFilingTabs {...props()} />)
    const box = document.querySelector('[data-lien-window-help-sheet] input') as HTMLInputElement
    expect(document.querySelector('[data-lien-window-help-sheet]')?.textContent).toBe('Print the help sheet first')
    expect(box.checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    expect(openPrintMock).toHaveBeenCalledTimes(1)
    const html = openPrintMock.mock.calls[0]![0]
    expect(html.indexOf('data-lien-help="cover"')).toBeGreaterThan(0)
    expect(html.indexOf('data-lien-help="cover"')).toBeLessThan(html.indexOf('BEFORE ME'))
    expect(html).toContain('412 · Ridgeway Builders')
    expect(html).toContain('<strong>Alder County Clerk</strong>')
    expect(html).toContain('$2,650.00')
    expect(html).toContain('November 16, 2026')
    // A print counts as a send, and the help sheet is never the paper: the filed copy has none of it.
    expect(fileCopyMock).toHaveBeenCalledTimes(1)
    expect(fileCopyMock.mock.calls[0]![0]).toMatchObject({ kind: 'lien_affidavit', how: 'print', jobIds: ['job-412'] })
    expect(fileCopyMock.mock.calls[0]![1].html).not.toContain('lien-help')
    expect(fileCopyMock.mock.calls[0]![1].html).toContain('BEFORE ME')
  })

  it('the sheet says what the app checked, and the county box prints the county on both county lines (the best-we-can-do pass)', () => {
    const issuer = { companyName: 'Sample Plumbing LLC', addressText: '100 Made Up Rd, Marlow, TX 75001', phone: '', email: '', tagline: '', licenseLine: '', signingCounty: 'Alder' }
    renderWithProviders(<LienFilingTabs {...props({ issuer })} />)
    // The box opens on the county Settings hold.
    const county = document.querySelector('[data-lien-signing-county] input') as HTMLInputElement
    expect(county.value).toBe('Alder')
    // One line with a ? after it (v2.7209): with a county from Settings nothing more is said until the ? is asked, and its words are the box's description.
    const tip = document.querySelector('[data-lien-signing-county-hint]') as HTMLElement
    expect(tip.hidden).toBe(true)
    expect(county.getAttribute('aria-describedby')).toBe(tip.id)
    expect(tip.textContent).toBe('Both county lines print Alder County. Signing somewhere else? Type that county for this print.')
    fireEvent.focus(screen.getByRole('button', { name: 'About the county it is signed in' }))
    expect(tip.hidden).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    let html = openPrintMock.mock.calls[0]![0]
    // On the paper itself, behind the help sheet (whose small picture of the paper names the county too).
    const paperOf = (print: string) => print.slice(print.lastIndexOf('</section>'))
    expect(paperOf(html).match(/COUNTY OF ALDER/g)).toHaveLength(2)
    expect(html).not.toContain('where signed')
    expect(html).toContain('What the app checked on this paper')
    expect(html).toContain('Four things to write. Nothing else is written on the paper.')
    expect(html).toContain('The counties are printed: signed in Alder County.')
    expect(html).not.toContain('Do not sign. Call the office first if any of these is true.')
    expect(fileCopyMock.mock.calls[0]![1].html.match(/COUNTY OF ALDER/g)).toHaveLength(2)
    // Signed somewhere else this once: the typed county prints, and Settings are untouched.
    fireEvent.change(county, { target: { value: 'Cedar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    html = openPrintMock.mock.calls[1]![0]
    expect(paperOf(html).match(/COUNTY OF CEDAR/g)).toHaveLength(2)
    expect(html).toContain('signed in Cedar County')
    expect(issuer.signingCounty).toBe('Alder')
    // Cleared, the notary writes both lines by hand and the sheet lists six blanks again.
    fireEvent.change(county, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    html = openPrintMock.mock.calls[2]![0]
    expect(html).not.toContain('where signed')
    expect(paperOf(html)).toContain('<strong>COUNTY OF ___________</strong></p>')
    expect(html).toContain('COUNTY OF, at the top.')
  })

  it('with both boxes unticked the paper prints alone, as before, and each choice is kept on this computer', () => {
    renderWithProviders(<LienFilingTabs {...props()} />)
    fireEvent.click(document.querySelector('[data-lien-window-help-sheet] input') as HTMLInputElement)
    expect(window.localStorage.getItem('pt.lienHelpSheet.v1')).toBe('off')
    fireEvent.click(document.querySelector('[data-lien-window-notice-record] input') as HTMLInputElement)
    expect(window.localStorage.getItem('pt.lienNoticeRecord.v1')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    expect(openPrintMock.mock.calls[0]![0]).not.toContain('lien-help')
    expect(fileCopyMock).toHaveBeenCalledTimes(1)
  })

  it('a blocked print window files nothing', () => {
    openPrintMock.mockImplementationOnce(() => false)
    renderWithProviders(<LienFilingTabs {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    expect(fileCopyMock).not.toHaveBeenCalled()
  })

  it('Print a guide copy prints the marked copy alone and files nothing', () => {
    renderWithProviders(<LienFilingTabs {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Print a guide copy' }))
    expect(openPrintMock).toHaveBeenCalledTimes(1)
    const html = openPrintMock.mock.calls[0]![0]
    expect(html).toContain('data-lien-help="guide"')
    expect(html.match(/Guide copy · do not sign or file this page/g)).toHaveLength(2)
    expect(html).toContain('<span class="lien-help-num">1</span>')
    expect(html).toContain('<title>Guide copy — Job 412</title>')
    expect(fileCopyMock).not.toHaveBeenCalled()
  })

  it('a paper on the earlier form has no help sheet and no guide copy: both are written for the short form', () => {
    renderWithProviders(<LienFilingTabs {...props({ affidavitForm: 'long' })} />)
    expect(document.querySelector('[data-lien-window-help-sheet]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Print a guide copy' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    expect(openPrintMock.mock.calls[0]![0]).not.toContain('lien-help')
  })
})

describe('LienFilingTabs · the notice record and the copies of the notices print with the affidavit (punch list #322)', () => {
  // Two notices on the job: an early one to the owner alone, entered after the fact, and a later one to both with one number missing.
  const words = (noticeDate: string, claimAmount: string) => ({ noticeDate, projectDescription: '18 Sample Ln, Marlow, TX 75001', claimantName: 'Sample Plumbing LLC', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Ridgeway Builders', contractedWithIfDifferent: '', claimAmount, contactPerson: 'Pat Sample, Master Plumber', claimantAddress: '100 Made Up Rd, Marlow, TX 75001' })
  const row = { job_id: 'job-412', kind: 'notice_53_056', filed_at: null, serve_due: null, served_at: null, voided_at: null, county: '', recording_number: null, document_url: '', document_note: '' }
  const early = { ...row, id: 'f-1', by_hand: true, amount: 1900, months_covered: ['2026-08'], fields: words('2026-12-01', '1900.00'), created_at: '2026-12-02T15:00:00Z', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 0000 0000 0000 0000 01', sent_on: '2026-12-01' }] }
  const later = { ...row, id: 'f-2', amount: 2650, months_covered: ['2026-08'], document_url: 'https://drive.example/notice', fields: words('2026-12-09', '2650.00'), created_at: '2026-12-09T15:00:00Z', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 0000 0000 0000 0000 02', sent_on: '2026-12-09' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-12-09' }] }
  const voided = { ...row, id: 'f-0', amount: 1900, months_covered: ['2026-08'], fields: words('2026-11-20', '1900.00'), created_at: '2026-11-20T15:00:00Z', voided_at: '2026-11-21T10:00:00Z', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 0000 0000 0000 0000 00', sent_on: '2026-11-20' }] }
  const filings = [later, early, voided] as never[]

  it('prints the help sheet, the record, a copy of each notice, then the paper, and files the paper alone', () => {
    renderWithProviders(<LienFilingTabs {...props({ filings })} />)
    expect(document.querySelector('[data-lien-window-notice-record]')?.textContent).toBe('Print the notice record')
    expect((document.querySelector('[data-lien-window-notice-record] input') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    const html = openPrintMock.mock.calls[0]![0]
    const at = (needle: string) => html.indexOf(needle)
    expect(at('data-lien-help="cover"')).toBeGreaterThan(0)
    expect(at('data-lien-help="cover"')).toBeLessThan(at('data-lien-help="record"'))
    expect(at('data-lien-help="record"')).toBeLessThan(at('data-lien-record-copy-of="1"'))
    expect(at('data-lien-record-copy-of="1"')).toBeLessThan(at('data-lien-record-copy-of="2"'))
    expect(at('data-lien-record-copy-of="2"')).toBeLessThan(at('BEFORE ME'))
    // The record: both notices in the order they were mailed, each copy's number, and the copy the record lacks.
    expect(html).toContain('Notice 1 · Names August 2026 · Claim $1,900.00 · Entered after the fact Dec 2, 2026 · No saved copy')
    expect(html).toContain('9407 0000 0000 0000 0000 01')
    expect(html).toContain('No copy on record')
    expect(html).toContain('<strong>No number on record</strong>')
    // The paper's sentence 6 and the record agree, and the page says so.
    expect(html).toContain('6. Notice of the claim was sent to the owner by certified mail on December 1, 2026 and December 9, 2026.')
    expect(html).toContain('The paper says certified mail on December 1, 2026 and December 9, 2026. The owner’s copies on record say the same.')
    // Both went after August's last day to mail on this commercial property, so the page asks first; no table of the months is drawn.
    expect(html).toContain('data-lien-record-verdict="ask"')
    expect(html).not.toContain('Each month the paper swears')
    // The voided notice is counted in a line and drawn nowhere.
    expect(html).toContain('1 voided notice on this job is not counted and is not shown.')
    expect(html).not.toContain('9407 0000 0000 0000 0000 00')
    // Each copy is the notice's own form with the words its row keeps.
    expect(html.match(/Notice of Claim for Unpaid Labor or Materials/g)).toHaveLength(2)
    expect(html).toContain('Copies of the notices are next, then the paper to sign')
    // The cover sheet points at the record and keeps its own mark.
    expect(html).toContain('The notice record is next, then the paper to sign')
    // A print counts as a send, and the copy filed on the job is the paper alone.
    expect(fileCopyMock).toHaveBeenCalledTimes(1)
    expect(fileCopyMock.mock.calls[0]![1].html).not.toContain('lien-help')
    expect(fileCopyMock.mock.calls[0]![1].html).not.toContain('lien-record')
    expect(fileCopyMock.mock.calls[0]![1].html).not.toContain('Notice of Claim for Unpaid Labor')
    expect(fileCopyMock.mock.calls[0]![1].html).toContain('BEFORE ME')
  })

  it('with the help sheet off the record and the copies still print, and with the record off the help sheet prints as it did', () => {
    renderWithProviders(<LienFilingTabs {...props({ filings })} />)
    fireEvent.click(document.querySelector('[data-lien-window-help-sheet] input') as HTMLInputElement)
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    let html = openPrintMock.mock.calls[0]![0]
    expect(html).not.toContain('data-lien-help="cover"')
    expect(html).toContain('data-lien-help="record"')
    expect(html.match(/data-lien-help="notice-copy"/g)).toHaveLength(2)
    fireEvent.click(document.querySelector('[data-lien-window-help-sheet] input') as HTMLInputElement)
    fireEvent.click(document.querySelector('[data-lien-window-notice-record] input') as HTMLInputElement)
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    html = openPrintMock.mock.calls[1]![0]
    expect(html).toContain('data-lien-help="cover"')
    expect(html).not.toContain('data-lien-help="record"')
    expect(html).not.toContain('data-lien-help="notice-copy"')
    expect(html).toContain('The paper to sign is the next page')
    expect(fileCopyMock).toHaveBeenCalledTimes(2)
  })

  it('a job contracted with the owner owes no notice: no box, no record, no copy', () => {
    renderWithProviders(<LienFilingTabs {...props({ isSub: false, filings: [] })} />)
    expect(document.querySelector('[data-lien-window-notice-record]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    const html = openPrintMock.mock.calls[0]![0]
    expect(html).toContain('data-lien-help="cover"')
    expect(html).not.toContain('data-lien-help="record"')
  })

  it('a paper on the earlier form has no notice record: it is written for the short form’s two sentences', () => {
    renderWithProviders(<LienFilingTabs {...props({ filings, affidavitForm: 'long' })} />)
    expect(document.querySelector('[data-lien-window-notice-record]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Print for notarization' }))
    expect(openPrintMock.mock.calls[0]![0]).not.toContain('lien-record')
  })
})
