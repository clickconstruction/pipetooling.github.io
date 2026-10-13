import { describe, expect, it } from 'vitest'
import { customerMessageCounts } from './customerCounts'
import { DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, DEMO_HEARD, DEMO_OWED, DEMO_PORTAL_PAPERS, DEMO_TODAY } from './followUpDemo'
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
  it('reads the prototype’s Friday: Elena and Priya need a reply, Priya is owed, the unknown number is to sort', () => {
    // Greg is a trade partner, so his open thread is not a customer’s. Priya’s unopened change order waits on her, not on us.
    expect(counts(demo)).toEqual({ needReply: 2, weOwe: 1, toSort: 1 })
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
