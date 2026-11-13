/**
 * Mail we already have, onto its jobs (punch list #332): the rule that says which job a conversation in a person's own
 * mailbox belongs to, for a run that files old mail for the record (`for_record`, v2.7032). The office's mail about a
 * job sits in a dozen mailboxes, and a count of 2026-11-13 found only 8 of 120 open jobs with an outside address tied
 * to them in Messages, so the match comes from the customer's record and from the mail's own words.
 *
 * Three answers, each with its reason, and the run files only the first:
 *
 * - **sure**: a subject names the job (`jobInSubject`, the reader's own rule); or the words name the job's street and
 *   the other party is the job's customer, its GC or a person at either; or an address on a customer's own record is
 *   on the mail, that customer has exactly one job the mail's date covers, and it has no bid or project the mail
 *   could be about instead.
 * - **held**, for a person to place: the party's customers have several jobs and the mail names none; the mail names
 *   two jobs, or a street that several jobs share (one house, a job a phase); the street matches and the other party
 *   is nobody the job knows; only someone else at the customer's
 *   company is on the mail; the customer also has a bid or a project; or one job would take more conversations by
 *   the one-job rule than a person could check (`holdCrowdedJobs`). The first count of 2026-11-13 put 456 of 586 sure
 *   conversations on three jobs by that rule alone, which is what these three holds are for.
 * - **out**, counted and never filed: nobody outside the company is on it; an address or a domain on the never-tag
 *   list is on it; every mail sits under a label Gmail or the tag leaves out; no job can be told; the mail is older
 *   than the only job it could be; or the job it names is not one this run files onto.
 *
 * A wrong job is worse than no record, because people will trust it: nothing here guesses. Pure. The run is
 * `scripts/mail-backfill.ts`; the runbook is `docs/MAIL_BACKFILL.md`.
 */
import { jobInSubject, type SubjectJob } from '../emailIn/jobInSubject'
import { domainOf, OPEN_MAIL_DOMAINS } from '../emailIn/leftOutSenders'

/** A mail more than this many days older than a job is not that job's (the card's call 5). */
export const BACKFILL_FENCE_DAYS = 90

/** A job the rule may name: a Pipeline job with what a mail could say of it. */
export interface BackfillJob {
  /** `pipeline:<id>`, as `messages/jobKeys.ts` writes it. */
  key: string
  /** Its numbers as the app shows them (`emailIn/subjectJobs.ts`). */
  labels: readonly string[]
  name: string
  /** The job's address as kept: "4 Elm Ct, Austin, TX". */
  address: string | null
  /** The customer and the GC, when it has them. */
  customerIds: readonly string[]
  /** When the job began (`created_at`), ISO. */
  startsAt: string | null
}

/** A customer with every address its record and its people hold, lower case. */
export interface BackfillCustomer {
  id: string
  addresses: readonly string[]
}

/** One mail of a conversation, as a search hit gives it. */
export interface BackfillMail {
  from: string
  to: readonly string[]
  cc: readonly string[]
  subject: string
  snippet: string
  date: string | null
  labels: readonly string[]
}

export interface BackfillConversation {
  /** The mailbox it was found in. */
  account: string
  threadId: string
  mails: readonly BackfillMail[]
  /**
   * The jobs whose street a search of the mailbox found in this conversation, the mail's whole words included. A hit
   * carries only its subject and first words, so a street named further down is known by the search that found it.
   */
  streetJobs?: readonly string[]
}

export interface AddressSet {
  addresses: ReadonlySet<string>
  domains: ReadonlySet<string>
}

export interface BackfillFacts {
  /** Every job of the customers in play, whatever its status: the one-job rule counts them all. */
  jobs: readonly BackfillJob[]
  /** The jobs this run files onto. A sure match to any other is counted and left for its own run. */
  targets: ReadonlySet<string>
  customers: readonly BackfillCustomer[]
  /** The company's own logins, boxes and domains. */
  ours: AddressSet
  /** The customers who also have a bid or a GC project: a mail of theirs that names no job may be about that. */
  busyCustomers?: ReadonlySet<string>
  /** Never filed, whatever the mail says: attorneys, the accountant, payroll, the bank, and what the office adds. */
  neverTag: AddressSet
  fenceDays?: number
}

export type BackfillRule = 'subject' | 'street' | 'onlyJob'
export type BackfillHeld = 'severalJobs' | 'twoJobsNamed' | 'sameStreet' | 'streetUnknownParty' | 'companyOnly' | 'alsoBids' | 'crowdedJob'
export type BackfillOut = 'noOutsideParty' | 'neverTag' | 'leftOutLabel' | 'noJob' | 'beforeTheJob' | 'notThisRun'

export type BackfillVerdict =
  | { kind: 'sure'; jobKey: string; rule: BackfillRule; why: string }
  | { kind: 'held'; reason: BackfillHeld; jobKeys: string[]; why: string }
  | { kind: 'out'; reason: BackfillOut; why: string; jobKey?: string }

export const BACKFILL_WORDS: Readonly<Record<BackfillRule | BackfillHeld | BackfillOut, string>> = {
  subject: 'A subject names the job.',
  street: 'The mail names the job’s street, and the other party is on the job.',
  onlyJob: 'An address on the customer’s record is on the mail, and the customer has one job the mail’s date covers.',
  severalJobs: 'The other party’s customer has several jobs, and the mail names none.',
  twoJobsNamed: 'The mail names two jobs.',
  sameStreet: 'The mail names a street that several jobs share.',
  streetUnknownParty: 'The mail names the job’s street, and nobody on the job is on the mail.',
  companyOnly: 'Someone at the customer’s company is on the mail, and nobody on the customer’s record.',
  alsoBids: 'The customer also has a bid or a project, and the mail names no job.',
  crowdedJob: 'One job would take more conversations by the one-job rule than a person could check.',
  noOutsideParty: 'Nobody outside the company is on the conversation.',
  neverTag: 'An address on the never-tag list is on the conversation.',
  leftOutLabel: 'Every mail sits under a label that is never filed.',
  noJob: 'No job can be told from the people or the words.',
  beforeTheJob: 'The mail is older than the only job it could belong to.',
  notThisRun: 'The job it names is not one this run files onto.',
}

/** Gmail's own labels a filing never takes: bulk mail, and what the tag itself skips. */
export const BACKFILL_LEFT_OUT_LABELS: ReadonlySet<string> = new Set(['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'SPAM', 'TRASH', 'DRAFT', 'CHAT'])

const clean = (address: string | null | undefined): string => {
  const a = (address ?? '').trim().toLowerCase()
  const m = /<([^<>]+)>\s*$/.exec(a)
  return (m ? m[1]! : a).trim()
}

const inSet = (address: string, set: AddressSet): boolean => set.addresses.has(address) || set.domains.has(domainOf(address))

/** An address list from the office's own words: one address or `@domain` a line, `#` starting a comment. */
export function parseAddressList(text: string): AddressSet {
  const addresses = new Set<string>()
  const domains = new Set<string>()
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim().toLowerCase()
    if (!line) continue
    if (line.startsWith('@')) domains.add(line.slice(1))
    else if (line.includes('@')) addresses.add(line)
    else domains.add(line)
  }
  return { addresses, domains }
}

// ---------- the street ----------

export interface Street {
  /** The house number: "4", "5501", "12925". */
  number: string
  /** The first word of the street's name, or a route with its number: "Elm", "Balcones", "FM 20". */
  name: string
}

const DIRECTIONS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west'])
const ROUTES = new Set(['fm', 'cr', 'sh', 'rr', 'rm', 'ih', 'us', 'hwy', 'highway', 'loop', 'county', 'ranch', 'farm', 'interstate', 'state'])
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The street an address names, as a mail would write it: the number and the first word of the name, a leading
 * direction dropped, a numbered route kept with its number. Null for an address with no house number, or a name too
 * short to stand for a street.
 */
export function streetOf(address: string | null | undefined): Street | null {
  const head = (address ?? '').split(',')[0]!.trim()
  const m = /^(\d+[A-Za-z]?)\s+(.+)$/.exec(head)
  if (!m) return null
  let words = m[2]!.split(/\s+/).filter(Boolean)
  if (words.length > 1 && DIRECTIONS.has(words[0]!.replace(/\./g, '').toLowerCase())) words = words.slice(1)
  const first = words[0]
  if (!first) return null
  const route = ROUTES.has(first.replace(/\./g, '').toLowerCase()) && /^\d/.test(words[1] ?? '')
  const name = route ? `${first} ${words[1]}` : first
  if (!route && !/\d/.test(name) && name.replace(/[^A-Za-z]/g, '').length < 3) return null
  return { number: m[1]!, name }
}

/** Whether the words name the street: its number, an optional direction, then its name, each standing alone. */
export function namesStreet(text: string, street: Street): boolean {
  const name = street.name.split(/\s+/).map(esc).join('[\\s.]+')
  const re = new RegExp(`(?:^|[^A-Za-z0-9])${esc(street.number)}\\s+(?:(?:n|s|e|w|ne|nw|se|sw|north|south|east|west)\\.?\\s+)?${name}(?![A-Za-z0-9])`, 'i')
  return re.test(text)
}

// ---------- the verdict ----------

const DAY_MS = 86_400_000

/** The conversation's newest mail, in milliseconds; null when no mail has a date. */
function newestMs(conversation: BackfillConversation): number | null {
  const times = conversation.mails.map((m) => (m.date ? Date.parse(m.date) : NaN)).filter(Number.isFinite)
  return times.length ? Math.max(...times) : null
}

/** Whether a job's dates cover the conversation: its newest mail is no more than the fence older than the job. */
function covers(job: BackfillJob, newest: number | null, fenceDays: number): boolean {
  if (newest === null || !job.startsAt) return true
  const starts = Date.parse(job.startsAt)
  return !Number.isFinite(starts) || newest >= starts - fenceDays * DAY_MS
}

const out = (reason: BackfillOut, jobKey?: string): BackfillVerdict => ({ kind: 'out', reason, why: BACKFILL_WORDS[reason], ...(jobKey ? { jobKey } : {}) })
const held = (reason: BackfillHeld, jobKeys: Iterable<string>): BackfillVerdict => ({ kind: 'held', reason, jobKeys: [...new Set(jobKeys)].sort(), why: BACKFILL_WORDS[reason] })

/** Which job a conversation belongs to, or why a person must place it, or why it is left out. */
export function backfillVerdict(conversation: BackfillConversation, facts: BackfillFacts): BackfillVerdict {
  const fence = facts.fenceDays ?? BACKFILL_FENCE_DAYS
  const outside = new Set<string>()
  for (const m of conversation.mails) for (const a of [m.from, ...m.to, ...m.cc]) if (clean(a) && !inSet(clean(a), facts.ours)) outside.add(clean(a))
  if (outside.size === 0) return out('noOutsideParty')
  if ([...outside].some((a) => inSet(a, facts.neverTag))) return out('neverTag')
  if (conversation.mails.every((m) => m.labels.some((l) => BACKFILL_LEFT_OUT_LABELS.has(l)))) return out('leftOutLabel')

  // The customers the other party is: by an address on the record, or by a company's own domain.
  const outsideDomains = new Set([...outside].map(domainOf).filter((d) => d && !OPEN_MAIL_DOMAINS.has(d)))
  const byAddress = new Set(facts.customers.filter((c) => c.addresses.some((a) => outside.has(clean(a)))).map((c) => c.id))
  const partyCustomers = new Set(
    facts.customers.filter((c) => byAddress.has(c.id) || c.addresses.some((a) => outsideDomains.has(domainOf(clean(a))))).map((c) => c.id),
  )
  const partyJobs = facts.jobs.filter((j) => j.customerIds.some((id) => partyCustomers.has(id)))
  const partyKeys = new Set(partyJobs.map((j) => j.key))
  const newest = newestMs(conversation)
  const sure = (jobKey: string, rule: BackfillRule): BackfillVerdict =>
    facts.targets.has(jobKey) ? { kind: 'sure', jobKey, rule, why: BACKFILL_WORDS[rule] } : out('notThisRun', jobKey)

  // 1. A subject names a job, by the reader's own rule.
  const subjectJobs: SubjectJob[] = facts.jobs.map((j) => ({ key: j.key, labels: j.labels, name: j.name, mine: partyKeys.has(j.key) }))
  const bySubject = new Set<string>()
  for (const m of conversation.mails) {
    const key = jobInSubject(m.subject, subjectJobs)
    if (key) bySubject.add(key)
  }

  // 2. The words name a job's street. Two jobs at one street are told apart by their dates.
  const text = conversation.mails.map((m) => `${m.subject}\n${m.snippet}`).join('\n')
  const found = new Set(conversation.streetJobs ?? [])
  const atStreet = facts.jobs.filter((j) => {
    const street = streetOf(j.address)
    return street !== null && (found.has(j.key) || namesStreet(text, street))
  })
  const byStreet = new Set((atStreet.length > 1 ? atStreet.filter((j) => covers(j, newest, fence)) : atStreet).map((j) => j.key))

  // A number in the subject is the strongest sign: it stands when every street the words name is that job's own
  // street, which other jobs may share. Any other mix of two jobs is a person's to place.
  const streetKey = (key: string): string => {
    const street = streetOf(facts.jobs.find((j) => j.key === key)?.address)
    return street ? `${street.number} ${street.name}`.toLowerCase() : key
  }
  if (bySubject.size === 1) {
    const key = [...bySubject][0]!
    return [...byStreet].every((k) => streetKey(k) === streetKey(key)) ? sure(key, 'subject') : held('twoJobsNamed', [...bySubject, ...byStreet])
  }
  if (bySubject.size > 1) return held('twoJobsNamed', [...bySubject, ...byStreet])
  if (byStreet.size > 1) return held(new Set([...byStreet].map(streetKey)).size === 1 ? 'sameStreet' : 'twoJobsNamed', byStreet)
  if (byStreet.size === 1) {
    const key = [...byStreet][0]!
    return partyKeys.has(key) ? sure(key, 'street') : held('streetUnknownParty', [key])
  }

  // 3. Nothing is named: the other party's customer has exactly one job the mail's date covers.
  if (partyJobs.length === 0) return out('noJob')
  const covering = partyJobs.filter((j) => covers(j, newest, fence))
  if (covering.length === 0) return out('beforeTheJob')
  if (covering.length > 1) return held('severalJobs', covering.map((j) => j.key))
  // One job: only on an address the customer's own record holds, and only when the customer has nothing else with us.
  const only = covering[0]!
  const known = only.customerIds.filter((id) => byAddress.has(id))
  if (known.length === 0) return held('companyOnly', [only.key])
  if (known.some((id) => facts.busyCustomers?.has(id))) return held('alsoBids', [only.key])
  return sure(only.key, 'onlyJob')
}

// ---------- a job that takes too many ----------

/** The most conversations one job may take by the one-job rule before a person looks at the customer first. */
export const ONLY_JOB_MAX = 40

/**
 * The verdicts with a crowded job's one-job matches held. A job that takes more than `max` conversations on the
 * strength of who wrote alone is a customer who writes about many things, and a sheet that long is not read. The
 * matches a subject or a street made stand.
 */
export function holdCrowdedJobs(verdicts: readonly BackfillVerdict[], max = ONLY_JOB_MAX): BackfillVerdict[] {
  const taken = new Map<string, number>()
  for (const v of verdicts) if (v.kind === 'sure' && v.rule === 'onlyJob') taken.set(v.jobKey, (taken.get(v.jobKey) ?? 0) + 1)
  return verdicts.map((v) => (v.kind === 'sure' && v.rule === 'onlyJob' && (taken.get(v.jobKey) ?? 0) > max ? held('crowdedJob', [v.jobKey]) : v))
}

// ---------- the conversations and the count ----------

/**
 * A search's hits as conversations: one a mailbox and a thread, its mails oldest first. A hit a job's street search
 * found says so (`streetJobs`), and its conversation keeps every such job.
 */
export function conversationsOf(hits: readonly (BackfillMail & { account: string; threadId: string; streetJobs?: readonly string[] })[]): BackfillConversation[] {
  const by = new Map<string, { account: string; threadId: string; mails: BackfillMail[]; streets: Set<string> }>()
  for (const h of hits) {
    const key = `${h.account}\n${h.threadId}`
    const c = by.get(key) ?? { account: h.account, threadId: h.threadId, mails: [], streets: new Set<string>() }
    c.mails.push({ from: h.from, to: h.to, cc: h.cc, subject: h.subject, snippet: h.snippet, date: h.date, labels: h.labels })
    for (const k of h.streetJobs ?? []) c.streets.add(k)
    by.set(key, c)
  }
  return [...by.values()].map((c) => ({
    account: c.account,
    threadId: c.threadId,
    mails: [...c.mails].sort((a, b) => Date.parse(a.date ?? '') - Date.parse(b.date ?? '')),
    ...(c.streets.size > 0 ? { streetJobs: [...c.streets].sort() } : {}),
  }))
}

export interface BackfillTally {
  sure: number
  held: number
  out: number
  /** How many under each rule or reason. */
  by: Record<string, number>
}

/** The count of a run's verdicts: sure, held and out, and each reason's own. */
export function backfillTally(verdicts: readonly BackfillVerdict[]): BackfillTally {
  const t: BackfillTally = { sure: 0, held: 0, out: 0, by: {} }
  for (const v of verdicts) {
    t[v.kind] += 1
    const key = v.kind === 'sure' ? v.rule : v.reason
    t.by[key] = (t.by[key] ?? 0) + 1
  }
  return t
}
