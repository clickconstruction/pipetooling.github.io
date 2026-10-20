import { describe, expect, it } from 'vitest'
import { jobPercentFromStages, stageEffectivePct, stagePickerNumber, stageProgressRowsFromRpc, type StageProgressRow } from './stageProgressReport'

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

describe('numbering', () => {
  it('numbers Order rows 1..N and marks Any rows with a diamond', () => {
    expect(heron.map((s) => stagePickerNumber(heron, s))).toEqual(['1', '2', '3', '4'])
    const any: StageProgressRow = { fixtureId: 'co', name: 'CO', kind: 'any', sequenceOrder: 9, weightPct: 10, progressPct: null, drawPaid: false }
    expect(stagePickerNumber([...heron, any], any)).toBe('◆')
  })
})

describe('stageProgressRowsFromRpc recognition (v2.3417)', () => {
  it('numbers Rough In · Top Out · Trim Set as Order rows when the office never set the kind', () => {
    const rows = stageProgressRowsFromRpc([
      { fixture_id: 'r', name: 'Rough In', stage_kind: 'any', sequence_order: 0, weight_pct: 40, progress_pct: null, draw_paid: false },
      { fixture_id: 't', name: 'Top Out', stage_kind: 'any', sequence_order: 1, weight_pct: 40, progress_pct: null, draw_paid: false },
      { fixture_id: 's', name: 'Trim Set', stage_kind: 'any', sequence_order: 2, weight_pct: 20, progress_pct: null, draw_paid: false },
      { fixture_id: 'c', name: 'Change order: hose bib', stage_kind: 'any', sequence_order: 3, weight_pct: 5, progress_pct: null, draw_paid: false },
    ])
    expect(rows.map((r) => r.kind)).toEqual(['order', 'order', 'order', 'any'])
    expect(rows.map((r) => stagePickerNumber(rows, r))).toEqual(['1', '2', '3', '◆'])
  })
  it('leaves a service job alone', () => {
    const rows = stageProgressRowsFromRpc([
      { fixture_id: 'a', name: 'Diagnostic', stage_kind: 'any', sequence_order: 0, weight_pct: 30, progress_pct: null, draw_paid: false },
      { fixture_id: 'b', name: 'Parts and labor', stage_kind: 'any', sequence_order: 1, weight_pct: 70, progress_pct: null, draw_paid: false },
    ])
    expect(rows.map((r) => r.kind)).toEqual(['any', 'any'])
  })
})
