// @vitest-environment jsdom
/**
 * A tied mail in the History (v2.7479): the line draws the way it went, the piece, the subject, the words, who
 * it was from and to, its time and the door to its thread in Messages; a long mail folds behind *more ›* and its
 * window shows the subject, every word and the same door; a reader with no Messages gets the words and no door.
 * Made-up rows.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { mailLines, type TiedMailRow } from '../../lib/developments/history'
import { buildWhatChanged, type ChangeAbout } from '../../lib/developments/whatChanged'
import { threadHrefByKind } from '../../lib/messages/customerThread'
import { DevelopmentFeed } from './DevelopmentFeed'
import { DevelopmentLineWindow } from './DevelopmentLineWindow'

// The bid's press reads the mail's files itself (its own render test); here it stands in as what it was handed.
vi.mock('../bids/BidMailSetDoor', () => ({
  BidMailSetDoor: (p: { bidId: string; bidLabel: string; messageId: string }) => <span data-bid-door>{`${p.bidLabel}|${p.bidId}|${p.messageId}`}</span>,
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const onBid: ChangeAbout = { kind: 'bid', id: 'b401', label: 'BP401 Phase 2 water' }
const onJob: ChangeAbout = { kind: 'job', id: 'j1102', label: 'JP1102 Lot 7' }
const LONG = 'The whole of a long reply about the price. '.repeat(20).trim()

function mail(over: Partial<TiedMailRow> & { id: string }): TiedMailRow {
  return { contact_id: 'c-dana', bid_id: 'b401', jobs_ledger_id: null, direction: 'in', who_user_id: null, who_text: 'Dana Whitfield to the bids box', at: '2026-11-16T15:04:00.000Z', subject: 'Re: Phase 2 water', body: 'Can you hold the price?', gmail_id: `g-${over.id}`, ...over }
}
const lines = (rows: TiedMailRow[], door = true) =>
  mailLines(rows, {
    bid: (id) => (id === 'b401' ? onBid : null),
    job: (id) => (id === 'j1102' ? onJob : null),
    contacts: [{ id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', goes_by: null }],
    names: new Map(),
    threadHref: door ? (_kind, contactId, messageId) => threadHrefByKind('customer', contactId, messageId) : null,
  })
/** The lines as the page hands them to the feed: through the one stream, newest first. */
const feedOf = (rows: TiedMailRow[], door = true) =>
  buildWhatChanged({ members: { bids: [], jobs: [] }, requests: [], submissionEntries: [], bidChanges: [], statusEvents: [], invoices: [], payments: [], threadNotes: [], bidNotes: [], entryLines: [], mailLines: lines(rows, door), customerContacts: [], customerNames: new Map(), names: new Map(), bidLabel: () => '', jobLabel: () => '', stageLabel: () => '', money: () => '', shortDay: () => '', siteName: 'Harlow Ranch', nowMs: Date.parse('2026-11-16T18:00:00Z') })

describe('DevelopmentFeed: a mail tied to a bid or a job', () => {
  it('draws a bid’s mail and a job’s mail, newest first, each with its subject, words, who and door', () => {
    const onOpenThread = vi.fn()
    const feed = feedOf([mail({ id: 'm1' }), mail({ id: 'm2', bid_id: null, jobs_ledger_id: 'j1102', direction: 'out', who_text: 'Sam to Dana Whitfield', at: '2026-11-16T16:30:00.000Z', subject: 'Lot 7 start', body: 'We start Monday.' })])
    renderWithProviders(<DevelopmentFeed lines={feed} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} onMore={() => {}} onOpenThread={onOpenThread} />)
    const rows = screen.getAllByTestId('history-mail-line')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('Email out · JP1102 Lot 7 · Lot 7 start · We start Monday. · Sam to Dana Whitfield')
    expect(rows[1]!.textContent).toContain('Email in · BP401 Phase 2 water · Re: Phase 2 water · Can you hold the price? · Dana Whitfield to the bids box')
    expect(within(rows[1]!).getByTestId('history-mail-subject').textContent).toContain('Re: Phase 2 water')
    fireEvent.click(within(rows[1]!).getByText('Open in Messages ›'))
    expect(onOpenThread).toHaveBeenCalledWith('/messages?thread=c-dana&at=m1')
  })

  it('a long mail folds behind more ›, and a reader with no Messages reads the words with no door', () => {
    const onMore = vi.fn()
    const feed = feedOf([mail({ id: 'm1', body: LONG })], false)
    renderWithProviders(<DevelopmentFeed lines={feed} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} onMore={onMore} onOpenThread={() => {}} />)
    const row = screen.getByTestId('history-mail-line')
    expect(row.textContent).not.toContain(LONG)
    expect(within(row).queryByText('Open in Messages ›')).toBeNull()
    fireEvent.click(within(row).getByText('more ›'))
    expect(onMore).toHaveBeenCalledWith(feed[0])
  })

  it('a search finds a mail by a word of its subject', () => {
    const feed = feedOf([mail({ id: 'm1' }), mail({ id: 'm2', subject: 'Gas line reroute', body: 'See the sketch.' })])
    renderWithProviders(<DevelopmentFeed lines={feed} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} query="reroute" onOpenThread={() => {}} />)
    const rows = screen.getAllByTestId('history-mail-line')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toContain('Gas line reroute')
  })
})

describe('DevelopmentLineWindow: the whole of a tied mail', () => {
  it('shows the subject over every word, and its door goes to the thread in Messages', () => {
    const onOpenThread = vi.fn()
    const line = lines([mail({ id: 'm1', body: LONG })])[0]!
    renderWithProviders(<DevelopmentLineWindow line={line} onClose={() => {}} openAbout={() => {}} onOpenThread={onOpenThread} />)
    const body = screen.getByTestId('history-line-window-body')
    expect(screen.getByTestId('history-line-window-subject').textContent).toBe('Re: Phase 2 water')
    expect(body.textContent).toContain(LONG)
    fireEvent.click(screen.getByText('Open in Messages'))
    expect(onOpenThread).toHaveBeenCalledWith('/messages?thread=c-dana&at=m1')
  })

  it('a line that is not a mail has no subject and no door', () => {
    renderWithProviders(<DevelopmentLineWindow line={{ id: 'note:1', at: '2026-11-16T15:04:00.000Z', kind: 'note', verb: 'Note', about: onJob, detail: 'Called the super.', by: 'Sam', waitingDays: null }} onClose={() => {}} openAbout={() => {}} onOpenThread={() => {}} />)
    expect(screen.queryByTestId('history-line-window-subject')).toBeNull()
    expect(screen.queryByText('Open in Messages')).toBeNull()
  })

  it('a bid’s mail that carries files draws the bid’s press for a reader who may keep them, and none without that (punch list #368)', () => {
    const line = lines([mail({ id: 'm1' })])[0]!
    const withFiles = { ...line, mail: { messageId: 'm1', bidId: 'b401', bidLabel: 'BP401', ready: 2, kept: 0 } }
    const first = renderWithProviders(<DevelopmentLineWindow line={withFiles} onClose={() => {}} openAbout={() => {}} onOpenThread={() => {}} onKeptFiles={() => {}} />)
    expect(within(screen.getByTestId('history-line-window-keep')).getByText('BP401|b401|m1')).toBeTruthy()
    first.unmount()
    renderWithProviders(<DevelopmentLineWindow line={withFiles} onClose={() => {}} openAbout={() => {}} onOpenThread={() => {}} />)
    expect(screen.queryByTestId('history-line-window-keep')).toBeNull()
  })
})

describe('DevelopmentFeed: a bid’s mail that carries files (punch list #368)', () => {
  const withFiles = (ready: number, kept: number) => lines([mail({ id: 'm1' })]).map((l) => ({ ...l, mail: { messageId: 'm1', bidId: 'b401', bidLabel: 'BP401', ready, kept } }))
  it('the line’s press opens the line’s window, where the form is', () => {
    const onMore = vi.fn()
    const feed = withFiles(2, 0)
    renderWithProviders(<DevelopmentFeed lines={feed} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} onMore={onMore} onOpenThread={() => {}} />)
    fireEvent.click(within(screen.getByTestId('history-mail-line')).getByText('Keep its 2 files… ›'))
    expect(onMore).toHaveBeenCalledWith(feed[0])
  })
  it('once the files are kept the line says so and offers no press', () => {
    renderWithProviders(<DevelopmentFeed lines={withFiles(0, 2)} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} onMore={() => {}} onOpenThread={() => {}} />)
    const row = screen.getByTestId('history-mail-line')
    expect(within(row).getByTestId('history-mail-kept').textContent).toContain('kept on the bid')
    expect(within(row).queryByText(/Keep its/)).toBeNull()
  })
})
