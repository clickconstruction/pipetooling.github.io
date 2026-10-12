// @vitest-environment jsdom
/**
 * Messages, cut 2's screens, C1: Follow up inside the thread window (v2.5314). Over a fake io, with the open thread
 * mocked and the window's read again a spy: who has it in the header, the back and snoozed pills, ⋯'s state rows, each
 * press saying the kernel's words and asking the window to read again, a refusal keeping its words, and nothing drawn
 * for another person or off the office team. The people are the prototype's demo people.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { FollowUpThreadIo, FollowUpThreadRows } from '../../lib/followUp/followUpThreadIo'
import { BACK_CLEARED_TOAST } from '../../lib/followUp/queue'
import { SMOKE_AUTH_USER_ID, renderWithProviders } from '../../test/renderSmokeMocks'
import { DatabaseError } from '../../utils/errorHandling'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'
import { useFollowUpThreadSlots } from './useFollowUpThreadSlots'

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
    ...over,
  }
}

/** The three slots as the window draws them, for one person. */
function Harness({ io, contact }: { io: FollowUpThreadIo; contact: Contact }) {
  const slots = useFollowUpThreadSlots(io)
  return (
    <div>
      <div data-testid="header">{slots.headerRight?.(contact)}</div>
      <div data-testid="status">{slots.statusRow?.(contact)}</div>
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
function renderThread(io: FollowUpThreadIo, contact: Contact = GREG) {
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <Harness io={io} contact={contact} />
    </MessagesRereadContext.Provider>,
  )
}
const header = () => within(screen.getByTestId('header'))
const status = () => within(screen.getByTestId('status'))
const more = () => within(screen.getByTestId('more'))

beforeEach(() => {
  auth.role = 'estimator'
  open.contactId = 'greg'
  reread.mockClear()
})
afterEach(cleanup)

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
    const io = fakeIo()
    renderThread(io, PRIYA)
    await waitFor(() => expect(io.loadThread).toHaveBeenCalledWith('greg'))
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
