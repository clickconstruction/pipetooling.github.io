import { STRIP_MIN_THICK, STRIP_PACE_VERB, type FlowStrip, type StripSection } from './flowStrip'
import { marketWorthPerWeek, stageUsd, type PileStageInput, type StageFlowInput, type StageId } from './stageFlow'

/**
 * The strip of pipe, standing up (punch list #318): the same five sections as
 * `flowStrip.ts`, drawn top to bottom the way work flows down to the bank, with each step's words
 * beside its section instead of under it. The pipe's width is still the dollars a week. The work
 * waiting in front of a step is a bar under its words, as long as its weeks, in place of the block
 * on top of the pipe.
 *
 * Kept apart from `flowStrip.ts`, which is copied to the edge functions for the weekly email: the
 * email draws the pipe across, as a table, and does not need this.
 *
 * Pure: the sections come from `buildFlowStrip`.
 */

/**
 * The owner's word for Market's dollars is *bid*, in place of *asked*. The number is every bid and
 * every estimate opened in the window, at its value, so it is what came in to be bid, sent or not.
 */
export const STRIP_DOWN_VERB: Partial<Record<StageId, string>> = { market: 'bid' }

/** The line over the drawing. */
export const STRIP_DOWN_LEGEND =
  'Dollars a week. A bar is work waiting in front of a step.'

export type StripDownBox = {
  /** One section's height; the sections share the drawing evenly. */
  row: number
  /** The pipe's width at its widest. */
  pipe: number
  /** How tall the taper between two sections is. */
  joint: number
}

export type StripDownCell = {
  id: StageId
  /** The section's straight run of pipe. */
  y: number
  height: number
  left: number
  right: number
}

export type StripDownLayout = {
  width: number
  height: number
  points: string
  cells: StripDownCell[]
}

const r1 = (n: number): number => Math.round(n * 10) / 10

/** The pipe as one outline running down, and each section's straight run, for an SVG `box.pipe` wide. */
export function layoutFlowStripDown(
  sections: ReadonlyArray<Pick<StripSection, 'id' | 'thick'>>,
  box: StripDownBox,
): StripDownLayout {
  const n = Math.max(1, sections.length)
  const cx = box.pipe / 2
  const cells = sections.map((s, i): StripDownCell => {
    const y0 = i * box.row + (i > 0 ? box.joint / 2 : 0)
    const y1 = (i + 1) * box.row - (i < n - 1 ? box.joint / 2 : 0)
    const half = (s.thick * box.pipe) / 2
    return {
      id: s.id,
      y: r1(y0),
      height: r1(y1 - y0),
      left: r1(cx - half),
      right: r1(cx + half),
    }
  })
  const rightSide = cells.flatMap((c) => [
    `${c.right},${c.y}`,
    `${c.right},${r1(c.y + c.height)}`,
  ])
  const leftSide = [...cells]
    .reverse()
    .flatMap((c) => [`${c.left},${r1(c.y + c.height)}`, `${c.left},${c.y}`])
  return {
    width: box.pipe,
    height: n * box.row,
    points: [...rightSide, ...leftSide].join(' '),
    cells,
  }
}

export type StripDownLines = {
  /** "Bill", or "Bill, the narrowest step" on the lit one. */
  title: string
  /** "billed $19k a week", or "not read yet". */
  pace: string
  /** "7 weeks wait"; empty when under a week or no pile. */
  weeks: string
}

// ── each row's direction (punch list #321, PR 1) ───────────────────────────

/**
 * Which way the work in front of a step is heading, said under its weeks: the pile grows when more comes in a week
 * than goes out, shrinks when the step clears more than it is fed, and keeps up when the two are close. Market and
 * Sales hold no pile, so their line reads their pace against the field's: so many dollars a week short of it, or
 * ahead of it. Every number is one the cards behind The flow already hold (`StageFlowInput`). The lit step is the
 * rule's (`buildStageFlow` in `stageFlow.ts`, copied to the edge functions): since PR 2 the narrowest step. A pace is
 * what happened, not what a step could do, so a starved step reads narrow too; the direction of its pile is how the
 * two are told apart.
 */
export type StripDirectionTone = 'grows' | 'shrinks' | 'keeps' | 'short' | 'ahead'
export type StripDirection = { text: string; tone: StripDirectionTone }

/** Two paces within this share of the larger read as keeping up, so a wobble does not read as a trend. */
export const DIRECTION_KEEPS_MARGIN = 0.05

const aWeek = (usd: number): string => `${stageUsd(Math.abs(usd))} a week`
const closeEnough = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(a, b) * DIRECTION_KEEPS_MARGIN
const KEEPS_UP: StripDirection = { text: 'Keeps up.', tone: 'keeps' }

/** A pile step's direction: what comes in a week less what goes out. Null when neither pace reads. */
export function pileDirection(stage: Pick<PileStageInput, 'pileUsd' | 'inPerWeekUsd' | 'outPerWeekUsd'>): StripDirection | null {
  const inUsd = Number.isFinite(stage.inPerWeekUsd) ? Math.max(0, stage.inPerWeekUsd) : 0
  const outUsd = Number.isFinite(stage.outPerWeekUsd) ? Math.max(0, stage.outPerWeekUsd) : 0
  if (!(inUsd > 0) && !(outUsd > 0)) return null
  if (closeEnough(inUsd, outUsd)) return KEEPS_UP
  const diff = inUsd - outUsd
  if (diff > 0) return { text: `Grows ${aWeek(diff)}.`, tone: 'grows' }
  // Clearing more than comes in with nothing waiting is keeping up, not a pile shrinking.
  if (!(stage.pileUsd > 0)) return KEEPS_UP
  return { text: `Shrinks ${aWeek(diff)}.`, tone: 'shrinks' }
}

/** A feeder's direction: its pace against the field's. Null until both read. */
export function feederDirection(perWeekUsd: number | null, fieldPerWeekUsd: number | null): StripDirection | null {
  if (perWeekUsd == null || fieldPerWeekUsd == null || !Number.isFinite(perWeekUsd) || !Number.isFinite(fieldPerWeekUsd) || !(fieldPerWeekUsd > 0)) return null
  const pace = Math.max(0, perWeekUsd)
  if (closeEnough(pace, fieldPerWeekUsd)) return { text: 'Keeps up with the field.', tone: 'keeps' }
  const gap = fieldPerWeekUsd - pace
  return gap > 0 ? { text: `${aWeek(gap)} short of the field.`, tone: 'short' } : { text: `${aWeek(gap)} ahead of the field.`, tone: 'ahead' }
}

/**
 * Every row's direction from the input the page already builds for `buildStageFlow`. Market's comes only once its
 * worth is read, since the dollars bid are not on the field's scale. A step that does not read has no line.
 */
export function stripDownDirections(input: StageFlowInput): Partial<Record<StageId, StripDirection>> {
  const out: Partial<Record<StageId, StripDirection>> = {}
  const market = feederDirection(marketWorthPerWeek(input.market), input.fieldPerWeekUsd)
  if (market) out.market = market
  const sales = feederDirection(input.sales?.soldPerWeekUsd ?? null, input.fieldPerWeekUsd)
  if (sales) out.sales = sales
  for (const id of ['build', 'bill', 'collect'] as const) {
    const stage = input[id]
    const direction = stage ? pileDirection(stage) : null
    if (direction) out[id] = direction
  }
  return out
}

/** The press's words for a screen reader: the step's own sentence run, its direction, then the door. */
export function stripDownLabel(s: Pick<StripSection, 'label'>, direction: StripDirection | null | undefined): string {
  return [s.label, direction?.text ?? '', 'Open its desk.'].filter(Boolean).join(' ')
}

/** The words beside one section. There is room for a whole phrase here, so the pace reads as one. */
export function stripDownLines(
  s: Pick<StripSection, 'id' | 'name' | 'paceUsd' | 'weeksText' | 'lit'>,
): StripDownLines {
  return {
    title: s.lit ? `${s.name}, the narrowest step` : s.name,
    pace: s.paceUsd != null ? `${STRIP_DOWN_VERB[s.id] ?? STRIP_PACE_VERB[s.id]} ${stageUsd(s.paceUsd)} a week` : 'not read yet',
    weeks: s.weeksText,
  }
}

/**
 * The pipe with Market drawn at what it is worth, the asks read through their won rates, in place of the raw
 * dollars asked. Every section is sized again against the new widest, by the strip's own rule (the bore's area:
 * four times the dollars is twice the width, never thinner than `STRIP_MIN_THICK`). Market's words for a screen
 * reader say the same amount the eye reads. The lit section and the bars are the page's reading and do not move.
 */
export function withMarketWorth(strip: FlowStrip, marketPerWeekUsd: number | null): FlowStrip {
  if (marketPerWeekUsd == null || !(marketPerWeekUsd > 0)) return strip
  const paceOf = (s: StripSection): number | null => (s.id === 'market' ? marketPerWeekUsd : s.paceUsd)
  const max = Math.max(0, ...strip.sections.map((s) => paceOf(s) ?? 0))
  const sections = strip.sections.map((s): StripSection => {
    const p = paceOf(s)
    const thick = p != null && max > 0 ? STRIP_MIN_THICK + (1 - STRIP_MIN_THICK) * Math.sqrt(p / max) : STRIP_MIN_THICK
    if (s.id !== 'market') return { ...s, thick }
    const usd = stageUsd(marketPerWeekUsd)
    return { ...s, paceUsd: p, paceText: `${usd} worth`, thick, label: [`${s.name}.`, `Worth ${usd} a week.`, s.lit ? 'The narrowest step.' : ''].filter(Boolean).join(' ') }
  })
  return { ...strip, sections }
}

/** The press under the pipe that opens the working behind Market's amount. */
export const STRIP_DOWN_MARKET_PRESS = "How Market's figure is counted"

/** The word the estimates' working opens on (`estimateWins.ts`), after the bids' lines. */
const ESTIMATES_LEAD = 'Estimates:'

/**
 * Market's working as blocks to draw with air between them: the bids' lines, then the estimates' lines. The lines
 * come as one list (`buildMarketWorth`), bids first, and the estimates' part opens on its own word. With no such
 * line the working is one block, as written. No line is dropped or reworded.
 */
export function marketDetailBlocks(detail: ReadonlyArray<string>): string[][] {
  const at = detail.findIndex((d) => d.startsWith(ESTIMATES_LEAD))
  if (at <= 0) return detail.length > 0 ? [[...detail]] : []
  return [detail.slice(0, at), detail.slice(at)]
}

/**
 * Every word the standing pipe prints while its working is closed: the legend, each step's name, pace and weeks,
 * Market's amount with its two parts once that is read, each row's direction when the page hands one, and the press
 * under the pipe. It prints more than the pipe drawn across did (`stripWords`), since each step has a whole row.
 */
export function stripDownWords(strip: FlowStrip, market: { pace: string; parts: ReadonlyArray<string>; perWeekUsd: number | null } | null, directions: Partial<Record<StageId, StripDirection>> = {}): string[] {
  const worth = market != null && market.perWeekUsd != null
  const sized = withMarketWorth(strip, market?.perWeekUsd ?? null)
  return [
    STRIP_DOWN_LEGEND,
    ...sized.sections.flatMap((s) => {
      const lines = stripDownLines(s)
      const direction = directions[s.id]?.text ?? ''
      return s.id === 'market' && worth ? [lines.title, market.pace, ...market.parts, direction] : [lines.title, lines.pace, lines.weeks, direction]
    }),
    worth ? STRIP_DOWN_MARKET_PRESS : '',
  ].filter((w) => w.length > 0)
}
