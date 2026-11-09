// @vitest-environment jsdom
/**
 * My email's Sent side (punch list #263 PR B, v2.6751): under a line the app put on the job the slot draws *from Wendi's
 * mail · put here by the app*, with Untag for the person whose mail it is alone; Untag asks once, calls gmail-mine's
 * untag on the conversation and asks the page to read the thread again; a refusal shows the function's words; nothing
 * under any other line. Wendi and Rusty are made up.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { ThreadMessage } from '../../lib/messages/thread'
import type { MyMailIo } from '../../lib/myMail/myMailIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OpenThreadContext, type OpenThread } from '../gc/messages/openThread'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const auth = { id: 'u-wendi' as string | null }
vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => (auth.id ? { user: { id: auth.id } } : null) }))

const { useMyMailPlacedLineThreadSlots } = await import('./useMyMailPlacedLineThreadSlots')

afterEach(cleanup)
beforeEach(() => {
  auth.id = 'u-wendi'
})

const RUSTY = { id: 'c-rusty', kind: 'gc_person', name: 'Rusty Vale', goesBy: null, channels: [] } as unknown as Contact
const line = (over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'm-placed',
  contactId: 'c-rusty',
  jobId: 'bid:b-harbor',
  channel: 'email',
  direction: 'out',
  at: '2026-11-08T15:12:00Z',
  who: 'Wendi Cole to Rusty Vale · from Wendi Cole’s mail',
  subject: 'Harbor Club pay app 3',
  body: 'Attached.',
  placedByApp: true,
  mailUserId: 'u-wendi',
  gmailThreadId: 't-harbor',
  ...over,
})
const thread: OpenThread = { contact: RUSTY, lines: [], jobFilter: null, rail: [], tiles: {}, userNames: { 'u-wendi': 'Wendi Cole' }, nowIso: '2026-11-08T18:00:00Z', searchJobs: async () => [] }

function Slot({ message, io }: { message: ThreadMessage; io: Pick<MyMailIo, 'untag'> }) {
  const slots = useMyMailPlacedLineThreadSlots(io)
  return <>{slots.underLine?.(message, RUSTY)}</>
}

function draw(message: ThreadMessage, io: Pick<MyMailIo, 'untag'>, reread = vi.fn()) {
  return renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <OpenThreadContext.Provider value={thread}>
        <Slot message={message} io={io} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
}

describe('useMyMailPlacedLineThreadSlots', () => {
  it('draws the mark with the person’s name and Untag for them, and nothing under a line the app did not place', () => {
    const io = { untag: vi.fn() }
    draw(line(), io)
    expect(screen.getByText('from Wendi Cole\'s mail · put here by the app')).toBeTruthy()
    expect(screen.getByTestId('placed-untag-m-placed').textContent).toBe('Untag')
    cleanup()
    draw(line({ placedByApp: false }), io)
    expect(screen.queryByText(/put here by the app/)).toBeNull()
  })

  it('shows the mark without Untag to anyone else', () => {
    auth.id = 'u-rosa'
    draw(line(), { untag: vi.fn() })
    expect(screen.getByText(/put here by the app/)).toBeTruthy()
    expect(screen.queryByTestId('placed-untag-m-placed')).toBeNull()
  })

  it('asks once, untags the conversation and asks the page to read the thread again; a refusal shows its words', async () => {
    const io = { untag: vi.fn(async () => ({ ok: true as const, removed: 2, keptForMatter: false, held: 0, labelLeft: 0 })) }
    const reread = vi.fn()
    draw(line(), io, reread)
    fireEvent.click(screen.getByTestId('placed-untag-m-placed'))
    // The confirm window's button carries the verb.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Untag', hidden: true })).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Untag', hidden: true }).slice(-1)[0]!)
    await waitFor(() => expect(reread).toHaveBeenCalledTimes(1))
    expect(io.untag).toHaveBeenCalledWith({ threadId: 't-harbor' })
    cleanup()
    const refused = { untag: vi.fn(async () => ({ ok: false as const, error: 'readOnly' as const, words: 'A training, sample or robot account cannot read mail here.' })) }
    draw(line(), refused)
    fireEvent.click(screen.getByTestId('placed-untag-m-placed'))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Untag', hidden: true })).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Untag', hidden: true }).slice(-1)[0]!)
    expect((await screen.findByRole('alert')).textContent).toBe('A training, sample or robot account cannot read mail here.')
  })
})
