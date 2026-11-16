/**
 * The scorecard's reads (team scorecard, design spike 2026-11-15), with the client passed in since punch list #360
 * PR 4: the edge function `team-scores` makes them as the service role, so the wages they price hours with never
 * leave the database's side, and `loadScorecard.ts` binds the app's client for the fallback. Every figure comes from
 * a read the app already makes, so the scores cannot disagree with the screens that show the parts:
 *
 * - paid field hours and their wages, per job and per day, from the job day ledger (`readJobDayLedger`,
 *   the Overhead and Timeline read), whose pool total is the overhead the hurdle divides;
 * - what the hours earned, from `earnedRevenueInWindow` (Job Summary's and the Bridge's rule);
 * - materials and subs dated in the window, by job, as the Bridge reads them;
 * - the bids' frozen priced margin, the award's labor hours (`job_budgets`), and a finished job's actual
 *   costs through the Costs tab's own reads (`readJobChargesTimelineInputs`).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../../utils/dateUtils'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { cardChargeCostUsd } from '../jobs/cardChargeAllocationFilter'
import { readOverheadPoolSnapshotInputs } from '../overheadPoolSnapshotReads'
import { readJobDayLedger } from '../jobs/jobDayLedgerReads'
import { loadEarnedJobs } from '../bridge/loadBridgeData'
import { earnedRevenueInWindow } from '../bridge/earnedRevenue'
import { spendByComponent } from '../jobs/jobBudget'
import { readJobChargesTimelineInputs, type JobChargesTimelineJob } from '../jobs/jobChargesTimelineReads'
import { APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1, parseLaborBurdenFactor } from '../appSettingsKeys'
import { jobLabelOf } from '../people/superintendentScores'
import { APP_SETTINGS_KEY_SCORECARD_HURDLE_V1, buildHurdle, parseHurdleSetting, type Hurdle, type HurdleSetting } from './hurdle'
import { buildFieldScore, type FieldOwner, type FieldScore, type FieldScoreJobInput } from './fieldScore'
import { buildEstimatorScore, STALE_PROPOSAL_DAYS, type EstimatorBidInput, type EstimatorScore } from './estimatorScore'

export const SCORECARD_WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 28, label: 'Last 4 weeks' },
  { days: 56, label: 'Last 8 weeks' },
  { days: 90, label: 'Last 90 days' },
]

export type ScorecardRead = {
  fromYmd: string
  toYmd: string
  todayYmd: string
  windowDays: number
  burden: number
  setting: HurdleSetting
  hurdle: Hurdle
  field: FieldScore
  /** Who runs each touched job, as the scoreboard maps it; a job absent here has no superintendent. */
  ownersByJob: Map<string, FieldOwner[]>
  estimator: EstimatorScore
  /** Closed field sessions in the window still waiting on approval; counted as paid time, shown so someone reviews them. */
  pendingFieldHours: number
  /** Finished jobs whose actual could not be read; their bids stand at the estimate. */
  actualsUnread: number
}

const addTo = (m: Map<string, number>, k: string, v: number) => {
  if (v) m.set(k, (m.get(k) ?? 0) + v)
}

type SettingRow = { key: string; value_num: number | null; value_text: string | null }

export async function readScorecardSettings(db: SupabaseClient<Database>): Promise<{ burden: number; setting: HurdleSetting }> {
  const rows = (await withSupabaseRetry(
    async () => db.from('app_settings').select('key, value_num, value_text').in('key', [APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1, APP_SETTINGS_KEY_SCORECARD_HURDLE_V1]),
    'scorecard settings',
  )) as SettingRow[] | null
  const by = new Map((rows ?? []).map((r) => [r.key, r]))
  return {
    burden: parseLaborBurdenFactor(by.get(APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1)?.value_num ?? null),
    setting: parseHurdleSetting(by.get(APP_SETTINGS_KEY_SCORECARD_HURDLE_V1)?.value_text ?? null),
  }
}

/**
 * The hurdle for a window, and the hours it is built from: the job day ledger's pool over its paid field hours, test
 * jobs aside. Both reads of the scores start here, so the full read and a person's own row share one hurdle.
 */
async function readHurdle(db: SupabaseClient<Database>, args: { fromYmd: string; toYmd: string; windowDays: number; zzTestJobIds: ReadonlySet<string> | null; isCancelled?: () => boolean }) {
  const [{ burden, setting }, inputs] = await Promise.all([readScorecardSettings(db), readOverheadPoolSnapshotInputs(db)])
  const ledger = await readJobDayLedger(db, { startYmd: args.fromYmd, endYmd: args.toYmd, leadDays: 0, inputs, isCancelled: args.isCancelled })
  if (!ledger) throw new Error('The hours could not be read.')
  // Paid field hours and wages per job, test jobs aside; the hurdle's hours and pool over the same window.
  const hoursByJob = new Map<string, { hours: number; laborUsd: number }>()
  let zzHours = 0
  for (const [jobId, j] of ledger.jobs) {
    if (args.zzTestJobIds?.has(jobId)) {
      zzHours += j.hours
      continue
    }
    hoursByJob.set(jobId, { hours: j.hours, laborUsd: j.laborUsd })
  }
  const hurdle = buildHurdle({ overheadUsd: ledger.totals.poolUsd, paidFieldHours: ledger.totals.fieldHours - zzHours, windowDays: args.windowDays, setting })
  return { burden, setting, ledger, hoursByJob, hurdle }
}

/** The estimating score alone (punch list #360, PR 5): everyone's for the Bid Board's chips, or one person's own row. */
export type EstimatorScoresRead = {
  fromYmd: string
  toYmd: string
  todayYmd: string
  windowDays: number
  hurdle: Hurdle
  estimator: EstimatorScore
  actualsUnread: number
}

/**
 * The estimating score without the field score's reads: the hurdle, then the bids. With `onlyUserId`, only the bids
 * that person estimated or manages, which is their own row. The hurdle is the same one the full read builds.
 */
export async function readEstimatorScores(db: SupabaseClient<Database>, args: { windowDays: number; todayYmd: string; zzTestJobIds: ReadonlySet<string> | null; onlyUserId?: string | null }): Promise<EstimatorScoresRead> {
  const toYmd = args.todayYmd
  const fromYmd = ymdAddDays(args.todayYmd, -(args.windowDays - 1))
  const { burden, hurdle } = await readHurdle(db, { fromYmd, toYmd, windowDays: args.windowDays, zzTestJobIds: args.zzTestJobIds })
  const estimator = await loadEstimatorScore(db, { fromYmd, toYmd, todayYmd: args.todayYmd, hurdle, burden, onlyUserId: args.onlyUserId ?? null })
  return { fromYmd, toYmd, todayYmd: args.todayYmd, windowDays: args.windowDays, hurdle, estimator: estimator.score, actualsUnread: estimator.actualsUnread }
}

export type ScorecardReadArgs = { windowDays: number; todayYmd: string; zzTestJobIds: ReadonlySet<string> | null; isCancelled?: () => boolean }

export async function readScorecard(db: SupabaseClient<Database>, args: ScorecardReadArgs): Promise<ScorecardRead> {
  const { windowDays, todayYmd } = args
  const toYmd = todayYmd
  const fromYmd = ymdAddDays(todayYmd, -(windowDays - 1))
  const zz = args.zzTestJobIds
  const cancelled = () => args.isCancelled?.() === true

  const { burden, setting, ledger, hoursByJob, hurdle } = await readHurdle(db, { fromYmd, toYmd, windowDays, zzTestJobIds: zz, isCancelled: args.isCancelled })
  const officeJobId = ledger.officeJobLedgerId

  // Materials dated in the window, by job: card charges allocated to jobs, supply-house invoices allocated to jobs.
  const materialsByJob = new Map<string, number>()
  const txRows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () => db.from('mercury_transactions').select('id, posted_at, amount').gte('posted_at', `${fromYmd}T00:00:00-06:00`).is('duplicate_of_transaction_id', null).neq('kind', 'internalTransfer').order('id').range(from, to),
        'scorecard mercury tx',
      )) as Array<{ id: string; posted_at: string; amount: number | null }> | null,
      error: null,
    }),
    'scorecard mercury tx',
  )
  const txInWindow = new Set(txRows.filter((t) => { const d = calendarYmdInAppTzFromIso(t.posted_at); return d >= fromYmd && d <= toYmd }).map((t) => t.id))
  const allocRows = await fetchAllRowsChunkedIn(
    [...txInWindow],
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('mercury_transaction_job_allocations').select('mercury_transaction_id, job_id, amount').in('mercury_transaction_id', chunk).order('id').range(from, to), 'scorecard tx allocations')) as Array<{ mercury_transaction_id: string; job_id: string | null; amount: number | null }> | null,
      error: null,
    }),
    'scorecard tx allocations',
    { chunkSize: 200 },
  )
  for (const a of allocRows) if (a.job_id && a.job_id !== officeJobId && !zz?.has(a.job_id)) addTo(materialsByJob, a.job_id, cardChargeCostUsd(a.amount))
  const invRows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('supply_house_invoices').select('id, amount, invoice_date').gte('invoice_date', fromYmd).lte('invoice_date', toYmd).order('id').range(from, to), 'scorecard supply invoices')) as Array<{ id: string; amount: number | null; invoice_date: string }> | null,
      error: null,
    }),
    'scorecard supply invoices',
  )
  const invById = new Map(invRows.map((r) => [r.id, r]))
  const supplyAllocRows = await fetchAllRowsChunkedIn(
    [...invById.keys()],
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct').in('invoice_id', chunk).order('invoice_id').order('job_id').range(from, to), 'scorecard supply allocations')) as Array<{ invoice_id: string; job_id: string | null; pct: number | null }> | null,
      error: null,
    }),
    'scorecard supply allocations',
    { chunkSize: 200 },
  )
  for (const a of supplyAllocRows) {
    const inv = invById.get(a.invoice_id)
    if (!inv || !a.job_id || a.job_id === officeJobId || zz?.has(a.job_id)) continue
    addTo(materialsByJob, a.job_id, Number(inv.amount ?? 0) * (Number(a.pct ?? 0) / 100))
  }

  // Sub labor sheets dated in the window, by the job they are on.
  const subByJob = new Map<string, number>()
  const sheets = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('people_labor_jobs').select('id, job_date, job_ledger_id').gte('job_date', fromYmd).lte('job_date', toYmd).not('job_ledger_id', 'is', null).order('id').range(from, to), 'scorecard sub sheets')) as Array<{ id: string; job_date: string; job_ledger_id: string | null }> | null,
      error: null,
    }),
    'scorecard sub sheets',
  )
  const sheetJob = new Map(sheets.map((s) => [s.id, s.job_ledger_id as string]))
  const subItems = await fetchAllRowsChunkedIn(
    [...sheetJob.keys()],
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('people_labor_job_items').select('job_id, count, hrs_per_unit, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(from, to), 'scorecard sub items')) as Array<{ job_id: string; count: number | null; hrs_per_unit: number | null; labor_rate: number | null; direct_labor_amount: number | null }> | null,
      error: null,
    }),
    'scorecard sub items',
    { chunkSize: 200 },
  )
  for (const it of subItems) {
    const jobId = sheetJob.get(it.job_id)
    if (!jobId || jobId === officeJobId || zz?.has(jobId)) continue
    const v = it.direct_labor_amount != null ? Number(it.direct_labor_amount) : Number(it.count ?? 0) * Number(it.hrs_per_unit ?? 0) * Number(it.labor_rate ?? 0)
    addTo(subByJob, jobId, v)
  }
  if (cancelled()) throw new Error('cancelled')

  // The jobs touched: their contracts, their percent, their lifetime hours, so the window's hours earn their share.
  const jobIds = [...new Set([...hoursByJob.keys(), ...materialsByJob.keys(), ...subByJob.keys()])]
  const { jobs, earnedJobs } = await loadEarnedJobs(db, jobIds)
  const earnedById = new Map(earnedJobs.map((j) => [j.id, j]))
  const fieldJobs: FieldScoreJobInput[] = jobs.map((j) => {
    const h = hoursByJob.get(j.id)
    const e = earnedById.get(j.id)
    const earned = h && e ? earnedRevenueInWindow({ contractUsd: Number(j.revenueUsd ?? 0), pctComplete: j.pctComplete, status: j.status, hoursInWindow: h.hours, lifetimeHours: Math.max(e.lifetimeHours, h.hours) }) : null
    return {
      jobId: j.id,
      label: j.label,
      status: j.status,
      paidHours: h?.hours ?? 0,
      laborUsdRaw: h?.laborUsd ?? 0,
      earnedUsd: earned ? earned.usd : null,
      materialsUsd: materialsByJob.get(j.id) ?? 0,
      subUsd: subByJob.get(j.id) ?? 0,
      totalBillUsd: j.revenueUsd,
    }
  })
  const field = buildFieldScore({ jobs: fieldJobs, burden, hurdle })
  const ownersByJob = await loadJobOwners(db, jobIds)

  // The estimator score: bids awarded since the window opened, and proposals out with no answer.
  const estimator = await loadEstimatorScore(db, { fromYmd, toYmd, todayYmd, hurdle, burden })
  if (cancelled()) throw new Error('cancelled')

  return { fromYmd, toYmd, todayYmd, windowDays, burden, setting, hurdle, field, ownersByJob, estimator: estimator.score, pendingFieldHours: ledger.pendingFieldHours, actualsUnread: estimator.actualsUnread }
}

/** Who runs each job: the project's superintendents, else the GC project's one (the `superintendent_scores` mapping). Fails soft to no owners. */
async function loadJobOwners(db: SupabaseClient<Database>, jobIds: readonly string[]): Promise<Map<string, FieldOwner[]>> {
  const out = new Map<string, FieldOwner[]>()
  if (jobIds.length === 0) return out
  try {
    const jobs = await fetchAllRowsChunkedIn(
      [...jobIds],
      async (chunk, from, to) => ({ data: (await db.from('jobs_ledger').select('id, project_id').in('id', chunk).not('project_id', 'is', null).order('id').range(from, to)).data as Array<{ id: string; project_id: string | null }> | null, error: null }),
      'scorecard job projects',
      { chunkSize: 200 },
    )
    const projectIds = [...new Set(jobs.map((j) => j.project_id).filter((p): p is string => !!p))]
    if (projectIds.length === 0) return out
    const [ps, gp] = await Promise.all([
      fetchAllRowsChunkedIn(projectIds, async (chunk, from, to) => ({ data: (await db.from('project_superintendents').select('project_id, superintendent_id').in('project_id', chunk).order('project_id').range(from, to)).data as Array<{ project_id: string; superintendent_id: string }> | null, error: null }), 'scorecard project supers', { chunkSize: 200 }),
      fetchAllRowsChunkedIn(projectIds, async (chunk, from, to) => ({ data: (await db.from('gc_projects').select('project_id, superintendent_user_id').in('project_id', chunk).not('superintendent_user_id', 'is', null).order('project_id').range(from, to)).data as Array<{ project_id: string; superintendent_user_id: string | null }> | null, error: null }), 'scorecard gc supers', { chunkSize: 200 }),
    ])
    const byProject = new Map<string, Set<string>>()
    const put = (p: string, u: string | null) => {
      if (!u) return
      const s = byProject.get(p) ?? new Set<string>()
      s.add(u)
      byProject.set(p, s)
    }
    for (const r of ps) put(r.project_id, r.superintendent_id)
    for (const r of gp) put(r.project_id, r.superintendent_user_id)
    const userIds = [...new Set([...byProject.values()].flatMap((s) => [...s]))]
    const users = userIds.length ? (((await db.from('users').select('id, name').in('id', userIds)).data ?? []) as Array<{ id: string; name: string | null }>) : []
    const nameOf = new Map(users.map((u) => [u.id, (u.name ?? '').trim() || 'A superintendent']))
    for (const j of jobs) {
      const s = j.project_id ? byProject.get(j.project_id) : undefined
      if (s && s.size) out.set(j.id, [...s].map((id) => ({ id, name: nameOf.get(id) ?? 'A superintendent' })))
    }
  } catch {
    /* no owners: the cut folds every job into the unowned line */
  }
  return out
}

type BidRow = {
  id: string
  bid_number: string | null
  project_name: string | null
  outcome: string | null
  outcome_at: string | null
  bid_date_sent: string | null
  priced_revenue_usd: number | null
  priced_cost_usd: number | null
  priced_uncosted_usd: number | null
  estimator_id: string | null
  account_manager_id: string | null
  estimator: { name: string | null } | null
  account_manager: { name: string | null } | null
  customers: { name: string | null } | null
}
type LinkedJobRow = JobChargesTimelineJob & { status: string | null; bid_id: string | null; hcp_number: string | null; click_number: string | null; job_name: string | null }

const BID_SELECT = 'id, bid_number, project_name, outcome, outcome_at, bid_date_sent, priced_revenue_usd, priced_cost_usd, priced_uncosted_usd, estimator_id, account_manager_id, estimator:users!bids_estimator_id_fkey(name), account_manager:users!bids_account_manager_id_fkey(name), customers(name)'
/** How many finished jobs' actuals read at once: each is the Costs tab's own few reads. */
const ACTUALS_CONCURRENCY = 4

async function loadEstimatorScore(db: SupabaseClient<Database>, args: { fromYmd: string; toYmd: string; todayYmd: string; hurdle: Hurdle; burden: number; onlyUserId?: string | null }): Promise<{ score: EstimatorScore; actualsUnread: number }> {
  // One person's own row (PR 5): the bids they estimated or manage. A uuid from the session, never typed text.
  const mine = args.onlyUserId && /^[0-9a-f-]{36}$/i.test(args.onlyUserId) ? `estimator_id.eq.${args.onlyUserId},account_manager_id.eq.${args.onlyUserId}` : null
  const awardedQ = () => {
    const q = db.from('bids').select(BID_SELECT).in('outcome', ['won', 'started_or_complete']).gte('outcome_at', `${args.fromYmd}T00:00:00-06:00`)
    return (mine ? q.or(mine) : q).order('outcome_at', { ascending: false }).limit(500)
  }
  const waitingQ = () => {
    const q = db.from('bids').select(BID_SELECT).is('outcome', null).not('bid_date_sent', 'is', null)
    return (mine ? q.or(mine) : q).order('bid_date_sent', { ascending: false }).limit(500)
  }
  const [awardedRes, waitingRes] = await Promise.all([withSupabaseRetry(async () => awardedQ(), 'scorecard awarded bids'), withSupabaseRetry(async () => waitingQ(), 'scorecard waiting bids')])
  const bids = [...((awardedRes as BidRow[] | null) ?? []), ...((waitingRes as BidRow[] | null) ?? [])]

  // A closeout moves the number on the day the job closes, whatever its award day (PR 5): a bid awarded before the
  // window whose job was billed or paid inside it is read too. Fails soft to the bids above.
  try {
    const closedEvents = ((await withSupabaseRetry(
      async () => db.from('job_status_events').select('job_id').in('to_status', ['billed', 'paid']).gte('changed_at', `${args.fromYmd}T00:00:00-06:00`).limit(2000),
      'scorecard closeout events',
    )) as Array<{ job_id: string }> | null) ?? []
    const closedJobIds = [...new Set(closedEvents.map((e) => e.job_id))]
    if (closedJobIds.length > 0) {
      const closedJobs = await fetchAllRowsChunkedIn(
        closedJobIds,
        async (chunk, from, to) => ({ data: (await db.from('jobs_ledger').select('id, bid_id').in('id', chunk).not('bid_id', 'is', null).order('id').range(from, to)).data as Array<{ id: string; bid_id: string | null }> | null, error: null }),
        'scorecard closeout jobs',
        { chunkSize: 200 },
      )
      const have = new Set(bids.map((b) => b.id))
      const moreIds = [...new Set(closedJobs.map((j) => j.bid_id).filter((id): id is string => !!id && !have.has(id)))]
      if (moreIds.length > 0) {
        const more = await fetchAllRowsChunkedIn(
          moreIds,
          async (chunk, from, to) => {
            const q = db.from('bids').select(BID_SELECT).in('id', chunk).in('outcome', ['won', 'started_or_complete'])
            return { data: (await (mine ? q.or(mine) : q).order('id').range(from, to)).data as BidRow[] | null, error: null }
          },
          'scorecard closeout bids',
          { chunkSize: 100 },
        )
        bids.push(...more)
      }
    }
  } catch {
    /* the closeouts of older awards are left out; the bids awarded in the window stand */
  }
  const bidIds = bids.map((b) => b.id)

  const linked = bidIds.length
    ? (((await withSupabaseRetry(
        async () => db.from('jobs_ledger').select('id, revenue, pct_complete, status, bid_id, hcp_number, click_number, job_name, invoices:jobs_ledger_invoices(status, amount), materials:jobs_ledger_materials(amount, created_at, description)').in('bid_id', bidIds),
        'scorecard linked jobs',
      )) as LinkedJobRow[] | null) ?? [])
    : []
  const jobByBid = new Map(linked.filter((j) => j.bid_id).map((j) => [j.bid_id as string, j]))
  const jobIds = linked.map((j) => j.id)
  const budgets = jobIds.length
    ? (((await withSupabaseRetry(async () => db.from('job_budgets').select('job_id, awarded_labor_hours, awarded_at').in('job_id', jobIds), 'scorecard awards')) as Array<{ job_id: string; awarded_labor_hours: number | null; awarded_at: string | null }> | null) ?? [])
    : []
  const budgetByJob = new Map(budgets.map((b) => [b.job_id, b]))

  // A bid with no award snapshot (most, today: the snapshot began 2026-11-07): its own labor total stands in for the
  // award's hours. Only bids that could be judged read it: a priced stamp, and either awarded or out within the stale limit.
  const hoursByBid = new Map<string, number>()
  const laborByBid = new Map<string, EstimatorBidInput['labor']>()
  const staleYmd = ymdAddDays(args.todayYmd, -STALE_PROPOSAL_DAYS)
  const needHours = bids
    .filter((b) => b.priced_revenue_usd != null && b.priced_cost_usd != null)
    .filter((b) => b.outcome != null || (b.bid_date_sent ?? '') >= staleYmd)
    .slice(0, 120)
  await Promise.all(
    needHours.map(async (b) => {
      try {
        const { data } = await db.rpc('bid_estimate_breakdown' as never, { p_bid_id: b.id } as never)
        const d = data as { labor_hours?: unknown; completeness?: { usable?: unknown; rate_set?: unknown; rows_total?: unknown; rows_with_hours?: unknown } | null } | null
        const h = Number(d?.labor_hours)
        if (Number.isFinite(h) && h > 0) hoursByBid.set(b.id, h)
        const c = d?.completeness
        if (c) laborByBid.set(b.id, { usable: c.usable === true, rateSet: c.rate_set === true, rowsTotal: Number(c.rows_total) || 0, rowsWithHours: Number(c.rows_with_hours) || 0 })
      } catch {
        /* held: no hours */
      }
    }),
  )

  // A finished job's actual: revenue − team labor at the burden − subs − parts, through the Costs tab's loader.
  const finished = linked.filter((j) => j.status === 'billed' || j.status === 'paid')
  const actualByJob = new Map<string, number | null>()
  let next = 0
  const worker = async () => {
    while (next < finished.length) {
      const job = finished[next++]!
      try {
        const inputs = await readJobChargesTimelineInputs(db, { id: job.id, revenue: job.revenue, pct_complete: job.pct_complete, invoices: job.invoices ?? [], materials: job.materials ?? [], payments: [] } as JobChargesTimelineJob, true)
        const s = spendByComponent(inputs.chargeEvents)
        actualByJob.set(job.id, Number(job.revenue ?? 0) - s.teamUsd * args.burden - s.subUsd - s.partsUsd)
      } catch {
        actualByJob.set(job.id, null)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ACTUALS_CONCURRENCY, finished.length) }, worker))
  const actualsUnread = [...actualByJob.values()].filter((v) => v == null).length

  // The closeout's day: the job's first Billed move (Paid when it was never marked Billed), as the Timeline reads it.
  const closedByJob = new Map<string, string>()
  const events = finished.length
    ? await fetchAllRowsChunkedIn(
        finished.map((j) => j.id),
        async (chunk, from, to) => ({
          data: (await withSupabaseRetry(async () => db.from('job_status_events').select('job_id, to_status, changed_at').in('job_id', chunk).in('to_status', ['billed', 'paid']).order('changed_at').range(from, to), 'scorecard status events')) as Array<{ job_id: string; to_status: string; changed_at: string }> | null,
          error: null,
        }),
        'scorecard status events',
        { chunkSize: 200 },
      ).catch(() => [] as Array<{ job_id: string; to_status: string; changed_at: string }>)
    : []
  for (const e of [...events].sort((a, b) => a.changed_at.localeCompare(b.changed_at))) if (!closedByJob.has(e.job_id)) closedByJob.set(e.job_id, calendarYmdInAppTzFromIso(e.changed_at))

  const ymd = (iso: string | null): string | null => (iso ? calendarYmdInAppTzFromIso(iso) : null)
  const inputs: EstimatorBidInput[] = bids.map((b) => {
    const job = jobByBid.get(b.id) ?? null
    const budget = job ? budgetByJob.get(job.id) : undefined
    const outcome = b.outcome === 'won' || b.outcome === 'started_or_complete' || b.outcome === 'lost' ? b.outcome : null
    return {
      bidId: b.id,
      bidNumber: b.bid_number,
      projectName: b.project_name,
      customerName: b.customers?.name ?? null,
      estimatorId: b.estimator_id,
      accountManagerId: b.account_manager_id,
      estimatorName: b.estimator?.name ?? null,
      accountManagerName: b.account_manager?.name ?? null,
      outcome,
      outcomeYmd: ymd(budget?.awarded_at ?? b.outcome_at),
      sentYmd: b.bid_date_sent ? b.bid_date_sent.slice(0, 10) : null,
      pricedRevenueUsd: b.priced_revenue_usd,
      pricedCostUsd: b.priced_cost_usd,
      pricedUncostedUsd: b.priced_uncosted_usd,
      labor: laborByBid.get(b.id) ?? null,
      awardedHours: budget?.awarded_labor_hours ?? hoursByBid.get(b.id) ?? null,
      job: job
        ? { jobId: job.id, label: jobLabelOf(job), status: job.status, finished: job.status === 'billed' || job.status === 'paid', closedYmd: closedByJob.get(job.id) ?? null, actualGrossProfitUsd: actualByJob.get(job.id) ?? null }
        : null,
    }
  })
  return { score: buildEstimatorScore({ bids: inputs, hurdle: args.hurdle, fromYmd: args.fromYmd, toYmd: args.toYmd, todayYmd: args.todayYmd }), actualsUnread }
}
