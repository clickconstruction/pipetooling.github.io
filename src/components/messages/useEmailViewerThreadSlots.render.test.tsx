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

// The bid's press reads the line's files itself (its own render test); here it stands in as what it was handed.
vi.mock('../bids/BidMailSetDoor', () => ({
  BidMailSetDoor: (p: { bidId: string; bidLabel: string; messageId: string; mail: { subject: string | null; who: string; at: string } }) => (
    <span data-bid-door>{`${p.bidLabel}|${p.bidId}|${p.messageId}|${p.mail.subject}`}</span>
  ),
}))

// The job's paper press reads the job itself (its own render test); here it stands in as what it was handed.
vi.mock('../papers/MailPaperDoor', () => ({
  MailPaperDoor: (p: { jobId: string; jobLabel: string; subject: string; senderAddress: string | null; messageId: string | null; mailFileCount: number; mailLinks?: ReadonlyArray<string> }) => (
    <span data-paper-door data-links={(p.mailLinks ?? []).join(' ')}>{`${p.jobLabel}|${p.jobId}|${p.messageId}|${p.subject}|${p.senderAddress}|${p.mailFileCount}`}</span>
  ),
}))

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

const SUBJECT = 'Northeast Barlow Church Elementary Building @ San Antonio - Invitation to Bid'
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

  it('an email on a bid that carries a file gets the bid’s press, handed the bid, its number and the line (punch list #368)', () => {
    const pdf = { id: 'f1', name: 'specs.pdf', mime: 'application/pdf', size: 1000, kept: 'copy' as const, url: null, icon: 'pdf' as const, paper: null, paperAnswer: null, paperAnsweredBy: null, paperAnsweredAt: null }
    const link = { ...pdf, id: 'f2', name: 'Dropbox', kept: 'link' as const, url: 'https://example.com/x', icon: 'link' as const }
    draw(fakeIo(), [line('m-files', { jobId: 'bid:b-oak', invitation: null, subject: 'Re: Addendum 2', files: [pdf, link] }), line('m-link-only', { jobId: 'bid:b-oak', invitation: null, files: [link] }), line('m-no-file', { jobId: 'bid:b-oak', invitation: null })])
    expect(document.querySelector('[data-line="m-files"] [data-bid-door]')!.textContent).toBe('B512|b-oak|m-files|Re: Addendum 2')
    expect(buttonsOf('m-files')).toEqual(['Open the bid'])
    // A link is no file to keep, and a mail with no file is already on the bid's history.
    cleanup()
    // Nor is a signature's picture: most mail carries one, and the press would show on all of it (v2.7556).
    draw(fakeIo(), [line('m-logo', { jobId: 'bid:b-oak', invitation: null, files: [{ ...pdf, id: 'f3', name: 'image001.png', mime: 'image/png', icon: 'image' as const }] }), line('m-link-only', { jobId: 'bid:b-oak', invitation: null, files: [link] }), line('m-no-file', { jobId: 'bid:b-oak', invitation: null })])
    expect(document.querySelector('[data-line="m-logo"] [data-bid-door]')).toBeNull()
    expect(buttonsOf('m-logo')).toEqual(['Open the bid'])
    expect(document.querySelector('[data-line="m-link-only"] [data-bid-door]')).toBeNull()
    expect(document.querySelector('[data-line="m-no-file"] [data-bid-door]')).toBeNull()
  })

  it('an email on a Pipeline job that carries a file gets the job’s paper press on its own row, handed the job, the line and the sender (punch list #368, PR 4)', () => {
    const pdf = { id: 'f1', name: 'spec-book.pdf', mime: 'application/pdf', size: 1000, kept: 'copy' as const, url: null, icon: 'pdf' as const, paper: null, paperAnswer: null, paperAnsweredBy: null, paperAnsweredAt: null }
    draw(fakeIo(), [line('m-job-file', { jobId: 'pipeline:j-579', invitation: null, subject: 'Spec book', files: [pdf] }), line('m-job-bare', { jobId: 'pipeline:j-579', invitation: null })])
    const door = document.querySelector('[data-line="m-job-file"] [data-keep-paper] [data-paper-door]')!
    // The thread has no tile for this job, so the press names it the job; the sender is the thread's own address.
    expect(door.textContent).toBe('the job|j-579|m-job-file|Spec book|glenn@marrexbuilders.example|1')
    expect(document.querySelector('[data-line="m-job-bare"] [data-paper-door]')).toBeNull()
  })

  it('Gmail’s picture of a Drive link earns a job’s email no paper press; the link itself does, and is handed to the form once (v2.7954, v2.7973)', () => {
    const pdf = { id: 'f1', name: 'spec-book.pdf', mime: 'application/pdf', size: 1000, kept: 'copy' as const, url: null, icon: 'pdf' as const, paper: null, paperAnswer: null, paperAnsweredBy: null, paperAnsweredAt: null }
    const preview = { ...pdf, id: 'f2', name: 'Zx9MadeUpKeyForATest_0123456789-abcdefghijKLMNOP=w1200-h630-p.png', mime: 'image/png', icon: 'image' as const }
    const link = { ...pdf, id: 'f3', name: 'Google Drive', kept: 'link' as const, url: 'https://drive.google.com/drive/folders/made-up-folder-for-a-test', icon: 'link' as const }
    // The same link as the mail's text gave it, with the mark an email program left on its end: one link, not two.
    const again = { ...link, id: 'f4', url: `${link.url}${String.fromCharCode(0xfffc)}` }
    draw(fakeIo(), [
      line('m-job-picture', { jobId: 'pipeline:j-579', invitation: null, subject: 'A picture', files: [preview] }),
      line('m-job-preview', { jobId: 'pipeline:j-579', invitation: null, subject: 'The folder', files: [preview, link, again] }),
      line('m-job-both', { jobId: 'pipeline:j-579', invitation: null, subject: 'Spec book', files: [pdf, preview, link] }),
      line('m-bid-link', { jobId: 'bid:b-oak', invitation: null, subject: 'The folder', files: [preview, link] }),
    ])
    expect(document.querySelector('[data-line="m-job-picture"] [data-paper-door]')).toBeNull()
    const onLink = document.querySelector('[data-line="m-job-preview"] [data-keep-paper] [data-paper-door]')!
    expect(onLink.getAttribute('data-links')).toBe(link.url)
    // The picture is still no file: the form is told the mail has none.
    expect(onLink.textContent).toBe('the job|j-579|m-job-preview|The folder|glenn@marrexbuilders.example|0')
    // Beside a real file the press shows, with the file counted and the link handed over.
    const both = document.querySelector('[data-line="m-job-both"] [data-keep-paper] [data-paper-door]')!
    expect(both.textContent).toBe('the job|j-579|m-job-both|Spec book|glenn@marrexbuilders.example|1')
    expect(both.getAttribute('data-links')).toBe(link.url)
    // A bid's press files bytes into a set, so a link alone still earns it none.
    expect(document.querySelector('[data-line="m-bid-link"] [data-bid-door]')).toBeNull()
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
