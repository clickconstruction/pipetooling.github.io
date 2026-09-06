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
  /** Total open questions behind the header count. */
  openCount: number
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
 * topic.
 */
export function groupStandingRulings(rows: TwinQuestionRow[]): StandingRulingsView {
  const open = rows.filter((r) => r.status === 'open').sort(newestFirst)
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
  return { rulings, singles, openCount: open.length }
}

/** The muted line under a ruling: 'asked 3 times across 2 bids'. */
export function rulingAskedLine(r: Pick<StandingRuling, 'askCount' | 'bidCount'>): string {
  const asks = r.askCount === 1 ? 'asked once' : `asked ${r.askCount} times`
  if (r.bidCount === 0) return asks
  return `${asks} across ${r.bidCount} bid${r.bidCount === 1 ? '' : 's'}`
}
