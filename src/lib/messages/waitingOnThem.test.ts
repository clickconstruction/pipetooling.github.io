import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { waitingOnThem, WAITING_WORDS, type WaitLine } from './waitingOnThem'

// Now: Wed Oct 21, 12:10 AM Chicago (CDT).
const NOW = new Date('2026-10-21T05:10:00Z')
const at = (iso: string) => Date.parse(iso)
const line = (set: Partial<WaitLine>): WaitLine => ({ id: 'x', contactId: 'c1', name: 'Dana Whitfield', kind: 'customer', direction: 'out', body: 'Dana, your estimate is ready, $4,860.00.', atMs: at('2026-10-18T18:31:00Z'), number: '(830) 555-0121', ...set })

describe('waitingOnThem (v2.5704, punch list #139)', () => {
  it('lists each person whose newest line is ours and two days old or more, longest quiet first', () => {
    const lines = [
      line({ id: 'd1' }), // Dana: ours, Oct 18 → 2 days
      line({ id: 'k1', contactId: 'c2', name: 'Kim Coe', body: 'Kim, the water heater is on the truck for Tuesday.', atMs: at('2026-10-14T20:00:00Z') }), // Kim: ours, 6 days
      line({ id: 'm1', contactId: 'c3', name: 'Marcus Calloway', atMs: at('2026-10-20T16:05:00Z') }), // Marcus: ours, 13 hours → not yet
      line({ id: 'p1', contactId: 'c4', name: 'Priya Natarajan', atMs: at('2026-10-15T14:00:00Z') }),
      line({ id: 'p2', contactId: 'c4', name: 'Priya Natarajan', direction: 'in', body: 'Thursday works.', atMs: at('2026-10-16T14:00:00Z') }), // Priya answered → not waiting
    ]
    const rows = waitingOnThem(lines, 'all', NOW)
    expect(rows.map((r) => [r.name, r.days, r.chip])).toEqual([
      ['Kim Coe', 6, 'Their move · 6 d'],
      ['Dana Whitfield', 2, 'Their move · 2 d'],
    ])
    expect(rows[0]).toMatchObject({ contactId: 'c2', words: 'Kim, the water heater is on the truck for Tuesday.', when: 'Wed, Oct 14', number: '(830) 555-0121' })
  })
  it('a pill narrows by kind; a customer’s own thread reads the customer’s name; no number means no call', () => {
    const lines = [line({ id: 'd1', name: null, customerName: 'Dana Whitfield', number: null }), line({ id: 'g1', contactId: 'c9', name: 'Greg Paulk', kind: 'trade', atMs: at('2026-10-10T12:00:00Z') })]
    expect(waitingOnThem(lines, 'customer', NOW).map((r) => [r.name, r.number])).toEqual([['Dana Whitfield', null]])
    expect(waitingOnThem(lines, 'trade', NOW).map((r) => r.name)).toEqual(['Greg Paulk'])
    expect(waitingOnThem([], 'all', NOW)).toEqual([])
  })
  it('a person nobody has named is named by the way our last line went: an address on an email, a number on a text (v2.5994)', () => {
    const lines = [
      line({ id: 'e1', contactId: 'u1', name: null, kind: null, channel: 'email', number: null, body: 'Our bid for the restrooms is attached.' }),
      line({ id: 't1', contactId: 'u2', name: null, kind: null, channel: 'text', atMs: at('2026-10-17T18:31:00Z') }),
      line({ id: 'n1', contactId: 'u3', name: null, kind: null, channel: null, atMs: at('2026-10-16T18:31:00Z') }),
    ]
    expect(waitingOnThem(lines, 'all', NOW).map((r) => r.name)).toEqual(['A number nobody has named', 'A number nobody has named', 'An address nobody has named'])
  })
  it('a last text Quo could not deliver marks the row; a delivered text, an email or a call does not (punch list #140 PR 4)', () => {
    const lines = [
      line({ id: 'd1', channel: 'text', delivery: 'failed' }),
      line({ id: 'k1', contactId: 'c2', name: 'Kim Coe', channel: 'text', delivery: 'delivered', atMs: at('2026-10-14T20:00:00Z') }),
      line({ id: 'g1', contactId: 'c3', name: 'Greg Paulk', channel: 'email', delivery: null, atMs: at('2026-10-13T20:00:00Z') }),
      line({ id: 'p1', contactId: 'c4', name: 'Priya Natarajan', channel: 'text', delivery: 'undelivered', atMs: at('2026-10-12T20:00:00Z') }),
      line({ id: 'o1', contactId: 'c5', name: 'Old Row' }),
    ]
    const rows = waitingOnThem(lines, 'all', NOW)
    expect(rows.map((r) => [r.name, r.mark?.bad ?? null, r.mark?.words ?? null])).toEqual([
      ['Priya Natarajan', true, '⚠ not delivered'],
      ['Greg Paulk', null, null],
      ['Kim Coe', false, '✓ delivered'],
      ['Dana Whitfield', true, '⚠ not sent'],
      ['Old Row', null, null],
    ])
  })
  it('the lane’s words are plain', () => {
    expect(WAITING_WORDS.title(3)).toBe('Waiting on them (3)')
    for (const words of [WAITING_WORDS.note, WAITING_WORDS.empty, WAITING_WORDS.problem, WAITING_WORDS.nudgeTip, WAITING_WORDS.asEmailTip]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
