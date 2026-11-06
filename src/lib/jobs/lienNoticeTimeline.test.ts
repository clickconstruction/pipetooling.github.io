import { describe, expect, it } from 'vitest'
import { addDaysYmd, lienNoticeTimeline, lienTimelineTodayWords, lienTimelineWhyChips, type LienNoticeTimelineFacts } from './lienNoticeTimeline'

const facts = (over: Partial<LienNoticeTimelineFacts> = {}): LienNoticeTimelineFacts => ({
  todayYmd: '2026-11-06',
  day0: { ymd: '2026-10-14', why: 'from the day the run recorded it, Oct 14' },
  lienDay: '2026-11-16',
  courtesySentYmd: null,
  letter: { state: 'overdue', sentYmd: null },
  payments: [],
  openBalance: 12045,
  claim: 12045,
  affidavitFiled: false,
  todayWords: 'Nothing has been paid or answered, and the attorney’s letter has not gone.',
  ...over,
})

describe('lienNoticeTimeline — one notice, top to bottom (punch list #274, PR 2)', () => {
  it('adds days to a calendar day across a month end', () => {
    expect(addDaysYmd('2026-10-28', 7)).toBe('2026-11-04')
    expect(addDaysYmd('2026-11-16', -7)).toBe('2026-11-09')
  })
  it('job 853 on Nov 6: mailed · the courtesy window open · the letter late · today · the affidavit’s week soon · the law’s day, in date order', () => {
    const rows = lienNoticeTimeline(facts())
    expect(rows.map((r) => [r.key, r.from, r.status])).toEqual([
      ['mailed', '2026-10-14', 'done'],
      ['courtesy', '2026-10-21', 'open'],
      ['letter', '2026-10-24', 'late'],
      ['today', '2026-11-06', 'now'],
      ['week', '2026-11-09', 'soon'],
      ['lien', '2026-11-16', 'deadline'],
    ])
    const by = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(by.mailed!.title).toBe('The lien notice was mailed to the owner and the GC for $12,045.')
    expect(by.mailed!.detail).toBe('Day 0 counts from the day the run recorded it, Oct 14.')
    expect(by.mailed!.next).toBe('23 days ago · the clock started')
    expect(by.courtesy).toMatchObject({ to: '2026-11-09', dayFrom: 7, dayTo: 26, chip: 'courtesy notice', statusWords: 'open · optional', next: '3 days left to send it · after Nov 9 the desk asks for the affidavit' })
    expect(by.letter).toMatchObject({ to: '2026-10-28', dayFrom: 10, dayTo: 14, chip: 'attorney’s letter', statusWords: 'late · act now', next: '9 days past the window · it still goes, weaker each day' })
    expect(by.week).toMatchObject({ chip: 'our rule', statusWords: 'starts in 3 days', next: 'on Nov 9 the button here becomes Draft affidavit' })
    expect(by.lien).toMatchObject({ chip: 'legal requirement', statusWords: 'deadline · in 10 days', next: 'miss it and the lien is lost for good' })
    expect(by.today!.dayFrom).toBe(23)
  })
  it('the one courtesy that went reads done with no second one, and the letter inside its window reads due now', () => {
    const rows = lienNoticeTimeline(facts({ todayYmd: '2026-10-26', courtesySentYmd: '2026-10-22', letter: { state: 'due', sentYmd: null } }))
    const by = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(by.courtesy).toMatchObject({ from: '2026-10-22', status: 'done', next: '4 days ago · no second one' })
    expect(by.letter).toMatchObject({ status: 'open', statusWords: 'due now', next: '2 days left in the window' })
    expect(by.week!.statusWords).toBe('starts in 14 days')
  })
  it('a partial payment is a green row with the remainder on the last one, and the law’s day names the remainder', () => {
    const rows = lienNoticeTimeline(facts({ payments: [{ ymd: '2026-10-30', amount: 1000 }, { ymd: '2026-11-03', amount: 3000 }], openBalance: 8045 }))
    const pays = rows.filter((r) => r.kind === 'payment')
    expect(pays.map((r) => [r.title, r.status, r.next])).toEqual([
      ['$1,000 paid.', 'paying', '7 days ago'],
      ['$3,000 paid · $8,045 still owed.', 'paying', '3 days ago · the remainder is the claim'],
    ])
    expect(rows.find((r) => r.key === 'lien')!.title).toBe('The lien for the $8,045 still owed must be on file at the county by this day, or the right to it is lost.')
    expect(rows.map((r) => r.key)).toEqual(['mailed', 'courtesy', 'letter', 'pay:2026-10-30:0', 'pay:2026-11-03:1', 'today', 'week', 'lien'])
  })
  it('paid in full closes the card: the courtesy and letter windows go, the payment reads paid, the deadline is cleared', () => {
    const rows = lienNoticeTimeline(facts({ payments: [{ ymd: '2026-11-03', amount: 12045 }], openBalance: 0, todayWords: 'Closed. Nothing is owed and nothing is left to send.' }))
    expect(rows.map((r) => [r.key, r.status])).toEqual([['mailed', 'done'], ['pay:2026-11-03:0', 'paid'], ['today', 'now'], ['lien', 'cleared']])
    expect(rows[1]).toMatchObject({ title: '$12,045 paid · paid in full.', statusWords: '✓ paid', next: '3 days ago · the ladder closed' })
    expect(rows[3]).toMatchObject({ chip: 'no longer applies', statusWords: 'deadline', next: 'cleared by the payment' })
  })
  it('a courtesy the law holds reads held with its reason, and the letter still goes', () => {
    const row = lienNoticeTimeline(facts({ courtesyHeld: 'no approved work month on the job yet' })).find((r) => r.key === 'courtesy')
    expect(row).toMatchObject({ status: 'skipped', statusWords: 'held', next: 'no approved work month on the job yet · the attorney’s letter still goes' })
  })
  it('a filed affidavit reads filed; a passed day with nothing filed reads passed', () => {
    expect(lienNoticeTimeline(facts({ affidavitFiled: true, letter: { state: 'sent', sentYmd: '2026-10-25' } })).find((r) => r.key === 'lien')).toMatchObject({ status: 'done', statusWords: '✓ filed' })
    expect(lienNoticeTimeline(facts({ todayYmd: '2026-11-20' })).find((r) => r.key === 'lien')).toMatchObject({ status: 'missed', next: '4 days ago · the lien right for this month is lost' })
  })
  it('groups the step’s reasons into chips, biggest first', () => {
    expect(lienTimelineWhyChips(['no approved work month yet', 'the affidavit’s week', 'no approved work month yet', ''])).toEqual([
      { why: 'no approved work month yet', n: 2 },
      { why: 'the affidavit’s week', n: 1 },
    ])
  })
})

describe('lienTimelineTodayWords — the today row', () => {
  it('reads the state in one plain sentence', () => {
    expect(lienTimelineTodayWords({ courtesyState: 'held', courtesyReason: 'no approved work month on the job yet', letterState: 'overdue', paidInFull: false })).toBe('You are here. The courtesy is held: no approved work month on the job yet.')
    expect(lienTimelineTodayWords({ courtesyState: 'sent', letterState: 'waiting', paidInFull: false, waitingForAnswer: true })).toContain('waits a week')
    expect(lienTimelineTodayWords({ courtesyState: 'closed', letterState: 'paid', paidInFull: true })).toBe('Closed. Nothing is owed and nothing is left to send.')
  })
})
