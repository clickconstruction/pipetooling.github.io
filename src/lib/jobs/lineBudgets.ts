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

export const LINE_SPLIT_KINDS: readonly LineSplitKind[] = ['rough_in', 'top_out', 'trim_set', 'any']

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

/* ---------- the company's settings (punch list #234 PR 1b) ---------- */

const pctOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? clamp(n) : null
}

/**
 * `app_settings.line_budget_settings_v1` → the settings: a missing or broken field reads the
 * constant for it, a split is held to labor + materials ≤ 100, the rate to a positive number.
 */
export function parseLineBudgetSettings(valueText: string | null | undefined): LineBudgetSettings {
  const d = DEFAULT_LINE_BUDGET_SETTINGS
  let raw: unknown = null
  try {
    raw = valueText ? JSON.parse(valueText) : null
  } catch {
    raw = null
  }
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const rate = Number(o.rateUsd)
  const target = pctOrNull(o.targetMarginPct)
  const splitsRaw = o.splits && typeof o.splits === 'object' ? (o.splits as Record<string, unknown>) : {}
  const splits = {} as Record<LineSplitKind, [number, number]>
  for (const k of LINE_SPLIT_KINDS) {
    const pair = splitsRaw[k]
    const l = Array.isArray(pair) ? pctOrNull(pair[0]) : null
    const m = Array.isArray(pair) ? pctOrNull(pair[1]) : null
    splits[k] = l == null || m == null ? [...d.splits[k]] : [l, Math.min(m, 100 - l)]
  }
  return { rateUsd: Number.isFinite(rate) && rate > 0 ? Math.round(rate * 100) / 100 : d.rateUsd, targetMarginPct: target ?? d.targetMarginPct, splits }
}

export function serializeLineBudgetSettings(s: LineBudgetSettings): string {
  return JSON.stringify({ rateUsd: s.rateUsd, targetMarginPct: s.targetMarginPct, splits: Object.fromEntries(LINE_SPLIT_KINDS.map((k) => [k, s.splits[k]])) })
}

/** A drag on the card: one kind's labor or materials moves, materials giving way as on a line. */
export function applySettingsSplit(s: LineBudgetSettings, kind: LineSplitKind, field: 'labor' | 'materials', value: number): LineBudgetSettings {
  const [l, m] = s.splits[kind]
  const next = applyLineSplit({ laborPct: l, materialsPct: m, source: 'assumed' }, field, value)
  return { ...s, splits: { ...s.splits, [kind]: [next.laborPct, next.materialsPct] } }
}

export function applySettingsRate(s: LineBudgetSettings, rateUsd: number): LineBudgetSettings {
  const r = Number.isFinite(rateUsd) ? Math.max(1, Math.min(500, Math.round(rateUsd * 100) / 100)) : s.rateUsd
  return { ...s, rateUsd: r }
}

export function applySettingsTarget(s: LineBudgetSettings, targetMarginPct: number): LineBudgetSettings {
  return { ...s, targetMarginPct: clamp(targetMarginPct) }
}

export type LineBudgetSettingsChanges = { kinds: LineSplitKind[]; rate: boolean; target: boolean; any: boolean }

/** What a Save would write against what was saved. */
export function lineBudgetSettingsChanges(saved: LineBudgetSettings, draft: LineBudgetSettings): LineBudgetSettingsChanges {
  const kinds = LINE_SPLIT_KINDS.filter((k) => saved.splits[k][0] !== draft.splits[k][0] || saved.splits[k][1] !== draft.splits[k][1])
  const rate = saved.rateUsd !== draft.rateUsd
  const target = saved.targetMarginPct !== draft.targetMarginPct
  return { kinds, rate, target, any: kinds.length > 0 || rate || target }
}

/** The Save press names what it writes: "Save · 2 splits and the rate"; "Nothing changed yet" when nothing did. */
export function lineBudgetSettingsSaveWords(c: LineBudgetSettingsChanges): string {
  if (!c.any) return 'Nothing changed yet'
  const parts: string[] = []
  if (c.kinds.length) parts.push(`${c.kinds.length} split${c.kinds.length === 1 ? '' : 's'}`)
  if (c.rate) parts.push('the rate')
  if (c.target) parts.push('the target')
  return `Save · ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]}`
}

const usd0 = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

/** A kind's row read out on a line of a chosen size: "$1,800 labor · 40 h · $1,400 materials · $800 margin". */
export function settingsReadoutWords(s: LineBudgetSettings, kind: LineSplitKind, lineUsd: number): string {
  const [l, m] = s.splits[kind]
  const c = calcLineBudget(lineUsd, { laborPct: l, materialsPct: m, source: 'assumed' }, s)
  return `${usd0(c.laborUsd)} labor · ${Math.round(c.laborHours)} h · ${usd0(c.materialsUsd)} materials · ${usd0(c.marginUsd)} margin`
}

/** The fold header's line: "45 / 35 rough in · 45 / 35 top out · 40 / 40 trim set · 45 / 35 any line · $45 an hour". */
export function lineBudgetSettingsValueLine(s: LineBudgetSettings): string {
  const words: Record<LineSplitKind, string> = { rough_in: 'rough in', top_out: 'top out', trim_set: 'trim set', any: 'any line' }
  return `${LINE_SPLIT_KINDS.map((k) => `${s.splits[k][0]} / ${s.splits[k][1]} ${words[k]}`).join(' · ')} · $${s.rateUsd} an hour`
}

/* ---------- the learning line ---------- */

/** The owner's tunes on one kind have to be this many before the line speaks, and this far from the default. */
export const LEARNING_LINE_MIN_TUNES = 5
export const LEARNING_LINE_MIN_GAP_PTS = 3

export type LearningLine = { kind: LineSplitKind; laborPct: number; defaultPct: number; n: number; words: string }

/** A tuned line as the read hands it: its name (the kind) and its labor percent. */
export type TunedLineSource = { name: string | null; budget_labor_pct: number | string | null }

/**
 * After a handful of tunes on one kind, the median labor percent against the kind's default, once per
 * kind: "Your Any lines ran 52% labor on the last 6 tunes, against the 45% default." Null while there
 * are too few or they sit on the default. Offers; never moves anything.
 */
export function learningLinesFor(tuned: readonly TunedLineSource[], s: LineBudgetSettings): LearningLine[] {
  const byKind = new Map<LineSplitKind, number[]>()
  for (const t of tuned) {
    const l = pctOrNull(t.budget_labor_pct)
    if (l == null) continue
    const k = lineSplitKindOf(t.name)
    ;(byKind.get(k) ?? byKind.set(k, []).get(k)!).push(l)
  }
  const out: LearningLine[] = []
  for (const k of LINE_SPLIT_KINDS) {
    const xs = (byKind.get(k) ?? []).sort((a, b) => a - b)
    if (xs.length < LEARNING_LINE_MIN_TUNES) continue
    const mid = Math.floor(xs.length / 2)
    const median = Math.round(xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2)
    const def = s.splits[k][0]
    if (Math.abs(median - def) < LEARNING_LINE_MIN_GAP_PTS) continue
    out.push({ kind: k, laborPct: median, defaultPct: def, n: xs.length, words: `Your ${LINE_SPLIT_KIND_WORDS[k]} lines ran ${median}% labor on the last ${xs.length} tunes, against the ${def}% default.` })
  }
  return out
}

/** Take the learning line: the kind's labor moves to the median, materials giving way. */
export function applyLearningLine(s: LineBudgetSettings, line: LearningLine): LineBudgetSettings {
  return applySettingsSplit(s, line.kind, 'labor', line.laborPct)
}
