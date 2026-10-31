/**
 * Messages, residential R7 (PR 3): what the New lane's screens read around its kernel (`newLane.ts`, v2.5394). Which of a
 * person's jobs are still active, a line's box and whether a person tied it, from the rows; who the rule picks for
 * *Who has it?* and the people the card offers; the words a press says; and why a guess that needs a record of its own
 * waits. Lifted from the customer Messages prototype (branch spike/gc-mode,
 * `to-dos/gc-mode/messages/customer-messages-prototype.html` v0.8, screen 7, mockup A). Pure.
 */
import type { Contact, ContactKind } from '../contacts/kernel'
import type { JobTile } from '../messages/jobTiles'
import { jobKey, jobKeyOfRow } from '../messages/load'
import type { MessageChannel } from '../messages/thread'
import { invitation, invitationOf, type Invitation } from '../emailIn/invitation'
import { hasChoices, newLane, type GuessKind, type HasChoice, type HasPerson, type HasPick, type LaneJob, type Mailbox, type NewLaneMessage, type NewLaneRow, type WhoGuess } from './newLane'
import { onFollowUp, stateToday, whoGetsIt, type AssignSeats, type ContactState } from './queue'
import type { Teammate } from './team'

/** The rows a job's state comes from, as the thread's tiles read them (`jobTiles.ts`). */
export interface LaneJobRows {
  bids?: ReadonlyArray<{ id: string; outcome: string | null }>
  projects?: ReadonlyArray<{ project_id: string; stage: string | null; lost_on: string | null }>
  pipeline?: ReadonlyArray<{ id: string; status: string | null }>
}

/** A Pipeline job still under way, as the Stages header counts them (`LEAN_STATS_ACTIVE_JOB_STATUSES`). */
const PIPELINE_ACTIVE: ReadonlySet<string> = new Set(['waiting', 'working', 'ready_to_bill', 'billed'])

/**
 * The jobs still under way, by key: a bid nobody has won or lost, a GC project not closed or lost, a Pipeline job
 * waiting, working, ready to bill or billed. A job with no status yet is under way.
 */
export function activeJobKeys(rows: LaneJobRows): Set<string> {
  const out = new Set<string>()
  for (const b of rows.bids ?? []) {
    const outcome = b.outcome?.trim().toLowerCase() ?? ''
    if (outcome !== 'won' && outcome !== 'lost') out.add(jobKey({ kind: 'bid', id: b.id }))
  }
  for (const p of rows.projects ?? []) {
    if (p.stage?.trim().toLowerCase() !== 'closed' && !p.lost_on) out.add(jobKey({ kind: 'project', id: p.project_id }))
  }
  for (const j of rows.pipeline ?? []) {
    const status = j.status?.trim().toLowerCase() ?? ''
    if (!status || PIPELINE_ACTIVE.has(status)) out.add(jobKey({ kind: 'pipeline', id: j.id }))
  }
  return out
}

/**
 * A line's box, whether a person tied it, and whether the app sent it on its own, from R6's `messages.mailbox`, R7's
 * `messages.tied_by` and v2.6012's `messages.auto`.
 */
export function laneFacts(row: LaneFactsRow): Pick<NewLaneMessage, 'mailbox' | 'tiedByHand' | 'auto' | 'invitation'> {
  return {
    mailbox: row.mailbox === 'team' || row.mailbox === 'bids' ? (row.mailbox as Mailbox) : null,
    tiedByHand: Boolean(row.tied_by),
    auto: row.auto === true,
    invitation: lineInvitation(row),
  }
}

/** The columns `laneFacts` reads: the box, who tied it, the app's own send, and what the reader read from an invitation (v2.6222). */
export interface LaneFactsRow {
  mailbox?: string | null
  tied_by?: string | null
  auto?: boolean | null
  /** `messages.invitation`: the kernel's facts with a person's answer, null on every other line, missing on a read from before the column. */
  invitation?: unknown
  channel?: string
  direction?: string
  subject?: string | null
  body?: string
  at?: string
}

/**
 * The invitation a line is (v2.6222): the facts the reader kept on it, else, for an email in from before the reader
 * kept them, what the same kernel reads from its subject and words now. An answer on the row is kept as it is.
 */
export function lineInvitation(row: LaneFactsRow): Invitation | null {
  const kept = invitationOf(row.invitation)
  if (kept) return kept
  if (row.channel !== 'email' || row.direction !== 'in') return null
  return invitation({ subject: row.subject ?? '', text: row.body ?? '', at: row.at ?? '' })
}

/** What *Start a bid* says once it lands: the bid's number and name, and where the thread is now. */
export function startedBidWords(bid: { bidNumber: string; project: string; customer: string }): string {
  return `Bid b${bid.bidNumber} is started on ${bid.customer}: ${bid.project}. The thread is on it.`
}

/** What the two other *Bid it?* presses say once they land. */
export const INVITATION_WORDS = {
  notForUs: 'Not for us. The thread is done. Their next invitation shows again.',
  kept: 'Kept for later. No bid yet.',
} as const

/** The person's jobs as *Which job?* reads them: each tile's number and name, and whether it is still under way. */
export function laneJobs(keys: readonly string[], tiles: Readonly<Record<string, JobTile>>, active: ReadonlySet<string>): LaneJob[] {
  return keys.flatMap((key) => {
    const tile = tiles[key]
    return tile ? [{ id: key, number: tile.num, name: tile.name, active: active.has(key) }] : []
  })
}

const KIND_MESSAGES: Partial<Record<ContactKind, string>> = { customer: 'customer', trade: 'trade partner', arch: 'architect' }

/**
 * The rule's pick on *Who has it?*: *Who gets a new message*'s own (`whoGetsIt`), whoever answered them last, else the
 * seat for their kind. Null when the rule picks nobody, or picks someone no longer on the team.
 */
export function rulePick(input: { kind: ContactKind; answeredLastBy: string | null; team: readonly Teammate[]; seats: AssignSeats }): (HasPick & { userId: string }) | null {
  const userId = whoGetsIt({ kind: input.kind, answeredLastBy: input.answeredLastBy, hereToday: new Set(input.team.map((t) => t.id)), seats: input.seats })
  const who = userId ? input.team.find((t) => t.id === userId) : undefined
  if (!who) return null
  const why = userId === input.answeredLastBy ? `${who.name} answered them last.` : `${who.name} gets new ${KIND_MESSAGES[input.kind] ?? 'customer'} messages.`
  return { userId: who.id, name: who.name, why }
}

const ROLE_WORDS: Readonly<Record<string, string>> = {
  assistant: 'the office',
  controller: 'the controller',
  estimator: 'an estimator',
  master_technician: 'the owner',
  dev: 'a dev',
  primary: 'the office',
  superintendent: 'the superintendent',
}

/** The office team as *Who has it?* offers them: each with what they do. */
export function hasPeople(team: readonly Teammate[]): HasPerson[] {
  return team.map((t) => ({ name: t.name, words: ROLE_WORDS[t.role] ?? 'the office', office: true }))
}

/** Where to make the record a guess needs before it can name the number. */
const WAIT_WORDS: Readonly<Partial<Record<GuessKind, string>>> = {
  trade: 'Add the company under Trade partners in GC mode first. Then name the number here.',
  supply_house: 'Add the supply house on Materials first. Then name the number here.',
  candidate: 'Add them on Prospects under Team first. Then name the number here.',
}

/**
 * Why a guess cannot name the number from one press, or null when it can. A guess with its record names them as it, a
 * lead needs no record, *Someone else* opens *Who is this?*, a new customer is made by the press itself (v2.5795), and
 * so are a new trade partner, a supply house and a candidate (spike); a notice marks and closes (v2.6202). A guess with
 * none of those waits for its record.
 */
export function guessWait(guess: Pick<WhoGuess, 'kind' | 'record'> & Partial<Pick<WhoGuess, 'makes' | 'makesRecord' | 'notice'>>): string | null {
  if (guess.record || guess.kind === 'lead' || guess.kind === 'someone_else' || guess.makes || guess.makesRecord || guess.notice) return null
  return WAIT_WORDS[guess.kind] ?? null
}

/** What a *Who is this?* press says once it lands. */
export function namedWords(guess: Pick<WhoGuess, 'kind' | 'label' | 'name'> & Partial<Pick<WhoGuess, 'makes' | 'makesRecord' | 'notice'>>): string {
  // A notice, not a person (v2.6202): the thread is done, and the reader leaves the sender out from now on.
  if (guess.notice) return guess.notice.scope === 'domain' ? `Everything from ${guess.notice.value} is a notice now. Their next mail stays in Gmail.` : `${guess.notice.value} is a notice now. Their next mail stays in Gmail.`
  if (guess.makes) return `${guess.makes.customerName.trim() || guess.name || 'They'} is a customer now. The thread moves to them.`
  if (guess.makesRecord) {
    const who = guess.makesRecord.name.trim() || guess.name || 'They'
    if (guess.makesRecord.table === 'gc_companies') return `${who} is a trade partner now. The thread stays with them.`
    if (guess.makesRecord.table === 'supply_houses') return `${who} is a supply house now. Their lines stay off Follow up.`
    return `${who} is on the hiring board now. Their lines stay off Follow up.`
  }
  if (guess.kind === 'lead') return `${guess.name ?? 'They'} ${guess.name ? 'is' : 'are'} a lead now. The thread stays with them.`
  if (guess.kind === 'team') return `${guess.label} is one of our own team now. The thread stays with them.`
  return `The number is ${guess.label} now. The thread stays with them.`
}

/** What a *Which job?* press says once it lands. */
export function tiedWords(job: Pick<LaneJob, 'number'>, moved: boolean): string {
  return moved ? `The line is on ${job.number} now.` : `The line stays on ${job.number}.`
}

/** A line as the card reads it from `messages`: its job's three columns, its box and who tied it. */
export interface LaneLineRow {
  id: string
  contact_id: string
  bid_id: string | null
  project_id: string | null
  jobs_ledger_id: string | null
  channel: string
  direction: string
  at: string
  subject: string | null
  body: string
  mailbox?: string | null
  tied_by?: string | null
  auto?: boolean | null
  /** `messages.invitation` (v2.6222). */
  invitation?: unknown
}

const LINE_CHANNELS: ReadonlySet<string> = new Set<MessageChannel>(['call', 'voicemail', 'missed', 'text', 'email', 'note', 'event', 'portal'])

/**
 * The open person's New lane row, for the card above their thread, or null when they are not in the lane: their
 * conversation is not open today, their newest line is a customer's write on their page (that waits in Needs you), or
 * nothing needs sorting. The same rule Follow up's lane reads, from the card's own read.
 */
export function laneRowFor(
  contact: Pick<Contact, 'id' | 'kind' | 'name' | 'company' | 'jobIds' | 'defaultJobId'> & Partial<Pick<Contact, 'goesBy'>>,
  read: {
    conversation: { state: string; snoozed_until: string | null; has_user_id: string | null } | null
    lines: readonly LaneLineRow[]
    active: ReadonlySet<string>
  },
  todayYmd: string,
  nowIso: string,
): NewLaneRow | null {
  const c = read.conversation
  if (!c) return null
  // Follow up never holds a supply house or a candidate (`OFF_FOLLOW_UP`), so their threads get no sort card (spike).
  if (!onFollowUp(contact.kind)) return null
  const state = (['waiting', 'snoozed', 'done'].includes(c.state) ? c.state : 'done') as ContactState
  if (stateToday({ state, snoozedUntil: c.snoozed_until }, todayYmd) !== 'waiting') return null
  const lines: NewLaneMessage[] = read.lines.flatMap((l) =>
    LINE_CHANNELS.has(l.channel) && (l.direction === 'in' || l.direction === 'out' || l.direction === 'team')
      ? [
          {
            id: l.id,
            contactId: l.contact_id,
            jobId: jobKeyOfRow(l),
            channel: l.channel as MessageChannel,
            direction: l.direction as NewLaneMessage['direction'],
            at: l.at,
            body: l.body,
            subject: l.subject,
            ...laneFacts(l),
          },
        ]
      : [],
  )
  const newestIn = lines.filter((l) => l.direction === 'in').sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
  if (newestIn?.channel === 'portal' && contact.kind === 'customer') return null
  const person = { id: contact.id, kind: contact.kind, name: contact.name, goesBy: contact.goesBy ?? null, company: contact.company, jobIds: contact.jobIds, defaultJobId: contact.defaultJobId, has: c.has_user_id }
  return newLane([person], lines, read.active, nowIso)[0] ?? null
}

/** *Who has it?*'s people with who each is: the rule's pick first, then the office (`hasChoices`). */
export function hasTargets(row: Pick<NewLaneRow, 'contactId'>, team: readonly Teammate[], pick: (HasPick & { userId: string }) | null): Array<HasChoice & { userId: string }> {
  const ids = new Map(team.map((t) => [t.name, t.id]))
  if (pick) ids.set(pick.name, pick.userId)
  return hasChoices(row, hasPeople(team), pick).flatMap((c) => {
    const userId = ids.get(c.name)
    return userId ? [{ ...c, userId }] : []
  })
}
