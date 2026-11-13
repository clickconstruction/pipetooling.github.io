// @vitest-environment jsdom
/**
 * Messages, the email viewer's action row (v2.6509): the presses the window's first slot draws for a line, over a fake
 * io. An invitation to bid, or an email on no job, has *Start a bid* and *Put it on a bid…*; a line on a bid has *Open
 * the bid*; a line on a GC project has none of these (cut 4b's change order is its own hook's). Start a bid opens the
 * panel with the bid's name read from the subject and the contact's customer as the one press, then starts the bid,
 * says so and opens the Bid Board; Put it on a bid opens the picker over the open bids, ties the line and writes the
 * log line in the kernel's words. Someone off the office team sees none of it. The people are made up; nothing here is
 * a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { EmailViewerIo } from '../../lib/messages/emailViewerActionsIo'
import type { JobTile } from '../../lib/messages/jobTiles'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OpenThreadContext, type OpenThread } from '../gc/messages/openThread'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const open = { role: 'estimator' as string | null, closed: 0 }
vi.mock('../gc/messages/useThreadWindow', () => ({
  useThreadWindow: () => ({ contactId: 'c-glenn', at: null, openThread: () => undefined, closeThread: () => void open.closed++ }),
}))
vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => (open.role ? { role: open.role, user: { id: 'u-wendi' } } : null) }))
const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useNavigate: () => navigate }
})

const { useEmailViewerThreadSlots } = await import('./useEmailViewerThreadSlots')

afterEach(cleanup)
beforeEach(() => {
  open.role = 'estimator'
  open.closed = 0
  navigate.mockClear()
})

const GLENN: Contact = {
  id: 'c-glenn',
  kind: 'customer',
  name: 'Glenn Gelwin',
  goesBy: null,
  company: 'Marrex Builders',
  record: { table: 'customers', id: 'cust-marrex' },
  channels: [{ id: 'ch-1', kind: 'email', value: 'glenn@marrexbuilders.example', optedOutAt: null }],
  jobIds: ['bid:b-oak'],
  defaultJobId: null,
  customerId: 'cust-marrex',
}
const OAK: JobTile = { key: 'bid:b-oak', kind: 'bid', num: 'B512', name: 'Oak Hill Clinic', day: { words: 'bid due Thu Nov 12 · 8 days', tone: 'soon' } }
const ELM: JobTile = { key: 'bid:b-elm', kind: 'bid', num: 'B520', name: 'Elm Street Shell', day: { words: 'no due day', tone: '' } }

const SUBJECT = 'Northeast Bible Church Elementary Building @ San Antonio - Invitation to Bid'
const line = (id: string, over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id,
  contactId: 'c-glenn',
  jobId: null,
  channel: 'email',
  direction: 'in',
  at: '2026-10-22T15:08:00Z',
  who: 'Glenn Gelwin',
  subject: SUBJECT,
  body: 'Wendi,\n\nWe would like to invite you to submit a bid for the following:\n\nScope of Work: Plumbing\nDeadline: Monday, November 02, 2026, 3:00 PM',
  invitation: { kind: 'invitation', project: 'Northeast Bible Church Elementary Building', due: { date: '2026-11-02', time: '15:00' }, portal: null, cue: 'invitation to bid' },
  ...over,
})

function fakeIo(): EmailViewerIo & { startBid: ReturnType<typeof vi.fn>; putOnBid: ReturnType<typeof vi.fn>; searchOpenBids: ReturnType<typeof vi.fn> } {
  return {
    loadKnown: vi.fn(async () => ({})),
    name: vi.fn(async () => 'c-glenn'),
    makeCustomerRecord: vi.fn(async () => 'cust-new'),
    startBid: vi.fn(async () => ({ bidId: 'b-new', bidNumber: '531', customer: 'Marrex Builders' })),
    searchOpenBids: vi.fn(async (words: string) => [OAK, ELM].filter((t) => t.name.toLowerCase().includes(words.toLowerCase()))),
    putOnBid: vi.fn(async () => undefined),
  }
}

function Harness({ io, lines }: { io: EmailViewerIo; lines: readonly ThreadMessage[] }) {
  const slots = useEmailViewerThreadSlots(io)
  return (
    <>
      {lines.map((m) => (
        <div key={m.id} data-line={m.id} style={{ display: 'flex', flexWrap: 'wrap' }}>
          {slots.messageWindowFirst?.(m, '')}
        </div>
      ))}
    </>
  )
}

function draw(io: EmailViewerIo, lines: readonly ThreadMessage[], contact: Contact | null = GLENN) {
  const reread = vi.fn()
  const thread: OpenThread | null = contact
    ? { contact, lines, jobFilter: null, rail: contact.jobIds, tiles: { 'bid:b-oak': OAK }, userNames: {}, nowIso: '2026-11-04T15:00:00Z', searchJobs: async () => [] }
    : null
  renderWithProviders(
    <MessagesRereadContext.Provider value={reread}>
      <OpenThreadContext.Provider value={thread}>
        <Harness io={io} lines={lines} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  return { reread }
}

const buttonsOf = (id: string) => [...(document.querySelector(`[data-line="${id}"]`)?.querySelectorAll('button') ?? [])].map((b) => b.textContent)

describe('useEmailViewerThreadSlots: the email viewer’s row', () => {
  it('an invitation has Start a bid and Put it on a bid; an email on no job too; a bid’s line has Open the bid; a project’s line nothing here', () => {
    draw(fakeIo(), [line('m-itb'), line('m-plain', { invitation: null, subject: 'Re: fixture schedule', body: 'Can you send the schedule?' }), line('m-on-bid', { jobId: 'bid:b-oak' }), line('m-on-job', { jobId: 'project:p-church', invitation: null, subject: 'Re: exam 3 sink', body: 'Can we add a sink in exam 3?' })])
    expect(buttonsOf('m-itb')).toEqual(['Start a bid', 'Put it on a bid…'])
    expect(buttonsOf('m-plain')).toEqual(['Start a bid', 'Put it on a bid…'])
    expect(buttonsOf('m-on-bid')).toEqual(['Open the bid'])
    expect(buttonsOf('m-on-job')).toEqual([])
    expect(screen.getAllByRole('button', { name: 'Put it on a bid…' })[0]!.getAttribute('title')).toBe('Ties this email to a bid you already have and writes it on the bid’s history, so the bid says it came in from here too.')
  })

  it('an invitation on a job still offers the bid presses, and not the change order', () => {
    draw(fakeIo(), [line('m-itb-on-job', { jobId: 'pipeline:j-579' })])
    expect(buttonsOf('m-itb-on-job')).toEqual(['Start a bid', 'Put it on a bid…'])
  })

  it('Start a bid: the name read from the subject, the contact’s customer as the press; the bid starts, the toast says so, the Bid Board opens', async () => {
    const io = fakeIo()
    const { reread } = draw(io, [line('m-itb')])
    fireEvent.click(screen.getByRole('button', { name: 'Start a bid' }))
    const panel = document.querySelector('[data-start-bid-panel]') as HTMLElement
    expect((within(panel).getByRole('textbox') as HTMLInputElement).value).toBe('Northeast Bible Church Elementary Building')
    expect(within(panel).queryByText('Make the customer and start the bid')).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: 'Start a bid on Marrex Builders' }))
    await waitFor(() => expect(io.startBid).toHaveBeenCalledWith('m-itb', { customerId: 'cust-marrex', projectName: 'Northeast Bible Church Elementary Building', dueDate: '2026-11-02', dueTime: '15:00', links: [] }))
    expect(await screen.findByText('Bid b531 is started on Marrex Builders: Northeast Bible Church Elementary Building. The thread is on it.')).toBeTruthy()
    expect(reread).toHaveBeenCalledTimes(1)
    expect(open.closed).toBe(1)
    expect(navigate).toHaveBeenCalledWith('/bids?tab=bid-board&bidId=b-new')
    expect(io.name).not.toHaveBeenCalled()
  })

  it('Start a bid on a sender nobody has named: a new customer from the domain, made and named by the press', async () => {
    const io = fakeIo()
    const unknown: Contact = { ...GLENN, kind: 'unknown', name: 'glenn@marrexbuilders.example', company: '', record: null, customerId: null, jobIds: [] }
    draw(io, [line('m-itb', { who: 'glenn@marrexbuilders.example' })], unknown)
    fireEvent.click(screen.getByRole('button', { name: 'Start a bid' }))
    const panel = document.querySelector('[data-start-bid-panel]') as HTMLElement
    await waitFor(() => expect(io.loadKnown).toHaveBeenCalled())
    const fields = within(panel).getAllByRole('textbox') as HTMLInputElement[]
    expect(fields.map((f) => f.value)).toEqual(['Northeast Bible Church Elementary Building', 'Marrexbuilders'])
    fireEvent.change(fields[1]!, { target: { value: 'Marrex Builders' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Make the customer and start the bid' }))
    await waitFor(() => expect(io.startBid).toHaveBeenCalledWith('m-itb', expect.objectContaining({ customerId: 'cust-new' })))
    expect(io.makeCustomerRecord).toHaveBeenCalledWith('c-glenn', { customerName: 'Marrex Builders', personName: null, email: 'glenn@marrexbuilders.example', phone: null, customerType: 'commercial' }, { userId: 'u-wendi' }, expect.any(String))
    expect(io.name).toHaveBeenCalledWith('c-glenn', expect.objectContaining({ kind: 'customer', record: { table: 'customers', id: 'cust-new' } }))
  })

  it('Put it on a bid: the picker over their bids and the open bids found by name; the pick ties the line and writes the log line in the kernel’s words', async () => {
    const io = fakeIo()
    const { reread } = draw(io, [line('m-itb')])
    fireEvent.click(screen.getByRole('button', { name: 'Put it on a bid…' }))
    const picker = screen.getByRole('dialog', { name: 'Put it on a bid' })
    expect(within(picker).getByText('Their jobs')).toBeTruthy()
    expect(within(picker).queryByRole('button', { name: 'On the person, no job' })).toBeNull()
    fireEvent.change(within(picker).getByRole('textbox'), { target: { value: 'elm' } })
    const elm = await within(picker).findByRole('button', { name: /B520 Elm Street Shell/ })
    expect(io.searchOpenBids).toHaveBeenCalledWith('elm')
    fireEvent.click(elm)
    await waitFor(() => expect(io.putOnBid).toHaveBeenCalledWith('m-itb', 'b-elm', 'Invitation to bid came in by email from Glenn Gelwin, Oct 22.'))
    expect(await screen.findByText('Put on B520 Elm Street Shell. Its history says it came in by email.')).toBeTruthy()
    expect(reread).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Put it on a bid' })).toBeNull()
  })

  it('a plain email’s log line names its subject', async () => {
    const io = fakeIo()
    draw(io, [line('m-plain', { invitation: null, subject: 'Re: fixture schedule', body: 'Can you send the schedule?' })])
    fireEvent.click(screen.getByRole('button', { name: 'Put it on a bid…' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Put it on a bid' })).getByRole('button', { name: /B512 Oak Hill Clinic/ }))
    await waitFor(() => expect(io.putOnBid).toHaveBeenCalledWith('m-plain', 'b-oak', 'An email came in from Glenn Gelwin, Oct 22: Re: fixture schedule.'))
  })

  it('a refusal keeps its words under the tools', async () => {
    const io = fakeIo()
    io.putOnBid.mockRejectedValueOnce(new Error('Tie the email to the bid first.'))
    draw(io, [line('m-itb')])
    fireEvent.click(screen.getByRole('button', { name: 'Put it on a bid…' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Put it on a bid' })).getByRole('button', { name: /B512 Oak Hill Clinic/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('Tie the email to the bid first.')
  })

  it('Open the bid closes the thread and opens the Bid Board on it', () => {
    draw(fakeIo(), [line('m-on-bid', { jobId: 'bid:b-oak' })])
    fireEvent.click(screen.getByRole('button', { name: 'Open the bid' }))
    expect(open.closed).toBe(1)
    expect(navigate).toHaveBeenCalledWith('/bids?tab=bid-board&bidId=b-oak')
  })

  it('draws nothing for someone off the office team', () => {
    open.role = 'superintendent'
    draw(fakeIo(), [line('m-itb'), line('m-on-bid', { jobId: 'bid:b-oak' })])
    expect(document.querySelectorAll('button').length).toBe(0)
  })
})
