import { isFinishedJobPickerStatus } from './scheduleDispatchHub'

/** Job row shape the duplicate-address finder needs (subset of jobs_ledger). */
export type DuplicateAddressJob = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  job_address?: string | null
  status?: string | null
  created_at?: string | null
}

export type DuplicateAddressGroup<T extends DuplicateAddressJob> = {
  /** Display address (first-seen spelling). */
  address: string
  jobs: T[]
  /** True when at least one job in the group is not billed/paid — the actionable cases. */
  hasActive: boolean
}

function normalizeAddressKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * All addresses shared by 2+ jobs, for the duplicate finder.
 * Jobs within a group: active before finished, then newest first.
 * Groups: those containing an active job first (the actionable ones), then by
 * job count ASC — pairs are the likely real duplicates, while a many-job address
 * is almost always an intentional staging/phase address — then address A–Z.
 * Blank addresses never group.
 */
export function buildDuplicateJobAddressGroups<T extends DuplicateAddressJob>(
  rows: T[],
): DuplicateAddressGroup<T>[] {
  const byKey = new Map<string, { address: string; jobs: T[] }>()
  for (const r of rows) {
    const raw = (r.job_address ?? '').trim()
    if (raw === '') continue
    const key = normalizeAddressKey(raw)
    const g = byKey.get(key)
    if (g) g.jobs.push(r)
    else byKey.set(key, { address: raw, jobs: [r] })
  }
  const groups: DuplicateAddressGroup<T>[] = []
  for (const g of byKey.values()) {
    if (g.jobs.length < 2) continue
    const jobs = [...g.jobs].sort((a, b) => {
      const fa = isFinishedJobPickerStatus(a.status) ? 1 : 0
      const fb = isFinishedJobPickerStatus(b.status) ? 1 : 0
      if (fa !== fb) return fa - fb
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
    groups.push({ address: g.address, jobs, hasActive: jobs.some((j) => !isFinishedJobPickerStatus(j.status)) })
  }
  groups.sort((a, b) => {
    if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1
    if (a.jobs.length !== b.jobs.length) return a.jobs.length - b.jobs.length
    return a.address.localeCompare(b.address)
  })
  return groups
}
