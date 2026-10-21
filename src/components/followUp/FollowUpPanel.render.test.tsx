// @vitest-environment jsdom
/**
 * Messages, cut 2: Follow up's top over a fake io (v2.5289). The sections and their counts from the rows, a row opening
 * the thread at its line while its buttons do only their own press, each press and the kernel's words after it, a
 * refused press keeping its own reason, the badge's count handed to the page, and the clause and nudge slots. The
 * people are the prototype's demo people; nothing here is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FollowUpIo } from '../../lib/followUp/followUpIo'
import type { ContactOwedRow, FollowUpContactRow, FollowUpMessageRow, FollowUpRows, MessagePromiseRow } from '../../lib/followUp/followUpRows'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DatabaseError } from '../../utils/errorHandling'
import { FollowUpPanel, type FollowUpPanelProps, type PlanQuestionWrites } from './FollowUpPanel'
import type { Teammate } from './WhoHasItPill'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const TODAY = '2026-10-02'
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

const line = (id: string, contactId: string, channel: string, direction: string, at: string, body: string, patch: Partial<FollowUpMessageRow> = {}): FollowUpMessageRow => ({
  id,
  contact_id: contactId,
  channel_id: null,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel,
  direction,
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

const question = (id: string, messageId: string, contactId: string, at: string): MessagePromiseRow => ({
  id,
  message_id: messageId,
  kind: 'question',
  state: 'offered',
  day: null,
  day_words: null,
  writes: null,
  decided_by: null,
  decided_at: null,
  message: { contact_id: contactId, at },
})

const owed = (id: string, contactId: string, what: string, byDay: string): ContactOwedRow => ({
  id,
  contact_id: contactId,
  what,
  by_day: byDay,
  by_words: null,
  marked_by: 'u-rosa',
  marked_at: '2026-09-26T19:30:00.000Z',
  done_at: null,
  done_how: null,
  done_note_message_id: null,
})

/**
 * Greg's plans question on the Boerne job waiting longest, Priya's voicemail with Rosa holding her and the start date owed, Elena's note
 * back today and her write on her page, and a number nobody has named. Rosa holds Greg too: a conversation nobody holds
 * waits in New (residential R7), as the number nobody has named does.
 */
const ROWS: FollowUpRows = {
  contacts: [
    person('greg', 'trade', { gc_company_id: 'hillside', has_user_id: 'u-rosa', has_since: '2026-10-01T15:00:00.000Z', has_how: 'handed' }),
    person('priya', 'customer', { customer_contact_person_id: 'helotes-priya', has_user_id: 'u-rosa', has_since: '2026-09-26T19:30:00.000Z', has_how: 'took' }),
    person('elena', 'customer', { customer_contact_person_id: 'cibolo-elena' }),
    person('unk1', 'unknown'),
  ],
  channels: [],
  records: {
    gcCompanies: [{ id: 'hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }],
    customers: [
      { id: 'helotes', name: 'Helotes Dental Office' },
      { id: 'cibolo', name: 'Cibolo Creek Partners' },
    ],
    customerContactPersons: [
      { id: 'helotes-priya', customer_id: 'helotes', name: 'Dr. Priya Raman' },
      { id: 'cibolo-elena', customer_id: 'cibolo', name: 'Elena Marchetti' },
    ],
  },
  messages: [
    line('m-greg', 'greg', 'text', 'in', '2026-10-01T14:00:00.000Z', 'Is the detention pond in sitework or ours?', { project_id: 'p-boerne' }),
    line('m-priya', 'priya', 'voicemail', 'in', '2026-10-01T20:00:00.000Z', 'Calling about when you start.'),
    line('n-elena', 'elena', 'note', 'team', '2026-09-28T15:00:00.000Z', 'Call Elena about the gate code.', { who_user_id: 'u-rosa', back_on: TODAY, back_by: 'u-rosa' }),
    line('m-elena', 'elena', 'portal', 'in', '2026-10-02T13:00:00.000Z', 'Can the sink in exam 3 move left?'),
    line('m-unk', 'unk1', 'text', 'in', '2026-10-02T15:00:00.000Z', 'Is this the plumbing office?'),
  ],
  heard: [question('q-greg', 'm-greg', 'greg', '2026-10-01T14:00:00.000Z')],
  owed: [owed('o-priya', 'priya', 'the start date', '2026-10-05')],
  // A call to make (v2.5596): Elena about the estimate, tomorrow.
  callTasks: [{ id: 'call-elena', contact_id: 'elena', step_key: 'estimate', bid_id: null, project_id: null, jobs_ledger_id: 'job-7', due_on: '2026-10-03', what: 'about the estimate', script: 'Hi Elena, this is Rosa with Click Plumbing.', made_by: 'u-rosa', made_at: '2026-10-02T15:00:00.000Z', done_at: null }],
}

const EMPTY: FollowUpRows = { contacts: [], channels: [], records: {}, messages: [], heard: [], owed: [] }

function fakeIo(overrides: Partial<FollowUpIo> = {}, rows: FollowUpRows = ROWS): FollowUpIo {
  return {
    loadQueue: vi.fn(async () => rows),
    loadHighlights: vi.fn(async () => []),
    count: vi.fn(async () => 4),
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
    ...overrides,
  }
}

interface Clause {
  id: string
}
interface Nudge {
  contactId: string
}

function renderPanel(over: Partial<FollowUpPanelProps<Clause, Nudge>> = {}, io: FollowUpIo = fakeIo()) {
  const props = {
    me: ME,
    team: [ME, ROSA],
    io,
    onOpenThread: vi.fn(),
    say: vi.fn(),
    onCount: vi.fn(),
    todayYmd: TODAY,
    nowIso: '2026-10-02T17:00:00.000Z',
    ...over,
  }
  renderWithProviders(<FollowUpPanel<Clause, Nudge> {...props} />)
  return { ...props, io }
}

/** A person's row in a section. */
const rowIn = (section: string, contactId: string) => within(screen.getByRole('region', { name: section }).querySelector<HTMLElement>(`[data-follow-up-row="${contactId}"]`)!)

const loaded = () => screen.findByRole('heading', { name: 'Needs a reply (2)' })

/** GC mode's plan question writes: the question recorded, the email to the Boerne job's architect going. */
function planWrites(over: Partial<PlanQuestionWrites> = {}): PlanQuestionWrites {
  return {
    record: vi.fn(async () => 'pq-1'),
    send: vi.fn(async () => ({ to: 'studio@archfirm.example' })),
    jobName: (projectId) => (projectId === 'p-boerne' ? 'Boerne Clinic' : null),
    onAsked: vi.fn(),
    ...over,
  }
}

describe('FollowUpPanel', () => {
  it('draws who is waiting from the rows, and hands the badge’s count to the page', async () => {
    const { onCount } = renderPanel()
    await loaded()
    // Elena twice in Needs you, as the prototype counts its rows; the badge counts each person once.
    expect(screen.getByRole('heading', { name: 'Needs you (2)' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'We owe them (2)' })).toBeTruthy()
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(4))

    const reply = screen.getByRole('region', { name: 'Needs a reply' })
    expect([...reply.querySelectorAll('[data-follow-up-row]')].map((r) => r.getAttribute('data-follow-up-row'))).toEqual(['greg', 'priya'])
    expect(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Rosa has this' })).toBeTruthy()
    expect(rowIn('Needs a reply', 'priya').getByRole('button', { name: 'Rosa has this' })).toBeTruthy()
    expect((rowIn('Needs a reply', 'priya').getByRole('button', { name: 'Call back in Quo' }) as HTMLButtonElement).disabled).toBe(true)
    // The number nobody has named waits in New, first, and not in Needs a reply.
    expect(screen.getByRole('heading', { name: 'New (1)' })).toBeTruthy()
    expect(rowIn('New', 'unk1').getByRole('button', { name: 'Who is this?' })).toBeTruthy()

    const needsYou = within(screen.getByRole('region', { name: 'Needs you' }))
    expect(needsYou.getByText('Call Elena about the gate code.')).toBeTruthy()
    expect(needsYou.getByText(/wrote in the portal/)).toBeTruthy()
    expect(rowIn('We owe them', 'priya').getByRole('button', { name: /we owe the start date · by Mon Oct 5/ })).toBeTruthy()
  })

  it('a row opens the thread at its line, and its buttons do only their own press', async () => {
    const { onOpenThread, io } = renderPanel()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Open Greg Paulk’s thread' }))
    expect(onOpenThread).toHaveBeenLastCalledWith('greg', 'm-greg')
    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Reply' }))
    expect(onOpenThread).toHaveBeenCalledTimes(2)
    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'No reply needed' }))
    await waitFor(() => expect(io.setState).toHaveBeenCalledWith('greg', 'done'))
    expect(onOpenThread).toHaveBeenCalledTimes(2)
    // What we owe opens the thread at the reply box, where the ways to deal with it are.
    fireEvent.click(rowIn('We owe them', 'priya').getByRole('button', { name: /we owe the start date/ }))
    expect(onOpenThread).toHaveBeenLastCalledWith('priya')
  })

  it('draws a call to make in We owe them with its day and the words to say; I called, Tomorrow and Skip press through the io (v2.5596)', async () => {
    const { io, say } = renderPanel()
    await loaded()
    const row = rowIn('We owe them', 'elena')
    expect(row.getByText('call · Sat Oct 3')).toBeTruthy()
    expect(row.getByText(/Call Elena about the estimate · added by Rosa/)).toBeTruthy()
    fireEvent.click(row.getByRole('button', { name: 'What to say' }))
    expect(row.getByText('Hi Elena, this is Rosa with Click Plumbing.')).toBeTruthy()
    fireEvent.click(row.getByRole('button', { name: 'Tomorrow' }))
    await waitFor(() => expect(io.callMove).toHaveBeenCalledWith('call-elena', '2026-10-03'))
    fireEvent.click(rowIn('We owe them', 'elena').getByRole('button', { name: 'I called' }))
    await waitFor(() => expect(io.callDone).toHaveBeenCalledWith('call-elena', 'called'))
    expect(say).toHaveBeenLastCalledWith('Done. The note is in the thread.', 'success')
    fireEvent.click(rowIn('We owe them', 'elena').getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(io.callDone).toHaveBeenCalledWith('call-elena', 'skipped'))
  })

  it('each press runs, reads the queue again and says the kernel’s words', async () => {
    const { say, io } = renderPanel()
    await loaded()
    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'No reply needed' }))
    await waitFor(() => expect(say).toHaveBeenLastCalledWith('Greg Paulk cleared from Follow up.', 'success'))
    expect(io.setState).toHaveBeenLastCalledWith('greg', 'done')
    expect(io.loadQueue).toHaveBeenCalledTimes(2)

    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Remind me Monday' }))
    await waitFor(() => expect(say).toHaveBeenLastCalledWith('Greg Paulk comes back to Follow up on Monday.', 'success'))
    expect(io.setState).toHaveBeenLastCalledWith('greg', 'snoozed')

    const needsYou = within(screen.getByRole('region', { name: 'Needs you' }))
    fireEvent.click(needsYou.getByRole('button', { name: 'Done with it' }))
    await waitFor(() => expect(say).toHaveBeenLastCalledWith('Cleared. The note stays in the thread.', 'success'))
    expect(io.backDone).toHaveBeenCalledWith('n-elena')

    fireEvent.click(needsYou.getByRole('button', { name: 'Another day' }))
    await waitFor(() => expect(say).toHaveBeenLastCalledWith('Comes back Mon Oct 5.', 'success'))
    expect(io.setBackDay).toHaveBeenCalledWith('n-elena', { ymd: '2026-10-05', words: null })
  })

  it('Ask the architect puts the question on the job, marks the line, then emails the architect', async () => {
    const writes = planWrites()
    const { say, io } = renderPanel({ planQuestions: writes })
    await loaded()
    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Ask the architect' }))
    await waitFor(() => expect(say).toHaveBeenLastCalledWith('Sent to studio@archfirm.example as a plan question.', 'success'))
    expect(writes.record).toHaveBeenCalledWith({
      projectId: 'p-boerne',
      packageId: null,
      askedByName: 'Greg Paulk at Hillside Excavation',
      text: 'Is the detention pond in sitework or ours?',
      sheets: [],
    })
    expect(io.readQuestion).toHaveBeenCalledWith('m-greg', 'asked')
    expect(writes.send).toHaveBeenCalledWith('pq-1')
    // The lead's order: on the job, then marked, so a second press makes no second question, then the email.
    const order = [vi.mocked(writes.record), vi.mocked(io.readQuestion), vi.mocked(writes.send)].map((f) => f.mock.invocationCallOrder[0]!)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(writes.onAsked).toHaveBeenCalledTimes(1)
  })

  it('when the email cannot go, the question stays on the job and the words say where', async () => {
    const writes = planWrites({ send: vi.fn(async () => Promise.reject(new Error('The project has no architect on record. Add one on the project first.'))) })
    const { say, io } = renderPanel({ planQuestions: writes })
    await loaded()
    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Ask the architect' }))
    await waitFor(() =>
      expect(say).toHaveBeenLastCalledWith(
        'The question is under Questions about the plans on Boerne Clinic. The email to the architect did not go. The project has no architect on record. Add one on the project first. The office can email it from there.',
        'error',
      ),
    )
    expect(io.readQuestion).toHaveBeenCalledWith('m-greg', 'asked')
    expect(writes.onAsked).toHaveBeenCalledTimes(1)
  })

  it('a question the job refuses marks nothing and sends nothing', async () => {
    const lost = new DatabaseError('Failed to record the question: We lost this bid. Nobody is open on it.', 'P0001', null, {
      serverMessage: 'We lost this bid. Nobody is open on it.',
      operationName: 'record the question',
    })
    const writes = planWrites({ record: vi.fn(async () => Promise.reject(lost)) })
    const { say, io } = renderPanel({ planQuestions: writes })
    await loaded()
    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Ask the architect' }))
    expect((await screen.findByText('We lost this bid. Nobody is open on it.')).getAttribute('role')).toBe('alert')
    expect(io.readQuestion).not.toHaveBeenCalled()
    expect(writes.send).not.toHaveBeenCalled()
    expect(writes.onAsked).not.toHaveBeenCalled()
    expect(say).not.toHaveBeenCalled()
  })

  it('a plans question has no press without the job’s writes, or on a line on no GC project', async () => {
    renderPanel()
    await loaded()
    expect(rowIn('Needs a reply', 'greg').queryByRole('button', { name: 'Ask the architect' })).toBeNull()
    cleanup()
    const offJob = { ...ROWS, messages: ROWS.messages.map((m) => (m.id === 'm-greg' ? { ...m, project_id: null } : m)) }
    renderPanel({ planQuestions: planWrites() }, fakeIo({}, offJob))
    await loaded()
    expect(rowIn('Needs a reply', 'greg').queryByRole('button', { name: 'Ask the architect' })).toBeNull()
    expect(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Reply' })).toBeTruthy()
  })

  it('the who-has-it picker takes a row, or puts one back', async () => {
    const { say, io } = renderPanel()
    await loaded()
    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Rosa has this' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^I'll take it/ }))
    await waitFor(() => expect(say).toHaveBeenLastCalledWith('You have Greg Paulk.', 'success'))
    expect(io.takeIt).toHaveBeenCalledWith('greg')

    fireEvent.click(rowIn('Needs a reply', 'priya').getByRole('button', { name: 'Rosa has this' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Nobody/ }))
    await waitFor(() => expect(say).toHaveBeenLastCalledWith('Nobody has it.', 'success'))
    expect(io.handTo).toHaveBeenCalledWith('priya', null)
  })

  it('a refused press keeps its own reason, and says nothing went', async () => {
    const refused = new DatabaseError('Failed to set a conversation’s state: That conversation is not there.', 'P0001', null, {
      serverMessage: 'That conversation is not there.',
      operationName: 'set a conversation’s state',
    })
    const { say } = renderPanel({}, fakeIo({ setState: vi.fn(async () => Promise.reject(refused)) }))
    await loaded()
    fireEvent.click(rowIn('Needs a reply', 'greg').getByRole('button', { name: 'No reply needed' }))
    expect((await screen.findByText('That conversation is not there.')).getAttribute('role')).toBe('alert')
    expect(say).not.toHaveBeenCalled()
  })

  it('draws the clause rows in Needs you, counted in its heading but not on the badge, and the nudges after We owe them', async () => {
    const { onCount } = renderPanel({
      clauses: { rows: [{ id: 'cl-1' }], render: (rows) => <p>{rows.length} clause edit waits on you</p> },
      nudges: { build: () => [{ contactId: 'greg' }], render: (rows) => <p>{rows.length} nudge from the flow</p> },
    })
    expect(await screen.findByRole('heading', { name: 'Needs you (3)' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Needs you' })).getByText('1 clause edit waits on you')).toBeTruthy()
    const nudge = screen.getByText('1 nudge from the flow')
    expect(screen.getByRole('region', { name: 'We owe them' }).compareDocumentPosition(nudge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The badge counts people, as follow_up_count does: the clauses have the Dashboard's own line (the lead, 2026-10-12).
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(4))
    expect(screen.getByText(/A clause row waits on a controller or a dev\./)).toBeTruthy()
  })

  it('See their page shows on a portal row only when the page hands it', async () => {
    renderPanel()
    await loaded()
    expect(screen.queryByRole('button', { name: 'See their page' })).toBeNull()
    cleanup()
    const seeTheirPage = vi.fn()
    renderPanel({ seeTheirPage })
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'See their page' }))
    expect(seeTheirPage).toHaveBeenCalledWith('elena')
  })

  it('names the clause rows under Needs you only when the page hands them in', async () => {
    renderPanel()
    await loaded()
    expect(screen.queryByText(/A clause row/)).toBeNull()
  })

  it('draws New first: each person who needs sorting once, with the sort as the press, and out of Needs a reply', async () => {
    // Greg with nobody on him again, and Priya on two active Pipeline jobs, her voicemail on the default one, untied.
    const sorting: FollowUpRows = {
      ...ROWS,
      contacts: ROWS.contacts.map((c) => (c.id === 'greg' ? { ...c, has_user_id: null, has_since: null, has_how: null } : c)),
      messages: ROWS.messages.map((m) => (m.id === 'm-greg' ? { ...m, channel: 'email', subject: 'Detention pond', mailbox: 'bids' } : m.id === 'm-priya' ? { ...m, jobs_ledger_id: 'j-helotes', mailbox: 'team' } : m)),
      jobs: [
        { contact_id: 'priya', bid_id: null, project_id: null, jobs_ledger_id: 'j-helotes', is_default: true, created_at: '2026-09-01T00:00:00.000Z' },
        { contact_id: 'priya', bid_id: null, project_id: null, jobs_ledger_id: 'j-helotes-2', is_default: false, created_at: '2026-09-20T00:00:00.000Z' },
      ],
      jobStates: { pipeline: [{ id: 'j-helotes', status: 'working' }, { id: 'j-helotes-2', status: 'waiting' }] },
    }
    const { onOpenThread, onCount } = renderPanel({}, fakeIo({}, sorting))
    expect(await screen.findByRole('heading', { name: 'New (3)' })).toBeTruthy()
    // The longest waiting first, each with the sort it needs.
    const lane = screen.getByRole('region', { name: 'New' })
    expect([...lane.querySelectorAll('[data-follow-up-row]')].map((r) => r.getAttribute('data-follow-up-row'))).toEqual(['greg', 'priya', 'unk1'])
    expect(rowIn('New', 'greg').getByText('Email to bids@', { exact: false })).toBeTruthy()
    expect(rowIn('New', 'priya').getByText('Voicemail on the team number', { exact: false })).toBeTruthy()
    fireEvent.click(rowIn('New', 'priya').getByRole('button', { name: 'Which job?' }))
    expect(onOpenThread).toHaveBeenLastCalledWith('priya', 'm-priya')
    fireEvent.click(rowIn('New', 'greg').getByRole('button', { name: 'Who has it?' }))
    expect(onOpenThread).toHaveBeenLastCalledWith('greg', 'm-greg')
    // Nobody left in Needs a reply; the badge still counts each person once.
    expect(screen.getByRole('heading', { name: 'Needs a reply (0)' })).toBeTruthy()
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(4))
  })

  it('names a lead from their row on Prospects (R0, PR 4), and keeps the contact’s own name when Prospects is not read', async () => {
    const lead: FollowUpRows = {
      ...EMPTY,
      contacts: [person('kevin', 'lead', { prospect_id: 'pr-kevin' }), person('rosie', 'lead', { prospect_id: 'pr-rosie', name: 'Rosie Vega' })],
      records: { prospects: [{ id: 'pr-kevin', contact_name: 'Kevin Alvarez', company_name: null }] },
      messages: [line('m-kevin', 'kevin', 'text', 'in', '2026-10-02T15:00:00.000Z', 'Can someone look at my water heater?'), line('m-rosie', 'rosie', 'text', 'in', '2026-10-02T15:30:00.000Z', 'Do you do slab leaks?')],
    }
    renderPanel({}, fakeIo({}, lead))
    expect(await screen.findByText('Kevin Alvarez')).toBeTruthy()
    // Rosie's prospect was not read (an estimator's Prospects): the name Who is this? stored on the contact stands.
    expect(screen.getByText('Rosie Vega')).toBeTruthy()
  })

  it('says so when nobody is waiting and nothing is owed', async () => {
    const { onCount } = renderPanel({}, fakeIo({}, EMPTY))
    expect(await screen.findByText('Nobody is waiting on us.')).toBeTruthy()
    expect(screen.getByText('Nothing to sort. Every line that came in has a person, a job and someone on it.')).toBeTruthy()
    expect(screen.getByText('Nothing we owe anyone.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull()
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0))
  })
})

// A lead's doors on the Needs a reply row (punch list #140 PR 8): Add Job's provider and the contact read are stood in.
const leadDoorsStand = vi.hoisted(() => ({ openNewJob: vi.fn() }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../contexts/JobFormModalContext', () => ({ useJobFormModal: () => ({ isOpen: false, openNewJob: leadDoorsStand.openNewJob, openEditJob: vi.fn(), closeJobForm: vi.fn() }) }))
vi.mock('../../lib/messages/messagesIo', async (orig) => ({
  ...(await orig<typeof import('../../lib/messages/messagesIo')>()),
  loadContact: vi.fn(async () => ({ id: 'lena', kind: 'lead', name: 'Lena Ortiz', goesBy: null, company: '', record: null, channels: [{ id: 'ch-lena', kind: 'phone', value: '(830) 555-0101', optedOutAt: null }], jobIds: [], defaultJobId: null })),
}))

describe('FollowUpPanel: a lead’s doors on their row (punch list #140 PR 8)', () => {
  it('a lead’s row offers Book a visit and Start an estimate; Book a visit makes the customer and opens Add Job filled in', async () => {
    const leadIo = { convert: vi.fn(async () => ({ customerId: 'cust-1' })), startEstimate: vi.fn(async () => ({ estimateNumber: 42 })) }
    const rows: FollowUpRows = {
      ...ROWS,
      // Rosa holds Lena, so she sits in Needs a reply and not in New (New is the nobody's list).
      contacts: [...ROWS.contacts, person('lena', 'lead', { name: 'Lena Ortiz', has_user_id: 'u-rosa', has_since: '2026-10-02T14:30:00.000Z', has_how: 'took' })],
      messages: [...ROWS.messages, line('m-lena', 'lena', 'text', 'in', '2026-10-02T14:00:00.000Z', 'Can you come Thursday?')],
    }
    const { say } = renderPanel({ leadIo }, fakeIo({}, rows))
    await screen.findByRole('heading', { name: 'Needs a reply (3)' })
    const row = rowIn('Needs a reply', 'lena')
    expect(row.getByText('lead')).toBeTruthy()
    expect(row.getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Reply', 'Book a visit', 'Start an estimate', 'No reply needed', 'Remind me Monday']))
    expect(rowIn('Needs a reply', 'greg').queryByRole('button', { name: 'Book a visit' })).toBeNull()

    fireEvent.click(row.getByRole('button', { name: 'Book a visit' }))
    await waitFor(() => expect(leadIo.convert).toHaveBeenCalledTimes(1))
    expect(leadIo.convert).toHaveBeenCalledWith('lena', expect.objectContaining({ name: 'Lena Ortiz', phone: '(830) 555-0101', words: 'Can you come Thursday?' }), { userId: expect.any(String) }, expect.any(String))
    await waitFor(() => expect(leadDoorsStand.openNewJob).toHaveBeenCalledWith(expect.objectContaining({ prefillCustomer: { name: 'Lena Ortiz', phone: '(830) 555-0101', email: null, note: 'Can you come Thursday?' } })))
    expect(say).not.toHaveBeenCalledWith(expect.stringMatching(/not/), 'error')
  })
})
