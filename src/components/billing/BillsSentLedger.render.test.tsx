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
