import { describe, expect, it } from 'vitest'
import { alreadySentToday, lastRunWords, parseWeeklySendRun, weeklySendRecipients, weeklySendStateWords, weeklySendTickNow, weeklySheetIsOn, WEEKLY_SEND_CRON } from './weeklySend'

const md = (ymd: string) => ymd

describe('weeklySendTickNow — a Monday, 6 AM Central, whichever of the two UTC ticks that is', () => {
  it('runs the summer tick and not the winter one, and never on another day', () => {
    expect(weeklySendTickNow(new Date('2026-10-26T11:00:00Z'))).toBe(true) // Mon 6 AM CDT
    expect(weeklySendTickNow(new Date('2026-10-26T12:00:00Z'))).toBe(false) // Mon 7 AM CDT
    expect(weeklySendTickNow(new Date('2026-10-27T11:00:00Z'))).toBe(false) // Tue
  })
  it('runs the winter tick once the clocks fall back', () => {
    expect(weeklySendTickNow(new Date('2026-12-07T12:00:00Z'))).toBe(true) // Mon 6 AM CST
    expect(weeklySendTickNow(new Date('2026-12-07T11:00:00Z'))).toBe(false) // Mon 5 AM CST
  })
  it('the cron fires both ticks on Mondays only', () => {
    expect(WEEKLY_SEND_CRON).toBe('0 11,12 * * 1')
  })
})

describe('the switch and the last run', () => {
  it("only 'true' is on", () => {
    expect(weeklySheetIsOn('true')).toBe(true)
    expect(weeklySheetIsOn('false')).toBe(false)
    expect(weeklySheetIsOn(null)).toBe(false)
  })
  it('round-trips the run and refuses what is not one', () => {
    const run = { at: '2026-10-26T11:00:05Z', day: '2026-10-26', dry: false, sent: ['a@x.com'], failed: [{ to: 'b@x.com', error: 'bounced' }], gaps: ['the bank'], subject: 'The Bridge' }
    expect(parseWeeklySendRun(JSON.stringify(run))).toEqual(run)
    expect(parseWeeklySendRun('{"at":1}')).toBeNull()
    expect(parseWeeklySendRun('nope')).toBeNull()
    expect(parseWeeklySendRun(null)).toBeNull()
  })
  it('a second tick the same day sends nothing twice; a dry run or an empty run does not count', () => {
    const base = { at: 'x', day: '2026-10-26', dry: false, sent: ['a@x.com'], failed: [], gaps: [], subject: '' }
    expect(alreadySentToday(base, '2026-10-26')).toBe(true)
    expect(alreadySentToday(base, '2026-11-02')).toBe(false)
    expect(alreadySentToday({ ...base, dry: true }, '2026-10-26')).toBe(false)
    expect(alreadySentToday({ ...base, sent: [] }, '2026-10-26')).toBe(false)
    expect(alreadySentToday(null, '2026-10-26')).toBe(false)
  })
})

describe('weeklySendRecipients — every dev with a real account and an address, nobody else', () => {
  it('keeps devs, drops the rest, trims and dedupes', () => {
    expect(
      weeklySendRecipients([
        { role: 'dev', email: ' Owner@X.com ', archived_at: null },
        { role: 'dev', email: 'owner@x.com', archived_at: null },
        { role: 'dev', email: 'gone@x.com', archived_at: '2026-01-01' },
        { role: 'dev', email: 'sample@x.com', archived_at: null, is_sample: true },
        { role: 'dev', email: 'twin@x.com', archived_at: null, is_digital_twin: true },
        { role: 'dev', email: 'tester@x.com', archived_at: null, is_walk_tester: true },
        { role: 'dev', email: '', archived_at: null },
        { role: 'master_technician', email: 'boss@x.com', archived_at: null },
        { role: 'assistant', email: 'office@x.com', archived_at: null },
      ]),
    ).toEqual(['owner@x.com'])
  })
})

describe('the words', () => {
  it('say what the switch does', () => {
    expect(weeklySendStateWords(true)).toBe('On: the sheet goes to every dev on Monday at 6 AM Central.')
    expect(weeklySendStateWords(false)).toBe('Off: nothing goes out on Monday. Email me this sheet still works.')
  })
  it('read the last run', () => {
    expect(lastRunWords(null, md)).toBe('Not sent yet.')
    expect(lastRunWords({ at: '', day: '2026-10-26', dry: false, sent: ['a', 'b'], failed: [], gaps: [], subject: '' }, md)).toBe('Last sent 2026-10-26 to 2 people.')
    expect(lastRunWords({ at: '', day: '2026-10-26', dry: false, sent: ['a'], failed: [{ to: 'b', error: 'x' }], gaps: ['the bank'], subject: '' }, md)).toBe('Last sent 2026-10-26 to 1 person. 1 address failed. Not read: the bank.')
    expect(lastRunWords({ at: '', day: '2026-10-26', dry: true, sent: ['a'], failed: [], gaps: [], subject: '' }, md)).toBe('Last dry run 2026-10-26, built for 1 person.')
  })
})
