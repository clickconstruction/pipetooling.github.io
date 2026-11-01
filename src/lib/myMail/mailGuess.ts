/**
 * Messages → My email (punch list #230 PR 1): the job the app guesses for a mail in a person's own box. The tab draws
 * the guess with a **Yes**; the app never tags on a guess alone. The order, the card's own (`to-dos/messages-my-email`,
 * option 3):
 *
 * 1. A tagged conversation is no guess: its mail lands by itself, and the function sets the row's `tagged` instead.
 * 2. The subject names a job by its number as the app shows it, or by its whole name among the other party's own jobs:
 *    the bids@ reader's own rule, `jobInSubject` over `subjectJobs` (each one's `mine` says the other party is on it).
 * 3. The other party's address is on one contact with exactly one starred job, else exactly one open job.
 * 4. The address's domain, never an open mail service's (`OPEN_MAIL_DOMAINS`), is a customer's with exactly one open job.
 *
 * Two candidates at one step name none, and the next step is tried. The facts are a plain object the function fills
 * from the database; nothing here reads it. Pure.
 */
import { jobInSubject, type SubjectJob } from '../emailIn/jobInSubject'
import { domainOf, OPEN_MAIL_DOMAINS } from '../emailIn/leftOutSenders'
import { jobRefOf } from '../messages/jobKeys'
import { MY_MAIL_NO_SUBJECT, type MyMailJobChip, type MyMailParty, type MyMailRow } from './contract'

/** What the function knows of a mail's job, for the guess. */
export interface MyMailGuessFacts {
  /** The jobs the subject may name (`subjectJobs`: the jobs its numbers find and the other party's own, `mine` on theirs). */
  subjectJobs: readonly SubjectJob[]
  /** The jobs of the one contact the other party's address lands on: each with its star and whether it is open. */
  partyJobs: readonly { chip: MyMailJobChip; star: boolean; open: boolean }[]
  /** The open jobs of the customers whose addresses share the other party's domain, each with the customer's name. */
  domainJobs: readonly { chip: MyMailJobChip; customer: string }[]
  /** The job the conversation is tagged onto (`email_tag_threads`), or null. */
  taggedJob: MyMailJobChip | null
}

/** A guess: the job's chip and why the app thinks so, in words the row draws. */
export type MyMailGuess = MyMailJobChip & { why: string }

/** The one chip among these, by key, or null when there are none or more than one. */
function onlyOne(chips: readonly MyMailJobChip[]): MyMailJobChip | null {
  const byKey = new Map(chips.map((c) => [c.key, c]))
  return byKey.size === 1 ? ([...byKey.values()][0] ?? null) : null
}

/** A subject job as a chip: its kind and id from its key, its first number, its name. Null for a key that is not a job's. */
function chipOf(job: SubjectJob): MyMailJobChip | null {
  const ref = jobRefOf(job.key)
  if (!ref) return null
  const num = job.labels.map((l) => l.trim()).find((l) => l !== '') ?? ''
  return { ...ref, key: job.key, num, name: job.name.trim() }
}

/** Step 2: the job the subject names, and what in the subject named it (the number standing in it, else the name). */
function bySubject(subject: string, jobs: readonly SubjectJob[]): MyMailGuess | null {
  if (subject === MY_MAIL_NO_SUBJECT) return null
  const key = jobInSubject(subject, jobs)
  const job = key ? jobs.find((j) => j.key === key) : undefined
  const chip = job ? chipOf(job) : null
  if (!job || !chip) return null
  const named = job.labels.map((l) => l.trim()).find((l) => l !== '' && jobInSubject(subject, [{ key: job.key, labels: [l], name: '', mine: true }]) === job.key)
  return { ...chip, why: `the subject names ${named ?? chip.name}` }
}

/** Step 3: the other party's one starred job, else their one open job. */
function byParty(who: MyMailParty, jobs: MyMailGuessFacts['partyJobs']): MyMailGuess | null {
  const pick = onlyOne(jobs.filter((j) => j.star).map((j) => j.chip)) ?? onlyOne(jobs.filter((j) => j.open).map((j) => j.chip))
  return pick ? { ...pick, why: `${who.name || who.address} is on this job` } : null
}

/** Step 4: the one open job of the customer whose domain the address is on, never an open mail service's. */
function byDomain(address: string, jobs: MyMailGuessFacts['domainJobs']): MyMailGuess | null {
  const domain = domainOf(address)
  if (!domain || OPEN_MAIL_DOMAINS.has(domain)) return null
  const pick = onlyOne(jobs.map((j) => j.chip))
  const customer = pick ? jobs.find((j) => j.chip.key === pick.key)?.customer.trim() : ''
  return pick && customer ? { ...pick, why: `${domain} is ${customer}` } : null
}

/** The app's guess at a mail's job, in the documented order, or null: no guess, and the row offers **Tag…**. */
export function guessJob(row: Pick<MyMailRow, 'subject' | 'who'>, facts: MyMailGuessFacts): MyMailGuess | null {
  if (facts.taggedJob) return null
  return bySubject(row.subject, facts.subjectJobs) ?? byParty(row.who, facts.partyJobs) ?? byDomain(row.who.address, facts.domainJobs)
}
