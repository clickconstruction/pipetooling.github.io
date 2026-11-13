/**
 * Who pays the bills on a job with a paper on the other side's form (punch list #323, PR 7): the
 * payer the Their paper sheet offers a Pay calendar for. The same rule every bill reads
 * (`paySpeedPayer`), asked of the job with no bill in hand. Null when the job names nobody to
 * bill, since a calendar is held on a payer.
 */
import { paySpeedPayer, type PayerNamedJob } from './billToParty'

export function theirPaperPayer(job: PayerNamedJob): { id: string; name: string } | null {
  const payer = paySpeedPayer(job, null)
  if (!payer.id) return null
  return { id: payer.id, name: (payer.name ?? '').trim() || 'this customer' }
}
