import { describe, expect, it } from 'vitest'
import {
  applyLineSplit,
  calcLineBudget,
  DEFAULT_LINE_BUDGET_SETTINGS as S,
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
