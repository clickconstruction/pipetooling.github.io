// @vitest-environment jsdom
/**
 * Messages, residential R7: the New lane's sort card in the thread window, drawn by the window's own slots
 * (`useThreadSlots` → `useNewLaneThreadSlots`). One person waiting in New gets one card, however often the window draws
 * again: on a re-read of the thread, and on a press that re-renders it. Live on prod the card stacked up, one more on each
 * re-render (two on open, three after typing in Someone else). The people are the spine's demo rows; nothing is real.
 */
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NewLaneCardIo } from '../../../lib/followUp/newLaneCardIo'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { MessagesWrites } from './messagesWrites'
import { ThreadWindow } from './ThreadWindow'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

/**
 * The card's reads for the number nobody has named: its one text in, nobody on it, so it waits in New with *Who is this?*.
 * Built in `vi.hoisted`, since the slot's hook makes its io when its module loads, before this file's body runs.
 */
const fakeCardIo = vi.hoisted(() => {
  const line = {
    id: 'm-unknown-text',
    contact_id: 'c-unknown',
    channel_id: 'ch-unknown-phone',
    bid_id: null,
    project_id: null,
    jobs_ledger_id: null,
    channel: 'text',
    direction: 'in',
    who_user_id: null,
    who_text: '',
    at: '2026-10-02T14:12:00.000Z',
    subject: null,
    body: 'Can we quote the concrete?',
    optout_line: null,
    back_on: null,
    back_by: null,
    back_words: null,
    back_done_at: null,
    mailbox: 'team',
  }
  const card = {
    contact: { state: 'waiting', snoozed_until: null, has_user_id: null },
    lines: [line],
    tiles: {},
    active: new Set<string>(),
    seats: { customer: null, trade: null, arch: null },
    team: [{ id: 'u-rosa', name: 'Rosa', role: 'assistant' }],
  }
  return {
    loadCard: vi.fn(async () => card),
    loadKnown: vi.fn(async () => ({})),
    markNotice: vi.fn(async () => undefined),
    unmarkNotice: vi.fn(async () => undefined),
    name: vi.fn(async (contactId: string) => contactId),
    tie: vi.fn(async () => undefined),
    takeIt: vi.fn(async () => undefined),
    handTo: vi.fn(async () => undefined),
  }
})
vi.mock('../../../lib/followUp/newLaneCardIo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/followUp/newLaneCardIo')>()
  return { ...actual, supabaseNewLaneCardIo: (): NewLaneCardIo => fakeCardIo as unknown as NewLaneCardIo }
})

function writes(): MessagesWrites {
  return {
    nameContact: vi.fn(() => Promise.resolve(null)),
    tieMessage: vi.fn(() => Promise.resolve()),
    setDefaultJob: vi.fn(() => Promise.resolve()),
    addJob: vi.fn(() => Promise.resolve()),
    removeJob: vi.fn(() => Promise.resolve()),
    searchRecords: vi.fn(() => Promise.resolve([])),
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
}

afterEach(cleanup)

const cards = () => document.querySelectorAll('[data-new-lane-card]')

describe('ThreadWindow: the New lane’s sort card (R7)', () => {
  it('draws one card for a person in New, and still one after the window draws again twice', async () => {
    const w = writes()
    const ui = (view = spineMessagesView()) => <ThreadWindow contactId="c-unknown" onClose={vi.fn()} view={view} nowIso={DEMO_NOW} writes={w} />
    const { rerender } = renderWithProviders(ui())
    await screen.findByRole('region', { name: 'Sort: Who is this?' })
    expect(cards()).toHaveLength(1)

    // A re-read of the thread hands the window a new view, as every press does.
    rerender(ui())
    await act(async () => {})
    expect(cards()).toHaveLength(1)
    rerender(ui())
    await act(async () => {})
    await waitFor(() => expect(cards()).toHaveLength(1))
    // The head asks about the sender (2026-10-23): the number, since the line gives no name.
    expect(screen.getAllByRole('heading', { name: 'Who is 830-555-0199?' })).toHaveLength(1)
  })
})
