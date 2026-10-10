import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'
import {
  buildLienDeskQueue,
  parseLienNoticePolicy,
  summarizeLienDeskForNeedsYou,
  LIEN_DESK_LEAD_DAYS,
  type LienDeskItemRow,
  type LienDeskNeedsYou,
  type LienDeskQueue,
  type LienNoticeMonthRow,
  type LienNoticePolicy,
} from '../lib/jobs/lienDesk'
import { parsePromisedPayDatesRpc, type PromisedPayDate } from '../lib/jobs/billedExpectedPay'
import { buildLienAffidavitQueue, type LienAffidavitQueue, type LienAffidavitRow } from '../lib/jobs/lienDeskAffidavits'
import { buildLienRetainageQueue, EMPTY_LIEN_RETAINAGE_QUEUE, type LienRetainageQueue, type LienRetainageRow } from '../lib/jobs/lienDeskRetainage'
import { letterTwoByJobFrom, summarizeLetterTwo, type LetterTwoStatus } from '../lib/jobs/lienLetterTwo'
import { ownerCallByJobFrom, type OwnerCall } from '../lib/jobs/lienOwnerCall'
import { formatYmdMonthDay } from '../lib/jobs/billedExpectedPay'
import type { CustomerAddressRow, JobPropertyOwnerLike } from '../lib/jobs/lienProperty'
import { lienDeskBatches } from '../lib/jobs/gcOnNotice'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { parseLienClaimCorrection } from '../lib/jobs/lienClaimCorrectionIo'
import type { LienClaimCorrection } from '../lib/jobs/lienClaimCorrection'
import type { JobLienFilingRow } from '../lib/jobs/lienDeadlines'
import type { JobDemandLetterRow } from '../lib/jobs/demandLetterTracking'
import { zzTestJobIds } from '../lib/jobs/zzTestJobVisibility'

/** The slice of jobs_ledger the desk shows and prints from. */
export type LienDeskJob = {
  id: string
  hcp_number: string
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id: string | null
  customer_name: string | null
  gc_customer_id: string | null
  customer_address_id: string | null
  revenue: number | null
  payments_made: number | null
  master_user_id: string | null
  /** 'YYYY-MM-DD' — the timeline's last-work fallback when the RPC's months are older (v2.3761). */
  last_work_date: string | null
  /** The day the job was created — the last-day line's fallback when there are no clock hours (v2.4676). */
  created_at?: string | null
  /** The lien clock (v2.3753): the day our contract on the job ended and how; null while open. */
  lien_contract_ended_on?: string | null
  lien_contract_ended_how?: string | null
  /** The last day of work set by hand (v2.4676), with who, when and why; null while the clock hours (or the creation day) stand. */
  lien_last_work_on?: string | null
  lien_last_work_note?: string | null
  lien_last_work_set_at?: string | null
  lien_last_work_set_by?: string | null
  /** Unpaid subcontract retainage the GC holds (v2.3753); null = not recorded. */
  lien_retainage_held?: number | null
  lien_payment_bond?: string | null
  /** The job's trade (v2.3849) — the letters' "plumbing contractor" / "electrical contractor" and the form's default type of labor. */
  service_type?: { name: string } | null
}

/** The columns the desk reads from jobs_ledger. */
export const LIEN_DESK_JOB_COLUMNS = 'id, hcp_number, click_number, job_name, job_address, customer_id, customer_name, gc_customer_id, customer_address_id, revenue, payments_made, master_user_id, last_work_date, lien_contract_ended_on, lien_contract_ended_how, lien_retainage_held, lien_payment_bond, service_type:service_types(name), created_at'


/** The four lien-clock columns (v2.3753) on their own — the lien timeline book reads them beside its own job select; the desk and the GC run read them in LIEN_DESK_JOB_COLUMNS. */
export type LienClockColumns = Pick<LienDeskJob, 'lien_contract_ended_on' | 'lien_contract_ended_how' | 'lien_retainage_held' | 'lien_payment_bond' | 'lien_last_work_on' | 'lien_last_work_note' | 'lien_last_work_set_at' | 'lien_last_work_set_by'>

export async function fetchLienClockColumns(jobIds: ReadonlyArray<string>): Promise<Record<string, LienClockColumns>> {
  const out: Record<string, LienClockColumns> = {}
  for (const chunk of chunkIds([...jobIds])) {
    if (chunk.length === 0) continue
    // The last-day columns (v2.4676) ride along once the migration is on prod; until then the four clock columns alone, so the desk never goes dark on a client that landed first.
    const part = await withSupabaseRetry(
      () => supabase.from('jobs_ledger').select('id, lien_contract_ended_on, lien_contract_ended_how, lien_retainage_held, lien_payment_bond, lien_last_work_on, lien_last_work_note, lien_last_work_set_at, lien_last_work_set_by').in('id', chunk),
      'lien desk: lien clock columns',
    ).catch(() =>
      withSupabaseRetry(
        () => supabase.from('jobs_ledger').select('id, lien_contract_ended_on, lien_contract_ended_how, lien_retainage_held, lien_payment_bond').in('id', chunk),
        'lien desk: lien clock columns (without the last day)',
      ),
    )
    for (const r0 of part ?? []) {
      const r = r0 as typeof r0 & { lien_last_work_on?: string | null; lien_last_work_note?: string | null; lien_last_work_set_at?: string | null; lien_last_work_set_by?: string | null }
      out[r.id] = { lien_contract_ended_on: r.lien_contract_ended_on ?? null, lien_contract_ended_how: r.lien_contract_ended_how ?? null, lien_retainage_held: r.lien_retainage_held == null ? null : Number(r.lien_retainage_held), lien_payment_bond: r.lien_payment_bond ?? null, lien_last_work_on: r.lien_last_work_on ?? null, lien_last_work_note: r.lien_last_work_note ?? null, lien_last_work_set_at: r.lien_last_work_set_at ?? null, lien_last_work_set_by: r.lien_last_work_set_by ?? null }
    }
  }
  return out
}

export type LienDeskGc = {
  id: string
  name: string
  address: string
  email: string
  policy: LienNoticePolicy
  policyNote: string
}

export type LienDeskData = {
  queue: LienDeskQueue
  summary: LienDeskNeedsYou
  rows: LienNoticeMonthRow[]
  items: LienDeskItemRow[]
  /** The affidavit kind (v2.3412): the § 53.052 window per job. */
  affidavits: LienAffidavitQueue
  affidavitRows: LienAffidavitRow[]
  /** The retainage kind (v2.3753): the § 53.057 window per job with recorded retainage. */
  retainage: LienRetainageQueue
  retainageRows: LienRetainageRow[]
  /** Letter two (v2.3760): where the second owner letter stands on every job with a sent notice. */
  letterTwoByJob: Record<string, LetterTwoStatus>
  /** The owner's call per job (v2.3767), from the notice items — the affidavit piles and the grid read it. */
  ownerCallByJob: Record<string, OwnerCall>
  jobsById: Record<string, LienDeskJob>
  gcsById: Record<string, LienDeskGc>
  addressesById: Record<string, CustomerAddressRow>
  ownerByJob: Record<string, JobPropertyOwnerLike>
  promisesByJob: Record<string, PromisedPayDate>
  /** GCs that already received at least one live § 53.056 notice from us (any job). */
  gcsWithPriorNotice: ReadonlySet<string>
  /** GCs with a held desk item, live or past (the leader held them before). */
  gcsHeldBefore: ReadonlySet<string>
  /** The claim set by hand per job (v2.3682) — empty when none, or when the table is not there yet. */
  claimCorrectionsByJob: Record<string, LienClaimCorrection>
  /** The job's affidavits and releases of record (v2.3761) — the timeline's tail; empty in light mode. */
  filingsByJob: Record<string, JobLienFilingRow[]>
  /** The job's live demand letters (v2.3880) — the timeline's demand node on the desk's panes; absent in light mode and on the GC run. */
  demandLettersByJob?: Record<string, JobDemandLetterRow[]>
}

const EMPTY_AFFIDAVITS: LienAffidavitQueue = {
  entries: [],
  piles: { needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] },
  counts: { needs_property: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 },
}

const EMPTY_QUEUE: LienDeskQueue = {
  entries: [],
  piles: { needs_owner: [], to_draft: [], awaiting: [], ready: [], printed: [], held: [], sent: [], missed: [] },
  counts: { needs_owner: 0, to_draft: 0, awaiting: 0, ready: 0, printed: 0, held: 0, sent: 0, missed: 0 },
}

/**
 * Everything the Lien desk reads: the RPC's due months, the stored items,
 * the jobs, the GCs (with their standing rule), the property records and
 * owner overrides, the promises, and which GCs we have noticed or held
 * before. `light` fetches only what the Dashboard count needs. Null while
 * loading; an empty queue on error so the cards stay quiet.
 *
 * `hideZzTestJobs` (punch list #61, PR 3): ZZ test jobs leave all four lists (the due months, the items,
 * the affidavit and retainage windows) and the jobs, right after the jobs join, before any queue is built.
 * The joined rows carry the job's and the customer's names, so no shared read is needed.
 */
export function useLienDeskData(
  enabled: boolean,
  todayYmd: string,
  opts?: { light?: boolean; hideZzTestJobs?: boolean },
): { data: LienDeskData | null; loading: boolean; refetch: () => void } {
  const [data, setData] = useState<LienDeskData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const light = opts?.light === true
  const hideZz = opts?.hideZzTestJobs === true
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [rowsRaw, itemsRaw, affRaw, retRaw] = await Promise.all([
          withSupabaseRetry(() => supabase.rpc('list_lien_notice_months', { p_within_days: LIEN_DESK_LEAD_DAYS } as never), 'lien desk: due months'),
          withSupabaseRetry(
            () => supabase.from('job_lien_desk_items').select('*').is('voided_at', null).order('created_at', { ascending: false }),
            'lien desk: items',
          ),
          withSupabaseRetry(() => supabase.rpc('list_lien_affidavit_windows', { p_within_days: LIEN_DESK_LEAD_DAYS } as never), 'lien desk: affidavit windows').catch(() => []),
          // The retainage reader (v2.3753) — empty until its migration is pushed, so the client can ship first.
          withSupabaseRetry(() => supabase.rpc('list_lien_retainage_windows' as never, { p_within_days: LIEN_DESK_LEAD_DAYS } as never), 'lien desk: retainage windows').catch(() => []),
        ])
        if (cancelled) return
        const rowsRead = ((rowsRaw ?? []) as unknown as LienNoticeMonthRow[]).map((r) => ({
          ...r,
          approved_hours: Number(r.approved_hours) || 0,
          open_balance: Number(r.open_balance) || 0,
        }))
        const itemsRead = (itemsRaw ?? []) as LienDeskItemRow[]
        const affidavitRowsRead = ((affRaw ?? []) as unknown as LienAffidavitRow[]).map((r) => ({ ...r, open_balance: Number(r.open_balance) || 0 }))
        const retainageRowsRead = ((retRaw ?? []) as unknown as LienRetainageRow[]).map((r) => ({ ...r, retainage_held: Number(r.retainage_held) || 0, open_balance: Number(r.open_balance) || 0 }))
        const jobIdsRead = [...new Set([...rowsRead.map((r) => r.job_id), ...itemsRead.map((i) => i.job_id), ...affidavitRowsRead.map((r) => r.job_id), ...retainageRowsRead.map((r) => r.job_id)])]

        // The GCs' standing rules come with the jobs; everything else is the desk's own detail.
        const jobsRead: LienDeskJob[] = []
        for (const chunk of chunkIds(jobIdsRead)) {
          if (chunk.length === 0) continue
          const part = await withSupabaseRetry(
            () =>
              supabase
                .from('jobs_ledger')
                .select(LIEN_DESK_JOB_COLUMNS)
                .in('id', chunk),
            'lien desk: jobs',
          )
          jobsRead.push(...((part ?? []) as LienDeskJob[]))
        }
        // ZZ test jobs (punch list #61, PR 3) leave every list here, by the joined rows' own names.
        const zzJobIds = hideZz ? zzTestJobIds(jobsRead) : null
        const kept = (jobId: string) => !zzJobIds?.has(jobId)
        const rows = zzJobIds ? rowsRead.filter((r) => kept(r.job_id)) : rowsRead
        const allItems = zzJobIds ? itemsRead.filter((i) => kept(i.job_id)) : itemsRead
        const affidavitRows = zzJobIds ? affidavitRowsRead.filter((r) => kept(r.job_id)) : affidavitRowsRead
        const retainageRows = zzJobIds ? retainageRowsRead.filter((r) => kept(r.job_id)) : retainageRowsRead
        const jobs = zzJobIds ? jobsRead.filter((j) => kept(j.id)) : jobsRead
        const jobIds = zzJobIds ? jobIdsRead.filter(kept) : jobIdsRead
        const items = allItems.filter((i) => i.kind === 'notice_53_056')
        const affidavits = buildLienAffidavitQueue(affidavitRows, allItems, todayYmd)
        const retainage = buildLienRetainageQueue(retainageRows, allItems, todayYmd)
        const gcIds = new Set<string>(rows.map((r) => r.gc_customer_id).filter((v): v is string => Boolean(v)))
        for (const j of jobs) if (j.gc_customer_id) gcIds.add(j.gc_customer_id)
        for (const r of affidavitRows) if (r.gc_customer_id) gcIds.add(r.gc_customer_id)
        for (const r of retainageRows) if (r.gc_customer_id) gcIds.add(r.gc_customer_id)
        const gcRows = gcIds.size
          ? await withSupabaseRetry(
              () => supabase.from('customers').select('id, name, address, contact_info, lien_notice_policy, lien_notice_policy_note').in('id', [...gcIds]),
              'lien desk: GCs',
            )
          : []
        if (cancelled) return
        const gcsById: Record<string, LienDeskGc> = {}
        const policyByCustomer: Record<string, LienNoticePolicy> = {}
        for (const c of (gcRows ?? []) as { id: string; name: string | null; address: string | null; contact_info: unknown; lien_notice_policy: string | null; lien_notice_policy_note: string | null }[]) {
          const ci = (c.contact_info ?? null) as { email?: unknown } | null
          const policy = parseLienNoticePolicy(c.lien_notice_policy)
          policyByCustomer[c.id] = policy
          gcsById[c.id] = {
            id: c.id,
            name: (c.name ?? '').trim(),
            address: (c.address ?? '').trim(),
            email: typeof ci?.email === 'string' ? ci.email.trim() : '',
            policy,
            policyNote: (c.lien_notice_policy_note ?? '').trim(),
          }
        }
        const queue = buildLienDeskQueue(rows, items, policyByCustomer, todayYmd)
        const gcNames: Record<string, string> = {}
        for (const g of Object.values(gcsById)) gcNames[g.id] = g.name
        const summaryWithBatches = summarizeLienDeskForNeedsYou(queue)
        summaryWithBatches.leader.batches = lienDeskBatches(queue, gcNames)
        const jobsById: Record<string, LienDeskJob> = {}
        for (const j of jobs) jobsById[j.id] = j
        // Letter two (v2.3760): the second owner letter's clock per job, from the notice items and the job's own balance.
        const letterTwoByJob = letterTwoByJobFrom(items, (id) => Math.max(0, Number(jobsById[id]?.revenue ?? 0) - Number(jobsById[id]?.payments_made ?? 0)), todayYmd, formatYmdMonthDay)
        summaryWithBatches.office.letterTwo = summarizeLetterTwo(letterTwoByJob)
        const ownerCallByJob = ownerCallByJobFrom(items)
        // The next deadline's GCs by name (v2.3704) — the kernel only knows ids.
        summaryWithBatches.office.next.gcNames = summaryWithBatches.office.next.gcIds.map((id) => gcsById[id]?.name || 'a GC')
        // The missed lines carry the job's name (v2.3679) — the kernel only knows ids.
        summaryWithBatches.missed.lines = summaryWithBatches.missed.lines.map((l) => {
          const j = jobsById[l.jobId]
          const number = j ? effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '' : ''
          const name = (j?.job_name ?? '').trim()
          return { ...l, label: [number, name].filter(Boolean).join(' · ') || l.jobId.slice(0, 8) }
        })

        let addressesById: Record<string, CustomerAddressRow> = {}
        let ownerByJob: Record<string, JobPropertyOwnerLike> = {}
        let promisesByJob: Record<string, PromisedPayDate> = {}
        let gcsWithPriorNotice = new Set<string>()
        let gcsHeldBefore = new Set<string>()
        let claimCorrectionsByJob: Record<string, LienClaimCorrection> = {}
        let filingsByJob: Record<string, JobLienFilingRow[]> = {}
        let demandLettersByJob: Record<string, JobDemandLetterRow[]> = {}
        if (!light) {
          const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
          const [addrRows, ownerRows, promisesRaw, priorNoticeRows, heldRows] = await Promise.all([
            addressIds.length
              ? withSupabaseRetry(() => supabase.from('customer_addresses').select('*').in('id', addressIds), 'lien desk: property records')
              : Promise.resolve([] as CustomerAddressRow[]),
            jobIds.length
              ? withSupabaseRetry(
                  () => supabase.from('job_property_owners').select('job_id, owner_mode, owner_name, company_name, mailing_address, owner_email').in('job_id', jobIds),
                  'lien desk: owner overrides',
                )
              : Promise.resolve([]),
            withSupabaseRetry(() => supabase.rpc('list_job_promised_pay_dates' as never), 'lien desk: promises').catch(() => null),
            withSupabaseRetry(
              () => supabase.from('job_lien_filings').select('job_id, jobs_ledger!inner(gc_customer_id)').eq('kind', 'notice_53_056').is('voided_at', null),
              'lien desk: prior notices',
            ).catch(() => []),
            withSupabaseRetry(
              () => supabase.from('job_lien_desk_items').select('job_id, jobs_ledger!inner(gc_customer_id)').eq('status', 'held'),
              'lien desk: prior holds',
            ).catch(() => []),
          ])
          if (cancelled) return
          // The tail of each job's timeline (v2.3761): affidavits filed and served, releases of record — and the notices that went out, for the months grid (#38).
          filingsByJob = {}
          for (const chunk of chunkIds(jobIds)) {
            if (chunk.length === 0) continue
            const part = await withSupabaseRetry(
              () => supabase.from('job_lien_filings').select('*').in('job_id', chunk).in('kind', ['notice_53_056', 'affidavit', 'release_of_record']).is('voided_at', null),
              'lien desk: filings',
            ).catch(() => [])
            for (const f of (part ?? []) as JobLienFilingRow[]) (filingsByJob[f.job_id] ??= []).push(f)
          }
          // The demand letters on the desk's jobs (v2.3880): one read, so every pane's strip carries the letter the Lien window draws.
          demandLettersByJob = {}
          for (const chunk of chunkIds(jobIds)) {
            if (chunk.length === 0) continue
            const part = await withSupabaseRetry(
              () => supabase.from('job_demand_letters').select('*').in('job_id', chunk).is('voided_at', null),
              'lien desk: demand letters',
            ).catch(() => [])
            for (const l of (part ?? []) as JobDemandLetterRow[]) (demandLettersByJob[l.job_id] ??= []).push(l)
          }
          if (cancelled) return
          addressesById = {}
          for (const a of (addrRows ?? []) as CustomerAddressRow[]) addressesById[a.id] = a
          ownerByJob = {}
          for (const o of (ownerRows ?? []) as (NonNullable<JobPropertyOwnerLike> & { job_id: string })[]) ownerByJob[o.job_id] = o
          promisesByJob = parsePromisedPayDatesRpc(promisesRaw) ?? {}
          const gcOf = (r: unknown): string | null => {
            const j = (r as { jobs_ledger?: { gc_customer_id?: string | null } | { gc_customer_id?: string | null }[] | null }).jobs_ledger
            const one = Array.isArray(j) ? j[0] : j
            return one?.gc_customer_id ?? null
          }
          gcsWithPriorNotice = new Set((priorNoticeRows as unknown[]).map(gcOf).filter((v): v is string => Boolean(v)))
          gcsHeldBefore = new Set((heldRows as unknown[]).map(gcOf).filter((v): v is string => Boolean(v)))
        }
        // The claim set by hand per job (v2.3682) — loaded in light mode too (v2.3684): one indexed select, and the Stages board's Collections line reads it.
        if (jobIds.length) {
          const correctionRows = await withSupabaseRetry(() => supabase.from('job_lien_claim_corrections').select('*').in('job_id', jobIds), 'lien desk: claim corrections').catch(() => [])
          if (cancelled) return
          claimCorrectionsByJob = {}
          for (const raw of (correctionRows ?? []) as unknown[]) {
            const c = parseLienClaimCorrection(raw)
            if (c) claimCorrectionsByJob[c.jobId] = c
          }
        }
        if (cancelled) return
        setData({
          queue,
          summary: summaryWithBatches,
          rows,
          items,
          affidavits,
          affidavitRows,
          retainage,
          retainageRows,
          letterTwoByJob,
          ownerCallByJob,
          jobsById,
          gcsById,
          addressesById,
          ownerByJob,
          promisesByJob,
          gcsWithPriorNotice,
          gcsHeldBefore,
          claimCorrectionsByJob,
          filingsByJob,
          demandLettersByJob,
        })
      } catch {
        if (!cancelled)
          setData({
            queue: EMPTY_QUEUE,
            summary: summarizeLienDeskForNeedsYou(EMPTY_QUEUE),
            rows: [],
            items: [],
            affidavits: EMPTY_AFFIDAVITS,
            affidavitRows: [],
            retainage: EMPTY_LIEN_RETAINAGE_QUEUE(),
            retainageRows: [],
            letterTwoByJob: {},
            ownerCallByJob: {},
            jobsById: {},
            gcsById: {},
            addressesById: {},
            ownerByJob: {},
            promisesByJob: {},
            gcsWithPriorNotice: new Set(),
            gcsHeldBefore: new Set(),
            claimCorrectionsByJob: {}, filingsByJob: {},
          })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, todayYmd, light, hideZz, tick])

  return useMemo(() => ({ data, loading, refetch }), [data, loading, refetch])
}
