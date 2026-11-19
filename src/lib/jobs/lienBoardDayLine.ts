/**
 * The door on the day tile's red line (the owner's pick of 2026-11-18, the last pieces of punch list #383's drawing).
 *
 * The first tile's line reads one of two ways (`lienBoard.ts`, `tiles`): *3 will not make Monday as they stand.*
 * while a paper is at risk, and otherwise *6 are past their day.* while a paper is late. The first has been a press
 * since v2.7371, an underlined sentence. The second was words alone, so the six late papers had no way to be listed.
 *
 * Both now read the same: the red sentence, then *Show them ›* in the link colour. The press narrows the list under
 * the Board to the papers the line counts, and a second press puts the list back. Here: the door's words, and the
 * late papers as a pick, by the one rule the tile counts them with (`lienBoardChipLate`). Pure.
 */
import { lienBoardChipLate, lienBoardLatePhrase, type LienBoard, type LienBoardPick } from './lienBoard'

/** The door's words on the red line, with no arrow: the view adds *›*. */
export const LIEN_BOARD_DAY_LINE_DOOR = 'Show them'

/** What follows *Showing N rows* under the late pick: every row shown holds at least one late paper. */
export const LIEN_BOARD_LATE_PICK_WORDS = 'with a paper past its day'

/**
 * The papers past their day as a pick, with no bin lit: what a press on *N are past their day. Show them ›* narrows
 * the list to. A run row is in when it holds one of the late notices, as under the at-risk pick.
 */
export function lienBoardLatePick(board: Pick<LienBoard, 'notices' | 'affidavits'>): LienBoardPick {
  const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips).filter(lienBoardChipLate)
  const phrase = lienBoardLatePhrase(chips.length)
  return {
    bins: [],
    label: phrase,
    jobIds: new Set(chips.map((c) => c.jobId)),
    gcIds: new Set(chips.filter((c) => c.kind === 'notice').map((c) => c.gcId).filter((g): g is string => Boolean(g))),
    count: chips.length,
    papers: new Set(chips.map((c) => `${c.kind}:${c.jobId}`)),
    // No verb to agree with the rows: a run row can hold several late notices, so *1 row that are past* would read wrong.
    words: LIEN_BOARD_LATE_PICK_WORDS,
  }
}
