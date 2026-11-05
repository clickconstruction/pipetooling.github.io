// @vitest-environment jsdom
/**
 * Follow up's kept queue on `/messages` (punch list #183 PR 5). The queue's read is a controllable promise and the
 * kept-read store a mock, so each case says what the device kept and when the live read lands or fails: who was
 * waiting at the kept time under the stamp while the read hangs, the count the page hears, Take it and the row's
 * presses held while the row still opens its thread; the live lanes once the read lands and the record written; the
 * stamp's Retry over a kept queue when the read fails; the failure by its class with nothing kept; and nothing read
 * from the store without `keptRead`. Every person is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { KEPT_READ_SCHEMA, type KeptRead } from '../../lib/keptRead'
import { buildMessagesKeptQueue, messagesKeptKey, type MessagesKeptQueue } from '../../lib/messages/keptQueue'
import { followUpInputFromRows, followUpNewLane, type FollowUpContactRow, type FollowUpMessageRow, type FollowUpRows } from '../../lib/followUp/followUpRows'
import { followUpQueue, QUEUE_READ_OFFLINE_WORDS } from '../../lib/followUp/queue'
import type { FollowUpIo } from '../../lib/followUp/followUpIo'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'
import { DatabaseError } from '../../utils/errorHandling'
import { FollowUpPanel, type FollowUpPanelProps } from './FollowUpPanel'
import type { Teammate } from './WhoHasItPill'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../hooks/useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))
vi.mock('../../lib/impersonationSession', () => ({ isImpersonationSessionActive: () => false }))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

const readKept = vi.fn<(key: string) => Promise<KeptRead | null>>()
const writeKept = vi.fn<(kept: KeptRead) => Promise<void>>(async () => {})
vi.mock('../../lib/keptReadStore', () => ({
  readKeptRead: (key: string) => readKept(key),
  writeKeptRead: (kept: KeptRead) => writeKept(kept),
  clearKeptReads: vi.fn(async () => {}),
}))

const TODAY = '2026-10-02'
const NOW = '2026-10-02T17:00:00.000Z'
const ME: Teammate = { id: SMOKE_AUTH_USER_ID, name: 'Robert', role: 'estimator' }
const ROSA: Teammate = { id: 'u-rosa', name: 'Rosa', role: 'assistant' }
const NAMES = { [ME.id]: ME.name, [ROSA.id]: ROSA.name }
const KEY = messagesKeptKey(ME.id)
/** Five minutes ago, so the kept read is young enough to show. */
const KEPT_AT = Date.now() - 5 * 60_000

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

const text = (id: string, contactId: string, at: string, body: string): FollowUpMessageRow => ({
  id,
  contact_id: contactId,
  channel_id: null,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel: 'text',
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

/** What the device kept at 7:52: Marisol in New with nobody on her, Dale and Tomas in Needs a reply with Rosa and me. */
const KEPT_ROWS: FollowUpRows = {
  contacts: [
    person('marisol', 'customer', { customer_contact_person_id: 'cp-marisol' }),
    person('dale', 'trade', { gc_company_id: 'ridgeway', has_user_id: ROSA.id, has_since: '2026-10-01T15:00:00.000Z', has_how: 'handed' }),
    person('tomas', 'customer', { customer_contact_person_id: 'cp-tomas', has_user_id: ME.id, has_since: '2026-10-01T16:00:00.000Z', has_how: 'took' }),
  ],
  channels: [],
  records: {
    gcCompanies: [{ id: 'ridgeway', name: 'Ridgeway Builders', contact_name: 'Dale Ferris', trades: ['GC'] }],
    customers: [
      { id: 'cust-pena', name: 'Pena Residence' },
      { id: 'cust-reyes', name: 'Reyes Residence' },
    ],
    customerContactPersons: [
      { id: 'cp-marisol', customer_id: 'cust-pena', name: 'Marisol Pena' },
      { id: 'cp-tomas', customer_id: 'cust-reyes', name: 'Tomas Reyes' },
    ],
  },
  messages: [text('m-marisol', 'marisol', '2026-10-02T13:00:00.000Z', 'Is someone coming today?'), text('m-dale', 'dale', '2026-10-01T15:00:00.000Z', 'Pond detail?'), text('m-tomas', 'tomas', '2026-10-01T16:00:00.000Z', 'Gate code is 4412.')],
  heard: [],
  owed: [],
}

/** What the live read lands: Greg alone, with Rosa on him. */
const LIVE_ROWS: FollowUpRows = {
  contacts: [person('greg', 'trade', { gc_company_id: 'hillside', has_user_id: ROSA.id, has_since: '2026-10-01T15:00:00.000Z', has_how: 'handed' })],
  channels: [],
  records: { gcCompanies: [{ id: 'hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }] },
  messages: [text('m-greg', 'greg', '2026-10-01T14:00:00.000Z', 'Is the detention pond in sitework or ours?')],
  heard: [],
  owed: [],
}

/** The record the panel would have written for `KEPT_ROWS`, through the same kernels. */
function keptRecord(): MessagesKeptQueue[] {
  const input = followUpInputFromRows(KEPT_ROWS, TODAY, NAMES)
  const newLane = followUpNewLane(input, {}, NOW)
  const queue = followUpQueue(input, { newLane })
  return buildMessagesKeptQueue({ queue, contacts: input.contacts, lines: new Map(input.messages.map((m) => [m.id, m])), setAside: [] })
}
const stored = (): KeptRead<MessagesKeptQueue> => ({ key: KEY, schema: KEPT_READ_SCHEMA, scopes: ['queue'], readAt: KEPT_AT, rows: keptRecord() })

type Settle = { resolve: (rows: FollowUpRows) => void; reject: (e: unknown) => void }
let pending: Settle[] = []
const loadQueue = vi.fn(() => new Promise<FollowUpRows>((resolve, reject) => pending.push({ resolve, reject })))
const land = async (rows: FollowUpRows) => {
  const all = pending
  pending = []
  await act(async () => {
    for (const p of all) p.resolve(rows)
  })
}
const fail = async (e: unknown) => {
  const all = pending
  pending = []
  await act(async () => {
    for (const p of all) p.reject(e)
  })
}

function fakeIo(): FollowUpIo {
  const none = vi.fn(async () => undefined)
  return {
    loadQueue,
    loadHighlights: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    takeIt: none,
    handTo: none,
    setState: vi.fn(async () => null),
    markOwed: vi.fn(async () => 'o-new'),
    owedDone: vi.fn(async () => 'n-new'),
    owedSentDone: none,
    writeDown: none,
    readQuestion: none,
    addNote: vi.fn(async () => 'n-new'),
    logCall: vi.fn(async () => 'm-call-new'),
    setBackDay: none,
    backDone: none,
    highlight: vi.fn(async () => 'h-new'),
    unhighlight: none,
    callAdd: vi.fn(async () => 'c-new'),
    callDone: none,
    callMove: none,
    setPrefers: none,
    putBack: none,
  }
}

function renderPanel(over: Partial<FollowUpPanelProps<never, never>> = {}) {
  const props = {
    me: ME,
    team: [ME, ROSA],
    io: fakeIo(),
    onOpenThread: vi.fn(),
    say: vi.fn(),
    onCount: vi.fn(),
    onQueue: vi.fn(),
    onKept: vi.fn(),
    keptRead: true,
    laneLook: 'bands' as const,
    todayYmd: TODAY,
    nowIso: NOW,
    ...over,
  }
  renderWithProviders(<FollowUpPanel {...props} />)
  return props
}

const rowIn = (section: string, contactId: string) => within(screen.getByRole('region', { name: section }).querySelector<HTMLElement>(`[data-follow-up-row="${contactId}"]`)!)
const panel = () => document.querySelector('[data-follow-up-panel]')!
const stamp = () => document.querySelector<HTMLElement>('[data-kept-read-stamp]')
const keptUp = async () => {
  await waitFor(() => expect(stamp()).not.toBeNull())
  return stamp()!
}

beforeEach(() => {
  pending = []
  loadQueue.mockClear()
  readKept.mockReset()
  readKept.mockResolvedValue(stored())
  writeKept.mockClear()
})
afterEach(() => {
  cleanup()
  pending = []
})

describe('FollowUpPanel, the kept queue (punch list #183 PR 5)', () => {
  it('while the read hangs, draws who was waiting at the kept time under the stamp, hands the page the kept count, holds Take it and the row’s presses, and still opens a thread', async () => {
    const { onCount, onQueue, onKept, onOpenThread, io } = renderPanel()
    const line = await keptUp()
    expect(line.textContent).toMatch(/^Who was waiting at .+ · reading again…$/)
    expect(line.getAttribute('data-kept-read-stamp')).toBe('reading')
    expect(panel().hasAttribute('data-kept-read')).toBe(true)
    expect(readKept).toHaveBeenCalledWith(KEY)
    expect(screen.queryByText('Loading who is waiting on us…')).toBeNull()
    expect(screen.getByRole('heading', { name: 'New (1)' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Needs a reply (2)' })).toBeTruthy()
    // The lanes' counts mute under the attribute, as the bar's do.
    expect(screen.getByRole('region', { name: 'New' }).querySelector('.stagesBandCount')!.classList.contains('keptCount')).toBe(true)
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(3))
    expect(onKept).toHaveBeenLastCalledWith(KEPT_AT)
    const queueCalls = (onQueue as ReturnType<typeof vi.fn>).mock.calls
    const heard = queueCalls[queueCalls.length - 1]!
    expect(heard[0].count).toBe(3)
    expect(heard[1].map((c: { id: string }) => c.id)).toEqual(['marisol', 'dale', 'tomas'])

    // Take it on a kept row waits, inert, with the stamp's hint; so does a hand-off and No reply needed.
    const take = rowIn('New', 'marisol').getByRole('button', { name: 'Nobody has it · Take it' }) as HTMLButtonElement
    expect(take.disabled).toBe(true)
    expect(take.title).toBe('reading again…')
    expect(take.classList.contains('keptPress')).toBe(true)
    expect(take.hasAttribute('data-held')).toBe(true)
    // A press on it does nothing at all. Its pointer events stay on, over `keptPress`, or the press would fall through to the row and open the thread.
    expect(take.style.pointerEvents).toBe('auto')
    fireEvent.click(take)
    expect(io.takeIt).not.toHaveBeenCalled()
    expect(onOpenThread).not.toHaveBeenCalled()
    const rosaHas = rowIn('Needs a reply', 'dale').getByRole('button', { name: 'Rosa has this' }) as HTMLButtonElement
    expect(rosaHas.disabled).toBe(true)
    const noReply = rowIn('Needs a reply', 'dale').getByRole('button', { name: 'No reply needed' }) as HTMLButtonElement
    expect(noReply.disabled).toBe(true)
    expect(noReply.title).toBe('reading again…')
    expect((rowIn('Needs a reply', 'dale').getByRole('button', { name: 'Remind me Monday' }) as HTMLButtonElement).disabled).toBe(true)

    // Reading stays live: the row opens its thread at its line, and Reply opens it too.
    fireEvent.click(screen.getByRole('button', { name: 'Open Dale Ferris’s thread' }))
    expect(onOpenThread).toHaveBeenLastCalledWith('dale', 'm-dale')
    fireEvent.click(rowIn('Needs a reply', 'dale').getByRole('button', { name: 'Reply' }))
    expect(onOpenThread).toHaveBeenCalledTimes(2)
    expect(loadQueue).toHaveBeenCalledTimes(1)
    expect(writeKept).not.toHaveBeenCalled()
  })

  it('once the live read lands, the live lanes replace the kept ones, the presses are live, the stamp goes, and the queue is written as the device’s kept read', async () => {
    const { onCount, onKept } = renderPanel()
    await keptUp()
    await land(LIVE_ROWS)
    await screen.findByRole('heading', { name: 'Needs a reply (1)' })
    expect(screen.queryByRole('heading', { name: 'New (1)' })).toBeNull()
    expect(stamp()).toBeNull()
    expect(panel().hasAttribute('data-kept-read')).toBe(false)
    const rosaHas = rowIn('Needs a reply', 'greg').getByRole('button', { name: 'Rosa has this' }) as HTMLButtonElement
    expect(rosaHas.disabled).toBe(false)
    expect(rosaHas.hasAttribute('data-held')).toBe(false)
    expect((rowIn('Needs a reply', 'greg').getByRole('button', { name: 'No reply needed' }) as HTMLButtonElement).disabled).toBe(false)
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1))
    expect(onKept).toHaveBeenLastCalledWith(null)
    await waitFor(() => expect(writeKept).toHaveBeenCalledTimes(1))
    const written = writeKept.mock.calls[0]![0]
    expect(written.key).toBe(KEY)
    expect(written.scopes).toEqual(['queue'])
    const record = written.rows[0] as MessagesKeptQueue
    expect(record.count).toBe(1)
    expect(record.people.map((p) => p.id)).toEqual(['greg'])
    expect(record.lines.map((l) => l.id)).toEqual(['m-greg'])
  })

  it('a failed read over a kept queue keeps the lanes with the stamp’s Retry and the reason, and Retry reads again', async () => {
    renderPanel()
    const line = await keptUp()
    await fail(new DatabaseError('Failed to read Follow up: canceling statement due to statement timeout', '57014', null, { serverMessage: 'canceling statement due to statement timeout' }))
    await waitFor(() => expect(line.getAttribute('data-kept-read-stamp')).toBe('failed'))
    expect(line.textContent).toMatch(/could not read again/)
    expect(screen.getByRole('heading', { name: 'New (1)' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/statement timeout/)
    expect(panel().hasAttribute('data-kept-read')).toBe(true)
    expect(writeKept).not.toHaveBeenCalled()
    fireEvent.click(within(line).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(loadQueue).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(stamp()!.getAttribute('data-kept-read-stamp')).toBe('reading'))
    await land(LIVE_ROWS)
    await screen.findByRole('heading', { name: 'Needs a reply (1)' })
    expect(stamp()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('with nothing kept, a failed read names its failure by class: a lost signal offers Retry, a refusal its reason alone', async () => {
    readKept.mockResolvedValue(null)
    renderPanel()
    await act(async () => {})
    expect(screen.getByText('Loading who is waiting on us…')).toBeTruthy()
    await fail(new DatabaseError(OFFLINE_ERROR_MESSAGE, undefined, undefined, { kind: 'network' }))
    const retry = await screen.findByRole('button', { name: /retry/i })
    expect(screen.queryByText('Loading who is waiting on us…')).toBeNull()
    expect(panel().textContent).toContain(QUEUE_READ_OFFLINE_WORDS)
    expect(panel().textContent).not.toMatch(/saved/)
    expect(stamp()).toBeNull()
    expect(panel().hasAttribute('data-kept-read')).toBe(false)
    fireEvent.click(retry)
    await waitFor(() => expect(loadQueue).toHaveBeenCalledTimes(2))
    await land(LIVE_ROWS)
    await screen.findByRole('heading', { name: 'Needs a reply (1)' })
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()

    cleanup()
    renderPanel()
    await act(async () => {})
    await fail(new DatabaseError('Failed to read Follow up: Follow up is not switched on.', 'P0001', null, { serverMessage: 'Follow up is not switched on.' }))
    await waitFor(() => expect(screen.queryByText('Loading who is waiting on us…')).toBeNull())
    expect(panel().textContent).toMatch(/Follow up is not switched on\./)
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  })

  it('a lost signal that fails ahead of the store still draws the kept queue, with its counts and the stamp’s Retry', async () => {
    let answer: (kept: KeptRead) => void = () => {}
    readKept.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    const { onCount, onKept } = renderPanel()
    await waitFor(() => expect(readKept).toHaveBeenCalled())
    await fail(new DatabaseError(OFFLINE_ERROR_MESSAGE, undefined, undefined, { kind: 'network' }))
    await screen.findByRole('button', { name: /retry/i })
    expect(stamp()).toBeNull()
    await act(async () => answer(stored()))
    const line = await keptUp()
    expect(line.getAttribute('data-kept-read-stamp')).toBe('failed')
    expect(line.textContent).toMatch(/^Who was waiting at .+ · could not read again · Retry$/)
    expect(panel().hasAttribute('data-kept-read')).toBe(true)
    expect(screen.getByRole('heading', { name: 'Needs a reply (2)' })).toBeTruthy()
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(3))
    expect(onKept).toHaveBeenLastCalledWith(KEPT_AT)
    expect((rowIn('New', 'marisol').getByRole('button', { name: 'Nobody has it · Take it' }) as HTMLButtonElement).disabled).toBe(true)
    expect(writeKept).not.toHaveBeenCalled()
    // The stamp says it failed and the strip says why, so no line of its own, and never the write's *nothing was saved*.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(panel().textContent).not.toMatch(/saved/)

    // The signal comes back: the queue reads again with no press, and the live read lands over the kept one.
    expect(loadQueue).toHaveBeenCalledTimes(1)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(loadQueue).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(stamp()!.getAttribute('data-kept-read-stamp')).toBe('reading'))
    await land(LIVE_ROWS)
    await screen.findByRole('heading', { name: 'Needs a reply (1)' })
    expect(stamp()).toBeNull()
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(loadQueue).toHaveBeenCalledTimes(2)
  })

  it('holds every press that writes on every kind of row, and leaves the doors that only read or dial live', async () => {
    const rows: FollowUpRows = {
      ...KEPT_ROWS,
      contacts: [
        ...KEPT_ROWS.contacts,
        person('elena', 'customer', { customer_contact_person_id: 'cp-elena' }),
        person('kevin', 'lead', { name: 'Kevin Alvarez', has_user_id: ME.id, has_since: '2026-10-01T16:00:00.000Z', has_how: 'took' }),
        person('nadia', 'customer', { customer_contact_person_id: 'cp-nadia' }),
      ],
      channels: [{ id: 'ch-nadia', contact_id: 'nadia', kind: 'phone', value: '512-555-0142', opted_out_at: null, created_at: '2026-10-01T15:00:00.000Z' }],
      records: {
        ...KEPT_ROWS.records,
        customerContactPersons: [...(KEPT_ROWS.records?.customerContactPersons ?? []), { id: 'cp-elena', customer_id: 'cust-pena', name: 'Elena Marchetti' }, { id: 'cp-nadia', customer_id: 'cust-reyes', name: 'Nadia Ruiz' }],
      },
      messages: [
        ...KEPT_ROWS.messages,
        { ...text('n-elena', 'elena', '2026-09-28T15:00:00.000Z', 'Call Elena about the gate code.'), channel: 'note', direction: 'team', who_user_id: ROSA.id, back_on: TODAY, back_by: ROSA.id },
        text('m-kevin', 'kevin', '2026-10-01T17:00:00.000Z', 'Do you do water heaters?'),
      ],
      callTasks: [{ id: 'call-nadia', contact_id: 'nadia', step_key: 'estimate', bid_id: null, project_id: null, jobs_ledger_id: 'job-7', due_on: '2026-10-03', what: 'about the estimate', script: 'Hi Nadia, this is Rosa.', made_by: ROSA.id, made_at: '2026-10-02T15:00:00.000Z', done_at: null }],
      setAside: [{ id: 'sa-1', mailbox: 'bids', from_address: 'noreply@planroom.example', from_name: 'PlanRoom', subject: 'Weekly digest', at: '2026-10-02T12:00:00.000Z', reason: 'marked_address' }],
    }
    const input = followUpInputFromRows(rows, TODAY, NAMES)
    const queue = followUpQueue(input, { newLane: followUpNewLane(input, {}, NOW) })
    // Two in New, so Sort all draws on its header.
    const second = { ...queue.newLane[0]!, contactId: 'dale', messageId: 'm-dale' }
    const record = buildMessagesKeptQueue({ queue: { ...queue, newLane: [...queue.newLane, second], needsReply: queue.needsReply.filter((r) => r.contactId !== 'dale') }, contacts: input.contacts, lines: new Map(input.messages.map((m) => [m.id, m])), setAside: rows.setAside ?? [] })
    readKept.mockResolvedValue({ ...stored(), rows: record })
    renderPanel({ answerAll: { on: true, onChange: vi.fn(), thread: { view: null, nowIso: NOW, searchJobs: vi.fn(async () => []) } } })
    await keptUp()
    const held = (scope: ReturnType<typeof rowIn> | typeof screen, name: string) => {
      const press = scope.getByRole('button', { name }) as HTMLButtonElement
      expect(press.disabled, name).toBe(true)
      expect(press.title, name).toBe('reading again…')
    }
    held(screen, 'Sort all')
    held(screen, 'Answer all')
    const back = rowIn('Needs you', 'elena')
    held(back, 'Done with it')
    held(back, 'Another day')
    expect((back.getByRole('button', { name: 'Open the thread' }) as HTMLButtonElement).disabled).toBe(false)
    const lead = rowIn('Needs a reply', 'kevin')
    held(lead, 'Book a visit')
    held(lead, 'Start an estimate')
    held(lead, 'No reply needed')
    held(lead, 'Robert has this')
    expect((lead.getByRole('button', { name: 'Reply' }) as HTMLButtonElement).disabled).toBe(false)
    const call = rowIn('We owe them', 'nadia')
    held(call, 'I called')
    held(call, 'Tomorrow')
    held(call, 'Skip')
    // Call dials and the script opens: neither writes.
    expect(call.getByRole('link', { name: /Call/ }).getAttribute('href')).toContain('tel:')
    fireEvent.click(call.getByRole('button', { name: 'What to say' }))
    expect(screen.getByText('Hi Nadia, this is Rosa.')).toBeTruthy()
    held(within(document.querySelector<HTMLElement>('[data-set-aside-row="sa-1"]')!), 'Put back')
    // The desk a link opens waits for the live read.
    expect(document.querySelector('[data-answer-all-desk]')).toBeNull()
  })

  it('reads the day words against the clock: a read kept last evening does not say today this morning', async () => {
    renderPanel({ todayYmd: '2026-10-03', nowIso: '2026-10-03T13:00:00.000Z' })
    await keptUp()
    const row = rowIn('New', 'marisol')
    expect(row.getByText(/yesterday/)).toBeTruthy()
    expect(row.queryByText(/today at/)).toBeNull()
  })

  it('without keptRead (GC projects’ tab) reads nothing from the store and writes nothing', async () => {
    renderPanel({ keptRead: false })
    await act(async () => {})
    expect(screen.getByText('Loading who is waiting on us…')).toBeTruthy()
    expect(readKept).not.toHaveBeenCalled()
    await land(LIVE_ROWS)
    await screen.findByRole('heading', { name: 'Needs a reply (1)' })
    expect(writeKept).not.toHaveBeenCalled()
    expect(panel().hasAttribute('data-kept-read')).toBe(false)
  })
})
