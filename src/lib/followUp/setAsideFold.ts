/**
 * Punch list #223 PR 4 (v2.6231): the notices the reader set aside this week, folded under New with a count and
 * **Put back** on each (`email_set_aside`, written by `gmail-sync`; `email_put_back` marks one for the next read).
 * The fold's count is the measure of how much the office no longer reads. Pure.
 */
import { whenWords } from '../messages/thread'

export interface SetAsideRow {
  id: string
  mailbox: string | null
  from_address: string
  from_name: string | null
  subject: string | null
  at: string
  reason: string
}

/** How far back the fold reads. */
export const SET_ASIDE_DAYS = 7

export const PUT_BACK = 'Put back'

/** What Put back says once it lands. */
export const PUT_BACK_WORDS = 'Put back. The next read takes it, within a few minutes.'

/** Why the reader set each aside, for the row's hover. */
export const SET_ASIDE_WHY: Readonly<Record<string, string>> = {
  marked_address: 'The address is marked a notice.',
  marked_domain: 'Everything from the company is marked a notice.',
  body_cue: 'The mail says unsubscribe at its foot.',
}

/** "3 notices set aside this week", "1 notice set aside this week". */
export function setAsideTitle(count: number): string {
  return `${count} ${count === 1 ? 'notice' : 'notices'} set aside this week`
}

export interface SetAsideLine {
  id: string
  /** The sender's name, else the address. */
  who: string
  subject: string
  when: string
  why: string
}

/** The fold's rows, newest first. */
export function setAsideLines(rows: readonly SetAsideRow[], nowIso: string): SetAsideLine[] {
  return [...rows]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((r) => ({
      id: r.id,
      who: r.from_name?.trim() || r.from_address,
      subject: r.subject?.trim() || 'No subject',
      when: whenWords(r.at, nowIso),
      why: SET_ASIDE_WHY[r.reason] ?? 'The reader set it aside.',
    }))
}
