// @vitest-environment jsdom
/**
 * Serve the filed liens (punch list #366, steps 3 and 4): one window prints every filed lien's copies behind a mail
 * sheet, holds what cannot print with its reason, and keeps each mail number, each receipt, each *Mailed* tick and each
 * document number the moment it is added (v2.7846): no press records anything. The copy in each envelope is the
 * clerk's stamped scan (v2.7916): the window reads each saved copy as it opens, and nothing stands in for one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import type { LienServeJob } from '../../lib/jobs/lienServePackets'
import LienServeWindow from './LienServeWindow'

import type { LienCopyLoaded } from '../../lib/jobs/lienStampedCopyIo'
import type { LienServePrintResult, printLienServeRun } from '../../lib/jobs/lienServePrintIo'
import { LIEN_COPY_BROKEN_HOLD, lienCopyUnreadableHold } from '../../lib/jobs/lienStampedCopy'

vi.mock('../../lib/sent/sentCopiesIo', () => ({ fileSentCopy: async () => true }))
vi.mock('../../lib/jobs/jobFolderAddFileIo', () => ({ putJobFolderFile: async () => ({ driveFileId: 'made-up', url: 'https://drive.example/made-up' }) }))
// The trash call a receipt's take-off makes (v2.7743), with the order it came in against the filing's write.
const order: string[] = []
vi.mock('../../lib/jobs/jobFolderTrashIo', () => ({
  takeFileToTrash: async (jobId: string, id: string | null) => {
    order.push(`trash:${jobId}:${id}`)
    return id ? { where: 'trash' } : null
  },
  untrashJobFolderFile: async () => ({ url: '' }),
}))

afterEach(() => {
  cleanup()
  order.length = 0
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
  filing: { id: `f-${number}`, job_id: `job-${number}`, kind: 'affidavit', fields: FIELDS, county: 'Alder', recording_number: `2026-${number}`, filed_at: '2026-11-13', serve_due: '2026-11-18', served_at: null, voided_at: null, sends: [], document_url: `https://drive.google.com/file/d/1SampleStampedScan${number}/view`, ...over } as unknown as JobLienFilingRow,
})

const JOBS = [job('2291'), job('2104', { serve_due: '2026-11-11' }), job('2340', { recording_number: '' })]
const issuer = { companyName: 'Sample Plumbing LLC', addressText: 'PO Box 100\nMarlow, TX 78000', phone: '(512) 555-0142', email: '', licenseLine: '' } as never

/** The filing's sends as a kept proof leaves them: the write's own answer, which the window remembers. */
const keepFake = () => vi.fn(async (args: { filingId: string; recipient: string; proof: { tracking?: string; receiptUrl?: string } }) => [{ recipient: args.recipient, method: 'certified_mail', tracking: args.proof.tracking ?? '', ...(args.proof.receiptUrl ? { receipt_url: args.proof.receiptUrl } : {}) }])

/** A saved copy as the read finds it: a two-page stamped scan unless the test says otherwise. */
const scan = (pages = 2, bytes = 450_000): LienCopyLoaded => ({ read: { state: 'ok', file: { kind: 'pdf', pages, bytes, sha256: 'made-up' } }, bytes: new Uint8Array([1, 2, 3]) })
/** The read of every lien's saved copy, by the scan's file id; a file the test does not name is a usual scan. */
const readFake = (byFile: Record<string, LienCopyLoaded | Promise<LienCopyLoaded>> = {}) => vi.fn(async (_jobId: string, fileId: string) => byFile[fileId] ?? scan())
type PrintArgs = Parameters<typeof printLienServeRun>
/** The print: every lien it was handed went to the printer, unless the test says one was left out. */
const printFake = (leftOut: Record<string, string> = {}) =>
  vi.fn(async (run: PrintArgs[0], _bytesOf: PrintArgs[1], _opts: PrintArgs[2]): Promise<LienServePrintResult> => ({
    how: 'opened',
    printed: run.ready.filter((r) => !leftOut[r.job.jobNumber]).map((r) => ({ jobId: r.job.jobId, filingId: r.job.filing.id })),
    notPrinted: run.ready.filter((r) => leftOut[r.job.jobNumber]).map((r) => ({ job: r.job, reason: leftOut[r.job.jobNumber]! })),
  }))

function open(over: Partial<Parameters<typeof LienServeWindow>[0]> = {}) {
  const props = { jobs: JOBS, todayYmd: '2026-11-16', issuer, onOpenJob: vi.fn(), onChanged: vi.fn(), onClose: vi.fn(), keep: keepFake() as never, mark: vi.fn(async () => []), saveNumber: vi.fn(async () => {}), ...over }
  // The two fakes keep their own types, so a test can read what they were called with.
  const readCopy = (over.readCopy ?? readFake()) as ReturnType<typeof readFake>
  const printRun = (over.printRun ?? printFake()) as ReturnType<typeof printFake>
  renderWithProviders(<LienServeWindow {...props} readCopy={readCopy} printRun={printRun} />)
  return { ...props, readCopy, printRun }
}
const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement

describe('LienServeWindow', () => {
  it('opened from a stop window’s card, lands on that job’s copy: its line is lit and the cursor is in its number', () => {
    open({ land: { part: 'numbers', jobId: 'job-2104', recipient: 'original_contractor', cursor: true } })
    const lit = document.querySelectorAll('[data-landed="yes"]')
    expect(lit).toHaveLength(1)
    expect(lit[0]!.getAttribute('data-lien-serve-envelope')).toBe('original_contractor')
    expect(lit[0]!.closest('[data-lien-serve-job]')?.getAttribute('data-lien-serve-job')).toBe('job-2104')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Job 2104, original contractor, certified mail number')
  })

  it('opened from a divider’s code, lands on that envelope’s number and says which day its first number records', () => {
    open({ land: { part: 'numbers', jobId: 'job-2104', recipient: 'original_contractor', cursor: true, fromCode: true } })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Job 2104, original contractor, certified mail number')
    const note = document.querySelectorAll('[data-lien-serve-code-day]')
    expect(note).toHaveLength(1)
    expect(note[0]!.closest('[data-lien-serve-job]')?.getAttribute('data-lien-serve-job')).toBe('job-2104')
    // Beside the box the code named, which the landing centres: a phone shows them together.
    expect(note[0]!.closest('[data-lien-serve-envelope]')?.getAttribute('data-lien-serve-envelope')).toBe('original_contractor')
    expect(note[0]!.textContent).toBe('The first number marks this lien mailed on Nov 16. Mailed another day? Change Mailed on at the top first.')
  })

  it('says nothing of the day on a landing that came from no code, or from the mail sheet’s', () => {
    open({ land: { part: 'numbers', jobId: 'job-2104', recipient: 'owner', cursor: true } })
    expect(document.querySelectorAll('[data-lien-serve-code-day]')).toHaveLength(0)
  })

  it('opened from its own press, lights nothing', () => {
    open()
    expect(document.querySelectorAll('[data-landed="yes"]')).toHaveLength(0)
  })

  it('opened by a door that said Print, lights the print half, and by one that said Enter mail numbers, the numbers’ heading', () => {
    open({ land: { part: 'print' } })
    expect(document.querySelector('[data-landed="yes"]')?.hasAttribute('data-lien-serve-print-part')).toBe(true)
    cleanup()
    open({ land: { part: 'numbers' } })
    expect(document.querySelector('[data-landed="yes"]')?.textContent).toBe('2 · After the post office: enter mail numbers')
  })

  it('a print tells the desk which liens’ copies went to the printer', async () => {
    const onPrinted = vi.fn()
    open({ onPrinted })
    fireEvent.click(await screen.findByRole('button', { name: 'Print 2 liens’ copies · 1 held ▸' }))
    await waitFor(() => expect(onPrinted).toHaveBeenCalledWith(['f-2104', 'f-2291']))
  })

  it('says how many filed liens owe their copies, the soonest day, and what is late', () => {
    open()
    expect(screen.getByText('3 filed liens owe their copies. The soonest was due Nov 11.')).toBeTruthy()
    expect(screen.getByText('1 is past its day. Mail it today.')).toBeTruthy()
    expect(screen.getByText('5 days late')).toBeTruthy()
  })

  it('reads each saved copy as it opens, and the press waits for them', async () => {
    let land: (v: LienCopyLoaded) => void = () => {}
    const slow = new Promise<LienCopyLoaded>((resolve) => {
      land = resolve
    })
    const props = open({ readCopy: readFake({ '1SampleStampedScan2291': slow }) })
    // One read is still out: the press is dead and says so.
    const press = await screen.findByRole('button', { name: 'Reading 1 stamped copy…' })
    expect((press as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(press)
    expect(props.printRun).not.toHaveBeenCalled()
    land(scan())
    expect(((await screen.findByRole('button', { name: 'Print 2 liens’ copies · 1 held ▸' })) as HTMLButtonElement).disabled).toBe(false)
    // Each ready lien's saved copy is read once, by its job and its file in Drive. A held lien's is not.
    expect(props.readCopy.mock.calls.map((c) => c.slice(0, 2))).toEqual([['job-2104', '1SampleStampedScan2104'], ['job-2291', '1SampleStampedScan2291']])
    expect(document.querySelector('[data-lien-serve-doc="2291"] [data-lien-serve-copy-pages]')?.textContent).toBe(' · 2 pages')
  })

  it('prints what is ready with each lien’s own stamped copy, and holds the rest with a door', async () => {
    const props = open()
    fireEvent.click(await screen.findByRole('button', { name: 'Print 2 liens’ copies · 1 held ▸' }))
    await waitFor(() => expect(props.printRun).toHaveBeenCalledTimes(1))
    const [run, bytesOf, opts] = props.printRun.mock.calls[0]!
    expect(run.ready.map((r) => [r.job.jobNumber, r.copy.fileId, r.file.pages, r.envelopes.length])).toEqual([['2104', '1SampleStampedScan2104', 2, 2], ['2291', '1SampleStampedScan2291', 2, 2]])
    // The bytes the print carries are the ones the read brought.
    expect(Array.from(bytesOf('f-2291') ?? [])).toEqual([1, 2, 3])
    expect(opts).toMatchObject({ letter: true, todayYmd: '2026-11-16' })
    expect(screen.getByText('4 envelopes. A mail sheet prints first and stays in the office. Each print is kept on its job.')).toBeTruthy()
    expect(document.querySelector('[data-lien-serve-copy-is]')?.textContent).toBe('The copy in each envelope is the clerk’s stamped scan, every page of it. The print opens as one PDF in a new tab. Print on one side of the paper.')
    // The redrawn page's own line is gone with the page.
    expect(document.body.textContent).not.toContain('Counsel has not said yet that this page counts as the copy')
    const held = within(document.querySelector('[data-lien-serve-held-list]') as HTMLElement)
    expect(held.getByText('2340 · Sample Job')).toBeTruthy()
    expect(held.getByText('no recording number yet.')).toBeTruthy()
    // Held for its number alone: the door is its own card's box, not another window.
    expect(held.queryByRole('button', { name: 'Open the Lien window' })).toBeNull()
    fireEvent.click(held.getByRole('button', { name: 'Type it on its card ›' }))
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Job 2340, document number' }))
    expect(props.onOpenJob).not.toHaveBeenCalled()
  })

  it('holds a lien with no stamped copy with its reason and its door, and the rest still print', async () => {
    const props = open({ jobs: [job('2291'), job('2104', { document_url: '' }), job('2400', { document_url: 'https://example.com/scan.pdf' })] })
    fireEvent.click(await screen.findByRole('button', { name: 'Print 1 lien’s copies · 2 held ▸' }))
    await waitFor(() => expect(props.printRun).toHaveBeenCalledTimes(1))
    expect(props.printRun.mock.calls[0]![0].ready.map((r) => r.job.jobNumber)).toEqual(['2291'])
    const none = document.querySelector('[data-lien-serve-held="no_saved_copy"]') as HTMLElement
    expect(none.textContent).toContain('2104 · Sample Job')
    expect(none.textContent).toContain('no stamped copy saved.')
    expect(none.textContent).toContain('Add the clerk’s stamped scan on the job’s Lien window.')
    fireEvent.click(within(none).getByRole('button', { name: 'Open the Lien window' }))
    expect(props.onOpenJob).toHaveBeenCalledWith('job-2104')
    expect(document.querySelector('[data-lien-serve-held="copy_not_drive"]')?.textContent).toContain('the saved copy is a link the app cannot read.')
    // Neither was read: there is no file to ask for.
    expect(props.readCopy).toHaveBeenCalledTimes(1)
  })

  it('holds a saved copy the app cannot read or cannot print, and says why', async () => {
    const props = open({
      jobs: [job('2291'), job('2104'), job('2400')],
      readCopy: readFake({
        '1SampleStampedScan2104': { read: { state: 'held', hold: lienCopyUnreadableHold('That file is not in the job’s Drive folder.') }, bytes: null },
        '1SampleStampedScan2400': { read: { state: 'held', hold: LIEN_COPY_BROKEN_HOLD }, bytes: null },
      }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Print 1 lien’s copies · 2 held ▸' }))
    await waitFor(() => expect(props.printRun).toHaveBeenCalledTimes(1))
    expect(props.printRun.mock.calls[0]![0].ready.map((r) => r.job.jobNumber)).toEqual(['2291'])
    expect(document.querySelector('[data-lien-serve-held="copy_unreadable"]')?.textContent).toContain('the app could not read the saved copy: That file is not in the job’s Drive folder.')
    expect(document.querySelector('[data-lien-serve-held="copy_broken"]')?.textContent).toContain('the saved copy is a PDF the app cannot open.')
  })

  it('asks about a saved copy that looks like more than one lien, and prints it on the reader’s word', async () => {
    const props = open({ jobs: [job('2291'), job('2104')], readCopy: readFake({ '1SampleStampedScan2104': scan(18, 3_900_000) }) })
    await screen.findByRole('button', { name: 'Print 1 lien’s copies · 1 held ▸' })
    const ask = document.querySelector('[data-lien-serve-held="copy_several"]') as HTMLElement
    expect(ask.textContent).toContain('the saved copy has 18 pages, and a stamped lien is usually 2.')
    expect(within(ask).getByRole('link', { name: 'Open the saved copy ›' }).getAttribute('href')).toBe('https://drive.google.com/file/d/1SampleStampedScan2104/view')
    fireEvent.click(within(ask).getByRole('button', { name: 'It is this lien alone. Print it' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Print 2 liens’ copies' }))
    await waitFor(() => expect(props.printRun).toHaveBeenCalledTimes(1))
    expect(props.printRun.mock.calls[0]![0].ready.map((r) => [r.job.jobNumber, r.file.pages])).toEqual([['2104', 18], ['2291', 2]])
  })

  it('names a lien the print left out after all, with its reason, and tells the desk of the rest', async () => {
    const onPrinted = vi.fn()
    open({ jobs: [job('2291'), job('2104')], onPrinted, printRun: printFake({ '2104': 'its papers could not be put together' }) })
    fireEvent.click(await screen.findByRole('button', { name: 'Print 2 liens’ copies' }))
    await waitFor(() => expect(onPrinted).toHaveBeenCalledWith(['f-2291']))
    const left = document.querySelector('[data-lien-serve-not-printed]') as HTMLElement
    expect(left.textContent).toContain('1 lien’s copies did not print. It stays here with the reason.')
    expect(left.textContent).toContain('2104 · Sample Job: its papers could not be put together')
  })

  it('says so when the browser blocks the new tab, and tells the desk nothing', async () => {
    const onPrinted = vi.fn()
    const props = open({ onPrinted, printRun: vi.fn(async (): Promise<LienServePrintResult> => ({ how: 'blocked' })) })
    fireEvent.click(await screen.findByRole('button', { name: 'Print 2 liens’ copies · 1 held ▸' }))
    await waitFor(() => expect(props.printRun).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Popup blocked — allow popups to print.')).toBeTruthy()
    expect(onPrinted).not.toHaveBeenCalled()
  })

  it('a lien held for an address still opens its Lien window', () => {
    const props = open({ jobs: [job('2340', { fields: { ...FIELDS, ownerAddress: '' } })] })
    fireEvent.click(within(document.querySelector('[data-lien-serve-held-list]') as HTMLElement).getByRole('button', { name: 'Open the Lien window' }))
    expect(props.onOpenJob).toHaveBeenCalledWith('job-2340')
  })

  it('has no Record press: a tick writes the Mailed on day to that lien at once, and an untick takes it back', async () => {
    const props = open()
    expect(document.querySelector('[data-lien-serve-record]')).toBeNull()
    expect(document.querySelector('[data-lien-serve-foot]')?.textContent).toBe('Everything here is saved as you go.')
    fireEvent.change(screen.getByLabelText('Mailed on'), { target: { value: '2026-11-15' } })
    fireEvent.click(box('Job 2340, mailed'))
    await waitFor(() => expect(props.mark).toHaveBeenCalledWith({ filingId: 'f-2340', servedOn: '2026-11-15' }))
    const row = document.querySelector('[data-lien-serve-row="2340"]') as HTMLElement
    await waitFor(() => expect(row.querySelector('[data-lien-serve-mailed-said="ok"]')?.textContent).toBe('Mailed Nov 15. Saved.'))
    expect(row.getAttribute('data-lien-serve-mailed')).toBe('yes')
    expect(within(row).getByText('mailed Nov 15')).toBeTruthy()
    // The other liens are untouched.
    expect(box('Job 2104, mailed').checked).toBe(false)
    expect(props.mark).toHaveBeenCalledTimes(1)
    fireEvent.click(box('Job 2340, mailed'))
    await waitFor(() => expect(props.mark).toHaveBeenLastCalledWith({ filingId: 'f-2340', servedOn: null }))
    await waitFor(() => expect(row.querySelector('[data-lien-serve-mailed-said="ok"]')?.textContent).toBe('Not mailed. Saved.'))
    expect(box('Job 2340, mailed').checked).toBe(false)
    // The desk reads again once, on the way out.
    expect(props.onChanged).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('[data-lien-serve-close]') as HTMLButtonElement)
    expect(props.onChanged).toHaveBeenCalledTimes(1)
  })

  it('a mail number ticks Mailed once it is kept, and writes the day', async () => {
    const props = open()
    const number = screen.getByRole('textbox', { name: 'Job 2104, owner, certified mail number' })
    fireEvent.change(number, { target: { value: '9589 0001' } })
    // Typing alone ticks nothing: the number is kept when the box is left.
    expect(box('Job 2104, mailed').checked).toBe(false)
    fireEvent.blur(number)
    await waitFor(() => expect(props.mark).toHaveBeenCalledWith({ filingId: 'f-2104', servedOn: '2026-11-16' }))
    await waitFor(() => expect(box('Job 2104, mailed').checked).toBe(true))
    expect(document.querySelector('[data-lien-serve-row="2104"] [data-lien-serve-mailed-said="ok"]')?.textContent).toBe('Mailed Nov 16. Saved.')
  })

  it('a receipt with no number ticks nothing, and the card says what to do when the envelopes go out', async () => {
    const receipt = 'https://drive.google.com/file/d/made-up-receipt-1/view'
    const props = open({ jobs: [job('2104', { sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', receipt_url: receipt }] })] })
    expect(box('Job 2104, mailed').checked).toBe(false)
    expect(document.querySelector('[data-lien-serve-row="2104"] [data-lien-serve-tick-when]')?.textContent).toBe('Kept on this lien. Tick Mailed when its envelopes have gone out.')
    expect(props.mark).not.toHaveBeenCalled()
  })

  it('a box a hand unticked is left alone by a number typed later', async () => {
    const props = open()
    fireEvent.click(box('Job 2104, mailed'))
    await waitFor(() => expect(props.mark).toHaveBeenCalledTimes(1))
    fireEvent.click(box('Job 2104, mailed'))
    await waitFor(() => expect(props.mark).toHaveBeenCalledTimes(2))
    const number = screen.getByRole('textbox', { name: 'Job 2104, owner, certified mail number' })
    fireEvent.change(number, { target: { value: '9589 0001' } })
    fireEvent.blur(number)
    await waitFor(() => expect(props.keep).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.querySelector('[data-lien-serve-row="2104"] [data-lien-serve-kept="owner"]')).not.toBeNull())
    expect(props.mark).toHaveBeenCalledTimes(2)
    expect(box('Job 2104, mailed').checked).toBe(false)
  })

  it('refuses a tick in words while Mailed on holds no day', async () => {
    const props = open()
    fireEvent.change(screen.getByLabelText('Mailed on'), { target: { value: '' } })
    fireEvent.click(box('Job 2291, mailed'))
    expect(document.querySelector('[data-lien-serve-row="2291"] [data-lien-serve-mailed-said="bad"]')?.textContent).toBe('Set the day the copies were mailed.')
    expect(props.mark).not.toHaveBeenCalled()
    expect(box('Job 2291, mailed').checked).toBe(false)
  })

  it('puts the box back and says why when the tick did not land', async () => {
    const mark = vi.fn(async () => {
      throw { message: 'permission denied for table job_lien_filings' }
    })
    open({ mark: mark as never })
    fireEvent.click(box('Job 2291, mailed'))
    await waitFor(() => expect(document.querySelector('[data-lien-serve-row="2291"] [data-lien-serve-mailed-said="bad"]')?.textContent).toBe('Not saved: permission denied for table job_lien_filings. The box is back as the lien holds it.'))
    expect(box('Job 2291, mailed').checked).toBe(false)
  })

  it('shows a mailed lien that still lacks a receipt under the rest, ticked, with its day', () => {
    open({ mailed: [job('2400', { served_at: '2026-11-15', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0009', sent_on: '2026-11-15' }] })] })
    expect(document.querySelector('[data-lien-serve-mailed-head]')?.textContent).toBe('Mailed')
    const row = document.querySelector('[data-lien-serve-row="2400"]') as HTMLElement
    expect(box('Job 2400, mailed').checked).toBe(true)
    expect(within(row).getByText('mailed Nov 15')).toBeTruthy()
    // It is not one of the liens that owe their copies.
    expect(screen.getByText('3 filed liens owe their copies. The soonest was due Nov 11.')).toBeTruthy()
  })

  it('moves to the next envelope on Enter, as a scanner ends its number', () => {
    open()
    const first = screen.getByRole('textbox', { name: 'Job 2104, owner, certified mail number' })
    const second = screen.getByRole('textbox', { name: 'Job 2104, original contractor, certified mail number' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(document.activeElement).toBe(second)
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
    const keep = keepFake()
    const props = open({ keep: keep as never })
    expect(document.querySelector('[data-lien-serve-kept-lead]')?.textContent).toBe('Saved as you go. Each receipt, number and tick is kept on its lien the moment you add it. Nothing here waits on a button.')
    const number = screen.getByRole('textbox', { name: 'Job 2104, owner, certified mail number' })
    fireEvent.change(number, { target: { value: '9589 0001' } })
    fireEvent.blur(number)
    await waitFor(() => expect(keep).toHaveBeenCalledWith({ filingId: 'f-2104', recipient: 'owner', proof: { tracking: '9589 0001', receiptUrl: '' } }))
    await waitFor(() => expect(document.querySelector('[data-lien-serve-row="2104"] [data-lien-serve-kept="owner"]')?.textContent).toBe('Kept on this lien.'))
    // Leaving the box again with nothing new writes nothing.
    fireEvent.blur(number)
    expect(keep).toHaveBeenCalledTimes(1)
    // The desk reads again once on the way out.
    expect(props.onChanged).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).slice(-1)[0]!)
    expect(props.onChanged).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('takes a wrong receipt off its lien first, then sends the file to Drive’s trash (v2.7743)', async () => {
    const receipt = 'https://drive.google.com/file/d/made-up-receipt-1/view'
    let land: () => void = () => {}
    const keep = vi.fn(async (args: { recipient: string; proof: { tracking?: string; receiptUrl?: string } }) => {
      order.push(`keep:${args.proof.receiptUrl}`)
      await new Promise<void>((done) => (land = done))
      return [{ recipient: args.recipient, method: 'certified_mail', tracking: args.proof.tracking ?? '' }]
    })
    open({ jobs: [job('2104', { sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', receipt_url: receipt }] })], keep: keep as never })
    const owner = document.querySelector('[data-lien-serve-row="2104"] [data-lien-serve-envelope="owner"]') as HTMLElement
    fireEvent.click(within(owner).getByRole('button', { name: 'Take off' }))
    expect(within(owner).getByText('Take this receipt off? The file goes to Drive’s trash. Drive keeps it there 30 days.')).toBeTruthy()
    fireEvent.click(within(owner).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(keep).toHaveBeenCalledWith({ filingId: 'f-2104', recipient: 'owner', proof: { tracking: '9589 0001', receiptUrl: '' } }))
    // The lien still names the file until its write lands, so the trash is not asked yet.
    expect(order).toEqual(['keep:'])
    land()
    await waitFor(() => expect(owner.querySelector('[data-lien-receipt-off]')?.textContent).toContain('Taken off. The file is in Drive’s trash.'))
    expect(order).toEqual(['keep:', 'trash:job-2104:made-up-receipt-1'])
  })

  it('leaves the file in Drive when the lien did not take the take-off, and says why', async () => {
    const receipt = 'https://drive.google.com/file/d/made-up-receipt-1/view'
    const keep = vi.fn(async () => {
      throw new Error('The network dropped.')
    })
    open({ jobs: [job('2104', { sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0001', receipt_url: receipt }] })], keep: keep as never })
    const owner = document.querySelector('[data-lien-serve-row="2104"] [data-lien-serve-envelope="owner"]') as HTMLElement
    fireEvent.click(within(owner).getByRole('button', { name: 'Take off' }))
    fireEvent.click(within(owner).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(owner.querySelector('[data-lien-serve-not-kept="owner"]')?.textContent).toBe('Not kept yet: The network dropped. Click the box and leave it to try again.'))
    expect(order).toEqual([])
    expect(owner.querySelector('[data-lien-receipt-off]')).toBeNull()
  })

  it('says why a number was not kept, and ticks nothing on a number the lien does not hold', async () => {
    const keep = vi.fn(async () => {
      throw new Error('The network dropped.')
    })
    open({ keep: keep as never })
    const number = screen.getByRole('textbox', { name: 'Job 2291, owner, certified mail number' })
    fireEvent.change(number, { target: { value: '9589 0002' } })
    fireEvent.blur(number)
    await waitFor(() => expect(document.querySelector('[data-lien-serve-row="2291"] [data-lien-serve-not-kept="owner"]')?.textContent).toBe('Not kept yet: The network dropped. Click the box and leave it to try again.'))
    expect(box('Job 2291, mailed').checked).toBe(false)
  })

  it('has a door to Back from the clerk while approved liens are not on record as filed, and none otherwise', () => {
    const onPress = vi.fn()
    open({ filingsDoor: { label: 'Enter document numbers · 3 ›', count: 3, onPress } })
    const door = document.querySelector('[data-lien-serve-filings-door]') as HTMLElement
    expect(door.textContent).toContain('3 approved liens are not on record as filed yet.')
    fireEvent.click(within(door).getByRole('button', { name: 'Enter document numbers · 3 ›' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    cleanup()
    open()
    expect(document.querySelector('[data-lien-serve-filings-door]')).toBeNull()
  })

  it('names the receipt for the post office: Add the mail receipt, and the number on the mail receipt', () => {
    open()
    const owner = document.querySelector('[data-lien-serve-row="2291"] [data-lien-serve-envelope="owner"]') as HTMLElement
    expect(within(owner).getByRole('button', { name: 'Add the mail receipt' })).toBeTruthy()
    expect(within(owner).getByText('The post office’s slip for this envelope. A photo or a PDF.')).toBeTruthy()
    expect((within(owner).getByRole('textbox') as HTMLInputElement).placeholder).toBe('the number on the mail receipt')
  })

  it('asks before it keeps a file that looks like the lien as a mail receipt, and sends nothing until the answer', async () => {
    const keep = keepFake()
    open({ keep: keep as never })
    const owner = document.querySelector('[data-lien-serve-row="2291"] [data-lien-serve-envelope="owner"]') as HTMLElement
    const pick = () => fireEvent.change(owner.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(['%PDF-made-up'], 'J2291 Lien (2026-2291).pdf', { type: 'application/pdf' })] } })
    pick()
    const doubt = await waitFor(() => owner.querySelector('[data-lien-receipt-doubt]') as HTMLElement)
    expect(doubt.textContent).toContain('This looks like the lien, not a mail receipt. Its name holds this lien’s document number. Nothing was saved yet.')
    expect(keep).not.toHaveBeenCalled()
    fireEvent.click(within(doubt).getByRole('button', { name: 'Leave it out' }))
    expect(owner.querySelector('[data-lien-receipt-doubt]')).toBeNull()
    expect(keep).not.toHaveBeenCalled()
    // The reader's word sends it: a scan can be named anything.
    pick()
    fireEvent.click(within(await waitFor(() => owner.querySelector('[data-lien-receipt-doubt]') as HTMLElement)).getByRole('button', { name: 'It is the mail receipt' }))
    await waitFor(() => expect(keep).toHaveBeenCalledWith({ filingId: 'f-2291', recipient: 'owner', proof: { tracking: '', receiptUrl: 'https://drive.example/made-up' } }))
    await waitFor(() => expect(within(owner).getByText('✓ Mail receipt saved')).toBeTruthy())
    // A file alone ticks nothing.
    expect(box('Job 2291, mailed').checked).toBe(false)
  })

  it('asks before the second envelope takes the file the first one just took', async () => {
    const keep = keepFake()
    open({ keep: keep as never })
    const row = document.querySelector('[data-lien-serve-row="2291"]') as HTMLElement
    const pickFor = (copy: string) => fireEvent.change(row.querySelector(`[data-lien-serve-envelope="${copy}"] input[type="file"]`) as HTMLInputElement, { target: { files: [new File(['made-up scan'], 'scan 12.pdf', { type: 'application/pdf' })] } })
    pickFor('owner')
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(row.querySelector('[data-lien-serve-envelope="owner"] [data-lien-receipt-saved]')).not.toBeNull())
    pickFor('original_contractor')
    const doubt = await waitFor(() => row.querySelector('[data-lien-serve-envelope="original_contractor"] [data-lien-receipt-doubt]') as HTMLElement)
    expect(doubt.textContent).toContain('This is the same file as this lien’s other envelope. Each envelope has its own receipt.')
    expect(keep).toHaveBeenCalledTimes(1)
  })

  it('shows each lien’s document number, county, day filed and stamped lien on its card', () => {
    open({ jobs: [job('2291', { document_url: 'https://drive.google.com/file/d/made-up-scan/view' }), job('2104', { document_url: '' })] })
    const doc = (n: string) => document.querySelector(`[data-lien-serve-doc="${n}"]`) as HTMLElement
    expect(doc('2291').textContent).toContain('Document no. 2026-2291 · Alder County · filed Nov 13')
    expect(within(doc('2291')).getByRole('link', { name: 'Job 2291, open the stamped lien' }).getAttribute('href')).toBe('https://drive.google.com/file/d/made-up-scan/view')
    expect(doc('2104').querySelector('[data-lien-serve-stamped]')?.textContent).toBe('No stamped lien kept yet.')
  })

  it('Change opens the number, a clean one is saved when the box is left, and the desk reads again at once', async () => {
    const props = open({ docKnown: [{ filingId: 'f-2291', county: 'Alder', number: '2026-2291', filedYmd: '2026-11-13', jobLabel: '2291 · Sample Job' }, { filingId: 'f-2104', county: 'Alder', number: '2026-2104', filedYmd: '2026-11-13', jobLabel: '2104 · Sample Job' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Job 2291, change the document number' }))
    const input = screen.getByRole('textbox', { name: 'Job 2291, document number' }) as HTMLInputElement
    expect(input.value).toBe('2026-2291')
    fireEvent.change(input, { target: { value: ' 2026-2292 ' } })
    fireEvent.blur(input)
    await waitFor(() => expect(props.saveNumber).toHaveBeenCalledWith({ filingId: 'f-2291', number: '2026-2292' }))
    await waitFor(() => expect(document.querySelector('[data-lien-serve-doc="2291"] [data-lien-serve-doc-number]')?.textContent).toBe('2026-2292'))
    expect(document.querySelector('[data-lien-serve-doc="2291"] [data-lien-serve-doc-said="ok"]')?.textContent?.trim()).toBe('Number saved.')
    expect(props.onChanged).toHaveBeenCalledTimes(1)
  })

  it('holds a number another lien holds, asks about an odd one, and saves that on the reader’s word', async () => {
    const props = open({ docKnown: [{ filingId: 'f-2291', county: 'Alder', number: '2026-2291', filedYmd: '2026-11-13', jobLabel: '2291 · Sample Job' }, { filingId: 'f-2104', county: 'Alder', number: '2026-2104', filedYmd: '2026-11-13', jobLabel: '2104 · Sample Job' }] })
    // The lien with no number takes it on its own card.
    const input = screen.getByRole('textbox', { name: 'Job 2340, document number' }) as HTMLInputElement
    expect(document.querySelector('[data-lien-serve-doc="2340"]')?.textContent).toContain('No document number yet.')
    fireEvent.change(input, { target: { value: '2026 2104' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(document.querySelector('[data-lien-serve-doc="2340"] [data-lien-serve-doc-said="bad"]')?.textContent?.trim()).toBe('2104 · Sample Job holds this number too. Two liens cannot share one. Check both stamps.'))
    expect(props.saveNumber).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '2026-234' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const said = await waitFor(() => document.querySelector('[data-lien-serve-doc="2340"] [data-lien-serve-doc-said="warn"]') as HTMLElement)
    expect(said.textContent).toContain('Alder County’s numbers on record have 8 digits and start with the year filed. This one has 7 digits. Check it against the stamp.')
    expect(props.saveNumber).not.toHaveBeenCalled()
    fireEvent.click(within(said).getByRole('button', { name: 'Save it anyway' }))
    await waitFor(() => expect(props.saveNumber).toHaveBeenCalledWith({ filingId: 'f-2340', number: '2026-234' }))
  })

  it('says to print again when a number changes on a lien whose copies were printed, and why a number did not save', async () => {
    const known = [{ filingId: 'f-2291', county: 'Alder', number: '2026-2291', filedYmd: '2026-11-13', jobLabel: '2291 · Sample Job' }]
    const saveNumber = vi.fn(async (args: { number: string }) => {
      if (args.number === '2026-2299') throw { message: 'permission denied for table job_lien_filings' }
    })
    open({ docKnown: known, printed: new Set(['f-2291']), saveNumber: saveNumber as never })
    fireEvent.click(screen.getByRole('button', { name: 'Job 2291, change the document number' }))
    const input = () => screen.getByRole('textbox', { name: 'Job 2291, document number' })
    fireEvent.change(input(), { target: { value: '2026-2299' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    await waitFor(() => expect(document.querySelector('[data-lien-serve-doc="2291"] [data-lien-serve-doc-said="bad"]')?.textContent?.trim()).toBe('Not saved: permission denied for table job_lien_filings. The box still holds what you typed.'))
    fireEvent.change(input(), { target: { value: '2026-2292' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    await waitFor(() => expect(document.querySelector('[data-lien-serve-doc="2291"] [data-lien-serve-doc-said="warn"]')?.textContent?.trim()).toBe('Number saved. Its copies were printed with the old number. Print them again.'))
  })
})
