/**
 * An owner is calling (v2.4731, the owner's ask: *separate the search from the practice call
 * area*): the ☎ button on the Lien desk stops being a search and becomes the words. It opens
 * with counsel's opening line and the six things owners say, filled with the facts of the job
 * under the reader when there is one, readable without one. The search is the list's find box
 * (v2.4721), which reaches every notice the desk ever sent. Pure: the generic facts, the
 * openings with their next lines, the letter's one-line summary.
 */
import { CALL_OPENINGS, EMPTY_CALL_STATE, callCard, callJump, type CallFmt, type CallLetterFacts, type CallOpening } from './lienOwnerCallScript'

export const CALL_SCRIPT_TITLE = 'An owner is calling'
export const CALL_SCRIPT_NO_JOB_WORDS = 'Pick the job on the desk and the facts fill in: the amount, the months, the day it mailed, the codes.'
export const CALL_SCRIPT_NO_LETTER_WORDS = 'Nothing has been mailed on this job yet, so the caller is not holding a notice from us about it.'

/** The facts the script reads with no job under the reader: counsel's words still stand, with the blanks said plainly. */
export function genericCallFacts(us: string): CallLetterFacts {
  return {
    jobLabel: '',
    property: 'your property',
    ownerName: '',
    gcName: 'your builder',
    us: us.trim() || 'us',
    instrument: 'notice_53_056',
    letterKind: 'commercial',
    mailedOn: '',
    amount: 'the amount on the letter',
    months: '',
    signer: 'the plumber who signed it',
    phone: '',
    affidavitBy: '',
  }
}

export type CallScriptOpening = {
  key: CallOpening
  /** "Paid my builder" — the chip. */
  chip: string
  /** "“I already paid RMC — everything.”" — in the owner's words. */
  words: string
  /** Counsel's next line, from the call sheet's own card. */
  say: string
  cites: string
}

/** Counsel's opening line for the first card. */
export function callScriptOpeningLine(f: CallLetterFacts, fmt: CallFmt): string {
  return callCard(f, EMPTY_CALL_STATE, fmt).say
}

/** The six things owners say, each with the line that answers it. */
export function callScriptOpenings(f: CallLetterFacts, fmt: CallFmt): CallScriptOpening[] {
  return CALL_OPENINGS.map((o) => {
    const card = callCard(f, callJump(EMPTY_CALL_STATE, o.key), fmt)
    return { key: o.key, chip: o.chip, words: o.words(f.gcName), say: card.say, cites: card.cites }
  })
}

/** "mailed Sep 8 · claims $17,585.00 · for April, June, July and August 2026 · affidavit by Nov 16" — the letter in their hand. */
export function callScriptLetterLine(f: CallLetterFacts, fmt: CallFmt): string {
  const parts = [
    f.mailedOn ? `mailed ${fmt.day(f.mailedOn)}` : 'not mailed yet',
    f.amount ? `claims ${f.amount}` : '',
    f.months ? `for ${f.months}` : f.instrument === 'retainage_53_057' ? 'retainage' : '',
    f.affidavitBy ? `affidavit by ${fmt.day(f.affidavitBy)}` : '',
  ]
  return parts.filter(Boolean).join(' · ')
}
