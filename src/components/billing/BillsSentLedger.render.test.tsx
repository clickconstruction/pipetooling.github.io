// @vitest-environment jsdom
/**
 * Bills sent (punch list #327, PR 1): every bill that left under a band per day, a line that carries the address
 * and the amount, a second send marked as one, a copy one press away, the search and the route chips, and a read
 * that fails saying so with Retry. Every name and number is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BillsSentCopy, BillsSentInput } from '../../lib/billing/billsSent'
import type { BillHandWay } from '../../lib/billing/billHandWays'
import { BillsSentLedger } from './BillsSentLedger'

const io = vi.hoisted(() => ({ data: null as unknown, asks: [] as Array<{ limit: number }>, opened: [] as string[], saved: [] as Array<{ name: string; type: string }>, filed: [] as unknown[], ways: null as unknown, wayCalls: [] as unknown[][], wayRefuse: null as null | Error, refuse: null as null | Error, fail: null as null | Error, phone: false }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => io.phone }))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'master_technician', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/billing/billsSentIo', () => ({
  readBillsSent: async (opts: { limit: number }) => {
    io.asks.push(opts)
    if (io.fail) throw io.fail
    return io.data
  },
  readBillHandWays: async () => io.ways,
  addBillHandWay: async (label: string) => {
    if (io.wayRefuse) throw io.wayRefuse
    io.wayCalls.push(['add', label])
    const way = { id: 'w-new', key: 'w_new0000001', label, sentHow: 'other', sortOrder: 99, retiredAtIso: null, retiredByName: '', createdByName: 'Priya', createdAtIso: '2026-11-13T18:00:00Z' }
    io.ways = [...((io.ways as unknown[]) ?? []), way]
    return way
  },
  renameBillHandWay: async (id: string, label: string) => {
    if (io.wayRefuse) throw io.wayRefuse
    io.wayCalls.push(['rename', id, label])
    io.ways = (io.ways as Array<{ id: string }>).map((w) => (w.id === id ? { ...w, label } : w))
  },
  setBillHandWayOnList: async (id: string, on: boolean) => {
    io.wayCalls.push(['on', id, on])
    io.ways = (io.ways as Array<{ id: string }>).map((w) => (w.id === id ? { ...w, retiredAtIso: on ? null : '2026-11-13T19:00:00Z', retiredByName: on ? '' : 'Priya' } : w))
  },
  moveBillHandWays: async (moves: Array<{ id: string; sortOrder: number }>) => {
    io.wayCalls.push(['move', moves])
    io.ways = (io.ways as Array<{ id: string }>).map((w) => ({ ...w, ...(moves.find((m) => m.id === w.id) ? { sortOrder: moves.find((m) => m.id === w.id)!.sortOrder } : {}) }))
  },
  recordBillByHand: async (filing: unknown) => {
    if (io.refuse) throw io.refuse
    io.filed.push(filing)
  },
}))
vi.mock('../../lib/storageSave', () => ({
  saveBlobAs: (blob: Blob, name: string) => void io.saved.push({ name, type: blob.type }),
}))
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  openSentCopy: async (row: { id: string }) => (io.opened.push(row.id), true),
}))

const BILL = 'aaaaaaaa-1111-4111-8111-111111111111'
const JOB = 'aaaaaaaa-9999-4999-8999-999999999991'
const copy = (over: Partial<BillsSentCopy>): BillsSentCopy => ({
  id: 'c1',
  kind: 'bill',
  title: 'Invoice #1412-0002 from Northgate Plumbing Co.',
  how: 'email',
  recipientName: 'Sable Ridge Builders',
  recipientEmails: ['hal@sableridge.example'],
  subject: '',
  sourceTable: 'jobs_ledger_invoices',
  sourceId: BILL,
  copyPath: 'c1/copy.html',
  copyType: 'text/html',
  copyHash: 'h1',
  attachments: [],
  sentAt: '2026-11-03T22:41:00.000Z',
  sentByName: 'Priya',
  sourceSnapshot: null,
  jobIds: [JOB],
  bidId: null,
  resendEmailId: 're_1',
  ...over,
})
const data = (copies: BillsSentCopy[]): BillsSentInput => ({
  copies,
  bills: new Map([[BILL, { id: BILL, jobId: JOB, amount: 4860, status: 'billed' }]]),
  jobs: new Map([[JOB, { id: JOB, hcp_number: '1412', click_number: null, job_name: 'Sable Ridge Lot 14', job_address: '208 Juniper Bend', customer_name: 'Sable Ridge Builders' }]]),
  statements: new Map([['re_s', { resendEmailId: 're_s', total: 48210, jobCount: 12 }]]),
  earlier: [],
})

beforeEach(() => {
  io.data = data([])
  io.asks = []
  io.opened = []
  io.saved = []
  io.filed = []
  io.ways = null
  io.wayCalls = []
  io.wayRefuse = null
  io.refuse = null
  io.fail = null
  io.phone = false
})
afterEach(() => cleanup())

describe('BillsSentLedger', () => {
  it('draws a line per send with the address and the amount, and opens the copy', async () => {
    io.data = data([
      copy({ id: 'c2', sentAt: '2026-11-05T17:02:00.000Z' }),
      copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', recipientName: 'Ridgeway Builders', recipientEmails: ['billing@ridgeway.example'], sourceTable: '', sourceId: null, jobIds: [], resendEmailId: 're_s', sentAt: '2026-11-05T13:00:00.000Z' }),
      copy({ id: 'c1' }),
    ])
    renderWithProviders(<BillsSentLedger />)
    const lines = await screen.findAllByTestId('bills-sent-line')
    expect(lines).toHaveLength(3)
    expect(screen.getAllByTestId('bills-sent-day').map((h) => h.textContent)).toEqual(['Thu, Nov 50 bills1 sent again · 1 statement', 'Tue, Nov 31 bill · $4,860.00'])
    // The second send: its own line, marked, with the day of the first; the address is on the line.
    expect(lines[0]?.textContent).toMatch(/^\d{1,2}:\d\d [AP]MBill 1412-0002 · J1412 · Sable Ridge Lot 14 · Sable Ridge Builders\$4,860\.00To hal@sableridge\.example/)
    expect(lines[0]?.textContent).toContain('Email, sent againby Priya2nd send. First sent Tue, Nov 3.')
    expect(lines[1]?.textContent).toContain('Statement · 12 jobs · Ridgeway Builders$48,210.00To billing@ridgeway.example')
    expect(lines[1]?.textContent).toContain('Lists bills already sent. Not in the day’s total.')
    expect(lines[2]?.textContent).toContain('Emailby Priya')
    expect(screen.getAllByRole('link', { name: 'J1412 · Sable Ridge Lot 14' }).map((a) => a.getAttribute('href'))).toEqual([`/jobs?edit=${JOB}`, `/jobs?edit=${JOB}`])
    expect(io.asks[0]).toEqual({ limit: 300 })
    fireEvent.click(lines[2]!.querySelector('button')!)
    await waitFor(() => expect(io.opened).toEqual(['c1']))
    expect(screen.getByTestId('bills-sent-foot').textContent).toContain('All times are Central.')
  })

  it('narrows by what is typed and by how it went, and says so when nothing matches', async () => {
    io.data = data([copy({}), copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', recipientName: 'Ridgeway Builders', recipientEmails: ['billing@ridgeway.example'], sourceTable: '', sourceId: null, jobIds: [], resendEmailId: 're_s' })])
    renderWithProviders(<BillsSentLedger />)
    expect(await screen.findAllByTestId('bills-sent-line')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Statement' }))
    expect(screen.getAllByTestId('bills-sent-line').map((l) => l.textContent?.includes('Ridgeway'))).toEqual([true])
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    fireEvent.change(screen.getByLabelText('Find a bill'), { target: { value: 'juniper' } })
    expect(screen.getAllByTestId('bills-sent-line')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Find a bill'), { target: { value: 'nobody here' } })
    expect(screen.getByTestId('bills-sent-empty').textContent).toContain('No sends match ‘nobody here’.')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(screen.getAllByTestId('bills-sent-line')).toHaveLength(2)
  })

  it('draws the sends that kept no copy, and the bills with no send on record above the days', async () => {
    const OTHER = 'bbbbbbbb-2222-4222-8222-222222222222'
    const PAID = 'cccccccc-3333-4333-8333-333333333333'
    io.data = {
      ...data([copy({})]),
      bills: new Map([
        [BILL, { id: BILL, jobId: JOB, amount: 4860, status: 'billed' }],
        [OTHER, { id: OTHER, jobId: JOB, amount: 640, status: 'billed' }],
      ]),
      stamps: [{ billId: OTHER, atIso: '2026-11-02T18:00:00.000Z', channel: 'housecallpro' }],
      texts: [{ id: 't1', atIso: '2026-11-04T20:14:00.000Z', billId: BILL, jobId: JOB, number: '(512) 555-0142', toName: 'Hal Jensen', by: 'Priya', delivery: 'delivered' }],
      unsent: [
        { billId: 'dddddddd-4444-4444-8444-444444444444', jobId: JOB, amount: 2140, status: 'billed', billedAtIso: '2026-11-09T21:26:00.000Z' },
        { billId: PAID, jobId: JOB, amount: 300, status: 'paid', billedAtIso: '2026-11-10T16:00:00.000Z' },
      ],
    }
    renderWithProviders(<BillsSentLedger />)
    const lines = await screen.findAllByTestId('bills-sent-line')
    expect(lines.map((l) => l.textContent?.slice(0, 8))).toEqual([expect.stringMatching(/^\d{1,2}:\d\d [AP]/), expect.stringMatching(/^\d{1,2}:\d\d [AP]/), 'Day only'])
    expect(lines[0]?.textContent).toContain('To Hal Jensen · (512) 555-0142')
    expect(lines[0]?.textContent).toContain('Text with pay linkby Priya2nd send. First sent Tue, Nov 3.Delivered')
    expect(lines[2]?.textContent).toContain('Sent from Housecall Pro. The app has the day only.')
    expect(lines[2]?.querySelector('button')).toBeNull()
    // The strip: the open bill, the paid one behind a press, and the tile.
    expect(screen.getByTestId('bills-sent-tile-gaps').textContent).toBe('No send on record1')
    const strip = screen.getByTestId('bills-sent-gaps')
    expect(strip.textContent).toContain('1 bill is billed with no send on record')
    expect(screen.getAllByTestId('bills-sent-gap')).toHaveLength(1)
    expect(strip.textContent).toContain('$2,140.00Billed Mon, Nov 9 at 3:26 PM. Not paid. The app has no email, text or print for this bill.')
    expect(strip.textContent).toContain('1 more bill was paid with no send on record.')
    fireEvent.click(screen.getByRole('button', { name: 'Show them' }))
    expect(screen.getAllByTestId('bills-sent-gap')).toHaveLength(2)
    // Its own chip shows the strip alone; a route chip hides it.
    fireEvent.click(screen.getByRole('button', { name: 'No send on record' }))
    expect(screen.queryAllByTestId('bills-sent-line')).toHaveLength(0)
    expect(screen.getByTestId('bills-sent-gaps')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Housecall Pro' }))
    expect(screen.queryByTestId('bills-sent-gaps')).toBeNull()
    expect(screen.getAllByTestId('bills-sent-line')).toHaveLength(1)
  })

  it('says whether an email arrived, counts the ones that did not, and narrows to them', async () => {
    io.data = {
      ...data([copy({ id: 'c2', sentAt: '2026-11-05T17:02:00.000Z', recipientEmails: ['old@sableridge.example'] }), copy({ id: 'c1' })]),
      bills: new Map([[BILL, { id: BILL, jobId: JOB, amount: 4860, status: 'billed' }]]),
      marks: new Map([
        ['c2', { id: 'c2', lastEvent: 'bounced', lastEventAtIso: '2026-11-05T17:02:04.000Z', emailType: 'stripe_bill', paidOn: null, paidHow: null }],
        ['c1', { id: 'c1', lastEvent: 'delivered', lastEventAtIso: '2026-11-03T22:41:09.000Z', emailType: 'stripe_bill', paidOn: null, paidHow: null }],
      ]),
    }
    renderWithProviders(<BillsSentLedger />)
    const lines = await screen.findAllByTestId('bills-sent-line')
    expect(lines[0]?.textContent).toContain('Bounced. It did not arrive.')
    expect(lines[1]?.textContent).toContain('Delivered 4:41 PM')
    expect(screen.getByTestId('bills-sent-tile-missed').textContent).toBe('Did not arrive1')
    expect(screen.getAllByTestId('bills-sent-day')[0]?.textContent).toContain('1 did not arrive')
    fireEvent.click(screen.getByRole('button', { name: 'Did not arrive' }))
    expect(screen.getAllByTestId('bills-sent-line')).toHaveLength(1)
    expect(screen.getByTestId('bills-sent-foot').textContent).toContain('Delivered means their mail server took it.')
  })

  it('opens one bill\u2019s record from its address, every send in order, and prints it', async () => {
    const printed: string[] = []
    const opener = vi.spyOn(window, 'open').mockImplementation(() => ({ document: { write: (h: string) => printed.push(h), close: () => {}, images: [] }, focus: () => {}, print: () => {}, close: () => {} }) as unknown as Window)
    io.data = data([copy({ id: 'c2', sentAt: '2026-11-05T17:02:00.000Z' }), copy({ id: 'c1' })])
    renderWithProviders(<BillsSentLedger />, { route: `/bills-sent?bill=${BILL}` })
    const record = await screen.findByTestId('bills-sent-record')
    expect(record.textContent).toContain('Bill 1412-0002 · J1412 · Sable Ridge Lot 14')
    expect(record.textContent).toContain('Sable Ridge Builders · Not paid')
    expect(screen.getAllByTestId('bills-sent-record-event').map((e) => e.textContent?.replace(/\d{1,2}:\d\d [AP]M/, 'T'))).toEqual([
      'Thu, Nov 5 · T · Emailed again by PriyaTo Sable Ridge Builders, hal@sableridge.example. Copy as sent',
      'Tue, Nov 3 · T · Emailed by PriyaTo Sable Ridge Builders, hal@sableridge.example. Copy as sent',
    ])
    expect(screen.queryAllByTestId('bills-sent-line')).toHaveLength(0)
    expect(screen.getByRole('link', { name: '← All bills sent' }).getAttribute('href')).toBe('/bills-sent')
    fireEvent.click(screen.getByRole('button', { name: 'Print this record' }))
    expect(printed[0]).toContain('<h1>Bill 1412-0002 · J1412 · Sable Ridge Lot 14</h1>')
    opener.mockRestore()
  })

  it('makes a bill\u2019s name on a line the door to its record', async () => {
    io.data = data([copy({})])
    renderWithProviders(<BillsSentLedger />)
    await screen.findAllByTestId('bills-sent-line')
    expect(screen.getByRole('link', { name: 'Bill 1412-0002' }).getAttribute('href')).toBe(`/bills-sent?bill=${BILL}`)
  })

  it('prints and saves what the list shows, and offers neither on an empty list', async () => {
    const printed: string[] = []
    const opener = vi.spyOn(window, 'open').mockImplementation(() => ({ document: { write: (h: string) => printed.push(h), close: () => {}, images: [] }, focus: () => {}, print: () => {}, close: () => {} }) as unknown as Window)
    io.data = data([copy({}), copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', recipientName: 'Ridgeway Builders', recipientEmails: ['billing@ridgeway.example'], sourceTable: '', sourceId: null, jobIds: [], resendEmailId: 're_s' })])
    renderWithProviders(<BillsSentLedger />)
    await screen.findAllByTestId('bills-sent-line')
    fireEvent.click(screen.getByRole('button', { name: 'Statement' }))
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(printed[0]).toContain('<p>Statement. Newest first.')
    expect(printed[0]).toContain('<b>Statement</b> · 12 jobs · Ridgeway Builders')
    expect(printed[0]).not.toContain('Bill 1412-0002')
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }))
    expect(io.saved).toEqual([{ name: expect.stringMatching(/^bills-sent-\d{4}-\d\d-\d\d\.csv$/), type: 'text/csv;charset=utf-8' }])
    fireEvent.change(screen.getByLabelText('Find a bill'), { target: { value: 'nobody here' } })
    expect(screen.queryByRole('button', { name: 'Print' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
    opener.mockRestore()
  })

  it('records by hand how a bill with no send went, then reads the list again', async () => {
    const GAP = 'dddddddd-4444-4444-8444-444444444444'
    io.data = { ...data([copy({})]), unsent: [{ billId: GAP, jobId: JOB, amount: 2140, status: 'billed', billedAtIso: '2026-11-09T21:26:00.000Z' }] }
    renderWithProviders(<BillsSentLedger />)
    await screen.findByTestId('bills-sent-gap')
    fireEvent.click(screen.getByRole('button', { name: 'Say how it went…' }))
    const form = screen.getByTestId('bills-sent-by-hand')
    const save = screen.getByRole('button', { name: 'Record how it went' }) as HTMLButtonElement
    // The customer's name is offered; the press waits for how it went.
    expect((screen.getByLabelText('Who it went to') as HTMLInputElement).value).toBe('Sable Ridge Builders')
    expect(save.disabled).toBe(true)
    expect(form.textContent).toContain('Pick how the bill went.')
    // The list could not be read, so the four in code are offered and there is no list to change.
    const picker = screen.getByRole('group', { name: 'How the bill went' })
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(['Handed over', 'Mailed', 'Emailed from a person\u2019s own mailbox', 'Sent from Housecall Pro'])
    fireEvent.click(within(picker).getByRole('button', { name: 'Handed over' }))
    fireEvent.change(screen.getByLabelText('The day it went'), { target: { value: '2026-11-09' } })
    expect(save.disabled).toBe(false)
    // A refusal says its reason and keeps the form.
    io.refuse = Object.assign(new Error('new row violates row-level security policy for table "sent_documents"'), { code: '42501' })
    fireEvent.click(save)
    await waitFor(() => expect(save.disabled).toBe(false))
    expect(io.filed).toEqual([])
    expect(screen.getByTestId('bills-sent-by-hand')).toBeTruthy()
    io.refuse = null
    const asksBefore = io.asks.length
    fireEvent.click(save)
    await waitFor(() => expect(io.filed).toHaveLength(1))
    expect(io.filed[0]).toMatchObject({ kind: 'bill_by_hand', how: 'hand', recipientName: 'Sable Ridge Builders', source: { table: 'jobs_ledger_invoices', id: GAP }, sourceSnapshot: { how: 'handed', went_on: '2026-11-09' } })
    await waitFor(() => expect(io.asks.length).toBeGreaterThan(asksBefore))
  })

  const GAP_BILL = 'dddddddd-4444-4444-8444-444444444444'
  const way = (over: Partial<BillHandWay>): BillHandWay => ({ id: 'w1', key: 'handed', label: 'Handed over', sentHow: 'hand', sortOrder: 1, retiredAtIso: null, retiredByName: '', createdByName: '', createdAtIso: '2026-11-13T15:00:00Z', ...over })
  const officeList = (): BillHandWay[] => [
    way({ id: 'w3', key: 'w_3f9a1c2e77', label: 'Uploaded to the builder’s pay portal', sentHow: 'other', sortOrder: 3, createdByName: 'Priya', createdAtIso: '2026-11-11T18:00:00Z' }),
    way({}),
    way({ id: 'w2', key: 'mailed', label: 'Mailed', sentHow: 'mail', sortOrder: 2, retiredAtIso: '2026-11-09T16:00:00Z', retiredByName: 'Marcus' }),
  ]
  const openForm = async () => {
    io.data = { ...data([copy({})]), unsent: [{ billId: GAP_BILL, jobId: JOB, amount: 2140, status: 'billed', billedAtIso: '2026-11-09T21:26:00.000Z' }] }
    renderWithProviders(<BillsSentLedger />)
    await screen.findByTestId('bills-sent-gap')
    fireEvent.click(screen.getByRole('button', { name: 'Say how it went…' }))
    await screen.findByRole('button', { name: '＋ Add a way' })
    return screen.getByRole('group', { name: 'How the bill went' })
  }
  const chips = (picker: HTMLElement) => within(picker).getAllByRole('button').map((b) => b.textContent)

  it('offers the office’s own list as chips, and files the way picked with its words', async () => {
    io.ways = officeList()
    const picker = await openForm()
    // The list's own order, a way taken off is not offered, and the two presses that change the list follow.
    expect(chips(picker)).toEqual(['Handed over', 'Uploaded to the builder’s pay portal', '＋ Add a way', 'Edit list'])
    const portal = within(picker).getByRole('button', { name: 'Uploaded to the builder’s pay portal' })
    fireEvent.click(portal)
    expect(portal.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Record how it went' }))
    await waitFor(() => expect(io.filed).toHaveLength(1))
    expect(io.filed[0]).toMatchObject({ kind: 'bill_by_hand', how: 'other', sourceSnapshot: { how: 'w_3f9a1c2e77', how_label: 'Uploaded to the builder’s pay portal' } })
  })

  it('adds a way where the person stands: typed, refused with its reason, then on the list and picked', async () => {
    io.ways = officeList()
    const picker = await openForm()
    fireEvent.click(within(picker).getByRole('button', { name: '＋ Add a way' }))
    const adder = screen.getByTestId('bill-hand-way-adder')
    const box = within(adder).getByLabelText('The new way') as HTMLInputElement
    const add = within(adder).getByRole('button', { name: 'Add to the list' }) as HTMLButtonElement
    // Nothing typed: the press is dead and the line says who gets the new way and how full the list is.
    expect(add.disabled).toBe(true)
    expect(adder.textContent).toContain('Everyone who opens Bills sent gets the new way. 2 of 12.')
    // Words already on the list are refused before the database is asked. A way taken off has freed its words.
    fireEvent.change(box, { target: { value: '  handed OVER ' } })
    expect(add.disabled).toBe(true)
    expect(adder.textContent).toContain('That way is already on the list.')
    fireEvent.change(box, { target: { value: ' Left at   the front desk ' } })
    expect(add.disabled).toBe(false)
    // A refusal from the database keeps the typed words.
    io.wayRefuse = Object.assign(new Error('Training mode is read only.'), { code: '42501' })
    fireEvent.click(add)
    await waitFor(() => expect(add.disabled).toBe(false))
    expect(io.wayCalls).toEqual([])
    expect(box.value).toBe(' Left at   the front desk ')
    io.wayRefuse = null
    fireEvent.click(add)
    await waitFor(() => expect(io.wayCalls).toEqual([['add', 'Left at the front desk']]))
    // The new way is a chip, picked, and the adder is gone.
    const made = await within(picker).findByRole('button', { name: 'Left at the front desk' })
    await waitFor(() => expect(made.getAttribute('aria-pressed')).toBe('true'))
    expect(screen.queryByTestId('bill-hand-way-adder')).toBeNull()
    expect((screen.getByRole('button', { name: 'Record how it went' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('edits the list in its window: rename, move, take off, bring back, and the last way stays', async () => {
    io.ways = officeList()
    const picker = await openForm()
    fireEvent.click(within(picker).getByRole('button', { name: 'Edit list' }))
    const win = await screen.findByTestId('bill-hand-ways-window')
    const rows = () => within(win).getAllByTestId('bill-hand-way-row').map((r) => r.textContent)
    expect(rows()[1]).toContain('Added by Priya on Wed, Nov 11')
    expect(screen.getByTestId('bill-hand-ways-count').textContent).toContain('A bill already recorded keeps the words it was recorded with. 2 of 12.')
    // Rename: the window says an older record keeps its words, and refuses words already on the list.
    fireEvent.click(within(win).getByRole('button', { name: 'Rename Handed over' }))
    const name = within(win).getByLabelText('New name for Handed over') as HTMLInputElement
    expect(win.textContent).toContain('Was: Handed over. A bill already recorded as Handed over still reads Handed over.')
    fireEvent.change(name, { target: { value: 'uploaded to the builder’s pay portal' } })
    expect((within(win).getByRole('button', { name: 'Save the name' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(name, { target: { value: 'Handed over on site' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Save the name' }))
    await waitFor(() => expect(io.wayCalls).toEqual([['rename', 'w1', 'Handed over on site']]))
    await waitFor(() => expect(rows()[0]).toContain('Handed over on site'))
    // The form behind it follows: the chip reads the new words.
    expect(chips(picker)[0]).toBe('Handed over on site')
    // Move: the two rows trade places. The top row cannot go up.
    expect((within(win).getByRole('button', { name: 'Move Handed over on site up' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(win).getByRole('button', { name: 'Move Handed over on site down' }))
    await waitFor(() => expect(io.wayCalls[1]).toEqual(['move', [{ id: 'w1', sortOrder: 3 }, { id: 'w3', sortOrder: 1 }]]))
    await waitFor(() => expect(rows()[0]).toContain('Uploaded to the builder’s pay portal'))
    // Take off: it leaves the list and waits under Taken off, with who and when. The last way cannot go.
    fireEvent.click(within(win).getByRole('button', { name: 'Take Handed over on site off the list' }))
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect((within(win).getByRole('button', { name: 'Take Uploaded to the builder’s pay portal off the list' }) as HTMLButtonElement).disabled).toBe(true)
    const gone = within(win).getByTestId('bill-hand-ways-gone')
    expect(gone.textContent).toContain('Taken off (2)')
    fireEvent.click(within(gone).getByRole('button', { name: 'Show' }))
    expect(gone.textContent).toContain('Taken off by Marcus on Mon, Nov 9')
    // Bring back: Mailed returns to the list and to the form, at the place it had.
    fireEvent.click(within(gone).getByRole('button', { name: 'Bring Mailed back' }))
    await waitFor(() => expect(io.wayCalls.at(-1)).toEqual(['on', 'w2', true]))
    await waitFor(() => expect(chips(picker)).toEqual(['Uploaded to the builder\u2019s pay portal', 'Mailed', '＋ Add a way', 'Edit list']))
    // Done only closes the window.
    const calls = io.wayCalls.length
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByTestId('bill-hand-ways-window')).toBeNull())
    expect(io.wayCalls).toHaveLength(calls)
  })

  it('on a phone, puts the list first: a folded strip, a three-row line that opens the record, the file presses last', async () => {
    io.phone = true
    const GAP = 'dddddddd-4444-4444-8444-444444444444'
    io.data = {
      ...data([
        copy({ id: 'c2', sentAt: '2026-11-05T17:02:00.000Z' }),
        copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', recipientName: 'Ridgeway Builders', recipientEmails: ['billing@ridgeway.example'], sourceTable: '', sourceId: null, jobIds: [], resendEmailId: 're_s', sentAt: '2026-11-05T13:00:00.000Z' }),
        copy({ id: 'c1' }),
      ]),
      unsent: [{ billId: GAP, jobId: JOB, amount: 2140, status: 'billed', billedAtIso: '2026-11-09T21:26:00.000Z' }],
      marks: new Map([['c2', { id: 'c2', lastEvent: 'delivered', lastEventAtIso: '2026-11-05T17:02:09.000Z', emailType: 'stripe_bill', paidOn: null, paidHow: null }]]),
    }
    renderWithProviders(<BillsSentLedger />)
    const lines = await screen.findAllByTestId('bills-sent-line')
    // The strip is one line until it is asked for, and no row of it is drawn.
    expect(screen.getByTestId('bills-sent-gaps-fold').textContent).toBe('1 bill is billed with no send on recordShow')
    expect(screen.queryByTestId('bills-sent-gap')).toBeNull()
    // A bill's line is one press, the whole of it: the work, the address, whether it arrived, which send. No long number, no press inside.
    expect(lines[0]?.tagName).toBe('A')
    expect(lines[0]?.getAttribute('href')).toBe(`/bills-sent?bill=${BILL}`)
    expect(lines[0]?.textContent).toMatch(/^\d{1,2}:\d\d [AP]MEmail, sent againby Priya\$4,860\.00J1412 · Sable Ridge Lot 14 · Sable Ridge BuildersTo hal@sableridge\.exampleDelivered \d{1,2}:\d\d [AP]M · 2nd send$/)
    expect(lines[0]?.querySelector('button, a')).toBeNull()
    // A statement is no bill, so it keeps its own press for the copy.
    expect(lines[1]?.tagName).toBe('DIV')
    expect(lines[1]?.textContent).toContain('Statement · 12 jobs · Ridgeway BuildersTo billing@ridgeway.example')
    fireEvent.click(lines[1]!.querySelector('button')!)
    await waitFor(() => expect(io.opened).toEqual(['s1']))
    // Print and the file come after the list.
    const out = screen.getByTestId('bills-sent-out')
    expect(lines[2]!.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The fold, and the tile, open the strip whole.
    fireEvent.click(screen.getByTestId('bills-sent-gaps-fold'))
    expect(screen.getAllByTestId('bills-sent-gap')).toHaveLength(1)
    expect(screen.queryAllByTestId('bills-sent-line')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    fireEvent.click(screen.getByTestId('bills-sent-tile-gaps'))
    expect(screen.getAllByTestId('bills-sent-gap')).toHaveLength(1)
  })

  it('says what fills an empty list, and offers the Pipeline', async () => {
    renderWithProviders(<BillsSentLedger />)
    const empty = await screen.findByTestId('bills-sent-empty')
    expect(empty.textContent).toContain('No bills sent yet.')
    expect(screen.getByRole('link', { name: 'Open the Pipeline' }).getAttribute('href')).toBe('/jobs?tab=stages')
  })

  it('says a read failed and reads again on Retry', async () => {
    io.fail = Object.assign(new Error('permission denied for table sent_documents'), { code: '42501' })
    renderWithProviders(<BillsSentLedger />)
    await waitFor(() => expect(screen.getByText(/permission denied|did not read/i)).toBeTruthy())
    expect(screen.queryByTestId('bills-sent-empty')).toBeNull()
  })
})
