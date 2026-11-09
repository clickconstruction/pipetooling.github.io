import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { MyMailRow } from '../myMail/contract'
import { answerBody, answerWhoText, contactEmailAddresses, OWN_MAILBOX_DEFAULT_BODY, OWN_MAILBOX_WORDS, sentMailQuery, sentOffers, showOwnMailboxStrip, tagJobFor } from './ownMailboxAnswer'

const row = (over: Partial<MyMailRow> = {}): MyMailRow => ({
  gmailId: 'g-1',
  threadId: 't-1',
  direction: 'out',
  who: { name: 'Rusty Cottar', address: 'rusty@cottarbuilders.example' },
  subject: 'Re: Bid request',
  snippet: 'Numbers attached.',
  at: '2026-11-07T20:00:00.000Z',
  files: 1,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
  ...over,
})

describe('showOwnMailboxStrip: while the court is ours by their last word (punch list #207, v2.6745)', () => {
  it('shows on our move, hides on theirs, on nothing waiting, on an owed row and with no court', () => {
    expect(showOwnMailboxStrip({ side: 'ours' })).toBe(true)
    expect(showOwnMailboxStrip({ side: 'theirs' })).toBe(false)
    expect(showOwnMailboxStrip({ side: 'none' })).toBe(false)
    expect(showOwnMailboxStrip({ side: 'ours', owed: true })).toBe(false)
    expect(showOwnMailboxStrip(null)).toBe(false)
  })
})

describe('sentMailQuery: the search over the person\'s own Sent', () => {
  it('asks for a mail to any of their addresses in the last 30 days, and nothing with no address', () => {
    expect(sentMailQuery(['rusty@cottarbuilders.example'])).toBe('to:rusty@cottarbuilders.example newer_than:30d')
    expect(sentMailQuery(['rusty@cottarbuilders.example', 'r.cottar@gmail.example'])).toBe('(to:rusty@cottarbuilders.example OR to:r.cottar@gmail.example) newer_than:30d')
    expect(sentMailQuery([])).toBeNull()
    expect(sentMailQuery([' '])).toBeNull()
  })

  it('reads the addresses off the thread, trimmed and once each, phones left out', () => {
    expect(
      contactEmailAddresses({
        channels: [
          { id: '1', kind: 'phone', value: '(210) 555-0113', optedOutAt: null },
          { id: '2', kind: 'email', value: ' Rusty@cottarbuilders.example ', optedOutAt: null },
          { id: '3', kind: 'email', value: 'rusty@cottarbuilders.example', optedOutAt: null },
        ],
      }),
    ).toEqual(['rusty@cottarbuilders.example'])
  })
})

describe('tagJobFor and sentOffers', () => {
  it('tags onto the job in view, else the star, else asks', () => {
    expect(tagJobFor('bid:b-1', 'pipeline:j-1')).toEqual({ kind: 'bid', id: 'b-1' })
    expect(tagJobFor(null, 'pipeline:j-1')).toEqual({ kind: 'pipeline', id: 'j-1' })
    expect(tagJobFor(null, null)).toBeNull()
  })

  it('offers a tag on a sent mail not yet on a thread, says so on one tagged or held by a line, and leaves mail in out', () => {
    const tagged = row({ gmailId: 'g-2', tagged: { kind: 'bid', id: 'b-1', key: 'bid:b-1', num: 'B512', name: 'Oak Hill Clinic', messageId: 'm-1' } })
    const held = row({ gmailId: 'g-3', inMessages: { messageId: 'm-2', jobKey: null } })
    const inbound = row({ gmailId: 'g-4', direction: 'in' })
    expect(sentOffers([row(), tagged, held, inbound]).map((o) => [o.row.gmailId, o.offer])).toEqual([
      ['g-1', 'tag'],
      ['g-2', 'onThread'],
      ['g-3', 'onThread'],
    ])
  })
})

describe('the line as the function writes it', () => {
  it('names the person and the default words', () => {
    expect(answerWhoText('Wendi Doll')).toBe('Wendi Doll · answered from their own mailbox')
    expect(answerWhoText(' ')).toBe('Someone · answered from their own mailbox')
    expect(answerBody('  Sent the revised number Friday.  ')).toBe('Sent the revised number Friday.')
    expect(answerBody('')).toBe(OWN_MAILBOX_DEFAULT_BODY)
    expect(answerBody(null)).toBe('Answered from my own mailbox.')
  })

  it('holds every word of the strip to plain words', () => {
    for (const words of Object.values(OWN_MAILBOX_WORDS)) expect(plainWordsFailures(words), words).toEqual([])
  })
})
