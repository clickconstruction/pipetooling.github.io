import type { EstimatorUser } from '../types/bidWithBuilder'

/**
 * Filters the Package and send modal's estimator roster down to the
 * users that should appear as master-technician quick-pick chips
 * across from the SEND TO label.
 *
 * - Keeps only `role === 'master_technician'`.
 * - Requires a non-empty trimmed email, since the modal's Send buttons
 *   only work for recipients that have one on file (mirrors the same
 *   filter applied to the `SearchableSelect` `recipientOptions`).
 * - Sorts by name asc case-insensitive with a deterministic id
 *   tiebreak so chip order is stable across reloads and tests.
 */
export function pickMasterTechRecipients(
  users: ReadonlyArray<EstimatorUser>,
): EstimatorUser[] {
  const out: EstimatorUser[] = []
  for (const u of users) {
    if (!u.id) continue
    if (u.role !== 'master_technician') continue
    const email = (u.email ?? '').trim()
    if (email.length === 0) continue
    out.push(u)
  }
  out.sort((a, b) => {
    const an = (a.name ?? '').trim().toLowerCase()
    const bn = (b.name ?? '').trim().toLowerCase()
    if (an !== bn) return an < bn ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
  return out
}
