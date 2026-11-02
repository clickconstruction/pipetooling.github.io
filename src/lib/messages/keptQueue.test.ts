/**
 * Messages' kept queue (punch list #183 PR 5): the record `/messages` keeps on the device. Built from the queue the
 * kernels make of made-up rows (the panel smoke's people), so what is kept is what the lanes drew: the people the
 * lanes name and no one else, the lines the rows quote and nothing else of the thread, the badge's count; unpacked
 * back into the queue the panel draws with its portal question rebuilt; and voided when a stored record is off the
 * shape. Nothing here is a real row.
 */
import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { followUpInputFromRows, followUpNewLane, type ContactOwedRow, type FollowUpContactRow, type FollowUpMessageRow, type FollowUpRows, type MessagePromiseRow } from '../followUp/followUpRows'
import { followUpQueue, type PortalRow } from '../followUp/queue'
import { KEPT_READ_SCHEMA, MESSAGES_KEPT_LEAD, buildKeptRead, keptReadIsUsable, keptReadStampWords, parseKeptRead } from '../keptRead'
import { buildMessagesKeptQueue, keptLanesToday, linesQuotedByLanes, MESSAGES_KEPT_SCOPES, messagesKeptKey, messagesKeptRowIsValid, peopleNamedByLanes, unpackMessagesKeptQueue, type MessagesKeptQueue, type MessagesQueueSource } from './keptQueue'

const TODAY = '2026-10-02'
const NOW = '2026-10-02T17:00:00.000Z'
const CLOCK = { todayYmd: TODAY, nowIso: NOW }
const NAMES = { 'u-rosa': 'Rosa', 'u-robert': 'Robert' }

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
 * Greg's plans question with Rosa holding him, Priya's voicemail and the start date owed, Elena's note back today, her
 * portal write and a call to make, an address nobody has named in New, and Dana, done, whom no lane names.
 */
const ROWS: FollowUpRows = {
  contacts: [
    person('greg', 'trade', { gc_company_id: 'hillside', has_user_id: 'u-rosa', has_since: '2026-10-01T15:00:00.000Z', has_how: 'handed' }),
    person('priya', 'customer', { customer_contact_person_id: 'helotes-priya', has_user_id: 'u-rosa', has_since: '2026-09-26T19:30:00.000Z', has_how: 'took' }),
    person('elena', 'customer', { customer_contact_person_id: 'cibolo-elena' }),
    person('unk1', 'unknown', { name: 'Wade Lindqvist' }),
    person('dana', 'customer', { name: 'Dana Whitlock', state: 'done' }),
  ],
  channels: [{ id: 'ch-unk', contact_id: 'unk1', kind: 'email', value: 'wade@ridgeway.example', opted_out_at: null, created_at: '2026-10-02T15:00:00.000Z' }],
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
    line('m-unk', 'unk1', 'email', 'in', '2026-10-02T15:00:00.000Z', 'Is this the plumbing office?', { subject: 'Plumbing office?' }),
    line('m-dana', 'dana', 'text', 'in', '2026-09-20T15:00:00.000Z', 'Thanks again.'),
  ],
  heard: [question('q-greg', 'm-greg', 'greg', '2026-10-01T14:00:00.000Z')],
  owed: [owed('o-priya', 'priya', 'the start date', '2026-10-05')],
  callTasks: [{ id: 'call-elena', contact_id: 'elena', step_key: 'estimate', bid_id: null, project_id: null, jobs_ledger_id: 'job-7', due_on: '2026-10-03', what: 'about the estimate', script: 'Hi Elena, this is Rosa.', made_by: 'u-rosa', made_at: '2026-10-02T15:00:00.000Z', done_at: null }],
  setAside: [{ id: 'sa-1', mailbox: 'bids', from_address: 'noreply@planroom.example', from_name: 'PlanRoom', subject: 'Weekly digest', at: '2026-10-02T12:00:00.000Z', reason: 'a marked sender' }],
}

/** The queue as the panel's hook builds it, with every line's file list attached as the thread would carry it. */
function liveSource(rows: FollowUpRows = ROWS): MessagesQueueSource {
  const input = followUpInputFromRows(rows, TODAY, NAMES)
  const newLane = followUpNewLane(input, rows.jobStates ?? {}, NOW)
  const queue = followUpQueue(input, { newLane })
  const lines = new Map(input.messages.map((m) => [m.id, { ...m, files: [{ id: 'f1', name: 'photo.jpg' }] } as typeof m]))
  return { queue, contacts: input.contacts, lines, setAside: rows.setAside ?? [] }
}

describe('messagesKeptKey', () => {
  it('is one key per person, under the Messages page, with the one scope', () => {
    expect(messagesKeptKey('u1')).toBe('u1:messages:queue')
    expect(messagesKeptKey('u2')).not.toBe(messagesKeptKey('u1'))
    expect(MESSAGES_KEPT_SCOPES).toEqual(['queue'])
    expect(keptReadStampWords({ readAt: Date.UTC(2026, 9, 2, 12, 52), lead: MESSAGES_KEPT_LEAD, failed: false, format: { timeZone: APP_CALENDAR_TZ } }).text).toBe('Who was waiting at 7:52 AM · reading again…')
  })
})

describe('buildMessagesKeptQueue', () => {
  it('keeps the lanes as drawn, the count, the people the lanes name and the lines they quote, and nothing else', () => {
    const source = liveSource()
    const rows = buildMessagesKeptQueue(source)
    expect(rows).toHaveLength(1)
    const kept = rows[0]!
    expect(kept.lanes.newLane.map((r) => r.contactId)).toEqual(['unk1'])
    expect(kept.lanes.needsYou.map((r) => [r.kind, r.contactId])).toEqual([
      ['back', 'elena'],
      ['portal', 'elena'],
    ])
    expect(kept.lanes.needsReply.map((r) => r.contactId)).toEqual(['greg', 'priya'])
    expect(kept.lanes.weOwe.map((r) => r.contactId)).toEqual(['priya'])
    expect(kept.lanes.calls.map((r) => r.id)).toEqual(['call-elena'])
    expect(kept.count).toBe(source.queue.count)
    expect(kept.count).toBe(4)
    // The people in the lanes' order, once each; Dana, done, is named by no lane and is not kept.
    expect(kept.people.map((p) => p.id)).toEqual(['unk1', 'elena', 'greg', 'priya'])
    expect(kept.people.find((p) => p.id === 'greg')).toMatchObject({ has: 'Rosa', hasUserId: 'u-rosa', hasHow: 'handed' })
    // The lines the rows quote: the New row's email, the reply rows' newest lines, the note, the portal write. Not Dana's.
    expect(kept.lines.map((l) => l.id).sort()).toEqual(['m-elena', 'm-greg', 'm-priya', 'm-unk', 'n-elena'])
    for (const l of kept.lines) expect('files' in l).toBe(false)
    expect(kept.lines.find((l) => l.id === 'm-unk')).toMatchObject({ channel: 'email', subject: 'Plumbing office?', body: 'Is this the plumbing office?' })
    expect(kept.setAside).toEqual(ROWS.setAside)
    expect(messagesKeptRowIsValid(kept)).toBe(true)
  })

  it('lists the people and the lines once each across the lanes', () => {
    const { lanes } = buildMessagesKeptQueue(liveSource())[0]!
    expect(peopleNamedByLanes(lanes)).toEqual(['unk1', 'elena', 'greg', 'priya'])
    expect(linesQuotedByLanes(lanes).sort()).toEqual(['m-elena', 'm-greg', 'm-priya', 'm-unk', 'n-elena'])
  })

  it('survives the store: the record parses back under the kept read’s rules and unpacks to the same lanes', () => {
    const source = liveSource()
    const kept = buildKeptRead({ key: messagesKeptKey('u1'), scopes: MESSAGES_KEPT_SCOPES, rows: buildMessagesKeptQueue(source), now: 1_700_000_000_000 })
    // IndexedDB keeps a structured clone: a function or a Map in the record would refuse the write and keep nothing.
    expect(structuredClone(kept)).toEqual(kept)
    const stored = JSON.parse(JSON.stringify(kept)) as unknown
    const parsed = parseKeptRead(stored, messagesKeptRowIsValid)
    expect(parsed).not.toBeNull()
    expect(parsed!.schema).toBe(KEPT_READ_SCHEMA)
    expect(keptReadIsUsable({ kept: parsed, key: messagesKeptKey('u1'), wantedScopes: MESSAGES_KEPT_SCOPES, now: 1_700_000_000_000 + 60_000 })).toBe(true)
    const back = unpackMessagesKeptQueue(parsed!.rows as MessagesKeptQueue[], CLOCK)!
    expect(back.queue.needsReply).toEqual(source.queue.needsReply)
    expect(back.queue.newLane).toEqual(source.queue.newLane)
    expect(back.queue.weOwe).toEqual(source.queue.weOwe)
    expect(back.queue.calls).toEqual(source.queue.calls)
    expect(back.queue.count).toBe(4)
    expect(back.lines.get('m-greg')?.body).toBe('Is the detention pond in sitework or ours?')
    expect(back.contacts.map((c) => c.id)).toEqual(['unk1', 'elena', 'greg', 'priya'])
  })
})

describe('unpackMessagesKeptQueue', () => {
  const portal: PortalRow = {
    kind: 'portal',
    contactId: 'elena',
    pill: 'not opened',
    sub: 'Change order 2',
    snippet: 'Change order 2 · a sink in exam 3 · sent Wed Sep 30, 2 days · not opened',
    why: 'They have not opened it.',
    papers: [{ id: 'co-2', name: 'Change order 2 · a sink in exam 3', sentYmd: '2026-09-30', days: 2, openedYmd: null, label: 'Change order 2 · not opened' }],
    more: null,
  }
  const record = (): MessagesKeptQueue => ({
    lanes: { newLane: [], needsYou: [portal], needsReply: [], weOwe: [], calls: [] },
    count: 1,
    people: [{ id: 'elena', kind: 'customer', name: 'Elena Marchetti', state: 'waiting', hasUserId: null, hasSince: null, hasHow: null }],
    lines: [],
    setAside: [],
  })

  it('rebuilds the queue with empty pass-through lanes and the portal question from the portal rows', () => {
    const back = unpackMessagesKeptQueue(buildMessagesKeptQueue({ queue: { ...record().lanes, clauses: [], nudges: [], onPortal: () => false, count: 1 }, contacts: record().people, lines: new Map(), setAside: [] }), CLOCK)!
    expect(back.queue.clauses).toEqual([])
    expect(back.queue.nudges).toEqual([])
    expect(back.queue.onPortal('elena', 'change order', 'co-2')).toBe(true)
    expect(back.queue.onPortal('elena', 'change order', 'co-9')).toBe(false)
    expect(back.queue.onPortal('elena', 'change order', null)).toBe(false)
    expect(back.contacts).toEqual(record().people)
  })

  it('is null with no record', () => {
    expect(unpackMessagesKeptQueue([], CLOCK)).toBeNull()
  })

  it('reads the day words against the clock it is handed', () => {
    const back = unpackMessagesKeptQueue(buildMessagesKeptQueue(liveSource()), { todayYmd: '2026-10-03', nowIso: '2026-10-03T13:00:00.000Z' })!
    expect(back.queue.newLane[0]!.when).toBe('yesterday')
    expect(back.queue.calls[0]!.pill).toBe('call · today')
  })
})

describe('keptLanesToday', () => {
  const { lanes } = buildMessagesKeptQueue(liveSource())[0]!
  const back = (l: typeof lanes) => l.needsYou.find((r) => r.kind === 'back')!.pill

  it('leaves the words as they were on the day of the read', () => {
    const same = keptLanesToday(lanes, CLOCK)
    expect(same.newLane[0]!.when).toBe(lanes.newLane[0]!.when)
    expect(same.newLane[0]!.when).toMatch(/^today at /)
    expect(back(same)).toBe('back today')
    expect(same.weOwe).toEqual(lanes.weOwe)
    expect(same.calls).toEqual(lanes.calls)
    expect(same.needsReply).toEqual(lanes.needsReply)
  })

  it('a read kept last evening, drawn this morning: today reads yesterday, a call due today reads today, and nothing else moves', () => {
    const morning = keptLanesToday(lanes, { todayYmd: '2026-10-03', nowIso: '2026-10-03T13:00:00.000Z' })
    expect(morning.newLane[0]!.when).toBe('yesterday')
    expect(back(morning)).toBe('back since Fri Oct 2')
    expect(morning.calls[0]).toMatchObject({ id: 'call-elena', pill: 'call · today', today: true, late: false })
    expect(morning.weOwe[0]).toMatchObject({ contactId: 'priya', late: false })
    expect(morning.needsReply).toEqual(lanes.needsReply)
    expect(morning.needsYou.find((r) => r.kind === 'portal')).toEqual(lanes.needsYou.find((r) => r.kind === 'portal'))
  })

  it('past its day, what we owe and a call read late', () => {
    const later = keptLanesToday(lanes, { todayYmd: '2026-10-06', nowIso: '2026-10-06T13:00:00.000Z' })
    expect(later.weOwe[0]!.late).toBe(true)
    expect(later.calls[0]).toMatchObject({ pill: 'call · Sat Oct 3, late', today: false, late: true })
  })
})

describe('messagesKeptRowIsValid', () => {
  const good = () => buildMessagesKeptQueue(liveSource())[0]!
  const broken = (mutate: (r: Record<string, unknown>) => void) => {
    const r = JSON.parse(JSON.stringify(good())) as Record<string, unknown>
    mutate(r)
    return r
  }

  it('accepts the record the kernel builds, through the store’s copy', () => {
    expect(messagesKeptRowIsValid(JSON.parse(JSON.stringify(good())))).toBe(true)
  })

  it('voids a record off the shape: no count, a lane row with no person, a person with no name, a lane with an unknown kind, no lanes at all', () => {
    expect(messagesKeptRowIsValid(null)).toBe(false)
    expect(messagesKeptRowIsValid('queue')).toBe(false)
    expect(messagesKeptRowIsValid(broken((r) => delete r.count))).toBe(false)
    expect(messagesKeptRowIsValid(broken((r) => ((r.lanes as Record<string, unknown[]>).needsReply![0] as Record<string, unknown>).contactId = ''))).toBe(false)
    expect(messagesKeptRowIsValid(broken((r) => delete ((r.people as Record<string, unknown>[])[0] as Record<string, unknown>).name))).toBe(false)
    expect(messagesKeptRowIsValid(broken((r) => (((r.lanes as Record<string, unknown[]>).needsYou![0] as Record<string, unknown>).kind = 'clause')))).toBe(false)
    expect(messagesKeptRowIsValid(broken((r) => delete r.lanes))).toBe(false)
    expect(messagesKeptRowIsValid(broken((r) => (r.lines = [{ id: 'x' }])))).toBe(false)
    expect(messagesKeptRowIsValid(broken((r) => (r.setAside = [{ id: 'sa' }])))).toBe(false)
  })
})
