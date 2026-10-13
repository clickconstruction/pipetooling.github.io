/**
 * Messages, the promise write-throughs (helper 4, after cut 2's C3): where a written promise also goes, through main's
 * own writes, never a new table. C3 writes the promise first (`write_down` on `message_promises`) and it stays
 * written. This file says what else the same press writes, and for each write it skips, why and what to do by hand.
 * A write that is refused names its place and its words, and nothing rolls back. A day heard only in words writes
 * nothing past the line. Pure: the IO finds what `PromiseAt` holds and makes the writes in order.
 *
 * Where each kind goes (the lead, 2026-10-12):
 *  - quote: the company's ask on the Board, a line of its story with the promised day (`logGcAskContact`).
 *  - start or delivery, insurance or a W-9: the Board's promises (`gc_record_promise`).
 *  - payment: the Pipeline's payment promise (`add_job_payment_promise`), and a hold on the flow's Pay application.
 *    The Pipeline keeps the money's record, the hold keeps the chase quiet.
 *  - decision: the bid's follow-up day (a `bids_submission_entries` note). On a GC job, a hold on the flow's Said yes.
 *  - access: a hold on the flow's On site, until schedule PR 10 opens the schedule and its waits gain `access`.
 *  - answer: a hold on the architect flow's Questions. cert: a hold on its Certify pay apps.
 * A hold is set only for a day after today, and never earlier than one already standing on the step.
 */
import { followupEntryColumns, withFollowupSentence, type FollowupChangeEntry } from '../bids/bidNextFollowup'
import { dayLabel } from './owed'
import { promiseChoices, type HeardPromiseKind, type PromiseChoice, type PromisePerson, type PromiseTarget } from './promises'

/** A promise C3 wrote: `message_promises` in state written. */
export type WrittenPromise = {
  kind: HeardPromiseKind
  /** The day as a date, YYYY-MM-DD; null when it was heard only in words. */
  dayYmd: string | null
  /** The words heard, when there was no date. */
  dayWords?: string | null
  /** For a double kind, the one written: start or delivery, insurance or w9. */
  writes?: 'start' | 'delivery' | 'insurance' | 'w9' | null
}

/** Everything else a write-through reads. The IO finds each piece, and null means there is none. */
export type PromiseAt = {
  line: {
    /** `messages.channel`: call, voicemail, missed, text, email, note, event or portal. */
    channel: string
    /** The line's day in the app's zone, YYYY-MM-DD. */
    onYmd: string
    bidId: string | null
    projectId: string | null
    /** The job's name, for the words. */
    jobName: string | null
  }
  /** Who said it, as `promiseChoices` reads them, with their ids. */
  person: PromisePerson & { contactId: string; companyId: string | null }
  /** The company's open ask on the line's job, for a quote. */
  askInviteId: string | null
  /** The job's bill on the Pipeline (`gc_projects.billing_job_id`), for a payment. */
  billingJobId: string | null
  /** Each standing hold's day (`nudge_holds` not let go), by `${stepId}|${jobId}`. */
  holds: Readonly<Partial<Record<string, string>>>
  todayYmd: string
  nowIso: string
  /** Who wrote it down. `moneyTeam`: they may write a payment promise (`can_write_payment_promises`). */
  by: { userId: string; name: string; moneyTeam: boolean }
}

/** One write, in the exact arguments of the verb that makes it. */
export type PromiseWrite =
  /** `logGcAskContact`: a line of the ask's story with the promised day. */
  | { kind: 'askDay'; companyId: string; inviteId: string; on: string; how: 'call' | 'text' | 'email'; note: string; promisedBy: string }
  /** `recordGcTradePromise` (`gc_record_promise`), from the office. */
  | { kind: 'tradePromise'; companyId: string; promise: 'start' | 'delivery' | 'insurance' | 'w9'; projectId: string | null; dueOn: string; what: string }
  /** `recordGcPromise` (`add_job_payment_promise`) on the job's bill. */
  | { kind: 'payment'; jobId: string; date: string; note: string; channel: 'phone' | 'text' | 'email' | null }
  /** A `bids_submission_entries` note: the follow-up day, with no contact, so the bid's last contact stays. */
  | { kind: 'bidFollowup'; entry: FollowupChangeEntry }
  /** `flowPresses.holdUntil` (`nudge_hold_until`) on a GC job's step. */
  | { kind: 'hold'; contactId: string; stepId: string; jobId: string; until: string }

export type PromiseWriteThrough = {
  target: PromiseTarget
  /** Made in order. The first refused stops the rest, and its words come back with its place. */
  writes: PromiseWrite[]
  /** Each write not made: why, then what to do by hand. */
  skips: string[]
}

/** Each write's place, as a refusal names it. */
export function writePlace(write: PromiseWrite): string {
  switch (write.kind) {
    case 'askDay':
      return 'Their ask on the Board'
    case 'tradePromise':
      return 'The Board'
    case 'payment':
      return 'The Pipeline'
    case 'bidFollowup':
      return 'The bid'
    case 'hold':
      return 'The flow'
  }
}

/** What the office reads when a write-through is refused: the promise stays written. */
export function refusedWords(write: PromiseWrite, words: string): string {
  const said = words.trim().replace(/[.!]?$/, '.')
  return `Written down. ${writePlace(write)} did not take it. ${said}`
}

/** The flow step each hold keeps quiet, by kind. */
const HOLD_STEP: Partial<Record<HeardPromiseKind, string>> = { payment: 'payapp', decision: 'yes', access: 'onsite', answer: 'questions', cert: 'certify' }

/** Where a kind goes, for the words when nothing can go there. */
const PLACE: Readonly<Record<PromiseTarget, string>> = {
  boardAsk: 'their ask on the Board',
  tradePromise: 'the Board',
  paymentPromise: 'the Pipeline',
  bidFollowUp: 'the bid',
  scheduleWait: 'the flow',
  planQuestion: 'the flow',
  payAppCertificate: 'the flow',
}

/** How a line was said, for its notes. */
function saidOn(channel: string): string {
  if (channel === 'voicemail') return 'in a voicemail'
  if (channel === 'text') return 'in a text'
  if (channel === 'email') return 'in an email'
  if (channel === 'call' || channel === 'missed') return 'on a call'
  return 'to us'
}

/** The ask's story takes a call, a text or an email. */
function askHow(channel: string): 'call' | 'text' | 'email' | null {
  if (channel === 'call' || channel === 'voicemail' || channel === 'missed') return 'call'
  if (channel === 'text' || channel === 'email') return channel
  return null
}

/** The Pipeline's channels for the same three. */
function payChannel(channel: string): 'phone' | 'text' | 'email' | null {
  const how = askHow(channel)
  return how === 'call' ? 'phone' : how
}

const ONE_OF: Readonly<Record<string, string>> = { start: 'start', delivery: 'delivery', insurance: 'insurance', w9: 'W-9' }

/** What was promised, in C3's own words: a double kind names the one written. */
function whatOf(choice: PromiseChoice, writes: WrittenPromise['writes']): string {
  const one = writes ? ONE_OF[writes] : null
  return one ? choice.what.replace(/start or delivery|insurance or W-9/, one) : choice.what
}

/** "Hillside’s" or "Elena’s", for the words about a company or a person. */
function whose(person: PromisePerson): string {
  return person.company?.trim() || person.goesBy?.trim() || person.name.trim().split(/\s+/)[0] || 'They'
}

/** Where a written promise also goes, or why it does not. */
export function promiseWriteThrough(p: WrittenPromise, at: PromiseAt): PromiseWriteThrough {
  const choice = promiseChoices(at.person, at.line.jobName).find((c) => c.kind === p.kind)
  const target: PromiseTarget = choice?.target ?? 'boardAsk'
  const out: PromiseWriteThrough = { target, writes: [], skips: [] }
  const place = PLACE[target]
  if (!choice) {
    out.skips.push(`This is not a promise ${whose(at.person)} makes. Nothing else was written.`)
    return out
  }
  const day = p.dayYmd
  if (!day) {
    out.skips.push(`No date was heard, so nothing went to ${place}. Add it there once they give a day.`)
    return out
  }
  // A double kind names the one written; C3 always says which, and the first is its default (the lead, 2026-10-12).
  const writes = p.writes ?? (p.kind === 'start' ? 'start' : p.kind === 'papers' ? 'insurance' : null)
  const what = whatOf(choice, writes)
  const words = dayLabel(day)
  const note = `Said ${saidOn(at.line.channel)}: ${what} by ${words}.`
  const job = at.line.projectId
  const noJob = `The line is on no job. Tie it to a job, then add the day on ${place}.`
  const noCompany = `They are not tied to a company yet. Name their company, then add the day on the Board.`

  /** A hold on a GC job's step: only for a day after today, never earlier than one already standing. */
  const hold = (stepId: string) => {
    if (!job) return void out.skips.push(`The line is on no job, so the reminder was not held. Tie it to a job first.`)
    if (day <= at.todayYmd) return void out.skips.push(`${words} is not after today, so the reminder was not held.`)
    const standing = at.holds[`${stepId}|${job}`]
    if (standing && standing >= day) return void out.skips.push(`The reminder is already held until ${dayLabel(standing)}, so it stays.`)
    out.writes.push({ kind: 'hold', contactId: at.person.contactId, stepId, jobId: job, until: day })
  }

  switch (p.kind) {
    case 'quote': {
      const how = askHow(at.line.channel)
      if (!at.person.companyId) out.skips.push(noCompany)
      else if (!job) out.skips.push(noJob)
      else if (!at.askInviteId) out.skips.push(`No open ask for ${whose(at.person)} on this job. Ask them from the Board.`)
      else if (!how) out.skips.push(`This line is not a call, a text or an email. Log the day on their ask by hand.`)
      else out.writes.push({ kind: 'askDay', companyId: at.person.companyId, inviteId: at.askInviteId, on: at.line.onYmd, how, note, promisedBy: day })
      return out
    }
    case 'start':
    case 'papers': {
      const promise = writes ?? 'start'
      const perJob = promise === 'start' || promise === 'delivery'
      if (!at.person.companyId) out.skips.push(noCompany)
      else if (perJob && !job) out.skips.push(noJob)
      else out.writes.push({ kind: 'tradePromise', companyId: at.person.companyId, promise, projectId: perJob ? job : null, dueOn: day, what })
      return out
    }
    case 'payment': {
      if (!job) out.skips.push(noJob)
      else if (!at.by.moneyTeam) out.skips.push(`Only the money team writes a payment promise. Ask one of them to add it on the Pipeline.`)
      else if (!at.billingJobId) out.skips.push(`This job has no bill on the Pipeline yet. Add the promise there once it has one.`)
      else out.writes.push({ kind: 'payment', jobId: at.billingJobId, date: day, note, channel: payChannel(at.line.channel) })
      if (job) hold(HOLD_STEP.payment!)
      return out
    }
    case 'decision': {
      const bid = at.line.bidId
      if (bid) {
        const pick = { ymd: day, personId: null, personName: at.person.name, reason: 'owner_deciding' as const }
        out.writes.push({
          kind: 'bidFollowup',
          entry: {
            bid_id: bid,
            gc_customer_id: null,
            contact_method: null,
            notes: withFollowupSentence(note, pick, at.todayYmd),
            occurred_at: at.nowIso,
            created_by: at.by.userId,
            ...followupEntryColumns(pick),
            next_followup_cleared: false,
          },
        })
      } else if (job) hold(HOLD_STEP.decision!)
      else out.skips.push(`The line is on no bid or job. Tie it to the bid, then set its follow-up day.`)
      return out
    }
    case 'access':
    case 'answer':
    case 'cert':
      hold(HOLD_STEP[p.kind]!)
      return out
  }
}

/** Each write in main's own verbs. The press supplies them. */
export type PromiseWriters = {
  [K in PromiseWrite['kind']]: (write: Extract<PromiseWrite, { kind: K }>) => Promise<unknown>
}

/**
 * Make the writes in order. The first that is refused stops the rest, and its words come back with its place. The
 * writes before it stand, as the promise does.
 */
export async function runPromiseWrites(
  writes: readonly PromiseWrite[],
  to: PromiseWriters,
  wordsOf: (error: unknown) => string,
): Promise<{ made: PromiseWrite[]; refused: string | null }> {
  const made: PromiseWrite[] = []
  for (const w of writes) {
    try {
      await (to[w.kind] as (write: PromiseWrite) => Promise<unknown>)(w)
      made.push(w)
    } catch (e) {
      return { made, refused: refusedWords(w, wordsOf(e)) }
    }
  }
  return { made, refused: null }
}
