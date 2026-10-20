// @vitest-environment jsdom
/**
 * Messages, residential R8 · 8's screens: the estimate line slots inside a thread window, over a fake io. For the
 * office, a line that is on an estimate carries its *a line on estimate 1044* chip, and a customer's own line on a
 * Pipeline job has *Line on the estimate* in its message window, which a line on an estimate trades for the chip. A
 * line on a GC job or on the person, a trade partner's thread, another person's line and someone off the office team
 * get none of it. A saved line says the kernel's words, reads again and asks the window to read the thread again. Dana
 * and her Helotes job are the mockups' demo people; nothing here is a real row.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { LineFromMessageIo, LineThreadContact, ThreadEstimateLines } from '../../lib/estimates/lineFromMessageIo'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const open = { contactId: 'c-dana' as string | null, role: 'assistant' as string | null }
vi.mock('../gc/messages/useThreadWindow', () => ({
  useThreadWindow: () => ({ contactId: open.contactId, at: null, openThread: () => undefined, closeThread: () => undefined }),
}))
vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => (open.role ? { role: open.role } : null) }))

const { useEstimateLineThreadSlots } = await import('./useEstimateLineThreadSlots')

afterEach(cleanup)
beforeEach(() => {
  open.contactId = 'c-dana'
  open.role = 'assistant'
})

const DANA: LineThreadContact = { id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', first: 'Dana', customerId: 'cust-dana' }
const line = (id: string, over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id,
  contactId: 'c-dana',
  jobId: 'pipeline:j-helotes',
  channel: 'text',
  direction: 'in',
  at: '2026-10-12T21:05:00Z',
  who: 'Dana',
  body: 'While you are here can you also replace the hose bib out front?',
  ...over,
})
const HEATER = line('m-heater', { body: 'And the water heater is making noise.' })
const BIB = line('m-hose-bib')

function fakeIo(contact: LineThreadContact | null = DANA): LineFromMessageIo & { loadThread: ReturnType<typeof vi.fn>; draft: ReturnType<typeof vi.fn> } {
  const became = new Map([['m-heater', { estimateId: 'e-1044', estimateNumber: 1044 }]])
  return {
    loadThread: vi.fn(async (): Promise<ThreadEstimateLines> => ({ contact, became })),
    loadJob: vi.fn(async (id: string) => ({
      job: { id, name: 'Helotes', status: 'working', customerId: 'cust-dana' },
      estimates: [{ id: 'e-1044', jobId: id, docKind: 'estimate', status: 'draft', number: 1044, lines: [], seenAt: '2026-10-12T20:00:00Z', hasOptions: false }],
    })),
    draft: vi.fn(async () => ({ estimateId: 'e-1044', estimateNumber: 1044, lineNumber: 2 })),
  }
}

/** The two slots for each line, as the window draws them. */
function Harness({ io, lines }: { io: LineFromMessageIo; lines: readonly ThreadMessage[] }) {
  const slots = useEstimateLineThreadSlots(io)
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

function draw(io: LineFromMessageIo, lines: readonly ThreadMessage[] = [HEATER, BIB]) {
  const reread = vi.fn()
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <Harness io={io} lines={lines} />
    </MessagesRereadContext.Provider>,
  )
  return { reread }
}

const part = (id: string, which: 'under' | 'window') => document.querySelector(`[data-line="${id}"] [data-${which}]`)?.textContent ?? ''

describe('useEstimateLineThreadSlots', () => {
  it('chips the line that is on an estimate, and offers the press on a customer’s other lines on a Pipeline job', async () => {
    const io = fakeIo()
    draw(io)
    await waitFor(() => expect(part('m-heater', 'under')).toBe('a line on estimate 1044'))
    expect(io.loadThread).toHaveBeenCalledWith('c-dana')
    expect(part('m-hose-bib', 'under')).toBe('')
    expect(part('m-heater', 'window')).toBe('a line on estimate 1044')
    expect(part('m-hose-bib', 'window')).toBe('Line on the estimate')
  })

  it('offers no press on a GC job’s line or a line on the person, a trade partner’s thread, or another person’s line', async () => {
    const io = fakeIo()
    draw(io, [HEATER, line('m-gc', { jobId: 'project:fairoaksd' }), line('m-person', { jobId: null }), line('m-front-desk', { contactId: 'c-front-desk' })])
    await waitFor(() => expect(part('m-heater', 'under')).toBe('a line on estimate 1044'))
    expect(part('m-gc', 'window')).toBe('')
    expect(part('m-person', 'window')).toBe('')
    expect(part('m-front-desk', 'window')).toBe('')
    cleanup()

    draw(fakeIo({ ...DANA, id: 'c-greg', kind: 'trade', name: 'Greg Paulk', first: 'Greg' }), [line('m-greg', { contactId: 'c-greg' })])
    await waitFor(() => expect(document.querySelector('[data-line="m-greg"]')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Line on the estimate' })).toBeNull()
  })

  it('reads nothing and draws nothing for someone off the office team', async () => {
    open.role = 'superintendent'
    const io = fakeIo()
    draw(io)
    await new Promise((r) => setTimeout(r, 0))
    expect(io.loadThread).not.toHaveBeenCalled()
    expect(part('m-heater', 'under')).toBe('')
    expect(screen.queryByRole('button', { name: 'Line on the estimate' })).toBeNull()
  })

  it('says the line in the kernel’s words, reads again and asks the window to read the thread again', async () => {
    const io = fakeIo()
    const { reread } = draw(io)
    fireEvent.click(await screen.findByRole('button', { name: 'Line on the estimate' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save the line' }))
    expect(await screen.findByText('Line 2 is drafted on estimate 1044 for Helotes. The money team prices it and sends it.')).toBeTruthy()
    expect(io.draft).toHaveBeenCalledWith('m-hose-bib', expect.objectContaining({ estimateId: 'e-1044', seenAt: '2026-10-12T20:00:00Z' }))
    await waitFor(() => expect(io.loadThread).toHaveBeenCalledTimes(2))
    expect(reread).toHaveBeenCalledTimes(1)
  })
})
