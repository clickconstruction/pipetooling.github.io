/**
 * Punch list #140 PR 6: **Answer all**, the desk behind Needs a reply's header, built like Sort all (`sortDesk.ts`). It
 * walks the lane one person at a time with nothing else on the screen: the person, their last words, their job, the
 * reply box with the step's quick replies, Send text… / Send email…, No reply needed, Skip for now, Call. A send or a
 * No reply needed moves on; the end says what went and offers the quiet ones (Waiting on them's first row, with PR 4's
 * nudge). This is the words and the step; the screen is `components/followUp/AnswerAllDesk.tsx`. Pure.
 *
 * The desk pins the person up: `deskStep` would pick the first unskipped on every render, and a live re-read of the
 * lane can reorder it under a half-typed draft. The card moves only on a send, a No reply needed or a Skip; when the
 * pinned person leaves the lane some other way (someone else answered them, or marked it), the desk says so and offers
 * Next rather than swapping the card.
 */
import type { Contact } from '../contacts/kernel'
import { canSend, replyRecipient } from '../messages/compose'
import { deskStep, skipOne } from './sortDesk'

/** The press on Needs a reply's header, and the desk's title. */
export const ANSWER_ALL = 'Answer all'

/**
 * A link that opens Messages with the Answer all desk (v2.5816, Quickfill's Texts station): `?answer=all`. The page
 * reads it once, as the desk's opening state, and takes it off the address when the desk closes, so a reload after
 * closing does not reopen it.
 */
export const ANSWER_ALL_PARAM = 'answer'

export function answerAllHref(): string {
  return `/messages?${ANSWER_ALL_PARAM}=all`
}

export function answerAllAsked(search: URLSearchParams): boolean {
  return search.get(ANSWER_ALL_PARAM) === 'all'
}

export function withoutAnswerAll(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(search)
  next.delete(ANSWER_ALL_PARAM)
  return next
}
/** The press shows from one person: unlike a sort, an answer is the desk's whole point, and the box is right there. */
export const ANSWER_ALL_MIN = 1
export const ANSWER_LANE = 'Needs a reply'
export const ANSWER_SKIP = 'Skip for now'
export const ANSWER_NO_REPLY = 'No reply needed'
export const ANSWER_CALL = 'Call'
export const ANSWER_OPEN_THREAD = 'Open the thread'
export const ANSWER_NEXT = 'Next'
export const ANSWER_READING = { thread: 'Reading the thread…', person: 'Reading their numbers…', failed: 'Their record could not be read. Answer them from their thread.' } as const
/** A portal-only customer, or a number that sent STOP with no email: the box would only refuse, so the thread is the door. */
export const ANSWER_NO_WAY = 'They have no number and no email on file. Answer them from their thread.'
export const ANSWER_DONE = {
  title: 'All answered.',
  note: 'Nobody is waiting on us.',
  back: 'Back to Follow up',
  quiet: (n: number) => (n === 1 ? '1 person went quiet on us after our last word.' : `${n} people went quiet on us after our last word.`),
  nudgeFirst: 'Nudge the first',
} as const

export function canAnswerAll(laneLength: number): boolean {
  return laneLength >= ANSWER_ALL_MIN
}

/** What went while the desk was open. */
export interface AnswerTally {
  texts: number
  emails: number
  /** A call the box logged (PR 7's Call kind): the office spoke to them, so it answers like a send. */
  calls: number
  notes: number
  noReply: number
  skipped: number
}

export const EMPTY_TALLY: AnswerTally = { texts: 0, emails: 0, calls: 0, notes: 0, noReply: 0, skipped: 0 }

export function countOne(t: AnswerTally, key: keyof AnswerTally): AnswerTally {
  return { ...t, [key]: t[key] + 1 }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "2 texts, 1 email, 1 call and 1 no reply needed went. 1 skipped." / "Nothing went." */
export function tallyWords(t: AnswerTally): string {
  const parts = [
    t.texts ? plural(t.texts, 'text', 'texts') : null,
    t.emails ? plural(t.emails, 'email', 'emails') : null,
    t.calls ? plural(t.calls, 'call', 'calls') : null,
    t.notes ? plural(t.notes, 'note', 'notes') : null,
    t.noReply ? `${t.noReply} no reply needed` : null,
  ].filter((p): p is string => p !== null)
  const went = parts.length === 0 ? 'Nothing went.' : parts.length === 1 ? `${parts[0]} went.` : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} went.`
  return t.skipped ? `${went} ${t.skipped} skipped.` : went
}

/** "Needs a reply", "3 to answer", "2 of 4": parts the desk lays out side by side, as Sort all does. */
export function answerProgress(left: number, of: number): string[] {
  return [ANSWER_LANE, `${left} to answer`, `${Math.max(of, left) - left + 1} of ${Math.max(of, left)}`]
}

export const ANSWER_GONE = (name: string) => `${name} is no longer in Needs a reply.`

/** Where the desk stands: whose card is up, or whose card just left the lane, the progress in parts, and how many wait. */
export interface AnswerStep {
  /** The contact whose card is up. Null: the lane is empty, or the pinned person left it. */
  current: string | null
  /** The pinned person who left the lane while their card was up; the desk says so and offers Next. */
  gone: string | null
  progress: string[]
  more: string | null
}

/**
 * The desk's step over the lane as it stands now. `pinned` is the person whose card is up; the card stays theirs while
 * they are in the lane. With nobody pinned the first unskipped person is up (`deskStep`'s pick). `total` is how many
 * were waiting when the desk opened; it grows if more came in since.
 */
export function answerStep(lane: readonly { contactId: string }[], skipped: ReadonlySet<string>, pinned: string | null, total: number): AnswerStep {
  const left = lane.length
  if (left === 0) return { current: null, gone: null, progress: [], more: null }
  const progress = answerProgress(left, total)
  const more = left > 1 ? `${left - 1} more after this` : 'The last one'
  if (pinned && lane.some((r) => r.contactId === pinned)) return { current: pinned, gone: null, progress, more }
  if (pinned) return { current: null, gone: pinned, progress, more }
  return { current: deskStep(lane, skipped, total).current, gone: null, progress, more }
}

/** *Skip for now*, as Sort all has it: the person goes after the rest; once every person left was skipped, the walk starts over. */
export const skipAnswer = skipOne

/** Whether the box can reach them at all: a number that can take a text, or an email. */
export function reachable(c: Pick<Contact, 'name' | 'channels'>): boolean {
  const to = replyRecipient(c)
  return canSend('text', to) || canSend('email', to)
}
