/**
 * See what they see (punch list #62), Layer 1 (v2.4174): one live line under the rows that says
 * what the GC's page will read, built from the draft as it stands through the room's own
 * kernel (`_shared/submittalRoomPayload.ts` — the function and the app import the same
 * file), so the office reads the reviewer's exact headline and subline, never a paraphrase.
 *
 * v2.4593: the line and the window say what the link shows today. "The GC sees nothing until
 * you share" was false on every draft over a shared revision (BP398's Rev 4 draft, while the
 * link shows Rev 2), and "That is what the link shows now" was false once the room closed.
 *
 * 2026-10-06: what the link shows is the newest revision on the GC's record, the one rule in
 * `_shared/submittalRecord.ts` the three room functions read. A revision answered by email with its
 * package built is on it, so BP398's link shows Rev 3, answered by email, until Rev 4 is shared.
 */
import { roomCounts, roomHeadline, roomRowsFrom, roomSubline, type RoomItemSource } from '../../../supabase/functions/_shared/submittalRoomPayload'
import { answeredByEmailAt, linkShows, onRecord, type RecordStanding, type RevisionStanding } from '../../../supabase/functions/_shared/submittalRecord'

export type ReviewerLine = {
  /** "The GC’s page will read:" / "The GC’s page reads:". */
  lead: string
  /** The room's headline and subline, quoted as the reviewer sees them. */
  line: string
  /** What the link shows today. */
  note: string
  /** The window's first sentences (What the GC sees). */
  intro: string
}

/** Where the revision on screen stands against the room's link. */
export type LinkView = {
  /** The revision on screen: the newest, the only one the line and the window describe. */
  rev: number
  /** The revision the link shows now (`linkShowsRevOf`); null while nothing is on the GC's record. */
  linkShowsRev: number | null
  /** That revision reached the record by email: answered by email, its package built (2026-10-06). */
  linkShowsByEmail?: boolean
  /** The room is closed: its link says only that the review is closed. */
  roomClosed: boolean
}

/** One revision as the record reads it: its standing comes from `_shared/submittalRecord.ts`. */
export type LinkRevision = Pick<RevisionStanding, 'id' | 'rev_number' | 'shared_at' | 'standing' | 'typedAnswerAt'>

/**
 * The revision the room's link shows now: the newest on the GC's record, by the one rule the three
 * functions read (`_shared/submittalRecord.ts`). Shared, or answered by email with its package built.
 */
export function linkShowsRevOf(revisions: ReadonlyArray<Pick<RevisionStanding, 'rev_number' | 'standing' | 'typedAnswerAt'>>): number | null {
  return linkShows(revisions)?.rev ?? null
}

/** What the link shows now, ready for `describeLink`: the revision, whether it got there by email, the room's state. */
export function linkViewOf(revisions: ReadonlyArray<Pick<RevisionStanding, 'rev_number' | 'standing' | 'typedAnswerAt'>>, roomClosed: boolean): Omit<LinkView, 'rev'> {
  const shows = linkShows(revisions)
  return { linkShowsRev: shows?.rev ?? null, linkShowsByEmail: shows?.byEmail ?? false, roomClosed }
}

/** One revision as the GC's chips will read it. */
export type LinkChip = { id: string; rev: number; current: boolean; sharedAt: string | null; answeredByEmailAt?: string | null }

/**
 * The revisions the GC's page will list once `rev` is shared (v2.4606, #62 PR 1b): `rev` as the
 * current one, then every other revision on the record, newest first, as get-submittal-room lists
 * them. A revision answered by email with its package built is on it (2026-10-06). `neverShared`
 * names the older revisions the list skips because nobody shared or answered them; `waitsForPackage`
 * the ones answered by email that go on once their package is built.
 */
export function linkRevisionsAfterShare(revisions: ReadonlyArray<LinkRevision>, rev: number): { chips: LinkChip[]; neverShared: number[]; waitsForPackage: number[] } {
  const self = revisions.find((r) => r.rev_number === rev)
  const others = onRecord(revisions.filter((r) => r.rev_number !== rev))
  const older = (standing: RecordStanding) => revisions.filter((r) => r.rev_number < rev && r.standing === standing).map((r) => r.rev_number).sort((a, b) => b - a)
  return {
    chips: [{ id: self?.id ?? `rev-${rev}`, rev, current: true, sharedAt: self?.shared_at ?? null }, ...others.map((r) => ({ id: r.id, rev: r.rev_number, current: false, sharedAt: r.shared_at, answeredByEmailAt: answeredByEmailAt(r) }))],
    neverShared: older('never'),
    waitsForPackage: older('waits_for_package'),
  }
}

const revList = (revs: ReadonlyArray<number>) => {
  const n = revs.map((r) => `Rev ${r}`)
  return n.length === 1 ? n[0]! : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

/** The quiet line under the window's chips: the record under the current one, and what the list skips. Empty when nothing is older. */
export function linkListLine(list: { chips: ReadonlyArray<LinkChip>; neverShared: ReadonlyArray<number>; waitsForPackage?: ReadonlyArray<number> }): string {
  const bits: string[] = []
  if (list.chips.length > 1) bits.push('Older revisions stay under it as the record.')
  if (list.neverShared.length === 1) bits.push(`${revList(list.neverShared)} is not on their page, because it was never shared.`)
  else if (list.neverShared.length > 1) bits.push(`${revList(list.neverShared)} are not on their page, because they were never shared.`)
  const waits = list.waitsForPackage ?? []
  if (waits.length === 1) bits.push(`${revList(waits)} goes on their page once it has a package.`)
  else if (waits.length > 1) bits.push(`${revList(waits)} go on their page once each has a package.`)
  return bits.join(' ')
}

/**
 * The heads-up in Their call (2026-10-06): typing a reviewer's answer onto a revision nobody shared
 * puts it on the GC's page as the record, once it has a package (`_shared/submittalRecord.ts`). It
 * says so before the first answer is typed, and after. Empty for a shared revision.
 */
export function emailedRecordLine(r: { rev: number; shared: boolean; hasPackage: boolean; hasAnswer: boolean }): string {
  if (r.shared) return ''
  if (r.hasAnswer) return r.hasPackage ? `Rev ${r.rev} is on the GC’s page as the record, answered by email.` : `Rev ${r.rev} goes on the GC’s page as the record once it has a package.`
  return r.hasPackage ? `Typing their answer puts Rev ${r.rev} on the GC’s page as the record.` : `Typing their answer will put Rev ${r.rev} on the GC’s page once it has a package.`
}

/** The room is closed for everyone on the link, by get-submittal-room's own test. */
export function isRoomClosed(room: { status?: string | null; closed_at?: string | null } | null | undefined): boolean {
  return !!room && (room.status === 'closed' || !!room.closed_at)
}

/** The stored item, narrowed to what the room reads. */
export function toRoomItemSource(item: RoomItemSource): RoomItemSource {
  return {
    id: item.id,
    tag: item.tag,
    sequence_order: item.sequence_order,
    specified_manufacturer: item.specified_manufacturer ?? null,
    specified_model: item.specified_model ?? null,
    specified_description: item.specified_description ?? null,
    submitted_manufacturer: item.submitted_manufacturer ?? null,
    submitted_model: item.submitted_model ?? null,
    submitted_label: item.submitted_label ?? null,
    status: item.status,
    reason_kind: item.reason_kind ?? null,
    reason_note: item.reason_note ?? null,
    lead_time_days: item.lead_time_days ?? null,
    sheet_pages: item.sheet_pages ?? null,
    review_decision: item.review_decision ?? null,
    review_note: item.review_note ?? null,
    reviewed_by_name: item.reviewed_by_name ?? null,
    reviewed_by_person_id: item.reviewed_by_person_id ?? null,
    reviewed_at: item.reviewed_at ?? null,
    order_only: item.order_only === true,
  }
}

/**
 * What the link shows today, for the revision on screen: the one place the line under the rows
 * and the window (What the GC sees) take their words about it, so the two cannot disagree.
 */
export function describeLink(view: LinkView): Omit<ReviewerLine, 'line'> {
  const live = !view.roomClosed && view.linkShowsRev === view.rev
  let note = 'The GC sees nothing until you share.'
  if (view.roomClosed) note = `The room is closed. Its link says only that the review is closed. ${view.linkShowsRev === view.rev ? 'Reopen it to show this again.' : `Reopen it, then share Rev ${view.rev}.`}`
  else if (live) note = 'That is what the link shows now.'
  else if (view.linkShowsRev != null) note = `Until you share Rev ${view.rev}, the link shows Rev ${view.linkShowsRev}${view.linkShowsByEmail ? ', answered by email' : ''}.`
  return {
    lead: live ? 'The GC’s page reads:' : 'The GC’s page will read:',
    note,
    intro: `This is the page the GC ${live ? 'opens' : 'will open'} from your link. It is drawn from your rows as they stand.`,
  }
}

export function describeForReviewer(items: ReadonlyArray<RoomItemSource>, view: LinkView): ReviewerLine {
  const counts = roomCounts(roomRowsFrom(items.map(toRoomItemSource)))
  const sub = roomSubline(counts)
  return { ...describeLink(view), line: `“${roomHeadline(counts)}”${sub ? ` — ${sub}` : ''}` }
}
