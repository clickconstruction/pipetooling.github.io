import { describe, expect, it } from 'vitest'
import type { ContactKind } from '../contacts/kernel'
import { DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, DEMO_HEARD, DEMO_OWED, DEMO_PORTAL_PAPERS, DEMO_TODAY } from '../followUp/followUpDemo'
import { followUpQueue, type FollowUpInput, type QueueContact } from '../followUp/queue'
import { plainWordsFailures } from '../plainWords'
import { inPill, KIND_PARAM, KIND_PILLS, peopleForPill, pillOf, pillOnFollowUp, queueForPill, withPill, type KindPill } from './kindPills'

const demo: FollowUpInput = {
  contacts: DEMO_FOLLOW_UP_CONTACTS,
  messages: DEMO_FOLLOW_UP_MESSAGES,
  heard: DEMO_HEARD,
  owed: DEMO_OWED,
  portalPapers: DEMO_PORTAL_PAPERS,
  todayYmd: DEMO_TODAY,
}
const nudges = [
  { contactId: 'tom', stepId: 'invited', why: 'quiet 2 days' },
  { contactId: 'greg', stepId: 'quote', why: 'waiting on their quote' },
  { contactId: 'elena', stepId: 'sign', why: 'the contract is not signed' },
]
const clauses = [{ id: 'clause-1' }]
const kinds = (patch: Record<string, QueueContact['kind']>) => DEMO_FOLLOW_UP_CONTACTS.map((c) => (patch[c.id] ? { ...c, kind: patch[c.id]! } : c))
const ALL_KINDS: ContactKind[] = ['customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub', 'unknown']

describe('the pill row (the residential prototype v0.8, the Messages page)', () => {
  it('runs in the prototype’s order, with New left to R7’s lane', () => {
    expect(KIND_PILLS.map((p) => p.label)).toEqual(['All', 'Customers', 'Trade partners', 'Architects', 'Leads', 'Subs', 'Supply houses and candidates'])
  })

  it('puts every named kind under exactly one pill, and a number nobody named under All alone', () => {
    const pills = KIND_PILLS.map((p) => p.key).filter((k) => k !== 'all')
    for (const kind of ALL_KINDS) {
      const under = pills.filter((p) => inPill(kind, p))
      expect(under).toEqual(kind === 'unknown' ? [] : [under[0]])
      expect(inPill(kind, 'all')).toBe(true)
    }
    expect(ALL_KINDS.filter((k) => inPill(k, 'more'))).toEqual(['supply_house', 'candidate'])
  })

  it('says Follow up holds nobody under the last pill', () => {
    expect(KIND_PILLS.filter((p) => !pillOnFollowUp(p.key)).map((p) => p.key)).toEqual(['more'])
  })

  it('speaks in plain words on every hover', () => {
    for (const p of KIND_PILLS) expect(plainWordsFailures(p.title), p.key).toEqual([])
  })
})

describe('the pill in the URL', () => {
  it('reads the pill a link asks for, and All for none or a stranger', () => {
    expect(pillOf(new URLSearchParams('kind=customer'))).toBe('customer')
    expect(pillOf(new URLSearchParams('kind=more&thread=priya'))).toBe('more')
    expect(pillOf(new URLSearchParams(''))).toBe('all')
    expect(pillOf(new URLSearchParams('kind=supply_house'))).toBe('all')
    expect(pillOf(new URLSearchParams('kind=%20lead%20'))).toBe('lead')
  })

  it('keeps an open thread when the pill changes, and drops the param for All', () => {
    const open = new URLSearchParams('thread=priya&at=8')
    expect(withPill(open, 'trade').toString()).toBe('thread=priya&at=8&kind=trade')
    expect(withPill(new URLSearchParams('kind=trade&thread=priya'), 'all').toString()).toBe('thread=priya')
    expect(withPill(open, 'trade').get(KIND_PARAM)).toBe('trade')
    expect(open.get(KIND_PARAM)).toBeNull()
  })
})

describe('queueForPill on the prototype’s Friday', () => {
  const queue = followUpQueue(demo, { nudges: () => nudges, clauses })
  const under = (pill: KindPill, contacts: ReadonlyArray<{ id: string; kind: ContactKind }> = DEMO_FOLLOW_UP_CONTACTS) => queueForPill(queue, contacts, pill)

  it('hands All back as the kernel built it, the clause edits with it', () => {
    expect(under('all')).toBe(queue)
    expect(queue.count).toBe(4)
    expect(queue.clauses).toEqual(clauses)
  })

  it('keeps the customers’ rows under Customers and counts them once each', () => {
    const q = under('customer')
    expect(q.needsYou.map((r) => [r.kind, r.contactId])).toEqual([
      ['back', 'priya'],
      ['portal', 'priya'],
    ])
    expect(q.needsReply.map((r) => r.contactId)).toEqual(['priya', 'elena'])
    expect(q.weOwe.map((r) => r.contactId)).toEqual(['priya'])
    expect(q.nudges.map((n) => n.contactId)).toEqual(['elena'])
    expect(q.count).toBe(2)
  })

  it('keeps the trade partners’ rows and nudges under Trade partners', () => {
    const q = under('trade')
    expect(q.needsYou).toEqual([])
    expect(q.needsReply.map((r) => r.contactId)).toEqual(['greg'])
    expect(q.weOwe).toEqual([])
    expect(q.nudges.map((n) => n.contactId)).toEqual(['tom', 'greg'])
    expect(q.count).toBe(1)
  })

  it('leaves the clause edits under All alone, since they are not a person', () => {
    for (const pill of ['customer', 'trade', 'arch', 'lead', 'sub', 'more'] as const) expect(under(pill).clauses).toEqual([])
  })

  it('shows nobody under a pill with no one waiting, and drops a row whose person it cannot find', () => {
    const q = under('arch')
    expect([q.needsYou, q.needsReply, q.weOwe, q.nudges]).toEqual([[], [], [], []])
    expect(q.count).toBe(0)
    const noPriya = DEMO_FOLLOW_UP_CONTACTS.filter((c) => c.id !== 'priya')
    expect(under('customer', noPriya).needsReply.map((r) => r.contactId)).toEqual(['elena'])
  })

  it('finds a lead and a sub under their own pills', () => {
    const contacts = kinds({ priya: 'sub', greg: 'lead' })
    const q = followUpQueue({ ...demo, contacts }, { nudges: () => nudges })
    expect(queueForPill(q, contacts, 'lead').needsReply.map((r) => r.contactId)).toEqual(['greg'])
    expect(queueForPill(q, contacts, 'sub').weOwe.map((r) => r.contactId)).toEqual(['priya'])
    expect(queueForPill(q, contacts, 'sub').count).toBe(1)
  })

  it('has nobody under the last pill, since the kernel never lets them on', () => {
    const contacts = kinds({ priya: 'supply_house', greg: 'candidate' })
    const q = queueForPill(followUpQueue({ ...demo, contacts }, { nudges: () => nudges }), contacts, 'more')
    expect([q.needsYou, q.needsReply, q.weOwe, q.nudges]).toEqual([[], [], [], []])
    expect(q.count).toBe(0)
  })
})

describe('peopleForPill', () => {
  it('lists the supply houses and candidates for the last pill, in the order given', () => {
    const contacts = kinds({ priya: 'supply_house', tom: 'candidate' })
    expect(peopleForPill(contacts, 'more').map((c) => c.id)).toEqual(['priya', 'tom'])
    expect(peopleForPill(contacts, 'all')).toHaveLength(DEMO_FOLLOW_UP_CONTACTS.length)
    expect(peopleForPill(DEMO_FOLLOW_UP_CONTACTS, 'more')).toEqual([])
  })
})
