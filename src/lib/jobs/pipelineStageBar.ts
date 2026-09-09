/**
 * The Pipeline row's stage bar (v2.3198, mock-up A′ "one bar, two channels").
 *
 * On a job split into Order stages, the Progress & payment cell swaps its
 * paid/billed/unbilled money bar for the stages themselves: a chip strip
 * (① Rough → ② Top Out 60% → ③ Trim) and one bar whose segments are the
 * stages sized by their share of the job. Each segment's FILL is how far the
 * crew is (the stage-weighted report, else derived from the job's own %); its
 * 3px bottom EDGE is what happened to that stage's draw — paid, billed, ready
 * to bill, or nothing yet. Blue never means two things: fill is work, the
 * edge is money, and the money rows under it shrink to Paid / Billed / Left.
 *
 * Everything here is derived from the Stage Plan kernel (`buildStagePlan`) so
 * the row agrees with the Bill tab to the letter. Names are shortened for the
 * chips by rule (`stageShortLabel`), and `fitStageChips` collapses chips to
 * their numbers when the cell is too narrow — later stages first, then done
 * ones; the live stage keeps its name longest. Pure; the component measures.
 */
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { buildStagePlan, type StageDraw, type StagePlanInvoice, type StagePlanPayment, type StagePlanRow } from './stagePlan'
import { fixtureStageFields } from './stagePlanForm'

export type PipelineStageState = 'done' | 'live' | 'later'
/** The edge: `ready` folds the plan's `waits` in (both are "passed, not billed"); `later` folds `none` / `open`. */
export type PipelineStageEdge = 'paid' | 'billed' | 'ready' | 'later'

export type PipelineStageSegment = {
  fixtureId: string
  number: number
  name: string
  short: string
  state: PipelineStageState
  /** 0–100 — the fill. Done stages read 100. */
  workPct: number
  /** Where the fill came from: a stage report (or sub sheet), the job's own %, or nothing (0). */
  workSource: 'stage' | 'job' | 'none'
  /** Share of the job's Order-stage money, 0–100; equal shares when no stage carries a price. */
  sharePct: number
  /** The width the bar draws, after the minimum-width floor — sums to 100. */
  widthPct: number
  edge: PipelineStageEdge
  /** The plan's line for the stage — "Stage 2 · on site · 60% · draw 2 after it passes". */
  stateLine: string
  amount: number
}

export type PipelineStageBar = {
  segments: PipelineStageSegment[]
  count: number
  /** 1-based number of the live stage; null when every stage is done. */
  liveNumber: number | null
  /** "Stage 2 of 3 · Top Out 60% · draw 1 paid" / "All 3 stages done · paid in full". */
  caption: string
  /** The caption's money clause on its own, so the UI can tone it (amber = a draw is owed). */
  captionTone: 'plain' | 'amber' | 'green'
  /** Σ weight × stage % — the job % the stages imply (the report flow writes this same figure). */
  impliedJobPct: number | null
}

export type PipelineStageBarFixture = {
  id: string
  name: string | null
  count: number | null
  line_unit_price: number | null
  sequence_order: number | null
  invoice_id: string | null
  /** Read loosely (`fixtureStageFields`) so a row loaded before the columns landed reads as plain. */
  stage_kind?: string | null
  progress_pct?: number | null
  shared_with_gc?: boolean | null
}

export type PipelineStageBarInput = {
  fixtures: ReadonlyArray<PipelineStageBarFixture>
  invoices: ReadonlyArray<StagePlanInvoice>
  payments: ReadonlyArray<StagePlanPayment>
  /** jobs_ledger.pct_complete — fills the live stage when no stage has reported yet. */
  pctComplete: number | null | undefined
  /** Company calendar; defaults to today. */
  todayYmd?: string
}

/** True when the job has at least one Order stage — the only time the stage bar replaces the money bar. */
export function stageBarAvailable(fixtures: ReadonlyArray<unknown>): boolean {
  return fixtures.some((f) => fixtureStageFields(f).stage_kind === 'order')
}

/**
 * The chip word for a stage. Plumbing's stage vocabulary shortens by
 * dictionary (Rough In → Rough, Trim Set → Trim, Underground → Ground …);
 * anything else keeps its first meaningful word when that is ten characters
 * or fewer, else the first nine characters and an ellipsis. "Stage 2 —" /
 * "Phase 2:" prefixes are dropped first. The full name always rides the
 * tooltip.
 */
export function stageShortLabel(name: string): string {
  const cleaned = name
    .trim()
    .replace(/^(stage|phase|step)\s*\d+\s*[-–—:.]?\s*/i, '')
    .replace(/^\d+\s*[-–—:.)]\s*/, '')
    .trim()
  if (!cleaned) return name.trim().slice(0, 10) || '—'
  const lower = cleaned.toLowerCase()
  for (const [re, word] of SHORT_LABEL_DICTIONARY) if (re.test(lower)) return word
  const first = cleaned.split(/[\s/,;(]+/)[0] ?? cleaned
  const word = first.replace(/[^\p{L}\p{N}&'-]+$/u, '')
  if (word.length > 0 && word.length <= 10) return word
  const base = word.length > 0 ? word : cleaned
  return `${base.slice(0, 9)}…`
}

const SHORT_LABEL_DICTIONARY: ReadonlyArray<readonly [RegExp, string]> = [
  [/^rough/, 'Rough'],
  [/^top[\s-]?out/, 'Top Out'],
  [/^stack[\s-]?out/, 'Stack'],
  [/^trim/, 'Trim'],
  [/^finish(es|ing)?\b/, 'Finish'],
  [/^final/, 'Final'],
  [/^under\s*ground|^under\s*slab|^ground\s*work|^groundwork/, 'Ground'],
  [/^slab/, 'Slab'],
  [/^sewer/, 'Sewer'],
  [/^water\s*(service|line|main)/, 'Water'],
  [/^water\s*heater/, 'Heater'],
  [/^gas/, 'Gas'],
  [/^demo/, 'Demo'],
  [/^fixture/, 'Fixtures'],
  [/^punch/, 'Punch'],
  [/^inspection/, 'Inspect'],
  [/^mobiliz/, 'Mobilize'],
  [/^site\s*(prep|work)/, 'Site'],
]

const MIN_WIDTH_PCT = 10

const edgeOf = (draw: StageDraw): PipelineStageEdge => {
  switch (draw) {
    case 'paid':
      return 'paid'
    case 'billed':
      return 'billed'
    case 'ready':
    case 'waits':
      return 'ready'
    default:
      return 'later'
  }
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Null when the job has no Order stage. Otherwise the segments in stage order
 * with their fill, share, edge and words.
 */
export function buildPipelineStageBar(input: PipelineStageBarInput): PipelineStageBar | null {
  if (!stageBarAvailable(input.fixtures)) return null
  const plan = buildStagePlan({
    fixtures: input.fixtures.map((f, i) => {
      const stage = fixtureStageFields(f)
      const pp = (f as { progress_pct?: unknown }).progress_pct
      return {
        id: f.id,
        name: f.name ?? '',
        count: Number(f.count) || 1,
        line_unit_price: f.line_unit_price,
        sequence_order: f.sequence_order ?? i,
        invoice_id: f.invoice_id,
        stage_kind: stage.stage_kind,
        shared_with_gc: stage.shared_with_gc,
        progress_pct: typeof pp === 'number' && Number.isFinite(pp) ? pp : null,
      }
    }),
    windows: [],
    orders: [],
    sheets: [],
    invoices: [...input.invoices],
    payments: [...input.payments],
    todayYmd: input.todayYmd ?? todayYmdInAppTz(),
  })
  const orders = plan.rows.filter((r): r is StagePlanRow & { number: number } => r.kind === 'order' && r.number != null)
  if (orders.length === 0) return null

  const totalAmount = orders.reduce((s, r) => s + Math.max(0, r.amount), 0)
  const shares = orders.map((r) => (totalAmount > 0 ? (Math.max(0, r.amount) / totalAmount) * 100 : 100 / orders.length))
  // Floor every segment at MIN_WIDTH_PCT so a $500 stage beside a $30k one still reads, then renormalize.
  const floored = shares.map((s) => Math.max(MIN_WIDTH_PCT, s))
  const flooredSum = floored.reduce((a, b) => a + b, 0)
  const widths = floored.map((w) => (w / flooredSum) * 100)

  // Fill. A stage report wins; failing that the job's own % is spread across
  // the stages by weight: done stages are full, the remainder lands on the
  // live stage. Later stages read 0 unless they reported.
  const jobPct = input.pctComplete != null && Number.isFinite(Number(input.pctComplete)) ? clampPct(Number(input.pctComplete)) : null
  const live = orders.find((r) => r.badge === 'live') ?? null
  const doneShare = orders.reduce((s, r, i) => (r.badge === 'done' ? s + shares[i]! : s), 0)
  const anyStageReported = orders.some((r) => r.pct != null)

  const segments: PipelineStageSegment[] = orders.map((r, i) => {
    const state: PipelineStageState = r.badge === 'done' ? 'done' : r.badge === 'live' ? 'live' : 'later'
    let workPct: number
    let workSource: PipelineStageSegment['workSource']
    if (state === 'done' || r.work === 'passed' || r.work === 'inspection') {
      workPct = 100
      workSource = 'stage'
    } else if (r.pct != null) {
      workPct = clampPct(r.pct)
      workSource = 'stage'
    } else if (state === 'live' && !anyStageReported && jobPct != null && shares[i]! > 0) {
      workPct = clampPct(((jobPct - doneShare) / shares[i]!) * 100)
      workSource = 'job'
    } else {
      workPct = 0
      workSource = 'none'
    }
    return {
      fixtureId: r.fixtureId,
      number: r.number,
      name: r.name,
      short: stageShortLabel(r.name),
      state,
      workPct: Math.round(workPct),
      workSource,
      sharePct: shares[i]!,
      widthPct: widths[i]!,
      edge: edgeOf(r.draw),
      stateLine: r.stateLine,
      amount: r.amount,
    }
  })

  const impliedJobPct = segments.some((s) => s.workSource !== 'none') ? Math.round(segments.reduce((s, seg) => s + (seg.sharePct / 100) * seg.workPct, 0)) : null

  // Caption.
  let caption: string
  let captionTone: PipelineStageBar['captionTone'] = 'plain'
  if (!live) {
    const allPaid = orders.every((r) => r.draw === 'paid' || r.draw === 'none')
    caption = `All ${orders.length} stage${orders.length === 1 ? '' : 's'} done${allPaid ? ' · paid in full' : ''}`
    captionTone = allPaid ? 'green' : 'plain'
  } else {
    const seg = segments[orders.indexOf(live)]!
    const head = `Stage ${live.number} of ${orders.length} · ${live.name}${seg.workSource !== 'none' && seg.workPct > 0 ? ` ${seg.workPct}%` : ''}`
    let money = ''
    if (live.draw === 'ready' || live.draw === 'waits') {
      money = `draw ${live.number} ready to bill`
      captionTone = 'amber'
    } else if (live.draw === 'billed') {
      money = `draw ${live.number} billed`
    } else {
      const lastPaid = [...orders].reverse().find((r) => r.draw === 'paid')
      const owed = orders.find((r) => r.number < live.number && (r.draw === 'ready' || r.draw === 'waits'))
      if (owed) {
        money = `draw ${owed.number} ready to bill`
        captionTone = 'amber'
      } else if (lastPaid) money = `draw ${lastPaid.number} paid`
    }
    caption = money ? `${head} · ${money}` : head
  }

  return { segments, count: orders.length, liveNumber: live?.number ?? null, caption, captionTone, impliedJobPct }
}

// ── Chips ───────────────────────────────────────────────────────────────────

export type StageChip = {
  number: number
  state: PipelineStageState
  /** The word on the chip; null = number only. */
  text: string | null
  /** "60%" beside a live chip's name; null when unknown or done. */
  pctText: string | null
  /** Full name for the tooltip. */
  title: string
}

/** 0 every name · 1 later stages to numbers · 2 done too · 3 live name clipped · 4 numbers only. */
export type StageChipTier = 0 | 1 | 2 | 3 | 4

export type StageChipFit = { tier: StageChipTier; chips: StageChip[]; estimatedPx: number }

/** ~11px system font: an average glyph is a shade over half an em. */
export const estimateTextPx = (text: string, bold = false): number => Math.ceil(text.length * (bold ? 6.6 : 6.1))

const CHIP_FIXED_PX = 3 + 14 + 4 + 7 + 2 // pad-left, number disc, gap, pad-right, border
const ARROW_PX = 10 + 8 // the arrow glyph and its gaps

function chipsAtTier(segments: ReadonlyArray<PipelineStageSegment>, tier: StageChipTier): StageChip[] {
  return segments.map((s) => {
    const pctText = s.state === 'live' && s.workSource !== 'none' && s.workPct > 0 && s.workPct < 100 ? `${s.workPct}%` : null
    let text: string | null = s.short
    if (tier >= 1 && s.state === 'later') text = null
    if (tier >= 2 && s.state === 'done') text = null
    if (tier >= 3 && s.state === 'live') text = s.short.length > 6 ? `${s.short.slice(0, 5)}…` : s.short
    if (tier >= 4) text = null
    return { number: s.number, state: s.state, text, pctText, title: `Stage ${s.number} · ${s.name}` }
  })
}

export function estimateChipsPx(chips: ReadonlyArray<StageChip>, measure: (text: string, bold?: boolean) => number = estimateTextPx): number {
  let px = 0
  chips.forEach((c, i) => {
    px += CHIP_FIXED_PX
    if (c.text) px += measure(c.text, c.state === 'live')
    if (c.pctText) px += 2 + measure(c.pctText, true)
    if (i > 0) px += ARROW_PX
  })
  return px
}

/**
 * The widest tier that fits `widthPx`. Never gives up the live stage's name
 * before the others; falls to numbers only when even the clipped name is too
 * wide. A null width (not measured yet) returns tier 0.
 */
export function fitStageChips(segments: ReadonlyArray<PipelineStageSegment>, widthPx: number | null, measure: (text: string, bold?: boolean) => number = estimateTextPx): StageChipFit {
  const tiers: StageChipTier[] = [0, 1, 2, 3, 4]
  let last: StageChipFit | null = null
  for (const tier of tiers) {
    const chips = chipsAtTier(segments, tier)
    const estimatedPx = estimateChipsPx(chips, measure)
    last = { tier, chips, estimatedPx }
    if (widthPx == null || estimatedPx <= widthPx) return last
  }
  return last!
}

/** Whether a segment is wide enough to carry its "60%" / "✓" label at all. */
export function segmentLabel(seg: PipelineStageSegment, segmentPx: number | null): string | null {
  if (seg.workPct >= 100) return segmentPx == null || segmentPx >= 18 ? '✓' : null
  if (seg.workPct <= 0 || seg.workSource === 'none') return null
  return segmentPx == null || segmentPx >= 30 ? `${seg.workPct}%` : null
}
