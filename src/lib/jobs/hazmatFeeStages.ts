import type { StagesSectionKey } from './stagesSectionHeader'

/**
 * Where a Pipeline row offers the Hazmat fee press (owner call 2026-11-12): the three stages before the bill
 * goes out. A fee made there joins the open bill, or the next one. A billed row offers Send back instead, and
 * a fee already on a job stays on its riders line in Edit Job.
 */
export type HazmatFeeBoardStage = StagesSectionKey | 'uncollectible' | 'paid'

const OFFERING: ReadonlySet<HazmatFeeBoardStage> = new Set<HazmatFeeBoardStage>(['waiting', 'working', 'readyToBill'])

export function stageOffersHazmatFee(stage: HazmatFeeBoardStage): boolean {
  return OFFERING.has(stage)
}
