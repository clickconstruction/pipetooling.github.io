// @vitest-environment jsdom
/**
 * Messages, cut 4b's screens: the change order slots inside a thread window, over a fake io. For the office, a line that
 * became a change order carries its *became CO 1* chip, and a customer's own line has *Start a change order* in its
 * message window, which a line that became one trades for the chip. A trade partner's thread, another person's line and
 * someone off the office team get none of it. A saved draft says the kernel's words, reads again and asks the window to
 * read the thread again. The people are the prototype's demo people; nothing here is a real row.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessageContact } from '../../lib/changeOrders/fromMessage'
import type { FromMessageIo, ThreadChangeOrders } from '../../lib/changeOrders/fromMessageIo'
import type { Contact } from '../../lib/contacts/kernel'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const open = { contactId: 'c-priya' as string | null, role: 'assistant' as string | null }
vi.mock('../gc/messages/useThreadWindow', () => ({
  useThreadWindow: () => ({ contactId: open.contactId, at: null, openThread: () => undefined, closeThread: () => undefined }),
}))
vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => (open.role ? { role: open.role } : null) }))

const { useChangeOrderThreadSlots } = await import('./useChangeOrderThreadSlots')

afterEach(cleanup)
beforeEach(() => {
  open.contactId = 'c-priya'
  open.role = 'assistant'
})

const PRIYA: MessageContact = { id: 'c-priya', kind: 'customer', name: 'Dr. Priya Raman', first: 'Dr. Raman' }
const line = (id: string, over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id,
  contactId: 'c-priya',
  jobId: 'project:fairoaksd',
  channel: 'text',
  direction: 'in',
  at: '2026-10-01T15:00:00Z',
  who: 'Dr. Raman',
  body: 'Can we add a sink in exam 3?',
  ...over,
})
const OLD = line('m-priya-cabinet', { body: 'And the cabinets in exam 2, please.' })
const NEW = line('m-priya-sink')

function fakeIo(contact: MessageContact | null = PRIYA): FromMessageIo & { loadThread: ReturnType<typeof vi.fn>; draft: ReturnType<typeof vi.fn> } {
  const became = new Map([['m-priya-cabinet', { id: 'co-1', number: 1, projectId: 'fairoaksd' }]])
  return {
    loadThread: vi.fn(async (): Promise<ThreadChangeOrders> => ({ contact, became })),
    loadJob: vi.fn(async (id: string) => ({ id, name: 'Fair Oaks Dental', stage: 'building' as const, lostOn: null, changeOrders: [{ number: 1 }] })),
    draft: vi.fn(async () => ({ id: 'co-2', number: 2 })),
  }
}

/** The two slots for each line, as the window draws them. */
function Harness({ io, lines }: { io: FromMessageIo; lines: readonly ThreadMessage[] }) {
  const slots = useChangeOrderThreadSlots(io)
  return (
    <>
      {lines.map((m) => (
        <div key={m.id} data-line={m.id}>
          <div data-under>{slots.underLine?.(m, { id: m.contactId } as Contact)}</div>
          <div data-window>{slots.messageWindowFirst?.(m, '')}</div>
        </div>
      ))}
    </>
  )
}

function draw(io: FromMessageIo, lines: readonly ThreadMessage[] = [OLD, NEW]) {
  const reread = vi.fn()
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <Harness io={io} lines={lines} />
    </MessagesRereadContext.Provider>,
  )
  return { reread }
}

const part = (id: string, which: 'under' | 'window') => document.querySelector(`[data-line="${id}"] [data-${which}]`)?.textContent ?? ''

describe('useChangeOrderThreadSlots', () => {
  it('chips the line that became a change order, and offers the press on a customer’s other lines', async () => {
    const io = fakeIo()
    draw(io)
    await waitFor(() => expect(part('m-priya-cabinet', 'under')).toBe('became CO 1'))
    expect(io.loadThread).toHaveBeenCalledWith('c-priya')
    expect(part('m-priya-sink', 'under')).toBe('')
    // In the message window: the chip in place of the press for the one that became CO 1, the press for the other.
    expect(part('m-priya-cabinet', 'window')).toBe('became CO 1')
    expect(part('m-priya-sink', 'window')).toBe('Start a change order')
  })

  it('offers no press on a trade partner’s thread, nor on another person’s line', async () => {
    draw(fakeIo({ ...PRIYA, id: 'c-greg', kind: 'trade', name: 'Greg Paulk', first: 'Greg' }), [line('m-greg', { contactId: 'c-greg' })])
    await waitFor(() => expect(document.querySelector('[data-line="m-greg"]')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Start a change order' })).toBeNull()
    cleanup()

    const io = fakeIo()
    draw(io, [OLD, line('m-front-desk', { contactId: 'c-front-desk' })])
    await waitFor(() => expect(part('m-priya-cabinet', 'under')).toBe('became CO 1'))
    expect(part('m-front-desk', 'window')).toBe('')
  })

  it('reads nothing and draws nothing for someone off the office team', async () => {
    open.role = 'superintendent'
    const io = fakeIo()
    draw(io)
    await new Promise((r) => setTimeout(r, 0))
    expect(io.loadThread).not.toHaveBeenCalled()
    expect(part('m-priya-cabinet', 'under')).toBe('')
    expect(screen.queryByRole('button', { name: 'Start a change order' })).toBeNull()
  })

  it('says the draft in the kernel’s words, reads again and asks the window to read the thread again', async () => {
    const io = fakeIo()
    const { reread } = draw(io)
    fireEvent.click(await screen.findByRole('button', { name: 'Start a change order' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save the draft' }))
    expect(await screen.findByText('Change order 2 is drafted on Fair Oaks Dental. The money team prices it and sends it to sign.')).toBeTruthy()
    expect(io.draft).toHaveBeenCalledWith('m-priya-sink', expect.objectContaining({ description: 'Can we add a sink in exam 3?', reason: 'owner' }))
    await waitFor(() => expect(io.loadThread).toHaveBeenCalledTimes(2))
    expect(reread).toHaveBeenCalledTimes(1)
  })
})
