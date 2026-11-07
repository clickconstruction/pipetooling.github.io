/**
 * Messages, punch list #258: which desk finishes a New row — **Dispatch** (a visit, a crew, a schedule) or
 * **Estimating** (a bid, a price) — read from the facts the row already carries and nothing the words would have to be
 * guessed from. The rule, in the order it is read:
 *
 * 1. **Bid it?** (an invitation to bid, an addendum, an agency's solicitation, a pre-bid notice, v2.6222) is Estimating's.
 * 2. A sender nobody has named (**Who is this?**) is nobody's until sorted. So is one of our own team, a supply house
 *    and a candidate, whose lines are never work for either desk.
 * 3. A trade partner or an architect is Estimating's: the *Who gets a new message* rule seats them with the estimator
 *    (`followUp/assignSeats.ts`), and what they write about is a bid, a quote or the plans.
 * 4. A customer, a lead or a sub is placed by the jobs they are on: any Pipeline job is Dispatch's; only bids,
 *    Estimating's; only GC projects, nobody's here (the GC desk is its own page). With no job under way, the box
 *    says it: an email to bids@ is Estimating's, and a line on the team number is Dispatch's, since the office's
 *    seat answers a customer there and books the visit.
 *
 * The flow step a person stands at is not on the lane's row (the thread reads it), so it is not read here; the card
 * names that as a later sharpening. Pure. The colors and the icons the band wears are `deskMarks.ts`.
 */
import type { NewLaneRow } from '../followUp/newLane'
import { jobRefOf } from './jobKeys'

/** The two desks a row can be read to. */
export type Desk = 'dispatch' | 'estimating'

/** The facts the rule reads off a New row. */
export type DeskFacts = Pick<NewLaneRow, 'sort' | 'kind' | 'jobIds' | 'mailbox' | 'invitation'>

/** The word each desk goes by, as the header's press names it, and what it finishes. */
export const DESK_WORDS: Readonly<Record<Desk, { word: string; does: string }>> = {
  dispatch: { word: 'Dispatch', does: 'Dispatch finishes this: a visit, a crew or a schedule.' },
  estimating: { word: 'Estimating', does: 'Estimating finishes this: a bid or a price.' },
}

/** The desk a row is read to, or null when the rule cannot place it. */
export function rowDesk(row: DeskFacts): Desk | null {
  return deskRead(row)?.desk ?? null
}

/** The desk and the one sentence that says why, for the band's hover. Null when the rule cannot place the row. */
export function deskRead(row: DeskFacts): { desk: Desk; why: string } | null {
  if (row.sort === 'bid') return { desk: 'estimating', why: INVITATION_WHY[row.invitation?.kind ?? 'invitation'] }
  switch (row.kind) {
    case 'unknown':
    case 'team':
    case 'supply_house':
    case 'candidate':
      return null
    case 'trade':
      return { desk: 'estimating', why: 'A trade partner writes about a bid or a quote.' }
    case 'arch':
      return { desk: 'estimating', why: 'An architect writes about the plans.' }
    case 'customer':
    case 'lead':
    case 'sub':
      return byJobs(row, row.kind)
  }
}

const INVITATION_WHY: Readonly<Record<NonNullable<NewLaneRow['invitation']>['kind'], string>> = {
  invitation: 'An invitation to bid.',
  addendum: 'An addendum to a bid.',
  solicitation: 'A solicitation from an agency.',
  prebid: 'A pre-bid notice.',
}

const ON_THE_LINE: Readonly<Record<'customer' | 'lead' | 'sub', string>> = {
  customer: 'A customer on the team line. Dispatch books the visit.',
  lead: 'A lead on the team line. Dispatch books the visit.',
  sub: 'A sub on the team line. Dispatch schedules them.',
}

function byJobs(row: DeskFacts, kind: 'customer' | 'lead' | 'sub'): { desk: Desk; why: string } | null {
  const kinds = new Set(row.jobIds.map((key) => jobRefOf(key)?.kind).filter(Boolean))
  if (kinds.has('pipeline')) return { desk: 'dispatch', why: 'Their job is on the Pipeline.' }
  if (kinds.has('bid')) return { desk: 'estimating', why: 'Their job is a bid.' }
  if (kinds.has('project')) return null
  if (row.mailbox === 'bids') return { desk: 'estimating', why: 'They wrote to bids@.' }
  return { desk: 'dispatch', why: ON_THE_LINE[kind] }
}

/**
 * The same read for a row that is not the New lane's (PR 2 of #258, v2.6616): a Needs a reply row and the thread's
 * folded sort card hold the sender and the line they wrote on, not a sort, so the facts are gathered from the contact
 * (the kind, the jobs) and the line (the box, and what a reader read from an invitation when the line carries it).
 * The rule itself is unchanged: an invitation is Estimating's, an unnamed sender nobody's, the rest by kind and jobs.
 */
export function deskReadOf(contact: { kind: DeskFacts['kind']; jobIds?: ReadonlyArray<string> | null }, line: { mailbox?: DeskFacts['mailbox']; invitation?: unknown } | null | undefined): { desk: Desk; why: string } | null {
  const raw = line?.invitation
  const invitation = raw && typeof raw === 'object' && typeof (raw as { kind?: unknown }).kind === 'string' && (raw as { kind: string }).kind in INVITATION_WHY ? (raw as NonNullable<DeskFacts['invitation']>) : null
  return deskRead({ sort: invitation ? 'bid' : 'has', kind: contact.kind, jobIds: [...(contact.jobIds ?? [])], mailbox: line?.mailbox ?? null, invitation })
}

/** The band's hover: the desk's word, then why: "Estimating · An invitation to bid." */
export function deskTitle(read: { desk: Desk; why: string }): string {
  return `${DESK_WORDS[read.desk].word} · ${read.why}`
}
