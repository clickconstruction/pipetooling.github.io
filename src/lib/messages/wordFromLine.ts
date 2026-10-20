/**
 * The word from the thread (punch list #129, v2.5649): under a customer's line in Messages, the office or the job's
 * people write down the customer's word on paying, a day they will pay by or that they say they paid, and the word
 * lands on a job. Which job: the one the line is tied to, when it is one of theirs; else the customer's one job with
 * money open; else the person picks among those with money open; with none, the words say so. The sheet takes how
 * the line came (a call is by phone) and who the line is from. Pure: the read (`wordFromLineIo.ts`) hands in the
 * customer's jobs as money lines (`bidMoneyLine.ts`), under `is_job_people`.
 */
import type { PromiseChannel } from '../jobs/paymentPromises'
import type { BidMoneyLine } from '../bids/bidMoneyLine'

/** The channels a customer's own word comes on. A note or an event is ours. */
const THEIR_CHANNELS: ReadonlySet<string> = new Set(['call', 'voicemail', 'missed', 'text', 'email'])

/** A line the press draws under: theirs, on a channel they speak on. */
export function lineTakesWord(m: { direction: string; channel: string }, c: { kind: string }): boolean {
  return c.kind === 'customer' && m.direction === 'in' && THEIR_CHANNELS.has(m.channel)
}

/** The sheet's channel for the line's. */
export function wordChannel(channel: string): PromiseChannel {
  if (channel === 'text') return 'text'
  if (channel === 'email') return 'email'
  return 'phone'
}

export type WordLanding =
  /** One job: the sheet opens on it. */
  | { kind: 'job'; line: BidMoneyLine; why: 'tied' | 'only' }
  /** Several jobs with money open: the person picks. */
  | { kind: 'pick'; lines: BidMoneyLine[] }
  /** Nothing to land on. */
  | { kind: 'none'; words: string }

export const NO_JOB_WORDS = 'They have no bill open on a job of yours. Write it on the job once one is billed.'
export const NO_STANDING_WORDS = 'None of their jobs is yours to write on.'

/** Where the word lands. */
export function wordLanding(lines: readonly BidMoneyLine[], tiedJobId: string | null): WordLanding {
  if (lines.length === 0) return { kind: 'none', words: NO_STANDING_WORDS }
  const tied = tiedJobId ? lines.find((l) => l.job.id === tiedJobId) : null
  if (tied) return { kind: 'job', line: tied, why: 'tied' }
  const open = lines.filter((l) => l.open != null && l.open > 0)
  if (open.length === 1) return { kind: 'job', line: open[0]!, why: 'only' }
  if (open.length > 1) return { kind: 'pick', lines: open }
  return { kind: 'none', words: NO_JOB_WORDS }
}

/** "#1032 · Whitfield repipe", the sheet's label and the picker's row. */
export function jobLabelOf(line: BidMoneyLine): string {
  return `${line.job.number ? `#${line.job.number} · ` : ''}${line.job.name || 'Job'}`
}

export const WORD_PRESS = 'Write down their word'
export const WORD_PICK_WORDS = 'Which job is it about?'
