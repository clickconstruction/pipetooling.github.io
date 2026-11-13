// @vitest-environment jsdom
/**
 * Documents → Sent copies (v2.4573): everything sent, newest first under a heading per day, with a kind to pick and a
 * box to type in; a line opens its copy; the list says so when nothing matches; a read that fails says so with Retry
 * (the Documents spike of 2026-11-01).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { SentCopy } from '../../lib/sent/sentCopies'
import { DocumentsSentLedger } from './DocumentsSentLedger'

const io = vi.hoisted(() => ({ rows: [] as unknown[], asks: [] as Array<{ group: string; typed: string; limit: number }>, opened: [] as string[], fail: null as null | Error }))
// The retry panel reads the signed-in role for its error door; the tab itself asks nothing of auth.
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'assistant', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  readSentCopies: async (opts: { group: string; typed: string; limit: number }) => {
    io.asks.push(opts)
    if (io.fail) throw io.fail
    return io.rows
  },
  openSentCopy: async (row: { id: string }) => (io.opened.push(row.id), true),
  openSentFile: async () => true,
  loadSentCopyAbout: async () => ({
    jobs: new Map([['11111111-2222-4333-8444-555555555555', { id: '11111111-2222-4333-8444-555555555555', hcp_number: '1076', click_number: null, job_name: 'Sneegas Post Test' }]]),
    bids: new Map(),
  }),
}))

const lastAsk = () => io.asks[io.asks.length - 1]
const row = (over: Partial<SentCopy>): SentCopy => ({ id: 's1', kind: 'gc_statement', title: 'Statement for RLC', how: 'email', recipientName: 'RLC- Dunmere Mallin', recipientEmails: ['ap@rlc.example'], subject: 'Statement', sourceTable: '', sourceId: null, copyPath: 's1/copy.html', copyType: 'text/html', copyHash: 'h1', attachments: [], sentAt: '2026-10-05T20:30:00Z', sentByName: 'Dana', sourceSnapshot: null, ...over })

beforeEach(() => {
  io.rows = []
  io.asks = []
  io.opened = []
  io.fail = null
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DocumentsSentLedger', () => {
  it('lists what was sent, newest first, and a line opens its copy', async () => {
    io.rows = [row({ jobIds: ['11111111-2222-4333-8444-555555555555'], subject: 'Statement for RLC through October' }), row({ id: 's2', kind: 'rfq', title: 'Price request · Ferguson', subject: '', recipientName: 'Ferguson', sentAt: '2026-10-06T15:00:00Z', copyHash: 'h2', copyPath: 's2/copy.html' })]
    renderWithProviders(<DocumentsSentLedger />)
    const rows = await screen.findAllByTestId('documents-sent-row')
    expect(rows.map((r) => r.querySelector('button')?.textContent)).toEqual(['Price request · Ferguson', 'Statement for RLC'])
    // One heading per day, the day alone when it is not today or yesterday; the row's grey words carry the time alone.
    expect(screen.getAllByTestId('documents-sent-day').map((h) => h.textContent)).toEqual(['Tue, Oct 61 copy', 'Mon, Oct 51 copy'])
    expect(rows[1]?.textContent).toMatch(/Emailed \d{1,2}:\d\d [AP]M · to RLC- Dunmere Mallin · by Dana/)
    expect(rows[1]?.textContent).not.toContain('2026')
    // The kind of paper before the title, the job it is for as a link, and the subject when it says more than the title.
    expect(rows[1]?.textContent?.startsWith('GC statementStatement for RLC')).toBe(true)
    await waitFor(() => expect(screen.getByRole('link', { name: 'J1076 · Sneegas Post Test' }).getAttribute('href')).toBe('/jobs?edit=11111111-2222-4333-8444-555555555555'))
    expect(rows[1]?.textContent).toContain('“Statement for RLC through October”')
    expect(rows[0]?.querySelector('[data-testid="documents-sent-row-about"]')).toBeNull()
    expect(io.asks[0]).toEqual({ group: 'all', typed: '', limit: 100 })
    fireEvent.click(screen.getByRole('button', { name: 'Statement for RLC' }))
    await waitFor(() => expect(io.opened).toEqual(['s1']))
  })

  it('asks again for a kind at once, and for typed words once the typing rests', async () => {
    renderWithProviders(<DocumentsSentLedger />)
    await screen.findByTestId('documents-sent-empty')
    fireEvent.click(screen.getByRole('button', { name: 'Bills' }))
    await waitFor(() => expect(lastAsk()).toEqual({ group: 'bills', typed: '', limit: 100 }))
    expect(screen.getByRole('button', { name: 'Bills' }).getAttribute('aria-pressed')).toBe('true')

    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Find a copy'), { target: { value: 'Lenox' } })
    const before = io.asks.length
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(io.asks.length).toBe(before)
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    vi.useRealTimers()
    await waitFor(() => expect(lastAsk()).toEqual({ group: 'bills', typed: 'Lenox', limit: 100 }))
    expect((await screen.findByTestId('documents-sent-empty')).textContent).toBe('No copies match ‘Lenox’. Clear the search')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    await waitFor(() => expect(lastAsk()).toEqual({ group: 'all', typed: '', limit: 100 }))
  })

  it('says the read failed with its reason and reads again on Retry, never as an empty ledger', async () => {
    io.fail = new TypeError('Failed to fetch')
    renderWithProviders(<DocumentsSentLedger />)
    // A lost signal draws the retry panel (role alert, with Retry), never the empty ledger's words.
    await screen.findByRole('alert')
    expect(screen.queryByTestId('documents-sent-empty')).toBeNull()
    io.fail = null
    io.rows = [row({})]
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await screen.findAllByTestId('documents-sent-row')
  })

  it('says a copy is kept on every send when nothing is on file, and offers more when a step is full', async () => {
    const first = renderWithProviders(<DocumentsSentLedger />)
    expect((await screen.findByTestId('documents-sent-empty')).textContent).toBe('No copy is on file yet. A copy is kept each time something is printed or sent to someone.')
    first.unmount()
    io.rows = Array.from({ length: 100 }, (_, i) => row({ id: `s${i}`, copyHash: `h${i}`, copyPath: `s${i}/copy.html`, title: `Paper ${i}` }))
    renderWithProviders(<DocumentsSentLedger />)
    await screen.findAllByTestId('documents-sent-row')
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(lastAsk()?.limit).toBe(200))
  })
})
