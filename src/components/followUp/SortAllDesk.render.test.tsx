// @vitest-environment jsdom
/**
 * Messages, residential R7: Sort all over fake ios, drawn by Follow up as the page draws it. The press on New's header
 * from two people, the desk walking New one card at a time with the lane's own sort card, *Skip for now* putting a
 * person after the rest, a press reading Follow up again and bringing the next person up, *Someone else* closing the
 * desk at the thread's line, and the desk saying all are sorted. The people are the prototype's demo people; nothing
 * here is a real row.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FollowUpIo } from '../../lib/followUp/followUpIo'
import type { FollowUpContactRow, FollowUpMessageRow, FollowUpRows } from '../../lib/followUp/followUpRows'
import type { NewLaneCardIo, NewLaneCardRows } from '../../lib/followUp/newLaneCardIo'
import type { JobTile } from '../../lib/messages/jobTiles'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { FollowUpPanel } from './FollowUpPanel'
import { SortAllDesk } from './SortAllDesk'
import type { Teammate } from './WhoHasItPill'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

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
  has_user_id: null,
  has_since: null,
  has_how: null,
  ...patch,
})

const line = (id: string, contactId: string, channel: string, at: string, body: string, patch: Partial<FollowUpMessageRow> = {}): FollowUpMessageRow => ({
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
  ...patch,
})

/** Greg's email to bids@ with nobody on him, Priya's voicemail on the first of her two jobs, and a number nobody has named. */
const SORTING: FollowUpRows = {
  contacts: [
    person('greg', 'trade', { gc_company_id: 'hillside' }),
    person('priya', 'customer', { customer_contact_person_id: 'helotes-priya', has_user_id: 'u-rosa', has_since: '2026-09-26T19:30:00.000Z', has_how: 'took' }),
    person('unk1', 'unknown'),
  ],
  channels: [],
  records: {
    gcCompanies: [{ id: 'hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }],
    customers: [{ id: 'helotes', name: 'Helotes Dental Office' }],
    customerContactPersons: [{ id: 'helotes-priya', customer_id: 'helotes', name: 'Dr. Priya Raman' }],
  },
  messages: [
    line('m-greg', 'greg', 'email', '2026-10-01T14:00:00.000Z', 'Is the detention pond in sitework or ours?', { subject: 'Detention pond', mailbox: 'bids', project_id: 'p-boerne' }),
    line('m-priya', 'priya', 'voicemail', '2026-10-01T20:00:00.000Z', 'Calling about when you start.', { jobs_ledger_id: 'j-helotes', mailbox: 'team' }),
    line('m-unk', 'unk1', 'text', '2026-10-02T15:00:00.000Z', 'Hi this is Kevin Alvarez, is this the plumbing office?', { mailbox: 'team' }),
  ],
  heard: [],
  owed: [],
  jobs: [
    { contact_id: 'priya', bid_id: null, project_id: null, jobs_ledger_id: 'j-helotes', is_default: true, created_at: '2026-09-01T00:00:00.000Z' },
    { contact_id: 'priya', bid_id: null, project_id: null, jobs_ledger_id: 'j-helotes-2', is_default: false, created_at: '2026-09-20T00:00:00.000Z' },
  ],
  jobStates: { pipeline: [{ id: 'j-helotes', status: 'working' }, { id: 'j-helotes-2', status: 'waiting' }] },
}

/** After Greg is handed to Rosa: someone has him, so he leaves New. */
const GREG_SORTED: FollowUpRows = {
  ...SORTING,
  contacts: SORTING.contacts.map((c) => (c.id === 'greg' ? { ...c, has_user_id: 'u-rosa', has_since: NOW, has_how: 'handed' } : c)),
}

function followUpIo(...reads: FollowUpRows[]): FollowUpIo {
  const loadQueue = vi.fn(async () => reads[0]!)
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
    logCall: vi.fn(async () => 'm-call-new'),
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

const tile = (key: string, num: string, name: string): JobTile => ({ key, kind: 'pipeline', num, name, day: { words: 'working', tone: '' } })
const SEATS = { customer: 'u-rosa', trade: 'u-robert', arch: null }

/** The sort card's read of each person, as `newLaneCardIo` gives it. */
const CARDS: Record<string, NewLaneCardRows> = {
  greg: { contact: { state: 'waiting', snoozed_until: null, has_user_id: null }, lines: [SORTING.messages[0]!], tiles: {}, active: new Set(), seats: SEATS, team: [ME, ROSA] },
  priya: {
    contact: { state: 'waiting', snoozed_until: null, has_user_id: 'u-rosa' },
    lines: [SORTING.messages[1]!],
    tiles: { 'pipeline:j-helotes': tile('pipeline:j-helotes', 'J1101', 'Helotes exam rooms'), 'pipeline:j-helotes-2': tile('pipeline:j-helotes-2', 'J1140', 'Helotes break room') },
    active: new Set(['pipeline:j-helotes', 'pipeline:j-helotes-2']),
    seats: SEATS,
    team: [ME, ROSA],
  },
  unk1: { contact: { state: 'waiting', snoozed_until: null, has_user_id: null }, lines: [SORTING.messages[2]!], tiles: {}, active: new Set(), seats: SEATS, team: [ME, ROSA] },
}

function sortIo(): NewLaneCardIo {
  return {
    loadCard: vi.fn(async (contactId: string) => CARDS[contactId]!),
    loadKnown: vi.fn(async () => ({})),
    makeCustomer: vi.fn(async () => 'x'),
    name: vi.fn(async (contactId: string) => contactId),
    tie: vi.fn(async () => undefined),
    takeIt: vi.fn(async () => undefined),
    handTo: vi.fn(async () => undefined),
  }
}

function renderPanel(io: FollowUpIo, sort: NewLaneCardIo = sortIo()) {
  const onOpenThread = vi.fn()
  const say = vi.fn()
  renderWithProviders(<FollowUpPanel me={ME} team={[ME, ROSA]} io={io} sortIo={sort} onOpenThread={onOpenThread} say={say} todayYmd={TODAY} nowIso={NOW} />)
  return { onOpenThread, say, sort }
}

const desk = () => within(screen.getByRole('dialog', { name: 'Sort all' }))
const progress = () => [...document.querySelectorAll('[data-sort-all-progress] span > span:last-child')].map((s) => s.textContent)
const cardFor = () => document.querySelector('[data-sort-all-card]')?.getAttribute('data-sort-all-card')

async function openDesk() {
  const lane = await screen.findByRole('region', { name: 'New' })
  fireEvent.click(await within(lane).findByRole('button', { name: 'Sort all' }))
  return screen.findByRole('dialog', { name: 'Sort all' })
}

describe('Sort all', () => {
  it('shows on New’s header from two people, and opens the desk on the person waiting longest', async () => {
    renderPanel(followUpIo(SORTING))
    await openDesk()
    expect(progress()).toEqual(['New', '3 to sort', '1 of 3'])
    expect(cardFor()).toBe('greg')
    expect(desk().getByText('Detention pond')).toBeTruthy()
    expect(desk().getByText('2 more after this')).toBeTruthy()
    // The lane's own sort card, for the presses.
    expect(await desk().findByRole('region', { name: 'Sort: Who has it?' })).toBeTruthy()
  })

  it('has no Sort all for one person: their row’s press is enough', async () => {
    const one: FollowUpRows = { ...SORTING, contacts: SORTING.contacts.filter((c) => c.id === 'unk1'), messages: SORTING.messages.filter((m) => m.contact_id === 'unk1') }
    renderPanel(followUpIo(one))
    expect(await screen.findByRole('heading', { name: 'New (1)' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'New' })).queryByRole('button', { name: 'Sort all' })).toBeNull()
  })

  it('Skip for now puts a person after the rest, and the walk comes back round', async () => {
    renderPanel(followUpIo(SORTING))
    await openDesk()
    fireEvent.click(desk().getByRole('button', { name: 'Skip for now' }))
    expect(cardFor()).toBe('priya')
    expect(progress()).toEqual(['New', '3 to sort', '1 of 3'])
    fireEvent.click(desk().getByRole('button', { name: 'Skip for now' }))
    expect(cardFor()).toBe('unk1')
    fireEvent.click(desk().getByRole('button', { name: 'Skip for now' }))
    expect(cardFor()).toBe('greg')
  })

  it('a press reads Follow up again, and the next person comes up with the count gone on', async () => {
    const io = followUpIo(SORTING, GREG_SORTED)
    const { sort, say } = renderPanel(io)
    await openDesk()
    const has = await desk().findByRole('region', { name: 'Sort: Who has it?' })
    fireEvent.click(within(has).getByRole('button', { name: /^Rosa/ }))
    await waitFor(() => expect(sort.handTo).toHaveBeenCalledWith('greg', 'u-rosa'))
    await waitFor(() => expect(say).toHaveBeenCalledWith('Rosa has Greg Paulk.', 'success'))
    await waitFor(() => expect(cardFor()).toBe('priya'))
    expect(io.loadQueue).toHaveBeenCalledTimes(2)
    expect(progress()).toEqual(['New', '2 to sort', '2 of 3'])
    expect(desk().getByText('1 more after this')).toBeTruthy()
    expect(await desk().findByRole('region', { name: 'Sort: Which job?' })).toBeTruthy()
  })

  it('Someone else closes the desk and opens the thread at the line', async () => {
    const { onOpenThread } = renderPanel(followUpIo(SORTING))
    await openDesk()
    fireEvent.click(desk().getByRole('button', { name: 'Skip for now' }))
    fireEvent.click(desk().getByRole('button', { name: 'Skip for now' }))
    expect(cardFor()).toBe('unk1')
    const who = await desk().findByRole('region', { name: 'Sort: Who is this?' })
    fireEvent.click(within(who).getByRole('button', { name: /Someone else/ }))
    expect(onOpenThread).toHaveBeenCalledWith('unk1', 'm-unk')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sort all' })).toBeNull())
  })

  it('says all are sorted once New is empty, and goes back to Follow up', () => {
    const onClose = vi.fn()
    render(<SortAllDesk lane={[]} contacts={[]} io={sortIo()} me={ME} say={vi.fn()} reread={vi.fn()} onClose={onClose} onOpenThread={vi.fn()} nowIso={NOW} />)
    expect(screen.getByText('All sorted.')).toBeTruthy()
    expect(screen.getByText('Nothing to sort. Every line that came in has a person, a job and someone on it.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Follow up' }))
    expect(onClose).toHaveBeenCalled()
  })
})
