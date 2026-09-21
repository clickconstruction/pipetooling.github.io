/**
 * Materials by stage (Wendi's schedule of values) — the pure part.
 *
 * Every fixture or tie-in on the Combined takeoff sheet carries a stage split:
 * Rough In (1), Top Out (2), Trim Set (3), or a weighted combination. Any part
 * line under it can carry its own split, and any part inside an assembly
 * bundle line can carry its own. Missing = inherit from the scope above:
 *
 *   part inside a bundle  →  the bundle line  →  the fixture  →  unassigned
 *
 * The bid's material dollars (the same per-line arithmetic the cost rail
 * uses, plus each fixture's share of the order rounding) are summed per stage,
 * then multiplied by the company factor (1.5 unless changed). A bundle whose
 * parts disagree splits its price by the parts' catalog value; a part with no
 * catalog price counts as an average priced part so it never carries $0.
 *
 * No React, no Supabase. Persistence: `bid_takeoff_stage_splits`
 * (`materialsByStageIo.ts`).
 */
import { STAGE_LABELS, roughCountMultiplier, type TakeoffStage } from './bidTakeoffHelpers'

export const STAGE_KEYS: readonly TakeoffStage[] = ['rough_in', 'top_out', 'trim_set']
export const STAGE_NUMBER: Record<TakeoffStage, 1 | 2 | 3> = { rough_in: 1, top_out: 2, trim_set: 3 }
export { STAGE_LABELS }
/** Stage colors are status colors, deliberately literal (light and dark alike): earth, water, finish. */
export const STAGE_COLORS: Record<TakeoffStage, string> = { rough_in: '#b0561c', top_out: '#2563eb', trim_set: '#15803d' }

export type StageWeights = Record<TakeoffStage, number>
export type StageMoney = Record<TakeoffStage, number>
export type StageSplitScope = 'fixture' | 'line' | 'part'
export type StageSplitSource = 'hand' | 'rule' | 'book' | 'assembly'

/** One stored split. `lineId`/`partId` say the scope (see the module note). */
export type StageSplitRecord = {
  countRowId: string
  lineId: string | null
  partId: string | null
  weights: StageWeights
  source: StageSplitSource
}

export const ZERO_MONEY: StageMoney = { rough_in: 0, top_out: 0, trim_set: 0 }

export function stageWeights(rough_in: number, top_out: number, trim_set: number): StageWeights {
  return { rough_in, top_out, trim_set }
}

/** An even split over the given stages; [] → null (unassigned). */
export function weightsFromStages(stages: readonly TakeoffStage[]): StageWeights | null {
  const set = new Set(stages)
  if (set.size === 0) return null
  return { rough_in: set.has('rough_in') ? 1 : 0, top_out: set.has('top_out') ? 1 : 0, trim_set: set.has('trim_set') ? 1 : 0 }
}

/** The stages a split lights (weight > 0), in stage order. */
export function stagesOf(w: StageWeights | null | undefined): TakeoffStage[] {
  if (!w) return []
  return STAGE_KEYS.filter((k) => Number(w[k]) > 0)
}

/** Shares that sum to 1, or null when every weight is 0 / missing / garbage. */
export function normalizeWeights(w: StageWeights | null | undefined): StageWeights | null {
  if (!w) return null
  const clean = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0)
  const r = clean(w.rough_in)
  const t = clean(w.top_out)
  const s = clean(w.trim_set)
  const sum = r + t + s
  if (sum <= 0) return null
  return { rough_in: r / sum, top_out: t / sum, trim_set: s / sum }
}

export function weightsEqual(a: StageWeights | null | undefined, b: StageWeights | null | undefined): boolean {
  const na = normalizeWeights(a)
  const nb = normalizeWeights(b)
  if (!na || !nb) return na === nb
  return STAGE_KEYS.every((k) => Math.abs(na[k] - nb[k]) < 1e-9)
}

/**
 * How the split reads beside the chips: '' for one stage, '½ · ½' / '⅓ · ⅓ · ⅓'
 * for an even split, else the rounded percents of the lit stages ('70 · 30').
 */
export function describeWeights(w: StageWeights | null | undefined): string {
  const n = normalizeWeights(w)
  if (!n) return ''
  const lit = stagesOf(n)
  if (lit.length <= 1) return ''
  const even = lit.every((k) => Math.abs(n[k] - 1 / lit.length) < 0.005)
  if (even) return lit.length === 2 ? '½ · ½' : '⅓ · ⅓ · ⅓'
  return lit.map((k) => String(Math.round(n[k] * 100))).join(' · ')
}

/** "2" / "1 + 2" / "1 + 2 + 3" — the numbers Wendi writes in the margin. */
export function stageNumbersText(w: StageWeights | null | undefined): string {
  return stagesOf(w).map((k) => String(STAGE_NUMBER[k])).join(' + ')
}

/** "Rough In" / "Rough In + Top Out (½ · ½)" / "Rough In + Top Out (70 · 30)". */
export function describeSplitLong(w: StageWeights | null | undefined): string {
  const lit = stagesOf(w)
  if (lit.length === 0) return 'no stage'
  const names = lit.map((k) => STAGE_LABELS[k]).join(' + ')
  const d = describeWeights(w)
  return d ? `${names} (${d})` : names
}

/**
 * A click on one chip. `exclusive` (Shift-click / Shift+number) makes that stage
 * the only one. Otherwise the stage toggles, and the lit set re-evens — a typed
 * 70 · 30 becomes ½ · ½ · … the moment the set changes; type again to re-tilt.
 * Unlighting the last lit stage returns null (unassigned).
 */
export function toggleStage(current: StageWeights | null | undefined, stage: TakeoffStage, exclusive = false): StageWeights | null {
  if (exclusive) return weightsFromStages([stage])
  const lit = new Set(stagesOf(current))
  if (lit.has(stage)) lit.delete(stage)
  else lit.add(stage)
  return weightsFromStages([...lit])
}

/**
 * "70/30", "70 30", "70·30", "70,30", "2:1" → weights over the lit stages in stage
 * order. One number per lit stage; anything else (or all zeros) → null.
 */
export function parseSharesText(text: string, lit: readonly TakeoffStage[]): StageWeights | null {
  const nums = text
    .split(/[\s/·,:|+]+/)
    .map((s) => s.replace(/%/g, '').trim())
    .filter(Boolean)
    .map(Number)
  if (nums.length !== lit.length || nums.some((n) => !Number.isFinite(n) || n < 0)) return null
  const w: StageWeights = { rough_in: 0, top_out: 0, trim_set: 0 }
  lit.forEach((k, i) => {
    w[k] = nums[i] ?? 0
  })
  return normalizeWeights(w) ? w : null
}

/* ────────────────────────────── lookup ────────────────────────────── */

export type StageSplitLookup = {
  fixture: Map<string, StageSplitRecord>
  line: Map<string, StageSplitRecord>
  /** key `${lineId}:${partId}` */
  part: Map<string, StageSplitRecord>
}

export function partSplitKey(lineId: string, partId: string): string {
  return `${lineId}:${partId}`
}

export function indexStageSplits(records: ReadonlyArray<StageSplitRecord>): StageSplitLookup {
  const out: StageSplitLookup = { fixture: new Map(), line: new Map(), part: new Map() }
  for (const r of records) {
    if (r.lineId && r.partId) out.part.set(partSplitKey(r.lineId, r.partId), r)
    else if (r.lineId) out.line.set(r.lineId, r)
    else out.fixture.set(r.countRowId, r)
  }
  return out
}

export type EffectiveSplit = { weights: StageWeights | null; scope: StageSplitScope | null; source: StageSplitSource | null }

/** The split that applies at a scope, walking up: part → line → fixture → none. */
export function effectiveSplit(lookup: StageSplitLookup, countRowId: string, lineId?: string | null, partId?: string | null): EffectiveSplit {
  if (lineId && partId) {
    const p = lookup.part.get(partSplitKey(lineId, partId))
    if (p) return { weights: p.weights, scope: 'part', source: p.source }
  }
  if (lineId) {
    const l = lookup.line.get(lineId)
    if (l) return { weights: l.weights, scope: 'line', source: l.source }
  }
  const f = lookup.fixture.get(countRowId)
  if (f) return { weights: f.weights, scope: 'fixture', source: f.source }
  return { weights: null, scope: null, source: null }
}

/* ────────────────────────────── money ────────────────────────────── */

export type StageLineInput = {
  id: string
  countRowId: string
  partId: string | null
  sourceTemplateId: string | null
  quantity: number | string
  unitPrice: number | string
}

export type StageCountRowInput = { id: string; fixture: string | null | undefined; count: number | string | null | undefined }

export type BundlePartInput = { partId: string; quantity: number; unitPrice: number; hasPrice: boolean }

/**
 * How a bundle's one price spreads over its parts when they carry different
 * stages: by catalog value (qty × lowest catalog price). A part with no catalog
 * price counts as an average priced part; with no priced parts at all, evenly.
 */
export function bundleComponentShares(parts: ReadonlyArray<BundlePartInput>): Map<string, number> {
  const out = new Map<string, number>()
  if (parts.length === 0) return out
  const priced = parts.filter((p) => p.hasPrice && Number(p.unitPrice) > 0)
  const value = (p: BundlePartInput) => Number(p.quantity) * Number(p.unitPrice)
  const avg = priced.length > 0 ? priced.reduce((s, p) => s + value(p), 0) / priced.length : 1
  const weights = parts.map((p) => (p.hasPrice && Number(p.unitPrice) > 0 ? value(p) : avg))
  const sum = weights.reduce((s, w) => s + w, 0)
  parts.forEach((p, i) => {
    out.set(p.partId, sum > 0 ? (weights[i] ?? 0) / sum : 1 / parts.length)
  })
  return out
}

export type FixtureStageBreakdown = {
  countRowId: string
  fixture: string
  /** The fixture's material dollars (lines × count + its order-rounding share). */
  raw: number
  byStage: StageMoney
  unassigned: number
  /** The fixture-level split, when one is stored. */
  fixtureWeights: StageWeights | null
  fixtureSource: StageSplitSource | null
  /** How many lines (or bundle parts) under it carry their own split. */
  ownSplitCount: number
  /** True when the fixture has money that no split covers. */
  incomplete: boolean
}

export type MaterialsByStageInput = {
  countRows: ReadonlyArray<StageCountRowInput>
  lines: ReadonlyArray<StageLineInput>
  /** Per fixture, the order rounding's extra (from `summarizeTakeoffCoverage`); missing = 0. */
  roundingExtraByCountRow?: ReadonlyMap<string, number> | null
  splits: ReadonlyArray<StageSplitRecord>
  /** Bundle lines' parts by template id, when loaded; a bundle with no entry follows its line / fixture whole. */
  bundleParts?: ReadonlyMap<string, ReadonlyArray<BundlePartInput>> | null
  factor: number
}

export type MaterialsByStageSummary = {
  factor: number
  /** Raw material dollars per stage. */
  byStage: StageMoney
  /** byStage × factor. */
  scaled: StageMoney
  /** Each stage's share of the assigned dollars, 0–100. */
  sharesPct: StageMoney
  assignedRaw: number
  unassignedRaw: number
  totalRaw: number
  totalScaled: number
  fixtures: FixtureStageBreakdown[]
  /** Fixtures with lines whose money is not fully staged. */
  incompleteFixtureIds: string[]
  /** Fixtures with lines that are fully staged. */
  stagedFixtureCount: number
  costedFixtureCount: number
  /** Lines / bundle parts carrying their own split, across the bid. */
  ownSplitCount: number
}

function addMoney(into: StageMoney, weights: StageWeights | null, amount: number): number {
  const n = normalizeWeights(weights)
  if (!n || amount === 0) return amount
  for (const k of STAGE_KEYS) into[k] += amount * n[k]
  return 0
}

export function computeMaterialsByStage(input: MaterialsByStageInput): MaterialsByStageSummary {
  const lookup = indexStageSplits(input.splits)
  const linesByRow = new Map<string, StageLineInput[]>()
  for (const l of input.lines) {
    const list = linesByRow.get(l.countRowId) ?? []
    list.push(l)
    linesByRow.set(l.countRowId, list)
  }
  const byStage: StageMoney = { ...ZERO_MONEY }
  let unassignedRaw = 0
  let ownSplitCount = 0
  const fixtures: FixtureStageBreakdown[] = []
  for (const row of input.countRows) {
    const lines = linesByRow.get(row.id) ?? []
    const mult = roughCountMultiplier(row.count)
    const fixtureRec = lookup.fixture.get(row.id) ?? null
    const rowStage: StageMoney = { ...ZERO_MONEY }
    let rowUnassigned = 0
    let rowRaw = 0
    let own = 0
    for (const l of lines) {
      const lineDollars = Number(l.quantity) * Number(l.unitPrice) * mult
      rowRaw += lineDollars
      const isBundle = l.partId == null && l.sourceTemplateId != null
      const parts = isBundle && l.sourceTemplateId ? input.bundleParts?.get(l.sourceTemplateId) : undefined
      const lineHasOwn = lookup.line.has(l.id)
      if (lineHasOwn) own += 1
      const partOwn = parts ? parts.filter((p) => lookup.part.has(partSplitKey(l.id, p.partId))) : []
      own += partOwn.length
      if (parts && parts.length > 0 && partOwn.length > 0) {
        // The bundle's parts disagree: spread its price by catalog value, each part its own split.
        const shares = bundleComponentShares(parts)
        for (const p of parts) {
          const eff = effectiveSplit(lookup, row.id, l.id, p.partId)
          rowUnassigned += addMoney(rowStage, eff.weights, lineDollars * (shares.get(p.partId) ?? 0))
        }
      } else {
        const eff = effectiveSplit(lookup, row.id, l.id, null)
        rowUnassigned += addMoney(rowStage, eff.weights, lineDollars)
      }
    }
    // The fixture's slice of the sticks follows its staged dollars; with none staged it stays unassigned.
    const extra = input.roundingExtraByCountRow?.get(row.id) ?? 0
    if (extra !== 0) {
      rowRaw += extra
      const staged = rowStage.rough_in + rowStage.top_out + rowStage.trim_set
      if (staged > 0) {
        for (const k of STAGE_KEYS) rowStage[k] += extra * (rowStage[k] / staged)
      } else {
        rowUnassigned += extra
      }
    }
    for (const k of STAGE_KEYS) byStage[k] += rowStage[k]
    unassignedRaw += rowUnassigned
    ownSplitCount += own
    fixtures.push({
      countRowId: row.id,
      fixture: String(row.fixture ?? ''),
      raw: rowRaw,
      byStage: rowStage,
      unassigned: rowUnassigned,
      fixtureWeights: fixtureRec?.weights ?? null,
      fixtureSource: fixtureRec?.source ?? null,
      ownSplitCount: own,
      incomplete: rowUnassigned > 0.005,
    })
  }
  const assignedRaw = byStage.rough_in + byStage.top_out + byStage.trim_set
  const totalRaw = assignedRaw + unassignedRaw
  const factor = Number.isFinite(input.factor) && input.factor > 0 ? input.factor : 1
  const scaled: StageMoney = { rough_in: byStage.rough_in * factor, top_out: byStage.top_out * factor, trim_set: byStage.trim_set * factor }
  const sharesPct: StageMoney = assignedRaw > 0
    ? { rough_in: (100 * byStage.rough_in) / assignedRaw, top_out: (100 * byStage.top_out) / assignedRaw, trim_set: (100 * byStage.trim_set) / assignedRaw }
    : { ...ZERO_MONEY }
  const costed = fixtures.filter((f) => f.raw > 0)
  return {
    factor,
    byStage,
    scaled,
    sharesPct,
    assignedRaw,
    unassignedRaw,
    totalRaw,
    totalScaled: assignedRaw * factor,
    fixtures,
    incompleteFixtureIds: costed.filter((f) => f.incomplete).map((f) => f.countRowId),
    stagedFixtureCount: costed.filter((f) => !f.incomplete).length,
    costedFixtureCount: costed.length,
    ownSplitCount,
  }
}

/**
 * Scale to contract (the opt-in on the paper): the bid amount spread by the
 * stages' raw shares, so the three numbers sum to the contract. Null when
 * nothing is staged.
 */
export function scaleToContract(summary: Pick<MaterialsByStageSummary, 'byStage' | 'assignedRaw'>, contractAmount: number): StageMoney | null {
  if (!(summary.assignedRaw > 0) || !Number.isFinite(contractAmount) || contractAmount <= 0) return null
  return {
    rough_in: (contractAmount * summary.byStage.rough_in) / summary.assignedRaw,
    top_out: (contractAmount * summary.byStage.top_out) / summary.assignedRaw,
    trim_set: (contractAmount * summary.byStage.trim_set) / summary.assignedRaw,
  }
}

/* ────────────────────────────── the factor ────────────────────────────── */

export const DEFAULT_SOV_MATERIAL_FACTOR = 1.5

/** Parse a factor from app_settings / bids: missing, garbage, or outside 1–5 falls back to the default. */
export function parseSovMaterialFactor(value: number | string | null | undefined, fallback = DEFAULT_SOV_MATERIAL_FACTOR): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n) || n < 1 || n > 5) return fallback
  return n
}

/* ────────────────────────────── the rules ────────────────────────────── */

export type StageRule = {
  weights: StageWeights
  /** Why, in the words the rail shows: "waste pipe", "in the wall", "below the slab", "set at trim". */
  reason: string
}

// Money rows, not plumbing: no stage (the rail lists them as "no stage · allowance").
const ALLOWANCE = /\b(allowance|travel|lodging|per diem|permit|mobilization|rental|rentals|equipment|bond|contingency|lump|misc|overhead|freight|supervision|cleanup|labor only|material\/labor)\b/i
const FOOTAGE = /\b(ft|feet|foot|lf|linear|run)\b|\bft of\b/i
const WASTE = /\b(waste|sewer|drain|dwv|storm|sanitary|san|sw|ss|grease line|condensate drain)\b/i
const VENT = /\b(vent|vtr)\b/i
const BELOW_SLAB = /\b(f?co|wco|gco|yco|clean\s?-?outs?|cleanouts?|2\s?-?way\s?co|two\s?-?way|fd|floor drains?|hd|hub drains?|td|trench drains?|area drains?|fs|floor sinks?|gi|grease|interceptor|sample well|catch basin|backwater|sump|ejector|sand trap|oil separator)\b/i
const IN_THE_WALL = /\b(wha|hammer|arrest(?:or|er)s?|tmv|mixing valves?|valves?|prv|backflow|rpz|bfp|dcva|shock|shut\s?-?offs?|balancing|box|ice maker box|washer box|wb|imb|rough valve|shower valve|tub valve)\b/i

/**
 * The stage a row name implies, or null when the name is an allowance or says
 * nothing. Waste pipe splits ½ Rough In · ½ Top Out (below and above the slab);
 * other pipe is Top Out; drains, cleanouts and interceptors are Rough In;
 * valves and arrestors are Top Out; everything else that looks like a fixture
 * is set at Trim Set.
 */
export function defaultSplitForFixture(rawName: string | null | undefined): StageRule | null {
  const name = String(rawName ?? '').trim()
  if (!name) return null
  if (ALLOWANCE.test(name)) return null
  if (FOOTAGE.test(name)) {
    if (WASTE.test(name)) return { weights: stageWeights(1, 1, 0), reason: 'waste pipe — half below the slab, half above' }
    if (VENT.test(name)) return { weights: stageWeights(0, 1, 0), reason: 'vent pipe' }
    return { weights: stageWeights(0, 1, 0), reason: 'water or gas pipe' }
  }
  if (BELOW_SLAB.test(name)) return { weights: stageWeights(1, 0, 0), reason: 'below the slab' }
  if (IN_THE_WALL.test(name)) return { weights: stageWeights(0, 1, 0), reason: 'in the wall' }
  return { weights: stageWeights(0, 0, 1), reason: 'set at trim' }
}

export type RulePlan = {
  /** Fixture-scope splits to write (rows with no fixture split yet, or whose split came from a rule / book). */
  toWrite: Array<{ countRowId: string; fixture: string; weights: StageWeights; reason: string }>
  /** Rows with a hand-set split, left alone. */
  keptByHand: number
  /** Rows the rules could not place (allowances, empty names). */
  unplaced: Array<{ countRowId: string; fixture: string }>
}

/**
 * "Fill from rules": every fixture without a hand-set split gets the rule's
 * split. A split someone set by hand is kept; rule/book splits refresh.
 */
export function planRuleFill(
  countRows: ReadonlyArray<StageCountRowInput>,
  existing: ReadonlyArray<StageSplitRecord>,
  ruleFor: (fixture: string) => StageRule | null = defaultSplitForFixture,
): RulePlan {
  const lookup = indexStageSplits(existing)
  const plan: RulePlan = { toWrite: [], keptByHand: 0, unplaced: [] }
  for (const r of countRows) {
    const fixture = String(r.fixture ?? '')
    const cur = lookup.fixture.get(r.id)
    if (cur && cur.source === 'hand') {
      plan.keptByHand += 1
      continue
    }
    const rule = ruleFor(fixture)
    if (!rule) {
      plan.unplaced.push({ countRowId: r.id, fixture })
      continue
    }
    if (cur && weightsEqual(cur.weights, rule.weights)) continue
    plan.toWrite.push({ countRowId: r.id, fixture, weights: rule.weights, reason: rule.reason })
  }
  return plan
}

/** One sentence for the rail after a rule pass. */
export function describeRulePlan(plan: RulePlan, applied: number): string {
  const parts: string[] = []
  parts.push(applied === 1 ? '1 fixture staged by rule' : `${applied} fixtures staged by rule`)
  if (plan.keptByHand > 0) parts.push(plan.keptByHand === 1 ? '1 set by hand kept' : `${plan.keptByHand} set by hand kept`)
  if (plan.unplaced.length > 0) parts.push(plan.unplaced.length === 1 ? '1 has no stage (allowance)' : `${plan.unplaced.length} have no stage (allowances)`)
  return parts.join(' · ')
}
