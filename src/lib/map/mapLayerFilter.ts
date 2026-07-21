import type { SubmissionSectionKey } from '../bids/submissionSections'

/** Map header layer toggles, including per-stage bid visibility (stages match the Bid Board sections). */
export type MapLayerFilterState = {
  showJobs: boolean
  showBids: boolean
  showEst: boolean
  bidStages: Record<SubmissionSectionKey, boolean>
}

export const ALL_BID_STAGES_ON: Record<SubmissionSectionKey, boolean> = {
  unsent: true,
  pending: true,
  won: true,
  startedOrComplete: true,
  lost: true,
}

/** Map page default (v2.837): only Won and Started bids shown until the user toggles more on. */
export const DEFAULT_MAP_BID_STAGES: Record<SubmissionSectionKey, boolean> = {
  unsent: false,
  pending: false,
  won: true,
  startedOrComplete: true,
  lost: false,
}

/** Shape shared with MapPageEntity; structural to keep this kernel dependency-free. */
export type MapLayerFilterEntity = {
  kind: 'job' | 'bid' | 'estimate'
  bidSection?: SubmissionSectionKey
}

export function mapEntityPassesLayerFilter(e: MapLayerFilterEntity, f: MapLayerFilterState): boolean {
  if (e.kind === 'job') return f.showJobs
  if (e.kind === 'estimate') return f.showEst
  if (!f.showBids) return false
  // A bid we couldn't classify stays visible whenever the Bids layer is on.
  if (e.bidSection === undefined) return true
  return f.bidStages[e.bidSection]
}
