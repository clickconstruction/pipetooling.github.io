import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { courtOf, NOTHING_WAITS, type ThreadMessage } from '../messages/thread'
import { heardBackOf } from '../messages/waitingOnThem'
import { NO_REPLY_PRESS, NO_REPLY_TIP, NO_REPLY_UNNAMED_TIP, noReplyBody, noReplyOf, threadClose } from './noReply'

const NOW = '2026-11-12T18:00:00Z'
const line = (set: Partial<ThreadMessage> & Pick<ThreadMessage, 'id' | 'at'>): ThreadMessage => ({
  contactId: 'dale',
  jobId: null,
  channel: 'text',
  direction: 'in',
  who: 'Dale Okafor',
  body: 'Thanks, got the invoice.',
  ...set,
})
const said = (id: string, at: string, who = 'Rosa'): ThreadMessage => line({ id, at, channel: 'event', direction: 'team', who, body: noReplyBody(who, 'Nov 12') })

describe('the grey line a No reply needed press writes (v2.7029, punch list #324)', () => {
  it('says who and when, and reads back', () => {
    expect(noReplyBody('Rosa', 'Nov 12')).toBe('Rosa said on Nov 12 that no reply is needed.')
    expect(noReplyBody('  ', 'Nov 12')).toBe('Someone said on Nov 12 that no reply is needed.')
    expect(noReplyOf('Rosa said on Nov 12 that no reply is needed.')).toEqual({ who: 'Rosa', day: 'Nov 12' })
    expect(noReplyOf('Rosa took Dale Okafor.')).toBeNull()
  })

  it('is not Heard back’s line, and Heard back’s is not this one', () => {
    expect(heardBackOf(noReplyBody('Rosa', 'Nov 12'))).toBeNull()
    expect(noReplyOf('Rosa said on Nov 12 that no answer is needed.')).toBeNull()
  })

  it('writes plain words', () => {
    for (const words of [noReplyBody('Rosa', 'Nov 12'), NO_REPLY_TIP, NO_REPLY_UNNAMED_TIP]) expect(plainWordsFailures(words)).toEqual([])
  })
})

describe('what the thread’s status row shows of the state', () => {
  const theirs = line({ id: 'a', at: '2026-11-10T18:00:00Z' })

  it('offers the press while the conversation is open', () => {
    expect(threadClose({ state: 'waiting', lines: [theirs], contactId: 'dale', nowIso: NOW })).toMatchObject({ kind: 'press', label: NO_REPLY_PRESS })
  })

  it('says who closed it and when once it is done by the press', () => {
    const got = threadClose({ state: 'done', lines: [theirs, said('e', '2026-11-12T15:02:00Z')], contactId: 'dale', nowIso: NOW })
    expect(got).toMatchObject({ kind: 'done', how: 'noReply', words: 'Done · no reply needed · Rosa, Nov 12' })
  })

  it('draws nothing for a press that a later word overtook', () => {
    const ours = line({ id: 'o', at: '2026-11-12T16:00:00Z', direction: 'out', who: 'Rosa', body: 'On it.' })
    expect(threadClose({ state: 'done', lines: [theirs, said('e', '2026-11-12T15:02:00Z'), ours], contactId: 'dale', nowIso: NOW })).toBeNull()
  })

  it('draws nothing while it is snoozed, or done by our reply', () => {
    expect(threadClose({ state: 'snoozed', lines: [theirs], contactId: 'dale', nowIso: NOW })).toBeNull()
    const ours = line({ id: 'o', at: '2026-11-11T16:00:00Z', direction: 'out', who: 'Rosa', body: 'On it.' })
    expect(threadClose({ state: 'done', lines: [theirs, ours], contactId: 'dale', nowIso: NOW })).toBeNull()
  })

  it('says old mail was filed, with its day, on a thread only filed mail touched', () => {
    const filed = [
      line({ id: 'f1', at: '2026-03-01T15:00:00Z', channel: 'email', direction: 'out', who: 'Marisol', history: true, landedAt: '2026-11-09T22:12:00Z' }),
      line({ id: 'f2', at: '2026-03-03T15:00:00Z', channel: 'email', history: true, landedAt: '2026-11-09T22:12:01Z' }),
    ]
    expect(threadClose({ state: 'done', lines: filed, contactId: 'dale', nowIso: NOW })).toMatchObject({ kind: 'done', how: 'filed', words: 'Done · old mail, filed Nov 9' })
    expect(threadClose({ state: 'done', lines: [{ ...filed[1]!, landedAt: null }], contactId: 'dale', nowIso: NOW })).toMatchObject({ words: 'Done · old mail, filed for the record' })
  })

  it('reads another person’s lines as nobody’s', () => {
    expect(threadClose({ state: 'done', lines: [said('e', '2026-11-12T15:02:00Z')].map((m) => ({ ...m, contactId: 'other' })), contactId: 'dale', nowIso: NOW })).toBeNull()
  })
})

describe('the move line reads the state (v2.7029)', () => {
  const theirs = line({ id: 'a', at: '2026-11-10T18:00:00Z' })

  it('says Nothing waits on a done conversation whose last word is theirs', () => {
    expect(courtOf([theirs], 'dale', NOW, { closed: true })).toEqual({ side: 'none', word: NOTHING_WAITS })
  })

  it('still says Our move while it is open, and on a read that does not know the state', () => {
    expect(courtOf([theirs], 'dale', NOW, { closed: false }).word).toBe('Our move · 2 d')
    expect(courtOf([theirs], 'dale', NOW).word).toBe('Our move · 2 d')
  })

  it('keeps what we owe ours, and their move theirs, on a done conversation', () => {
    expect(courtOf([theirs], 'dale', NOW, { closed: true, owed: { what: 'the start date' } }).side).toBe('ours')
    const ours = line({ id: 'o', at: '2026-11-11T18:00:00Z', direction: 'out', who: 'Rosa', body: 'On it.' })
    expect(courtOf([theirs, ours], 'dale', NOW, { closed: true }).word).toBe('Their move · 1 d')
  })
})
