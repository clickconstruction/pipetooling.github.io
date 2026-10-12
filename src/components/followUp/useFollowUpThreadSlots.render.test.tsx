// @vitest-environment jsdom
/**
 * Messages, cut 2's screens, C1: Follow up inside the thread window (v2.5314). Over a fake io, with the open thread
 * mocked and the window's read again a spy: who has it in the header, the back and snoozed pills, ⋯'s state rows, each
 * press saying the kernel's words and asking the window to read again, a refusal keeping its words, and nothing drawn
 * for another person or off the office team. The people are the prototype's demo people.
 */
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { ThreadMessage } from '../../lib/messages/thread'
import type { FollowUpThreadIo, FollowUpThreadRows } from '../../lib/followUp/followUpThreadIo'
import { BACK_CLEARED_TOAST } from '../../lib/followUp/queue'
import { owedStore } from '../../lib/followUp/owedStore'
import { SMOKE_AUTH_USER_ID, renderWithProviders } from '../../test/renderSmokeMocks'
import { DatabaseError } from '../../utils/errorHandling'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'
import { useFollowUpThreadSlots } from './useFollowUpThreadSlots'
import { useOwedSettling } from './useOwedSettling'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const auth = vi.hoisted(() => ({ role: 'estimator' }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role, profileName: 'Robert' })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})
const open = vi.hoisted(() => ({ contactId: 'greg' as string | null }))
vi.mock('../gc/messages/useThreadWindow', () => ({
  useThreadWindow: () => ({ contactId: open.contactId, at: null, openThread: () => undefined, closeThread: () => undefined }),
}))

const GREG: Contact = {
  id: 'greg',
  kind: 'trade',
  name: 'Greg Paulk',
  goesBy: null,
  company: 'Hillside Excavation',
  trade: 'Sitework',
  record: { table: 'gc_companies', id: 'hillside' },
  channels: [],
  jobIds: [],
  defaultJobId: null,
}
const PRIYA: Contact = { ...GREG, id: 'priya', kind: 'customer', name: 'Dr. Priya Raman', company: 'Helotes Dental Office', record: null }

const note = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  contact_id: 'greg',
  channel_id: null,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel: 'note',
  direction: 'team',
  who_user_id: 'u-rosa',
  who_text: '',
  at: '2026-09-28T15:00:00.000Z',
  subject: null,
  body: 'Call Greg about the pond.',
  optout_line: null,
  back_on: '2026-10-02',
  back_by: 'u-rosa',
  back_words: null,
  back_done_at: null,
  ...patch,
})

/** Rosa has Greg and holds Priya too; her note brings Greg back on Friday. */
const rows = (contact: Partial<FollowUpThreadRows['contact'] & object> = {}): FollowUpThreadRows => ({
  contact: { state: 'waiting', snoozed_until: null, has_user_id: 'u-rosa', has_since: '2026-10-01T15:00:00.000Z', has_how: 'took', ...contact },
  notes: [note('n1')],
  holders: [
    { id: 'greg', state: 'waiting', snoozed_until: null, has_user_id: 'u-rosa' },
    { id: 'priya', state: 'waiting', snoozed_until: null, has_user_id: 'u-rosa' },
  ],
  owed: [],
  heard: [],
  highlights: [],
  jobNames: { 'project:p-boerne': 'Boerne Clinic' },
})

function fakeIo(over: Partial<FollowUpThreadIo> = {}, read: FollowUpThreadRows = rows()): FollowUpThreadIo {
  return {
    loadThread: vi.fn(async () => read),
    loadTeam: vi.fn(async () => [
      { id: SMOKE_AUTH_USER_ID, name: 'Robert', role: 'estimator' },
      { id: 'u-rosa', name: 'Rosa', role: 'assistant' },
    ]),
    takeIt: vi.fn(async () => undefined),
    handTo: vi.fn(async () => undefined),
    setState: vi.fn(async () => null),
    backDone: vi.fn(async () => undefined),
    markOwed: vi.fn(async () => 'o-new'),
    writeDown: vi.fn(async () => undefined),
    readQuestion: vi.fn(async () => undefined),
    highlight: vi.fn(async () => 'h-new'),
    unhighlight: vi.fn(async () => undefined),
    planQuestions: { record: vi.fn(async () => 'pq-1'), send: vi.fn(async () => ({ to: 'studio@archfirm.example' })) },
    ...over,
  }
}

/** Cut 3's reply box, as far as a settle goes: it takes one while it is mounted. */
function BoxStandIn({ contactId }: { contactId: string }) {
  const settling = useOwedSettling(contactId, { owedDone: async () => 'n1' })
  return settling.active ? <p>The box is marking it done.</p> : null
}

/** Greg's question on the Boerne job, as the thread window holds a line. */
const LINE: ThreadMessage = {
  id: 'm-greg',
  contactId: 'greg',
  jobId: 'project:p-boerne',
  channel: 'text',
  direction: 'in',
  at: '2026-10-01T14:00:00.000Z',
  who: 'Greg',
  subject: null,
  body: 'Is the detention pond in sitework or concrete?',
  channelId: null,
  durationSeconds: null,
  optoutLine: null,
  backOn: null,
  backBy: null,
}

/** The slots as the window draws them, for one person, with or without a reply box, a line and a selection. */
function Harness({ io, contact, box = false, selection = '' }: { io: FollowUpThreadIo; contact: Contact; box?: boolean; selection?: string }) {
  const slots = useFollowUpThreadSlots(io)
  return (
    <div>
      <div data-testid="header">{slots.headerRight?.(contact)}</div>
      <div data-testid="status">{slots.statusRow?.(contact)}</div>
      <div data-testid="above">{slots.aboveBox?.(contact)}</div>
      {box && <BoxStandIn contactId={contact.id} />}
      <div data-testid="line">
        {slots.lineBody?.(LINE, contact)}
        {slots.underLine?.(LINE, contact)}
      </div>
      <div data-testid="window">{slots.messageWindowFirst?.(LINE, selection)}</div>
      <div data-testid="more">
        {(slots.menuRows?.(contact) ?? []).map((r) => (
          <button key={r.key} type="button" title={r.tip} disabled={r.disabled} onClick={r.onPress}>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const reread = vi.fn()
function renderThread(io: FollowUpThreadIo, contact: Contact = GREG, box = false, selection = '') {
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <Harness io={io} contact={contact} box={box} selection={selection} />
    </MessagesRereadContext.Provider>,
  )
}
const header = () => within(screen.getByTestId('header'))
const status = () => within(screen.getByTestId('status'))
const more = () => within(screen.getByTestId('more'))
const above = () => within(screen.getByTestId('above'))

/** Greg is owed the plans or an addendum by Friday, marked by Rosa. */
const OWED_ROW = {
  id: 'o1',
  contact_id: 'greg',
  what: 'the plans or an addendum',
  by_day: '2026-10-09',
  by_words: null,
  marked_by: 'u-rosa',
  marked_at: '2026-09-26T19:30:00.000Z',
  done_at: null,
  done_how: null,
  done_note_message_id: null,
}

beforeEach(() => {
  auth.role = 'estimator'
  open.contactId = 'greg'
  reread.mockClear()
})
afterEach(() => {
  cleanup()
  act(() => owedStore.cancel(owedStore.get().contactId))
})

describe('Follow up in the thread window', () => {
  it('draws who has it, the back pill and ⋯’s rows for the open thread', async () => {
    renderThread(fakeIo())
    expect(await header().findByRole('button', { name: 'Rosa has this' })).toBeTruthy()
    const back = screen.getByText('↩ back Fri Oct 2').closest('[data-follow-up-back]') as HTMLElement
    expect(back.getAttribute('title')).toMatch(/^Comes back Fri Oct 2\. A note by Rosa brings this row back/)
    expect(more().getAllByRole('button').map((b) => b.textContent)).toEqual(['No reply needed', 'Remind me Monday'])
  })

  it('takes it from the picker, says so, reads again and asks the window to read the thread again', async () => {
    const io = fakeIo()
    renderThread(io)
    fireEvent.click(await header().findByRole('button', { name: 'Rosa has this' }))
    // Rosa holds two open conversations.
    expect(screen.getByRole('menuitemradio', { name: /^Rosa/ }).textContent).toContain('holds 2 waiting')
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^I'll take it/ }))
    expect(await screen.findByText('You have Greg Paulk.')).toBeTruthy()
    expect(io.takeIt).toHaveBeenCalledWith('greg')
    expect(reread).toHaveBeenCalledTimes(1)
    expect(io.loadThread).toHaveBeenCalledTimes(2)
  })

  it('⋯ closes an open conversation, and reopens a closed one', async () => {
    const io = fakeIo()
    renderThread(io)
    fireEvent.click(await more().findByRole('button', { name: 'No reply needed' }))
    expect(await screen.findByText('Greg Paulk cleared from Follow up.')).toBeTruthy()
    expect(io.setState).toHaveBeenCalledWith('greg', 'done')
    cleanup()

    const closed = fakeIo({}, rows({ state: 'done', has_user_id: null, has_since: null, has_how: null }))
    renderThread(closed)
    fireEvent.click(await more().findByRole('button', { name: 'Reopen' }))
    expect(await screen.findByText('Greg Paulk is back in Follow up.')).toBeTruthy()
    expect(closed.setState).toHaveBeenCalledWith('greg', 'waiting')
  })

  it('× clears a note’s day, and a snoozed conversation says until when', async () => {
    const io = fakeIo({}, rows({ state: 'snoozed', snoozed_until: '2026-10-05' }))
    renderThread(io)
    expect(await status().findByText('snoozed until Mon Oct 5')).toBeTruthy()
    fireEvent.click(status().getByRole('button', { name: 'Clear the day' }))
    expect(await screen.findByText(BACK_CLEARED_TOAST)).toBeTruthy()
    expect(io.backDone).toHaveBeenCalledWith('n1')
  })

  it('a refused press says its own words, and the window does not read again', async () => {
    const refused = new DatabaseError('Failed to change a conversation: That conversation is not there.', 'P0001', null, {
      serverMessage: 'That conversation is not there.',
      operationName: 'change a conversation',
    })
    renderThread(fakeIo({ setState: vi.fn(async () => Promise.reject(refused)) }))
    fireEvent.click(await more().findByRole('button', { name: 'Remind me Monday' }))
    expect(await screen.findByText('That conversation is not there.')).toBeTruthy()
    await waitFor(() => expect(more().getByRole('button', { name: 'Remind me Monday' })).toHaveProperty('disabled', false))
    expect(reread).not.toHaveBeenCalled()
  })

  it('draws nothing for another person than the open thread, or for someone off the office team', async () => {
    const io = fakeIo({}, {
      ...rows(),
      heard: [
        {
          id: 'p1',
          message_id: 'm-greg',
          kind: 'question',
          state: 'offered',
          day: null,
          day_words: null,
          writes: null,
          decided_by: null,
          decided_at: null,
          message: { contact_id: 'greg', at: '2026-10-01T14:00:00.000Z' },
        },
      ],
      highlights: [{ id: 'h1', message_id: 'm-greg', text: 'detention pond', highlighted_by: 'u-rosa', highlighted_at: '2026-10-02T15:00:00.000Z' }],
    })
    renderThread(io, PRIYA)
    await waitFor(() => expect(io.loadThread).toHaveBeenCalledWith('greg'))
    expect(screen.getByTestId('header').textContent).toBe('')
    expect(screen.getByTestId('more').textContent).toBe('')
    expect(screen.getByTestId('line').textContent).toBe('')
    cleanup()

    auth.role = 'superintendent'
    const off = fakeIo()
    renderThread(off)
    await waitFor(() => expect(screen.getByTestId('header').textContent).toBe(''))
    expect(off.loadThread).not.toHaveBeenCalled()
  })
})

describe('what we owe, in the thread window (C2)', () => {
  it('We owe them… opens the strip, and Mark it writes it with its words and reads again', async () => {
    const io = fakeIo()
    renderThread(io)
    fireEvent.click(await status().findByRole('button', { name: 'We owe them…' }))
    fireEvent.click(above().getByRole('button', { name: 'a call back' }))
    fireEvent.click(above().getByRole('button', { name: 'Mark it' }))
    expect(await screen.findByText('Marked: we owe Greg Paulk a call back.')).toBeTruthy()
    expect(io.markOwed).toHaveBeenCalledWith('greg', 'a call back', { ymd: null, words: null })
    expect(reread).toHaveBeenCalledTimes(1)
    expect(io.loadThread).toHaveBeenCalledTimes(2)
  })

  it('with something owed: Mark it done, with a team note hands the box a settle, and a landed settle reads again', async () => {
    const io = fakeIo({}, { ...rows(), owed: [OWED_ROW] })
    renderThread(io, GREG, true)
    fireEvent.click(await status().findByRole('button', { name: 'Change what we owe' }))
    expect(above().getByRole('button', { name: 'the plans or an addendum ▾' })).toBeTruthy()
    fireEvent.click(above().getByRole('button', { name: 'Mark it done, with a team note' }))
    expect(owedStore.get()).toMatchObject({ contactId: 'greg', owed: { what: 'the plans or an addendum', byYmd: '2026-10-09', markedBy: 'Rosa' } })
    expect(screen.getByTestId('above').textContent).toBe('')
    expect(screen.getByText('The box is marking it done.')).toBeTruthy()

    const reads = vi.mocked(io.loadThread).mock.calls.length
    act(() => owedStore.landed())
    await waitFor(() => expect(io.loadThread).toHaveBeenCalledTimes(reads + 1))
  })

  it('tells the box what we owe the open person once read, and forgets it when the thread closes', async () => {
    renderThread(fakeIo({}, { ...rows(), owed: [OWED_ROW] }))
    await waitFor(() => expect(owedStore.get().open).toMatchObject({ contactId: 'greg', owed: { what: 'the plans or an addendum' } }))
    cleanup()
    expect(owedStore.get().open).toBeNull()
  })

  it('leaving the thread ends a settle it started', async () => {
    const io = fakeIo({}, { ...rows(), owed: [OWED_ROW] })
    renderThread(io, GREG, true)
    fireEvent.click(await status().findByRole('button', { name: 'Change what we owe' }))
    fireEvent.click(above().getByRole('button', { name: 'Mark it done, with a team note' }))
    expect(owedStore.get().contactId).toBe('greg')
    cleanup()
    expect(owedStore.get().contactId).toBeNull()
  })

  it('offers no done with a team note while no reply box is there to take it', async () => {
    renderThread(fakeIo({}, { ...rows(), owed: [OWED_ROW] }))
    fireEvent.click(await status().findByRole('button', { name: 'Change what we owe' }))
    expect(above().queryByRole('button', { name: 'Mark it done, with a team note' })).toBeNull()
  })

  it('Put it off snoozes the row to Monday, and what we owe stays marked', async () => {
    const io = fakeIo({}, { ...rows(), owed: [OWED_ROW] })
    renderThread(io)
    fireEvent.click(await status().findByRole('button', { name: 'Change what we owe' }))
    fireEvent.click(above().getByRole('button', { name: 'Put it off' }))
    expect(await screen.findByText('Greg Paulk comes back to Follow up on Monday.')).toBeTruthy()
    expect(io.setState).toHaveBeenCalledWith('greg', 'snoozed')
    expect(io.markOwed).not.toHaveBeenCalled()
  })
})

/** A message_promises row on Greg's line. */
const heardRow = (patch: Record<string, unknown>) => ({
  id: 'p1',
  message_id: 'm-greg',
  kind: null,
  state: 'offered',
  day: '2026-10-07',
  day_words: null,
  writes: null,
  decided_by: null,
  decided_at: null,
  message: { contact_id: 'greg', at: '2026-10-01T14:00:00.000Z', project_id: 'p-boerne' },
  ...patch,
})
const line = () => within(screen.getByTestId('line'))

describe('what a line was heard as, and highlights, in the thread window (C3)', () => {
  it('a heard day: a choice writes it down in words that claim no other place', async () => {
    const io = fakeIo({}, { ...rows(), heard: [heardRow({})] })
    renderThread(io)
    expect(await line().findByText('is a promise of')).toBeTruthy()
    expect(line().getAllByRole('button').map((b) => b.textContent)).toEqual(['Their quote', 'A start or delivery', 'Insurance or W-9', 'just talk'])
    fireEvent.click(line().getByRole('button', { name: 'A start or delivery' }))
    expect(await screen.findByText('Written down. Hillside Excavation’s start on Boerne Clinic by Wed Oct 7.')).toBeTruthy()
    expect(io.writeDown).toHaveBeenCalledWith('m-greg', 'start', 'start')
    expect(reread).toHaveBeenCalledTimes(1)
  })

  it('just talk says the day was no promise', async () => {
    const io = fakeIo({}, { ...rows(), heard: [heardRow({})] })
    renderThread(io)
    fireEvent.click(await line().findByRole('button', { name: 'just talk' }))
    await waitFor(() => expect(io.writeDown).toHaveBeenCalledWith('m-greg', null))
  })

  it('a written promise says who wrote it down, and its pill runs in the status row', async () => {
    renderThread(fakeIo({}, { ...rows(), heard: [heardRow({ kind: 'quote', state: 'written', day: '2099-12-01', decided_by: 'u-rosa' })] }))
    expect(await line().findByText('✓ Written down by Rosa: the quote by Tue Dec 1.')).toBeTruthy()
    expect(status().getByText('promised Tue Dec 1 · quote')).toBeTruthy()
  })

  it('a plans question on a GC project: Ask the architect records it, marks it and emails it', async () => {
    const io = fakeIo({}, { ...rows(), heard: [heardRow({ kind: 'question', day: null })] })
    renderThread(io)
    fireEvent.click(await line().findByRole('button', { name: 'Ask the architect' }))
    expect(await screen.findByText('Sent to studio@archfirm.example as a plan question.')).toBeTruthy()
    expect(io.planQuestions.record).toHaveBeenCalledWith({
      projectId: 'p-boerne',
      packageId: null,
      askedByName: 'Greg Paulk at Hillside Excavation',
      text: 'Is the detention pond in sitework or concrete?',
      sheets: [],
    })
    expect(io.readQuestion).toHaveBeenCalledWith('m-greg', 'asked')
    expect(io.planQuestions.send).toHaveBeenCalledWith('pq-1')
  })

  it('Answer it myself marks it, and an asked question says who sent it', async () => {
    const io = fakeIo({}, { ...rows(), heard: [heardRow({ kind: 'question', day: null })] })
    renderThread(io)
    fireEvent.click(await line().findByRole('button', { name: 'Answer it myself' }))
    expect(await screen.findByText('Answer them in the box below.')).toBeTruthy()
    expect(io.readQuestion).toHaveBeenCalledWith('m-greg', 'answered')
    cleanup()
    renderThread(fakeIo({}, { ...rows(), heard: [heardRow({ kind: 'question', day: null, state: 'asked', decided_by: 'u-rosa' })] }))
    expect(await line().findByText('✓ Sent to the architect as a plan question by Rosa.')).toBeTruthy()
  })

  it('highlights take the line’s first lines, each with remove; the message window highlights whole words or removes them all', async () => {
    const marked = { id: 'h1', message_id: 'm-greg', text: 'detention pond', highlighted_by: 'u-rosa', highlighted_at: '2026-10-02T15:00:00.000Z' }
    const io = fakeIo({}, { ...rows(), highlights: [marked] })
    renderThread(io)
    expect(await line().findByText('detention pond')).toBeTruthy()
    fireEvent.click(line().getByRole('button', { name: 'remove' }))
    expect(await screen.findByText('Highlight removed.')).toBeTruthy()
    expect(io.unhighlight).toHaveBeenCalledWith('h1')
    expect(within(screen.getByTestId('window')).getByRole('button', { name: 'Remove the highlight' })).toBeTruthy()
    cleanup()

    const fresh = fakeIo()
    renderThread(fresh, GREG, false, 'tention po')
    fireEvent.click(await within(screen.getByTestId('window')).findByRole('button', { name: 'Highlight the selected words' }))
    expect(await screen.findByText('Highlighted. The thread shows it instead of the first lines.')).toBeTruthy()
    expect(fresh.highlight).toHaveBeenCalledWith('m-greg', 'detention pond')
  })
})
