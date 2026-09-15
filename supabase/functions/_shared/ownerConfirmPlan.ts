/**
 * Owner of record — the write plan every confirming surface shares (v2.3447;
 * moved here in PR 3 of the owner-of-record train so the nightly
 * `owner-confirm-nightly` edge function and the browser plan the same rows).
 *
 * Given the jobs at one property, which `customer_addresses` rows a save
 * touches: a job that already links a row updates that row; a job with no
 * row gets one inserted on its home — the customer, or the GC when the job
 * has no customer row (the v2.3401 add-as-property path; never the primary)
 * — and every unlinked job at the property with that home links to the same
 * new row, so one save covers them all, now and later.
 *
 * Dependency-free Deno module, re-exported to the client from
 * `src/lib/jobs/ownerConfirmWrite.ts` and unit-tested from vitest there.
 */

export type OwnerConfirmPlanJob = {
  jobId: string
  customerId: string | null
  gcCustomerId: string | null
  customerAddressId: string | null
}

export type OwnerConfirmPlan = {
  /** Linked rows to update; each carries the jobs that point at it. */
  updates: { customerAddressId: string; jobIds: string[] }[]
  /** One insert per home (customer, else GC); every unlinked job at the property with that home links to it. */
  inserts: { homeCustomerId: string; jobIds: string[] }[]
  /** Jobs with no row and no home at all — nothing to write to. */
  skipped: string[]
}

/** Which rows a save on this property touches, and which jobs each new row will link. */
export function planOwnerConfirmWrites(jobs: ReadonlyArray<OwnerConfirmPlanJob>): OwnerConfirmPlan {
  const updates = new Map<string, string[]>()
  const inserts = new Map<string, string[]>()
  const skipped: string[] = []
  for (const j of jobs) {
    if (j.customerAddressId) {
      const list = updates.get(j.customerAddressId) ?? []
      list.push(j.jobId)
      updates.set(j.customerAddressId, list)
      continue
    }
    const home = j.customerId ?? j.gcCustomerId
    if (!home) {
      skipped.push(j.jobId)
      continue
    }
    const list = inserts.get(home) ?? []
    list.push(j.jobId)
    inserts.set(home, list)
  }
  return {
    updates: [...updates.entries()].map(([customerAddressId, jobIds]) => ({ customerAddressId, jobIds })),
    inserts: [...inserts.entries()].map(([homeCustomerId, jobIds]) => ({ homeCustomerId, jobIds })),
    skipped,
  }
}

/** Street-number + first street token, lower-case, else the whole line lower-cased — the key jobs at one lot share. */
export function ownerConfirmPropertyKey(address: string): string {
  const first = address.split(',')[0] ?? ''
  const m = first.trim().toLowerCase().match(/^(\d+[a-z]?)\s+([a-z0-9]+)/)
  return m ? `${m[1]} ${m[2]}` : address.trim().toLowerCase()
}
