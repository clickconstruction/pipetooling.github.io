import { nameSimilarity } from '../../utils/nameSimilarity'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

/**
 * The "Possible matches – link instead?" list of the Create-customer-from-job
 * modal: fuzzy/substring name matches against the typed customer name, best
 * first, capped at 10.
 *
 * Every customer is offered whichever account filed it — one company (v2.2972)
 * retired the cross-master link refusal, so the ownership filter this used to
 * apply is gone. `_jobMasterUserId` stays in the signature for the callers.
 */
export function computeSimilarCustomersForCreate(
  all: CustomerRow[],
  customerName: string,
  _jobMasterUserId: string | null,
): CustomerRow[] {
  const name = customerName.trim()
  if (!name) return []
  const nameLower = name.toLowerCase()
  return all
    .map((c) => ({ c, sim: nameSimilarity(name, c.name ?? '') }))
    .filter(({ c, sim }) => {
      const cName = (c.name ?? '').trim().toLowerCase()
      // Unnamed rows matched everything via `nameLower.includes('')` pre-extraction.
      if (!cName) return false
      return sim >= 0.7 || cName.includes(nameLower) || nameLower.includes(cName)
    })
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 10)
    .map(({ c }) => c)
}
