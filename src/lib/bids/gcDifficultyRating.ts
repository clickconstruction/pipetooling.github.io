/**
 * GC difficulty rating (punch list #357, PR 2): a GC's rating and where it stands.
 *
 * A rating is one row of `gc_difficulty_ratings`: the picks a person made under one published criteria version, with
 * what happened. The newest rating of a customer stands and every one is kept. A rating stays a rating of its own
 * version: its points are counted under that version's body, never under newer words. When the published version is
 * newer, the card carries the picks forward by the rule in `difficultyCriteria.ts` and says what did not carry, and
 * the next save is made under the published version.
 *
 * Pure: no React, no supabase. The chip's words, the card's lines and the draft's rules live here.
 */
import {
  carryDifficultyPicks,
  difficultyPointsWords,
  difficultyRungSentence,
  difficultyScale,
  difficultyScaleHasPoints,
  difficultyTotalPoints,
  difficultyUnratedWords,
  type DifficultyCarry,
  type DifficultyCriteriaBody,
  type DifficultyPicks,
} from './difficultyCriteria'

export type GcDifficultyRating = {
  id: string
  customerId: string
  criteriaVersionId: string
  picks: DifficultyPicks
  /** A bills scale's words (PR 3): read from the bills with the numbers behind it, or By hand: with the reason. */
  pickReasons: Record<string, string>
  note: string
  ratedByName: string
  ratedAt: string
}

/** A criteria version as the standing needs it. */
export type DifficultyVersionLite = { id: string; version: number; body: DifficultyCriteriaBody }

export type GcDifficultyStanding = {
  customerId: string
  rating: GcDifficultyRating
  /** The version the rating was made under; null when that version cannot be read (the chip then says so). */
  version: DifficultyVersionLite | null
  /** Points under the rating's own version. */
  points: number
  /** One line per picked scale, in the version's order. */
  sentences: { key: string; name: string; points: number; sentence: string }[]
  /** When the published version is newer than the rating's: the picks carried to it, and what did not come along. */
  carry: DifficultyCarry | null
  publishedVersion: DifficultyVersionLite | null
}

/** The newest rating per customer. Rows in any order. */
export function newestRatingByCustomer(rows: readonly GcDifficultyRating[]): Map<string, GcDifficultyRating> {
  const out = new Map<string, GcDifficultyRating>()
  for (const r of rows) {
    const have = out.get(r.customerId)
    if (!have || r.ratedAt > have.ratedAt || (r.ratedAt === have.ratedAt && r.id > have.id)) out.set(r.customerId, r)
  }
  return out
}

export function gcDifficultyStanding(rating: GcDifficultyRating, versions: readonly DifficultyVersionLite[], published: DifficultyVersionLite | null): GcDifficultyStanding {
  const version = versions.find((v) => v.id === rating.criteriaVersionId) ?? null
  const total = version ? difficultyTotalPoints(rating.picks, version.body) : null
  const sentences = version
    ? version.body.scales
        .filter((s) => total?.rated.includes(s.key))
        .map((s) => ({ key: s.key, name: s.name, points: rating.picks[s.key]!, sentence: difficultyRungSentence(version.body, s.key, rating.picks[s.key]!) ?? '' }))
    : []
  const carry = published && version && published.version > version.version ? carryDifficultyPicks(rating.picks, published.body) : null
  return { customerId: rating.customerId, rating, version, points: total?.points ?? 0, sentences, carry, publishedVersion: published }
}

/** Every customer's standing from the newest rating each. */
export function gcDifficultyStandings(rows: readonly GcDifficultyRating[], versions: readonly DifficultyVersionLite[], published: DifficultyVersionLite | null): Map<string, GcDifficultyStanding> {
  const out = new Map<string, GcDifficultyStanding>()
  for (const r of newestRatingByCustomer(rows).values()) out.set(r.customerId, gcDifficultyStanding(r, versions, published))
  return out
}

export const GC_DIFFICULTY_WORDS = {
  cardTitle: 'How they are to work with',
  cardLead: 'One rating for the GC. Every new bid to them reads it.',
  rateThem: 'Rate them',
  notRated: 'Not rated yet',
  noteLabel: 'What happened',
  notePlaceholder: 'The job and the day, in a sentence',
  save: (points: number) => `Save ${difficultyPointsWords(points)}`,
  saved: (points: number) => `Rated ${difficultyPointsWords(points)}.`,
  earlier: 'Earlier ratings',
  cannotRate: 'The office rates a GC. You can read the rating here.',
  setByHand: 'Set by hand…',
  byHandLabel: 'Why the bills do not tell it',
  byHandUse: 'Use this',
  byHandClear: 'Read from the bills again',
  byHandNoReason: 'Say why. A point set by hand needs a reason.',
  noNote: 'Say what happened. A rating with no reason is the problem this card fixes.',
  noPick: 'Pick at least one sentence.',
  noVersion: 'No criteria are published yet. A dev publishes them in Settings → Difficulty criteria.',
  versionGone: 'rated under a version that cannot be read',
} as const

/** The GC's card on its record, where the rating is made. */
export function gcDifficultyCardHref(customerId: string): string {
  return `/customers/${customerId}#gc-difficulty`
}

/** The chip beside a GC's name: "Rated 4 points". */
export function gcDifficultyChipWords(s: GcDifficultyStanding): string {
  if (!s.version) return `Rated · ${GC_DIFFICULTY_WORDS.versionGone}`
  return `Rated ${difficultyPointsWords(s.points)}`
}

/** The chip's title: the sentences behind the points, and who rated. */
export function gcDifficultyChipTitle(s: GcDifficultyStanding): string {
  const head = s.sentences.map((x) => `${x.name} ${x.points}: ${x.sentence}`).join('\n')
  return [head, gcDifficultyRatedByWords(s)].filter(Boolean).join('\n')
}

/** "Rated by Robert on 2026-11-14 under criteria version 1." */
export function gcDifficultyRatedByWords(s: Pick<GcDifficultyStanding, 'rating' | 'version'>): string {
  const by = s.rating.ratedByName.trim()
  const day = s.rating.ratedAt.slice(0, 10)
  const v = s.version ? ` under criteria version ${s.version.version}` : ''
  return `Rated${by ? ` by ${by}` : ''} on ${day}${v}.`
}

/** The card's total line: "4 points on every new bid to them." */
export function gcDifficultyTotalWords(points: number): string {
  return `${difficultyPointsWords(points)} on every new bid to them.`
}

/**
 * What the card shows when the published version is newer than the rating's: the carried picks and the line that
 * names what is unrated. Null when the rating's version is the published one.
 */
export function gcDifficultyCarryLine(s: GcDifficultyStanding): string | null {
  if (!s.carry || !s.publishedVersion) return null
  const unrated = difficultyUnratedWords(s.carry, s.publishedVersion.body)
  const head = `Rated under version ${s.version?.version ?? '?'}; version ${s.publishedVersion.version} is published.`
  return unrated ? `${head} ${unrated}` : `${head} Every pick carries.`
}

/** The picks the card opens with: the newest rating's, carried to the published version. */
export function gcDifficultyOpeningPicks(s: GcDifficultyStanding | null): DifficultyPicks {
  if (!s) return {}
  if (s.carry) return s.carry.picks
  return { ...s.rating.picks }
}

/** The rules a rating keeps before it is saved; the first line is what the press says. */
export function gcDifficultyDraftProblems(picks: DifficultyPicks, note: string, body: DifficultyCriteriaBody | null): string[] {
  if (!body) return [GC_DIFFICULTY_WORDS.noVersion]
  const problems: string[] = []
  const picked = Object.keys(picks).filter((k) => difficultyScale(body, k)?.source === 'picked')
  if (picked.length === 0) problems.push(GC_DIFFICULTY_WORDS.noPick)
  if (note.trim() === '') problems.push(GC_DIFFICULTY_WORDS.noNote)
  return problems
}

/** Whether the picks on screen differ from the rating that stands (as carried), so the press wakes only on a change. */
export function gcDifficultyPicksChanged(picks: DifficultyPicks, standing: GcDifficultyStanding | null): boolean {
  const base = gcDifficultyOpeningPicks(standing)
  const keys = new Set([...Object.keys(base), ...Object.keys(picks)])
  for (const k of keys) if (base[k] !== picks[k]) return true
  return false
}

/** One earlier rating's line: "2026-10-02 · Robert · 3 points · the note". */
export function gcDifficultyHistoryLine(r: GcDifficultyRating, versions: readonly DifficultyVersionLite[]): string {
  const v = versions.find((x) => x.id === r.criteriaVersionId)
  const points = v ? difficultyTotalPoints(r.picks, v.body).points : null
  return [r.ratedAt.slice(0, 10), r.ratedByName.trim() || null, points != null ? difficultyPointsWords(points) : GC_DIFFICULTY_WORDS.versionGone, r.note.trim() || null].filter(Boolean).join(' · ')
}

/**
 * What a save carries: a picked scale's pick when the version has that rung, and a bills scale's point only with its
 * words (PR 3), which the database holds the same way.
 */
export function gcDifficultyPicksToSave(picks: DifficultyPicks, body: DifficultyCriteriaBody, reasons: Record<string, string> = {}): { picks: DifficultyPicks; reasons: Record<string, string> } {
  const out: DifficultyPicks = {}
  const outReasons: Record<string, string> = {}
  for (const [k, p] of Object.entries(picks)) {
    const s = difficultyScale(body, k)
    if (!s || !difficultyScaleHasPoints(s, p)) continue
    if (s.source === 'picked') out[k] = p
    else if ((reasons[k] ?? '').trim() !== '') {
      out[k] = p
      outReasons[k] = reasons[k]!.trim()
    }
  }
  return { picks: out, reasons: outReasons }
}

/** The bills scale's pick the rating that stands holds, with its words; null when it holds none. */
export function gcDifficultyStoredBillsPick(standing: GcDifficultyStanding | null, key: string): { points: number; reason: string } | null {
  const points = standing?.rating.picks[key]
  if (points == null) return null
  return { points, reason: standing?.rating.pickReasons[key] ?? '' }
}
