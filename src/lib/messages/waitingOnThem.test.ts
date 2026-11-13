import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { estimateAnswerOf, HEARD_ROWS, HEARD_WORDS, heardBackBody, heardBackOf, theirWord, waitingOnThem, WAITING_WORDS, type WaitLine } from './waitingOnThem'

// Now: Wed Oct 21, 12:10 AM Chicago (CDT).
const NOW = new Date('2026-10-21T05:10:00Z')
const at = (iso: string) => Date.parse(iso)
const line = (set: Partial<WaitLine>): WaitLine => ({ id: 'x', contactId: 'c1', name: 'Dana Whitfield', kind: 'customer', direction: 'out', body: 'Dana, your estimate is ready, $4,860.00.', atMs: at('2026-10-18T18:31:00Z'), number: '(830) 555-0121', ...set })

describe('waitingOnThem (v2.5704, punch list #139)', () => {
  it('lists each person whose newest line is ours and two days old or more, longest quiet first', () => {
    const lines = [
      line({ id: 'd1' }), // Dana: ours, Oct 18 → 2 days
      line({ id: 'k1', contactId: 'c2', name: 'Kim Corl', body: 'Kim, the water heater is on the truck for Tuesday.', atMs: at('2026-10-14T20:00:00Z') }), // Kim: ours, 6 days
      line({ id: 'm1', contactId: 'c3', name: 'Marcus Calloway', atMs: at('2026-10-20T16:05:00Z') }), // Marcus: ours, 13 hours → not yet
      line({ id: 'p1', contactId: 'c4', name: 'Priya Natarajan', atMs: at('2026-10-15T14:00:00Z') }),
      line({ id: 'p2', contactId: 'c4', name: 'Priya Natarajan', direction: 'in', body: 'Thursday works.', atMs: at('2026-10-16T14:00:00Z') }), // Priya answered → not waiting
    ]
    const rows = waitingOnThem(lines, 'all', NOW)
    expect(rows.map((r) => [r.name, r.days, r.chip])).toEqual([
      ['Kim Corl', 6, 'Their move · 6 d'],
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
      line({ id: 'k1', contactId: 'c2', name: 'Kim Corl', channel: 'text', delivery: 'delivered', atMs: at('2026-10-14T20:00:00Z') }),
      line({ id: 'g1', contactId: 'c3', name: 'Greg Paulk', channel: 'email', delivery: null, atMs: at('2026-10-13T20:00:00Z') }),
      line({ id: 'p1', contactId: 'c4', name: 'Priya Natarajan', channel: 'text', delivery: 'undelivered', atMs: at('2026-10-12T20:00:00Z') }),
      line({ id: 'o1', contactId: 'c5', name: 'Old Row' }),
    ]
    const rows = waitingOnThem(lines, 'all', NOW)
    expect(rows.map((r) => [r.name, r.mark?.bad ?? null, r.mark?.words ?? null])).toEqual([
      ['Priya Natarajan', true, '⚠ not delivered'],
      ['Greg Paulk', null, null],
      ['Kim Corl', false, '✓ delivered'],
      ['Dana Whitfield', true, '⚠ not sent'],
      ['Old Row', null, null],
    ])
  })
  it('the lane’s words are plain', () => {
    expect(WAITING_WORDS.title(3)).toBe('Waiting on them (3)')
    for (const words of [WAITING_WORDS.note, WAITING_WORDS.empty, WAITING_WORDS.problem, WAITING_WORDS.nudgeTip, WAITING_WORDS.asEmailTip]) expect(plainWordsFailures(words), words).toEqual([])
    expect(WAITING_WORDS.note).toContain('Heard back')
  })
})

// Now: Wed Oct 28, 12:10 AM Chicago (CDT); our text went Tue Oct 20.
const NOW_28 = new Date('2026-10-28T05:10:00Z')
const ours = (set: Partial<WaitLine> = {}): WaitLine => line({ id: 'o1', contactId: 'c-evan', name: 'Evan Jarrow', body: 'Evan, this is Taunya with Click Plumbing. Your estimate is ready, $6,250.00.', atMs: at('2026-10-20T20:00:00Z'), channel: 'text', ...set })
const event = (set: Partial<WaitLine>): WaitLine => ({ id: 'e1', contactId: 'c-evan', name: null, kind: null, direction: 'event', channel: 'event', body: '', atMs: at('2026-10-22T15:00:00Z'), ...set })

describe('their word that is not a line in (v2.6500, Taunya’s report of 2026-11-03)', () => {
  it('an estimate accepted through our link after our text clears the row; an open alone keeps it', () => {
    const accepted = event({ key: 'estimate:est-1:accepted', body: '✍️ Evan accepted estimate #212.' })
    expect(waitingOnThem([ours(), accepted], 'all', NOW_28)).toEqual([])
    const opened = event({ key: 'estimate:est-1:opened', body: '👀 Evan opened estimate #212.' })
    expect(waitingOnThem([ours(), opened], 'all', NOW_28).map((r) => [r.name, r.days])).toEqual([['Evan Jarrow', 7]])
    const declined = event({ key: 'estimate:est-1:declined', body: '🚫 Evan declined estimate #212.' })
    expect(waitingOnThem([ours(), declined], 'all', NOW_28)).toEqual([])
    // An answer before our text is no answer to it: the newest line is still ours.
    expect(waitingOnThem([ours(), event({ key: 'estimate:est-1:accepted', atMs: at('2026-10-19T15:00:00Z') })], 'all', NOW_28)).toHaveLength(1)
    expect(estimateAnswerOf('estimate:est-1:accepted')).toBe('accepted')
    expect(estimateAnswerOf('estimate:est-1:declined')).toBe('declined')
    expect(estimateAnswerOf('estimate:est-1:opened')).toBeNull()
    expect(estimateAnswerOf('rating:r-1:answered')).toBeNull()
    expect(estimateAnswerOf(null)).toBeNull()
  })
  it('a Heard back line clears the row, in any of its four shapes; any other event line counts for nothing', () => {
    for (const r of HEARD_ROWS) {
      const body = heardBackBody('Taunya', r.how, 'Nov 3')
      expect(heardBackOf(body), body).toBe(r.how)
      expect(plainWordsFailures(body), body).toEqual([])
      expect(waitingOnThem([ours(), event({ body, atMs: at('2026-11-03T19:00:00Z') })], 'all', NOW_28), body).toEqual([])
    }
    expect(heardBackBody('Taunya', 'phone', 'Nov 3')).toBe('Taunya heard back by phone on Nov 3.')
    expect(heardBackBody('Taunya', 'text', 'Nov 3')).toBe('Taunya heard back by text on their own phone on Nov 3.')
    expect(heardBackBody('Taunya', 'person', 'Nov 3')).toBe('Taunya heard back in person on Nov 3.')
    expect(heardBackBody('Taunya', 'none', 'Nov 3')).toBe('Taunya said on Nov 3 that no answer is needed.')
    expect(heardBackBody('  ', 'phone', 'Nov 3')).toBe('Someone heard back by phone on Nov 3.')
    expect(heardBackOf('Taunya set how Evan hears from us: email.')).toBeNull()
    expect(heardBackOf('Rosa took Evan Jarrow.')).toBeNull()
    // The morning run's line, a take, the customer's say: none of them is their word, and none restarts the wait.
    const took = event({ body: 'Rosa took Evan Jarrow.', atMs: at('2026-10-26T15:00:00Z') })
    expect(theirWord(took)).toBeNull()
    expect(waitingOnThem([ours(), took], 'all', NOW_28).map((r) => r.days)).toEqual([7])
  })
  it('a call the office logged with their words is their word; a call Quo recorded is ours', () => {
    const logged = ours({ id: 'l1', channel: 'call', body: 'Called Evan. They said: go ahead with the $6,250 option', atMs: at('2026-10-21T15:00:00Z') })
    expect(theirWord(logged)).toBe(true)
    expect(waitingOnThem([ours(), logged], 'all', NOW_28)).toEqual([])
    const quo = ours({ id: 'q1', channel: 'call', body: 'Outgoing call · 0:12', atMs: at('2026-10-21T15:00:00Z') })
    expect(theirWord(quo)).toBe(false)
    expect(waitingOnThem([ours(), quo], 'all', NOW_28).map((r) => [r.name, r.days])).toEqual([['Evan Jarrow', 6]])
  })
  it('Heard back’s words are plain', () => {
    expect(HEARD_ROWS.map((r) => r.label)).toEqual(['By phone', 'By text from my phone', 'In person', 'No answer needed'])
    for (const words of [HEARD_WORDS.tip, HEARD_WORDS.undone('Evan Jarrow'), ...HEARD_ROWS.map((r) => HEARD_WORDS.toast(r.how, 'Evan Jarrow'))]) expect(plainWordsFailures(words), words).toEqual([])
    expect(HEARD_WORDS.toast('phone', 'Evan Jarrow')).toBe('Heard back from Evan Jarrow by phone. The line lands on the thread in ten seconds.')
    expect(HEARD_WORDS.toast('none', 'Evan Jarrow')).toBe('No answer needed from Evan Jarrow. The line lands on the thread in ten seconds.')
  })
})

describe('a mail filed for the record (v2.7027, punch list #324)', () => {
  it('a filed mail of ours makes nobody quiet', () => {
    expect(waitingOnThem([line({ history: true, atMs: at('2026-10-01T18:31:00Z') })], 'all', NOW)).toEqual([])
  })

  it('a live line of ours still waits behind a filed mail of ours', () => {
    const rows = waitingOnThem([line({ id: 'live', atMs: at('2026-10-10T18:31:00Z') }), line({ id: 'filed', history: true, atMs: at('2026-10-12T18:31:00Z') })], 'all', NOW)
    expect(rows.map((r) => r.days)).toEqual([10])
  })

  it('a filed mail of theirs is still their answer', () => {
    const rows = waitingOnThem([line({ id: 'ours', atMs: at('2026-10-01T18:31:00Z') }), line({ id: 'theirs', direction: 'in', history: true, atMs: at('2026-10-03T18:31:00Z') })], 'all', NOW)
    expect(rows).toEqual([])
  })
})
