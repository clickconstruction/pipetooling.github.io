// @vitest-environment jsdom
/**
 * An owner asked for our records (v2.4544): pick the owner, read the packet for that property
 * (each payment with its day and the time it was recorded), meet the checks, and record it as
 * sent only once the request, the contract check and the signed acknowledgment are on file.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienOwnerRecordsModal from './LienOwnerRecordsModal'
import { EMPTY_OWNER_RECORDS, type OwnerPacketJobInput, type OwnerRecordsFile, type OwnerRecordsPropertyRow } from '../../lib/jobs/ownerRecords'

const io = vi.hoisted(() => ({ jobs: [] as unknown[], file: null as unknown, available: true, saved: [] as Array<Record<string, unknown>>, downloaded: [] as Array<{ name: string; type: string }>, printed: [] as string[], filed: [] as Array<Record<string, unknown>> }))
vi.mock('../../lib/jobs/ownerRecordsIo', () => ({
  loadOwnerPacketJobs: async () => ({ jobs: io.jobs, gcIds: ['gc1'] }),
  loadOwnerRecords: async () => ({ available: io.available, rowId: null, file: io.file }),
  saveOwnerRecords: async (input: Record<string, unknown>) => {
    io.saved.push(input)
    return 'row-1'
  },
}))
// A print and a send each file a copy (v2.4554): the stub keeps what was filed and the page that went.
vi.mock('../../lib/portal/mintCustomerPortalLink', () => ({ mintCustomerPortalLink: async () => 'tok-owner' }))
vi.mock('../../lib/jobs/ownerRecordsPdf', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/ownerRecordsPdf')>('../../lib/jobs/ownerRecordsPdf')
  return { ...actual, ownerPacketPdfBlob: async () => new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' }) }
})
vi.mock('../../lib/storageSave', () => ({ saveBlobAs: (blob: Blob, name: string) => io.downloaded.push({ name, type: blob.type }) }))
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  printAndFile: (html: string, filing: Record<string, unknown>) => (io.printed.push(html), io.filed.push({ ...filing, how: 'print', html }), true),
  fileSentCopy: async (filing: Record<string, unknown>, body: { html?: string; contentType?: string }) => (io.filed.push({ ...filing, html: body.html, contentType: body.contentType }), true),
}))

const jobs: OwnerPacketJobInput[] = [
  {
    id: 'j273',
    number: '273',
    name: 'Dudley (Lennox)',
    address: '9703 Lenox Hl, San Antonio, TX',
    gcName: 'RMC- Dudley Mason',
    total: 20000,
    bills: [{ id: 'b1', amount: 12000, status: 'billed', billedAt: '2026-08-03T15:00:00Z', order: 0 }],
    payments: [{ id: 'p1', billId: 'b1', amount: 2415, paidOn: '2026-08-14', recordedAt: '2026-08-15T19:30:00Z', type: 'Check', reference: '1042' }],
  },
  { id: 'j881', number: '881', name: 'Dudley Mason', address: '9703 Lenox Hl, San Antonio, TX', gcName: 'RMC- Dudley Mason', total: 1050, bills: [], payments: [] },
]
const properties: OwnerRecordsPropertyRow[] = [
  { key: 'j273', seedJobId: 'j273', owner: 'Khan Umar & Bangash Shazmeena', address: '9703 Lenox Hl, San Antonio, TX', gcName: 'RMC- Dudley Mason', jobs: 2, open: 18635 },
  { key: 'j867', seedJobId: 'j867', owner: 'Terrell Holdings LLC', address: '628 Terrell Rd', gcName: 'RMC- Dudley Mason', jobs: 1, open: 1710 },
]
const seedFor = (jobId: string) => ({ jobId, customerId: 'c1', addressId: 'addr-lenox', gcId: 'gc1' })
const full: OwnerRecordsFile = { request: { on: '2026-10-03', how: 'email', from: 'Umar Khan', link: 'https://drive.example/r' }, contractChecked: { by: 'Malachi', at: '2026-10-04T16:00:00Z' }, acknowledgment: { signedOn: '2026-10-05', link: '' }, offer: null, sent: null }

function mount(over: Partial<Parameters<typeof LienOwnerRecordsModal>[0]> = {}) {
  const onClose = vi.fn()
  renderWithProviders(
    <LienOwnerRecordsModal open properties={properties} seedFor={seedFor} claimsByJob={{ j273: 17585, j881: null }} company="Click Plumbing and Electrical" todayYmd="2026-10-05" authName="Taunya" isLeader={false} onClose={onClose} {...over} />,
  )
  return { onClose }
}
async function pick() {
  fireEvent.click(screen.getByRole('button', { name: /Khan Umar & Bangash Shazmeena/ }))
  await settle()
  await screen.findByTestId('owner-records-total')
}
const step = (key: string) => document.querySelector(`[data-step="${key}"]`) as HTMLElement
const sendButton = () => screen.getByRole('button', { name: 'Record it as sent' }) as HTMLButtonElement

afterEach(() => {
  cleanup()
  io.jobs = []
  io.file = null
  io.available = true
  io.saved = []
  io.printed = []
  io.filed = []
})

describe('LienOwnerRecordsModal', () => {
  it('opens on the owners with a notice, narrows them as you type, and a pick reads that property', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    mount()
    const picker = screen.getByTestId('owner-records-picker')
    expect(within(picker).getAllByRole('button').map((b) => b.querySelector('strong')?.textContent)).toEqual(['Khan Umar & Bangash Shazmeena', 'Terrell Holdings LLC'])
    fireEvent.change(screen.getByLabelText('Find an owner'), { target: { value: 'terrell' } })
    expect(within(picker).getAllByRole('button')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Find an owner'), { target: { value: '' } })
    await pick()
    expect(screen.getByText('Khan Umar & Bangash Shazmeena · 9703 Lenox Hl, San Antonio, TX · GC RMC- Dudley Mason')).toBeTruthy()
  })

  it('the packet shows each bill and each payment with the day it was paid and the time it was recorded', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    mount()
    await pick()
    const packet = screen.getByTestId('owner-records-packet')
    expect(packet.querySelector('[data-packet-job="273"]')?.textContent).toContain('$17,585.00 owed')
    expect(packet.querySelector('[data-packet-job="273"]')?.textContent).toContain('Job total $20,000.00 · paid $2,415.00')
    expect(packet.textContent).toContain('$21,050.00 job total · $2,415.00 paid in 1 payment')
    expect(packet.textContent).toContain('Bill 1 · billed Aug 3, 2026')
    const payment = packet.querySelector('[data-packet-payment]') as HTMLElement
    expect(payment.textContent).toContain('Paid Aug 14, 2026 · recorded Aug 15, 2026, 2:30 PM · Check 1042')
    expect(payment.textContent).toContain('$2,415.00')
    expect(packet.querySelector('[data-packet-job="881"]')?.textContent).toContain('No bill has gone out on this job yet.')
    expect(screen.getByTestId('owner-records-total').textContent).toContain('$18,635.00')
    // What stays out is said on screen.
    expect(packet.textContent).toContain('What the GC paid on other properties')
    expect(packet.textContent).toContain('Check images and bank details')
  })

  it('reads the four checks: the numbers warn about a job with no notice, and nothing can be sent yet', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    mount()
    await pick()
    expect([...document.querySelectorAll('[data-step]')].map((s) => `${s.getAttribute('data-step')}:${s.getAttribute('data-state')}`)).toEqual(['request:todo', 'contract:todo', 'numbers:warn', 'acknowledgment:todo'])
    expect(step('numbers').textContent).toContain('$17,585 matches the notice. $1,050 on job 881 has no notice.')
    expect(step('contract').textContent).toContain('The leader ticks this.')
    expect(sendButton().disabled).toBe(true)
    expect(sendButton().title).toBe('First: their request in writing, the contract check, their signed acknowledgment')
    expect(screen.getByTestId('owner-records-foot').textContent).toBe('Before it can be recorded as sent: their request in writing, the contract check, their signed acknowledgment.')
  })

  it('the office puts the request and the signed acknowledgment on file; the leader ticks the contract; then it can be sent', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    mount({ isLeader: true })
    await pick()
    // 1 · the request
    fireEvent.click(within(step('request')).getByRole('button', { name: 'Put it on file ›' }))
    fireEvent.change(screen.getByLabelText('The day they asked'), { target: { value: '2026-10-03' } })
    fireEvent.change(screen.getByLabelText('Link to their request'), { target: { value: 'https://drive.example/r' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the request' }))
    await waitFor(() => expect(step('request').getAttribute('data-state')).toBe('done'))
    expect(io.saved[0]).toMatchObject({ rowId: null, customerId: 'c1', addressId: 'addr-lenox', gcId: 'gc1', seedJobId: 'j273', jobIds: ['j273', 'j881'], ownerName: 'Khan Umar & Bangash Shazmeena' })
    expect((io.saved[0]!.file as OwnerRecordsFile).request).toEqual({ on: '2026-10-03', how: 'email', from: 'Khan Umar & Bangash Shazmeena', link: 'https://drive.example/r' })
    expect(sendButton().disabled).toBe(true)
    // 2 · the leader's tick
    fireEvent.click(within(step('contract')).getByRole('button', { name: 'I read it. No clause stops this.' }))
    await waitFor(() => expect(step('contract').getAttribute('data-state')).toBe('done'))
    expect((io.saved[1]!.file as OwnerRecordsFile).contractChecked?.by).toBe('Taunya')
    expect(io.saved[1]!.rowId).toBe('row-1')
    expect(sendButton().disabled).toBe(true)
    // 4 · the signed acknowledgment is what unlocks the send
    fireEvent.click(within(step('acknowledgment')).getByRole('button', { name: 'They signed it ›' }))
    fireEvent.click(screen.getByRole('button', { name: 'It is signed' }))
    await waitFor(() => expect(step('acknowledgment').getAttribute('data-state')).toBe('done'))
    expect(sendButton().disabled).toBe(false)
    expect(screen.getByTestId('owner-records-foot').textContent).toBe('All three are on file. The packet can go.')
    fireEvent.change(screen.getByLabelText('How it went to them'), { target: { value: 'mail' } })
    fireEvent.click(sendButton())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Record it as sent' })).toBeNull())
    const sent = (io.saved[3]!.file as OwnerRecordsFile).sent!
    expect(sent).toMatchObject({ by: 'Taunya', how: 'mail', total: 18635, jobIds: ['j273', 'j881'] })
    expect(screen.getByTestId('owner-records-foot').textContent).toMatch(/^Sent Oct \d+, 2026 by Taunya\. Mailed\.$/)
    // The packet as it stood is filed with the send, pointing at the request's row.
    await waitFor(() => expect(io.filed).toHaveLength(1))
    expect(io.filed[0]).toMatchObject({ kind: 'owner_records_packet', how: 'mail', title: 'Records for 9703 Lenox Hl, San Antonio, TX', recipientName: 'Khan Umar & Bangash Shazmeena', jobIds: ['j273', 'j881'], customerId: 'c1', source: { table: 'lien_owner_record_requests', id: 'row-1' } })
    expect(io.filed[0]!.html).toContain('Statement for 9703 Lenox Hl, San Antonio, TX')
  })

  it('a file with everything but the acknowledgment still cannot be sent', async () => {
    io.jobs = jobs
    io.file = { ...full, acknowledgment: null }
    mount()
    await pick()
    expect(sendButton().disabled).toBe(true)
    expect(sendButton().title).toBe('First: their signed acknowledgment')
  })

  it('printing prints the packet or the acknowledgment, and files each as it went', async () => {
    io.jobs = jobs
    io.file = full
    mount()
    await pick()
    fireEvent.click(screen.getByRole('button', { name: 'Print the packet' }))
    await waitFor(() => expect(io.printed).toHaveLength(1))
    // Counsel approved the wording (v2.4627): no ask before a print.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(io.printed[0]).toContain('Statement for 9703 Lenox Hl, San Antonio, TX')
    expect(io.printed[0]).toContain('You asked us in writing on Oct 3, 2026')
    fireEvent.click(screen.getByRole('button', { name: 'Print the acknowledgment' }))
    await waitFor(() => expect(io.printed).toHaveLength(2))
    expect(io.printed[1]).toContain('Acknowledgment of a records request')
    // A print counts as a send: each page is filed as it was printed.
    expect(io.filed.map((f) => [f.kind, f.how, f.title])).toEqual([
      ['owner_records_packet', 'print', 'Records for 9703 Lenox Hl, San Antonio, TX'],
      ['owner_records_acknowledgment', 'print', 'Acknowledgment for 9703 Lenox Hl, San Antonio, TX'],
    ])
  })

  it('Offer it on their portal (v2.4650): a second name, the offer on file, the link on the clipboard; the window then reads the offer and the portal signature', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    io.saved = []
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void written.push(t) }, configurable: true })
    mount()
    await pick()
    fireEvent.click(screen.getByTestId('owner-records-offer'))
    fireEvent.change(screen.getByLabelText('A second name allowed to sign'), { target: { value: 'Bangash Shazmeena' } })
    fireEvent.click(screen.getByRole('button', { name: 'Offer it and copy the link' }))
    await waitFor(() => expect(written).toHaveLength(1))
    expect(written[0]).toContain('/portal?t=tok-owner')
    const saved = io.saved[io.saved.length - 1] as { file: { offer: { by: string; alsoAllowed: string } } }
    expect(saved.file.offer).toMatchObject({ by: 'Taunya', alsoAllowed: 'Bangash Shazmeena' })
    expect(step('request').textContent).toContain('Offered on their portal')
    expect(screen.getByTestId('owner-records-copy-link')).toBeTruthy()
    // The owner signed on the portal: check 4 names them and offers no Change.
    io.file = { ...EMPTY_OWNER_RECORDS, offer: { at: '2026-10-06T15:00:00Z', by: 'Taunya', alsoAllowed: '' }, request: { on: '2026-10-06', how: 'portal', from: 'Umar Khan', link: '' }, acknowledgment: { signedOn: '2026-10-06', link: '', printedName: 'Umar Khan', mode: 'draw' } }
    cleanup()
    mount()
    await pick()
    expect(step('acknowledgment').textContent).toContain('Signed on their portal')
    expect(step('acknowledgment').textContent).toContain('by Umar Khan, drawn')
    expect(within(step('acknowledgment')).queryByRole('button', { name: 'Change' })).toBeNull()
    // Their signing is the request: check 1 offers no Change either (v2.4866).
    expect(step('request').textContent).toContain('Their signing is the request.')
    expect(within(step('request')).queryByRole('button', { name: 'Change' })).toBeNull()
  })

  it('On their portal is a way to send once the records were offered there, and files the packet as a PDF (v2.4651)', async () => {
    io.jobs = jobs
    io.file = { ...full, offer: { at: '2026-10-06T15:00:00Z', by: 'Taunya', alsoAllowed: '' } }
    io.filed = []
    mount()
    await pick()
    const how = screen.getByLabelText('How it went to them') as HTMLSelectElement
    expect([...how.options].map((o) => o.value)).toEqual(['handed', 'email', 'mail', 'portal'])
    fireEvent.change(how, { target: { value: 'portal' } })
    fireEvent.click(sendButton())
    await waitFor(() => expect(io.filed.map((f) => [f.kind, f.how])).toEqual([['owner_records_packet', 'link']]))
    expect(io.filed[0]!.html).toBeUndefined()
    expect(io.filed[0]!.contentType).toBe('application/pdf')
  })

  it('Download the packet saves the PDF and files it as a download (v2.4619)', async () => {
    io.jobs = jobs
    io.file = full
    io.downloaded = []
    io.filed = []
    mount()
    await pick()
    fireEvent.click(screen.getByRole('button', { name: 'Download the packet' }))
    await waitFor(() => expect(io.downloaded).toEqual([{ name: 'Records-9703-Lenox-Hl-San-Antonio-TX-2026-10-05.pdf', type: 'application/pdf' }]))
    await waitFor(() => expect(io.filed.map((f) => [f.kind, f.how])).toEqual([['owner_records_packet', 'download']]))
  })

  it('when saving is not ready the packet still reads and prints, and the window says the checks cannot be filed', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    io.available = false
    mount({ isLeader: true })
    await pick()
    expect(screen.getByTestId('owner-records-unavailable').textContent).toContain('Saving is not ready yet.')
    expect(within(step('request')).queryByRole('button')).toBeNull()
    expect(within(step('contract')).queryByRole('button')).toBeNull()
    expect(sendButton().disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Print the packet' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a click outside closes this window only, and Another owner goes back to the list', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    const behind = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(
      <div onClick={behind}>
        <LienOwnerRecordsModal open properties={properties} seedFor={seedFor} claimsByJob={{}} company="Click" todayYmd="2026-10-05" authName="Taunya" isLeader={false} onClose={onClose} />
      </div>,
    )
    await pick()
    fireEvent.click(screen.getByRole('button', { name: '‹ Another owner' }))
    expect(screen.getByTestId('owner-records-picker')).toBeTruthy()
    fireEvent.click(screen.getByRole('dialog', { name: 'Records for an owner' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(behind).not.toHaveBeenCalled()
  })
})

describe('the Dashboard’s door (punch list #86)', () => {
  const folded: OwnerRecordsPropertyRow[] = [{ ...properties[0]!, jobIds: ['j273', 'j881'] }, properties[1]!]

  it('opens straight on the property holding the job, a job folded into the row included', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    mount({ properties: folded, initialJobId: 'j881' })
    await settle()
    await screen.findByTestId('owner-records-total')
    expect(screen.queryByTestId('owner-records-picker')).toBeNull()
    expect(screen.getByText('Khan Umar & Bangash Shazmeena · 9703 Lenox Hl, San Antonio, TX · GC RMC- Dudley Mason')).toBeTruthy()
  })

  it('lands once: Another owner goes back to the list and stays there', async () => {
    io.jobs = jobs
    io.file = EMPTY_OWNER_RECORDS
    mount({ properties: folded, initialJobId: 'j273' })
    await settle()
    await screen.findByTestId('owner-records-total')
    fireEvent.click(screen.getByRole('button', { name: '‹ Another owner' }))
    await settle()
    expect(screen.getByTestId('owner-records-picker')).toBeTruthy()
  })

  it('a job no row holds leaves the picker, as the desk’s own button opens it', async () => {
    mount({ properties: folded, initialJobId: 'j-elsewhere' })
    await settle()
    expect(screen.getByTestId('owner-records-picker')).toBeTruthy()
  })
})
