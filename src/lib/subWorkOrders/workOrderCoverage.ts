/**
 * Job work-order coverage (Work Orders tab, PR 1 — v2.2814): does this job
 * have a sub work order, and where does it stand? Mirrors
 * jobContractCoverage for the money-out side. Pure; batch-fed by the board
 * and the Pipeline, single-fed by the job window's fact row.
 */

export type WorkOrderRowLike = {
  id: string
  status: string
  amount: number | null
  display_name: string
  job_id: string | null
  labor_job_id: string | null
  step_id: string | null
  record_id: string | null
  offered_at: string | null
  offer_expires_at: string | null
  signed_at: string | null
  accepted_at: string | null
  declined_at: string | null
  decline_reason: string | null
  created_at: string
}

export type JobWorkOrderCoverage =
  | { kind: 'none' }
  | { kind: 'draft'; id: string; subName: string; unpriced: boolean }
  | { kind: 'sent'; id: string; subName: string; amount: number; sentAt: string | null; expiresOn: string | null; expired: boolean }
  | { kind: 'signed'; id: string; subName: string; amount: number; signedOn: string | null; laborJobId: string | null; recordId: string | null }
  | { kind: 'declined'; id: string; subName: string; reason: string | null }

const RANK: Record<string, number> = { signed: 0, sent: 1, draft: 2, declined: 3 }

function kindOf(r: WorkOrderRowLike, todayYmd: string): JobWorkOrderCoverage | null {
  if (r.status === 'cancelled') return null
  if (r.status === 'accepted' || r.status === 'approved' || r.status === 'settled') {
    return { kind: 'signed', id: r.id, subName: r.display_name, amount: Number(r.amount) || 0, signedOn: (r.signed_at ?? r.accepted_at ?? '').slice(0, 10) || null, laborJobId: r.labor_job_id, recordId: r.record_id }
  }
  if (r.status === 'offered') {
    const exp = (r.offer_expires_at ?? '').trim() || null
    return { kind: 'sent', id: r.id, subName: r.display_name, amount: Number(r.amount) || 0, sentAt: (r.offered_at ?? '').slice(0, 10) || null, expiresOn: exp, expired: !!exp && exp < todayYmd }
  }
  if (r.status === 'declined') return { kind: 'declined', id: r.id, subName: r.display_name, reason: r.decline_reason }
  if (r.status === 'draft') return { kind: 'draft', id: r.id, subName: r.display_name, unpriced: r.amount == null }
  return null
}

/** The one line a job shows: signed beats sent beats draft beats declined; newest within a kind. */
export function buildJobWorkOrderCoverage(rows: WorkOrderRowLike[], todayYmd: string): JobWorkOrderCoverage {
  const candidates = rows
    .map((r) => ({ r, c: kindOf(r, todayYmd) }))
    .filter((x): x is { r: WorkOrderRowLike; c: JobWorkOrderCoverage } => x.c != null && x.c.kind !== 'none')
    .sort((a, b) => (RANK[a.c.kind] ?? 9) - (RANK[b.c.kind] ?? 9) || (b.r.created_at ?? '').localeCompare(a.r.created_at ?? ''))
  return candidates[0]?.c ?? { kind: 'none' }
}

export function workOrderChipLabel(c: JobWorkOrderCoverage | null | undefined): string {
  if (!c || c.kind === 'none') return 'No work order'
  if (c.kind === 'draft') return c.unpriced ? `Draft · needs a price` : 'Draft'
  if (c.kind === 'sent') return c.expired ? 'Offer expired' : 'Awaiting signature'
  if (c.kind === 'signed') return '✍ Signed'
  return 'Declined'
}

export function workOrderChipTone(c: JobWorkOrderCoverage | null | undefined): 'none' | 'draft' | 'sent' | 'signed' | 'declined' {
  if (!c || c.kind === 'none') return 'none'
  return c.kind
}

export function workOrderChipTitle(c: JobWorkOrderCoverage | null | undefined): string {
  if (!c || c.kind === 'none') return 'No sub work order on this job yet'
  if (c.kind === 'draft') return `Draft for ${c.subName}${c.unpriced ? ' — no price set yet' : ''}`
  if (c.kind === 'sent') return `Sent to ${c.subName}${c.sentAt ? ` on ${c.sentAt}` : ''}${c.expiresOn ? ` · good through ${c.expiresOn}` : ''}`
  if (c.kind === 'signed') return `${c.subName} signed${c.signedOn ? ` ${c.signedOn}` : ''}${c.recordId ? ` · ${c.recordId}` : ''}`
  return `${c.subName} declined${c.reason ? `: “${c.reason}”` : ''}`
}

export type WorkOrderBoardFilter = 'all' | 'drafts' | 'awaiting' | 'signed' | 'declined' | 'expired'

/** Board filter for one row. */
export function workOrderBoardBucket(r: WorkOrderRowLike, todayYmd: string): Exclude<WorkOrderBoardFilter, 'all'> | null {
  const c = kindOf(r, todayYmd)
  if (!c || c.kind === 'none') return null
  if (c.kind === 'draft') return 'drafts'
  if (c.kind === 'sent') return c.expired ? 'expired' : 'awaiting'
  if (c.kind === 'signed') return 'signed'
  return 'declined'
}

/**
 * Jobs that carry sub labor but no live or signed work order — the board's
 * "Needs a work order" rows. `sheetJobNumbers` are the job numbers of
 * unpaid sheets; `coverageByJobId` is what buildJobWorkOrderCoverage gave each job.
 */
export function jobsNeedingWorkOrder(
  jobs: Array<{ id: string; hcp_number: string }>,
  sheetJobNumbers: Set<string>,
  coverageByJobId: Map<string, JobWorkOrderCoverage>,
): Array<{ id: string; hcp_number: string }> {
  return jobs.filter((j) => {
    if (!sheetJobNumbers.has(j.hcp_number.trim().toLowerCase())) return false
    const c = coverageByJobId.get(j.id)
    return !c || c.kind === 'none' || c.kind === 'declined'
  })
}
