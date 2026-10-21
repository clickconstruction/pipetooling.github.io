import { describe, expect, it } from 'vitest'
import { DEMO_FOLLOW_UP_CONTACTS, DEMO_FOLLOW_UP_MESSAGES, DEMO_HEARD, DEMO_OWED, DEMO_PORTAL_PAPERS, DEMO_TODAY } from '../followUp/followUpDemo'
import { followUpQueue, type FollowUpInput } from '../followUp/queue'
import { plainWordsFailures } from '../plainWords'
import { queueForPill } from './kindPills'
import { keepLens, lensCounts, queueForShow, readLens, SHOW_STORAGE_KEY, SHOW_WORDS } from './showLens'

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
  { contactId: 'priya', stepId: 'sign', why: 'the contract is not signed' },
]
const queue = followUpQueue(demo, { nudges: () => nudges })
/** The demo's holders by id: Rosa holds Priya; nobody else is held. */
const contacts = DEMO_FOLLOW_UP_CONTACTS.map((c) => ({ id: c.id, hasUserId: c.hasUserId ?? null }))

describe('Show: Mine · Everyone (punch list #140 PR 3)', () => {
  it('Everyone is the queue as built', () => {
    expect(queueForShow(queue, contacts, 'everyone', 'u-rosa')).toBe(queue)
  })

  it('Mine keeps only the people I hold, by id, in every lane, and recounts', () => {
    const mine = queueForShow(queue, contacts, 'mine', 'u-rosa')
    const people = (rows: ReadonlyArray<{ contactId: string }>) => rows.map((r) => r.contactId)
    expect(people(mine.needsReply)).toEqual(['priya'])
    expect(people(mine.weOwe)).toEqual(queue.weOwe.filter((r) => r.contactId === 'priya').map((r) => r.contactId))
    expect(people(mine.newLane)).toEqual([])
    expect(people(mine.nudges)).toEqual(['priya'])
    expect(mine.clauses).toEqual([])
    expect(mine.count).toBe(1)
    expect(mine.onPortal).toBe(queue.onPortal)
    // The name is not the id: nobody is held by "Rosa".
    expect(queueForShow(queue, contacts, 'mine', 'Rosa').count).toBe(0)
    expect(queueForShow(queue, contacts, 'mine', '').count).toBe(0)
  })

  it('composes with the kind pills, in either order', () => {
    const a = queueForShow(queueForPill(queue, DEMO_FOLLOW_UP_CONTACTS, 'customer'), contacts, 'mine', 'u-rosa')
    const b = queueForPill(queueForShow(queue, contacts, 'mine', 'u-rosa'), DEMO_FOLLOW_UP_CONTACTS, 'customer')
    expect(a.needsReply.map((r) => r.contactId)).toEqual(['priya'])
    expect(b.needsReply.map((r) => r.contactId)).toEqual(['priya'])
    expect(queueForShow(queueForPill(queue, DEMO_FOLLOW_UP_CONTACTS, 'trade'), contacts, 'mine', 'u-rosa').count).toBe(0)
  })

  it('counts the two values for the buttons', () => {
    expect(lensCounts(queue, contacts, 'u-rosa')).toEqual({ mine: 1, everyone: queue.count })
    expect(lensCounts(queue, contacts, 'u-nobody')).toEqual({ mine: 0, everyone: queue.count })
  })

  it('keeps the choice on the browser, and starts on Everyone with nothing kept or a browser that keeps nothing', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readLens(storage)).toBe('everyone')
    keepLens('mine', storage)
    expect(store.get(SHOW_STORAGE_KEY)).toBe('mine')
    expect(readLens(storage)).toBe('mine')
    keepLens('everyone', storage)
    expect(readLens(storage)).toBe('everyone')
    const broken = {
      getItem: () => {
        throw new Error('no storage')
      },
      setItem: () => {
        throw new Error('no storage')
      },
    }
    expect(readLens(broken)).toBe('everyone')
    expect(() => keepLens('mine', broken)).not.toThrow()
    expect(readLens(null)).toBe('everyone')
  })

  it('keeps every sentence in plain words', () => {
    for (const w of Object.values(SHOW_WORDS)) expect(plainWordsFailures(w), w).toEqual([])
  })
})
