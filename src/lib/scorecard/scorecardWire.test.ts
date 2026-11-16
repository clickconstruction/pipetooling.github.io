import { describe, expect, it } from 'vitest'
import { buildEstimatorScore } from './estimatorScore'
import { buildFieldScore } from './fieldScore'
import { buildHurdle, DEFAULT_HURDLE_SETTING } from './hurdle'
import type { ScorecardRead } from './scorecardReads'
import { mayReadTeamScores, scorecardFromWire, scorecardToWire, teamScoresWindowDays } from './scorecardWire'

const hurdle = buildHurdle({ overheadUsd: 22_000, paidFieldHours: 1_000, windowDays: 56, setting: DEFAULT_HURDLE_SETTING })
const read: ScorecardRead = {
  fromYmd: '2026-09-21',
  toYmd: '2026-11-15',
  todayYmd: '2026-11-15',
  windowDays: 56,
  burden: 1.2,
  setting: DEFAULT_HURDLE_SETTING,
  hurdle,
  field: buildFieldScore({ jobs: [{ jobId: 'j1', label: '1042 Riverside', status: 'working', paidHours: 100, laborUsdRaw: 3_000, earnedUsd: 12_000, materialsUsd: 2_000, subUsd: 0, totalBillUsd: 40_000 }], burden: 1.2, hurdle }),
  ownersByJob: new Map([['j1', [{ id: 'u1', name: 'Sam Super' }]]]),
  estimator: buildEstimatorScore({ bids: [], hurdle, fromYmd: '2026-09-21', toYmd: '2026-11-15', todayYmd: '2026-11-15' }),
  pendingFieldHours: 12,
  actualsUnread: 0,
}

describe('the team scores on the wire', () => {
  it('survives JSON and comes back the same read, the owners a map again', () => {
    const back = scorecardFromWire(JSON.parse(JSON.stringify(scorecardToWire(read))))
    expect(back).toEqual(read)
    expect(back?.ownersByJob.get('j1')).toEqual([{ id: 'u1', name: 'Sam Super' }])
  })
  it('refuses what is not a scorecard', () => {
    expect(scorecardFromWire(null)).toBeNull()
    expect(scorecardFromWire('<html>')).toBeNull()
    expect(scorecardFromWire({ ok: true })).toBeNull()
    expect(scorecardFromWire({ ...scorecardToWire(read), field: null })).toBeNull()
  })
  it('reads a wire with no owners as no owners', () => {
    const w = { ...scorecardToWire(read), ownersByJob: 'junk' }
    expect(scorecardFromWire(w)?.ownersByJob.size).toBe(0)
  })
})

describe('the function’s two rules', () => {
  it('takes the tab’s windows and no other', () => {
    expect([28, 56, 90, '56'].map(teamScoresWindowDays)).toEqual([28, 56, 90, 56])
    expect([0, 7, 365, 1825, null, 'all'].map(teamScoresWindowDays)).toEqual([null, null, null, null, null, null])
  })
  it('answers the scoreboard’s gate: a dev, the owner, or payroll access', () => {
    const roles = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', null]
    expect(roles.filter((role) => mayReadTeamScores({ role, payrollAccess: false }))).toEqual(['dev', 'master_technician'])
    expect(mayReadTeamScores({ role: 'controller', payrollAccess: true })).toBe(true)
  })
})
