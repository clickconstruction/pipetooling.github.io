/**
 * Builder bid map (v2.1162): focus the /map page on one GC/Builder's bids,
 * color-coded by Bid Board section, to show where we win and where we lose
 * with that builder. Pure — shared by MapPageView and the Builder Review tab.
 */
import type { SubmissionSectionKey } from '../bids/submissionSections'

/** Marker colors in builder-focus mode: outcome first, not entity kind. */
export const BID_STAGE_MARKER_COLOR: Record<SubmissionSectionKey, string> = {
  unsent: '#6b7280',
  pending: '#eab308',
  won: '#16a34a',
  startedOrComplete: '#15803d',
  lost: '#dc2626',
}

/** Focus-mode default stages: everything except unsent (gray noise). */
export const BUILDER_FOCUS_BID_STAGES: Record<SubmissionSectionKey, boolean> = {
  unsent: false,
  pending: true,
  won: true,
  startedOrComplete: true,
  lost: true,
}

export type BuilderBidOutcomeCounts = {
  won: number
  lost: number
  pending: number
  unsent: number
  /** Percent 0–100 of decided bids won (won / (won + lost)); null when nothing is decided. */
  hitRatePct: number | null
}

/** Tally a builder's bids by section. `startedOrComplete` counts as won (the job started — we definitely won it). */
export function builderBidOutcomeCounts(
  sections: Array<SubmissionSectionKey | null | undefined>,
): BuilderBidOutcomeCounts {
  let won = 0
  let lost = 0
  let pending = 0
  let unsent = 0
  for (const s of sections) {
    if (s === 'won' || s === 'startedOrComplete') won++
    else if (s === 'lost') lost++
    else if (s === 'pending') pending++
    else if (s === 'unsent') unsent++
  }
  const decided = won + lost
  return {
    won,
    lost,
    pending,
    unsent,
    hitRatePct: decided > 0 ? Math.round((won / decided) * 100) : null,
  }
}
