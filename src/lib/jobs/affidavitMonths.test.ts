import { describe, expect, it } from 'vitest'
import type { WorkMonth } from './forecastWorkMonths'
import type { LienMonthHistoryEntry } from './lienMonthHistory'
import { AFFIDAVIT_HAND_DAY_WORDS, affidavitMonthRows, affidavitMonthRowsWithoutHours, affidavitMonthsSentence, affidavitNoHoursSource } from './affidavitMonths'

const wm = (key: string, hours: number, notice: WorkMonth['notice']): WorkMonth => ({ key, label: key, weeks: [], people: [], hours, pendingHours: 0, dayCount: 1, hoursShare: 0, notice })
const hist = (month: string, over: Partial<LienMonthHistoryEntry>): LienMonthHistoryEntry => ({ month, outcome: 'missed', at: '', reason: '', byName: '', deadline: '', approvedHours: null, approvalMode: '', ...over })
const label = (k: string) => ({ '2026-06': 'June 2026', '2026-07': 'July 2026', '2026-08': 'August 2026', '2026-05': 'May 2026' })[k] ?? k

describe('affidavitMonthRows (v2.3681)', () => {
  it('a noticed month is on the lien, a missed one is unsecured, an open one waits — job 258', () => {
    const work = [wm('2026-06', 8, { due: '2026-09-15', daysLeft: -6, state: 'closed' }), wm('2026-07', 41.4, { due: '2026-10-15', daysLeft: 24, state: 'sent' }), wm('2026-08', 61.7, { due: '2026-11-16', daysLeft: 56, state: 'open' })]
    const history = [hist('2026-06', { deadline: '2026-09-15' }), hist('2026-07', { outcome: 'sent', at: '2026-09-24T15:00:00Z' })]
    const rows = affidavitMonthRows(work, history)
    expect(rows).toEqual([
      { key: '2026-06', status: 'unsecured', words: '8 approved hours · window closed Sep 15 with no notice — the lien does not cover it' },
      { key: '2026-07', status: 'lien', words: '41.4 approved hours · notice sent Sep 24' },
      { key: '2026-08', status: 'open', words: '61.7 approved hours · notice still open — mail by Nov 16' },
    ])
    expect(affidavitMonthsSentence(rows, label)).toBe("The affidavit names July 2026, and August 2026 once its notice has gone out. June 2026's share of the balance stays an ordinary receivable — chase it in Collections; it does not ride on the lien.")
  })

  it('a skipped month says who gave it up; a direct job needs no monthly notice; nothing noticed says so', () => {
    const skipped = affidavitMonthRows([wm('2026-05', 1, { due: '2026-08-17', daysLeft: -30, state: 'closed' })], [hist('2026-05', { outcome: 'skipped', at: '2026-08-11T13:59:00Z', byName: 'Taunya', reason: 'paid' })])
    expect(skipped[0]).toEqual({ key: '2026-05', status: 'unsecured', words: '1 approved hour · skipped Aug 11 by Taunya — given up on purpose; the lien does not cover it' })
    expect(affidavitMonthsSentence(skipped, label)).toBe("No month has a notice on record — the affidavit cannot claim this work. May 2026's share of the balance stays an ordinary receivable — chase it in Collections; it does not ride on the lien.")
    expect(affidavitMonthRows([wm('2026-06', 8, null)], [])[0]).toEqual({ key: '2026-06', status: 'lien', words: '8 approved hours · no monthly notice required' })
    expect(affidavitMonthsSentence([{ key: '2026-08', status: 'open', words: '' }], label)).toBe('Nothing is on the lien yet — August 2026 joins it once the notice has gone out.')
  })
})

describe('a month noticed or skipped in the evening keeps its day (v2.4468)', () => {
  it('reads the Central day', () => {
    // 00:30 UTC on Sep 25 is 7:30 pm CDT on Sep 24; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    const sent = affidavitMonthRows([wm('2026-07', 41.4, { due: '2026-10-15', daysLeft: 24, state: 'sent' })], [hist('2026-07', { outcome: 'sent', at: '2026-09-25T00:30:00Z' })])
    expect(sent[0]!.words).toBe('41.4 approved hours · notice sent Sep 24')
    const skipped = affidavitMonthRows([wm('2026-09', 1, { due: '2026-12-15', daysLeft: 13, state: 'closed' })], [hist('2026-09', { outcome: 'skipped', at: '2026-12-02T00:30:00+00:00', byName: 'Taunya', reason: 'paid' })])
    expect(skipped[0]!.words).toMatch(/^1 approved hour · skipped Dec 1 by Taunya/)
    const noon = affidavitMonthRows([wm('2026-07', 41.4, { due: '2026-10-15', daysLeft: 24, state: 'sent' })], [hist('2026-07', { outcome: 'sent', at: '2026-09-25T12:00:00Z' })])
    expect(noon[0]!.words).toBe('41.4 approved hours · notice sent Sep 25')
  })
})

describe('a job with no approved clock month still gets its card (punch list #415)', () => {
  // A property with no kind on record reads as a house: September's notice day is Nov 16, October's Dec 15.
  const deadlineOf = (m: string) => ({ '2026-09': '2026-11-16', '2026-10': '2026-12-15' })[m] ?? ''
  const TODAY = '2026-11-24'

  it('a month dated from the bill reads its notice as a clock month does', () => {
    const noticed = affidavitMonthRowsWithoutHours({ months: ['2026-09'], source: 'bill', named: ['2026-09'], history: [], deadlineOf, todayYmd: TODAY })
    expect(noticed).toEqual([{ key: '2026-09', status: 'lien', words: 'dated from the bill · no clock hours · notice sent' }])
    expect(affidavitMonthsSentence(noticed, label)).toBe('The affidavit names 2026-09.')
    const sentOnDesk = affidavitMonthRowsWithoutHours({ months: ['2026-09'], source: 'bill', named: [], history: [hist('2026-09', { outcome: 'sent', at: '2026-10-02T15:00:00Z' })], deadlineOf, todayYmd: TODAY })
    expect(sentOnDesk[0]!.words).toBe('dated from the bill · no clock hours · notice sent Oct 2')
  })

  it('a closed month with no notice is worked but unsecured, and an open one waits', () => {
    const closed = affidavitMonthRowsWithoutHours({ months: ['2026-09'], source: 'job_created', named: [], history: [], deadlineOf, todayYmd: TODAY })
    expect(closed).toEqual([{ key: '2026-09', status: 'unsecured', words: 'dated from the job’s creation · no clock hours · window closed Nov 16 with no notice — the lien does not cover it' }])
    const open = affidavitMonthRowsWithoutHours({ months: ['2026-10'], source: 'hand', named: [], history: [], deadlineOf, todayYmd: TODAY })
    expect(open).toEqual([{ key: '2026-10', status: 'open', words: `${AFFIDAVIT_HAND_DAY_WORDS} · notice still open — mail by Dec 15` }])
    // The notice day itself is still open: the window closes the day after.
    expect(affidavitMonthRowsWithoutHours({ months: ['2026-09'], source: 'hand', named: [], history: [], deadlineOf, todayYmd: '2026-11-16' })[0]!.status).toBe('open')
  })

  it('a skip keeps its name, each month is drawn once and oldest first, and a key that is no month is left out', () => {
    const rows = affidavitMonthRowsWithoutHours({
      months: ['2026-10', '2026-09', '2026-10', 'soon'],
      source: 'hand',
      named: ['2026-10'],
      history: [hist('2026-09', { outcome: 'skipped', at: '2026-11-11T13:59:00Z', byName: 'Dana', reason: 'paid' })],
      deadlineOf,
      todayYmd: TODAY,
    })
    expect(rows.map((r) => [r.key, r.status])).toEqual([['2026-09', 'unsecured'], ['2026-10', 'lien']])
    expect(rows[0]!.words).toBe(`${AFFIDAVIT_HAND_DAY_WORDS} · skipped Nov 11 by Dana — given up on purpose; the lien does not cover it`)
  })

  it('the source comes off the affidavit row: a stand-in from the bill or the creation, a hand day, or none', () => {
    expect(affidavitNoHoursSource({ lastMonthFromCreation: true, lastMonthFromBill: true })).toBe('bill')
    expect(affidavitNoHoursSource({ lastMonthFromCreation: true })).toBe('job_created')
    expect(affidavitNoHoursSource({ lastMonthFromCreation: false, lastMonthByHand: true })).toBe('hand')
    expect(affidavitNoHoursSource({ lastMonthFromCreation: false })).toBeNull()
    // A hand day on a job with approved clock days is dated from hours too: its card comes from the clock months.
    expect(affidavitNoHoursSource({ lastMonthByHand: true, firstWorkDate: '2026-09-02', lastWorkDate: '2026-09-30' })).toBeNull()
    expect(affidavitNoHoursSource({ lastMonthByHand: true, firstWorkDate: null, lastWorkDate: '' })).toBe('hand')
  })
})
