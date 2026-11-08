// @vitest-environment jsdom
/**
 * My email's door on the bid (punch list #263 PR A, v2.6730): the slot above the box draws the line only while the
 * thread is narrowed to a job, searched on the person's email channels and the tile's number; Yes asks the page to
 * read the thread again; the door to the tab closes the thread first. Rusty and BP523 are made up.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { MyMailRow } from '../../lib/myMail/contract'
import type { JobDoorIo } from '../../lib/myMail/jobDoorIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OpenThreadContext, type OpenThread } from '../gc/messages/openThread'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const window = { closeThread: vi.fn(), openThread: vi.fn() }
vi.mock('../gc/messages/useThreadWindow', () => ({
  useThreadWindow: () => ({ contactId: 'c-rusty', at: null, nudge: null, reply: null, openThread: window.openThread, closeThread: window.closeThread }),
}))
const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useNavigate: () => navigate }
})

const { useMyMailJobLineThreadSlots } = await import('./useMyMailJobLineThreadSlots')

afterEach(cleanup)

const BID_ID = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a02'
const HARBOR = `bid:${BID_ID}`
const RUSTY: Contact = {
  id: 'c-rusty',
  kind: 'gc_person',
  name: 'Rusty Vale',
  goesBy: null,
  channels: [
    { id: 'ch-1', kind: 'phone', value: '+12105550123', optedOutAt: null },
    { id: 'ch-2', kind: 'email', value: 'rusty@harborgc.example', optedOutAt: null },
  ],
} as unknown as Contact
const ROW: MyMailRow = {
  gmailId: 'm1',
  threadId: 't-harbor',
  direction: 'in',
  who: { name: 'Rusty Vale', address: 'rusty@harborgc.example' },
  subject: 'Harbor Club pay app 3',
  snippet: '',
  at: '2026-11-08T15:12:00Z',
  files: 0,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
}
const thread = (jobFilter: string | null): OpenThread => ({
  contact: RUSTY,
  lines: [],
  jobFilter,
  rail: [HARBOR],
  tiles: { [HARBOR]: { key: HARBOR, kind: 'bid', num: 'BP523', name: 'Harbor Club' } as OpenThread['tiles'][string] },
  userNames: {},
  nowIso: '2026-11-08T18:00:00Z',
  searchJobs: async () => [],
})

function Slot({ io }: { io: JobDoorIo }) {
  const slots = useMyMailJobLineThreadSlots(io)
  return <>{slots.aboveBox?.(RUSTY)}</>
}

function fakeIo(): JobDoorIo {
  return {
    addresses: vi.fn(async () => []),
    read: vi.fn(async (addresses: readonly string[], num: string | null) => ({ query: `from:${addresses.join(',')} OR "${num}"`, rows: [ROW] })),
    tag: vi.fn(async () => ({ ok: true as const, jobKey: HARBOR, lines: 1, tied: 0, files: 0, contactId: 'c-rusty', unknownSender: null })),
  }
}

function draw(jobFilter: string | null, io: JobDoorIo, reread = vi.fn()) {
  return renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <OpenThreadContext.Provider value={thread(jobFilter)}>
        <Slot io={io} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
}

describe('useMyMailJobLineThreadSlots', () => {
  it('draws the line above the box while the thread is narrowed to a job, searched on the person’s email channels and the tile’s number', async () => {
    const io = fakeIo()
    draw(HARBOR, io)
    await screen.findByTestId('my-mail-job-line')
    expect(io.read).toHaveBeenCalledWith(['rusty@harborgc.example'], 'BP523')
    expect(screen.getByTestId('my-mail-job-line').getAttribute('aria-label')).toBe('Your mail with Rusty Vale')
    expect(screen.getByRole('button', { name: 'Yes' }).getAttribute('title')).toBe('Put this conversation on BP523.')
  })

  it('draws nothing while the thread shows every job', async () => {
    const io = fakeIo()
    draw(null, io)
    await new Promise((r) => setTimeout(r, 10))
    expect(io.read).not.toHaveBeenCalled()
    expect(screen.queryByTestId('my-mail-job-line')).toBeNull()
  })

  it('tags onto the bid on Yes and asks the page to read the thread again; the door to the tab closes the thread first', async () => {
    const io = fakeIo()
    const reread = vi.fn()
    draw(HARBOR, io, reread)
    await screen.findByTestId('my-mail-job-line')
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(reread).toHaveBeenCalledTimes(1))
    expect(io.tag).toHaveBeenCalledWith('t-harbor', { kind: 'bid', id: BID_ID })
    // The conversation landed on this very thread: the door opens no other.
    fireEvent.click(screen.getByRole('button', { name: 'open the thread ›' }))
    expect(window.openThread).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('my-mail-job-line-door'))
    expect(window.closeThread).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/messages?tab=my-email&q=from%3Arusty%40harborgc.example+OR+%22BP523%22')
  })
})
