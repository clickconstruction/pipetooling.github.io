// @vitest-environment jsdom
/**
 * Bills sent (punch list #327, PR 1): every bill that left under a band per day, a line that carries the address
 * and the amount, a second send marked as one, a copy one press away, the search and the route chips, and a read
 * that fails saying so with Retry. Every name and number is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BillsSentCopy, BillsSentInput } from '../../lib/billing/billsSent'
import { BillsSentLedger } from './BillsSentLedger'

const io = vi.hoisted(() => ({ data: null as unknown, asks: [] as Array<{ limit: number }>, opened: [] as string[], fail: null as null | Error }))
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
  io.fail = null
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
