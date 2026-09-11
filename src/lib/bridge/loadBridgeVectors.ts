import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import type { BridgeData } from './loadBridgeData'
import { ratePerHourByJob, type VectorBid, type VectorCount, type VectorEvent, type VectorPerson, type VectorSession, type VectorWage } from './vectors'

/**
 * Vectors loader (v2.3344) — the per-person inputs for the Bridge's window,
 * from the records the app already keeps. Loads once for the whole window;
 * the page picks a pay week and runs the pure kernel.
 *
 * - People: every account (`users`), archived included so last week's rows
 *   don't vanish when someone leaves; wages by `people_pay_config` through
 *   `people.account_user_id`, falling back to the trimmed-name join the rest
 *   of payroll uses.
 * - Sessions: every closed clock session in the window with its approval
 *   state — approved ones earn and cost, pending ones are shown as waiting.
 * - Billed / collected: `job_activity_events` `invoice_sent` (amount from the
 *   invoice it names) and `payment_added` (amount in the event), by actor.
 * - % reports: `job_pct_events` (not the seed rows) + `reports` by author.
 * - Bids: sent by `bid_date_sent`, won by `bid_versions.outcome_at`, both
 *   credited to the bid's estimator.
 */

export type BridgeVectorInputs = {
  people: VectorPerson[]
  wages: VectorWage[]
  sessions: VectorSession[]
  ratePerHourByJob: Map<string, number>
  invoiceSends: VectorEvent[]
  payments: VectorEvent[]
  pctUpdates: VectorCount[]
  fieldReports: VectorCount[]
  bidsSent: VectorBid[]
  bidsWon: VectorBid[]
}

const hoursOf = (inIso: string, outIso: string | null): number => {
  if (!outIso) return 0
  const h = (Date.parse(outIso) - Date.parse(inIso)) / 3_600_000
  return Number.isFinite(h) && h > 0 ? h : 0
}
const ymdOf = (v: string): string => (v.includes('T') ? calendarYmdInAppTzFromIso(v) : v.slice(0, 10))
const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase()

type UserRow = { id: string; name: string | null; role: string | null; archived_at: string | null }
type PersonRow = { id: string; name: string | null; account_user_id: string | null }
type PayRow = { person_id: string | null; person_name: string | null; hourly_wage: number | null; office_hourly_wage: number | null; is_salary: boolean | null }
type SessionRow = { user_id: string; work_date: string; clocked_in_at: string; clocked_out_at: string | null; job_ledger_id: string | null; bid_id: string | null; approved_at: string | null; rejected_at: string | null; revoked_at: string | null }
type EventRow = { event_type: string; actor_user_id: string | null; occurred_at: string; detail: Record<string, unknown> | null }
type PctRow = { changed_by_user_id: string | null; changed_at: string }
type ReportRow = { created_by_user_id: string | null; created_at: string }
type VersionRow = { bid_id: string; outcome_at: string | null }
type BidRow = { id: string; bid_number: string | null; project_name: string | null; estimator_id: string | null; bid_value: number | null; agreed_value: number | null; bid_date_sent: string | null }

export async function loadBridgeVectorInputs(data: BridgeData): Promise<BridgeVectorInputs> {
  const { windowStart, todayYmd, officeJobLedgerId } = data
  const fromIso = `${windowStart}T00:00:00-06:00`

  const [userRows, personRows, payRows] = await Promise.all([
    withSupabaseRetry(async () => supabase.from('users').select('id, name, role, archived_at'), 'vectors users') as Promise<UserRow[] | null>,
    withSupabaseRetry(async () => supabase.from('people').select('id, name, account_user_id'), 'vectors people') as Promise<PersonRow[] | null>,
    withSupabaseRetry(async () => supabase.from('people_pay_config').select('person_id, person_name, hourly_wage, office_hourly_wage, is_salary'), 'vectors pay config') as Promise<PayRow[] | null>,
  ])
  const people: VectorPerson[] = (userRows ?? []).map((u) => ({ userId: u.id, name: (u.name ?? '').trim() || 'Unnamed', role: u.role, archived: !!u.archived_at }))
  const userIdByPersonId = new Map<string, string>()
  for (const p of personRows ?? []) if (p.account_user_id) userIdByPersonId.set(p.id, p.account_user_id)
  const userIdByName = new Map<string, string>()
  for (const u of userRows ?? []) if (u.name) userIdByName.set(norm(u.name), u.id)
  const wages: VectorWage[] = []
  const seen = new Set<string>()
  for (const r of payRows ?? []) {
    const userId = (r.person_id && userIdByPersonId.get(r.person_id)) || userIdByName.get(norm(r.person_name)) || null
    if (!userId || seen.has(userId)) continue
    seen.add(userId)
    wages.push({ userId, fieldWage: r.hourly_wage == null ? null : Number(r.hourly_wage), officeWage: r.office_hourly_wage == null ? null : Number(r.office_hourly_wage), isSalary: !!r.is_salary })
  }

  const sessionRows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select('user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at')
            .gte('work_date', windowStart)
            .lte('work_date', todayYmd)
            .not('clocked_out_at', 'is', null)
            .order('id')
            .range(from, to),
        'vectors sessions',
      )) as SessionRow[] | null,
      error: null,
    }),
    'vectors sessions',
  )
  const sessions: VectorSession[] = sessionRows.map((s) => ({
    userId: s.user_id,
    workDate: s.work_date,
    hours: hoursOf(s.clocked_in_at, s.clocked_out_at),
    jobId: s.job_ledger_id,
    onBid: !s.job_ledger_id && !!s.bid_id,
    officeJob: !!officeJobLedgerId && s.job_ledger_id === officeJobLedgerId,
    approved: !!s.approved_at && !s.rejected_at && !s.revoked_at,
    pending: !s.approved_at && !s.rejected_at && !s.revoked_at,
  }))

  const eventRows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('job_activity_events')
            .select('event_type, actor_user_id, occurred_at, detail')
            .in('event_type', ['invoice_sent', 'payment_added'])
            .gte('occurred_at', fromIso)
            .order('id')
            .range(from, to),
        'vectors events',
      )) as EventRow[] | null,
      error: null,
    }),
    'vectors events',
  )
  const invoiceIds = [...new Set(eventRows.filter((e) => e.event_type === 'invoice_sent').map((e) => String(e.detail?.invoice_id ?? '')).filter(Boolean))]
  const invoiceAmountRows = await fetchAllRowsChunkedIn(
    invoiceIds,
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(async () => supabase.from('jobs_ledger_invoices').select('id, amount').in('id', chunk).order('id').range(from, to), 'vectors invoices')) as Array<{ id: string; amount: number | null }> | null,
      error: null,
    }),
    'vectors invoices',
    { chunkSize: 200 },
  )
  const amountByInvoice = new Map(invoiceAmountRows.map((r) => [r.id, Number(r.amount ?? 0)]))
  const invoiceSends: VectorEvent[] = []
  const payments: VectorEvent[] = []
  for (const e of eventRows) {
    const ymd = ymdOf(e.occurred_at)
    if (e.event_type === 'invoice_sent') invoiceSends.push({ userId: e.actor_user_id, ymd, usd: amountByInvoice.get(String(e.detail?.invoice_id ?? '')) ?? 0 })
    else payments.push({ userId: e.actor_user_id, ymd, usd: Number(e.detail?.amount ?? 0) })
  }

  const [pctRows, reportRows, versionRows, sentBidRows] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () => supabase.from('job_pct_events').select('changed_by_user_id, changed_at').neq('source', 'seed').gte('changed_at', fromIso).order('id').range(from, to),
          'vectors pct events',
        )) as PctRow[] | null,
        error: null,
      }),
      'vectors pct events',
    ),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => supabase.from('reports').select('created_by_user_id, created_at').gte('created_at', fromIso).order('id').range(from, to), 'vectors reports')) as ReportRow[] | null,
        error: null,
      }),
      'vectors reports',
    ),
    withSupabaseRetry(async () => supabase.from('bid_versions').select('bid_id, outcome_at').eq('outcome', 'won').gte('outcome_at', fromIso), 'vectors bids won') as Promise<VersionRow[] | null>,
    withSupabaseRetry(
      async () => supabase.from('bids').select('id, bid_number, project_name, estimator_id, bid_value, agreed_value, bid_date_sent').gte('bid_date_sent', windowStart),
      'vectors bids sent',
    ) as Promise<BidRow[] | null>,
  ])
  const pctUpdates: VectorCount[] = pctRows.map((r) => ({ userId: r.changed_by_user_id, ymd: ymdOf(r.changed_at) }))
  const fieldReports: VectorCount[] = reportRows.map((r) => ({ userId: r.created_by_user_id, ymd: ymdOf(r.created_at) }))

  const wonAtByBid = new Map<string, string>()
  for (const v of versionRows ?? []) if (v.outcome_at) wonAtByBid.set(v.bid_id, ymdOf(v.outcome_at))
  const wonBidRows = await fetchAllRowsChunkedIn(
    [...wonAtByBid.keys()],
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(
        async () => supabase.from('bids').select('id, bid_number, project_name, estimator_id, bid_value, agreed_value, bid_date_sent').in('id', chunk).order('id').range(from, to),
        'vectors won bids',
      )) as BidRow[] | null,
      error: null,
    }),
    'vectors won bids',
    { chunkSize: 200 },
  )
  const bidLabel = (b: BidRow): string => `${b.bid_number ?? ''} ${b.project_name ?? ''}`.trim()
  const bidsWon: VectorBid[] = wonBidRows.map((b) => ({ userId: b.estimator_id, ymd: wonAtByBid.get(b.id) ?? '', usd: Number(b.agreed_value ?? b.bid_value ?? 0), label: bidLabel(b) }))
  const bidsSent: VectorBid[] = (sentBidRows ?? []).filter((b) => b.bid_date_sent).map((b) => ({ userId: b.estimator_id, ymd: ymdOf(b.bid_date_sent as string), usd: Number(b.bid_value ?? 0), label: bidLabel(b) }))

  return {
    people,
    wages,
    sessions,
    ratePerHourByJob: ratePerHourByJob(data.jobs, data.earned.expectedHoursByJob),
    invoiceSends,
    payments,
    pctUpdates,
    fieldReports,
    bidsSent,
    bidsWon,
  }
}
