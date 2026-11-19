/**
 * Voiding a filed lien affidavit puts its paper back (v2.7892, the owner's pick of 2026-11-18).
 *
 * Recording a filed affidavit marks the job's affidavit paper on the Lien desk as sent and ties it to the filing.
 * Until this version Void only voided the filing: the paper stayed sent and tied to a voided record, so the Board
 * read the lien as **Served** with no lien on file. The database now moves the paper in the same step as the void
 * (`20261119020000_lien_void_puts_paper_back.sql`): back to approved when it carries an approval, which stands as it
 * was, else back to the office's draft, and set aside when a newer paper is already on the job.
 *
 * The client writes nothing to the paper. It reads the papers tied to the filing before the void and reads them again
 * after it, and this file turns the two reads into what the person is told. So the words are what happened, on a
 * database that has the trigger and on one that does not have it yet.
 *
 * A § 53.056 notice since v2.7911 (`20261119050000_lien_void_puts_notice_back.sql`, the owner's pick of 2026-11-19):
 * voiding a notice's record puts the notice back the same way, signed and printed as it was. Until then its paper
 * stayed sent, the desk asked for a new draft while the month was open, and the attorney's letter clock kept running
 * on a notice that was not on record.
 */

/** The records whose void puts a desk paper back: a filed affidavit and a § 53.056 notice. */
export const LIEN_VOID_PAPER_KINDS: ReadonlyArray<string> = ['affidavit', 'notice_53_056']

/** True for a record that has a paper on the desk to put back. */
export function lienVoidHasPaper(kind: string | null | undefined): boolean {
  return LIEN_VOID_PAPER_KINDS.includes(kind ?? '')
}

/** A desk paper as the two reads see it. */
export type LienVoidPaperRow = { id: string; status: string | null; voided_at: string | null }

/**
 * What the void did to the lien's paper:
 *  - `approved`: back on the desk with its approval, so the Board shows it to file (or in its hold);
 *  - `drafted`: back on the desk as the office's draft, since nobody had approved it;
 *  - `set_aside`: a newer paper is on the job, so the old one was set aside and the newer one stands;
 *  - `still_sent`: the paper still reads as filed, so the database did not move it;
 *  - `none`: no paper was tied to the filing, or the reads did not answer.
 */
export type LienVoidPaperOutcome = 'approved' | 'drafted' | 'set_aside' | 'still_sent' | 'none'

/** The outcome, from the ids of the papers that were sent and tied to the filing before the void and their rows after it. */
export function lienVoidPaperOutcome(tiedBefore: ReadonlyArray<string>, after: ReadonlyArray<LienVoidPaperRow>): LienVoidPaperOutcome {
  const tied = new Set(tiedBefore)
  const rows = after.filter((r) => tied.has(r.id))
  if (rows.length === 0) return 'none'
  const live = rows.filter((r) => !r.voided_at)
  // A paper left sent is the one thing the person has to hear, whatever happened to another.
  if (live.some((r) => r.status === 'sent')) return 'still_sent'
  if (live.some((r) => r.status === 'approved')) return 'approved'
  if (live.some((r) => r.status === 'drafted')) return 'drafted'
  return live.length === 0 ? 'set_aside' : 'none'
}

const TAIL: Record<LienVoidPaperOutcome, string> = {
  approved: 'The lien’s paper is approved again and back on the Lien desk.',
  drafted: 'The lien’s paper is back on the Lien desk as a draft.',
  set_aside: 'A newer paper for this lien is on the Lien desk, so the old one is set aside.',
  still_sent: 'Its paper still reads as filed on the Lien desk. Tell your lead.',
  none: '',
}

/** The same five answers for a notice, which is sent where a lien is filed. */
const NOTICE_TAIL: Record<LienVoidPaperOutcome, string> = {
  approved: 'The notice is approved again and back on the Lien desk.',
  drafted: 'The notice is back on the Lien desk as a draft.',
  set_aside: 'A newer notice for this job is on the Lien desk, so the old one is set aside.',
  still_sent: 'The notice still reads as sent on the Lien desk. Tell your lead.',
  none: '',
}

/** What the Lien window says after Void: *Record voided.* and where the paper went. `kind` is the voided record's. */
export function lienVoidPaperWords(outcome: LienVoidPaperOutcome, kind: string = 'affidavit'): string {
  return ['Record voided.', (kind === 'notice_53_056' ? NOTICE_TAIL : TAIL)[outcome]].filter(Boolean).join(' ')
}

/** True when the words are a warning: the filing is voided and its paper did not move. */
export function lienVoidPaperStuck(outcome: LienVoidPaperOutcome): boolean {
  return outcome === 'still_sent'
}

/** The words of **Back from the clerk**'s take-back, on the line and its two presses. */
export const LIEN_TAKE_BACK_WORDS = {
  press: 'Take it back',
  confirm: 'Confirm take back',
  keep: 'Keep it',
  hint: 'Recorded by mistake? This voids the filing and puts the lien back in Ready to file.',
  taking: 'Taking it back…',
} as const

/** What a line says once its filing is taken back. The line is open again, so the right number can be typed. */
export function lienTakenBackWords(outcome: LienVoidPaperOutcome): string {
  if (outcome === 'approved') return 'Taken back. The filing is voided and the lien is in Ready to file again.'
  return ['Taken back. The filing is voided.', TAIL[outcome]].filter(Boolean).join(' ')
}

/** Why a take-back did not land. */
export function lienNotTakenBackWords(reason: string): string {
  return `Not taken back: ${reason.replace(/[.\s]+$/, '')}. The lien is still on record as filed.`
}
