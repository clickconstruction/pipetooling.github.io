/**
 * The Bids page's robot layer — the reductions it runs over what it loads: which shadow run
 * speaks for a bid, which bid an open robot question sits on, how a twin pairs with its
 * source bid.
 *
 * Stage A of the Bids map's step 5 (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended extraction
 * order, "test the in-parent reductions first"): these ran inline in `src/pages/Bids.tsx`
 * with no test. Pure: no React, no supabase.
 */
import { effectiveTwinQuestionKind } from '../../../supabase/functions/_shared/twinQuestionKind'
import type { ShadowRunRow } from './shadowStory'

/** The note `noteBestEffortGap` writes starts with this; one per bid, found again by the prefix. */
export const BEST_EFFORT_GAP_NOTE_PREFIX = '[best effort gap]'

/** An open question a robot asked about a bid, as the board and the needs sheet read it. */
export type RobotOpenQuestionEntry = {
  id: string
  question: string
  topic: string | null
  created_at: string
  /** v2.3210 tap labels + the robot's pick; absent on older rows. */
  choices?: unknown
  recommended?: string | null
  /** v2.3212: 'plans' = the robot needs a different plan set on this bid. */
  kind?: string | null
}

/** A `twin_questions` row as loaded: the entry plus the bid it was asked about and who it is for. */
export type OpenRobotQuestionRow = Omit<RobotOpenQuestionEntry, 'topic'> & {
  topic?: string | null
  about_bid_id: string
  audience?: string | null
}

type TwinPairing = { id: string; twin_source_bid_id?: string | null }

/** Source bid id → its twin copy (the board icon's "robot bid exists"). The last twin listed wins. */
export function twinBidBySourceId<T extends TwinPairing>(robotBids: readonly T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const twin of robotBids) if (twin.twin_source_bid_id) m.set(twin.twin_source_bid_id, twin)
  return m
}

/** Twin bid id → the source bid it copies. */
export function sourceIdByTwinId(robotBids: readonly TwinPairing[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const twin of robotBids) if (twin.twin_source_bid_id) m.set(twin.id, twin.twin_source_bid_id)
  return m
}

/**
 * Shadow runs by reference bid number; the latest run per reference wins. A run with no
 * reference number is left out. An earlier run keeps its place against a later one whose
 * `created_at` cannot be read.
 */
export function latestShadowRunByBidNumber(rows: readonly ShadowRunRow[]): Map<string, ShadowRunRow> {
  const m = new Map<string, ShadowRunRow>()
  for (const r of rows) {
    const key = (r.reference_bid_number ?? '').trim()
    if (!key) continue
    const prev = m.get(key)
    if (!prev || Date.parse(r.created_at ?? '') > Date.parse(prev.created_at ?? '')) m.set(key, r)
  }
  return m
}

/** The scored run the envelope opens on: the first scored run listed for that bid number. */
export function scoredShadowRunFor(rows: readonly ShadowRunRow[], bidNumber: string | null | undefined): ShadowRunRow | null {
  const number = (bidNumber ?? '').trim()
  return rows.find((r) => (r.reference_bid_number ?? '').trim() === number && r.status === 'scored') ?? null
}

/** The estimator lane: operator-audience questions never surface on the board. */
export function estimatorLaneQuestions<T extends { audience?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.audience !== 'operator')
}

/**
 * Open questions by the bid they sit on. v2.3212: a PLANS ask the robot filed on its ZZ
 * shell is a task on the HUMAN bid (the shell copies the human's plans link), so it is keyed
 * to the source row — the amber icon the estimator actually sees. Other questions stay on
 * the bid they were asked about.
 */
export function openRobotQuestionsByBidId(
  rows: readonly OpenRobotQuestionRow[],
  sourceByTwin: ReadonlyMap<string, string>,
): Map<string, RobotOpenQuestionEntry[]> {
  const m = new Map<string, RobotOpenQuestionEntry[]>()
  for (const r of rows) {
    const kind = effectiveTwinQuestionKind(r)
    const key = kind === 'plans' ? (sourceByTwin.get(r.about_bid_id) ?? r.about_bid_id) : r.about_bid_id
    const list = m.get(key) ?? []
    list.push({ id: r.id, question: r.question, topic: r.topic ?? null, created_at: r.created_at, choices: r.choices, recommended: r.recommended ?? null, kind })
    m.set(key, list)
  }
  return m
}

/** Questions waiting on anyone: the estimator lane minus plans asks (those sit on the bid as a need). */
export function robotQuestionsWaitingCount(rows: readonly OpenRobotQuestionRow[]): number {
  return rows.filter((r) => effectiveTwinQuestionKind(r) !== 'plans').length
}

/** The dev door `?envelope=<bid number>`: `b482`, `B482` and `482` all name bid 482. */
export function envelopeParamBidNumber(wanted: string): string {
  return wanted.replace(/^[bB]/, '').trim()
}
