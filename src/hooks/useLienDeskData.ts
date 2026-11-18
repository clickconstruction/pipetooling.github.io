import type { LienMailPieceRow } from '../lib/mail/lienMailPieces'
import { readMailPiecesBySource } from '../lib/mail/lienMailPiecesIo'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readLienCopyPrints } from '../lib/jobs/lienServePrintsIo'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { loadRetainageUnrecorded } from '../lib/ar/retainageHeldIo'
import type { RetainageUnrecordedRow } from '../lib/ar/retainageSuggested'
import { chunkIds } from '../lib/supabasePaging'
import {
  buildLienDeskQueue,
  parseLienNoticePolicy,
  summarizeLienDeskForNeedsYou,
  type LienDeskItemRow,
  type LienDeskNeedsYou,
  type LienDeskQueue,
  type LienNoticeMonthRow,
  type LienNoticePolicy,
  type LienDeskQueueJob,
} from '../lib/jobs/lienDesk'
import { parsePromisedPayDatesRpc, type PromisedPayDate } from '../lib/jobs/billedExpectedPay'
import { buildLienAffidavitQueue, withContractorAddress, withHomesteadAnswer, withPublicOwner, type LienAffidavitQueue, type LienAffidavitRow } from '../lib/jobs/lienDeskAffidavits'
import { buildLienRetainageQueue, EMPTY_LIEN_RETAINAGE_QUEUE, parsePaymentBond, type LienRetainageQueue, type LienRetainageRow } from '../lib/jobs/lienDeskRetainage'
import { LIEN_DESK_STARTED_READ_DAYS, lienDeskKeepNoticeRows, lienDeskKeepRows } from '../lib/jobs/lienDeskStarted'
import { letterTwoByJobFrom, letterTwoMailClocksFrom, summarizeLetterTwo, type LetterTwoStatus } from '../lib/jobs/lienLetterTwo'
import { lastCourtesyAtByJob } from '../lib/jobs/lienCourtesyReply'
import { readCourtesyOwnerContacts, readCourtesyRepliesByJob, type CourtesyReplySource } from '../lib/jobs/lienCourtesyReplyIo'
import { resolveLienProperty } from '../lib/jobs/lienProperty'
import { ownerCallByJobFrom, type OwnerCall } from '../lib/jobs/lienOwnerCall'
import { formatYmdMonthDay } from '../lib/jobs/billedExpectedPay'
import type { CustomerAddressRow, JobPropertyOwnerLike } from '../lib/jobs/lienProperty'
import { lienDeskBatches } from '../lib/jobs/gcOnNotice'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { parseLienClaimCorrection } from '../lib/jobs/lienClaimCorrectionIo'
import type { LienClaimCorrection } from '../lib/jobs/lienClaimCorrection'
import { readLienAffidavitMonthsByHand } from '../lib/jobs/lienAffidavitMonthsByHandIo'
import type { LienAffidavitMonthsByHand } from '../lib/jobs/lienAffidavitMonthsByHand'
import type { JobLienFilingRow } from '../lib/jobs/lienDeadlines'
import type { JobDemandLetterRow } from '../lib/jobs/demandLetterTracking'
import { zzTestJobIds } from '../lib/jobs/zzTestJobVisibility'
import { isZzTestJob } from '../lib/jobs/zzTestJobSweep'
import { lienBilledOpen } from '../lib/jobs/lienBilledOpen'
import { lienJobIdsOffDesk, withLienOffDeskColumns } from '../lib/jobs/lienInKind'
import { jobOffLienPath, lienJobPathStanding } from '../lib/jobs/lienJobPath'
import type { LienOffPathJob } from '../lib/jobs/lienOffPathBin'
import { lienJobIdsAskingPublic, lienJobIdsOffLienPath, type LienPublicJob } from '../lib/jobs/lienPublicProperty'

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
  /** The job's status (v2.6380) — `lienBilledOpen` reads a job billed as one shell by it. */
  status?: string | null
  master_user_id: string | null
  /** 'YYYY-MM-DD' — the timeline's last-work fallback when the RPC's months are older (v2.3761). */
  last_work_date: string | null
  /** 'YYYY-MM-DD' — the first approved clock day (v2.6061, migration 20261029190000); absent until the migration is on prod, when the jobs read falls back to the list without it. */
  first_work_date?: string | null
  /** The day the job was created — the last-day line's fallback when there are no clock hours (v2.4676). */
  created_at?: string | null
  /** The job's bills with their two days (v2.7224): the last-day line names the latest sent, unpaid one before the creation day. */
  invoices?: Array<{ status: string | null; billed_at: string | null; sent_to_customer_at: string | null }> | null
  /** The lien clock (v2.3753): the day our contract on the job ended and how; null while open. */
  lien_contract_ended_on?: string | null
  lien_contract_ended_how?: string | null
  /** The last day of work set by hand (v2.4676), with who, when and why; null while the clock hours (or the creation day) stand. */
  lien_last_work_on?: string | null
  lien_last_work_note?: string | null
  lien_last_work_set_at?: string | null
  lien_last_work_set_by?: string | null
  /** The stand-in month a person confirmed (v2.7280, `lienMonthCheck.ts`), with who, when and the note; absent until the migration is on prod, when the jobs read falls back to the list without them. */
  lien_month_checked_month?: string | null
  lien_month_checked_at?: string | null
  lien_month_checked_by?: string | null
  lien_month_checked_by_name?: string | null
  lien_month_check_note?: string | null
  /** Unpaid subcontract retainage the GC holds (v2.3753); null = not recorded. */
  lien_retainage_held?: number | null
  lien_payment_bond?: string | null
  /** When the job went on the attorney's list (the Collections flag); the bin *Public jobs · bond claim* reads it. */
  collections_at?: string | null
  /** The job's trade (v2.3849) — the letters' "plumbing contractor" / "electrical contractor" and the form's default type of labor. */
  service_type?: { name: string } | null
  /** The open in-kind deal that pays the job (punch list #301); set, the job is off the desk (v2.7253, `lienInKind.ts`). */
  in_kind_arrangement_id?: string | null
  /** The job's own answer (v2.7504, `lienJobPath.ts`): `'off_path'`, a person took it off the lien path and it is off the desk; with who, when and why. */
  lien_path_answer?: string | null
  lien_path_answered_at?: string | null
  lien_path_answered_by?: string | null
  lien_path_reason?: string | null
}

/** The columns the desk reads from jobs_ledger. A day set by hand comes with its reason, its time and who set it (v2.7741), as the Lien window reads it: the last-day line and the window under LAST WORK show them. */
export const LIEN_DESK_JOB_COLUMNS = 'id, hcp_number, click_number, job_name, job_address, customer_id, customer_name, gc_customer_id, customer_address_id, revenue, payments_made, status, master_user_id, last_work_date, lien_last_work_on, lien_last_work_note, lien_last_work_set_at, lien_last_work_set_by, lien_contract_ended_on, lien_contract_ended_how, lien_retainage_held, lien_payment_bond, collections_at, lien_path_answered_at, lien_path_answered_by, lien_path_reason, service_type:service_types(name), created_at, invoices:jobs_ledger_invoices(status, billed_at, sent_to_customer_at)'

/** The desk's columns with the first work day (v2.6061): read first, and the list above when the column is not on prod yet. */
export const LIEN_DESK_JOB_COLUMNS_WITH_FIRST_DAY = `${LIEN_DESK_JOB_COLUMNS}, first_work_date`

/** Those columns with the stand-in month's check (v2.7280): read first, and the list above when the check's columns are not on prod yet. */
export const LIEN_DESK_JOB_COLUMNS_WITH_MONTH_CHECK = `${LIEN_DESK_JOB_COLUMNS_WITH_FIRST_DAY}, lien_month_checked_month, lien_month_checked_at, lien_month_checked_by, lien_month_checked_by_name, lien_month_check_note`


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
  /** The open jobs under a GC whose bills or notes say retainage is held with none recorded (`retainageSuggested.ts`): the list above the retainage piles, To do's rows and the Board's count. Absent in light mode. */
  retainageUnrecorded?: RetainageUnrecordedRow[]
  /** Why that read failed, in words; null or absent when it did not. The rest of the desk stands without it. */
  retainageUnrecordedFailure?: string | null
  /** Letter two (v2.3760): where the second owner letter stands on every job with a sent notice. */
  letterTwoByJob: Record<string, LetterTwoStatus>
  /** The owner's call per job (v2.3767), from the notice items — the affidavit piles and the grid read it. */
  ownerCallByJob: Record<string, OwnerCall>
  jobsById: Record<string, LienDeskJob>
  gcsById: Record<string, LienDeskGc>
  addressesById: Record<string, CustomerAddressRow>
  /**
   * The jobs off the lien path (`lienPublicProperty.ts`): every job whose property record says *public*. They are
   * taken out of every list above where the lists are built, so no reader holds a rule of its own, and handed on here
   * for the bin *Public jobs · bond claim*. Empty when none, and before the answer's migration is pushed. The three
   * fields are the read's own: a hand-built set of desk data (the GC run's, a test's) may leave them out.
   */
  publicJobs?: LienPublicJob[]
  /**
   * The jobs a person took off the lien path for a reason of their own (`lienJobPath.ts`, v2.7521): out of every list
   * above, as the public ones are, and handed on here for the bin *Off the lien path*, each with why, who and the day.
   * Every such job that still owes money is here, whether or not a reader or a paper named it. Empty in light mode.
   */
  offPathJobs?: LienOffPathJob[]
  /** The jobs still on the lien path whose property reads as public and has no answer yet: the Board's amber line. */
  publicAskJobIds?: ReadonlySet<string>
  /** The property record under each job on the desk, and under each job off the path, by `customer_addresses.id`: the public property question reads it. */
  propertiesById?: Record<string, CustomerAddressRow>
  ownerByJob: Record<string, JobPropertyOwnerLike>
  promisesByJob: Record<string, PromisedPayDate>
  /** GCs that already received at least one live § 53.056 notice from us (any job). */
  gcsWithPriorNotice: ReadonlySet<string>
  /** GCs with a held desk item, live or past (the leader held them before). */
  gcsHeldBefore: ReadonlySet<string>
  /** The claim set by hand per job (v2.3682) — empty when none, or when the table is not there yet. */
  claimCorrectionsByJob: Record<string, LienClaimCorrection>
  /** The months set by hand per job (v2.7270, `job_lien_affidavit_months`): the paper names these in place of the record's. Empty in light mode, and when the read failed. */
  affidavitMonthsByJob: Record<string, LienAffidavitMonthsByHand>
  /** The payments on every job with a sent notice, with their day (PR 2 of #274): the step brief's timeline draws each as a row. Absent in light mode or when the read failed. */
  paymentsByJob?: Record<string, Array<{ amount: number; paidOn: string | null }>>
  /** The job's affidavits and releases of record (v2.3761) — the timeline's tail; empty in light mode. */
  filingsByJob: Record<string, JobLienFilingRow[]>
  /** The job's live demand letters (v2.3880) — the timeline's demand node on the desk's panes; absent in light mode and on the GC run. */
  demandLettersByJob?: Record<string, JobDemandLetterRow[]>
  /** The mail pieces behind the filings (the Docsmit train, 6b), by filing id; absent in light mode, and empty until a notice mails through Docsmit. */
  mailPiecesByFiling?: Record<string, LienMailPieceRow[]>
  /** The filed liens whose copies were printed here, by filing id (`lienServeStage.ts`): a door to those copies reads *Enter mail numbers*, not *Print the copies to mail*. Absent in light mode. */
  servePrintedFilingIds?: string[]
  /** The pieces behind each approved desk item (v2.5532), from prepare on: the run builds a copy that already went through Docsmit as mailed. Absent in light mode. */
  mailPiecesByItem?: Record<string, LienMailPieceRow[]>
  /** The newest inbound Messages line after each job's last courtesy, ISO (punch list #249, row 3), for the jobs one came back on — `courtesyByJobFrom` closes on it. Read in light mode too, so the Dashboard's lien month and the desk agree; absent when the read failed. */
  courtesyRepliedAtByJob?: Record<string, string>
}

const EMPTY_AFFIDAVITS: LienAffidavitQueue = {
  entries: [],
  piles: { needs_property: [], needs_notice: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] },
  counts: { needs_property: 0, needs_notice: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 },
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
 *
 * A job an open in-kind deal pays (v2.7253) leaves at the same seam, always: paid in kind is paid, as far as the
 * desk goes (`lienInKind.ts`). So does a job a person took off the lien path (v2.7521, `lienJobPath.ts`). Every
 * list, count and total built below is without them.
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
        // The three readers are asked further ahead than the desk's lead (v2.7261, punch list #354), and the rows past the
        // lead are kept only on a job with a started paper of that kind (`lienDeskStarted.ts`), so a drafted, held or
        // approved paper due in six weeks is on the desk and nothing else past thirty days is.
        const [rowsRaw, itemsRaw, affRaw, retRaw, unrecordedRead] = await Promise.all([
          withSupabaseRetry(() => supabase.rpc('list_lien_notice_months', { p_within_days: LIEN_DESK_STARTED_READ_DAYS } as never), 'lien desk: due months'),
          withSupabaseRetry(
            () => supabase.from('job_lien_desk_items').select('*').is('voided_at', null).order('created_at', { ascending: false }),
            'lien desk: items',
          ),
          withSupabaseRetry(() => supabase.rpc('list_lien_affidavit_windows', { p_within_days: LIEN_DESK_STARTED_READ_DAYS } as never), 'lien desk: affidavit windows').catch(() => []),
          // The retainage reader (v2.3753) — empty until its migration is pushed, so the client can ship first.
          withSupabaseRetry(() => supabase.rpc('list_lien_retainage_windows' as never, { p_within_days: LIEN_DESK_STARTED_READ_DAYS } as never), 'lien desk: retainage windows').catch(() => []),
          // Retainage nobody recorded (fix A of the retainage clock check): the desk's own read, never the Dashboard's light one. A refused read says why on the Retainage list and leaves the desk standing.
          light
            ? Promise.resolve({ rows: [] as RetainageUnrecordedRow[], failure: null as string | null })
            : loadRetainageUnrecorded()
                .then((read) => ({ rows: read, failure: null as string | null }))
                .catch((e: unknown) => ({ rows: [] as RetainageUnrecordedRow[], failure: formatErrorMessage(e, 'The check for retainage nobody recorded could not be read.') })),
        ])
        if (cancelled) return
        const itemsRead = (itemsRaw ?? []) as LienDeskItemRow[]
        const rowsRead = lienDeskKeepNoticeRows(
          ((rowsRaw ?? []) as unknown as LienNoticeMonthRow[]).map((r) => ({
            ...r,
            approved_hours: Number(r.approved_hours) || 0,
            open_balance: Number(r.open_balance) || 0,
          })),
          itemsRead,
          todayYmd,
        )
        const affidavitRowsRead = lienDeskKeepRows(((affRaw ?? []) as unknown as LienAffidavitRow[]).map((r) => ({ ...r, open_balance: Number(r.open_balance) || 0 })), itemsRead, 'affidavit', todayYmd)
        const retainageRowsRead = lienDeskKeepRows(((retRaw ?? []) as unknown as LienRetainageRow[]).map((r) => ({ ...r, retainage_held: Number(r.retainage_held) || 0, open_balance: Number(r.open_balance) || 0 })), itemsRead, 'retainage_53_057', todayYmd)
        const jobIdsRead = [...new Set([...rowsRead.map((r) => r.job_id), ...itemsRead.map((i) => i.job_id), ...affidavitRowsRead.map((r) => r.job_id), ...retainageRowsRead.map((r) => r.job_id)])]

        // The GCs' standing rules come with the jobs; everything else is the desk's own detail.
        const jobsRead: LienDeskJob[] = []
        for (const chunk of chunkIds(jobIdsRead)) {
          if (chunk.length === 0) continue
          // The month check (v2.7280) and the first work day (v2.6061) ride along once their migrations are on prod; until then the columns without each, so the desk never goes dark on a client that landed first.
          const part = await withSupabaseRetry(
            () =>
              supabase
                .from('jobs_ledger')
                .select(withLienOffDeskColumns(LIEN_DESK_JOB_COLUMNS_WITH_MONTH_CHECK))
                .in('id', chunk),
            'lien desk: jobs',
          )
            .catch(() =>
              withSupabaseRetry(
                () =>
                  supabase
                    .from('jobs_ledger')
                    .select(withLienOffDeskColumns(LIEN_DESK_JOB_COLUMNS_WITH_FIRST_DAY))
                    .in('id', chunk),
                'lien desk: jobs (without the month check)',
              ),
            )
            .catch(() =>
              withSupabaseRetry(
                () =>
                  supabase
                    .from('jobs_ledger')
                    .select(withLienOffDeskColumns(LIEN_DESK_JOB_COLUMNS))
                    .in('id', chunk),
                'lien desk: jobs (without the first work day)',
              ),
            )
          jobsRead.push(...((part ?? []) as LienDeskJob[]))
        }
        // The jobs a person took off the lien path that no reader and no paper named (v2.7521): read by their own answer,
        // on the open desk only, so the bin *Off the lien path* holds every one that still owes money. A failed read
        // leaves the bin to the jobs already read, never the desk dark.
        if (!light) {
          const known = new Set(jobsRead.map((j) => j.id))
          const more = await withSupabaseRetry(
            () =>
              supabase
                .from('jobs_ledger')
                .select(withLienOffDeskColumns(LIEN_DESK_JOB_COLUMNS_WITH_MONTH_CHECK))
                .eq('lien_path_answer', 'off_path'),
            'lien desk: jobs off the lien path',
          ).catch(() => null)
          for (const j of (more ?? []) as LienDeskJob[]) if (!known.has(j.id) && jobOffLienPath(j)) jobsRead.push(j)
        }
        // The property record under every job read, whole, once, in light mode too. `select('*')` names no column, so the
        // read works before a migration that adds one is pushed. A failed read judges nothing, never the desk dark.
        const propertyIdsRead = [...new Set(jobsRead.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
        const propertiesById: Record<string, CustomerAddressRow> = {}
        for (const chunk of chunkIds(propertyIdsRead)) {
          if (chunk.length === 0) continue
          const part = await withSupabaseRetry(() => supabase.from('customer_addresses').select('*').in('id', chunk), 'lien desk: property records').catch(() => null)
          for (const a of (part ?? []) as CustomerAddressRow[]) propertiesById[a.id] = a
        }
        if (cancelled) return
        // ZZ test jobs (punch list #61, PR 3) leave every list here, by the joined rows' own names; and (v2.7253) so does every job an open in-kind deal pays.
        const offDeskIds = lienJobIdsOffDesk(jobsRead, hideZz ? zzTestJobIds(jobsRead) : null)
        // Off the lien path (`lienPublicProperty.ts`): every job whose property record says public. They leave every list
        // here too, so the Board, the lists, the run, the notary print and the Dashboard drop them with no rule of their
        // own, and they are handed on as `publicJobs`. A job already off the desk (ZZ hidden, in kind) is not listed there.
        const publicJobsRead = jobsRead.filter((j) => !offDeskIds?.has(j.id) && lienJobIdsOffLienPath([j], propertiesById).has(j.id))
        // Off the lien path by the job's own answer (`lienJobPath.ts`): `offDeskIds` already holds them, so they leave every
        // list with the in-kind jobs, and they are handed on as `offPathJobs`. A hidden ZZ test job is not listed there.
        const zzHiddenIds = hideZz ? zzTestJobIds(jobsRead) : null
        const offPathJobsRead = light ? [] : jobsRead.filter((j) => jobOffLienPath(j) && !zzHiddenIds?.has(j.id))
        const offJobIds = publicJobsRead.length ? new Set<string>([...(offDeskIds ?? []), ...publicJobsRead.map((j) => j.id)]) : offDeskIds
        const kept = (jobId: string) => !offJobIds?.has(jobId)
        const rows = offJobIds ? rowsRead.filter((r) => kept(r.job_id)) : rowsRead
        const allItems = offJobIds ? itemsRead.filter((i) => kept(i.job_id)) : itemsRead
        const affidavitRowsKept = offJobIds ? affidavitRowsRead.filter((r) => kept(r.job_id)) : affidavitRowsRead
        const retainageRows = offJobIds ? retainageRowsRead.filter((r) => kept(r.job_id)) : retainageRowsRead
        const jobs = offJobIds ? jobsRead.filter((j) => kept(j.id)) : jobsRead
        const jobIds = offJobIds ? jobIdsRead.filter(kept) : jobIdsRead
        const items = allItems.filter((i) => i.kind === 'notice_53_056')
        const retainage = buildLienRetainageQueue(retainageRows, allItems, todayYmd)
        const gcIds = new Set<string>(rows.map((r) => r.gc_customer_id).filter((v): v is string => Boolean(v)))
        for (const j of jobs) if (j.gc_customer_id) gcIds.add(j.gc_customer_id)
        for (const j of publicJobsRead) if (j.gc_customer_id) gcIds.add(j.gc_customer_id)
        for (const j of offPathJobsRead) if (j.gc_customer_id) gcIds.add(j.gc_customer_id)
        for (const r of affidavitRowsKept) if (r.gc_customer_id) gcIds.add(r.gc_customer_id)
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
        const jobsById: Record<string, LienDeskJob> = {}
        for (const j of jobs) jobsById[j.id] = j
        // The property records under the affidavits (punch lists #305 and #314) are the ones read above, so the Dashboard's
        // count and the desk agree: an affidavit holds when its owner is a public body, and a residential one while
        // nobody has answered the homestead question.
        const affidavitAddressIdByJob: Record<string, string | null> = {}
        for (const r of affidavitRowsKept) affidavitAddressIdByJob[r.job_id] = jobsById[r.job_id]?.customer_address_id ?? null
        const affidavitPropertiesById = propertiesById
        // The affidavit queue is built once the GCs and those records are read (punch list #305): a job under a GC holds
        // while that GC's row has no address, any job holds while its owner is a public body, and a residential property
        // holds while nobody has answered the homestead question (the gate asks only a residential one).
        const affidavitRows: LienAffidavitRow[] = withHomesteadAnswer(withPublicOwner(withContractorAddress(affidavitRowsKept, gcsById), affidavitAddressIdByJob, affidavitPropertiesById), affidavitAddressIdByJob, affidavitPropertiesById)
        const affidavits = buildLienAffidavitQueue(affidavitRows, allItems, todayYmd)
        // The jobs ride along (v2.6376): an entry the RPC has no month row for reads its GC and customer from the job row —
        // and (v2.6380), on the open desk, its money: what the job's sent bills still owe, by the RPC's own rule, from the
        // bills and payments of just those jobs. A failed read leaves the figure to the RPC's, never the desk dark.
        const queueJobs: Record<string, LienDeskQueueJob> = { ...jobsById }
        const rowJobIds = new Set(rows.map((r) => r.job_id))
        // In light mode the read is held to the notices that wait on the leader (v2.7435): the Dashboard's card prints
        // each one's claim, and without it a job with no month row read $0 there and its own figure on the open desk.
        // On the open desk the jobs off the lien path are read too (v2.7439): the bin *Public jobs · bond claim* prints
        // their money. Their papers are cut above, so in light mode none of them is awaiting and none is read.
        const awaitingJobIds = new Set(items.filter((i) => i.status === 'awaiting_approval' && !i.voided_at).map((i) => i.job_id))
        const billedOpenJobIds = [...jobs, ...publicJobsRead, ...offPathJobsRead].filter((j) => !rowJobIds.has(j.id) && (!light || awaitingJobIds.has(j.id))).map((j) => j.id)
        if (billedOpenJobIds.length > 0) {
          type InvoiceRow = { id: string; job_id: string; status: string | null; amount: number | null; sequence_order: number | null; billed_at: string | null }
          type PaymentRow = { job_id: string; invoice_id: string | null; amount: number | null }
          const [invRows, payRows] = await Promise.all([
            withSupabaseRetry(() => supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount, sequence_order, billed_at').in('job_id', billedOpenJobIds), 'lien desk: bills behind a sent notice').catch(() => null),
            withSupabaseRetry(() => supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount').in('job_id', billedOpenJobIds), 'lien desk: payments behind a sent notice').catch(() => null),
          ])
          if (cancelled) return
          if (invRows && payRows) {
            const invByJob = new Map<string, InvoiceRow[]>()
            for (const i of invRows as InvoiceRow[]) invByJob.set(i.job_id, [...(invByJob.get(i.job_id) ?? []), i])
            const payByJob = new Map<string, PaymentRow[]>()
            for (const p of payRows as PaymentRow[]) payByJob.set(p.job_id, [...(payByJob.get(p.job_id) ?? []), p])
            for (const id of billedOpenJobIds) {
              const j = jobsById[id] ?? publicJobsRead.find((x) => x.id === id) ?? offPathJobsRead.find((x) => x.id === id)
              if (!j) continue
              queueJobs[id] = { ...j, billed_open: lienBilledOpen({ id: j.id, status: j.status ?? null, revenue: j.revenue, payments_made: j.payments_made }, invByJob.get(id) ?? [], payByJob.get(id) ?? []) }
            }
          }
        }
        // The payments behind every sent notice, with their day (PR 2 of #274): the timeline's green rows. A failed read leaves them out, never the desk dark.
        let paymentsByJob: Record<string, Array<{ amount: number; paidOn: string | null }>> | undefined
        const sentJobIds = light ? [] : [...new Set(items.filter((i) => i.status === 'sent').map((i) => i.job_id))]
        if (sentJobIds.length > 0) {
          type PaidRow = { job_id: string; amount: number | null; paid_on: string | null }
          const paid = await withSupabaseRetry(() => supabase.from('jobs_ledger_payments').select('job_id, amount, paid_on').in('job_id', sentJobIds), 'lien desk: payments behind the sent notices').catch(() => null)
          if (cancelled) return
          if (paid) {
            paymentsByJob = {}
            for (const p of paid as PaidRow[]) (paymentsByJob[p.job_id] ??= []).push({ amount: Number(p.amount) || 0, paidOn: p.paid_on ? String(p.paid_on).slice(0, 10) : null })
            for (const list of Object.values(paymentsByJob)) list.sort((a, b) => (a.paidOn ?? '') < (b.paidOn ?? '') ? -1 : 1)
          }
        }
        // The affidavit's day per job (v2.7273, punch list #335, row 4): a closed notice window is a lien lost only once that day
        // has passed too, and the Dashboard's closed-window line tells the two apart. Read in light mode too, so the Dashboard and the desk agree.
        const affidavitDayByJob: Record<string, string> = {}
        for (const r of affidavitRows) affidavitDayByJob[r.job_id] = r.deadline
        const queue = buildLienDeskQueue(rows, items, policyByCustomer, todayYmd, queueJobs, affidavitDayByJob)
        // The jobs off the lien path, for the bin *Public jobs · bond claim*: the money by the desk's own rule (a
        // reader's row when one lists the job, else what its sent bills still owe), and every paper of the desk's on it.
        const publicJobs: LienPublicJob[] = publicJobsRead.map((j) => {
          const listed = rowsRead.find((r) => r.job_id === j.id) ?? affidavitRowsRead.find((r) => r.job_id === j.id) ?? retainageRowsRead.find((r) => r.job_id === j.id)
          return {
            jobId: j.id,
            addressId: j.customer_address_id ?? '',
            number: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
            name: (j.job_name ?? '').trim(),
            gcName: j.gc_customer_id ? (gcsById[j.gc_customer_id]?.name ?? '') : '',
            unpaid: Number(listed?.open_balance ?? queueJobs[j.id]?.billed_open ?? 0) || 0,
            bond: parsePaymentBond(j.lien_payment_bond),
            attorneySince: j.collections_at ?? null,
            papers: itemsRead.filter((i) => i.job_id === j.id).map((i) => ({ kind: i.kind, status: i.status, months: i.months, sent_at: i.sent_at, approved_at: i.approved_at, voided_at: i.voided_at })),
          }
        })
        // The jobs a person took off the lien path, for the bin *Off the lien path*: the money by the same rule, why, who and
        // the day off the job's own row, and every paper of the desk's on it. A job that owes nothing any more is left out.
        const offPathJobs: LienOffPathJob[] = offPathJobsRead
          .map((j) => {
            const listed = rowsRead.find((r) => r.job_id === j.id) ?? affidavitRowsRead.find((r) => r.job_id === j.id) ?? retainageRowsRead.find((r) => r.job_id === j.id)
            const standing = lienJobPathStanding(j)
            return {
              jobId: j.id,
              number: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
              name: (j.job_name ?? '').trim(),
              gcName: j.gc_customer_id ? (gcsById[j.gc_customer_id]?.name ?? '') : '',
              unpaid: Number(listed?.open_balance ?? queueJobs[j.id]?.billed_open ?? 0) || 0,
              reason: standing.reason,
              since: standing.at,
              byUserId: standing.by,
              attorneySince: j.collections_at ?? null,
              status: j.status ?? null,
              papers: itemsRead.filter((i) => i.job_id === j.id).map((i) => ({ kind: i.kind, status: i.status, months: i.months, sent_at: i.sent_at, approved_at: i.approved_at, voided_at: i.voided_at })),
            }
          })
          .filter((j) => j.unpaid > 0 || j.papers.length > 0)
        // Who took each one off, by name, for the bin's line. A failed read leaves the line without a name, never the desk dark.
        const offPathByIds = [...new Set(offPathJobs.map((j) => j.byUserId).filter((v): v is string => Boolean(v)))]
        if (offPathByIds.length > 0) {
          const who = await withSupabaseRetry(() => supabase.from('users').select('id, name').in('id', offPathByIds), 'lien desk: who took a job off the lien path').catch(() => null)
          if (cancelled) return
          const nameById = new Map(((who ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, (u.name ?? '').trim()]))
          for (const j of offPathJobs) j.byName = (j.byUserId ? nameById.get(j.byUserId) : '') || ''
        }
        const publicAskJobIds = lienJobIdsAskingPublic(jobs, propertiesById)
        const gcNames: Record<string, string> = {}
        for (const g of Object.values(gcsById)) gcNames[g.id] = g.name
        const summaryWithBatches = summarizeLienDeskForNeedsYou(queue)
        summaryWithBatches.leader.batches = lienDeskBatches(queue, gcNames)
        // Letter two (v2.3760): the second owner letter's clock per job, from the notice items and the job's own balance.
        // Day 0 is the owner's piece's day when Docsmit knows it (D9's rule, unread until v2.6669 — punch list #249, row 4): the sent
        // packets' pieces are read under the item's id and its filing's, in light mode too, so the Dashboard's count and the desk agree.
        const sentPackets = items.filter((i) => i.kind === 'notice_53_056' && i.status === 'sent' && !i.voided_at)
        const packetPieces = await readMailPiecesBySource([...sentPackets.map((i) => i.id), ...sentPackets.map((i) => i.sent_filing_id).filter((v): v is string => Boolean(v))], 'lien desk: the packets’ pieces')
        if (cancelled) return
        const letterTwoByJob = letterTwoByJobFrom(items, (id) => Math.max(0, Number(jobsById[id]?.revenue ?? 0) - Number(jobsById[id]?.payments_made ?? 0)), todayYmd, formatYmdMonthDay, letterTwoMailClocksFrom(sentPackets, packetPieces))
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
        let mailPiecesByFiling: Record<string, LienMailPieceRow[]> = {}
        let mailPiecesByItem: Record<string, LienMailPieceRow[]> = {}
        let servePrintedFilingIds: string[] = []
        let demandLettersByJob: Record<string, JobDemandLetterRow[]> = {}
        if (!light) {
          const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
          const [addrRows, ownerRows, promisesRaw, priorNoticeRows, heldRows] = await Promise.all([
            addressIds.length
              ? withSupabaseRetry(() => supabase.from('customer_addresses').select('*').in('id', addressIds), 'lien desk: property records')
              : Promise.resolve([] as CustomerAddressRow[]),
            jobIds.length
              ? withSupabaseRetry(
                  // The whole row (v2.6497): owner_phone lands with migration 20261104163131, and a column named before the push would fail the desk's read.
                  () => supabase.from('job_property_owners').select('*').in('job_id', jobIds),
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
          // The mail pieces (the Docsmit train, 6b): the provider's word on each envelope, by filing; and (v2.5532) the
          // pieces a notice not yet recorded already went out as, by desk item, so the run never offers them again.
          const [byFiling, byItem] = await Promise.all([
            readMailPiecesBySource(Object.values(filingsByJob).flat().map((f) => f.id), 'lien desk: mail pieces'),
            readMailPiecesBySource(allItems.filter((i) => i.status === 'approved').map((i) => i.id), 'lien desk: pieces in the run'),
          ])
          mailPiecesByFiling = byFiling
          mailPiecesByItem = byItem
          // Which filed liens' copies were printed (`lienServeStage.ts`): asked only of the liens that still owe their day.
          servePrintedFilingIds = await readLienCopyPrints(Object.values(filingsByJob).flat().filter((f) => f.kind === 'affidavit' && f.filed_at && !f.served_at).map((f) => f.id))
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
        // The months set by hand per job (v2.7270): the affidavit pane, the help sheet and the papers read them. A failed read (the table not pushed yet) leaves none, never the desk dark.
        let affidavitMonthsByJob: Record<string, LienAffidavitMonthsByHand> = {}
        if (!light && jobIds.length) {
          affidavitMonthsByJob = await readLienAffidavitMonthsByHand(jobIds).catch(() => ({}))
          if (cancelled) return
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
        // A reply in Messages closes the courtesy (punch list #249, row 3): one batched read over the sent notices that carry
        // a courtesy — the GC's contacts and the owner of record's — in light mode too (the Dashboard's lien month reads the
        // courtesy's state), the owner's number and address from the rows already here, else read for just those jobs.
        let courtesyRepliedAtByJob: Record<string, string> | undefined
        const lastCourtesyAt = lastCourtesyAtByJob(letterTwoByJob, items)
        const courtesyJobIds = Object.keys(lastCourtesyAt)
        if (courtesyJobIds.length > 0) {
          const ownerOf = light
            ? await readCourtesyOwnerContacts(courtesyJobIds.map((jobId) => ({ jobId, customerAddressId: jobsById[jobId]?.customer_address_id ?? null }))).catch(() => null)
            : Object.fromEntries(
                courtesyJobIds.map((jobId) => {
                  const j = jobsById[jobId]
                  const owner = resolveLienProperty(j?.customer_address_id ? addressesById[j.customer_address_id] ?? null : null, ownerByJob[jobId] ?? null).owner
                  return [jobId, { phone: owner.phone, email: owner.email }]
                }),
              )
          if (cancelled) return
          const sources: CourtesyReplySource[] = courtesyJobIds.map((jobId) => ({ jobId, lastCourtesyAt: lastCourtesyAt[jobId]!, gcCustomerId: jobsById[jobId]?.gc_customer_id ?? null, ownerPhone: ownerOf?.[jobId]?.phone ?? '', ownerEmail: ownerOf?.[jobId]?.email ?? '' }))
          courtesyRepliedAtByJob = await readCourtesyRepliesByJob(sources).catch(() => undefined)
          if (cancelled) return
        }
        setData({
          queue,
          summary: summaryWithBatches,
          rows,
          items,
          paymentsByJob,
          affidavits,
          affidavitRows,
          retainage,
          retainageRows,
          ...(light ? {} : { retainageUnrecorded: hideZz ? unrecordedRead.rows.filter((r) => !isZzTestJob({ job_name: r.name })) : unrecordedRead.rows, retainageUnrecordedFailure: unrecordedRead.failure }),
          letterTwoByJob,
          ownerCallByJob,
          jobsById,
          gcsById,
          addressesById,
          publicJobs,
          offPathJobs,
          publicAskJobIds,
          propertiesById,
          ownerByJob,
          promisesByJob,
          gcsWithPriorNotice,
          gcsHeldBefore,
          claimCorrectionsByJob,
          affidavitMonthsByJob,
          filingsByJob,
          demandLettersByJob,
          mailPiecesByFiling,
          mailPiecesByItem,
          servePrintedFilingIds,
          courtesyRepliedAtByJob,
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
            publicJobs: [],
            offPathJobs: [],
            publicAskJobIds: new Set(),
            propertiesById: {},
            ownerByJob: {},
            promisesByJob: {},
            gcsWithPriorNotice: new Set(),
            gcsHeldBefore: new Set(),
            claimCorrectionsByJob: {}, affidavitMonthsByJob: {}, filingsByJob: {},
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
