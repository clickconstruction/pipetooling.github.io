import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { todayYmdInAppTz } from '../../../utils/dateUtils'
import {
  buildLegalPacket,
  type LegalAccountSummary,
  type LegalClockSessionLike,
  type LegalContactLike,
  type LegalCustomerLike,
  type LegalPacket,
  type LegalReportLike,
  type LegalThreadNoteLike,
} from '../../../lib/legal/legalPacket'
import { classifyPromises, parsePaymentPromisesRpc, parsePromiseRecordsRpc } from '../../../lib/jobs/paymentPromises'
import { parseChaseTouchesRpc } from '../../../lib/jobs/paymentChase'
import type { JobContractRowLike, SignedEstimateLike } from '../../../lib/jobs/jobContractCoverage'
import type { JobDemandLetterRow } from '../../../lib/jobs/demandLetterTracking'
import type { JobLienFilingRow } from '../../../lib/jobs/lienDeadlines'
import type { CustomerAddressRow } from '../../../lib/jobs/lienProperty'

/**
 * Loads every record behind one account's legal packet and folds them through
 * the pure kernel. Each source fails soft on its own — a gated RPC or a
 * not-yet-deployed function leaves that section empty and names itself in
 * `failed`, so the desk can say "couldn't load X" instead of showing a gap
 * that isn't real.
 */
export type LegalPacketData = {
  packet: LegalPacket | null
  loading: boolean
  /** Human names of the sources that failed to load (empty when everything came back). */
  failed: string[]
  reload: () => void
}

type ClockSessionRow = {
  job_ledger_id: string | null
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  clock_in_lat: number | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
}

type ReportRow = {
  created_at: string
  created_by_name: string | null
  template_name: string | null
  reported_at_lat: number | null
}

type ThreadNoteRow = {
  job_id: string
  body: string
  created_at: string
  author: { name: string | null } | null
}

/** PostgREST caps a plain select at 1,000 rows; Collections accounts sit far under it, and the cap is named here so a runaway one is a known shape. */
const ROW_CAP = 1000

export function useLegalPacketData(
  account: LegalAccountSummary | null,
  users: ReadonlyArray<{ id: string; name: string | null }>,
  enabled: boolean,
): LegalPacketData {
  const [packet, setPacket] = useState<LegalPacket | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<string[]>([])
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  const accountKey = account?.key ?? null
  const jobIdsKey = account ? account.jobs.map((j) => j.id).sort().join(',') : ''

  useEffect(() => {
    if (!enabled || !account) {
      setPacket(null)
      setFailed([])
      return
    }
    let cancelled = false
    const jobIds = account.jobs.map((j) => j.id)
    const customerId = account.customerId
    const failures: string[] = []
    const src = async <T,>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn()
      } catch {
        failures.push(name)
        return fallback
      }
    }

    setLoading(true)
    void (async () => {
      const todayYmd = todayYmdInAppTz()
      const [customer, contacts, addresses, contracts, estimates, demandLetters, lienFilings, promises, outcomes, touches, reports, sessions, notes] =
        await Promise.all([
          src<LegalCustomerLike>(
            'customer record',
            async () => {
              if (!customerId) return null
              const row = await withSupabaseRetry<LegalCustomerLike>(
                () =>
                  supabase
                    .from('customers')
                    .select('id, name, address, contact_info, payment_terms, payment_terms_note')
                    .eq('id', customerId)
                    .maybeSingle(),
                'load legal packet customer',
              )
              return row ?? null
            },
            null,
          ),
          src<LegalContactLike[]>(
            'customer contacts',
            async () => {
              if (!customerId) return []
              return (
                (await withSupabaseRetry<LegalContactLike[]>(
                  () => supabase.from('customer_contact_persons').select('name, email, phone, note').eq('customer_id', customerId).order('created_at'),
                  'load legal packet contacts',
                )) ?? []
              )
            },
            [],
          ),
          src<CustomerAddressRow[]>(
            'property record',
            async () => {
              if (!customerId) return []
              return (
                (await withSupabaseRetry<CustomerAddressRow[]>(
                  () => supabase.from('customer_addresses').select('*').eq('customer_id', customerId).order('sequence_order'),
                  'load legal packet property record',
                )) ?? []
              )
            },
            [],
          ),
          src<JobContractRowLike[]>(
            'contracts',
            async () =>
              (await withSupabaseRetry<JobContractRowLike[]>(
                () =>
                  supabase
                    .from('job_contracts')
                    .select(
                      'id, job_id, status, revision, recipient_email, sent_at, last_sent_at, view_count, signed_at, signer_printed_name, signer_mode, voided_at, signed_document_url',
                    )
                    .in('job_id', jobIds)
                    .is('voided_at', null),
                'load legal packet contracts',
              )) ?? [],
            [],
          ),
          src<SignedEstimateLike[]>(
            'accepted estimates',
            async () =>
              (await withSupabaseRetry<SignedEstimateLike[]>(
                () =>
                  supabase
                    .from('estimates')
                    .select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents')
                    .in('job_ledger_id', jobIds)
                    .eq('status', 'customer_accepted')
                    .not('acceptor_consented_at', 'is', null),
                'load legal packet accepted estimates',
              )) ?? [],
            [],
          ),
          src<JobDemandLetterRow[]>(
            'demand letters',
            async () =>
              (await withSupabaseRetry<JobDemandLetterRow[]>(
                () => supabase.from('job_demand_letters').select('*').in('job_id', jobIds),
                'load legal packet demand letters',
              )) ?? [],
            [],
          ),
          src<JobLienFilingRow[]>(
            'lien filings',
            async () =>
              (await withSupabaseRetry<JobLienFilingRow[]>(
                () => supabase.from('job_lien_filings').select('*').in('job_id', jobIds),
                'load legal packet lien filings',
              )) ?? [],
            [],
          ),
          src(
            'payment promises',
            async () => {
              const { data, error } = await supabase.rpc('list_job_payment_promises' as never)
              if (error) throw error
              return (parsePaymentPromisesRpc(data as unknown) ?? []).filter((p) => jobIds.includes(p.jobId))
            },
            [],
          ),
          src(
            'promise record',
            async () => {
              const { data, error } = await supabase.rpc('list_payment_promise_records' as never)
              if (error) throw error
              const records = parsePromiseRecordsRpc(data as unknown) ?? []
              return classifyPromises(records, todayYmd).filter((o) => jobIds.includes(o.jobId))
            },
            [],
          ),
          src(
            'collection calls',
            async () => {
              const { data, error } = await supabase.rpc('list_payment_chase_touches' as never)
              if (error) throw error
              return parseChaseTouchesRpc(data as unknown) ?? []
            },
            [],
          ),
          src<LegalReportLike[]>(
            'field reports',
            async () => {
              const lists = await Promise.all(
                jobIds.map(async (jobId) => {
                  const { data, error } = await supabase.rpc('list_reports_for_job_ledger', { p_job_id: jobId })
                  if (error) throw error
                  return ((data ?? []) as ReportRow[]).map(
                    (r): LegalReportLike => ({
                      jobId,
                      createdAt: r.created_at,
                      authorName: r.created_by_name ?? '',
                      templateName: r.template_name ?? '',
                      hasGps: r.reported_at_lat != null,
                    }),
                  )
                }),
              )
              return lists.flat()
            },
            [],
          ),
          src<LegalClockSessionLike[]>(
            'clock sessions',
            async () => {
              const rows =
                (await withSupabaseRetry<ClockSessionRow[]>(
                  () =>
                    supabase
                      .from('clock_sessions')
                      .select('job_ledger_id, work_date, clocked_in_at, clocked_out_at, clock_in_lat, approved_at, rejected_at, revoked_at')
                      .in('job_ledger_id', jobIds)
                      .order('work_date')
                      .limit(ROW_CAP),
                  'load legal packet clock sessions',
                )) ?? []
              return rows
                .filter((r) => r.job_ledger_id)
                .map(
                  (r): LegalClockSessionLike => ({
                    jobId: r.job_ledger_id as string,
                    workDate: r.work_date,
                    clockedInAt: r.clocked_in_at,
                    clockedOutAt: r.clocked_out_at,
                    hasGps: r.clock_in_lat != null,
                    approved: r.approved_at != null,
                    disqualified: r.rejected_at != null || r.revoked_at != null,
                  }),
                )
            },
            [],
          ),
          src<LegalThreadNoteLike[]>(
            'job notes',
            async () => {
              const rows =
                (await withSupabaseRetry<ThreadNoteRow[]>(
                  () =>
                    supabase
                      .from('jobs_ledger_thread_notes')
                      .select('job_id, body, created_at, author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)')
                      .in('job_id', jobIds)
                      .order('created_at', { ascending: false })
                      .limit(ROW_CAP),
                  'load legal packet job notes',
                )) ?? []
              return rows.map((r): LegalThreadNoteLike => ({ jobId: r.job_id, body: r.body, createdAt: r.created_at, authorName: r.author?.name ?? null }))
            },
            [],
          ),
        ])
      if (cancelled) return
      setPacket(
        buildLegalPacket({
          todayYmd,
          account,
          customer,
          contacts,
          addresses,
          contracts,
          signedEstimates: estimates,
          demandLetters,
          lienFilings,
          promises,
          promiseOutcomes: outcomes,
          chaseTouches: touches,
          reports,
          clockSessions: sessions,
          threadNotes: notes,
          users,
        }),
      )
      setFailed(failures)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // `account` is re-derived every render by the caller; key on its identity fields instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, accountKey, jobIdsKey, tick, users])

  return { packet, loading, failed, reload }
}
