// @vitest-environment jsdom
/**
 * Documents → Sent (v2.4573): everything sent, newest first, with a kind to pick and a box to
 * type in; a line opens its copy; the list says so when nothing matches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { SentCopy } from '../../lib/sent/sentCopies'
import { DocumentsSentLedger } from './DocumentsSentLedger'

const io = vi.hoisted(() => ({ rows: [] as unknown[], asks: [] as Array<{ group: string; typed: string; limit: number }>, opened: [] as string[] }))
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  loadSentCopies: async (opts: { group: string; typed: string; limit: number }) => {
    io.asks.push(opts)
    return io.rows
  },
  openSentCopy: async (row: { id: string }) => (io.opened.push(row.id), true),
  openSentFile: async () => true,
}))

const lastAsk = () => io.asks[io.asks.length - 1]
const row = (over: Partial<SentCopy>): SentCopy => ({ id: 's1', kind: 'gc_statement', title: 'Statement for RMC', how: 'email', recipientName: 'RMC- Dudley Mason', recipientEmails: ['ap@rmc.example'], subject: 'Statement', sourceTable: '', sourceId: null, copyPath: 's1/copy.html', copyType: 'text/html', copyHash: 'h1', attachments: [], sentAt: '2026-10-05T20:30:00Z', sentByName: 'Dana', sourceSnapshot: null, ...over })

beforeEach(() => {
  io.rows = []
  io.asks = []
  io.opened = []
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DocumentsSentLedger', () => {
  it('lists what was sent, newest first, and a line opens its copy', async () => {
    io.rows = [row({}), row({ id: 's2', kind: 'rfq', title: 'Price request · Ferguson', recipientName: 'Ferguson', sentAt: '2026-10-06T15:00:00Z', copyHash: 'h2', copyPath: 's2/copy.html' })]
    renderWithProviders(<DocumentsSentLedger />)
    const rows = await screen.findAllByTestId('documents-sent-row')
    expect(rows.map((r) => r.textContent?.slice(0, 24))).toEqual(['Price request · Ferguson', 'Statement for RMCEmailed'])
    expect(io.asks[0]).toEqual({ group: 'all', typed: '', limit: 100 })
    fireEvent.click(screen.getByRole('button', { name: 'Statement for RMC' }))
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
    expect((await screen.findByTestId('documents-sent-empty')).textContent).toBe('No copy matches. Try another kind or fewer words.')
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
