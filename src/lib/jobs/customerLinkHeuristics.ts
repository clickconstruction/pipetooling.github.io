/**
 * The Pipeline row's "this job is really linked to that customer" guess, for jobs that
 * carry a customer name but no `customer_id`. Lifted verbatim from
 * `jobsStagesRowShared.tsx` (Stage A of the Stages decomposition train) so the rule has
 * tests; both tables and the mobile cards read it through `renderJobCustomerLine`.
 */
export type CustomerLinkCandidate = { name: string | null; master_user_id: string }

/** True when loaded customers include exactly one row matching name (prefer same master_user_id as the job). */
export function customerListImpliesLinkedRow(
  customersList: readonly CustomerLinkCandidate[],
  jobMasterUserId: string,
  customerNameTrimmed: string,
): boolean {
  const nameKey = customerNameTrimmed.trim().toLowerCase()
  if (!nameKey) return false
  const byName = customersList.filter((c) => (c.name ?? '').trim().toLowerCase() === nameKey)
  const byMaster = byName.filter((c) => c.master_user_id === jobMasterUserId)
  if (byMaster.length === 1) return true
  if (byMaster.length === 0 && byName.length === 1) return true
  return false
}
