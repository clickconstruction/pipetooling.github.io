/**
 * The next act on a job's lien path, in a few words a person can do (v2.7043, punch list #325, PR 2).
 *
 * A billed row used to print the deadline's name in bold (*File the lien*) with the desk's real next
 * step in small type under it, so the bold line asked for an act the job was not ready for. This is
 * the one table that turns a To do move on a paper into the words of that act: *Find the owner*,
 * *Draft the affidavit*, *Answer the homestead question*. The Pipeline's dates block prints them as
 * its lien line, with the day the clock gives; `lienArChipFor` carries them on its chip.
 *
 * Each act also carries one plain sentence on where the paper stands, for the row's tip, a second
 * line when the act needs one (who to ask about public property), and whether it has a day to race.
 * A move that is not a step toward a legal day has no act: a reminder (the courtesy notice, the
 * attorney's letter, a promise to record) and an envelope that came back stay the quiet line under
 * the deadline.
 *
 * `lienRowTip` writes the tip from those parts: where the paper stands, the day, the press, and one
 * more sentence only when the day is a guess. Every sentence here is held to `plainWords.ts` by the
 * test beside this file. Pure.
 */
import type { LienAffidavitGateKey } from './lienDeskAffidavits'
import type { LienNextUpAction } from './lienNextUp'

export type LienActPaper = 'notice' | 'affidavit' | 'retainage'

export type LienAct = {
  /** The line's words: "Draft the affidavit". */
  words: string
  /** Where the paper stands, as one or two plain sentences. */
  why: string
  /** False when there is no day to race, because no lien can attach. */
  dated: boolean
  /** A second line the act carries; '' when it has none. */
  under: string
}

export type LienActInput = {
  paper: LienActPaper
  action: LienNextUpAction
  /** The viewer is the leader the paper waits on. */
  yours?: boolean
  /** The leader the paper waits on, by first name; absent reads *the leader*. */
  waitingOn?: string | null
  /** An affidavit's gates still closed (`affidavitGates`), by key. */
  missing?: ReadonlyArray<LienAffidavitGateKey>
}

const act = (words: string, why: string, over: Partial<Pick<LienAct, 'dated' | 'under'>> = {}): LienAct => ({ words, why, dated: true, under: '', ...over })

const PAPER_NAME: Record<LienActPaper, string> = { notice: 'notice', affidavit: 'affidavit', retainage: 'retainage notice' }

/** The affidavit is held by its property facts: the one fact when one is missing, the record when several are. */
function gateAct(missing: ReadonlyArray<LienAffidavitGateKey>): LienAct {
  if (missing.includes('public_owner')) return act('Public property, no lien', 'The owner of record is a public body. No lien attaches to public property.', { dated: false, under: 'Ask the attorney about the bond' })
  if (missing.includes('homestead')) return act('Homestead, ask the attorney', 'The property is marked as a homestead. A lien there needs a contract signed before the work began.')
  const only = missing.length === 1 ? missing[0] : null
  if (only === 'homestead_answer') return act('Answer the homestead question', 'Nobody has answered whether this home is a homestead. The affidavit waits on a yes or a no.')
  if (only === 'contractor') return act('Add the GC’s address', 'The general contractor has no address on file. The affidavit has to give one.')
  if (only === 'owner') return act('Find the owner', 'The affidavit needs the owner of record with a mailing address.')
  if (only === 'legal') return act('Add the legal description', 'The property record has no county and legal description. The affidavit has to give both.')
  if (only === 'notice') return LIEN_LATE_NOTICE_ACT
  return act('Fix the property record', 'The property record is missing facts the affidavit needs.')
}

/** A notice window closed with none sent while the affidavit can still be filed: the late notice (v2.4708's reading). */
export const LIEN_LATE_NOTICE_ACT: LienAct = act('Send the late notice', 'The notice window closed with no notice sent. A late notice can still go while the affidavit can be filed.')

/** The act for one To do move on one paper; null when the move is not a step toward a legal day. */
export function lienActFor(input: LienActInput): LienAct | null {
  const { paper, action } = input
  const name = PAPER_NAME[paper]
  const The = `The ${name}`
  switch (action) {
    case 'find_owner':
      return act('Find the owner', `${The} needs the owner of record first.`)
    case 'draft':
      return act(`Draft the ${name}`, `${The} is not drafted yet.`)
    case 'draft_late':
      return act('Draft the late notice', LIEN_LATE_NOTICE_ACT.why)
    case 'send_notice':
      return LIEN_LATE_NOTICE_ACT
    case 'approve': {
      if (input.yours) return act(`Approve the ${name}`, `${The} is drafted and waits on your approval.`)
      const who = input.waitingOn?.trim() || 'the leader'
      return act(`Waiting on ${who}`, `${The} is drafted and waits on ${who} to approve it.`)
    }
    case 'sign':
      return act(`Sign the ${name}`, `${The} is approved and not signed yet.`)
    case 'confirm_pen':
      return act('Confirm your signature', `${The} was signed for you. It asks you to confirm the signature is yours.`)
    case 'send':
    case 'send_run':
      return act(`Send the ${name}`, `${The} is approved and ready to send.`)
    case 'add_tracking':
    case 'record_mailing':
      return act('Record the mailing', `${The} is printed. Its certified number is not typed in yet.`)
    case 'review_hold':
      return act('Review the hold', `${The} is on hold. The last day does not move while it is held.`)
    case 'fix_property':
      return gateAct(input.missing ?? [])
    case 'file_affidavit':
      return act('File the affidavit', 'The affidavit is approved and ready to file.')
    case 'record_service':
      return act('Serve the affidavit', 'The lien affidavit is on file. A copy goes to the owner and the GC within five days.')
    case 'note_missed':
    case 'letter_two':
    case 'courtesy':
    case 'promise':
    case 'mail_needs_you':
      return null
  }
}

/** The tip's one extra sentence when the clock's day is a guess; '' when the day is firm. */
export function lienDayGuessSentence(f: { kindAssumed: boolean; datedFromCreation: boolean; datedFromBill?: boolean }): string {
  if (f.kindAssumed) return 'The property kind is not set, so the earlier day shows.'
  if (f.datedFromBill) return 'The day counts from the bill, since no hours are on the clock.'
  if (f.datedFromCreation) return 'The day counts from the day the job was made, since no hours are on the clock.'
  return ''
}

export const LIEN_ROW_PRESS_SENTENCE = 'Press to open the Lien window.'

/**
 * A lien row's tip: where the paper stands, the last day, the press, and the guess when there is one.
 * `dayWords` is the day as the row prints it (*Nov 16*); '' leaves the day's sentence out.
 */
export function lienRowTip(f: { why: string; dayWords: string; guess?: string }): string {
  return [f.why, f.dayWords ? `The last day is ${f.dayWords}.` : '', LIEN_ROW_PRESS_SENTENCE, f.guess ?? ''].filter(Boolean).join(' ')
}
