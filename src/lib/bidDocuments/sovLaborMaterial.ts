/**
 * Schedule of values, split into labor and material (v2.4075) — the By stage shape.
 *
 * Each stage's contract value (from `scheduleOfValuesLetter`) divides between labor
 * and material in the ratio of that stage's two costs:
 *   labor cost    = the Labor tab's hours for the stage × the labor rate,
 *                   + the subcontractor rows' dollars for the stage (a sub's work is
 *                   labor to the GC — owner's pick, 2026-09-28);
 *   material cost = the takeoff's material for the stage × the factor (what the
 *                   Materials by stage section already prints — owner's pick).
 * A stage with no cost on either side takes the company labor share from Settings
 * and says so (`source: 'rule'`). A labor figure the estimator typed wins
 * (`source: 'typed'`); material is always what is left of the value, so a line
 * always adds up. Pure; the loaders live in `../bids/sovLaborMaterialIo.ts`.
 */
import { formatCurrency } from '../format'
import { STAGE_KEYS, STAGE_LABELS, type StageMoney } from '../bids/materialsByStage'
import type { TakeoffStage } from '../bids/bidTakeoffHelpers'
import type { ScheduleOfValuesLetter } from './scheduleOfValues'

export const DEFAULT_SOV_LABOR_SHARE_PCT = 45

/** The company labor share from app_settings: a number 0–100, else the default. */
export function parseSovLaborSharePct(value: number | string | null | undefined, fallback = DEFAULT_SOV_LABOR_SHARE_PCT): number {
  if (value == null || value === '') return fallback
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback
  return n
}

export type SovLaborCostInput = {
  /** Field hours per stage, summed over the Labor tab's rows (`laborRowRough` / `Top` / `Trim`). */
  hoursByStage: StageMoney
  /** The cost estimate's labor rate ($/h); 0 or null when unset. */
  laborRate: number | null | undefined
  /** Subcontractor rows' dollars per stage, summed. */
  subByStage: StageMoney
}

/** Labor dollars per stage: hours × rate + the subs' dollars. */
export function laborCostByStage(input: SovLaborCostInput): StageMoney {
  const rate = Number(input.laborRate) || 0
  const out: StageMoney = { rough_in: 0, top_out: 0, trim_set: 0 }
  for (const k of STAGE_KEYS) out[k] = (Number(input.hoursByStage[k]) || 0) * rate + (Number(input.subByStage[k]) || 0)
  return out
}

export type SovStageOverride = { labor?: number | null; note?: string | null }
export type SovStageSplitSource = 'costs' | 'rule' | 'typed'

export type SovStageSplit = {
  stage: TakeoffStage
  label: string
  value: number
  labor: number
  material: number
  source: SovStageSplitSource
  /** What the bid's costs say, before any typed figure — the "reset" target. */
  derivedLabor: number
  note: string
}

export type SovSplitInput = {
  costs: { labor: StageMoney; material: StageMoney }
  /** 0–100; the labor share of a stage with no cost on either side. */
  ruleLaborPct: number
  overrides?: ReadonlyMap<TakeoffStage, SovStageOverride> | Partial<Record<TakeoffStage, SovStageOverride>> | null
}

function overrideFor(overrides: SovSplitInput['overrides'], stage: TakeoffStage): SovStageOverride | undefined {
  if (!overrides) return undefined
  if (overrides instanceof Map) return overrides.get(stage)
  return (overrides as Partial<Record<TakeoffStage, SovStageOverride>>)[stage]
}

const cents = (n: number) => Math.round(n * 100)

/**
 * One split per letter row. Labor is whole cents; material is the value less labor,
 * so each stage adds up to the cent whatever the source.
 */
export function splitStageValues(letter: Pick<ScheduleOfValuesLetter, 'rows'>, input: SovSplitInput): SovStageSplit[] {
  return letter.rows.map((r) => {
    const valueCents = cents(r.amount)
    const L = Math.max(0, Number(input.costs.labor[r.stage]) || 0)
    const M = Math.max(0, Number(input.costs.material[r.stage]) || 0)
    let derived: number
    let source: SovStageSplitSource
    if (L + M > 0) {
      derived = Math.round((valueCents * L) / (L + M))
      source = 'costs'
    } else {
      derived = Math.round((valueCents * input.ruleLaborPct) / 100)
      source = 'rule'
    }
    const ov = overrideFor(input.overrides, r.stage)
    let laborCents = derived
    if (ov && ov.labor != null && Number.isFinite(Number(ov.labor))) {
      laborCents = Math.min(valueCents, Math.max(0, cents(Number(ov.labor))))
      source = 'typed'
    }
    return {
      stage: r.stage,
      label: STAGE_LABELS[r.stage],
      value: valueCents / 100,
      labor: laborCents / 100,
      material: (valueCents - laborCents) / 100,
      source,
      derivedLabor: derived / 100,
      note: (ov?.note ?? '').trim(),
    }
  })
}

export function sovSplitTotals(split: ReadonlyArray<Pick<SovStageSplit, 'labor' | 'material'>>): { labor: number; material: number } {
  let l = 0
  let m = 0
  for (const s of split) {
    l += cents(s.labor)
    m += cents(s.material)
  }
  return { labor: l / 100, material: m / 100 }
}

const money = (n: number) => `$${formatCurrency(n)}`

/** `Rough In — $35,596.80 (labor $12,143.83 · material $23,452.97)`. */
export function sovSplitLineText(s: Pick<SovStageSplit, 'label' | 'value' | 'labor' | 'material'>): string {
  return `${s.label} — ${money(s.value)} (labor ${money(s.labor)} · material ${money(s.material)})`
}

/** The indent the letter uses for a line under a heading (the inclusions' five spaces). */
export const SOV_NOTE_INDENT = '     '
