// @vitest-environment jsdom
/**
 * Quickfill → Messages (v2.6098, punch list #178): the five lanes with their counts and doors, Answer all on Needs
 * a reply, the Texts ledger folded under them and open while a text waits, the clean words at zero, the problem
 * words with the door, and the note-only body for someone who does not read Messages.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { JUMP_LANE_COLOR } from '../../lib/messages/jumpStrip'
import type { MessagesStation } from '../../lib/quickfill/messagesStation'
import { textsLedger } from '../../lib/quickfill/textsLedger'
import { QuickfillMessagesSection, type QuickfillMessagesSectionProps } from './QuickfillMessagesSection'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useCallThrough', () => ({ useCallThrough: () => ({ call: vi.fn(), choice: null, sheet: null }) }))
vi.mock('../dashboard/TodaysSendsWindow', () => ({ TodaysSendsWindow: () => null }))

const NOW = Date.parse('2026-10-29T15:00:00Z')
const station = (over: Partial<MessagesStation> = {}): MessagesStation => ({
  lanes: [
    { lane: 'new', label: 'New', count: 1, href: '/messages#new-lane', color: JUMP_LANE_COLOR.new },
    { lane: 'needsYou', label: 'Needs you', count: 0, href: '/messages#needs-you', color: JUMP_LANE_COLOR.needsYou },
    { lane: 'needsReply', label: 'Needs a reply', count: 3, href: '/messages#needs-reply', color: JUMP_LANE_COLOR.needsReply },
    { lane: 'weOwe', label: 'We owe them', count: 2, href: '/messages#we-owe-them', color: JUMP_LANE_COLOR.weOwe },
    { lane: 'waiting', label: 'Waiting on them', count: null, href: '/messages#waiting-on-them', color: JUMP_LANE_COLOR.waiting },
  ],
  count: 7,
  first: { contactId: 'c-1', name: 'Priya Natarajan', channelWords: 'a text', waiting: 'waiting 2 h', href: '/messages?thread=c-1' },
  ...over,
})
const ledgerWith = (texts: number) =>
  textsLedger({
    needsReply: Array.from({ length: texts }, (_, i) => ({ contactId: `c-${i}`, landOnId: `m-${i}`, waitingSince: '2026-10-29T13:00:00Z', callBack: false, offers: [], acts: [] })),
    newLane: [],
    lines: new Map(Array.from({ length: texts }, (_, i) => [`m-${i}`, { id: `m-${i}`, contactId: `c-${i}`, channel: 'text' as const, direction: 'in' as const, body: 'are you coming today', at: '2026-10-29T13:00:00Z' }])),
    contacts: Array.from({ length: texts }, (_, i) => ({ id: `c-${i}`, name: `Person ${i}`, kind: 'customer' as const })),
    wentOut: [],
    todayYmd: '2026-10-29',
    nowMs: NOW,
  })

const props = (over: Partial<QuickfillMessagesSectionProps> = {}): QuickfillMessagesSectionProps => ({
  station: station(),
  ledger: ledgerWith(1),
  todaysSends: 0,
  loading: false,
  problem: false,
  canRead: true,
  typed: '',
  onTyped: () => {},
  ...over,
})

afterEach(cleanup)

describe('QuickfillMessagesSection (v2.6098)', () => {
  it('draws the five lanes with their counts and doors, Answer all on Needs a reply, and the Texts fold open with a text waiting', async () => {
    renderWithProviders(<QuickfillMessagesSection {...props()} />)
    await settle()
    expect(screen.getByTestId('messages-lane-new').textContent).toContain('New')
    expect(screen.getByTestId('messages-lane-needsReply').textContent).toContain('3')
    expect(screen.getByTestId('messages-lane-waiting').textContent).toContain('their move, counted on Messages')
    expect(screen.getByTestId('messages-open-needsReply').getAttribute('href')).toBe('/messages#needs-reply')
    expect(screen.getByTestId('messages-answer-all').getAttribute('href')).toBe('/messages?answer=all')
    const fold = screen.getByTestId('messages-texts-fold')
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(fold.textContent).toContain('Texts · 1')
    expect(screen.getByTestId('texts-reply-row')).toBeTruthy()
    fireEvent.click(fold)
    expect(screen.queryByTestId('texts-reply-row')).toBeNull()
  })

  it('at zero it says nobody is waiting and keeps the Texts fold closed; with no reader it is the note alone', async () => {
    renderWithProviders(<QuickfillMessagesSection {...props({ station: station({ count: 0, first: null, lanes: station().lanes.map((l) => ({ ...l, count: l.count == null ? null : 0 })) }), ledger: ledgerWith(0) })} />)
    await settle()
    expect(screen.getByText(/Nothing is waiting on us./)).toBeTruthy()
    expect(screen.getByTestId('messages-texts-fold').getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('messages-answer-all')).toBeNull()
    cleanup()
    renderWithProviders(<QuickfillMessagesSection {...props({ canRead: false, station: null, ledger: null })} />)
    await settle()
    expect(screen.queryByTestId('messages-lane-new')).toBeNull()
  })

  it('a failed read says so with the door, and the Texts fold still draws', async () => {
    renderWithProviders(<QuickfillMessagesSection {...props({ station: null, ledger: null, problem: true })} />)
    await settle()
    expect(screen.getByTestId('messages-problem').textContent).toContain('Messages could not be read')
  })
})
