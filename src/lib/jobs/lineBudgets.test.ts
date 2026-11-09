import { describe, expect, it } from 'vitest'
import {
  applyLearningLine,
  applyLineSplit,
  applySettingsRate,
  applySettingsSplit,
  applySettingsTarget,
  calcLineBudget,
  DEFAULT_LINE_BUDGET_SETTINGS as S,
  laborHoursTailWords,
  linesSumBesideAwardWords,
  learningLinesFor,
  lineBudgetSettingsChanges,
  lineBudgetSettingsSaveWords,
  lineBudgetSettingsValueLine,
  parseLineBudgetSettings,
  serializeLineBudgetSettings,
  settingsReadoutWords,
  lineBudgetColumnsFor,
  lineBudgetEntryOf,
  lineBudgetFor,
  lineSplitKindOf,
  sumLineBudgets,
} from './lineBudgets'

describe('lineBudgets (v2.6300, punch list #234)', () => {
  it('a line with nothing stored reads the company split for its kind, marked assumed', () => {
    expect(lineSplitKindOf('Rough In')).toBe('rough_in')
    expect(lineSplitKindOf('Trim Set')).toBe('trim_set')
    expect(lineSplitKindOf('Water heater, added')).toBe('any')
    expect(lineBudgetFor(undefined, 'Trim Set', S)).toEqual({ laborPct: 40, materialsPct: 40, source: 'assumed' })
    expect(lineBudgetFor(undefined, 'Water heater', S)).toEqual({ laborPct: 45, materialsPct: 35, source: 'assumed' })
  })

  it('reads the stored columns and refuses a split with no source or no numbers', () => {
    expect(lineBudgetEntryOf({ budget_labor_pct: '52', budget_materials_pct: 35, budget_source: 'tuned', budget_tuned_at: '2026-11-01T00:00:00Z' })).toEqual({ laborPct: 52, materialsPct: 35, source: 'tuned', tunedAt: '2026-11-01T00:00:00Z' })
    expect(lineBudgetEntryOf({ budget_labor_pct: 52, budget_materials_pct: 35, budget_source: null })).toBeUndefined()
    expect(lineBudgetEntryOf({ budget_labor_pct: null, budget_materials_pct: null, budget_source: 'tuned' })).toBeUndefined()
    expect(lineBudgetEntryOf(null)).toBeUndefined()
    // materials never past what labor left, even from a stored row
    expect(lineBudgetEntryOf({ budget_labor_pct: 80, budget_materials_pct: 40, budget_source: 'tuned' })).toMatchObject({ laborPct: 80, materialsPct: 20 })
  })

  it('writes the five columns for an entry and nulls for none', () => {
    expect(lineBudgetColumnsFor({ laborPct: 52, materialsPct: 35, source: 'tuned', tunedAt: 't' }, S)).toEqual({ budget_labor_pct: 52, budget_materials_pct: 35, budget_source: 'tuned', budget_tuned_at: 't', budget_rate_usd: 45 })
    expect(lineBudgetColumnsFor(null, S)).toEqual({ budget_labor_pct: null, budget_materials_pct: null, budget_source: null, budget_tuned_at: null, budget_rate_usd: null })
  })

  it('a split on a price reads as dollars, hours at the rate and the margin that is left', () => {
    const c = calcLineBudget(24000, { laborPct: 45, materialsPct: 35, source: 'assumed' }, S)
    expect(c.laborUsd).toBe(10800)
    expect(c.laborHours).toBe(240)
    expect(c.materialsUsd).toBe(8400)
    expect(c.marginPct).toBe(20)
    expect(c.marginUsd).toBe(4800)
    expect(c.underTarget).toBe(false)
    expect(calcLineBudget(24000, { laborPct: 52, materialsPct: 35, source: 'tuned' }, S)).toMatchObject({ marginPct: 13, underTarget: true })
    expect(calcLineBudget(0, { laborPct: 52, materialsPct: 35, source: 'tuned' }, S)).toMatchObject({ laborUsd: 0, laborHours: 0 })
  })

  it('labor moves and materials gives way; materials never passes what labor left', () => {
    const e = { laborPct: 45, materialsPct: 35, source: 'assumed' as const }
    expect(applyLineSplit(e, 'labor', 70)).toMatchObject({ laborPct: 70, materialsPct: 30 })
    expect(applyLineSplit(e, 'materials', 90)).toMatchObject({ laborPct: 45, materialsPct: 55 })
    expect(applyLineSplit(e, 'labor', 140)).toMatchObject({ laborPct: 100, materialsPct: 0 })
  })

  it("the job's budget is the sum of its lines; earned is each line's budget at that line's own percent", () => {
    const s = sumLineBudgets(
      [
        { priceUsd: 24000, entry: { laborPct: 45, materialsPct: 35, source: 'assumed' }, pctDone: 50 },
        { priceUsd: 16000, entry: { laborPct: 50, materialsPct: 30, source: 'tuned' }, pctDone: null },
      ],
      S,
    )
    expect(s.priceUsd).toBe(40000)
    expect(s.laborUsd).toBe(10800 + 8000)
    expect(s.materialsUsd).toBe(8400 + 4800)
    expect(s.earnedLaborUsd).toBe(5400)
    expect(s.earnedMaterialsUsd).toBe(4200)
    expect(s.bySource).toEqual({ workbench: 0, assumed: 1, tuned: 1 })
  })
})

describe('the company settings on the wire and on the card (v2.6656, punch list #234 PR 1b)', () => {
  it('parses the row, filling what is missing or broken from the constants and holding a split under 100', () => {
    expect(parseLineBudgetSettings(null)).toEqual(S)
    expect(parseLineBudgetSettings('not json')).toEqual(S)
    const p = parseLineBudgetSettings('{"rateUsd":"52.5","targetMarginPct":25,"splits":{"rough_in":[50,60],"any":["48",30]}}')
    expect(p.rateUsd).toBe(52.5)
    expect(p.targetMarginPct).toBe(25)
    expect(p.splits).toEqual({ rough_in: [50, 50], top_out: [45, 35], trim_set: [40, 40], any: [48, 30] })
    expect(parseLineBudgetSettings(serializeLineBudgetSettings(p))).toEqual(p)
    expect(parseLineBudgetSettings('{"rateUsd":-3}').rateUsd).toBe(45)
  })
  it('a drag on the card moves one kind, materials giving way; the rate and the target are held to sense', () => {
    const a = applySettingsSplit(S, 'any', 'labor', 70)
    expect(a.splits.any).toEqual([70, 30])
    expect(a.splits.rough_in).toEqual([45, 35])
    expect(applySettingsSplit(a, 'any', 'materials', 80).splits.any).toEqual([70, 30])
    expect(applySettingsRate(S, 44.704).rateUsd).toBe(44.7)
    expect(applySettingsRate(S, 0).rateUsd).toBe(1)
    expect(applySettingsRate(S, NaN).rateUsd).toBe(45)
    expect(applySettingsTarget(S, 130).targetMarginPct).toBe(100)
  })
  it('Save names what it writes', () => {
    expect(lineBudgetSettingsSaveWords(lineBudgetSettingsChanges(S, S))).toBe('Nothing changed yet')
    const d = applySettingsRate(applySettingsSplit(applySettingsSplit(S, 'any', 'labor', 52), 'trim_set', 'materials', 30), 48)
    const c = lineBudgetSettingsChanges(S, d)
    expect(c).toEqual({ kinds: ['trim_set', 'any'], rate: true, target: false, any: true })
    expect(lineBudgetSettingsSaveWords(c)).toBe('Save · 2 splits and the rate')
    expect(lineBudgetSettingsSaveWords(lineBudgetSettingsChanges(S, applySettingsTarget(S, 22)))).toBe('Save · the target')
    expect(lineBudgetSettingsSaveWords({ kinds: ['any'], rate: true, target: true, any: true })).toBe('Save · 1 split, the rate and the target')
  })
  it('reads a kind out on a line of a size, and the fold header in one line', () => {
    expect(settingsReadoutWords(S, 'rough_in', 4_000)).toBe('$1,800 labor · 40 h · $1,400 materials · $800 margin')
    expect(lineBudgetSettingsValueLine(S)).toBe('45 / 35 rough in · 45 / 35 top out · 40 / 40 trim set · 45 / 35 any line · $45 an hour')
  })
  it('the learning line speaks after five tunes on a kind that sit three points or more off the default, and taking it moves labor only', () => {
    const tuned = [52, 50, 55, 52, 48, 53].map((l) => ({ name: 'Water heater', budget_labor_pct: l }))
    const few = [60, 61, 62, 63].map((l) => ({ name: 'Rough In', budget_labor_pct: l }))
    const onDefault = [45, 46, 44, 45, 47].map((l) => ({ name: 'Top Out', budget_labor_pct: String(l) }))
    const lines = learningLinesFor([...tuned, ...few, ...onDefault], S)
    expect(lines).toEqual([{ kind: 'any', laborPct: 52, defaultPct: 45, n: 6, words: 'Your Any line lines ran 52% labor on the last 6 tunes, against the 45% default.' }])
    expect(applyLearningLine(S, lines[0]!).splits.any).toEqual([52, 35])
    expect(learningLinesFor([], S)).toEqual([])
  })
})

describe("the lines' sum beside the award (the owner's call of 2026-11-09, punch list #234)", () => {
  it('the Labor tail reads the clocked hours against the hours frozen at award, the lines\' sum beside them', () => {
    expect(laborHoursTailWords(12, { hours: 120, kind: 'bid' }, 458)).toBe('12 h of 120 h frozen at award (10%) · the lines sum to 458 h')
    expect(laborHoursTailWords(12, null, 458)).toBe('12 h of 458 h (3%)')
    expect(laborHoursTailWords(0, null, 0)).toBe('0 h of 0 h')
  })
  it('the note names which hours the score reads; a book award is a guess the score skips; none with no award', () => {
    expect(linesSumBesideAwardWords({ hours: 120, kind: 'bid' }, 240)).toBe('The score reads the 120 h frozen at award ◆ from the bid. The lines sum to 240 h: the line-by-line view, shown beside the award and never scored.')
    expect(linesSumBesideAwardWords({ hours: 220, kind: 'typed' }, 240)).toContain('220 h frozen at award ✎ typed')
    expect(linesSumBesideAwardWords({ hours: 241, kind: 'book' }, 563)).toBe('The score skips the 241 h frozen at award ≈ from the book, a guess, until a bid or typed baseline replaces it. The lines sum to 563 h: the line-by-line view, shown beside the award and never scored.')
    expect(linesSumBesideAwardWords(null, 240)).toBe('')
  })
})
