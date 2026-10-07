import { legalStageLabel, matterIsWithFirm, type LegalMatterRow } from './legalMatters'

/**
 * The amber note in the Uncollectible confirm (punch list #94, v2.4794): when the job's payer has a
 * matter with the firm, marking the job here tells the firm nothing. Null otherwise — the common case
 * stays quiet. The desk's own end (`legal_close_matter` as uncollectible) marks the jobs itself.
 */
export function uncollectibleFirmWarning(matter: Pick<LegalMatterRow, 'stage' | 'closed_at'> | null | undefined): string | null {
  if (!matterIsWithFirm(matter)) return null
  const stage = legalStageLabel(matter!.stage).replace('With the firm · ', '')
  return `The Legal desk has this account with the firm (${stage}). Marking it Uncollectible here tells the firm nothing. Close the matter as uncollectible on the Legal desk instead, or pull it back first.`
}
