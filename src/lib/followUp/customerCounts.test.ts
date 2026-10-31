import { describe, expect, it } from 'vitest'
import { customerMessageCounts, CUSTOMERS_PILL } from './customerCounts'
import { DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, DEMO_HEARD, DEMO_OWED, DEMO_PORTAL_PAPERS, DEMO_TODAY } from './followUpDemo'
import type { NewLaneRow } from './newLane'
import { followUpQueue, type FollowUpInput, type OwedRecord, type QueueContact, type QueueMessage } from './queue'

const demo: FollowUpInput = {
  contacts: DEMO_FOLLOW_UP_CONTACTS,
  messages: DEMO_FOLLOW_UP_MESSAGES,
  heard: DEMO_HEARD,
  owed: DEMO_OWED,
  portalPapers: DEMO_PORTAL_PAPERS,
  todayYmd: DEMO_TODAY,
}

const counts = (input: FollowUpInput) => customerMessageCounts(followUpQueue(input), input.contacts)

/** The mockups' residential people: Dana Whitfield on Oakridge Trl and the Alvarez family. Nothing here is a real row. */
const dana: QueueContact = { id: 'dana', kind: 'customer', name: 'Dana Whitfield', state: 'waiting' }
const kevin: QueueContact = { id: 'kevin', kind: 'customer', name: 'Kevin Alvarez', state: 'done' }
const line = (id: string, contactId: string, patch: Partial<QueueMessage> = {}): QueueMessage => ({
  id,
  contactId,
  channel: 'text',
  direction: 'in',
  at: '2026-10-02T14:00:00.000Z',
  body: '',
  ...patch,
})
const owedKevin: OwedRecord = { contactId: 'kevin', what: 'the water heater quote', byYmd: '2026-10-05', byWords: null, markedBy: 'Rosa', markedAt: '2026-10-01T15:00:00.000Z' }

describe('customerMessageCounts', () => {
  it('reads the prototype’s Friday: Elena and Priya need a reply, Priya is owed, and the unknown number is not a customer', () => {
    // Greg is a trade partner, so his open thread is not a customer’s. Priya’s unopened change order waits on her, not on us.
    // The number nobody has named sorts under All alone, as the Customers pill hides them.
    expect(counts(demo)).toEqual({ needReply: 2, weOwe: 1, toSort: 0 })
  })

  it('counts the customers in New as to sort, from the lane the Customers pill shows, and no sender nobody named', () => {
    const lane = (contactId: string, kind: NewLaneRow['kind'], sort: NewLaneRow['sort']): NewLaneRow => ({
      contactId,
      invitation: null,
      sort,
      head: sort,
      who: contactId,
      kind,
      company: '',
      messageId: `m-${contactId}`,
      channel: 'text',
      words: '',
      body: '',
      at: '2026-10-02T14:00:00.000Z',
      when: 'today',
      mailbox: 'team',
      via: 'Text on the team number',
      why: '',
      jobIds: [],
      defaultJobId: null,
      autoLine: null,
    })
    const contacts: QueueContact[] = [dana, { ...kevin, state: 'waiting' }, { id: 'unk1', kind: 'unknown', name: '(210) 555-0188', state: 'waiting' }, { id: 'greg', kind: 'trade', name: 'Greg Paulk', state: 'waiting' }]
    // As the queue builds it, the lane's people leave Needs a reply.
    const queue = { ...followUpQueue({ contacts, messages: [], todayYmd: DEMO_TODAY }), needsReply: [], newLane: [lane('dana', 'customer', 'has'), lane('kevin', 'customer', 'job'), lane('unk1', 'unknown', 'who'), lane('greg', 'trade', 'has')] }
    expect(customerMessageCounts(queue, contacts)).toEqual({ needReply: 0, weOwe: 0, toSort: 2 })
    expect(CUSTOMERS_PILL).toBe('customer')
  })

  it('counts a customer who wrote on their portal page as needing a reply, once', () => {
    const input: FollowUpInput = {
      contacts: [dana],
      messages: [line('d1', 'dana', { at: '2026-10-02T13:00:00.000Z' }), line('d2', 'dana', { channel: 'portal', body: 'Can you do Thursday?' })],
      todayYmd: DEMO_TODAY,
    }
    const queue = followUpQueue(input)
    expect(queue.needsReply).toEqual([])
    expect(queue.needsYou.map((r) => r.kind)).toEqual(['portal'])
    expect(counts(input)).toEqual({ needReply: 1, weOwe: 0, toSort: 0 })
  })

  it('counts what we owe a customer whose thread is done, and not one whose snooze has not come', () => {
    const snoozed: QueueContact = { ...dana, state: 'snoozed', snoozedUntil: '2026-10-05' }
    const input: FollowUpInput = { contacts: [snoozed, kevin], messages: [line('d1', 'dana')], owed: [owedKevin], todayYmd: DEMO_TODAY }
    expect(counts(input)).toEqual({ needReply: 0, weOwe: 1, toSort: 0 })
  })

  it('leaves out trade partners and architects, and a sender nobody named whose thread is done', () => {
    const input: FollowUpInput = {
      contacts: [
        { id: 'greg', kind: 'trade', name: 'Greg Paulk', state: 'waiting' },
        { id: 'arch', kind: 'arch', name: 'Marcus Bell', state: 'waiting' },
        { id: 'unk2', kind: 'unknown', name: '(830) 555-0190', state: 'done' },
      ],
      messages: [line('g1', 'greg'), line('a1', 'arch'), line('u1', 'unk2')],
      owed: [{ ...owedKevin, contactId: 'greg' }],
      todayYmd: DEMO_TODAY,
    }
    expect(counts(input)).toEqual({ needReply: 0, weOwe: 0, toSort: 0 })
  })
})

describe('customerMessageCounts on Quickfill (v2.5823, punch list #157): the Texts station holds the texts', () => {
  it('leaves out a customer whose waiting line is a text, keeps one whose line is an email or a call, and never touches we owe or to sort', () => {
    const contacts: QueueContact[] = [dana, { ...kevin, state: 'waiting' }, { id: 'lena', kind: 'customer', name: 'Lena Ortiz', state: 'waiting' }]
    const messages = [line('d1', 'dana'), line('k1', 'kevin', { channel: 'email' }), line('l1', 'lena', { channel: 'missed' })]
    const input: FollowUpInput = { contacts, messages, owed: [owedKevin], todayYmd: DEMO_TODAY }
    const queue = followUpQueue(input)
    expect(queue.needsReply.map((r) => r.landOnId)).toEqual(['d1', 'k1', 'l1'])
    expect(customerMessageCounts(queue, contacts)).toEqual({ needReply: 3, weOwe: 1, toSort: 0 })
    expect(customerMessageCounts(queue, contacts, { textsElsewhere: new Set(['d1']) })).toEqual({ needReply: 2, weOwe: 1, toSort: 0 })
    // The set names lines, not people: Dana's older text is not her waiting line.
    expect(customerMessageCounts(queue, contacts, { textsElsewhere: new Set(['d0']) })).toEqual({ needReply: 3, weOwe: 1, toSort: 0 })
  })
})
