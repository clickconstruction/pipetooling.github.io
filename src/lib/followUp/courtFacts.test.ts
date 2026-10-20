import { describe, expect, it } from 'vitest'
import { courtOf, type ThreadMessage } from '../messages/thread'
import { courtFactsFromRows } from './courtFacts'
import type { ContactOwedRow, MessagePromiseRow } from './followUpRows'

const TODAY = '2026-10-02'

const owed = (id: string, contactId: string, what: string, patch: Partial<ContactOwedRow> = {}): ContactOwedRow => ({
  id,
  contact_id: contactId,
  what,
  by_day: null,
  by_words: null,
  marked_by: 'u-rosa',
  marked_at: '2026-09-26T19:30:00.000Z',
  done_at: null,
  done_how: null,
  done_note_message_id: null,
  ...patch,
})

const promise = (id: string, contactId: string, patch: Partial<MessagePromiseRow> = {}): MessagePromiseRow => ({
  id,
  message_id: `m-${id}`,
  kind: 'quote',
  state: 'written',
  day: '2026-10-07',
  day_words: null,
  writes: null,
  decided_by: 'u-rosa',
  decided_at: '2026-10-01T15:00:00.000Z',
  message: { contact_id: contactId, at: '2026-10-01T14:00:00.000Z' },
  ...patch,
})

/** Greg is owed the plans by Friday; Elena promised a quote by Wednesday; Priya's is done; Tom's day has gone by. */
const FACTS = courtFactsFromRows(
  [owed('o1', 'greg', 'the plans or an addendum', { by_day: '2026-10-09' }), owed('o2', 'priya', 'the start date', { done_at: '2026-10-01T10:00:00.000Z', done_how: 'note' })],
  [
    promise('p1', 'elena'),
    promise('p2', 'tom', { day: '2026-09-30' }),
    promise('p3', 'bill', { state: 'offered', kind: null }),
  ],
  TODAY,
)

describe('courtFactsFromRows (cut 2, C2)', () => {
  it('names what we owe and the day a promise runs until, by person, and leaves out the rest', () => {
    expect(Object.fromEntries(FACTS)).toEqual({
      greg: { owed: { what: 'the plans or an addendum', by: 'Fri Oct 9' } },
      elena: { promisedUntil: 'until Wed Oct 7 · quote' },
    })
  })

  it('is what the move line reads, in the list and the window alike', () => {
    const lines: ThreadMessage[] = [
      { id: 'm1', contactId: 'elena', jobId: null, channel: 'text', direction: 'out', at: '2026-10-01T16:00:00.000Z', who: 'Rosa', subject: null, body: 'We will look for it.', channelId: null, durationSeconds: null, optoutLine: null, backOn: null, backBy: null },
    ]
    expect(courtOf(lines, 'greg', '2026-10-02T17:00:00.000Z', { optedOut: false, ...FACTS.get('greg') }).word).toBe('Our move · we owe the plans or an addendum · by Fri Oct 9')
    expect(courtOf(lines, 'elena', '2026-10-02T17:00:00.000Z', { optedOut: false, ...FACTS.get('elena') }).word).toBe('Their move · until Wed Oct 7 · quote')
    // A STOP still wins over both.
    expect(courtOf(lines, 'greg', '2026-10-02T17:00:00.000Z', { optedOut: true, ...FACTS.get('greg') }).word).toBe('opted out')
  })
})
