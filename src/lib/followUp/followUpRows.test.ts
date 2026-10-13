import { describe, expect, it } from 'vitest'
import type { ContactChannelRow } from '../contacts/load'
import {
  followUpContactsFromRows,
  followUpInputFromRows,
  followUpMessagesFromRows,
  followUpNewLane,
  heardLinesFromRows,
  highlightsFromRows,
  owedRecordsFromRows,
  type ContactOwedRow,
  type FollowUpContactRow,
  type FollowUpMessageRow,
  type FollowUpRows,
  type MessagePromiseRow,
} from './followUpRows'
import { followUpQueue } from './queue'

const TODAY = '2026-10-02'
const USERS = { 'u-rosa': 'Rosa', 'u-robert': 'Robert' }

const contact = (id: string, patch: Partial<FollowUpContactRow>): FollowUpContactRow => ({
  id,
  kind: 'trade',
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
  state: 'done',
  snoozed_until: null,
  has_user_id: null,
  has_since: null,
  has_how: null,
  ...patch,
})

const line = (id: string, contactId: string, patch: Partial<FollowUpMessageRow>): FollowUpMessageRow => ({
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
  at: '2026-10-02T14:00:00.000Z',
  subject: null,
  body: '',
  optout_line: null,
  back_on: null,
  back_by: null,
  back_words: null,
  back_done_at: null,
  ...patch,
})

/** The prototype's Greg (Hillside's own person), Priya (a person at Helotes Dental) and an unknown number, as the tables hold them. */
const ROWS: FollowUpRows = {
  contacts: [
    contact('greg', { gc_company_id: 'gc-hillside', state: 'waiting' }),
    contact('priya', { kind: 'customer', customer_contact_person_id: 'ccp-priya', state: 'waiting', has_user_id: 'u-rosa', has_since: '2026-09-26T19:30:00.000Z', has_how: 'took' }),
    contact('unk1', { kind: 'unknown', state: 'waiting' }),
    contact('bill', { state: 'later' }),
  ],
  channels: [{ id: 'ch-unk', contact_id: 'unk1', kind: 'phone', value: '(830) 555-0172', opted_out_at: null, created_at: '2026-10-02T14:12:00.000Z' } as ContactChannelRow],
  records: {
    gcCompanies: [{ id: 'gc-hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }],
    customers: [{ id: 'cust-helotes', name: 'Helotes Dental Office' }],
    customerContactPersons: [{ id: 'ccp-priya', customer_id: 'cust-helotes', name: 'Dr. Priya Raman' }],
  },
  messages: [
    line('8', 'priya', { at: '2026-09-26T19:14:00.000Z', body: 'Can you send me the start date when you have it?' }),
    line('9', 'priya', { channel: 'note', direction: 'team', who_text: 'Rosa', at: '2026-09-26T19:30:00.000Z', body: 'Tell her Monday.', back_on: '2026-10-02', back_by: 'u-rosa' }),
    line('14', 'unk1', { at: '2026-10-02T14:12:00.000Z', body: 'Can we quote the concrete?' }),
    line('16', 'greg', { channel: 'email', at: '2026-10-02T16:30:00.000Z', body: 'Numbers attached.' }),
    line('99', 'greg', { channel: 'fax', body: 'a channel this build does not know' }),
  ],
  heard: [
    { id: 'h3', message_id: '16', kind: null, state: 'offered', day: '2026-10-07', day_words: null, writes: null, decided_by: null, decided_at: null, message: { contact_id: 'greg', at: '2026-10-02T16:30:00.000Z' } },
    { id: 'h4', message_id: '16', kind: 'question', state: 'offered', day: null, day_words: null, writes: null, decided_by: null, decided_at: null, message: { contact_id: 'greg', at: '2026-10-02T16:30:00.000Z' } },
  ],
  owed: [
    { id: 'o1', contact_id: 'priya', what: 'the start date', by_day: '2026-10-05', by_words: null, marked_by: 'u-rosa', marked_at: '2026-09-26T19:30:00.000Z', done_at: null, done_how: null, done_note_message_id: null },
  ],
}

describe('followUpContactsFromRows', () => {
  it('names each person as the screens do, with the state and who has it by name', () => {
    const people = followUpContactsFromRows(ROWS, USERS)
    expect(people.map((c) => [c.id, c.name, c.company, c.state, c.has, c.hasHow])).toEqual([
      ['greg', 'Greg Paulk', 'Hillside Excavation', 'waiting', null, null],
      ['priya', 'Dr. Priya Raman', 'Helotes Dental Office', 'waiting', 'Rosa', 'took'],
      ['unk1', '(830) 555-0172', '', 'waiting', null, null],
      ['bill', '', '', 'done', null, null],
    ])
    expect(people[0]!.trade).toBe('Sitework')
  })

  it('reads a state it does not know as done, a snooze without its state as no day, and an unknown teammate as Someone', () => {
    const rows: FollowUpRows = {
      ...ROWS,
      contacts: [contact('x', { state: 'snoozed', snoozed_until: '2026-10-05', has_user_id: 'u-gone', has_since: '2026-10-01T00:00:00.000Z', has_how: 'by magic' })],
    }
    expect(followUpContactsFromRows(rows, USERS)[0]).toMatchObject({ state: 'snoozed', snoozedUntil: '2026-10-05', has: 'Someone', hasHow: null })
  })
})

describe('the lines, the days heard, what we owe and highlights', () => {
  it('carries a note’s day in words and when it was dealt with, and leaves out a channel it does not know', () => {
    const lines = followUpMessagesFromRows([...ROWS.messages, line('50', 'priya', { channel: 'note', direction: 'team', back_words: 'after the award', back_done_at: '2026-10-02T15:00:00.000Z' })])
    expect(lines.map((m) => m.id)).toEqual(['8', '9', '14', '16', '50'])
    expect(lines.find((m) => m.id === '50')).toMatchObject({ backWords: 'after the award', backDoneAt: '2026-10-02T15:00:00.000Z' })
  })

  it('reads a heard day and a plans question, and leaves out what it cannot read', () => {
    const odd: MessagePromiseRow[] = [
      { ...ROWS.heard[0]!, id: 'x1', kind: 'gossip' },
      { ...ROWS.heard[0]!, id: 'x2', message: null },
      { ...ROWS.heard[1]!, id: 'x3', state: 'written' },
    ]
    expect(heardLinesFromRows([...ROWS.heard, ...odd])).toEqual([
      { messageId: '16', contactId: 'greg', at: '2026-10-02T16:30:00.000Z', kind: null, state: 'offered', dayYmd: '2026-10-07', dayWords: null, writes: null },
      { messageId: '16', contactId: 'greg', at: '2026-10-02T16:30:00.000Z', kind: 'question', state: 'offered' },
    ])
  })

  it('names who marked what we owe, and who highlighted, oldest highlight first', () => {
    const gone: ContactOwedRow = { ...ROWS.owed[0]!, id: 'o2', marked_by: null }
    expect(owedRecordsFromRows([...ROWS.owed, gone], USERS).map((o) => o.markedBy)).toEqual(['Rosa', 'Someone'])
    const lit = highlightsFromRows(
      [
        { id: 'h2', message_id: '16', text: 'rock clause', highlighted_by: 'u-robert', highlighted_at: '2026-10-02T17:00:00.000Z' },
        { id: 'h1', message_id: '16', text: 'detention pond', highlighted_by: 'u-rosa', highlighted_at: '2026-10-02T16:45:00.000Z' },
      ],
      USERS,
    )
    expect(lit.get('16')!.map((h) => [h.text, h.by])).toEqual([
      ['detention pond', 'Rosa'],
      ['rock clause', 'Robert'],
    ])
  })
})

describe('followUpInputFromRows into the queue', () => {
  it('reads the prototype’s Friday from the rows the tables hold', () => {
    const queue = followUpQueue(followUpInputFromRows(ROWS, TODAY, USERS))
    expect(queue.needsReply.map((r) => r.contactId)).toEqual(['priya', 'unk1', 'greg'])
    expect(queue.needsYou.map((r) => [r.kind, r.contactId, r.kind === 'back' ? r.noteBy : r.pill])).toEqual([['back', 'priya', 'the note by Rosa, Fri Oct 2']])
    expect(queue.weOwe.map((r) => r.pill)).toEqual(['we owe the start date · by Mon Oct 5'])
    expect(queue.needsReply.find((r) => r.contactId === 'greg')!.offers.map((o) => o.kind)).toEqual(['day', 'question'])
    expect(queue.count).toBe(3)
  })
})

describe('the New lane from the rows (residential R7)', () => {
  // Greg's two jobs, the default one taking his email without anyone tying it; Hillside's other job closed.
  const withJobs: FollowUpRows = {
    ...ROWS,
    contacts: ROWS.contacts.map((c) => (c.id === 'greg' ? { ...c, has_user_id: 'u-robert', has_since: '2026-10-01T15:00:00.000Z', has_how: 'handed' } : c)),
    messages: ROWS.messages.map((m) => (m.id === '16' ? { ...m, project_id: 'p-boerne', mailbox: 'bids', tied_by: null } : m)),
    jobs: [
      { contact_id: 'greg', bid_id: null, project_id: 'p-boerne', jobs_ledger_id: null, is_default: true, created_at: '2026-09-01T00:00:00.000Z' },
      { contact_id: 'greg', bid_id: 'b-cibolo', project_id: null, jobs_ledger_id: null, is_default: false, created_at: '2026-09-02T00:00:00.000Z' },
    ],
    jobStates: { bids: [{ id: 'b-cibolo', outcome: null }], projects: [{ project_id: 'p-boerne', stage: 'building', lost_on: null }] },
  }
  const NOW = '2026-10-02T17:00:00.000Z'

  it('reads each line’s box and tie, and each person’s jobs', () => {
    const input = followUpInputFromRows(withJobs, TODAY, USERS)
    expect(input.messages.find((m) => m.id === '16')).toMatchObject({ mailbox: 'bids', tiedByHand: false, jobId: 'project:p-boerne' })
    expect(input.contacts.find((c) => c.id === 'greg')).toMatchObject({ jobIds: ['project:p-boerne', 'bid:b-cibolo'], defaultJobId: 'project:p-boerne' })
  })

  it('sorts the number nobody named and the line the default took, and leaves them out of Needs a reply', () => {
    const input = followUpInputFromRows(withJobs, TODAY, USERS)
    const queue = followUpQueue(input, { newLane: followUpNewLane(input, withJobs.jobStates ?? {}, NOW) })
    expect(queue.newLane.map((r) => [r.contactId, r.sort, r.via])).toEqual([
      ['unk1', 'who', 'Text'],
      ['greg', 'job', 'Email to bids@'],
    ])
    expect(queue.needsReply.map((r) => r.contactId)).toEqual(['priya'])
    expect(queue.count).toBe(3)
  })

  it('leaves Greg in Needs a reply once someone tied his line, or when one of his jobs is closed', () => {
    const tied = { ...withJobs, messages: withJobs.messages.map((m) => (m.id === '16' ? { ...m, tied_by: 'u-rosa' } : m)) }
    const tiedInput = followUpInputFromRows(tied, TODAY, USERS)
    expect(followUpQueue(tiedInput, { newLane: followUpNewLane(tiedInput, tied.jobStates ?? {}, NOW) }).newLane.map((r) => r.contactId)).toEqual(['unk1'])
    const closed = { bids: [{ id: 'b-cibolo', outcome: 'lost' }], projects: [{ project_id: 'p-boerne', stage: 'building', lost_on: null }] }
    const input = followUpInputFromRows(withJobs, TODAY, USERS)
    expect(followUpQueue(input, { newLane: followUpNewLane(input, closed, NOW) }).newLane.map((r) => r.contactId)).toEqual(['unk1'])
  })
})
