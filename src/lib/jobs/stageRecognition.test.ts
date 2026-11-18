import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyRecognizedStages, recognizeStages, stageGroupOfRank, stageRank } from './stageRecognition'
import { STAGE_NAME_TABLE, stageKindOfRank, stageNameScenarioLine } from './stageNameTable'

const row = (id: string, name: string, price: number | null = 1000, over: Partial<{ stage_kind: string | null; sequence_order: number; count: number | null }> = {}) => ({
  id,
  name,
  count: 1,
  line_unit_price: price,
  sequence_order: Number(id.replace(/\D/g, '')) || 0,
  stage_kind: 'any' as string | null,
  ...over,
})

describe('stageRank', () => {
  it('reads the plumbing vocabulary in order', () => {
    expect(stageRank('Underground')).toBe(0)
    expect(stageRank('Pre-pour')).toBe(0)
    expect(stageRank('Rough In')).toBe(1)
    expect(stageRank('Rough-in plumbing, 2nd floor')).toBe(1)
    expect(stageRank('Top Out')).toBe(2)
    expect(stageRank('Top-out, sewer line, water line')).toBe(2)
    expect(stageRank('Trim Set')).toBe(3)
    expect(stageRank('Finish')).toBe(3)
    expect(stageRank('Final')).toBe(4)
    expect(stageRank('Stage 2 — Top Out')).toBe(2)
  })
  it('is null for everything else — systems, fees, change orders, the migrated total', () => {
    for (const n of ['Job total (migrated)', 'Per plans', 'Pinpoint', 'Material', 'Gas line', 'Sewer & water', 'CHANGE ORDER: chip and move manifold', 'Permit & misc', 'Custom Service Visit', '', null])
      expect(stageRank(n)).toBeNull()
  })
})

describe('recognizeStages', () => {
  // J931 Hadlow Construction, 2026-09-14: the generator's preset, every row kind `any`.
  const hadlow = [row('1', 'Rough In', 19_480), row('2', 'Top Out', 19_480), row('3', 'Trim Set', 9_740)]

  it('reads Rough In · Top Out · Trim Set as three Order stages', () => {
    expect(recognizeStages(hadlow)).toEqual({ recognized: true, orderIds: ['1', '2', '3'], reason: null })
    const applied = applyRecognizedStages(hadlow)
    expect(applied.recognized).toBe(true)
    expect(applied.fixtures.map((f) => f.stage_kind)).toEqual(['order', 'order', 'order'])
  })

  it('leaves unranked rows as Any inside a recognized plan (a change order beside the stages)', () => {
    const r = recognizeStages([...hadlow, row('4', 'CHANGE ORDER: add hose bib', 850)])
    expect(r.recognized).toBe(true)
    expect(r.orderIds).toEqual(['1', '2', '3'])
  })

  it('a service job with no stage words is not a plan (Diagnostic · Parts · Labor stays one bar)', () => {
    expect(recognizeStages([row('1', 'Diagnostic'), row('2', 'Parts'), row('3', 'Labor')])).toMatchObject({ recognized: false, reason: 'too-few' })
    expect(recognizeStages([row('1', 'Custom Service Visit', null), row('2', 'Beginning of Job', 1_879), row('3', 'Final', 1_879)])).toMatchObject({ recognized: false, reason: 'too-few' })
  })

  it('one stage word alone is not a plan; two are', () => {
    expect(recognizeStages([row('1', 'Top out, sewer line, water line', 13_360), row('2', 'Materials', 3_340)])).toMatchObject({ recognized: false, reason: 'too-few' })
    expect(recognizeStages([row('1', 'Top out, sewer line, water line', 13_360), row('2', 'Final', 3_340)])).toMatchObject({ recognized: true, orderIds: ['1', '2'] })
  })

  it('stages out of order are not a plan', () => {
    expect(recognizeStages([row('1', 'Trim Set'), row('2', 'Rough In'), row('3', 'Top Out')])).toMatchObject({ recognized: false, reason: 'out-of-order' })
  })

  it('a repeated rank is fine (two Rough In rows, one per floor)', () => {
    expect(recognizeStages([row('1', 'Rough In 1st floor'), row('2', 'Rough In 2nd floor'), row('3', 'Top Out')]).orderIds).toEqual(['1', '2', '3'])
  })

  it('an explicit Order row switches recognition off — the office declared the plan', () => {
    const r = recognizeStages([row('1', 'Rough In', 1000, { stage_kind: 'order' }), row('2', 'Top Out'), row('3', 'Trim Set')])
    expect(r).toEqual({ recognized: false, orderIds: [], reason: 'explicit' })
    expect(applyRecognizedStages(hadlow.map((f, i) => (i === 0 ? { ...f, stage_kind: 'order' } : f))).recognized).toBe(false)
  })

  it('a deliberate plain row (kind null) and an unpriced row are never recognized', () => {
    expect(recognizeStages([row('1', 'Rough In', 1000, { stage_kind: null }), row('2', 'Top Out'), row('3', 'Trim Set')]).orderIds).toEqual(['2', '3'])
    expect(recognizeStages([row('1', 'Rough In', 0), row('2', 'Top Out'), row('3', 'Trim Set', null)])).toMatchObject({ recognized: false, reason: 'too-few' })
  })

  it('applyRecognizedStages returns the same array when nothing changes', () => {
    const rows = [row('1', 'Diagnostic'), row('2', 'Parts')]
    expect(applyRecognizedStages(rows).fixtures).toBe(rows)
  })
})

describe('the one rule for a stage’s name (punch list #397, PR 6)', () => {
  it('reads every name in the table as the table says', () => {
    for (const [name, rank] of STAGE_NAME_TABLE) expect([name, stageRank(name)]).toEqual([name, rank])
  })

  it('lets a second stage’s word take the stage away, and words of the same bid stage sit together', () => {
    expect(stageRank('Rough in, top out and trim')).toBeNull()
    expect(stageRank('Top out and rough in')).toBeNull()
    expect(stageRank('Trim, then final walk')).toBe(3)
    expect(stageRank('Underground and rough in')).toBe(0)
  })

  it('reads "Set trim" as the trim stage, and only at the start of the name', () => {
    expect(stageRank('Set trim')).toBe(3)
    expect(stageRank('SET  TRIM, master bath')).toBe(3)
    expect(stageRank('Reset trim plate')).toBeNull()
    expect(stageRank('Settle up')).toBeNull()
  })

  it('groups a rank into the bid’s three stages', () => {
    expect(([0, 1, 2, 3, 4] as const).map(stageGroupOfRank)).toEqual(['rough', 'rough', 'top', 'trim', 'trim'])
    expect(([0, 1, 2, 3, 4, null] as const).map(stageKindOfRank)).toEqual([null, 'rough_in', 'top_out', 'trim_set', null, null])
  })

  it('holds the database’s copy to the same table: every row has its line in the SQL scenario', () => {
    const scenario = readFileSync('supabase/tests/stage_kind/20_scenario.sql', 'utf8')
    const missing = STAGE_NAME_TABLE.map(([name, rank]) => stageNameScenarioLine(name, rank)).filter((line) => !scenario.includes(line))
    expect(missing).toEqual([])
    // And the scenario asserts no name the table does not hold, bar the two it adds for whitespace and no name.
    const asserted = scenario.split('\n').filter((l) => l.startsWith('SELECT sk.same(')).length
    expect(asserted).toBe(STAGE_NAME_TABLE.length + 2)
  })
})
