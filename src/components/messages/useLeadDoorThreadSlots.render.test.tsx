// @vitest-environment jsdom
/**
 * Punch list #140 PR 8: a lead's doors above the words of their thread. Over a fake io: a lead gets Book a visit and
 * Start an estimate with the hint, a customer gets nothing; Book a visit makes the customer from the thread's facts,
 * says so, asks the page to read again and opens Add Job filled in; Start an estimate makes the customer, closes the
 * thread and lands on the new estimate; a lead with no name is refused in words and nothing is made.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Contact } from '../../lib/contacts/kernel'
import { LEAD_DOOR_WORDS } from '../../lib/messages/leadDoors'
import type { LeadDoorsIo } from '../../lib/messages/leadDoorsIo'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OpenThreadContext, type OpenThread } from '../gc/messages/openThread'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'
import { useLeadDoorThreadSlots } from './useLeadDoorThreadSlots'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
const jobForm = vi.hoisted(() => ({ openNewJob: vi.fn() }))
vi.mock('../../contexts/JobFormModalContext', () => ({ useJobFormModal: () => ({ isOpen: false, openNewJob: jobForm.openNewJob, openEditJob: vi.fn(), closeJobForm: vi.fn() }) }))
const router = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => router.navigate }))
const win = vi.hoisted(() => ({ closeThread: vi.fn() }))
vi.mock('../gc/messages/useThreadWindow', () => ({ useThreadWindow: () => ({ contactId: 'lena', at: null, openThread: vi.fn(), closeThread: win.closeThread }) }))

const channel = (kind: 'phone' | 'email', value: string): Contact['channels'][number] => ({ id: `ch-${kind}`, kind, value, optedOutAt: null })
const LENA: Contact = { id: 'lena', kind: 'lead', name: 'Lena Ortiz', goesBy: null, company: '', record: null, channels: [channel('phone', '(830) 555-0101')], jobIds: [], defaultJobId: null }
const NUMBER: Contact = { ...LENA, id: 'num', name: '(830) 555-0199', channels: [channel('phone', '(830) 555-0199')] }
const DANA: Contact = { ...LENA, id: 'dana', kind: 'customer', name: 'Dana Whitfield', record: { table: 'customers', id: 'cust-dana' } }

const line = (id: string, contactId: string, direction: 'in' | 'out', at: string, body: string): ThreadMessage =>
  ({ id, contactId, channel: 'text', direction, at, who: direction === 'in' ? 'Lena' : 'Rosa', body, files: [] }) as unknown as ThreadMessage

const LINES: ThreadMessage[] = [line('1', 'lena', 'in', '2026-10-20T15:00:00.000Z', 'Is this the plumbing office?'), line('2', 'lena', 'out', '2026-10-20T15:05:00.000Z', 'It is.'), line('3', 'lena', 'in', '2026-10-21T09:00:00.000Z', 'Can you come Thursday?')]

const fakeIo = (over: Partial<LeadDoorsIo> = {}): LeadDoorsIo => ({
  convert: vi.fn(async () => ({ customerId: 'cust-1' })),
  startEstimate: vi.fn(async () => ({ estimateNumber: 42 })),
  ...over,
})

function Harness({ io, contact }: { io: LeadDoorsIo; contact: Contact }) {
  const slots = useLeadDoorThreadSlots(io)
  return <div data-testid="above">{slots.aboveLines?.(contact, { openWho: () => undefined, showContact: () => undefined })}</div>
}

function draw(contact: Contact, io = fakeIo()) {
  const reread = vi.fn()
  const open: OpenThread = { contact, lines: LINES, jobFilter: null, rail: [], tiles: {}, userNames: {}, nowIso: '2026-10-21T10:00:00.000Z', searchJobs: vi.fn(async () => []) }
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <OpenThreadContext.Provider value={open}>
        <Harness io={io} contact={contact} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  return { io, reread }
}

afterEach(() => {
  cleanup()
  jobForm.openNewJob.mockClear()
  router.navigate.mockClear()
  win.closeThread.mockClear()
})

describe('a lead’s doors above the thread (punch list #140 PR 8)', () => {
  it('a lead gets the two doors and the hint; a customer gets nothing', () => {
    draw(LENA)
    expect(screen.getByRole('button', { name: LEAD_DOOR_WORDS.book })).toBeTruthy()
    expect(screen.getByRole('button', { name: LEAD_DOOR_WORDS.estimate })).toBeTruthy()
    expect(screen.getByText(LEAD_DOOR_WORDS.hint)).toBeTruthy()
    cleanup()
    draw(DANA)
    expect(screen.queryByRole('button', { name: LEAD_DOOR_WORDS.book })).toBeNull()
  })

  it('Book a visit makes the customer from the thread, says so, reads again and opens Add Job filled in', async () => {
    const { io, reread } = draw(LENA)
    fireEvent.click(screen.getByRole('button', { name: LEAD_DOOR_WORDS.book }))
    await waitFor(() => expect(io.convert).toHaveBeenCalledTimes(1))
    expect(io.convert).toHaveBeenCalledWith('lena', { contactId: 'lena', name: 'Lena Ortiz', phone: '(830) 555-0101', email: null, words: 'Can you come Thursday?' }, { userId: expect.any(String) }, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(await screen.findByText('Lena is a customer now. The thread came with them.')).toBeTruthy()
    expect(reread).toHaveBeenCalled()
    expect(jobForm.openNewJob).toHaveBeenCalledWith({ prefillCustomer: { name: 'Lena Ortiz', phone: '(830) 555-0101', email: null, note: 'Can you come Thursday?' }, onSaved: reread })
    expect(router.navigate).not.toHaveBeenCalled()
  })

  it('Start an estimate makes the customer, closes the thread and lands on the new estimate', async () => {
    const { io } = draw(LENA)
    fireEvent.click(screen.getByRole('button', { name: LEAD_DOOR_WORDS.estimate }))
    await waitFor(() => expect(io.startEstimate).toHaveBeenCalledWith('cust-1', { userId: expect.any(String), role: 'assistant' }))
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/estimates/42', { state: { freshEstimateDraft: true } }))
    expect(win.closeThread).toHaveBeenCalled()
    expect(jobForm.openNewJob).not.toHaveBeenCalled()
  })

  it('a lead nobody has named is refused in words, and nothing is made', async () => {
    const { io } = draw(NUMBER)
    fireEvent.click(screen.getByRole('button', { name: LEAD_DOOR_WORDS.book }))
    expect(await screen.findByText(LEAD_DOOR_WORDS.noName)).toBeTruthy()
    expect(io.convert).not.toHaveBeenCalled()
    expect(jobForm.openNewJob).not.toHaveBeenCalled()
  })

  it('a refused customer row keeps the lead and says why', async () => {
    const io = fakeIo({ convert: vi.fn(async () => Promise.reject(new Error('Only the office team can name the number.'))) })
    draw(LENA, io)
    fireEvent.click(screen.getByRole('button', { name: LEAD_DOOR_WORDS.book }))
    expect(await screen.findByText('Only the office team can name the number.')).toBeTruthy()
    expect(jobForm.openNewJob).not.toHaveBeenCalled()
  })
})
