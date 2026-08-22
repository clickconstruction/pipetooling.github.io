/**
 * Job review queue kernel (PARTNERSHIPS_PLAN.md PR 2).
 *
 * Pure shaping behind the Partnerships → Job review tab: defensive parsing of
 * the get_partner_job_review_queue RPC payload, the hours-share suggestion
 * math, row ordering, and (v2.2107) the automatic-threshold eligibility rule.
 * By default the share is a suggestion and the human toggle is the §3
 * "majority of the work" decision; a partnership may opt into an automatic
 * threshold, whose adds are stamped as automatic and whose rule never
 * overrides a human clear (auto_exempt).
 */

export type PartnerJobReviewRow = {
  job_id: string
  label: string
  job_name: string | null
  partner_hours: number
  total_hours: number
  partner_person_id: string | null
  confirmed_at: string | null
  confirmed_by_name: string | null
  /** Set when the confirm was made by the auto-threshold rule (the percent it fired at). */
  confirmed_auto_pct: number | null
  /** True when a human cleared this job — the auto rule must never re-add it. */
  auto_exempt: boolean
}

export type PartnerJobReviewQueue = {
  linked: boolean
  partner_person_id: string | null
  rows: PartnerJobReviewRow[]
}

/** Partner share of total job hours, 0–100, safe against zero/garbage totals. */
export function shareOfHours(partnerHours: number, totalHours: number): number {
  if (!Number.isFinite(partnerHours) || !Number.isFinite(totalHours) || totalHours <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((partnerHours / totalHours) * 100)))
}

/** True when the job is confirmed for THIS partnership's person (not some other partner). */
export function isConfirmedForPartner(row: PartnerJobReviewRow, partnerPersonId: string | null): boolean {
  return row.partner_person_id != null && row.partner_person_id === partnerPersonId
}

/**
 * Defensive parse of the RPC payload. Anything malformed degrades to an empty,
 * linked=false queue rather than throwing into the tab.
 */
export function parseReviewQueue(payload: unknown): PartnerJobReviewQueue {
  const empty: PartnerJobReviewQueue = { linked: false, partner_person_id: null, rows: [] }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return empty
  const obj = payload as Record<string, unknown>
  const rawRows = Array.isArray(obj.rows) ? obj.rows : []
  const rows: PartnerJobReviewRow[] = []
  for (const raw of rawRows) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    if (typeof r.job_id !== 'string') continue
    rows.push({
      job_id: r.job_id,
      label: typeof r.label === 'string' && r.label.trim() !== '' ? r.label : r.job_id,
      job_name: typeof r.job_name === 'string' ? r.job_name : null,
      partner_hours: Number(r.partner_hours) || 0,
      total_hours: Number(r.total_hours) || 0,
      partner_person_id: typeof r.partner_person_id === 'string' ? r.partner_person_id : null,
      confirmed_at: typeof r.confirmed_at === 'string' ? r.confirmed_at : null,
      confirmed_by_name: typeof r.confirmed_by_name === 'string' ? r.confirmed_by_name : null,
      confirmed_auto_pct: typeof r.confirmed_auto_pct === 'number' && Number.isFinite(r.confirmed_auto_pct) ? r.confirmed_auto_pct : null,
      auto_exempt: r.auto_exempt === true,
    })
  }
  return {
    linked: obj.linked === true,
    partner_person_id: typeof obj.partner_person_id === 'string' ? obj.partner_person_id : null,
    rows,
  }
}

/** Valid saved threshold: an integer percent from 1 to 100 (NULL/junk = rule off). */
export function isValidThreshold(pct: unknown): pct is number {
  return typeof pct === 'number' && Number.isInteger(pct) && pct >= 1 && pct <= 100
}

/**
 * Jobs the automatic threshold rule would add right now: share at/above the
 * threshold, not confirmed for anyone (the rule never overrides a person),
 * and never explicitly cleared by a human (auto_exempt). Used both to fire
 * the rule on tab load and as the editor's "this would add …" preview.
 */
export function jobsToAutoConfirm(
  rows: PartnerJobReviewRow[],
  thresholdPct: number | null,
): PartnerJobReviewRow[] {
  if (!isValidThreshold(thresholdPct)) return []
  return rows.filter(
    (r) => r.partner_person_id == null && !r.auto_exempt && shareOfHours(r.partner_hours, r.total_hours) >= thresholdPct,
  )
}

/** Unreviewed first (most partner hours first), then confirmed (same order). */
export function sortReviewRows(rows: PartnerJobReviewRow[], partnerPersonId: string | null): PartnerJobReviewRow[] {
  return [...rows].sort((a, b) => {
    const aConfirmed = isConfirmedForPartner(a, partnerPersonId) ? 1 : 0
    const bConfirmed = isConfirmedForPartner(b, partnerPersonId) ? 1 : 0
    if (aConfirmed !== bConfirmed) return aConfirmed - bConfirmed
    return b.partner_hours - a.partner_hours
  })
}
