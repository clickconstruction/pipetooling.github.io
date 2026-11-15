/**
 * GC difficulty rating (punch list #357, PR 6): the picks made on the bid itself.
 *
 * The GC is rated once, on its record. One scale is not the GC's: the site is the job's, so it is picked on the bid
 * (`bid_difficulty_picks`, one row per bid) and priced with the GC's rating into the same difficulty lines, from the
 * Bid Board's site percent. A bid to a GC nobody has rated can still carry a site pick.
 *
 * The carry-over rule holds here too: a pick made under an older version carries to the published one only when
 * its key and its points still exist there, on a scale picked on the bid.
 *
 * Pure: no React, no supabase.
 */
import { difficultyPointsWords, difficultyRungSentence, difficultyScaleHasPoints, type DifficultyCriteriaBody, type DifficultyPicks, type DifficultyScale } from './difficultyCriteria'
import type { DifficultyRatedScale } from './difficultyLines'
import type { GcDifficultyStanding } from './gcDifficultyRating'

export type BidDifficultyPicksRow = { bidId: string; criteriaVersionId: string; picks: DifficultyPicks; pickedByName: string; pickedAt: string }

/** The scales a person picks on the bid. */
export function difficultyBidScales(body: DifficultyCriteriaBody | null): DifficultyScale[] {
  return (body?.scales ?? []).filter((s) => s.scope === 'bid' && s.source === 'picked')
}

/** The stored picks as the published version knows them: only its bid scales, only rungs it has. */
export function bidPicksUnder(picks: DifficultyPicks | null | undefined, body: DifficultyCriteriaBody | null): DifficultyPicks {
  const out: DifficultyPicks = {}
  for (const s of difficultyBidScales(body)) {
    const p = picks?.[s.key]
    if (p != null && difficultyScaleHasPoints(s, p)) out[s.key] = p
  }
  return out
}

/** The bid's own picks as the lines kernel reads them, in the criteria's order. */
export function bidRatedScales(picks: DifficultyPicks, body: DifficultyCriteriaBody | null): DifficultyRatedScale[] {
  if (!body) return []
  return difficultyBidScales(body)
    .filter((s) => picks[s.key] != null)
    .map((s) => ({ key: s.key, name: s.name, points: picks[s.key]!, sentence: difficultyRungSentence(body, s.key, picks[s.key]!) ?? '' }))
}

/** What a bid is priced with: the GC's rated scales under the rating's own version, then the bid's own. */
export function bidDifficultyScalesFor(standing: Pick<GcDifficultyStanding, 'sentences'> | null, bidPicks: DifficultyPicks, published: DifficultyCriteriaBody | null): DifficultyRatedScale[] {
  const own = bidRatedScales(bidPicks, published)
  const ownKeys = new Set(own.map((s) => s.key))
  return [...(standing?.sentences ?? []).filter((s) => !ownKeys.has(s.key)), ...own]
}

/**
 * Whether the bid's own picks differ from what it was priced with (`pin.picks` holds the GC's and the bid's
 * together). Null when they agree, or the version has no bid scale.
 */
export function bidPicksStaleWords(pinPicks: DifficultyPicks | null, bidPicks: DifficultyPicks, body: DifficultyCriteriaBody | null): string | null {
  if (!pinPicks) return null
  for (const s of difficultyBidScales(body)) {
    const was = pinPicks[s.key]
    const now = bidPicks[s.key]
    if (was === now) continue
    const nowWords = now == null ? 'unrated now' : `${difficultyPointsWords(now)} now`
    const wasWords = was == null ? 'unrated when priced' : `${was} when priced`
    return `${s.name} was picked since this was priced: ${nowWords}, ${wasWords}.`
  }
  return null
}

/** One bid scale's line on the Workbench: "The site: 1 point · An occupied building, or no room to stage." */
export function bidPickLineWords(scale: DifficultyScale, picks: DifficultyPicks, body: DifficultyCriteriaBody): string {
  const p = picks[scale.key]
  if (p == null) return `${scale.name}: not picked on this bid`
  const sentence = difficultyRungSentence(body, scale.key, p)
  return `${scale.name}: ${difficultyPointsWords(p)}${sentence ? ` · ${sentence}` : ''}`
}

export const BID_PICK_WORDS = {
  lead: 'Picked on this bid, not on the GC. The Bid Board’s price list turns the points into field hours.',
  pick: 'Pick',
  change: 'Change',
  close: 'Done',
  saving: 'Saving…',
  failed: 'The pick was not saved.',
  sent: 'The bid is sent, so its picks are kept as they were.',
  clear: 'Clear the pick',
  sheetHead: 'On this bid',
} as const
