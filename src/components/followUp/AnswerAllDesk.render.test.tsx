// @vitest-environment jsdom
/**
 * Punch list #140 PR 6: Answer all over fake ios, drawn by Follow up as the page draws it. The press on Needs a reply's
 * header, the desk walking the lane one card at a time with the reply box, a text sent from the box moving on and
 * counting, No reply needed moving on, Skip for now putting a person after the rest, a person with no way to reach them
 * getting the thread's door, Escape inside the send window keeping the desk, a pinned person who left the lane, and
 * the end card with what went and the quiet ones. The people are the prototype's demo people; nothing is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { FollowUpIo } from '../../lib/followUp/followUpIo'
import type { FollowUpContactRow, FollowUpMessageRow, FollowUpRows } from '../../lib/followUp/followUpRows'
import type { MessagesView } from '../../lib/messages/messagesIo'
import type { ReplyIo } from '../../lib/messages/replyIo'
import type { WaitLine } from '../../lib/messages/waitingOnThem'
import type { QuickRepliesIo } from '../../lib/quickReplies/quickRepliesIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { FollowUpPanel, type FollowUpPanelProps } from './FollowUpPanel'
import type { Teammate } from './WhoHasItPill'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// Send texts is on, so a text goes as it will once the owner turns it on.
vi.mock('../gc/messages/reply/useTextsOn', () => ({ useTextsOn: () => true }))

afterEach(cleanup)

const TODAY = '2026-10-02'
const NOW = '2026-10-02T17:00:00.000Z'
const ME: Teammate = { id: 'u-robert', name: 'Robert', role: 'estimator' }
const ROSA: Teammate = { id: 'u-rosa', name: 'Rosa', role: 'assistant' }

const person = (id: string, kind: string, patch: Partial<FollowUpContactRow> = {}): FollowUpContactRow => ({
  id,
  kind,
  customer_id: null,
  customer_contact_person_id: null,
  gc_company_id: null,
  gc_company_person_id: null,
  person_id: null,
  name: null,
  goes_by: null,
  off_since: null,
  off_why: null,
  off_by: null,
  prospect_id: null,
  supply_house_id: null,
  supply_house_contact_id: null,
  team_prospect_id: null,
  state: 'waiting',
  snoozed_until: null,
  has_user_id: 'u-rosa',
  has_since: '2026-09-26T19:30:00.000Z',
  has_how: 'took',
  ...patch,
})
const line = (id: string, contactId: string, channel: string, at: string, body: string): FollowUpMessageRow => ({
  id,
  contact_id: contactId,
  channel_id: null,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel,
  direction: 'in',
  who_user_id: null,
  who_text: '',
  at,
  subject: null,
  body,
  optout_line: null,
  back_on: null,
  back_by: null,
  back_words: null,
  back_done_at: null,
})

/** Greg's text waiting longest, Priya's voicemail, and Dana, a customer with no number and no email on file. Rosa holds all three. */
const ROWS: FollowUpRows = {
  contacts: [
    person('greg', 'trade', { gc_company_id: 'hillside' }),
    person('priya', 'customer', { customer_contact_person_id: 'helotes-priya' }),
    person('dana', 'customer', { name: 'Dana Whitfield' }),
  ],
  channels: [{ id: 'ch-greg', contact_id: 'greg', kind: 'phone', value: '(210) 555-0113', opted_out_at: null } as unknown as FollowUpRows['channels'][number]],
  records: {
    gcCompanies: [{ id: 'hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }],
    customers: [{ id: 'helotes', name: 'Helotes Dental Office' }],
    customerContactPersons: [{ id: 'helotes-priya', customer_id: 'helotes', name: 'Dr. Priya Raman' }],
  },
  messages: [
    line('m-greg', 'greg', 'text', '2026-10-01T14:00:00.000Z', 'Is the detention pond in sitework or ours?'),
    line('m-priya', 'priya', 'voicemail', '2026-10-01T20:00:00.000Z', 'Calling about when you start.'),
    line('m-dana', 'dana', 'text', '2026-10-02T13:00:00.000Z', 'Can the sink move left?'),
  ],
  heard: [],
  owed: [],
}
/** After someone else answered Greg: he is out of the lane. */
const GREG_ANSWERED: FollowUpRows = { ...ROWS, contacts: ROWS.contacts.filter((c) => c.id !== 'greg'), messages: ROWS.messages.filter((m) => m.contact_id !== 'greg') }

const contact = (id: string, kind: Contact['kind'], name: string, company: string, channels: Contact['channels']): Contact => ({ id, kind, name, goesBy: null, company, record: null, channels, jobIds: [], defaultJobId: null })
const FULL: Record<string, Contact> = {
  greg: contact('greg', 'trade', 'Greg Paulk', 'Hillside Excavation', [{ id: 'ch-greg', kind: 'phone', value: '(210) 555-0113', optedOutAt: null }]),
  priya: contact('priya', 'customer', 'Dr. Priya Raman', 'Helotes Dental Office', [{ id: 'ch-priya', kind: 'email', value: 'priya@helotes.example', optedOutAt: null }]),
  dana: contact('dana', 'customer', 'Dana Whitfield', '', []),
}
const VIEW: MessagesView = { contacts: Object.values(FULL), messages: [], rails: {}, tiles: {}, userNames: { 'u-rosa': 'Rosa', 'u-robert': 'Robert' } }
const QUIET: WaitLine[] = [{ id: 'k1', contactId: 'c-kim', name: 'Kim Coe', kind: 'customer', direction: 'out', body: 'Kim, the heater is on the truck.', atMs: Date.parse('2026-09-28T20:00:00Z'), number: null }]

function followUpIo(...reads: FollowUpRows[]): FollowUpIo {
  const loadQueue = vi.fn(async () => reads[reads.length - 1]!)
  for (const r of reads) loadQueue.mockResolvedValueOnce(r)
  return {
    loadQueue,
    loadHighlights: vi.fn(async () => []),
    count: vi.fn(async () => 3),
    takeIt: vi.fn(async () => undefined),
    handTo: vi.fn(async () => undefined),
    setState: vi.fn(async () => null),
    markOwed: vi.fn(async () => 'o-new'),
    owedDone: vi.fn(async () => 'n-new'),
    owedSentDone: vi.fn(async () => undefined),
    writeDown: vi.fn(async () => undefined),
    readQuestion: vi.fn(async () => undefined),
    addNote: vi.fn(async () => 'n-new'),
    setBackDay: vi.fn(async () => undefined),
    backDone: vi.fn(async () => undefined),
    highlight: vi.fn(async () => 'h-new'),
    unhighlight: vi.fn(async () => undefined),
    callAdd: vi.fn(async () => 'c-new'),
    callDone: vi.fn(async () => undefined),
    callMove: vi.fn(async () => undefined),
    setPrefers: vi.fn(async () => undefined),
  }
}
const replyIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Robert' })),
  addNote: vi.fn(() => Promise.resolve('m-note-new')),
  sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
  sendText: vi.fn(() => Promise.resolve('m-text-new')),
  logCall: vi.fn(() => Promise.resolve('m-call-new')),
})
const quickIo = (): QuickRepliesIo => ({
  loadLines: vi.fn(() => Promise.resolve([])),
  loadVersions: vi.fn(() => Promise.resolve({})),
  press: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve('q')),
  edit: vi.fn(() => Promise.resolve(1)),
  remove: vi.fn(() => Promise.resolve()),
  restore: vi.fn(() => Promise.resolve()),
  setPress: vi.fn(() => Promise.resolve(1)),
  setShortcut: vi.fn(() => Promise.resolve(1)),
})

/** The page, holding whether the desk is open, as `/messages` does. */
function Page({ io, reply, view = VIEW }: { io: FollowUpIo; reply: ReplyIo; view?: MessagesView | null }) {
  const [on, setOn] = useState(false)
  const props: FollowUpPanelProps<never, never> = {
    me: ME,
    team: [ME, ROSA],
    io,
    onOpenThread: doors.onOpenThread,
    say: doors.say,
    todayYmd: TODAY,
    nowIso: NOW,
    answerAll: { on, onChange: setOn, thread: { view, nowIso: NOW, searchJobs: async () => [] }, loadContact: async (id) => FULL[id] ?? null, replyIo: reply, quickIo: quickIo(), quietIo: async () => QUIET },
  }
  return <FollowUpPanel {...props} />
}
const doors = { onOpenThread: vi.fn(), say: vi.fn() }

function renderPage(io: FollowUpIo = followUpIo(ROWS), view: MessagesView | null = VIEW) {
  doors.onOpenThread = vi.fn()
  doors.say = vi.fn()
  const reply = replyIo()
  renderWithProviders(<Page io={io} reply={reply} view={view} />)
  return { io, reply }
}

const desk = () => within(screen.getByRole('dialog', { name: 'Answer all' }))
const progress = () => [...document.querySelectorAll('[data-answer-all-progress] span > span:last-child')].map((s) => s.textContent)
const cardFor = () => document.querySelector('[data-answer-all-card]')?.getAttribute('data-answer-all-card')

async function openDesk() {
  const lane = await screen.findByRole('region', { name: 'Needs a reply' })
  fireEvent.click(await within(lane).findByRole('button', { name: 'Answer all' }))
  return screen.findByRole('dialog', { name: 'Answer all' })
}


describe('Answer all', { timeout: 20_000 }, () => {
  it('opens on the person waiting longest, with their words, who has them and the reply box', async () => {
    renderPage()
    await openDesk()
    expect(progress()).toEqual(['Needs a reply', '3 to answer', '1 of 3'])
    expect(cardFor()).toBe('greg')
    expect(desk().getByText(/Is the detention pond in sitework or ours\?/)).toBeTruthy()
    expect(document.querySelector('[data-answer-all-has]')?.textContent).toBe('Rosa has it')
    expect(desk().getByText('2 more after this')).toBeTruthy()
    expect(await desk().findByRole('textbox', { name: 'Write to Greg Paulk' })).toBeTruthy()
    expect((document.querySelector('[data-answer-all-call]') as HTMLAnchorElement).getAttribute('href')).toBe('tel:+12105550113')
  })

  it('a text sent from the box moves on and counts; No reply needed moves on; the end says what went and offers the quiet ones', async () => {
    const { io, reply } = renderPage(followUpIo(ROWS, ROWS, ROWS))
    await openDesk()
    // Dana first: a person with no number and no email gets the thread's door.
    fireEvent.click(desk().getByRole('button', { name: 'Skip for now' }))
    fireEvent.click(desk().getByRole('button', { name: 'Skip for now' }))
    expect(cardFor()).toBe('dana')
    expect(await desk().findByText('They have no number and no email on file. Answer them from their thread.')).toBeTruthy()
    fireEvent.click(desk().getByRole('button', { name: 'Skip for now' }))
    expect(cardFor()).toBe('greg')
    const box = await desk().findByRole('textbox', { name: 'Write to Greg Paulk' })
    fireEvent.change(box, { target: { value: 'Yes, the pond is in sitework.' } })
    fireEvent.click(desk().getByRole('button', { name: 'Send text…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    fireEvent.click(within(win).getByRole('button', { name: 'Send as text' }))
    await waitFor(() => expect(reply.sendText).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(cardFor()).toBe('priya'))
    expect(progress()).toEqual(['Needs a reply', '2 to answer', '2 of 3'])
    await waitFor(() => expect(io.loadQueue).toHaveBeenCalledTimes(2))
    fireEvent.click(desk().getByRole('button', { name: 'No reply needed' }))
    await waitFor(() => expect(io.setState).toHaveBeenCalledWith('priya', 'done'))
    await waitFor(() => expect(cardFor()).toBe('dana'))
    fireEvent.click(desk().getByRole('button', { name: 'Open the thread' }))
    expect(doors.onOpenThread).toHaveBeenCalledWith('dana', 'm-dana', undefined)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Answer all' })).toBeNull())
  })

  it('the end card tallies what went and opens the first quiet person with the nudge', async () => {
    const one: FollowUpRows = { ...ROWS, contacts: ROWS.contacts.filter((c) => c.id === 'priya'), messages: ROWS.messages.filter((m) => m.contact_id === 'priya') }
    const { io } = renderPage(followUpIo(one, one))
    await openDesk()
    fireEvent.click(desk().getByRole('button', { name: 'No reply needed' }))
    await waitFor(() => expect(io.setState).toHaveBeenCalledWith('priya', 'done'))
    expect(await desk().findByText('All answered.')).toBeTruthy()
    expect(document.querySelector('[data-answer-all-tally]')?.textContent).toBe('1 no reply needed went.')
    expect(await desk().findByText('1 person went quiet on us after our last word.')).toBeTruthy()
    fireEvent.click(desk().getByRole('button', { name: 'Nudge the first' }))
    expect(doors.onOpenThread).toHaveBeenCalledWith('c-kim', undefined, { nudge: 'text' })
  })

  it('Escape inside the send window closes the window and keeps the desk and the draft', async () => {
    renderPage()
    await openDesk()
    const box = await desk().findByRole('textbox', { name: 'Write to Greg Paulk' })
    fireEvent.change(box, { target: { value: 'Yes, the pond is in sitework.' } })
    fireEvent.click(desk().getByRole('button', { name: 'Send text…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    fireEvent.keyDown(win, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Before it goes, this is what they see' })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Answer all' })).toBeTruthy()
    expect((desk().getByRole('textbox', { name: 'Write to Greg Paulk' }) as HTMLTextAreaElement).value).toBe('Yes, the pond is in sitework.')
  })

  it('a pinned person who left the lane while their card was up is said so, and Next moves on', async () => {
    const { io } = renderPage(followUpIo(ROWS, GREG_ANSWERED))
    await openDesk()
    expect(cardFor()).toBe('greg')
    // A team note reads the lane again; someone answered Greg meanwhile.
    const kinds = within(await desk().findByRole('radiogroup', { name: 'Reply as' }))
    fireEvent.click(kinds.getByRole('radio', { name: 'Note' }))
    fireEvent.change(desk().getByRole('textbox', { name: 'A note for the team' }), { target: { value: 'Rosa called him.' } })
    fireEvent.click(desk().getByRole('button', { name: 'Add the note' }))
    await waitFor(() => expect(io.loadQueue).toHaveBeenCalledTimes(2))
    expect(await desk().findByText('Greg Paulk is no longer in Needs a reply.')).toBeTruthy()
    fireEvent.click(desk().getByRole('button', { name: 'Next' }))
    expect(cardFor()).toBe('priya')
  })

  it('says the thread is still being read until the page has it', async () => {
    renderPage(followUpIo(ROWS), null)
    await openDesk()
    expect(await desk().findByText('Reading the thread…')).toBeTruthy()
  })
})
