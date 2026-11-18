/**
 * Stages onto the job (punch list #397): a won bid's price as the job's stage lines.
 *
 * A job opened from a won bid used to arrive with one line, *Bid price*, and the stages the bid
 * knew were left behind. Everything that reads a job's stages reads its lines (the pace card's
 * rail, the Projects board, the stage checklists, Before we start), so a job with one line gave
 * them nothing to show. This file is the rule for bringing the stages across, and nothing here
 * touches a screen or the database:
 *
 * - **the dollars** follow a split the office picks: the bid's own schedule of values when it has
 *   one (it is what the GC saw), else one of the Multiple Segment Generator's presets, the
 *   company's own terms. On 2026-11-18 no won bid held a schedule the app could read, so the
 *   presets are the common case;
 * - **the hours** follow the bid's Labor tab stage by stage, when the bid passes the same test
 *   the award's baseline uses (`bidBaselineUsable`). A bid that fails it gives no hours, and the
 *   lines read the company's split for their kind, marked assumed, as a typed line does;
 * - **every line arrives Any time**. The Pipeline already draws lines named Rough In, Top Out and
 *   Trim Set as stages (`stageRecognition.ts`), and the billing rule stays behind the In order
 *   badge, which the office taps for itself (the owner's call of 2026-09-14).
 *
 * It also holds the rule for a job that already exists on one line: when the same offer may be
 * made, and the reason and the door when it may not. Pure.
 */
import type { BidSchedule } from '../aiaBidSchedule'
import { scaleLinesToContract } from '../bidDocuments/sovLines'
import { bidBaselineUsable, bidNotUsableWords, type AwardBidBreakdown } from '../jobs/awardBaseline'
import { formatCurrency } from '../jobs/jobFormMoney'
import { calcLineBudget, lineBudgetFor, type LineBudgetSettings, type LineBudgetWrite } from '../jobs/lineBudgets'
import { SEGMENT_GENERATOR_PRESETS, segmentGeneratorDollarsByRowId } from '../jobs/segmentGenerator'
import { stageChecklistKindOf } from '../jobs/stageChecklist'
import { pluralNoun } from '../batchWords'
import { bidImportLabel } from './jobImportFromBid'

/** The bid's three stages, as the Labor tab and the schedule of values name them. */
export type BidStageKey = 'rough_in' | 'top_out' | 'trim_set'

export type BidStageSplitKey = 'bid' | 'commercial' | 'residential'

export type BidStageSplitRow = {
  name: string
  /** This row's share of the price: a percent on a preset, the scheduled dollars on the bid's own schedule. Only the ratio matters. */
  weight: number
  /** The bid stage whose hours this row takes; null for a row that names none (Final, Permit). */
  stage: BidStageKey | null
}

export type BidStageSplit = {
  key: BidStageSplitKey
  /** The chip's words. */
  label: string
  rows: BidStageSplitRow[]
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : 0
}
const cents = (n: number) => Math.round((n || 0) * 100)
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/**
 * The splits the window offers, in the order of its chips: the bid's own schedule first when it
 * holds two or more lines with a value, then the generator's presets. A schedule with one priced
 * line is no split: the job's one line says as much.
 */
export function bidStageSplits(schedule: BidSchedule | null): BidStageSplit[] {
  const out: BidStageSplit[] = []
  const priced = (schedule?.lines ?? []).filter((l) => cents(l.scheduledValue) > 0 && l.label.trim())
  if (priced.length >= 2) {
    out.push({ key: 'bid', label: 'The bid’s schedule', rows: priced.map((l) => ({ name: l.label.trim(), weight: l.scheduledValue, stage: l.stage ?? stageChecklistKindOf(l.label) })) })
  }
  for (const p of SEGMENT_GENERATOR_PRESETS) {
    if (p.key !== 'commercial' && p.key !== 'residential') continue
    out.push({ key: p.key, label: p.label, rows: p.rows.map((r) => ({ name: r.name, weight: r.pct, stage: stageChecklistKindOf(r.name) })) })
  }
  return out
}

/**
 * The chip lit when the window opens: the bid's own schedule when there is one, else the preset
 * for the customer's kind (a residential customer takes 40/40/20), else the company's standard
 * 30/30/30/10. The office can press another.
 */
export function defaultBidStageSplitKey(splits: ReadonlyArray<BidStageSplit>, customerType: string | null | undefined): BidStageSplitKey | null {
  if (splits.length === 0) return null
  if (splits.some((s) => s.key === 'bid')) return 'bid'
  const wanted: BidStageSplitKey = /resid/i.test(customerType ?? '') ? 'residential' : 'commercial'
  return splits.some((s) => s.key === wanted) ? wanted : splits[0]!.key
}

/** One line as the job form takes it: the generator's shape, with the budget columns a line from the bid carries. */
export type BidStageLine = {
  name: string
  count: 1
  line_unit_price: number
  line_description: string
  invoice_id: null
  stage_kind: 'any'
} & Partial<LineBudgetWrite>

/** Where a line's hours came from: the bid's Labor tab, the company's split for its kind, or nowhere (a line with no labor). */
export type BidStageHoursFrom = 'bid' | 'assumed' | 'none'

export type BidStagePreviewRow = { name: string; priceUsd: number; hours: number; hoursFrom: BidStageHoursFrom }

export type BidStageLines = {
  lines: BidStageLine[]
  /** The same lines as the window draws them, in order. */
  preview: BidStagePreviewRow[]
  totalUsd: number
  totalHours: number
  /** `stages` = each stage's own hours; `spread` = the bid's hours spread by price (it has no hours by stage); `assumed` = the company's split. */
  hoursBasis: 'stages' | 'spread' | 'assumed'
  /** Hours on the bid's stages that no line here names, so the window can say they are not on a line. 0 when all landed. */
  unplacedHours: number
}

const STAGE_HOURS_KEY: Record<BidStageKey, 'rough' | 'top' | 'trim'> = { rough_in: 'rough', top_out: 'top', trim_set: 'trim' }

/** Each row's dollars, to the cent, adding up to the price: the generator's own sum for a preset, the schedule's own scaling for the bid's lines. */
function dollarsOf(split: BidStageSplit, priceUsd: number): number[] {
  if (split.key === 'bid') {
    const scaled = scaleLinesToContract(split.rows.map((r) => ({ value: r.weight, labor: null })), priceUsd)
    return scaled ? scaled.map((l) => l.value) : split.rows.map(() => 0)
  }
  const rows = split.rows.map((r, i) => ({ id: String(i), name: r.name, pct: r.weight, kind: 'order' as const, amount: null }))
  const byId = segmentGeneratorDollarsByRowId(priceUsd, rows)
  return rows.map((r) => byId[r.id] ?? 0)
}

/**
 * The job's lines for a price and a split, with each line's hours.
 *
 * A stage's hours go to the lines that name it, shared by their price when there are several. A
 * line's labor is those hours at the bid's rate (the company's when the bid has none), stored as
 * its share of the line's price, as the one carried line stores the whole bid's labor today. The
 * hours a line then reads are that labor at the company's rate, the way every reader of a line
 * budget works them out, so they match the bid's hours when the two rates match. Materials are the bid's materials at their share of the whole price, the same on every
 * line, and give way to labor so the two never pass the price. A row whose dollars come to zero
 * is left out.
 */
export function bidStageLines(args: {
  priceUsd: number
  split: BidStageSplit
  breakdown: AwardBidBreakdown | null
  settings: LineBudgetSettings
  bid: { bid_number: string | null; project_name: string | null }
  /** True when the price is the bid's agreed value, false when it is what the GC was sent. */
  agreed: boolean
}): BidStageLines {
  const { priceUsd, split, breakdown, settings } = args
  const dollars = dollarsOf(split, priceUsd)
  const rows = split.rows.map((r, i) => ({ ...r, priceUsd: dollars[i] ?? 0 })).filter((r) => r.priceUsd > 0)
  const totalWeight = split.rows.reduce((s, r) => s + Math.max(0, r.weight), 0)
  const bidLabel = bidImportLabel(args.bid, 'the bid')
  const figure = args.agreed ? 'the agreed value' : 'what was sent'

  const usable = bidBaselineUsable(breakdown, settings.rateUsd)
  const rate = usable && num(breakdown!.labor_rate) > 0 ? num(breakdown!.labor_rate) : settings.rateUsd
  const stageHours = (k: BidStageKey) => num(breakdown?.labor_hours_by_stage?.[STAGE_HOURS_KEY[k]])
  const byStage = usable && (['rough_in', 'top_out', 'trim_set'] as const).some((k) => stageHours(k) > 0)
  const materialsPct = usable && priceUsd > 0 ? clampPct((num(breakdown!.materials_usd) / priceUsd) * 100) : 0
  // The whole bid's labor at its share of the price: what one carried line takes today, for a bid with no hours by stage.
  const wholeLaborUsd = usable ? (num(breakdown!.labor_usd) > 0 ? num(breakdown!.labor_usd) : num(breakdown!.labor_hours) * rate) : 0
  const spreadLaborPct = usable && priceUsd > 0 ? clampPct((wholeLaborUsd / priceUsd) * 100) : 0

  const priceByStage = new Map<BidStageKey, number>()
  for (const r of rows) if (r.stage) priceByStage.set(r.stage, (priceByStage.get(r.stage) ?? 0) + r.priceUsd)

  const lines: BidStageLine[] = []
  const preview: BidStagePreviewRow[] = []
  for (const r of rows) {
    const sharePct = totalWeight > 0 ? Math.round((r.weight * 100) / totalWeight) : 0
    const base = { name: r.name, count: 1 as const, line_unit_price: r.priceUsd, line_description: `${bidLabel} — ${sharePct}% of ${figure}`, invoice_id: null, stage_kind: 'any' as const }
    if (!usable) {
      const calc = calcLineBudget(r.priceUsd, lineBudgetFor(undefined, r.name, settings), settings)
      lines.push(base)
      preview.push({ name: r.name, priceUsd: r.priceUsd, hours: calc.laborHours, hoursFrom: 'assumed' })
      continue
    }
    let laborPct = spreadLaborPct
    if (byStage) {
      const hours = r.stage ? (stageHours(r.stage) * r.priceUsd) / (priceByStage.get(r.stage) || 1) : 0
      laborPct = clampPct(((hours * rate) / r.priceUsd) * 100)
    }
    const lineMaterialsPct = Math.min(materialsPct, 100 - laborPct)
    const budget: LineBudgetWrite = { budget_labor_pct: laborPct, budget_materials_pct: lineMaterialsPct, budget_source: 'workbench', budget_tuned_at: null, budget_rate_usd: rate }
    // The hours as every reader of the line works them out (`calcLineBudget` at the company's rate), so the window and the Bill tab agree.
    const lineHours = calcLineBudget(r.priceUsd, { laborPct, materialsPct: lineMaterialsPct, source: 'workbench' }, settings).laborHours
    lines.push({ ...base, ...budget })
    preview.push({ name: r.name, priceUsd: r.priceUsd, hours: lineHours, hoursFrom: lineHours > 0 ? 'bid' : 'none' })
  }

  const placed = new Set(rows.map((r) => r.stage).filter((s): s is BidStageKey => s != null))
  const unplacedHours = byStage ? (['rough_in', 'top_out', 'trim_set'] as const).filter((k) => !placed.has(k)).reduce((s, k) => s + stageHours(k), 0) : 0
  return {
    lines,
    preview,
    totalUsd: Math.round(lines.reduce((s, l) => s + cents(l.line_unit_price), 0)) / 100,
    totalHours: preview.reduce((s, p) => s + p.hours, 0),
    hoursBasis: !usable ? 'assumed' : byStage ? 'stages' : 'spread',
    unplacedHours,
  }
}

const usd = (n: number) => `$${formatCurrency(n).replace(/\.00$/, '')}`
const hoursWord = (h: number) => `${Math.round(h)} h`

/** The words on the window. Each sentence is one idea, so a first read takes them in order. */
export const BID_CARRY_WORDS = {
  asStages: 'As stages',
  asOneLine: 'As one line',
  startAtZero: 'Start at $0',
  startAtZeroNote: 'Writes nothing.',
  cancel: 'Cancel',
  changeLater: 'You can change every name and amount in Line Items before you save the job.',
  anyTime: 'Each line arrives Any time.',
  title: (carryUsd: number): string => `How should ${usd(carryUsd)} come onto the job?`,
  oneLineNote: (carryUsd: number): string => `Bid price · $${formatCurrency(carryUsd)}.`,
  /** Under the rows: where the dollars came from. */
  dollarsFrom: (split: BidStageSplit, bidLabel: string): string => (split.key === 'bid' ? `Dollars: ${bidLabel}’s schedule of values.` : `Dollars: the company’s ${split.label.replace(/^\S+\s+/, '')}.`),
  /** Under the rows: where the hours came from, and what did not land on a line. */
  hoursFrom: (result: Pick<BidStageLines, 'hoursBasis' | 'unplacedHours'>, bidLabel: string, why: string): string => {
    if (result.hoursBasis === 'assumed') return `Hours: assumed from the company’s split.${why ? ` ${why}` : ''}`
    if (result.hoursBasis === 'spread') return `Hours: ${bidLabel}’s Labor tab, spread by price.`
    const left = Math.round(result.unplacedHours)
    return `Hours: ${bidLabel}’s Labor tab.${left > 0 ? ` ${left} h on the bid have no line here.` : ''}`
  },
  hours: (row: Pick<BidStagePreviewRow, 'hours' | 'hoursFrom'>): string => (row.hoursFrom === 'none' ? 'no hours' : row.hoursFrom === 'assumed' ? `≈ ${hoursWord(row.hours)}` : hoursWord(row.hours)),
  total: (result: Pick<BidStageLines, 'lines' | 'totalHours'>): string => `${result.lines.length} ${pluralNoun('line', result.lines.length)}`,
  /** The window's one press, named for the answer picked. */
  confirm: (choice: 'stages' | 'one' | 'zero', carryUsd: number, stageCount: number): string =>
    choice === 'stages' ? `Bring ${stageCount} ${pluralNoun('stage', stageCount)} · ${usd(carryUsd)}` : choice === 'one' ? `Carry ${usd(carryUsd)} over` : 'Start at $0',
} as const

/** Why the bid's hours are not on the lines, for the window's hours sentence: the award's own words, '' when they are. */
export function bidStageHoursWhy(breakdown: AwardBidBreakdown | null, bid: { bid_number: string | null; project_name: string | null }, settings: LineBudgetSettings): string {
  if (bidBaselineUsable(breakdown, settings.rateUsd)) return ''
  const tag = bid.bid_number ? `B${String(bid.bid_number).trim()}` : 'The bid'
  return breakdown ? bidNotUsableWords(breakdown, tag, settings.rateUsd) : `${tag} has no cost estimate.`
}

// ---------------------------------------------------------------------------------------------
// A job that already exists, still on one line

/** One line of the job, as much as the rule needs. */
export type BringStagesLine = {
  id: string
  line_kind?: string | null
  invoice_id: string | null
  progress_pct: number | string | null
  progress_report_id?: string | null
  trip_id?: string | null
  budget_source?: string | null
}

export type BringStagesHold = 'on-a-bill' | 'crew-percent' | 'checklist' | 'window' | 'trip' | 'tuned' | 'pay-application'

export type BringStagesStanding =
  /** The offer shows: this is the line the stages take the place of. */
  | { state: 'ready'; lineId: string }
  /** Nothing to offer and nothing to say: no bid, a closed job, or a job whose lines are already its stages. */
  | { state: 'none' }
  /** The job could take stages but must not: the reason, and the door that still works. */
  | { state: 'held'; hold: BringStagesHold; words: string }

const DOOR = 'Add a stage with + Add line item.'
const HOLD_WORDS: Record<BringStagesHold, string> = {
  'on-a-bill': `This line is on a bill, so it stays one line. ${DOOR}`,
  'pay-application': `This job has a pay application, so its lines stay as they are. ${DOOR}`,
  'crew-percent': `The crew has reported on this line, so it stays one line. ${DOOR}`,
  checklist: `This line has a checklist answer, so it stays one line. ${DOOR}`,
  window: `This line has stage dates on the Subs tab, so it stays one line. ${DOOR}`,
  trip: `This line came from a trip, so it stays one line. ${DOOR}`,
  tuned: `The owner tuned this line’s budget, so it stays one line. ${DOOR}`,
}

/**
 * Whether a job that exists may be offered its bid's stages in place of its one line.
 *
 * It may when it came from a bid, is still Waiting or Working, and has exactly one priced line
 * that nothing hangs on. It is held, with the reason, when replacing the line would orphan
 * something: a bill, a pay application, the crew's percent, a checklist answer, a stage window, a
 * trip, or a budget the owner tuned. Money first, so the reason shown is the heaviest one.
 */
export function bringBidStagesStanding(input: {
  bidId: string | null | undefined
  status: string | null | undefined
  lines: ReadonlyArray<BringStagesLine>
  hasPayApplication: boolean
  /** Fixture ids with a stage checklist answer. */
  checklistLineIds: ReadonlySet<string>
  /** Fixture ids with a stage window. */
  windowLineIds: ReadonlySet<string>
}): BringStagesStanding {
  if (!input.bidId) return { state: 'none' }
  if (input.status !== 'waiting' && input.status !== 'working') return { state: 'none' }
  const priced = input.lines.filter((l) => l.line_kind !== 'discount')
  if (priced.length !== 1) return { state: 'none' }
  const line = priced[0]!
  const held = (hold: BringStagesHold): BringStagesStanding => ({ state: 'held', hold, words: HOLD_WORDS[hold] })
  if (line.invoice_id) return held('on-a-bill')
  if (input.hasPayApplication) return held('pay-application')
  if (line.progress_pct != null || line.progress_report_id) return held('crew-percent')
  if (input.checklistLineIds.has(line.id)) return held('checklist')
  if (input.windowLineIds.has(line.id)) return held('window')
  if (line.trip_id) return held('trip')
  if (line.budget_source === 'tuned') return held('tuned')
  return { state: 'ready', lineId: line.id }
}

/** The link beside Multiple Segment Generator: *Bring B398’s stages*. */
export function bringBidStagesLabel(bid: { bid_number: string | null }): string {
  return bid.bid_number ? `Bring B${String(bid.bid_number).trim()}’s stages` : 'Bring the bid’s stages'
}
