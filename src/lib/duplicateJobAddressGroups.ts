import { isFinishedJobPickerStatus } from './scheduleDispatchHub'
import { revenueDollarsFromFixtures } from './revenueFromJobFixtures'
import { denverCalendarDaysBetweenInstantAndNow } from '../utils/dateUtils'

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

/** Per-job evidence for the duplicate finder's rows: line items + payment recency. */
export type DupJobEnrichment = {
  lineCount: number
  lineRevenue: number
  /** First few line names joined, "+N more" past the cap; '' when no lines. */
  lineSummary: string
  paidTotal: number
  /** Calendar days since the newest payment (paid_on, falling back to created_at); null when unpaid. */
  lastPaidDaysAgo: number | null
}

const DUP_LINE_SUMMARY_NAME_CAP = 3

export function buildDupJobEnrichments(
  fixtures: Array<{ job_id: string; name: string | null; count: number | null; line_unit_price: number | string | null }>,
  payments: Array<{ job_id: string; amount: number | null; paid_on: string | null; created_at: string | null }>,
  nowMs: number,
): Map<string, DupJobEnrichment> {
  const out = new Map<string, DupJobEnrichment>()
  const ensure = (jobId: string): DupJobEnrichment => {
    let e = out.get(jobId)
    if (!e) {
      e = { lineCount: 0, lineRevenue: 0, lineSummary: '', paidTotal: 0, lastPaidDaysAgo: null }
      out.set(jobId, e)
    }
    return e
  }

  const namesByJob = new Map<string, string[]>()
  const fixturesByJob = new Map<string, Array<{ name: string | null; count: number | null; line_unit_price: number | string | null }>>()
  for (const f of fixtures) {
    const e = ensure(f.job_id)
    e.lineCount += 1
    const names = namesByJob.get(f.job_id) ?? []
    names.push((f.name ?? '').trim() || '(unnamed line)')
    namesByJob.set(f.job_id, names)
    const fl = fixturesByJob.get(f.job_id) ?? []
    fl.push(f)
    fixturesByJob.set(f.job_id, fl)
  }
  for (const [jobId, fl] of fixturesByJob) {
    const e = ensure(jobId)
    e.lineRevenue = revenueDollarsFromFixtures(
      fl.map((f) => ({ name: f.name ?? '', count: f.count ?? 0, line_unit_price: Number(f.line_unit_price) || 0 })),
    )
    const names = namesByJob.get(jobId) ?? []
    const head = names.slice(0, DUP_LINE_SUMMARY_NAME_CAP).join(', ')
    e.lineSummary = names.length > DUP_LINE_SUMMARY_NAME_CAP ? `${head} +${names.length - DUP_LINE_SUMMARY_NAME_CAP} more` : head
  }

  for (const p of payments) {
    const e = ensure(p.job_id)
    e.paidTotal += Number(p.amount) || 0
    const when = (p.paid_on ?? '').trim() || (p.created_at ?? '').trim()
    if (when) {
      const ms = new Date(when.includes('T') ? when : `${when}T12:00:00`).getTime()
      if (Number.isFinite(ms)) {
        const days = denverCalendarDaysBetweenInstantAndNow(ms, nowMs)
        if (e.lastPaidDaysAgo === null || days < e.lastPaidDaysAgo) e.lastPaidDaysAgo = days
      }
    }
  }
  return out
}

/** "today" · "5d ago" · "3 wk ago" · "4 mo ago" — coarse on purpose; recency class, not a date. */
export function formatDaysAgoShort(days: number): string {
  if (days <= 0) return 'today'
  if (days < 14) return `${days}d ago`
  if (days < 61) return `${Math.round(days / 7)} wk ago`
  return `${Math.round(days / 30)} mo ago`
}
