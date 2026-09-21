import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseLienClaimCorrection } from '../lib/jobs/lienClaimCorrectionIo'
import type { LienClaimCorrection } from '../lib/jobs/lienClaimCorrection'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'
import { buildLienDeskQueue, parseLienNoticePolicy, summarizeLienDeskForNeedsYou, type LienDeskItemRow, type LienNoticePolicy } from '../lib/jobs/lienDesk'
import { buildGcOnNotice, type GcNoticeJob, type GcNoticeOwnerState, type GcNoticeSummary, type GcUnpaidMonthRow } from '../lib/jobs/gcOnNotice'
import { lienPropertyOwnerDisplayName, resolveLienProperty, type CustomerAddressRow, type JobPropertyOwnerLike } from '../lib/jobs/lienProperty'
import { ownerFromRollUnconfirmed, ownerKind, type OwnerToConfirmRow } from '../lib/jobs/ownerConfirm'
import { parsePromisedPayDatesRpc, type PromisedPayDate } from '../lib/jobs/billedExpectedPay'
import { parseCustomerTerms, type CustomerPaymentTerms } from '../lib/customerPaymentTerms'
import type { LienDeskData, LienDeskGc, LienDeskJob } from './useLienDeskData'

/**
 * Put a GC on notice (v2.3470): everything the modal reads for one GC —
 * the GC-scoped RPC (`list_gc_unpaid_months`: every job with unpaid work,
 * every month, no window), the live desk items on those jobs, the jobs, the
 * GC with its standing rule and payment terms, the property records and
 * owner overrides (folded into an owner state per job), the promises, whether
 * we have noticed or held this GC before, and the Legal desk matter's jobs.
 * `desk` is the same shape the Lien desk's hook returns, so the run kernel
 * and the run modal take it unchanged.
 */
export type GcOnNoticeData = {
  gc: LienDeskGc | null
  gcTerms: CustomerPaymentTerms
  rows: GcUnpaidMonthRow[]
  jobs: GcNoticeJob[]
  summary: GcNoticeSummary
  desk: LienDeskData
  /** The Fix-ups row shape per job — what the owner lookup and `confirmOwnerForProperty` take. */
  ownerRowByJob: Record<string, OwnerToConfirmRow>
  /** "D. & A. Miller · mail to 212 Kettle Dr" per job with an owner on file. */
  ownerLineByJob: Record<string, string>
  /** The property record's county per job, when it has one (v2.3479). */
  countyByJob: Record<string, string>
  gcHasPriorNotice: boolean
  gcHeldBefore: boolean
  /** The latest live promise across this GC's jobs, if any. */
  promise: PromisedPayDate | null
  /** Jobs already on the GC's Legal desk matter (payer key `c:<gc id>`); the save must keep them. */
  legalMatterJobIds: string[]
  legalMatterExists: boolean
}

function ownerStateFor(address: CustomerAddressRow | null, override: JobPropertyOwnerLike): GcNoticeOwnerState {
  const property = resolveLienProperty(address, override)
  const o = property.owner
  const name = o.ownerCompany || o.ownerName
  if (!name || !o.mailingAddress) return 'missing'
  if (ownerKind(name) === 'public') return 'public'
  if (o.source === 'property_record' && ownerFromRollUnconfirmed(address)) return 'unconfirmed'
  return 'on_file'
}

export function useGcOnNoticeData(gcId: string | null, todayYmd: string): { data: GcOnNoticeData | null; loading: boolean; refetch: () => void } {
  const [data, setData] = useState<GcOnNoticeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!gcId) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rowsRaw = await withSupabaseRetry(() => supabase.rpc('list_gc_unpaid_months' as never, { p_gc_customer_id: gcId } as never), 'GC on notice: unpaid months')
        if (cancelled) return
        const rows = ((rowsRaw ?? []) as unknown as GcUnpaidMonthRow[]).map((r) => ({
          ...r,
          approved_hours: Number(r.approved_hours) || 0,
          open_balance: Number(r.open_balance) || 0,
        }))
        const jobIds = [...new Set(rows.map((r) => r.job_id))]
        const jobs: LienDeskJob[] = []
        const items: LienDeskItemRow[] = []
        for (const chunk of chunkIds(jobIds)) {
          if (chunk.length === 0) continue
          const [part, itemPart] = await Promise.all([
            withSupabaseRetry(
              () =>
                supabase
                  .from('jobs_ledger')
                  .select('id, hcp_number, click_number, job_name, job_address, customer_id, customer_name, gc_customer_id, customer_address_id, revenue, payments_made, master_user_id')
                  .in('id', chunk),
              'GC on notice: jobs',
            ),
            withSupabaseRetry(
              () => supabase.from('job_lien_desk_items').select('*').in('job_id', chunk).eq('kind', 'notice_53_056').is('voided_at', null).order('created_at', { ascending: false }),
              'GC on notice: desk items',
            ),
          ])
          jobs.push(...((part ?? []) as LienDeskJob[]))
          items.push(...((itemPart ?? []) as LienDeskItemRow[]))
        }
        const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
        const [gcRows, addrRows, ownerRows, promisesRaw, priorNoticeRows, heldRows, matterRows, correctionRows] = await Promise.all([
          withSupabaseRetry(
            () => supabase.from('customers').select('id, name, address, contact_info, lien_notice_policy, lien_notice_policy_note, payment_terms, payment_terms_note').eq('id', gcId),
            'GC on notice: the GC',
          ),
          addressIds.length ? withSupabaseRetry(() => supabase.from('customer_addresses').select('*').in('id', addressIds), 'GC on notice: property records') : Promise.resolve([] as CustomerAddressRow[]),
          jobIds.length
            ? withSupabaseRetry(() => supabase.from('job_property_owners').select('job_id, owner_mode, owner_name, company_name, mailing_address, owner_email').in('job_id', jobIds), 'GC on notice: owner overrides')
            : Promise.resolve([]),
          withSupabaseRetry(() => supabase.rpc('list_job_promised_pay_dates' as never), 'GC on notice: promises').catch(() => null),
          withSupabaseRetry(() => supabase.from('job_lien_filings').select('job_id, jobs_ledger!inner(gc_customer_id)').eq('kind', 'notice_53_056').is('voided_at', null).eq('jobs_ledger.gc_customer_id', gcId), 'GC on notice: prior notices').catch(() => []),
          withSupabaseRetry(() => supabase.from('job_lien_desk_items').select('job_id, jobs_ledger!inner(gc_customer_id)').eq('status', 'held').eq('jobs_ledger.gc_customer_id', gcId), 'GC on notice: prior holds').catch(() => []),
          withSupabaseRetry(() => supabase.from('legal_matters').select('id, legal_matter_jobs(job_id)').eq('payer_key', `c:${gcId}`), 'GC on notice: legal matter').catch(() => []),
          jobIds.length ? withSupabaseRetry(() => supabase.from('job_lien_claim_corrections').select('*').in('job_id', jobIds), 'GC on notice: claim corrections').catch(() => []) : Promise.resolve([]),
        ])
        if (cancelled) return
        const gcRow = ((gcRows ?? []) as { id: string; name: string | null; address: string | null; contact_info: unknown; lien_notice_policy: string | null; lien_notice_policy_note: string | null; payment_terms: string | null; payment_terms_note: string | null }[])[0] ?? null
        const ci = (gcRow?.contact_info ?? null) as { email?: unknown } | null
        const policy: LienNoticePolicy = parseLienNoticePolicy(gcRow?.lien_notice_policy)
        const gc: LienDeskGc | null = gcRow
          ? { id: gcRow.id, name: (gcRow.name ?? '').trim(), address: (gcRow.address ?? '').trim(), email: typeof ci?.email === 'string' ? ci.email.trim() : '', policy, policyNote: (gcRow.lien_notice_policy_note ?? '').trim() }
          : null
        const gcTerms = parseCustomerTerms(gcRow ? { payment_terms: gcRow.payment_terms, payment_terms_note: gcRow.payment_terms_note } : null, null).terms
        const addressesById: Record<string, CustomerAddressRow> = {}
        for (const a of (addrRows ?? []) as CustomerAddressRow[]) addressesById[a.id] = a
        const ownerByJob: Record<string, JobPropertyOwnerLike> = {}
        for (const o of (ownerRows ?? []) as (NonNullable<JobPropertyOwnerLike> & { job_id: string })[]) ownerByJob[o.job_id] = o
        const promisesByJob = parsePromisedPayDatesRpc(promisesRaw) ?? {}
        const jobsById: Record<string, LienDeskJob> = {}
        for (const j of jobs) jobsById[j.id] = j
        const gcsById: Record<string, LienDeskGc> = gc ? { [gc.id]: gc } : {}
        const queue = buildLienDeskQueue(rows, items, gc ? { [gc.id]: policy } : {}, todayYmd)
        // The claim set by hand per job (v2.3684): the run claims the corrected figure, as the desk does.
        const claimCorrectionsByJob: Record<string, LienClaimCorrection> = {}
        for (const raw of (correctionRows ?? []) as unknown[]) {
          const c = parseLienClaimCorrection(raw)
          if (c) claimCorrectionsByJob[c.jobId] = c
        }
        const gcHasPriorNotice = ((priorNoticeRows ?? []) as unknown[]).length > 0
        const gcHeldBefore = ((heldRows ?? []) as unknown[]).length > 0
        const desk: LienDeskData = {
          queue,
          summary: summarizeLienDeskForNeedsYou(queue),
          rows,
          items,
          affidavits: { entries: [], piles: { needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } },
          affidavitRows: [],
          jobsById,
          gcsById,
          addressesById,
          ownerByJob,
          promisesByJob,
          gcsWithPriorNotice: new Set(gcHasPriorNotice && gc ? [gc.id] : []),
          gcsHeldBefore: new Set(gcHeldBefore && gc ? [gc.id] : []),
          claimCorrectionsByJob,
        }
        const ownerStateOf = (jobId: string): GcNoticeOwnerState => {
          const job = jobsById[jobId]
          const address = job?.customer_address_id ? addressesById[job.customer_address_id] ?? null : null
          return ownerStateFor(address, ownerByJob[jobId] ?? null)
        }
        const folded = buildGcOnNotice(rows, items, ownerStateOf, todayYmd, (jobId) => claimCorrectionsByJob[jobId] ?? null)
        const ownerRowByJob: Record<string, OwnerToConfirmRow> = {}
        const ownerLineByJob: Record<string, string> = {}
        const countyByJob: Record<string, string> = {}
        for (const j of folded.jobs) {
          const job = jobsById[j.jobId]
          const address = job?.customer_address_id ? addressesById[job.customer_address_id] ?? null : null
          const property = resolveLienProperty(address, ownerByJob[j.jobId] ?? null)
          const name = lienPropertyOwnerDisplayName(property.owner)
          if (name && property.owner.mailingAddress) ownerLineByJob[j.jobId] = `${name} · mail to ${property.owner.mailingAddress}`
          if (property.county) countyByJob[j.jobId] = property.county
          const first = j.months[0]
          ownerRowByJob[j.jobId] = {
            jobId: j.jobId,
            hcpNumber: job?.hcp_number ?? '',
            clickNumber: job?.click_number ?? '',
            jobAddress: (job?.job_address ?? '').trim(),
            status: j.jobStatus,
            customerId: job?.customer_id ?? null,
            customerName: (job?.customer_name ?? '').trim(),
            gcCustomerId: job?.gc_customer_id ?? null,
            gcName: gc?.name ?? '',
            customerAddressId: job?.customer_address_id ?? null,
            hasOwner: j.ownerState !== 'missing',
            ownerConfirmed: j.ownerState === 'on_file' || j.ownerState === 'public',
            propertyKind: j.propertyKind,
            firstWorkMonth: first?.key ?? '',
            firstDeadline: first?.deadline || null,
          }
        }
        let promise: PromisedPayDate | null = null
        for (const id of jobIds) {
          const p = promisesByJob[id]
          if (p && (!promise || p.promisedYmd > promise.promisedYmd)) promise = p
        }
        const matter = ((matterRows ?? []) as { id: string; legal_matter_jobs?: { job_id: string }[] | null }[])[0] ?? null
        setData({
          gc,
          gcTerms,
          rows,
          jobs: folded.jobs,
          summary: folded.summary,
          desk,
          ownerRowByJob,
          ownerLineByJob,
          countyByJob,
          gcHasPriorNotice,
          gcHeldBefore,
          promise,
          legalMatterJobIds: (matter?.legal_matter_jobs ?? []).map((m) => m.job_id),
          legalMatterExists: Boolean(matter),
        })
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gcId, todayYmd, tick])

  return useMemo(() => ({ data, loading, refetch }), [data, loading, refetch])
}
