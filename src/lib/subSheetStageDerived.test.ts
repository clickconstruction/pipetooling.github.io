import { describe, expect, it } from 'vitest'
import { effectiveSubSheetStage, subSheetWorkEndYmd } from './subSheetStageDerived'

const TODAY = '2026-09-07'
const base = { stage: 'working', stageSource: null, stageChangedAt: null, progressPct: null, progressAt: null, workEndYmd: null, todayYmd: TODAY }

describe('subSheetWorkEndYmd', () => {
  it('takes the latest picked-else-proposed end among signed orders only', () => {
    expect(subSheetWorkEndYmd([])).toBeNull()
    expect(subSheetWorkEndYmd([{ status: 'offered', picked_end: '2026-09-01' }])).toBeNull()
    expect(subSheetWorkEndYmd([{ status: 'accepted', picked_end: null, proposed_end: '2026-09-03' }])).toBe('2026-09-03')
    expect(subSheetWorkEndYmd([{ status: 'accepted', picked_end: '2026-09-02T00:00:00Z', proposed_end: '2026-09-09' }, { status: 'settled', picked_end: '2026-09-05' }])).toBe('2026-09-05')
    expect(subSheetWorkEndYmd([{ status: 'approved', picked_end: ' ', proposed_end: '' }])).toBeNull()
  })
})

describe('effectiveSubSheetStage', () => {
  it('with no evidence the stored stage stands, source and stamp as stored', () => {
    expect(effectiveSubSheetStage(base)).toEqual({ stage: 'working', source: null, changedAt: null, derived: false, reason: null })
    expect(effectiveSubSheetStage({ ...base, stageSource: 'office', stageChangedAt: '2026-09-01T10:00:00Z' })).toMatchObject({ stage: 'working', source: 'office', changedAt: '2026-09-01T10:00:00Z', derived: false })
    expect(effectiveSubSheetStage({ ...base, stage: 'bogus' })).toMatchObject({ stage: 'working', derived: false })
  })

  it('100% from the portal moves Waiting on work to Waiting on inspection, stamped auto at the report', () => {
    expect(effectiveSubSheetStage({ ...base, progressPct: 100, progressAt: '2026-09-04T15:00:00Z' })).toEqual({ stage: 'walkthrough', source: 'auto', changedAt: '2026-09-04T15:00:00Z', derived: true, reason: 'percent' })
    expect(effectiveSubSheetStage({ ...base, progressPct: 120 })).toMatchObject({ stage: 'walkthrough', reason: 'percent', changedAt: null })
    expect(effectiveSubSheetStage({ ...base, progressPct: 99 })).toMatchObject({ stage: 'working', derived: false })
  })

  it('a signed window whose last day has passed moves it too, stamped at local noon of that day; today or later does not', () => {
    expect(effectiveSubSheetStage({ ...base, workEndYmd: '2026-09-06' })).toEqual({ stage: 'walkthrough', source: 'auto', changedAt: '2026-09-06T12:00:00', derived: true, reason: 'window' })
    expect(effectiveSubSheetStage({ ...base, workEndYmd: '2026-09-07' })).toMatchObject({ stage: 'working', derived: false })
    expect(effectiveSubSheetStage({ ...base, workEndYmd: '2026-09-08' })).toMatchObject({ stage: 'working', derived: false })
  })

  it('the percent wins the reason when both fire', () => {
    expect(effectiveSubSheetStage({ ...base, progressPct: 100, progressAt: '2026-09-04T15:00:00Z', workEndYmd: '2026-09-01' })).toMatchObject({ reason: 'percent' })
  })

  it('never moves backwards and never past walkthrough: walkthrough and customer_pay stay as set', () => {
    expect(effectiveSubSheetStage({ ...base, stage: 'walkthrough', stageSource: 'portal', stageChangedAt: '2026-09-04T15:00:00Z', progressPct: 100 })).toMatchObject({ stage: 'walkthrough', source: 'portal', derived: false })
    expect(effectiveSubSheetStage({ ...base, stage: 'customer_pay', stageSource: 'office', progressPct: 100, workEndYmd: '2026-09-01' })).toMatchObject({ stage: 'customer_pay', source: 'office', derived: false })
  })

  it('a manual nudge — the office or the sub set it back to Waiting on work AFTER the evidence — stands', () => {
    // moved back after the 100% report
    expect(effectiveSubSheetStage({ ...base, stageSource: 'office', stageChangedAt: '2026-09-05T09:00:00Z', progressPct: 100, progressAt: '2026-09-04T15:00:00Z' })).toMatchObject({ stage: 'working', derived: false, source: 'office' })
    // moved back BEFORE the 100% report: the report is newer, so it fires
    expect(effectiveSubSheetStage({ ...base, stageSource: 'office', stageChangedAt: '2026-09-03T09:00:00Z', progressPct: 100, progressAt: '2026-09-04T15:00:00Z' })).toMatchObject({ stage: 'walkthrough', reason: 'percent' })
    // an undated 100% cannot be out-nudged
    expect(effectiveSubSheetStage({ ...base, stageSource: 'portal', stageChangedAt: '2026-09-05T09:00:00Z', progressPct: 100 })).toMatchObject({ stage: 'walkthrough', reason: 'percent' })
    // moved back after the window closed vs. before it closed
    expect(effectiveSubSheetStage({ ...base, stageSource: 'office', stageChangedAt: '2026-09-06T09:00:00Z', workEndYmd: '2026-09-05' })).toMatchObject({ stage: 'working', derived: false })
    expect(effectiveSubSheetStage({ ...base, stageSource: 'office', stageChangedAt: '2026-09-05T09:00:00Z', workEndYmd: '2026-09-05' })).toMatchObject({ stage: 'walkthrough', reason: 'window' })
    // an automation stamp is not a hand move
    expect(effectiveSubSheetStage({ ...base, stageSource: 'auto', stageChangedAt: '2026-09-06T09:00:00Z', workEndYmd: '2026-09-05' })).toMatchObject({ stage: 'walkthrough', reason: 'window' })
  })
})
