// @vitest-environment jsdom
/**
 * Serve the filed liens (punch list #366, steps 3 and 4): one window prints every filed lien's copies behind a mail
 * sheet, holds what cannot print with its reason, and records the day and the mail numbers of every ticked lien.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import type { LienServeJob } from '../../lib/jobs/lienServePackets'
import type { LienServeWrite } from '../../lib/jobs/lienServeNumbers'
import LienServeWindow from './LienServeWindow'

const prints: string[] = []
const filed: Array<{ filing: Record<string, unknown>; html: string }> = []

vi.mock('../../lib/jobsDocuments/printWindow', () => ({
  openHtmlPrintWindow: (html: string) => {
    prints.push(html)
    return true
  },
}))
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  fileSentCopy: async (filing: Record<string, unknown>, body: { html: string }) => {
    filed.push({ filing, html: body.html })
  },
}))
vi.mock('../../lib/jobs/jobFolderAddFileIo', () => ({ putJobFolderFile: async () => ({ driveFileId: 'made-up', url: 'https://drive.example/made-up' }) }))

afterEach(() => {
  cleanup()
  prints.length = 0
  filed.length = 0
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

const job = (number: string, over: Record<string, unknown> = {}): LienServeJob => ({
  jobId: `job-${number}`,
  jobNumber: number,
  jobLabel: `${number} · Sample Job`,
  isSub: true,
  filing: { id: `f-${number}`, job_id: `job-${number}`, kind: 'affidavit', fields: FIELDS, county: 'Alder', recording_number: `2026-${number}`, filed_at: '2026-11-13', serve_due: '2026-11-18', served_at: null, voided_at: null, sends: [], ...over } as unknown as JobLienFilingRow,
})

const JOBS = [job('2291'), job('2104', { serve_due: '2026-11-11' }), job('2340', { recording_number: '' })]
const issuer = { companyName: 'Sample Plumbing LLC', addressText: 'PO Box 100\nMarlow, TX 78000', phone: '(512) 555-0142', email: '', licenseLine: '' } as never

function open(over: Partial<Parameters<typeof LienServeWindow>[0]> = {}) {
  const props = { jobs: JOBS, todayYmd: '2026-11-16', issuer, onOpenJob: vi.fn(), onChanged: vi.fn(), onClose: vi.fn(), record: vi.fn(async (writes: ReadonlyArray<LienServeWrite>) => ({ done: [...writes], failed: [] })), ...over }
  renderWithProviders(<LienServeWindow {...props} />)
  return props
}

describe('LienServeWindow', () => {
  it('says how many filed liens owe their copies, the soonest day, and what is late', () => {
    open()
    expect(screen.getByText('3 filed liens owe their copies. The soonest was due Nov 11.')).toBeTruthy()
    expect(screen.getByText('1 is past its day. Mail it today.')).toBeTruthy()
    expect(screen.getByText('5 days late')).toBeTruthy()
  })

  it('prints what is ready behind a mail sheet, files each job’s own papers, and holds the rest with a door', () => {
    const props = open()
    fireEvent.click(screen.getByRole('button', { name: 'Print 2 liens’ copies · 1 held ▸' }))
    expect(prints).toHaveLength(1)
    expect(prints[0]).toContain('data-lien-serve-sheet')
    expect(prints[0]).toContain('Copies of filed lien affidavits: 4 envelopes')
    expect(filed.map((f) => [f.filing.kind, f.filing.title, f.filing.how, (f.filing.source as { id: string }).id])).toEqual([
      ['lien_affidavit_copy', 'Copy of lien affidavit — Job 2104', 'print', 'f-2104'],
      ['lien_affidavit_copy', 'Copy of lien affidavit — Job 2291', 'print', 'f-2291'],
    ])
    expect(filed[0]!.html).not.toContain('data-lien-serve-sheet')
    const held = within(document.querySelector('[data-lien-serve-held-list]') as HTMLElement)
    expect(held.getByText('2340 · Sample Job')).toBeTruthy()
    expect(held.getByText('no recording number yet.')).toBeTruthy()
    fireEvent.click(held.getByRole('button', { name: 'Open the Lien window' }))
    expect(props.onOpenJob).toHaveBeenCalledWith('job-2340')
  })

  it('records only the liens that are ticked, with the day and each number', async () => {
    const props = open()
    const press = () => document.querySelector('[data-lien-serve-record]') as HTMLButtonElement
    expect(press().disabled).toBe(true)
    expect(screen.getByText('Tick Mailed on each lien whose copies went out, or type a mail number.')).toBeTruthy()
    // Typing a number ticks its lien.
    fireEvent.change(screen.getByRole('textbox', { name: 'Job 2104, owner, certified mail number' }), { target: { value: '9589 0001' } })
    expect((screen.getByRole('checkbox', { name: 'Job 2104, mailed' }) as HTMLInputElement).checked).toBe(true)
    // A lien mailed with no number yet is ticked by hand.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Job 2340, mailed' }))
    fireEvent.change(screen.getByLabelText('Mailed on'), { target: { value: '2026-11-15' } })
    expect(press().textContent).toBe('Record 2 liens served')
    fireEvent.click(press())
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1))
    expect(props.record).toHaveBeenCalledWith([
      { filingId: 'f-2104', jobId: 'job-2104', jobLabel: '2104 · Sample Job', servedOn: '2026-11-15', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', sent_on: '2026-11-15' }] },
      { filingId: 'f-2340', jobId: 'job-2340', jobLabel: '2340 · Sample Job', servedOn: '2026-11-15', sends: [] },
    ])
    // One lien is still to record, so the window stays.
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('moves to the next envelope on Enter, as a scanner ends its number', () => {
    open()
    const first = screen.getByRole('textbox', { name: 'Job 2104, owner, certified mail number' })
    const second = screen.getByRole('textbox', { name: 'Job 2104, original contractor, certified mail number' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(document.activeElement).toBe(second)
  })

  it('keeps a lien that did not record in the list with its reason', async () => {
    const record = vi.fn(async (writes: ReadonlyArray<LienServeWrite>) => ({ done: [], failed: writes.map((write) => ({ write, reason: 'permission denied for table job_lien_filings' })) }))
    const props = open({ record })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Job 2291, mailed' }))
    fireEvent.click(document.querySelector('[data-lien-serve-record]') as HTMLButtonElement)
    await waitFor(() => expect(screen.getByText('Not recorded: permission denied for table job_lien_filings')).toBeTruthy())
    expect(props.onChanged).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('closes once every lien is recorded', async () => {
    const props = open({ jobs: [job('2291')] })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Job 2291, mailed' }))
    fireEvent.click(document.querySelector('[data-lien-serve-record]') as HTMLButtonElement)
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
  })

  it('has a dead print press and says so when every lien is held', () => {
    open({ jobs: [job('2340', { recording_number: '' })] })
    const print = document.querySelector('[data-lien-serve-batch-print]') as HTMLButtonElement
    expect(print.disabled).toBe(true)
    expect(print.textContent).toBe('Print ▸')
    expect(screen.getByText('Nothing is ready to print. Fix what is marked in red, then print.')).toBeTruthy()
  })

  it('has a door to Add the stamped scans when the desk hands one', () => {
    const onAddScans = vi.fn()
    open({ onAddScans })
    fireEvent.click(screen.getByRole('button', { name: 'Add the stamped scans ›' }))
    expect(onAddScans).toHaveBeenCalledTimes(1)
  })

  it('draws no scans part without the door', () => {
    open()
    expect(document.querySelector('[data-lien-serve-scans-part]')).toBeNull()
  })
  it('keeps a number on its lien when the box is left, and a receipt taken off too', async () => {
    const keep = vi.fn(async (args: { filingId: string; recipient: string; proof: { tracking?: string; receiptUrl?: string } }) => [{ recipient: args.recipient, method: 'certified_mail', tracking: args.proof.tracking ?? '', ...(args.proof.receiptUrl ? { receipt_url: args.proof.receiptUrl } : {}) }])
    const props = open({ keep: keep as never })
    expect(document.querySelector('[data-lien-serve-kept-lead]')?.textContent).toBe('Saved as you go. Each receipt and number is kept on its lien the moment you add it. Record sets the day mailed.')
    const box = screen.getByRole('textbox', { name: 'Job 2104, owner, certified mail number' })
    fireEvent.change(box, { target: { value: '9589 0001' } })
    fireEvent.blur(box)
    await waitFor(() => expect(keep).toHaveBeenCalledWith({ filingId: 'f-2104', recipient: 'owner', proof: { tracking: '9589 0001', receiptUrl: '' } }))
    await waitFor(() => expect(document.querySelector('[data-lien-serve-row="2104"] [data-lien-serve-kept="owner"]')?.textContent).toBe('Kept on this lien.'))
    // Leaving the box again with nothing new writes nothing.
    fireEvent.blur(box)
    expect(keep).toHaveBeenCalledTimes(1)
    // The desk reads again once on the way out.
    expect(props.onChanged).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).slice(-1)[0]!)
    expect(props.onChanged).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('says why a number was not kept, and that Record still saves it', async () => {
    const keep = vi.fn(async () => {
      throw new Error('The network dropped.')
    })
    open({ keep: keep as never })
    const box = screen.getByRole('textbox', { name: 'Job 2291, owner, certified mail number' })
    fireEvent.change(box, { target: { value: '9589 0002' } })
    fireEvent.blur(box)
    await waitFor(() => expect(document.querySelector('[data-lien-serve-row="2291"] [data-lien-serve-not-kept="owner"]')?.textContent).toBe('Not kept yet: The network dropped. Record saves it with the day.'))
    expect((document.querySelector('[data-lien-serve-record]') as HTMLButtonElement).disabled).toBe(false)
  })
})
