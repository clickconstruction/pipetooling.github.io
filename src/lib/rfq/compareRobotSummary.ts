/**
 * What the compare grid says about the robot's work (Price Matrix PR 4 —
 * docs/PRICE_MATRIX_PLAN.md). Pure derivations over `buildQuoteComparison`
 * rows: how many rows the robot picked and the estimator kept, how many she
 * changed, which rows still need a choice (an option group with nothing
 * chosen) and which cells are incomplete kits — the numbers the banner, the
 * footer and the Settle strip read.
 */

import type { CompareRow, CompareRowCell } from './quoteCompare'
import type { KitOption } from './quoteKits'

export type RowSettle = {
  fixture: string
  /** Houses whose cell waits on a choice, with the options. */
  choices: Array<{ houseId: string; group: string; options: KitOption[]; minCents: number | null; maxCents: number | null }>
}

export type RobotSummary = {
  /** Rows whose current pick the robot made. */
  robotPicked: number
  /** Rows the estimator picked (or repicked) herself. */
  humanPicked: number
  /** Rows where a robot reason exists on a cell that is no longer the pick — she overruled it. */
  humanChanged: number
  /** Rows with an option group nobody has chosen from yet. */
  needsChoice: RowSettle[]
  /** Cells the kernel called incomplete (a role some house priced that this house did not). */
  incompleteCells: number
  /** True when any line on the grid came with a robot reason — the Robot column shows. */
  hasRobotWork: boolean
}

export function summarizeRobotWork(rows: ReadonlyArray<CompareRow>): RobotSummary {
  let robotPicked = 0
  let humanPicked = 0
  let humanChanged = 0
  let incompleteCells = 0
  let hasRobotWork = false
  const needsChoice: RowSettle[] = []
  for (const r of rows) {
    const cells = Object.entries(r.perHouse)
    const picked = cells.find(([, c]) => c.picked)
    const robotReasonElsewhere = cells.some(([, c]) => !c.picked && c.pickReason && c.pickSource !== 'human')
    if (picked) {
      if (picked[1].pickSource === 'robot') robotPicked += 1
      else {
        humanPicked += 1
        if (robotReasonElsewhere) humanChanged += 1
      }
    }
    if (cells.some(([, c]) => c.pickReason || c.pickSource === 'robot')) hasRobotWork = true
    const choices: RowSettle['choices'] = []
    for (const [houseId, c] of cells) {
      if (c.kit?.incomplete) incompleteCells += 1
      if (c.kit?.needsChoice) {
        choices.push({ houseId, group: c.kit.needsChoice.group, options: c.kit.needsChoice.options, minCents: c.kit.needsChoice.minCents, maxCents: c.kit.needsChoice.maxCents })
      }
    }
    if (choices.length) needsChoice.push({ fixture: r.fixture, choices })
  }
  return { robotPicked, humanPicked, humanChanged, needsChoice, incompleteCells, hasRobotWork }
}

/** The one-line reason the Robot column shows for a row: the pick's reason, or that she overruled the robot. */
export function robotColumnText(row: CompareRow): string | null {
  const cells = Object.values(row.perHouse)
  const picked = cells.find((c) => c.picked)
  if (picked?.pickSource === 'robot' && picked.pickReason) return picked.pickReason
  if (picked?.pickSource === 'human') {
    const robotReason = cells.find((c) => !c.picked && c.pickReason)?.pickReason
    return robotReason ? `you changed this · robot had: ${robotReason}` : null
  }
  if (!picked) {
    const anyChoice = cells.find((c) => c.kit?.needsChoice)
    if (anyChoice) return 'needs your choice'
    const anyIncomplete = cells.every((c) => c.kit?.incomplete || c.cantSupply)
    if (cells.length && anyIncomplete) return 'no complete kit quoted'
  }
  return null
}

/** "$124.55 – $271.14" for an option range; a single price when min = max. */
export function describeChoiceRange(minCents: number | null, maxCents: number | null, money: (c: number) => string): string {
  if (minCents == null) return 'no prices'
  if (maxCents == null || maxCents === minCents) return money(minCents)
  return `${money(minCents)} – ${money(maxCents)}`
}

/** Missing-role words for an incomplete cell: "missing carrier", "missing carrier, seat". */
export function describeIncomplete(cell: CompareRowCell, roleLabel: (role: string) => string): string {
  const roles = cell.kit?.missingRoles ?? []
  if (roles.length === 0) return 'incomplete'
  return `missing ${roles.map(roleLabel).join(', ')}`
}
