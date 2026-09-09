import { describe, expect, it } from 'vitest'
import {
  defaultStageToReport,
  jobPercentFromStages,
  stageEffectivePct,
  stageModeAvailable,
  stagePickerNumber,
  stageProgressFieldValue,
  stageProgressRowsFromRpc,
  stageReportSummary,
  type StageProgressRow,
} from './stageProgressReport'

/** Heron: Underground 25 (paid) · Rough-in 35 (60%) · Top-out 15 · Trim 25. */
const heron: StageProgressRow[] = [
  { fixtureId: 'u', name: 'Underground', kind: 'order', sequenceOrder: 1, weightPct: 25, progressPct: 100, drawPaid: true },
  { fixtureId: 'r', name: 'Rough-in', kind: 'order', sequenceOrder: 2, weightPct: 35, progressPct: 60, drawPaid: false },
  { fixtureId: 't', name: 'Top-out', kind: 'order', sequenceOrder: 3, weightPct: 15, progressPct: null, drawPaid: false },
  { fixtureId: 'm', name: 'Trim', kind: 'order', sequenceOrder: 4, weightPct: 25, progressPct: null, drawPaid: false },
]

describe('stageProgressRowsFromRpc', () => {
  it('keeps priced Order / Any rows, drops unpriced and plain ones, clamps progress', () => {
    const rows = stageProgressRowsFromRpc([
      { fixture_id: 'a', name: 'Rough-in', stage_kind: 'order', sequence_order: 2, weight_pct: '35.00', progress_pct: 60, draw_paid: false },
      { fixture_id: 'b', name: ' Change order ', stage_kind: 'any', sequence_order: 9, weight_pct: 10, progress_pct: 140, draw_paid: null },
      { fixture_id: 'c', name: 'Permit', stage_kind: null, sequence_order: 1, weight_pct: 5, progress_pct: null, draw_paid: false },
      { fixture_id: 'd', name: 'Zero', stage_kind: 'order', sequence_order: 3, weight_pct: 0, progress_pct: null, draw_paid: false },
    ])
    expect(rows.map((r) => r.fixtureId)).toEqual(['a', 'b'])
    expect(rows[0]).toMatchObject({ weightPct: 35, progressPct: 60 })
    expect(rows[1]).toMatchObject({ name: 'Change order', progressPct: 100, drawPaid: false })
  })
})

describe('jobPercentFromStages', () => {
  it('Σ weight × percent: 25 + 35 × 0.6 = 46', () => {
    expect(jobPercentFromStages(heron)).toBe(46)
  })
  it('an override previews a stage move — Rough-in to 100 makes the job 60', () => {
    expect(jobPercentFromStages(heron, { fixtureId: 'r', pct: 100 })).toBe(60)
    expect(jobPercentFromStages(heron, { fixtureId: 't', pct: 50 })).toBe(54) // 46 + 15 × 0.5, rounded
  })
  it('a paid draw counts as 100 even if nobody reported it', () => {
    expect(stageEffectivePct({ progressPct: 20, drawPaid: true })).toBe(100)
    expect(stageEffectivePct({ progressPct: null, drawPaid: false })).toBe(0)
  })
  it('a single stage worth 100 % behaves exactly like the old slider', () => {
    const one: StageProgressRow[] = [{ fixtureId: 'x', name: 'as per plans', kind: 'any', sequenceOrder: 1, weightPct: 100, progressPct: 40, drawPaid: false }]
    expect(jobPercentFromStages(one)).toBe(40)
    expect(jobPercentFromStages(one, { fixtureId: 'x', pct: 75 })).toBe(75)
  })
})

describe('defaultStageToReport + numbering', () => {
  it('opens on the first Order stage not done, then Any, then the last', () => {
    expect(defaultStageToReport(heron)?.fixtureId).toBe('r')
    const allDone = heron.map((s) => ({ ...s, progressPct: 100 }))
    expect(defaultStageToReport(allDone)?.fixtureId).toBe('m')
    const withAny: StageProgressRow[] = [
      { ...heron[0]!, drawPaid: true },
      { fixtureId: 'co', name: 'Change order', kind: 'any', sequenceOrder: 9, weightPct: 75, progressPct: 10, drawPaid: false },
    ]
    expect(defaultStageToReport(withAny)?.fixtureId).toBe('co')
    expect(defaultStageToReport([])).toBeNull()
  })
  it('numbers Order rows 1..N and marks Any rows with a diamond', () => {
    expect(heron.map((s) => stagePickerNumber(heron, s))).toEqual(['1', '2', '3', '4'])
    const any: StageProgressRow = { fixtureId: 'co', name: 'CO', kind: 'any', sequenceOrder: 9, weightPct: 10, progressPct: null, drawPaid: false }
    expect(stagePickerNumber([...heron, any], any)).toBe('◆')
  })
})

describe('stageReportSummary + the report field', () => {
  it('writes the arithmetic out', () => {
    const s = stageReportSummary(heron, 'r', 60)
    expect(s).toMatchObject({ before: 46, after: 46, contributionPts: 21 })
    expect(s.line).toBe('Rough-in 60% × 35% of the job = 21 pts · job 46% → 46%')
    expect(stageReportSummary(heron, 'r', 100).line).toBe('Rough-in 100% × 35% of the job = 35 pts · job 46% → 60%')
    expect(stageProgressFieldValue(heron, 'r', 100)).toBe('Rough-in: 100% (35% of the job) → job 60%')
    expect(stageProgressFieldValue(heron, 'nope', 50)).toBe('')
  })
})

describe('stageModeAvailable', () => {
  it('needs at least one Order row — legacy any-only jobs keep the plain slider', () => {
    expect(stageModeAvailable(heron)).toBe(true)
    const legacy: StageProgressRow[] = [
      { fixtureId: 'a', name: 'Water heater', kind: 'any', sequenceOrder: 1, weightPct: 70, progressPct: null, drawPaid: false },
      { fixtureId: 'b', name: 'Expansion tank', kind: 'any', sequenceOrder: 2, weightPct: 30, progressPct: null, drawPaid: false },
    ]
    expect(stageModeAvailable(legacy)).toBe(false)
    expect(stageModeAvailable([])).toBe(false)
  })
})
