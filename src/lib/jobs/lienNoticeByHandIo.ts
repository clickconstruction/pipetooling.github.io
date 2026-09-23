import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import { markLienDeskItemSent, syncLienDeskAfterRecord } from './lienDeskIo'
import { byHandFilingPayloads, otherJobsAtProperty, type ByHandInput, type PropertyJobLike } from './lienNoticeByHand'

/**
 * Recording a notice that went out by hand (#35 PR 2): one filing per covered
 * job on one packet, the live desk items marked sent, the desk re-read by the
 * caller. Pure rules live in `lienNoticeByHand.ts`.
 */

export type PropertyJobCandidate = PropertyJobLike & {
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  status: string | null
  /** The live § 53.056 desk item on the job, when there is one. */
  itemId: string | null
}

/** The other unpaid jobs at the primary job's property, with their live desk items — what one paper could have covered. */
export async function loadJobsAtProperty(primary: PropertyJobLike & { id: string }): Promise<PropertyJobCandidate[]> {
  const streetNumber = (primary.job_address ?? '').trim().split(/\s+/)[0] ?? ''
  let q = supabase
    .from('jobs_ledger')
    .select('id, hcp_number, click_number, job_name, job_address, customer_address_id, revenue, payments_made, status')
    .in('status', ['waiting', 'working', 'ready_to_bill', 'billed'])
    .neq('id', primary.id)
  q = primary.customer_address_id ? q.eq('customer_address_id', primary.customer_address_id) : q.ilike('job_address', `${streetNumber}%`)
  if (!primary.customer_address_id && !/^\d/.test(streetNumber)) return []
  const rows = (await withSupabaseRetry<Omit<PropertyJobCandidate, 'itemId'>[]>(() => q, 'notice by hand: jobs at the property')) ?? []
  const others = otherJobsAtProperty(primary, rows)
  if (others.length === 0) return []
  const items = (await withSupabaseRetry<{ id: string; job_id: string; created_at: string }[]>(
    () =>
      supabase
        .from('job_lien_desk_items')
        .select('id, job_id, created_at')
        .in('job_id', others.map((j) => j.id))
        .eq('kind', 'notice_53_056')
        .is('voided_at', null)
        .not('status', 'in', '("sent","missed")')
        .order('created_at', { ascending: false }),
    'notice by hand: desk items',
  ).catch(() => [])) ?? []
  const itemByJob = new Map<string, string>()
  for (const i of items) if (!itemByJob.has(i.job_id)) itemByJob.set(i.job_id, i.id)
  return others.map((j) => ({ ...j, itemId: itemByJob.get(j.id) ?? null }))
}

export type ByHandRecordResult = { packetId: string; filingIds: string[] }

/** Write the filings, mark every covered job's live item sent, and let the desk sync the rest. */
export async function recordLienNoticeByHand(input: ByHandInput, opts: { userId: string | null; fields: LienNoticeFields }): Promise<ByHandRecordResult> {
  const packetId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const fields: LienNoticeFields = { ...opts.fields, claimAmount: input.printedClaim.toFixed(2) }
  const payloads = byHandFilingPayloads(input, { userId: opts.userId, packetId, fieldsFor: () => fields })
  const rows = await withSupabaseRetry<{ id: string; job_id: string }[]>(
    () => supabase.from('job_lien_filings').insert(payloads as never).select('id, job_id'),
    'notice by hand: record',
  )
  const filingByJob = new Map<string, string>()
  for (const r of rows ?? []) filingByJob.set(r.job_id, r.id)
  for (const job of input.jobs) {
    const filingId = filingByJob.get(job.jobId)
    if (job.itemId && filingId) await markLienDeskItemSent(job.itemId, filingId).catch(() => undefined)
    else await syncLienDeskAfterRecord(job.jobId).catch(() => undefined)
  }
  return { packetId, filingIds: [...filingByJob.values()] }
}
