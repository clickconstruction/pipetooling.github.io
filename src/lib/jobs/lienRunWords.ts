/**
 * One name for each step between a lien notice's approval and its mailing (v2.7448, the owner's ask of 2026-11-16).
 *
 * Taunya picked the words in v2.7434 and v2.7442: an approved notice is *Approved · to print* until the packet prints
 * and *Approved · to mail* until its mail numbers are typed in; the press that does the first is *Print and mail* and
 * the press that does the second is *Enter mail numbers*. Until this kernel the same step read four ways on one
 * screen: the Board's bin *Approved · to mail*, its tile *in the run*, the pile head's *Send the run* and the title
 * bar's *The run · 15 to print*. Every place a person reads the step or its press now takes the words from here: the
 * Board's two bins and the tile over them, By paper's piles, the title bar's door, the footers, the window's title,
 * By date, the mark cards and the step cards.
 *
 * The window the presses open is still the run in prose (a guide, a hint). It has no label of that name. Inside it
 * the two literal acts keep their own words: *Print the packet* and *Record the mailing*.
 *
 * Pure. The keys stay the desk's: the piles are `ready` and `printed`, the To do actions `send`, `send_run` and
 * `record_mailing`.
 */

/** The two steps, as By paper's piles and the Board's bins name them. */
export const LIEN_RUN_STEP = {
  /** Approved, the packet not printed yet: the `ready` pile. */
  toPrint: 'Approved · to print',
  /** Printed, its mail numbers not typed in yet: the `printed` pile. */
  toMail: 'Approved · to mail',
} as const

/** The two presses, by what the person does at the counter. */
export const LIEN_RUN_ACT = {
  /** Opens the window on the packet to print. */
  print: 'Print and mail',
  /** Opens the window on the mail numbers still owed. */
  record: 'Enter mail numbers',
} as const

export type LienRunAct = keyof typeof LIEN_RUN_ACT

/** Which press the notices call for: print while any approved one is unprinted, else the mail numbers. */
export function lienRunActFor(counts: { toPrint: number; printed: number }): LienRunAct {
  return counts.toPrint === 0 && counts.printed > 0 ? 'record' : 'print'
}

/**
 * A press with its count: *Print and mail 15*, as Taunya wrote it, and *Enter mail numbers · 4*, where a bare figure
 * after *numbers* would read as one of them. No count, or zero, reads the bare act.
 */
export function lienRunActLabel(act: LienRunAct, count?: number | null): string {
  if (!count || count <= 0) return LIEN_RUN_ACT[act]
  return act === 'print' ? `${LIEN_RUN_ACT.print} ${count}` : `${LIEN_RUN_ACT.record} · ${count}`
}

/** The window's title: the act it is open on and how many notices it holds. *Print and mail · 6 notices*. */
export function lienRunWindowTitle(act: LienRunAct, notices: number): string {
  return `${LIEN_RUN_ACT[act]} · ${notices} ${notices === 1 ? 'notice' : 'notices'}`
}

/**
 * What the run window holds, said in its head (v2.7489, the office's two reports of 2026-11-16). She counted a
 * property's invoices, then its lien affidavits, against an envelope of the notices' run, and each time the envelope
 * was right: the run holds the notices approved and not yet mailed, and nothing on the screen said so. `line` names
 * the paper and the stage, `not` what is not here, and `more` (behind the ?) where the affidavits print and when
 * their copies go out.
 */
export function lienRunWhatWords(kinds: { monthly: number; retainage: number }): { line: string; not: string; more: string } {
  const paper = kinds.retainage > 0 && kinds.monthly > 0 ? 'Monthly notices (§ 53.056) and retainage notices (§ 53.057)' : kinds.retainage > 0 ? 'Retainage notices (§ 53.057)' : 'Monthly notices (§ 53.056)'
  return {
    line: `${paper}, approved and not yet mailed.`,
    not: 'A job whose notice already went is not here. Lien affidavits are not here either.',
    more: 'Lien affidavits print from the Board, with Print N for notarization. Their copies to the owner and the original contractor go out after the filing.',
  }
}

/**
 * Where a notice stands once it is approved, as a sentence for a toast or a line under a press. A sentence says the
 * step in plain words, since the pile's name carries a dot (`plainWords.ts` reads a dot as glue inside a sentence).
 */
export const LIEN_RUN_NOW_TO_PRINT = 'It now waits to print.'
/** The same for a retainage notice, which has no print pile of its own: it goes out with the monthly notices. */
export const LIEN_RUN_NOW_TO_MAIL = 'It now waits to mail.'
/** After a press that has not happened yet: *Your typed name goes on it. It then waits to print.* */
export const LIEN_RUN_THEN_TO_PRINT = 'It then waits to print.'
export const LIEN_RUN_THEN_TO_MAIL = 'It then waits to mail.'
