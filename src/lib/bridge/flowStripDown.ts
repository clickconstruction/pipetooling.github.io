import { STRIP_MIN_THICK, STRIP_PACE_VERB, type FlowStrip, type StripSection } from './flowStrip'
import { stageUsd, type StageId } from './stageFlow'

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
  /** "Bill", or "Bill, the slowest step" on the lit one. */
  title: string
  /** "billed $19k a week", or "not read yet". */
  pace: string
  /** "7 weeks wait"; empty when under a week or no pile. */
  weeks: string
}

/** The words beside one section. There is room for a whole phrase here, so the pace reads as one. */
export function stripDownLines(
  s: Pick<StripSection, 'id' | 'name' | 'paceUsd' | 'weeksText' | 'lit'>,
): StripDownLines {
  return {
    title: s.lit ? `${s.name}, the slowest step` : s.name,
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
    return { ...s, paceUsd: p, paceText: `${usd} worth`, thick, label: [`${s.name}.`, `Worth ${usd} a week.`, s.lit ? 'The slowest step.' : ''].filter(Boolean).join(' ') }
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
 * Market's amount with its two parts once that is read, and the press under the pipe. It prints more than the pipe
 * drawn across did (`stripWords`), since each step has a whole row.
 */
export function stripDownWords(strip: FlowStrip, market: { pace: string; parts: ReadonlyArray<string>; perWeekUsd: number | null } | null): string[] {
  const worth = market != null && market.perWeekUsd != null
  const sized = withMarketWorth(strip, market?.perWeekUsd ?? null)
  return [
    STRIP_DOWN_LEGEND,
    ...sized.sections.flatMap((s) => {
      const lines = stripDownLines(s)
      return s.id === 'market' && worth ? [lines.title, market.pace, ...market.parts] : [lines.title, lines.pace, lines.weeks]
    }),
    worth ? STRIP_DOWN_MARKET_PRESS : '',
  ].filter((w) => w.length > 0)
}
