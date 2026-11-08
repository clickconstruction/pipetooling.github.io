import { describe, expect, it } from 'vitest'
import { bonusWords, daysVsPlanOf, daysWords, holdReason, hoursUnderWords, jobScoreWords, keptWords, monthOf, monthRange, monthShift, monthWords, parseScoreRead, superintendentScores, type ScoreRow } from './superintendentScores'

const raw = {
  reads_wages: true,
  share_pct: 10,
  burden: 1.2,
  from: '2026-10-01',
  to: '2026-10-31',
  rows: [
    { user_id: 'pat', user_name: 'Pat Sample', job_id: 'j1', hcp_number: '1042', job_name: 'Harbor Lane Offices', status: 'working', awarded_kind: 'bid', awarded_at: '2026-10-02T15:00:00Z', planned_finish: '2026-11-14', awarded_hours: 516, certified_pct: 48, signed_on: '2026-10-30', signed_by: 'Taunya', team_hours: 190, sub_hours: 16, hours_under: '41.7', scored: true, signed_in_period: true, earned_usd: 11_146, actual_usd: 9_016, kept_usd: 2_130, bonus_usd: 213 },
    { user_id: 'pat', user_name: 'Pat Sample', job_id: 'j2', click_number: '1050', job_name: 'Pruett', status: 'working', awarded_kind: 'book', awarded_at: '2026-10-05T15:00:00Z', planned_finish: null, awarded_hours: 471, certified_pct: 20, signed_on: '2026-10-20', signed_by: 'Taunya', team_hours: 80, sub_hours: 0, hours_under: null, scored: false, signed_in_period: true, earned_usd: 0, actual_usd: 4_000, kept_usd: -4_000, bonus_usd: null },
    { user_id: 'lee', user_name: 'Lee Sample', job_id: 'j3', hcp_number: '1031', job_name: 'Cedar Row', status: 'working', awarded_kind: 'typed', awarded_at: '2026-09-01T15:00:00Z', planned_finish: '2026-10-20', awarded_hours: 240, certified_pct: 35, signed_on: '2026-10-28', signed_by: 'Robert', team_hours: 290, sub_hours: 0, hours_under: -206, scored: true, signed_in_period: true, earned_usd: 3_780, actual_usd: 5_200, kept_usd: -1_420, bonus_usd: 0 },
    { user_id: 'sam', user_name: 'Sam Sample', job_id: 'j4', hcp_number: '1060', job_name: 'Lakeside', status: 'working', awarded_kind: 'bid', awarded_at: '2026-10-09T15:00:00Z', planned_finish: null, awarded_hours: 120, certified_pct: null, signed_on: null, signed_by: null, team_hours: 20, sub_hours: 0, hours_under: null, scored: false, signed_in_period: false, earned_usd: 0, actual_usd: 900, kept_usd: -900, bonus_usd: null },
  ],
}

describe('superintendentScores (punch list #234 PR 4)', () => {
  it('parses the read and folds it to one line per superintendent, the held jobs named with their reason', () => {
    const read = parseScoreRead(raw)
    expect(read.readsWages).toBe(true)
    expect(read.rows).toHaveLength(4)
    expect(read.rows[0]!.jobLabel).toBe('1042 Harbor Lane Offices')
    expect(read.rows[1]!.jobLabel).toBe('#1050 Pruett')
    const lines = superintendentScores(read, '2026-10-31')
    expect(lines.map((l) => l.userName)).toEqual(['Pat Sample', 'Lee Sample', 'Sam Sample'])
    const pat = lines[0]!
    expect(pat.jobs.map((j) => j.jobId)).toEqual(['j1'])
    expect(pat.held.map((h) => h.why)).toEqual(["awarded on the book's hours, a guess; the score waits for a bid or typed baseline"])
    expect(pat.hoursUnder).toBeCloseTo(41.7, 1)
    expect(pat.keptUsd).toBe(2_130)
    expect(pat.bonusUsd).toBe(213)
    const lee = lines[1]!
    expect(lee.hoursUnder).toBe(-206)
    expect(lee.bonusUsd).toBe(0)
    const sam = lines[2]!
    expect(sam.jobs).toEqual([])
    expect(sam.held[0]!.why).toBe('no office sign-off on the percent yet')
    expect(sam.bonusUsd).toBeNull()
  })
  it('without payroll access the dollars are null and the words stay quiet', () => {
    const read = parseScoreRead({ ...raw, reads_wages: false, rows: raw.rows.map((r) => ({ ...r, earned_usd: null, actual_usd: null, kept_usd: null, bonus_usd: r.user_id === 'pat' ? r.bonus_usd : null })) })
    const lines = superintendentScores(read, '2026-10-31')
    expect(lines[0]!.keptUsd).toBeNull()
    expect(lines[0]!.bonusUsd).toBe(213)
    expect(keptWords(lines[0]!.keptUsd)).toBe('')
    expect(bonusWords(lines[0]!.bonusUsd, 10)).toBe('$213 · 10% of the labor kept')
  })
  it('the hold reasons in order', () => {
    const base: ScoreRow = { userId: 'u', userName: 'U', jobId: 'j', jobLabel: 'J', status: 'working', awardedKind: 'bid', awardedAt: null, plannedFinish: null, awardedHours: 100, certifiedPct: 40, signedOn: '2026-10-10', signedBy: 'T', teamHours: 10, subHours: 0, hoursUnder: 30, scored: true, signedInPeriod: true, earnedUsd: null, actualUsd: null, keptUsd: null, bonusUsd: null }
    expect(holdReason(base)).toBeNull()
    expect(holdReason({ ...base, awardedKind: 'book' })).toContain("the book's hours")
    expect(holdReason({ ...base, awardedHours: 0 })).toBe('no hours on the award')
    expect(holdReason({ ...base, certifiedPct: null })).toBe('no office sign-off on the percent yet')
    expect(holdReason({ ...base, signedInPeriod: false, signedOn: '2026-09-02' })).toBe('signed off Sep 2, not in this period')
  })
  it('days against the plan read the finish at this pace against the planned day', () => {
    const r: ScoreRow = { userId: 'u', userName: 'U', jobId: 'j', jobLabel: 'J', status: 'working', awardedKind: 'bid', awardedAt: null, plannedFinish: '2026-11-14', awardedHours: 516, certifiedPct: 50, signedOn: null, signedBy: null, teamHours: 200, subHours: 0, hoursUnder: 58, scored: true, signedInPeriod: true, earnedUsd: null, actualUsd: null, keptUsd: null, bonusUsd: null }
    // 200 h at 50% → 200 h left → 8.3 crew days → 12 calendar days from Oct 31 = Nov 12; the plan is Nov 14: two days ahead.
    expect(daysVsPlanOf(r, '2026-10-31')).toBe(2)
    expect(daysVsPlanOf({ ...r, plannedFinish: null }, '2026-10-31')).toBeNull()
    expect(daysVsPlanOf({ ...r, certifiedPct: 0 }, '2026-10-31')).toBeNull()
    expect(daysWords(3)).toBe('3 days ahead of the plan')
    expect(daysWords(-1)).toBe('1 day behind the plan')
    expect(daysWords(0)).toBe('on the plan')
    expect(daysWords(null)).toBe('')
  })
  it('the words', () => {
    expect(hoursUnderWords(41.7)).toBe('42 h under the baseline')
    expect(hoursUnderWords(-206)).toBe('206 h over the baseline')
    expect(hoursUnderWords(0.2)).toBe('on the baseline')
    expect(keptWords(2_130)).toBe('$2,130 kept')
    expect(keptWords(-1_420)).toBe('−$1,420, nothing owed back')
    expect(bonusWords(0, 10)).toBe('$0 · nothing kept this period')
    expect(bonusWords(null, 10)).toBe('')
    const read = parseScoreRead(raw)
    expect(jobScoreWords(read.rows[0]!)).toBe('1042 Harbor Lane Offices · 48% signed off Oct 30 by Taunya · 206 h of 248 h earned · 42 h under the baseline')
    expect(jobScoreWords(read.rows[3]!)).toBe('1060 Lakeside · no sign-off yet · 20 h of 0 h earned')
  })
  it('the month as the period', () => {
    expect(monthOf('2026-11-07')).toBe('2026-11')
    expect(monthRange('2026-11')).toEqual({ fromYmd: '2026-11-01', toYmd: '2026-11-30' })
    expect(monthRange('2026-12')).toEqual({ fromYmd: '2026-12-01', toYmd: '2026-12-31' })
    expect(monthRange('2026-02')).toEqual({ fromYmd: '2026-02-01', toYmd: '2026-02-28' })
    expect(monthWords('2026-11')).toBe('November 2026')
    expect(monthShift('2026-01', -1)).toBe('2025-12')
    expect(monthShift('2026-12', 1)).toBe('2027-01')
  })
})
