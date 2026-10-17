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
import type { FollowUpThreadIo, FollowUpThreadRows } from '../../lib/followUp/followUpThreadIo'
import type { ThreadMessage } from '../../lib/messages/thread'
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
  promises: [],
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
    callAdd: vi.fn(async () => 'c-new'),
    setPrefers: vi.fn(async () => undefined),
    ...over,
  }
}

/** Cut 3's reply box, as far as a settle goes: it takes one while it is mounted. */
function BoxStandIn({ contactId }: { contactId: string }) {
  const settling = useOwedSettling(contactId, { owedDone: async () => 'n1' })
  return settling.active ? <p>The box is marking it done.</p> : null
}

/** The slots as the window draws them, for one person, with or without a reply box. */
function Harness({ io, contact, box = false, line }: { io: FollowUpThreadIo; contact: Contact; box?: boolean; line?: ThreadMessage }) {
  const slots = useFollowUpThreadSlots(io)
  return (
    <div>
      <div data-testid="under">{line ? slots.underLine?.(line, contact) : null}</div>
      <div data-testid="header">{slots.headerRight?.(contact)}</div>
      <div data-testid="status">{slots.statusRow?.(contact)}</div>
      <div data-testid="above">{slots.aboveBox?.(contact)}</div>
      {box && <BoxStandIn contactId={contact.id} />}
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
function renderThread(io: FollowUpThreadIo, contact: Contact = GREG, box = false, line?: ThreadMessage) {
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <Harness io={io} contact={contact} box={box} line={line} />
    </MessagesRereadContext.Provider>,
  )
}

/** A text we sent, as the thread holds it. */
const sentText = (patch: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'm-out',
  contactId: 'priya',
  jobId: null,
  channel: 'text',
  direction: 'out',
  at: new Date().toISOString(),
  who: 'Rosa',
  body: 'Your estimate is ready.',
  ...patch,
})
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
    const pill = await header().findByRole('button', { name: 'Rosa has this' })
    expect(pill.className).toBe('thread-head-control') // bare in the header (v2.5542)
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
    const io = fakeIo()
    renderThread(io, PRIYA)
    await waitFor(() => expect(io.loadThread).toHaveBeenCalledWith('greg', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)))
    expect(screen.getByTestId('header').textContent).toBe('')
    expect(screen.getByTestId('more').textContent).toBe('')
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

describe('the quiet call ask under a text we sent (v2.5596)', () => {
  it('asks under a customer’s text sent today, and Add to my calls makes the task for tomorrow', async () => {
    open.contactId = 'priya'
    const io = fakeIo()
    renderThread(io, PRIYA, false, sentText())
    await waitFor(() => expect(within(screen.getByTestId('under')).getByText('Call Priya to talk it through?')).toBeTruthy())
    fireEvent.click(within(screen.getByTestId('under')).getByRole('button', { name: 'Add to my calls' }))
    await waitFor(() => expect(io.callAdd).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'priya', stepKey: null, jobKey: null, what: 'to follow up', script: null })))
  })

  it('stays quiet under their text, under a text from another day, for a trade partner, and once a call to them waits', async () => {
    open.contactId = 'priya'
    renderThread(fakeIo(), PRIYA, false, sentText({ direction: 'in' }))
    await waitFor(() => expect(screen.getByTestId('header').textContent).not.toBe(''))
    expect(screen.getByTestId('under').textContent).toBe('')
    cleanup()
    renderThread(fakeIo(), PRIYA, false, sentText({ at: '2026-09-01T15:00:00.000Z' }))
    await waitFor(() => expect(screen.getByTestId('header').textContent).not.toBe(''))
    expect(screen.getByTestId('under').textContent).toBe('')
    cleanup()
    open.contactId = 'greg'
    renderThread(fakeIo(), GREG, false, sentText({ contactId: 'greg' }))
    await waitFor(() => expect(screen.getByTestId('header').textContent).not.toBe(''))
    expect(screen.getByTestId('under').textContent).toBe('')
    cleanup()
    const waiting = fakeIo({}, { ...rows(), calls: [{ id: 'c1', contact_id: 'priya', step_key: 'estimate', bid_id: null, project_id: null, jobs_ledger_id: null, due_on: '2026-10-03', what: 'about the estimate', script: null, made_by: 'u-rosa', made_at: '2026-10-02T15:00:00.000Z', done_at: null }] })
    open.contactId = 'priya'
    renderThread(waiting, PRIYA, false, sentText())
    await waitFor(() => expect(screen.getByTestId('header').textContent).not.toBe(''))
    expect(screen.getByTestId('under').textContent).toBe('')
  })
})

describe('how they hear from us (v2.5597)', () => {
  it('offers the three ways on a customer’s ⋯, ticks the one that stands, and sets it through the io', async () => {
    open.contactId = 'priya'
    const io = fakeIo({}, { ...rows(), contact: { state: 'waiting', snoozed_until: null, has_user_id: 'u-rosa', has_since: '2026-10-01T15:00:00.000Z', has_how: 'took', prefers: 'text' } })
    renderThread(io, PRIYA)
    expect(await more().findByRole('button', { name: '✓ Hears from us by text' })).toBeTruthy()
    fireEvent.click(more().getByRole('button', { name: 'Hears from us by email' }))
    await waitFor(() => expect(io.setPrefers).toHaveBeenCalledWith('priya', 'email'))
    expect(await screen.findByText('Priya hears from us by email.')).toBeTruthy()
  })

  it('offers none on a trade partner', async () => {
    open.contactId = 'greg'
    renderThread(fakeIo(), GREG)
    await more().findByRole('button', { name: 'Remind me Monday' })
    expect(more().queryByRole('button', { name: /Hears from us/ })).toBeNull()
  })
})
