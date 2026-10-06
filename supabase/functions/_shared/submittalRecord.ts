/**
 * The GC's record (2026-10-06, the owner's call on BP398): which of a bid's submittal revisions
 * the review room serves. A revision is on the record when the office shared it, or when it holds
 * an answer the office typed in from the reviewer's own words AND has a built package: it went out
 * by email as that package, and the answer came back the same way. The newest revision on the
 * record is the current one.
 *
 * One rule, here. `get-submittal-room` lists these revisions, `open-submittal-pdf` serves their
 * packages, `submit-submittal-review` takes answers on the current one, and the office's lines
 * (`src/lib/submittals/seeWhatTheySee.ts`) say what the link shows from the same standings. Before
 * this the three functions each read "has a share date" on their own, while the office's log already
 * counted a typed answer as real (`rowsThatStand`). On BP398, Rev 3 was answered by email on Oct 2
 * and never shared, so the GC's page would have dropped it the day Rev 4 was shared, and its
 * procurement card would have lost Kitchen sinks and Toilets.
 *
 * The package is the guard. A typed answer on a draft that never had a package cannot publish it:
 * that revision waits (`waits_for_package`) and the office is told to build its package.
 *
 * The answers that count are the reviewer's, on a row or a part the GC sees: typed in by the office
 * from their email or marked-up PDF ('entered'), read from their file by the robot and confirmed by a
 * person ('robot'), or given on the link ('room'). A room answer on a revision nobody shared can only
 * come after that revision reached the record by email, so counting it keeps the revision on the GC's
 * page once they answer the rest of it there. A part's 'carried' call came over from an earlier
 * revision and does not count, and neither does a call on an order-only row or part. The day the GC's
 * chip reads is the newest typed answer's own day.
 *
 * Dependency-free (types only) so the app imports the same rule. The loader takes any client with
 * supabase-js's shape: the functions' service client, or the app's own.
 */
import type { RoomRevision, SubmittalRoomPayload } from './submittalRoomPayload.ts'

/** Where a revision stands against the GC's page. */
export type RecordStanding = 'shared' | 'answered_by_email' | 'waits_for_package' | 'never'

/** A row's or a part's call, as far as the record reads it. */
export type TypedAnswerSource = {
  decision_source?: string | null
  review_decision?: string | null
  reviewed_at?: string | null
  /** A row bought as order only never reaches the GC. */
  order_only?: boolean | null
  /** A part off the submittal never reaches the GC. */
  on_submittal?: boolean | null
}

/** One revision with its standing. Newest first wherever a list of them is handed back. */
export type RevisionStanding = {
  id: string
  rev_number: number
  shared_at: string | null
  package_path: string | null
  /** A reviewer's answer sits on a row or a part the GC sees (`isReviewerAnswer`). */
  hasAnswer: boolean
  /** The day the GC's chip reads: the newest typed answer's own day ('entered' or 'robot', which the office may set), or the newest answer's when none was typed. */
  typedAnswerAt: string | null
  standing: RecordStanding
}

/** The room's revision, and the day it was answered by email when that is how it reached the record. */
export type RecordRoomRevision = RoomRevision & { answeredByEmailAt?: string | null }

/** The room's payload as the page reads it: its revisions carry how they reached the record. */
export type RecordRoomPayload = Omit<SubmittalRoomPayload, 'revisions'> & { revisions: RecordRoomRevision[] }

const DECIDED = new Set(['approved', 'revise', 'rejected'])

const ANSWER_SOURCES = new Set(['entered', 'robot', 'room'])

/** The reviewer's answer on something the GC sees: typed in, read by the robot, or given on the link. Never a carried call. */
export function isReviewerAnswer(a: TypedAnswerSource): boolean {
  return ANSWER_SOURCES.has(String(a.decision_source ?? 'room')) && DECIDED.has(String(a.review_decision ?? '')) && a.order_only !== true && a.on_submittal !== false
}

/** An answer the office typed in from the reviewer's own words, or the robot read from their file. */
export function isTypedAnswer(a: TypedAnswerSource): boolean {
  return (a.decision_source === 'entered' || a.decision_source === 'robot') && isReviewerAnswer(a)
}

/** The rule. Shared, or answered by email with its package built; an answer with no package waits. */
export function recordStanding(r: { shared_at: string | null; package_path: string | null; hasAnswer: boolean }): RecordStanding {
  if (r.shared_at) return 'shared'
  if (!r.hasAnswer) return 'never'
  return r.package_path ? 'answered_by_email' : 'waits_for_package'
}

/** On the GC's page: shared, or answered by email with a package. */
export function isOnRecord(standing: RecordStanding): boolean {
  return standing === 'shared' || standing === 'answered_by_email'
}

function newestDay(days: ReadonlyArray<string | null | undefined>): string | null {
  let newest: string | null = null
  for (const d of days) {
    if (!d || Number.isNaN(new Date(d).getTime())) continue
    if (newest == null || new Date(d).getTime() > new Date(newest).getTime()) newest = d
  }
  return newest
}

/** Every revision with its standing, newest first, from the revisions and the calls on their rows and parts. */
export function revisionStandings(
  revisions: ReadonlyArray<{ id: string; rev_number: number; shared_at: string | null; package_path: string | null }>,
  answersByRevision: ReadonlyMap<string, ReadonlyArray<TypedAnswerSource>>,
): RevisionStanding[] {
  return [...revisions]
    .sort((a, b) => b.rev_number - a.rev_number)
    .map((r) => {
      const answers = (answersByRevision.get(r.id) ?? []).filter(isReviewerAnswer)
      const hasAnswer = answers.length > 0
      return {
        id: r.id,
        rev_number: r.rev_number,
        shared_at: r.shared_at,
        package_path: r.package_path,
        hasAnswer,
        typedAnswerAt: newestDay(answers.filter(isTypedAnswer).map((a) => a.reviewed_at)) ?? newestDay(answers.map((a) => a.reviewed_at)),
        standing: recordStanding({ shared_at: r.shared_at, package_path: r.package_path, hasAnswer }),
      }
    })
}

/** The revisions the room serves, newest first. The first is the current one. */
export function onRecord<T extends { rev_number: number; standing: RecordStanding }>(list: ReadonlyArray<T>): T[] {
  return list.filter((r) => isOnRecord(r.standing)).sort((a, b) => b.rev_number - a.rev_number)
}

/** The day a revision on the record by its answers reads on the GC's page; null for a shared one. */
export function answeredByEmailAt(r: Pick<RevisionStanding, 'standing' | 'typedAnswerAt'>): string | null {
  return r.standing === 'answered_by_email' ? r.typedAnswerAt : null
}

/** What the link shows now: the newest revision on the record, and whether it got there by email. Null while nothing is. */
export function linkShows(list: ReadonlyArray<Pick<RevisionStanding, 'rev_number' | 'standing' | 'typedAnswerAt'>>): { rev: number; byEmail: boolean; answeredAt: string | null } | null {
  const top = onRecord(list)[0]
  if (!top) return null
  return { rev: top.rev_number, byEmail: top.standing === 'answered_by_email', answeredAt: answeredByEmailAt(top) }
}

/** Any client with supabase-js's query shape: the functions' service client, or the app's own. */
// deno-lint-ignore no-explicit-any
export type RecordDb = { from: (table: string) => any }

/**
 * A bid's revisions with their standings, newest first. The calls are read only on the revisions
 * nobody shared, since a shared revision is on the record whatever its rows say. A parts table that
 * cannot be read counts as no parts.
 */
export async function loadRevisionStandings(db: RecordDb, bidId: string): Promise<RevisionStanding[]> {
  const { data: revData } = await db.from('bid_submittals').select('id, rev_number, shared_at, package_path').eq('bid_id', bidId).order('rev_number', { ascending: false })
  const revisions = (revData ?? []) as Array<{ id: string; rev_number: number; shared_at: string | null; package_path: string | null }>
  const unshared = revisions.filter((r) => !r.shared_at).map((r) => r.id)
  const answers = new Map<string, TypedAnswerSource[]>()
  if (unshared.length > 0) {
    const { data: itemData } = await db.from('bid_submittal_items').select('id, submittal_id, order_only, decision_source, review_decision, reviewed_at').in('submittal_id', unshared)
    const items = (itemData ?? []) as Array<TypedAnswerSource & { id: string; submittal_id: string }>
    const revisionOf = new Map<string, string>()
    for (const it of items) {
      revisionOf.set(it.id, it.submittal_id)
      answers.set(it.submittal_id, [...(answers.get(it.submittal_id) ?? []), it])
    }
    const seen = items.filter((it) => it.order_only !== true).map((it) => it.id)
    for (let i = 0; i < seen.length; i += 200) {
      const { data: partData, error } = await db
        .from('bid_submittal_item_parts')
        .select('item_id, on_submittal, decision_source, review_decision, reviewed_at')
        .in('item_id', seen.slice(i, i + 200))
        .in('decision_source', ['entered', 'robot', 'room'])
      if (error) break
      for (const p of (partData ?? []) as Array<TypedAnswerSource & { item_id: string }>) {
        const rev = revisionOf.get(p.item_id)
        if (rev) answers.set(rev, [...(answers.get(rev) ?? []), p])
      }
    }
  }
  return revisionStandings(revisions, answers)
}
