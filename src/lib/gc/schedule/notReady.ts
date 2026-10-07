/**
 * GC mode, the real build, the schedule's PR 1b: a trade's lapsed insurance in words and the hold words,
 * moved word for word from the GC mode prototype (branch spike/gc-mode, `gcNotReady.ts`). The rest of
 * not ready (G-77) reads Start's checklist, the papers and the promises, and waits for them.
 */
import { INSURANCE_ASK_DAYS } from '../promises'
import type { Partner } from '../types'
import { daysUntil, shortDate, weekdayDate } from '../words'

/**
 * A bar starting within this many days with its papers not in is late: the trade's last start
 * reminder has gone (G-114's `START_REMINDER_DAYS`, the last of them). Its own number, not an import:
 * the start reminders read this file's list of papers (G-139), and a constant read across that import
 * cycle is undefined on load. A test holds the two equal.
 */
export const NOT_READY_LATE_DAYS = 3

export type StartGapKind = 'award' | 'msa' | 'insurance' | 'w9' | 'sow'

/** One thing a trade still needs before it starts, in the words each place says it. */
export interface StartGap {
  kind: StartGapKind
  /** Get started's column: "Insurance", "Statement of work". */
  label: string
  /** The opened activity's line: "Insurance ran out Tue Sep 15." */
  line: string
  /** On the bar when it is the only gap, after "waits on": "current insurance, theirs ran out Sep 15". */
  barWords: string
  /** On the bar in a list of several: "current insurance". */
  noun: string
  /** The company window's paper: 'msa', 'insurance', 'w9' or 'sow-<package>'. Null: nothing there to send. */
  doc: string | null
}

/** Insurance read on the day the work starts: none on file, run out, or running out before then once the renewal ask is due. */
function insuranceGap(partner: Partner, on: string, today: string): StartGap | null {
  const expires = partner.coiExpires
  const base = { kind: 'insurance' as const, label: 'Insurance', noun: 'current insurance', doc: 'insurance' }
  if (!expires) return { ...base, line: 'Insurance: none on file.', barWords: 'insurance, none on file' }
  if (expires < today) return { ...base, line: `Insurance ran out ${weekdayDate(expires)}.`, barWords: `current insurance, theirs ran out ${shortDate(expires)}` }
  if (expires < on && daysUntil(expires, today) <= INSURANCE_ASK_DAYS) {
    return { ...base, line: `Insurance runs out ${weekdayDate(expires)}, before this starts.`, barWords: `current insurance, theirs runs out ${shortDate(expires)}` }
  }
  return null
}

/** A typed title's first words that read lowercase inside the merged list. */
const PLAIN_FIRST_WORDS = ['The', 'A', 'An', 'Their', 'Its', 'Our']

/**
 * A hold's words as they read folded into the merged "waits on" list. A wait's title is what the
 * office typed, so it keeps its capitals, except a plain first word: "The transformer, …" reads
 * "the transformer, …". "RFI-004" and "CPS Energy" never change.
 */
export function holdWordsInList(words: string): string {
  const first = words.split(/[\s,]/, 1)[0] ?? ''
  return PLAIN_FIRST_WORDS.includes(first) ? `${words.charAt(0).toLowerCase()}${words.slice(1)}` : words
}

/**
 * A company's insurance on a day when it is not current, in a sentence for its line on the morning
 * list (G-118): "Their insurance ran out Tue Sep 15. Nothing they do for us is covered." G-77's gap,
 * read on that day. Null: current.
 */
export function lapsedInsuranceWords(partner: Partner, day: string): string | null {
  if (!insuranceGap(partner, day, day)) return null
  return partner.coiExpires ? `Their insurance ran out ${weekdayDate(partner.coiExpires)}. Nothing they do for us is covered.` : 'No insurance on file. Nothing they do for us is covered.'
}
