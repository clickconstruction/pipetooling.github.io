import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { HANDED_BODY_MAX, handedFresh, handedPush } from './handedPush'

describe('handedPush (v2.6228)', () => {
  const line = { id: 'm-1', channel: 'email' as const, subject: 'Invitation to Bid: Oak Hill Clinic, Boerne', body: 'Please see the attached invitation.' }

  it('says who handed whom, carries the last message, and lands on the thread at the line', () => {
    const push = handedPush({ contactId: 'c-dale', contactName: 'Dale Ferris', byName: 'Rosa', line })
    expect(push.title).toBe('Rosa handed you Dale Ferris')
    expect(push.body).toBe('Invitation to Bid: Oak Hill Clinic, Boerne')
    expect(push.url).toBe('/gc?view=messages&thread=c-dale&at=m-1')
    expect(push.tag).toBe('handed:c-dale')
    expect(push.messageId).toBe('m-1')
    expect(plainWordsFailures(`${push.title}.`)).toEqual([])
  })

  it('a thread with no line in: Open the thread, landing on the thread alone', () => {
    const push = handedPush({ contactId: 'c-dale', contactName: 'Dale Ferris', byName: 'Rosa', line: null })
    expect(push.body).toBe('Open the thread.')
    expect(push.url).toBe('/gc?view=messages&thread=c-dale')
    expect(push.messageId).toBeNull()
  })

  it('clips a long message and fills in the names it lacks', () => {
    const long = { id: 'm-2', channel: 'text' as const, subject: null, body: 'word '.repeat(60) }
    const push = handedPush({ contactId: 'c', contactName: '', byName: ' ', line: long })
    expect(push.body.length).toBeLessThanOrEqual(HANDED_BODY_MAX)
    expect(push.body.endsWith('…')).toBe(true)
    expect(push.title).toBe('Someone handed you a conversation')
  })

  it('a hand is fresh for fifteen minutes', () => {
    const now = '2026-10-31T15:00:00Z'
    expect(handedFresh('2026-10-31T14:50:00Z', now)).toBe(true)
    expect(handedFresh('2026-10-31T14:44:00Z', now)).toBe(false)
    expect(handedFresh('2026-10-31T15:01:00Z', now)).toBe(false)
    expect(handedFresh(null, now)).toBe(false)
    expect(handedFresh('yesterday', now)).toBe(false)
  })
})
