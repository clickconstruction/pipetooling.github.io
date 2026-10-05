import type { LienDeskData } from '../../hooks/useLienDeskData'
import { parseLienDeskDraftFields } from './lienNoticeDraft'
import { lienSameProperty } from './lienCalendarBuckets'
import { ownerRecordsProperties, type OwnerRecordsPropertyRow } from './ownerRecords'

/**
 * What the owner-records window reads from the Lien desk (v2.4544, pure): the properties an
 * owner can ask about, the job behind each, and each job's notice claim. Only jobs with a
 * notice on the desk are offered: an owner asks after a notice has reached them.
 */

export type OwnerRecordsDeskSeed = { jobId: string; customerId: string | null; addressId: string | null; gcId: string | null }

export type OwnerRecordsDesk = {
  properties: OwnerRecordsPropertyRow[]
  seedFor: (jobId: string) => OwnerRecordsDeskSeed | null
  /** The newest notice's claim per job; a job whose only row is a missed window has none. */
  claimsByJob: Record<string, number | null>
}

const EMPTY: OwnerRecordsDesk = { properties: [], seedFor: () => null, claimsByJob: {} }

export function ownerRecordsFromDesk(data: LienDeskData | null): OwnerRecordsDesk {
  if (!data) return EMPTY
  const notices = data.items.filter((i) => i.kind === 'notice_53_056' && !i.voided_at)
  const claimsByJob: Record<string, number | null> = {}
  const newest: Record<string, string> = {}
  for (const it of notices) {
    if (!(it.job_id in claimsByJob)) claimsByJob[it.job_id] = null
    if (it.status === 'missed') continue
    const at = it.sent_at ?? it.updated_at ?? it.created_at ?? ''
    if (newest[it.job_id] != null && at <= newest[it.job_id]!) continue
    const claim = Number(parseLienDeskDraftFields(it.fields)?.notice.claimAmount ?? '')
    if (!Number.isFinite(claim)) continue
    newest[it.job_id] = at
    claimsByJob[it.job_id] = claim
  }
  const rows = Object.keys(claimsByJob)
    .map((jobId) => {
      const j = data.jobsById[jobId]
      if (!j) return null
      const o = data.ownerByJob[jobId] ?? null
      const ofRecord = o ? (o.owner_mode === 'building_owner' ? o.company_name || o.owner_name : o.owner_name || o.company_name) : null
      return {
        jobId,
        owner: (ofRecord ?? j.customer_name ?? '').trim(),
        address: (j.job_address ?? '').replace(/\s*\n\s*/g, ', ').trim(),
        addressId: j.customer_address_id,
        gcName: j.gc_customer_id ? data.gcsById[j.gc_customer_id]?.name ?? '' : '',
        gcId: j.gc_customer_id,
        open: Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)),
        customerId: j.customer_id,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
  const byJob = new Map(rows.map((r) => [r.jobId, r]))
  return {
    properties: ownerRecordsProperties(rows, lienSameProperty),
    seedFor: (jobId) => {
      const r = byJob.get(jobId)
      return r ? { jobId, customerId: r.customerId, addressId: r.addressId, gcId: r.gcId } : null
    },
    claimsByJob,
  }
}
