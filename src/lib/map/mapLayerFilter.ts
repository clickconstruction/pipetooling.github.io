import type { SubmissionSectionKey } from '../bids/submissionSections'
import type { JobsMapSection } from '../jobs/jobsMap'

/**
 * The chips over the Map page's map (v2.4802): one switch per job section (the
 * Pipeline's), per bid stage (the Bid Board's) and for estimates. A record
 * with no section (a job off the pipeline, a bid the board cannot place) stays
 * visible whenever any chip of its kind is on.
 */
export type MapLayerFilterState = {
  jobSections: Record<JobsMapSection, boolean>
  bidStages: Record<SubmissionSectionKey, boolean>
  showEst: boolean
}

export const ALL_BID_STAGES_ON: Record<SubmissionSectionKey, boolean> = {
  unsent: true,
  pending: true,
  won: true,
  startedOrComplete: true,
  lost: true,
}

/** Map page default (v2.4802): every stage but Lost — the Bid Board map's own default. */
export const DEFAULT_MAP_BID_STAGES: Record<SubmissionSectionKey, boolean> = {
  unsent: true,
  pending: true,
  won: true,
  startedOrComplete: true,
  lost: false,
}

/** Shape shared with MapPageEntity; structural to keep this kernel dependency-free. */
export type MapLayerFilterEntity = {
  kind: 'job' | 'bid' | 'estimate'
  jobSection?: JobsMapSection | null
  bidSection?: SubmissionSectionKey
}

function anyOn(o: Record<string, boolean>): boolean {
  return Object.values(o).some(Boolean)
}

export function mapEntityPassesLayerFilter(e: MapLayerFilterEntity, f: MapLayerFilterState): boolean {
  if (e.kind === 'estimate') return f.showEst
  if (e.kind === 'job') {
    if (e.jobSection == null) return anyOn(f.jobSections)
    return f.jobSections[e.jobSection]
  }
  if (e.bidSection === undefined) return anyOn(f.bidStages)
  return f.bidStages[e.bidSection]
}
