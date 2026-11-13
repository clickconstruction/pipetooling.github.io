// @vitest-environment jsdom
/**
 * Punch list #207 (v2.6745): the *Answered them from your own mailbox?* strip above the reply box, over a fake io. It
 * shows while the court is ours by their last word alone, not on their move, not while we owe them something, and not
 * for someone off the office team. Find my sent mail asks My email for the person's Sent to their addresses, offers Tag
 * it on a mail not yet on a thread and says so on one that is, tags onto the job in view and reads the thread again; a
 * refusal shows the function's words and keeps the hand record open; I answered, write it down records the words
 * through the RPC and reads again. The people are made up; nothing here is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import { owedStore } from '../../lib/followUp/owedStore'
import type { MyMailRow } from '../../lib/myMail/contract'
import type { JobTile } from '../../lib/messages/jobTiles'
import type { OwnMailboxAnswerIo } from '../../lib/messages/ownMailboxAnswerIo'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OpenThreadContext, type OpenThread } from '../gc/messages/openThread'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const auth = vi.hoisted(() => ({ role: 'estimator' }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role, profileName: 'Wendi Doll' })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const { useOwnMailboxThreadSlots } = await import('./useOwnMailboxThreadSlots')

afterEach(() => {
  cleanup()
  owedStore.unpublish('c-rusty')
})
beforeEach(() => {
  auth.role = 'estimator'
})

const RUSTY: Contact = {
  id: 'c-rusty',
  kind: 'customer',
  name: 'Rusty Cotterby',
  goesBy: null,
  company: 'Cotterby Builders',
  record: { table: 'customers', id: 'cust-cotterby' },
  channels: [{ id: 'ch-1', kind: 'email', value: 'rusty@cotterbybuilders.example', optedOutAt: null }],
  jobIds: ['bid:b-oak'],
  defaultJobId: null,
  customerId: 'cust-cotterby',
}
const OAK: JobTile = { key: 'bid:b-oak', kind: 'bid', num: 'B512', name: 'Oak Hill Clinic', day: { words: 'bid due Thu Nov 12 · 4 days', tone: 'soon' } }

const line = (id: string, direction: 'in' | 'out', at: string): ThreadMessage => ({
  id,
  contactId: 'c-rusty',
  jobId: 'bid:b-oak',
  channel: 'email',
  direction,
  at,
  who: direction === 'in' ? 'Rusty Cotterby' : 'Wendi Doll',
  subject: 'Bid request',
  body: direction === 'in' ? 'Can you price the plumbing on Oak Hill?' : 'Numbers attached.',
})
const THEIRS_LAST = [line('m-1', 'out', '2026-11-06T15:00:00Z'), line('m-2', 'in', '2026-11-07T15:00:00Z')]
const OURS_LAST = [line('m-1', 'in', '2026-11-06T15:00:00Z'), line('m-2', 'out', '2026-11-07T15:00:00Z')]

const sentRow = (over: Partial<MyMailRow> = {}): MyMailRow => ({
  gmailId: 'g-1',
  threadId: 't-1',
  direction: 'out',
  who: { name: 'Rusty Cotterby', address: 'rusty@cotterbybuilders.example' },
  subject: 'Re: Bid request',
  snippet: 'Numbers attached.',
  at: '2026-11-07T20:00:00.000Z',
  files: 1,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
  ...over,
})

function fakeIo(over: Partial<OwnMailboxAnswerIo> = {}) {
  return {
    listSent: vi.fn(async () => ({ ok: true as const, address: 'wendi@clickconstruction.example', rows: [sentRow(), sentRow({ gmailId: 'g-2', threadId: 't-2', subject: 'Re: Addendum 2', inMessages: { messageId: 'm-9', jobKey: 'bid:b-oak' } })], nextPageToken: null, folded: 0 })),
    tag: vi.fn(async () => ({ ok: true as const, jobKey: 'bid:b-oak', lines: 1, tied: 0, files: 1, contactId: 'c-rusty', unknownSender: null })),
    record: vi.fn(async () => 'm-new'),
    ...over,
  }
}

function Harness({ io, contact }: { io: OwnMailboxAnswerIo; contact: Contact }) {
  const slots = useOwnMailboxThreadSlots(io)
  return <div data-testid="above">{slots.aboveBox?.(contact)}</div>
}

function mount(io: OwnMailboxAnswerIo, lines: readonly ThreadMessage[], over: Partial<OpenThread> = {}) {
  const reread = vi.fn()
  const open: OpenThread = {
    contact: RUSTY,
    lines,
    jobFilter: 'bid:b-oak',
    rail: ['bid:b-oak'],
    tiles: { 'bid:b-oak': OAK },
    userNames: {},
    nowIso: '2026-11-08T15:00:00Z',
    searchJobs: async () => [],
    ...over,
  }
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <OpenThreadContext.Provider value={open}>
        <Harness io={io} contact={RUSTY} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  return { reread, above: screen.getByTestId('above') }
}

describe('useOwnMailboxThreadSlots: the strip above the box (punch list #207, v2.6745)', () => {
  it('shows on our move with its two doors, and not on theirs, not while we owe them, not off the office team', () => {
    const { above } = mount(fakeIo(), THEIRS_LAST)
    expect(within(above).getByText('Answered them from your own mailbox?')).toBeTruthy()
    expect(within(above).getByRole('button', { name: 'Find my sent mail' })).toBeTruthy()
    expect(within(above).getByRole('button', { name: 'I answered, write it down' })).toBeTruthy()
    cleanup()

    expect(mount(fakeIo(), OURS_LAST).above.querySelector('[data-own-mailbox]')).toBeNull()
    cleanup()

    owedStore.publish('c-rusty', { what: 'the revised number', byYmd: '2026-11-10', byWords: null, markedBy: 'Wendi', markedAt: '2026-11-07T16:00:00Z' })
    expect(mount(fakeIo(), THEIRS_LAST).above.querySelector('[data-own-mailbox]')).toBeNull()
    owedStore.unpublish('c-rusty')
    cleanup()

    auth.role = 'technician'
    expect(mount(fakeIo(), THEIRS_LAST).above.querySelector('[data-own-mailbox]')).toBeNull()
  })

  it('finds the sent mail to their address, offers Tag it on one not yet on a thread, tags onto the job in view and reads again', async () => {
    const io = fakeIo()
    const { above, reread } = mount(io, THEIRS_LAST)
    fireEvent.click(within(above).getByRole('button', { name: 'Find my sent mail' }))
    await waitFor(() => expect(io.listSent).toHaveBeenCalledWith('to:rusty@cotterbybuilders.example newer_than:30d'))
    const list = await within(above).findByRole('list')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('Re: Bid request')
    expect(within(rows[0]!).getByRole('button', { name: 'Tag it' })).toBeTruthy()
    expect(rows[1]!.textContent).toContain('already on the thread')
    expect(within(rows[1]!).queryByRole('button', { name: 'Tag it' })).toBeNull()

    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Tag it' }))
    await waitFor(() => expect(io.tag).toHaveBeenCalledWith('t-1', { kind: 'bid', id: 'b-oak' }))
    await waitFor(() => expect(reread).toHaveBeenCalledTimes(1))
    expect(within(above).getByRole('status').textContent).toBe('Tagged onto the job. Their move now.')
    expect(within(above).queryByRole('button', { name: 'Tag it' })).toBeNull()
  })

  it('shows the function\'s refusal in its own words and keeps the hand record, and says so when nothing was found', async () => {
    const io = fakeIo({ listSent: vi.fn(async () => ({ ok: false as const, error: 'off' as const, words: 'Your mail is not shown here. Turn on Show my mail on the My email tab in Settings, under Your account.' })) })
    const { above } = mount(io, THEIRS_LAST)
    fireEvent.click(within(above).getByRole('button', { name: 'Find my sent mail' }))
    await waitFor(() => expect(within(above).getByRole('status').textContent).toContain('Turn on Show my mail'))
    expect(within(above).getByRole('button', { name: 'I answered, write it down' })).toBeTruthy()
    cleanup()

    const none = fakeIo({ listSent: vi.fn(async () => ({ ok: true as const, address: 'wendi@clickconstruction.example', rows: [], nextPageToken: null, folded: 0 })) })
    const second = mount(none, THEIRS_LAST)
    fireEvent.click(within(second.above).getByRole('button', { name: 'Find my sent mail' }))
    await waitFor(() => expect(within(second.above).getByRole('status').textContent).toBe('No sent mail to them in the last 30 days. Write the answer down instead.'))
    cleanup()

    // No address on the thread: nothing is asked of My email.
    const noAddress = fakeIo()
    const third = mount(noAddress, THEIRS_LAST, { contact: { ...RUSTY, channels: [] } })
    // The slot is drawn for the contact handed in, so the harness's contact must lack the address too.
    cleanup()
    renderWithProviders(
      <MessagesRereadContext.Provider value={vi.fn()}>
        <OpenThreadContext.Provider value={{ contact: { ...RUSTY, channels: [] }, lines: THEIRS_LAST, jobFilter: null, rail: [], tiles: {}, userNames: {}, nowIso: '2026-11-08T15:00:00Z', searchJobs: async () => [] }}>
          <Harness io={noAddress} contact={{ ...RUSTY, channels: [] }} />
        </OpenThreadContext.Provider>
      </MessagesRereadContext.Provider>,
    )
    void third
    fireEvent.click(screen.getByRole('button', { name: 'Find my sent mail' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('They have no email address here. Write the answer down instead.'))
    expect(noAddress.listSent).not.toHaveBeenCalled()
  })

  it('writes the answer down with the words typed, on the job in view, and reads again; Not now puts the doors back', async () => {
    const io = fakeIo()
    const { above, reread } = mount(io, THEIRS_LAST)
    fireEvent.click(within(above).getByRole('button', { name: 'I answered, write it down' }))
    const box = within(above).getByRole('textbox', { name: 'What you told them, in a line. You can leave it blank.' })
    fireEvent.change(box, { target: { value: '  Sent the revised number Friday. ' } })
    fireEvent.click(within(above).getByRole('button', { name: 'Write it down' }))
    await waitFor(() => expect(io.record).toHaveBeenCalledWith('c-rusty', 'Sent the revised number Friday.', { kind: 'bid', id: 'b-oak' }))
    await waitFor(() => expect(reread).toHaveBeenCalledTimes(1))
    expect(within(above).getByRole('status').textContent).toBe('Written down. Their move now.')
    expect(within(above).getByRole('button', { name: 'Find my sent mail' })).toBeTruthy()
    cleanup()

    // Blank words go as null, so the function writes its own line; no job in view and no star sends none.
    const bare = fakeIo()
    const second = mount(bare, THEIRS_LAST, { jobFilter: null })
    fireEvent.click(within(second.above).getByRole('button', { name: 'I answered, write it down' }))
    fireEvent.click(within(second.above).getByRole('button', { name: 'Write it down' }))
    await waitFor(() => expect(bare.record).toHaveBeenCalledWith('c-rusty', null, null))
    cleanup()

    const third = mount(fakeIo(), THEIRS_LAST)
    fireEvent.click(within(third.above).getByRole('button', { name: 'I answered, write it down' }))
    fireEvent.click(within(third.above).getByRole('button', { name: 'Not now' }))
    expect(within(third.above).queryByRole('textbox')).toBeNull()
    expect(within(third.above).getByRole('button', { name: 'Find my sent mail' })).toBeTruthy()
  })
})
