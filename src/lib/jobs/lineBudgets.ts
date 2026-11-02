/**
 * Line budgets (punch list #234 PR 1, v2.6300): every line the customer sees
 * carries what we think it costs us — labor as hours and dollars at a cost rate,
 * materials as dollars, the margin as what is left — with a source:
 *
 *   ◆ workbench  the hours and parts the bid's workbench priced the line from
 *   ≈ assumed    the company's split for the line's kind, until the owner tunes it
 *   ✎ tuned      the owner moved it
 *
 * The split lives on the line item's own row (`jobs_ledger_fixtures.budget_*`,
 * five nullable columns) and rides the fixtures autosave with the price; nothing
 * is stored until the owner tunes a line, so a line with nulls reads the company
 * split for its kind. The company settings are constants here until PR 1b gives
 * them a Settings card. Pure.
 */
import { stageChecklistKindOf } from './stageChecklist'

export type LineBudgetSource = 'workbench' | 'assumed' | 'tuned'
export type LineSplitKind = 'rough_in' | 'top_out' | 'trim_set' | 'any'

export const LINE_BUDGET_GLYPH: Record<LineBudgetSource, string> = { workbench: '◆', assumed: '≈', tuned: '✎' }
export const LINE_SPLIT_KIND_WORDS: Record<LineSplitKind, string> = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set', any: 'Any line' }

export type LineBudgetEntry = {
  laborPct: number
  materialsPct: number
  source: LineBudgetSource
  tunedAt?: string | null
}

export type LineBudgetSettings = {
  /** The burdened cost rate the hours use, $/h. */
  rateUsd: number
  /** The margin the read-out marks; a split under it reads red. */
  targetMarginPct: number
  /** [labor %, materials %] a typed line takes for its kind until the owner tunes it. */
  splits: Record<LineSplitKind, [number, number]>
}

export const DEFAULT_LINE_BUDGET_SETTINGS: LineBudgetSettings = {
  rateUsd: 45,
  targetMarginPct: 20,
  splits: { rough_in: [45, 35], top_out: [45, 35], trim_set: [40, 40], any: [45, 35] },
}

/** The split kind a line's words give it: the Pipeline's own stage words, else Any line. */
export function lineSplitKindOf(name: string | null | undefined): LineSplitKind {
  return stageChecklistKindOf(name) ?? 'any'
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** The entry a line reads: the stored one, else the company's split for its kind, marked assumed. */
export function lineBudgetFor(stored: LineBudgetEntry | undefined, name: string | null | undefined, settings: LineBudgetSettings): LineBudgetEntry {
  if (stored) return stored
  const [l, m] = settings.splits[lineSplitKindOf(name)]
  return { laborPct: l, materialsPct: m, source: 'assumed' }
}

export type LineBudgetCalc = {
  laborUsd: number
  laborHours: number
  materialsUsd: number
  marginUsd: number
  marginPct: number
  underTarget: boolean
}

/** What a split means on a line of this price, at this rate. */
export function calcLineBudget(priceUsd: number, e: LineBudgetEntry, settings: LineBudgetSettings): LineBudgetCalc {
  const price = Math.max(0, priceUsd || 0)
  const laborPct = clamp(e.laborPct)
  const materialsPct = clamp(Math.min(e.materialsPct, 100 - laborPct))
  const marginPct = 100 - laborPct - materialsPct
  const laborUsd = (price * laborPct) / 100
  return {
    laborUsd,
    laborHours: settings.rateUsd > 0 ? laborUsd / settings.rateUsd : 0,
    materialsUsd: (price * materialsPct) / 100,
    marginUsd: (price * marginPct) / 100,
    marginPct,
    underTarget: marginPct < settings.targetMarginPct,
  }
}

/** A drag or a typed number: labor moves and materials gives way; materials never passes what labor left. */
export function applyLineSplit(e: LineBudgetEntry, field: 'labor' | 'materials', value: number): LineBudgetEntry {
  const v = clamp(value)
  if (field === 'labor') return { ...e, laborPct: v, materialsPct: Math.min(e.materialsPct, 100 - v) }
  return { ...e, materialsPct: Math.min(v, 100 - e.laborPct) }
}

export type LineBudgetSums = { priceUsd: number; laborUsd: number; laborHours: number; materialsUsd: number; marginUsd: number; earnedLaborUsd: number; earnedMaterialsUsd: number; bySource: Record<LineBudgetSource, number> }

/** The job's budget is the sum of its lines; earned is each line's budget at that line's percent. */
export function sumLineBudgets(lines: Array<{ priceUsd: number; entry: LineBudgetEntry; pctDone: number | null }>, settings: LineBudgetSettings): LineBudgetSums {
  const s: LineBudgetSums = { priceUsd: 0, laborUsd: 0, laborHours: 0, materialsUsd: 0, marginUsd: 0, earnedLaborUsd: 0, earnedMaterialsUsd: 0, bySource: { workbench: 0, assumed: 0, tuned: 0 } }
  for (const l of lines) {
    const c = calcLineBudget(l.priceUsd, l.entry, settings)
    const pct = Math.max(0, Math.min(100, l.pctDone ?? 0)) / 100
    s.priceUsd += Math.max(0, l.priceUsd || 0)
    s.laborUsd += c.laborUsd
    s.laborHours += c.laborHours
    s.materialsUsd += c.materialsUsd
    s.marginUsd += c.marginUsd
    s.earnedLaborUsd += c.laborUsd * pct
    s.earnedMaterialsUsd += c.materialsUsd * pct
    s.bySource[l.entry.source] += 1
  }
  return s
}

/* ---------- the row's columns ---------- */

/** The five columns as a row carries them: the form's `FixtureRow` and the loaded `jobs_ledger_fixtures` row both fit. */
export type LineBudgetColumns = {
  budget_labor_pct?: number | string | null
  budget_materials_pct?: number | string | null
  budget_source?: string | null
  budget_tuned_at?: string | null
  budget_rate_usd?: number | string | null
}

const isSource = (s: unknown): s is LineBudgetSource => s === 'workbench' || s === 'assumed' || s === 'tuned'

/** The stored entry on a row, or undefined when nothing is stored (nulls, or a split with no source). */
export function lineBudgetEntryOf(row: LineBudgetColumns | null | undefined): LineBudgetEntry | undefined {
  if (!row || !isSource(row.budget_source)) return undefined
  if (row.budget_labor_pct == null || row.budget_materials_pct == null) return undefined
  const l = Number(row.budget_labor_pct)
  const m = Number(row.budget_materials_pct)
  if (!Number.isFinite(l) || !Number.isFinite(m)) return undefined
  return { laborPct: clamp(l), materialsPct: clamp(Math.min(m, 100 - clamp(l))), source: row.budget_source, tunedAt: row.budget_tuned_at ?? null }
}

/** The five columns as the form writes them: numbers and the source narrowed. */
export type LineBudgetWrite = { budget_labor_pct: number | null; budget_materials_pct: number | null; budget_source: LineBudgetSource | null; budget_tuned_at: string | null; budget_rate_usd: number | null }

/** The columns a row takes for an entry (null = back to nothing stored, the company split). */
export function lineBudgetColumnsFor(entry: LineBudgetEntry | null, settings: LineBudgetSettings): LineBudgetWrite {
  if (!entry) return { budget_labor_pct: null, budget_materials_pct: null, budget_source: null, budget_tuned_at: null, budget_rate_usd: null }
  return {
    budget_labor_pct: clamp(entry.laborPct),
    budget_materials_pct: clamp(Math.min(entry.materialsPct, 100 - clamp(entry.laborPct))),
    budget_source: entry.source,
    budget_tuned_at: entry.tunedAt ?? null,
    budget_rate_usd: settings.rateUsd,
  }
}
