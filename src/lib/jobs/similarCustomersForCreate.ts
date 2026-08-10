import { nameSimilarity } from '../../utils/nameSimilarity'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

/**
 * The "Possible matches – link instead?" list of the Create-customer-from-job
 * modal: fuzzy/substring name matches against the typed customer name, best
 * first, capped at 10.
 *
 * Only customers owned by the JOB's master are offered (when the master is
 * known): a cross-master pick can never link — jobs_ledger_customer_master_match
 * rejects the update ("Job linked customer must belong to the job master"), so
 * offering one produced a row that flashed an error toast and otherwise looked
 * like a dead click. `jobMasterUserId === null` (master not resolvable, e.g.
 * signed-out edge) skips the ownership filter rather than hiding everything.
 */
export function computeSimilarCustomersForCreate(
  all: CustomerRow[],
  customerName: string,
  jobMasterUserId: string | null,
): CustomerRow[] {
  const name = customerName.trim()
  if (!name) return []
  const nameLower = name.toLowerCase()
  return all
    .filter((c) => jobMasterUserId == null || c.master_user_id === jobMasterUserId)
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
