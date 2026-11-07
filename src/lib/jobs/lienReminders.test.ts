import { describe, expect, it } from 'vitest'
import type { CourtesyStatus } from './lienCourtesyNotice'
import type { LetterTwoStatus } from './lienLetterTwo'
import { buildLienReminders, lienReminderAt, lienReminderLadderItems, lienReminderBrief, lienReminderRungRule, lienReminderRungWords, lienReminderStepWho } from './lienReminders'

const two = (over: Partial<LetterTwoStatus> = {}): LetterTwoStatus => ({ state: 'waiting', day: 4, clock: { kind: 'recorded', at: '2026-10-31T15:00:00Z', why: '' }, firstItemId: 'i1', firstSentAt: '2026-10-31T15:00:00Z', letterTwo: null, gcAuthorized: null, ownerCalledAt: null, words: 'day 4', ...over })

const courtesy = (over: Partial<CourtesyStatus> = {}): CourtesyStatus => ({ state: 'due', day: 21, words: 'day 21 · nothing since the packet', reason: '', lastSentAt: null, waitingForAnswer: false, lienDay: '2026-11-16', records: [], ...over })

describe('lienReminderAt — the rung a sent notice stands on (punch list #262)', () => {
  it('is nothing with nothing out', () => {
    expect(lienReminderAt(null, null)).toBeNull()
    expect(lienReminderAt(courtesy({ state: 'none' }), two())).toBeNull()
  })
  it('step 1: due from day 7 with nothing since the packet; before day 7 it stands there uncounted', () => {
    expect(lienReminderAt(courtesy(), two({ state: 'overdue', day: 21 }))).toEqual({ step: 1, state: 'due', words: 'day 21 · nothing since the packet', day: 21, counted: true })
    const w = lienReminderAt(courtesy({ state: 'waiting', day: 4, words: 'day 4 · courtesy from day 7' }), two())
    expect(w).toEqual({ step: 1, state: 'waiting', words: 'day 4 · courtesy from day 7', day: 4, counted: false })
  })
  it('step 2 once the one courtesy went: sent inside the week; after it the attorney’s letter leads on step 3 (v2.6594, never a second courtesy)', () => {
    const sent = courtesy({ state: 'sent', day: 9, words: 'courtesy sent Nov 2 by email and text', lastSentAt: '2026-11-02T16:00:00Z', waitingForAnswer: true })
    expect(lienReminderAt(sent, two({ day: 9 }))).toMatchObject({ step: 2, state: 'sent', counted: true })
    const quiet = courtesy({ state: 'sent', day: 16, words: 'day 16 · courtesy sent Nov 2 by email and text · nothing since · the attorney’s letter next', lastSentAt: '2026-11-02T16:00:00Z' })
    expect(lienReminderAt(quiet, two({ state: 'overdue', day: 16, words: 'day 16 · the attorney’s letter overdue' }))).toMatchObject({ step: 3, state: 'two_due', words: `day 16 · the attorney’s letter overdue · ${quiet.words}` })
    // A week of silence with the letter not yet due stays on step 2.
    expect(lienReminderAt(quiet, two({ state: 'waiting', day: 9 }))).toMatchObject({ step: 2, state: 'sent' })
  })
  it('step 3 while an attorney’s letter is on the desk or went, whatever the courtesy says, with the courtesy’s words kept when one went', () => {
    const drafting = two({ state: 'in_flight', day: 12, words: 'the attorney’s letter · unresponsive · drafting', letterTwo: { itemId: 'i2', kind: 'unresponsive', status: 'draft', sentAt: null } })
    expect(lienReminderAt(courtesy({ day: 12 }), drafting)).toMatchObject({ step: 3, state: 'two_drafting', words: 'the attorney’s letter · unresponsive · drafting' })
    const awaiting = two({ state: 'in_flight', words: 'the attorney’s letter · paid-out · awaiting the leader', letterTwo: { itemId: 'i2', kind: 'paid_out', status: 'awaiting_approval', sentAt: null } })
    expect(lienReminderAt(courtesy(), awaiting)?.state).toBe('two_awaiting')
    const inRun = two({ state: 'in_flight', words: 'the attorney’s letter · paid-out · in the run', letterTwo: { itemId: 'i2', kind: 'paid_out', status: 'approved', sentAt: null } })
    expect(lienReminderAt(courtesy(), inRun)?.state).toBe('two_in_run')
    const held = two({ state: 'in_flight', words: 'the attorney’s letter · paid-out · held', letterTwo: { itemId: 'i2', kind: 'paid_out', status: 'held', sentAt: null } })
    expect(lienReminderAt(courtesy(), held)?.state).toBe('two_held')
    const sent = two({ state: 'sent', day: 18, words: 'the attorney’s letter sent Nov 12 · unresponsive', letterTwo: { itemId: 'i2', kind: 'unresponsive', status: 'sent', sentAt: '2026-11-12T15:00:00Z' } })
    const withCourtesy = courtesy({ state: 'due', day: 18, words: 'day 18 · courtesy sent Nov 2 by email · nothing since', lastSentAt: '2026-11-02T16:00:00Z' })
    expect(lienReminderAt(withCourtesy, sent)).toMatchObject({ step: 3, state: 'two_sent', words: 'the attorney’s letter sent Nov 12 · unresponsive · day 18 · courtesy sent Nov 2 by email · nothing since' })
  })
  it('step 4 with the closer named: paid, the GC’s okay, the owner’s call, the filed affidavit, a reply — and held, since no reminder may go', () => {
    expect(lienReminderAt(courtesy({ state: 'closed', words: 'paid', reason: 'paid' }), two({ state: 'paid' }))).toMatchObject({ step: 4, state: 'paid', words: 'paid' })
    expect(lienReminderAt(courtesy({ state: 'closed', words: 'the GC authorized direct pay Nov 3', reason: 'the GC authorized direct pay Nov 3' }), two({ state: 'gc_authorized', gcAuthorized: { at: '2026-11-03T15:00:00Z', name: 'Dana', note: '' } }))?.state).toBe('gc_authorized')
    expect(lienReminderAt(courtesy({ state: 'closed', words: 'owner called Nov 4', reason: 'owner called Nov 4' }), two({ state: 'owner_called', ownerCalledAt: '2026-11-04T15:00:00Z' }))?.state).toBe('owner_called')
    // After letter two went, the owner's call still closes it (v2.6383): letter two reads sent, the courtesy reads closed.
    expect(lienReminderAt(courtesy({ state: 'closed', words: 'owner called Nov 14', reason: 'owner called Nov 14' }), two({ state: 'sent', ownerCalledAt: '2026-11-14T15:00:00Z', letterTwo: { itemId: 'i2', kind: 'unresponsive', status: 'sent', sentAt: '2026-11-12T15:00:00Z' } }))).toMatchObject({ step: 4, state: 'owner_called' })
    expect(lienReminderAt(courtesy({ state: 'closed', words: 'the affidavit is filed · served next', reason: 'the affidavit is filed · served next' }), two())?.state).toBe('filed')
    expect(lienReminderAt(courtesy({ state: 'closed', words: 'they answered Nov 5', reason: 'they answered Nov 5' }), two())?.state).toBe('answered')
    expect(lienReminderAt(courtesy({ state: 'affidavit_week', words: 'the affidavit’s week · file it by Nov 10' }), two({ state: 'waiting', day: 6 }))).toMatchObject({ step: 4, state: 'affidavit_week', words: 'the affidavit’s week · file it by Nov 10' })
  })
  it('a held courtesy with the attorney’s letter due stands on step 3, since counsel’s letter still goes; the attorney’s letter sent wins over held', () => {
    const held = courtesy({ state: 'held', words: 'Courtesy held · the lien window closed', reason: 'the lien window closed' })
    expect(lienReminderAt(held, two({ state: 'overdue', day: 21, words: 'day 21 · the attorney’s letter overdue' }))).toMatchObject({ step: 3, state: 'two_due', words: 'day 21 · the attorney’s letter overdue · Courtesy held · the lien window closed' })
    expect(lienReminderAt(held, two({ state: 'waiting', day: 5 }))?.step).toBe(4)
    expect(lienReminderAt(held, two({ state: 'sent', words: 'the attorney’s letter sent Nov 1 · unresponsive', letterTwo: { itemId: 'i2', kind: 'unresponsive', status: 'sent', sentAt: '2026-11-01T15:00:00Z' } }))).toMatchObject({ step: 3, state: 'two_sent' })
  })
  it('takes the attorney’s letter’s day when the courtesy carries none', () => {
    expect(lienReminderAt(courtesy({ day: null }), two({ day: 8 }))?.day).toBe(8)
  })
})

describe('buildLienReminders — the strip’s counts and the names behind them', () => {
  it('adds the desk’s jobs up per rung, the longest waiting first, with the uncounted ones before day 7 beside step 1', () => {
    const r = buildLienReminders({
      courtesyByJob: {
        j663: courtesy({ day: 21, words: 'day 21 · nothing since the packet' }),
        j273: courtesy({ day: 29, words: 'day 29 · nothing since the packet' }),
        j912: courtesy({ state: 'waiting', day: 3, words: 'day 3 · courtesy from day 7' }),
        j741: courtesy({ state: 'sent', day: 9, words: 'courtesy sent Nov 2 by email and text', lastSentAt: '2026-11-02T16:00:00Z' }),
        j733: courtesy({ day: 16 }),
        j729: courtesy({ state: 'closed', words: 'paid', reason: 'paid' }),
        j700: courtesy({ state: 'none' }),
      },
      letterTwoByJob: {
        j663: two({ state: 'overdue', day: 21 }),
        j273: two({ state: 'overdue', day: 29 }),
        j912: two({ day: 3 }),
        j741: two({ day: 9 }),
        j733: two({ state: 'in_flight', day: 16, words: 'the attorney’s letter · unresponsive · drafting', letterTwo: { itemId: 'i2', kind: 'unresponsive', status: 'draft', sentAt: null } }),
        j729: two({ state: 'paid' }),
      },
      jobTitle: (id) => ({ j663: '663 · Knight Contracting', j273: '273 · Dudley (Lennox)', j912: '912 · Harlan Homes', j741: '741 · Ridgeway Builders', j733: '733 · Castell', j729: '729 · Pecan Grove' })[id] ?? id,
    })
    expect(r.counts).toEqual([2, 1, 1, 1])
    expect(r.waiting).toBe(1)
    expect(r.rows.map((x) => `${x.step} ${x.title} ${x.state}`)).toEqual(['1 273 · Dudley (Lennox) due', '1 663 · Knight Contracting due', '1 912 · Harlan Homes waiting', '2 741 · Ridgeway Builders sent', '3 733 · Castell two_drafting', '4 729 · Pecan Grove paid'])
  })
  it('is empty with no sent notice', () => {
    expect(buildLienReminders({ courtesyByJob: {}, letterTwoByJob: {}, jobTitle: (id) => id })).toEqual({ rows: [], counts: [0, 0, 0, 0], waiting: 0 })
  })
})

describe('the rung’s words, whose press each rung is, and the card', () => {
  it('names the uncounted notices beside step 1 only', () => {
    expect(lienReminderRungWords(1, 2)).toBe(' · 2 before day 7')
    expect(lienReminderRungWords(1, 0)).toBe('')
    expect(lienReminderRungWords(2, 2)).toBe('')
  })
  it('the attorney’s letter is the leader’s rung, the rest the office’s', () => {
    expect([1, 2, 3, 4].map((n) => lienReminderStepWho(n as 1 | 2 | 3 | 4))).toEqual(['office', 'office', 'leader', 'office'])
  })
  it('writes the ladder out for the card: done, now, to come', () => {
    const items = lienReminderLadderItems({ step: 2, state: 'sent', words: 'day 16 · courtesy sent Nov 2 by email · nothing since', day: 16, counted: true })
    expect(items.map((i) => `${i.state} ${i.title}`)).toEqual(['done Reminder went', 'now Reminder sent', 'todo Attorney’s letter', 'todo Closed'])
    expect(items[1]!.detail).toBe('day 16 · courtesy sent Nov 2 by email · nothing since. One courtesy goes; after a week of silence the attorney’s letter leads.')
    expect(items[2]!.detail).toBe('Counsel’s certified second letter, from day 10.')
    const closed = lienReminderLadderItems({ step: 4, state: 'paid', words: 'paid', day: 30, counted: true })
    expect(closed.map((i) => i.state)).toEqual(['done', 'done', 'done', 'now'])
    expect(closed[3]!.detail).toBe('Paid.')
    const waiting = lienReminderLadderItems({ step: 1, state: 'waiting', words: 'day 4 · courtesy from day 7', day: 4, counted: false })
    expect(waiting[0]!.detail).toBe('day 4 · courtesy from day 7. The desk offers the press from day 7 after the packet.')
  })
})

describe('lienReminderRungRule — a rung’s rule in words (v2.6522)', () => {
  it('names when a notice stands on each rung, the press, whose it is and what moves it on, with the clocks’ own days', () => {
    expect(lienReminderRungRule(1)).toMatchObject({ who: 'office', movesOn: 'the courtesy goes' })
    expect(lienReminderRungRule(1).when).toBe('the packet went, nothing came back, and it is day 7 or later')
    expect(lienReminderRungRule(2).press).toBe('none for 7 days; then Send the attorney’s letter. While they pay, Record what they promised')
    expect(lienReminderRungRule(3)).toMatchObject({ who: 'leader' })
    expect(lienReminderRungRule(3).when).toContain('due from day 10 and overdue from day 14 while the courtesy is held')
    expect(lienReminderRungRule(4).press).toBe('none; the notice reads under Sent')
  })
})

describe('lienReminderBrief — the step brief a pressed rung opens (v2.6574; plain words v2.6594)', () => {
  it('answers in plain words, why, what to do and what it does, the other moves with their meaning, what ends it, and what happens if nobody acts', () => {
    const one = lienReminderBrief(1)
    expect(one).toMatchObject({ title: 'Reminder due', who: 'office' })
    expect(one.plain).toContain('we send it once')
    expect(one.why).toBe('The packet went, nothing came back, and it is day 7 or later.')
    expect(one.usual).toEqual({ press: 'Send a courtesy notice', means: 'sends the email and the text in one press; it takes a minute' })
    expect(one.instead.map((m) => m.press)).toEqual(['Send the attorney’s letter', 'Record the owner’s call', 'The GC authorized direct pay'])
    expect(one.ifNobody).toContain('From day 10 the attorney’s letter is due')
    const two = lienReminderBrief(2)
    expect(two.plain).toContain('not another reminder')
    expect(two.usual?.press).toBe('Send the attorney’s letter')
    expect(two.instead[0]).toEqual({ press: 'Send a courtesy notice again', means: 'only by hand, when an email or a text bounced' })
    const three = lienReminderBrief(3)
    expect(three).toMatchObject({ title: 'Attorney’s letter', who: 'leader' })
    expect(three.usual?.press).toBe('Send the attorney’s letter')
    expect(three.why).toContain('due from day 10 and late from day 14')
    expect(three.closes).toContain('the affidavit is filed')
    expect(three.ifNobody).toContain('the right to it is lost')
    const four = lienReminderBrief(4)
    expect(four.usual).toBeNull()
    expect(four.closes).toBe('')
    expect(four.instead[1]?.press).toBe('Not what I said')
  })
})

describe('paying it down (punch list #274, PR 3)', () => {
  const paying = courtesy({ state: 'paying', day: 20, words: 'paying it down · $4,000 paid Nov 3 · $8,045 still owed', paying: { lastPaidYmd: '2026-11-03', lastAmount: 4000, stillOwed: 8045, until: '2026-11-10', promisedYmd: null, promise: null } })
  it('stands on step 2 as paying, whatever the letter’s clock says, unless a letter is on the desk or the courtesy is closed or held', () => {
    expect(lienReminderAt(paying, two({ state: 'overdue', day: 20 }))).toEqual({ step: 2, state: 'paying', words: paying.words, day: 20, counted: true })
    expect(lienReminderAt(paying, two({ state: 'in_flight', day: 20, words: 'the attorney’s letter · unresponsive · drafting', letterTwo: { itemId: 'i2', kind: 'unresponsive', status: 'draft', sentAt: null } }))?.state).toBe('two_drafting')
    const rows = buildLienReminders({ courtesyByJob: { j1: paying }, letterTwoByJob: { j1: two({ state: 'overdue', day: 20 }) }, jobTitle: () => '412 · Cedar Bend' })
    expect(rows.rows[0]).toMatchObject({ step: 2, state: 'paying', why: 'paying it down' })
    expect(rows.counts).toEqual([0, 1, 0, 0])
  })
  it('the card’s second rung reads Paying it down with the payment’s words, and the brief for a paying notice asks what they promised', () => {
    const items = lienReminderLadderItems({ step: 2, state: 'paying', words: paying.words, day: 20, counted: true })
    expect(items[1]).toEqual({ state: 'now', title: 'Paying it down', detail: 'Paying it down · $4,000 paid Nov 3 · $8,045 still owed. A partial payment is an answer: the desk stops reminding and asks what they promised for the rest.' })
    const brief = lienReminderBrief(2, 'paying')
    expect(brief).toMatchObject({ title: 'Reminder sent', who: 'office' })
    expect(brief.plain).toContain('A partial payment is an answer')
    expect(brief.plain).toContain('The lien’s last day does not move.')
    expect(brief.usual).toEqual({ press: 'Record what they promised', means: 'the date and the amount they gave for the rest; the desk asks again on that date' })
    expect(brief.instead.map((m) => m.press)).toEqual(['Send the attorney’s letter', 'Record the owner’s call', 'The GC authorized direct pay'])
    expect(brief.instead[0]!.means).toBe('anyway, when the payment was token')
    expect(brief.ifNobody).toContain('Nothing is sent while they pay.')
    // The plain step 2 brief is unchanged for a notice that is not paying.
    expect(lienReminderBrief(2, 'sent').usual?.press).toBe('Send the attorney’s letter')
    expect(lienReminderBrief(2).usual?.press).toBe('Send the attorney’s letter')
    expect(lienReminderRungRule(2).press).toContain('While they pay, Record what they promised')
  })
})
