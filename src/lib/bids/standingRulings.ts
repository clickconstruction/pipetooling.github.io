/**
 * Standing rulings kernel (v2.2941, LEARNING_PLAN item 4): dedupe the robots'
 * open `twin_questions` into one canonical ruling per doctrine issue.
 *
 * Robots park questions instead of stalling, and several agents ask variants of
 * the same question on different bids ("do we carry travel past 200 miles?").
 * Until now those surfaced only in the dev-only fleet console — the estimator
 * never saw them. This module groups the open queue by `topic` (the kebab-slug
 * doctrine-issue key robots stamp on a question, e.g. 'travel-bands') so ONE
 * answer fans out to every open duplicate. Questions without a topic can't be
 * deduped and list individually.
 *
 * Ships ahead of gen-types (BidRfiQueue pattern): `topic` lands with migration
 * 20260906110000 (PR #2684); reads go through select('*'), which simply omits
 * absent columns — consumers must treat a missing `topic` as null.
 */

import { effectiveTwinQuestionAudience, type TwinQuestionAudience } from '../../../supabase/functions/_shared/twinQuestionAudience'
import { checkEstimatorQuestionShape } from '../../../supabase/functions/_shared/twinQuestionShape'
import { orderedChoices } from './twinQuestionChoices'
import { effectiveTwinQuestionKind } from '../../../supabase/functions/_shared/twinQuestionKind'

export type TwinQuestionStatus = 'open' | 'answered' | 'promoted' | 'dismissed'

export type TwinQuestionRow = {
  id: string
  twin_user_id: string
  about_bid_id: string | null
  mission: string | null
  question: string
  status: TwinQuestionStatus
  answer: string | null
  answered_by: string | null
  answered_at: string | null
  created_at: string
  /** Doctrine-issue key ('travel-bands'); undefined until the migration lands. */
  topic?: string | null
  /**
   * Who the question is for (v2.3186): 'estimator' (a judgment about the job)
   * or 'operator' (the machine is in the robot's way). Undefined until
   * migration 20260909045818 lands — then the text classifies it.
   */
  audience?: string | null
  /** v2.3210: 2–4 tap labels the robot offered (jsonb array); undefined until migration 20260909233000 lands. */
  choices?: unknown
  /** v2.3210: the robot's own pick, one of `choices`. */
  recommended?: string | null
  /** v2.3212: 'decision' (a ruling) or 'plans' (a plan-set task on one bid); undefined until migration 20260910003115 lands — then the text classifies it. */
  kind?: string | null
}

export type StandingRuling = {
  /** The kebab-slug doctrine key shared by every question in the group. */
  topic: string
  /** Humanized topic for the card header: 'travel-bands' → 'Travel bands'. */
  label: string
  /** The newest open question in the group — the canonical phrasing shown. */
  newest: TwinQuestionRow
  /** Every open question the answer fans out to (newest first). */
  questionIds: string[]
  askCount: number
  /** Distinct bids the group's questions came from (bid-less asks excluded). */
  bidCount: number
}

export type StandingRulingsView = {
  /** Grouped rulings, most-asked first (ties: newest ask first). */
  rulings: StandingRuling[]
  /** Topicless open questions — no dedupe key, so they list individually (newest first). */
  singles: TwinQuestionRow[]
  /** Total open questions behind the header count (plans asks excluded — they are not rulings). */
  openCount: number
  /**
   * v2.3212: open plans asks in this lane — the robot needs a different plan
   * set on ONE bid. They live on that bid's robot needs sheet; the panel only
   * points at them (newest first).
   */
  plansAsks: TwinQuestionRow[]
  /**
   * v2.3232: open estimator-lane asks written before the one-decision rule —
   * several decisions in one, no taps. Not rulings: they wait for the owner on
   * the Console (Bids → Robots → Console), where they are split into one-tap
   * questions or dismissed. Counted here only so the panel can point at them.
   */
  legacyAsks: TwinQuestionRow[]
}

/** 'travel-bands' → 'Travel bands' (best-effort; unknown shapes pass through). */
export function topicLabel(topic: string): string {
  const words = topic.trim().split(/[-_]+/).filter(Boolean).join(' ')
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : topic
}

const newestFirst = (a: TwinQuestionRow, b: TwinQuestionRow) =>
  a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0

/**
 * Group the OPEN questions into rulings. Non-open rows are ignored so callers
 * can pass whatever the query returned; a blank/whitespace topic counts as no
 * topic. Pass `audience` to keep one lane (v2.3186): the estimator's panel
 * shows only questions about the job; the machine-side ones live on the
 * operator's console.
 */
export function groupStandingRulings(rows: TwinQuestionRow[], opts?: { audience?: TwinQuestionAudience }): StandingRulingsView {
  const lane = opts?.audience
  const inLane = rows
    .filter((r) => r.status === 'open' && (!lane || effectiveTwinQuestionAudience(r) === lane))
    .sort(newestFirst)
  const plansAsks = inLane.filter((r) => effectiveTwinQuestionKind(r) === 'plans')
  const decisions = inLane.filter((r) => effectiveTwinQuestionKind(r) !== 'plans')
  const legacyAsks = decisions.filter((r) => legacyMultiDecisionNote(r) != null)
  const open = decisions.filter((r) => legacyMultiDecisionNote(r) == null)
  const byTopic = new Map<string, TwinQuestionRow[]>()
  const singles: TwinQuestionRow[] = []
  for (const q of open) {
    const topic = (q.topic ?? '').trim()
    if (topic) {
      const list = byTopic.get(topic)
      if (list) list.push(q)
      else byTopic.set(topic, [q])
    } else {
      singles.push(q)
    }
  }
  const rulings: StandingRuling[] = []
  for (const [topic, qs] of byTopic) {
    const newest = qs[0] // qs inherits the newest-first sort and is never empty
    if (!newest) continue
    rulings.push({
      topic,
      label: topicLabel(topic),
      newest,
      questionIds: qs.map((q) => q.id),
      askCount: qs.length,
      bidCount: new Set(qs.map((q) => q.about_bid_id).filter((x): x is string => !!x)).size,
    })
  }
  rulings.sort((a, b) => {
    if (a.askCount !== b.askCount) return b.askCount - a.askCount
    return newestFirst(a.newest, b.newest)
  })
  return { rulings, singles, openCount: open.length, plansAsks, legacyAsks }
}

/** The muted line under a ruling: 'asked 3 times across 2 bids'. */
export function rulingAskedLine(r: Pick<StandingRuling, 'askCount' | 'bidCount'>): string {
  const asks = r.askCount === 1 ? 'asked once' : `asked ${r.askCount} times`
  if (r.bidCount === 0) return asks
  return `${asks} across ${r.bidCount} bid${r.bidCount === 1 ? '' : 's'}`
}

/** Open questions per lane (v2.3186) — the estimator's panel says how many sit with the operator. */
export function openCountByAudience(rows: TwinQuestionRow[]): Record<TwinQuestionAudience, number> {
  const out: Record<TwinQuestionAudience, number> = { estimator: 0, operator: 0 }
  for (const r of rows) if (r.status === 'open') out[effectiveTwinQuestionAudience(r)] += 1
  return out
}

/**
 * v2.3224: a question written before the one-decision rule (v2.3210) — several
 * decisions in one ask and no tap choices, so nobody knows what a one-line answer
 * would even be. Only the shape problems that mean "several decisions" count; a
 * long single question with no choices is merely old, not confusing. Since
 * v2.3232 such an ask leaves the Standing rulings panel for the Console's owner
 * memo; this note is what the memo says about it (nothing re-asks on its own —
 * the owner splits it into taps, or dismisses it).
 */
export function legacyMultiDecisionNote(q: { question: string; choices?: unknown; recommended?: string | null }): string | null {
  if (orderedChoices(q)) return null
  const shape = checkEstimatorQuestionShape(q)
  if (shape.ok) return null
  const multi = shape.problems.some((p) => p.includes('one decision per ask'))
  if (!multi) return null
  return 'Written before the one-decision rule: several decisions in one ask, no taps. Split it into one-tap questions below, or dismiss it — nothing re-asks on its own.'
}
