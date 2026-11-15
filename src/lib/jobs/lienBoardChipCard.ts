/**
 * What a chip on the Lien desk's Board says when it is pointed at (v2.7381; Taunya's ask of 2026-11-15: before the
 * press takes her somewhere, see the job's name, its address, its customer and where it stands).
 *
 * A chip is a job's number, and its press is a zoom to the right place for its stage. The number alone does not say
 * which job it is. The card answers that before the press: the job, where it is, whose it is, then the paper's
 * status in the Board's own words (the column, the bin, the one thing to know, its day, whether it will make it,
 * what the job still owes), the job's other paper when it has one on the Board, and where the press goes.
 *
 * Pure: the words from the chip and the facts the desk already holds, and where the card stands beside the chip.
 * Nothing here reads or writes.
 */
import { formatUsdNoCents } from './jobFormatting'
import { lienMonthDayWords } from './lienMonthLine'
import { lienDayLeftWords } from './lienRowWords'
import { lienBoardDoorWords, lienBoardWorkingDaysLeft, type LienBoard, type LienBoardChip, type LienBoardKind, type LienBoardUrgency } from './lienBoard'

export type LienBoardChipFacts = {
  todayYmd: string
  jobName: string | null | undefined
  address: string | null | undefined
  customer: string | null | undefined
  /** The job's general contractor, by name; left out when it is the customer. */
  gc: string | null | undefined
  /** The one thing to know about this paper, as its To do row says it (`LienNextUpRow.detail`, else its `sub`). */
  detail?: string | null
}

export type LienBoardChipCard = {
  /** The job's number and name. */
  title: string
  /** Where the job is; null when the job has no address. */
  address: string | null
  customer: string | null
  gc: string | null
  /** The paper the chip stands for: *Monthly notice* or *Lien affidavit*. */
  paper: string
  /** The bin it stands in, by the bin's name. */
  stage: string
  detail: string | null
  /** *Due Mon Nov 16 · 1 day left*; null for a paper with no day of its own. */
  day: string | null
  urgency: LienBoardUrgency
  /** Why it will not make its day, when it will not. */
  risk: string | null
  /** *$5,402 unpaid*; null when nothing is open. */
  owes: string | null
  /** The job's other paper on the Board, in a sentence; null when it has none. */
  other: string | null
  /** Where the press goes. */
  door: string
}

const PAPER: Record<LienBoardKind, string> = { notice: 'Monthly notice', affidavit: 'Lien affidavit' }

const clean = (s: string | null | undefined) => (s ?? '').trim()

function binLabel(board: Pick<LienBoard, 'notices' | 'affidavits'>, chip: Pick<LienBoardChip, 'bin'>): string {
  return [...board.notices, ...board.affidavits].find((b) => b.key === chip.bin)?.label ?? ''
}

export function lienBoardChipCard(chip: LienBoardChip, board: Pick<LienBoard, 'notices' | 'affidavits'>, facts: LienBoardChipFacts): LienBoardChipCard {
  const jobName = clean(facts.jobName)
  const customer = clean(facts.customer)
  const gc = clean(facts.gc)
  const detail = clean(facts.detail)
  const done = chip.stage === 'sent' || chip.stage === 'filed'
  const day = chip.dueYmd && !done ? `${chip.daysLeft != null && chip.daysLeft < 0 ? 'Was due' : 'Due'} ${lienMonthDayWords(chip.dueYmd)}${chip.daysLeft == null ? '' : ` · ${lienDayLeftWords(chip.daysLeft)}`}` : null
  const working = chip.dueYmd ? lienBoardWorkingDaysLeft(facts.todayYmd, chip.dueYmd) : 0
  const risk = chip.atRisk ? `Will not make its day as it stands. ${chip.stepsLeft} ${chip.stepsLeft === 1 ? 'stage' : 'stages'} left and ${working} working ${working === 1 ? 'day' : 'days'}.` : null
  // The job's other paper: the chip of the same job in the other column.
  const otherKind: LienBoardKind = chip.kind === 'notice' ? 'affidavit' : 'notice'
  const otherChip = (otherKind === 'notice' ? board.notices : board.affidavits).flatMap((b) => b.chips).find((c) => c.jobId === chip.jobId) ?? null
  const otherStage = otherChip ? binLabel(board, otherChip) : ''
  const door = lienBoardDoorWords(chip.destination)
  return {
    title: jobName ? `${chip.label} · ${jobName}` : chip.label,
    address: clean(facts.address) || null,
    customer: customer || null,
    gc: gc && gc.toLowerCase() !== customer.toLowerCase() ? gc : null,
    paper: PAPER[chip.kind],
    stage: binLabel(board, chip),
    detail: detail || null,
    day,
    urgency: chip.urgency,
    risk,
    owes: chip.openBalance > 0 ? `${formatUsdNoCents(chip.openBalance)} unpaid` : null,
    other: otherChip && otherStage ? `Its ${PAPER[otherKind].toLowerCase()} is in ${otherStage}.` : null,
    door: `Press to ${door.charAt(0).toLowerCase()}${door.slice(1)}.`,
  }
}

/** The card's width on the Board, in px. */
export const LIEN_BOARD_CARD_WIDTH_PX = 320
/** What the card is taken to stand tall when deciding whether it fits under the chip. */
export const LIEN_BOARD_CARD_HEIGHT_PX = 230

export type LienBoardCardPlace = { left: number; top: number; above: boolean }

/**
 * Where the card stands, in the Board's own box: under the chip and flush with its left edge, held inside the
 * Board's width; over the chip when there is not room under it on the screen. `chip` is the chip's box measured from
 * the Board's top-left corner; `roomBelow` is the screen left under the chip.
 */
export function lienBoardCardPlace(at: { chip: { left: number; top: number; width: number; height: number }; hostWidth: number; roomBelow: number; cardWidth?: number; cardHeight?: number }): LienBoardCardPlace {
  const width = at.cardWidth ?? LIEN_BOARD_CARD_WIDTH_PX
  const height = at.cardHeight ?? LIEN_BOARD_CARD_HEIGHT_PX
  const gap = 6
  const left = Math.round(Math.max(0, Math.min(at.chip.left, at.hostWidth - width)))
  const above = at.roomBelow < height + gap && at.chip.top > height + gap
  return { left, top: Math.round(above ? at.chip.top - gap : at.chip.top + at.chip.height + gap), above }
}
