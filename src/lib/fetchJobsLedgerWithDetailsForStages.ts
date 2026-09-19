/**
 * Shared jobs_ledger fetch + enrichment used by Jobs `loadJobs` and Accounts Receivable standalone page.
 * Keep in sync when extending Stages job shape. Two halves since v2.3600: the primary query
 * (`fetchJobsLedgerStagesPrimary` → `primaryRowToJobWithDetails`) and the enrichment
 * (`fetchStagesEnrichment` → `applyStagesEnrichment` in `lib/jobs/stagesEnrichment.ts`), so the
 * Stages cache can paint rows before the passes land.
 */
import { supabase } from './supabase'
import { mergeMaxScheduleWorkDateByJobId } from './stagesJobReferenceDates'
import { applyStagesEnrichment, parseStagesEnrichmentPayload, type StagesEnrichment, type StagesEstimateCandidate } from './jobs/stagesEnrichment'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import type { JobWithDetails } from '../types/jobWithDetails'
import { buildJobsListStagesPrimarySelect, JOBS_LEDGER_FIXTURES_EMBED, JOBS_LEDGER_MATERIALS_EMBED } from './jobsLedgerEmbedSelects'
import { jobSummaryRowMatchesMinHcp } from './jobSummaryHcpFilter'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']

/**
 * v2.1823 (scoped-load plan PR 2): per-section scopes join the historical
 * three. `ready_to_bill` ALSO returns working-status jobs that carry an RTB
 * invoice (the board's RTB section shows their invoice rows) via a second
 * inner-join-gated query.
 */
export type JobsLedgerStatusScope =
  | 'all'
  | 'non_paid'
  | 'paid'
  | 'waiting'
  | 'working'
  | 'ready_to_bill'
  | 'billed_all'

/** List primary query omits materials/fixtures; those load in a second round (see batch in enrich). */
export type JobsLedgerStagesPrimaryRow = JobsLedgerRow & {
  jobs_ledger_payments?: JobsLedgerPayment[]
  jobs_ledger_invoices?: JobsLedgerInvoice[]
  jobs_ledger_team_members?: (JobsLedgerTeamMember & { users: { name: string; archived_at?: string | null; role?: string | null } | null })[]
  reports?: Array<{ job_ledger_id: string | null }>
  projects?: { id: string; name: string } | null
  bids?: { id: string; project_name: string | null; bid_number: string | null; service_type_id: string | null } | null
  gc_customer?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
  account_manager?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
  development?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
  service_types?: { name: string } | null
}

/** PostgREST returns embedded to-one as an object or a 1-element array. */
function oneEmbed<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

export type FetchJobsLedgerWithDetailsResult =
  | {
      ok: true
      jobs: JobWithDetails[]
      /**
       * v2.2914: how many primary rows the `minHcpExclusive` floor dropped
       * before enrichment — the Job Summary footer's "N older jobs hidden"
       * count. Present only when a floor was applied.
       */
      hiddenByMinHcp?: number
    }
  | { ok: false; error: string }

function buildJobsListStagesQuery(customerFilter: string | null, statusScope: JobsLedgerStatusScope) {
  let q = supabase
    .from('jobs_ledger')
    .select(buildJobsListStagesPrimarySelect())
    // Rough server-side pre-sort only. PostgREST cannot order by an expression,
    // so this can't consider `click_number` — click-only jobs land at the end
    // here. `buildJobsStagesBoardLists` re-sorts by the effective job number
    // (HCP else Click) via sortStagesJobsByEffectiveNumberDesc; that is the
    // ordering the board actually shows.
    .order('hcp_number', { ascending: false })
  if (customerFilter) {
    q = q.eq('customer_id', customerFilter)
  }
  if (statusScope === 'non_paid') {
    // Include null status (treated as working in UI). Plain `neq` would drop SQL NULLs.
    q = q.or('status.is.null,status.neq.paid')
  } else if (statusScope === 'paid') {
    q = q.eq('status', 'paid')
  } else if (statusScope === 'waiting') {
    q = q.eq('status', 'waiting')
  } else if (statusScope === 'working') {
    q = q.or('status.is.null,status.eq.working')
  } else if (statusScope === 'ready_to_bill') {
    q = q.eq('status', 'ready_to_bill')
  } else if (statusScope === 'billed_all') {
    q = q.eq('status', 'billed')
  }
  return q
}

/**
 * Companion query for the `ready_to_bill` scope: working/null-status jobs that
 * carry an RTB invoice. The `rtb_gate` aliased INNER embed does the gating so
 * the job's REAL `jobs_ledger_invoices` embed stays complete (an unaliased
 * !inner filter would strip the job's billed invoices from the payload).
 */
function buildWorkingWithRtbInvoiceQuery(customerFilter: string | null) {
  let q = supabase
    .from('jobs_ledger')
    .select(`${buildJobsListStagesPrimarySelect()}, rtb_gate:jobs_ledger_invoices!inner(id)`)
    .or('status.is.null,status.eq.working')
    .eq('rtb_gate.status', 'ready_to_bill')
    .order('hcp_number', { ascending: false })
  if (customerFilter) {
    q = q.eq('customer_id', customerFilter)
  }
  return q
}

/** The primary row onto the board's job shape — the four enriched fields empty until a pass lands. */
export function primaryRowToJobWithDetails(row: JobsLedgerStagesPrimaryRow): JobWithDetails {
  const {
    jobs_ledger_payments: pay,
    jobs_ledger_invoices: inv,
    jobs_ledger_team_members: team,
    reports: rep,
    projects: proj,
    bids: bidEmbed,
    gc_customer: gcEmbed,
    development: devEmbed,
    account_manager: amEmbed,
    service_types: serviceTypeEmbed,
    ...job
  } = row
  return {
    ...job,
    serviceType:
      serviceTypeEmbed && typeof (serviceTypeEmbed as { name?: string }).name === 'string'
        ? { name: (serviceTypeEmbed as { name: string }).name }
        : null,
    materials: [],
    fixtures: [],
    payments: (pay ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
    invoices: (inv ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
    team_members: team ?? [],
    report_count: (rep ?? []).length,
    project: proj ?? null,
    gcCustomer: oneEmbed(gcEmbed),
    development: oneEmbed(devEmbed),
    account_manager: oneEmbed(amEmbed),
    linkedBid: bidEmbed
      ? {
          id: bidEmbed.id,
          project_name: bidEmbed.project_name,
          bid_number: bidEmbed.bid_number,
          service_type_id: bidEmbed.service_type_id ?? null,
        }
      : null,
    last_schedule_work_date: null,
    linkedEstimateForStages: null,
  }
}

const ENRICH_IN_CHUNK = 150

/**
 * The Stages enrichment for a set of job ids — materials + fixtures, schedule work dates,
 * estimate candidates — as maps keyed by job id. One request since v2.3602 (Pipeline load
 * speed PR 3): the `get_stages_enrichment` RPC (SECURITY INVOKER, the tables' RLS applies).
 * When that call fails — the function not deployed yet, a network error, a payload that is
 * not the four maps — the chunked passes below run instead, as they did in v2.3600.
 */
export async function fetchStagesEnrichment(ids: readonly string[]): Promise<StagesEnrichment> {
  if (ids.length === 0) return { materialsByJobId: new Map(), fixturesByJobId: new Map(), scheduleMaxByJobId: new Map(), estimateCandidatesByJobId: new Map() }
  try {
    const { data, error } = await supabase.rpc('get_stages_enrichment', { p_job_ids: [...ids] })
    if (!error) {
      const parsed = parseStagesEnrichmentPayload(data)
      if (parsed) return parsed
      console.warn('fetchStagesEnrichment: RPC payload was not the four maps — running the chunked passes')
    } else console.warn('fetchStagesEnrichment: RPC failed — running the chunked passes', error.message)
  } catch (e) {
    console.warn('fetchStagesEnrichment: RPC threw — running the chunked passes', e)
  }
  return fetchStagesEnrichmentInPasses(ids)
}

/** The v2.3600 shape: three passes in parallel, `.in()` chunks of 150, each degrading on its own. */
export async function fetchStagesEnrichmentInPasses(ids: readonly string[]): Promise<StagesEnrichment> {
  const materialsByJobId = new Map<string, JobsLedgerMaterial[]>()
  const fixturesByJobId = new Map<string, JobsLedgerFixture[]>()
  const scheduleMaxByJobId = new Map<string, string>()
  const estimateCandidatesByJobId = new Map<string, StagesEstimateCandidate[]>()
  if (ids.length === 0) return { materialsByJobId, fixturesByJobId, scheduleMaxByJobId, estimateCandidatesByJobId }
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += ENRICH_IN_CHUNK) chunks.push(ids.slice(i, i + ENRICH_IN_CHUNK))

  const materialsAndFixtures = async () => {
    try {
      for (const chunk of chunks) {
        const [matRes, fixRes] = await Promise.all([
          withSupabaseRetry(
            async () => supabase.from('jobs_ledger_materials').select(JOBS_LEDGER_MATERIALS_EMBED).in('job_id', chunk),
            'jobs_ledger_materials batch for stages list',
          ),
          withSupabaseRetry(
            async () => supabase.from('jobs_ledger_fixtures').select(JOBS_LEDGER_FIXTURES_EMBED).in('job_id', chunk),
            'jobs_ledger_fixtures batch for stages list',
          ),
        ])
        for (const m of (matRes ?? []) as unknown as JobsLedgerMaterial[]) {
          const arr = materialsByJobId.get(m.job_id) ?? []
          arr.push(m)
          materialsByJobId.set(m.job_id, arr)
        }
        for (const f of (fixRes ?? []) as unknown as JobsLedgerFixture[]) {
          const arr = fixturesByJobId.get(f.job_id) ?? []
          arr.push(f)
          fixturesByJobId.set(f.job_id, arr)
        }
      }
    } catch (e) {
      console.warn('fetchStagesEnrichment: materials/fixtures batch failed', e)
    }
  }
  const schedule = async () => {
    try {
      for (const chunk of chunks) {
        const blockRows = await withSupabaseRetry(
          async () => supabase.from('job_schedule_blocks').select('job_id, work_date').in('job_id', chunk),
          'job_schedule_blocks for stages banner',
        )
        const part = mergeMaxScheduleWorkDateByJobId((blockRows ?? []) as Array<{ job_id: string; work_date: string }>)
        for (const [jobId, ymd] of part) {
          const prev = scheduleMaxByJobId.get(jobId)
          if (prev == null || ymd > prev) scheduleMaxByJobId.set(jobId, ymd)
        }
      }
    } catch (e) {
      console.warn('fetchStagesEnrichment: job_schedule_blocks batch failed', e)
      scheduleMaxByJobId.clear()
    }
  }
  const estimates = async () => {
    try {
      for (const chunk of chunks) {
        const estimateRows = await withSupabaseRetry(
          async () =>
            supabase.from('estimates').select('job_ledger_id, estimate_number, title, status, updated_at').in('job_ledger_id', chunk),
          'load estimates for stages banner',
        )
        for (const row of (estimateRows ?? []) as Array<StagesEstimateCandidate & { job_ledger_id: string | null }>) {
          if (!row.job_ledger_id) continue
          const cur = estimateCandidatesByJobId.get(row.job_ledger_id) ?? []
          cur.push({ estimate_number: row.estimate_number, title: row.title, status: row.status, updated_at: row.updated_at })
          estimateCandidatesByJobId.set(row.job_ledger_id, cur)
        }
      }
    } catch (e) {
      console.warn('fetchStagesEnrichment: estimates stages banner batch failed', e)
      estimateCandidatesByJobId.clear()
    }
  }
  await Promise.all([materialsAndFixtures(), schedule(), estimates()])
  return { materialsByJobId, fixturesByJobId, scheduleMaxByJobId, estimateCandidatesByJobId }
}

/**
 * Batched materials, fixtures, schedule, and estimate enrichment for already-fetched `jobs_ledger` primary rows.
 */
export async function enrichJobsLedgerPrimaryRows(rows: JobsLedgerStagesPrimaryRow[]): Promise<JobWithDetails[]> {
  if (rows.length === 0) return []
  const jobs = rows.map(primaryRowToJobWithDetails)
  return applyStagesEnrichment(jobs, await fetchStagesEnrichment(jobs.map((j) => j.id)))
}

const MATERIALS_ONLY_CHUNK = 150

/**
 * Job Summary tab: same primary row shape as Stages, but only loads `jobs_ledger_materials` (billed line items)
 * and skips Stages-only passes (fixtures, schedule blocks, estimates) to reduce queries and time.
 * Job Summary cost math only needs `materials` for billed sum, not `fixtures` or schedule/estimate banner fields.
 *
 * Discount rows are the one exception (v2.3273): `fixtures` carries ONLY the job's discount line items
 * (`line_kind = 'discount'`, plus legacy negative rows) — the leakage figure, the − discount chip and the
 * discount fold read them; nothing else on this path reads `fixtures`.
 */
export async function enrichJobsLedgerPrimaryRowsJobSummarySlim(
  rows: JobsLedgerStagesPrimaryRow[],
): Promise<JobWithDetails[]> {
  if (rows.length === 0) {
    return []
  }
  let jobsWithDetails: JobWithDetails[] = rows.map(primaryRowToJobWithDetails)

  const materialsByJobId = new Map<string, JobsLedgerMaterial[]>()
  const discountsByJobId = new Map<string, JobsLedgerFixture[]>()
  try {
    const ids = jobsWithDetails.map((j) => j.id)
    for (let i = 0; i < ids.length; i += MATERIALS_ONLY_CHUNK) {
      const chunk = ids.slice(i, i + MATERIALS_ONLY_CHUNK)
      const [matRes, discRes] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger_materials').select(JOBS_LEDGER_MATERIALS_EMBED).in('job_id', chunk),
          'jobs_ledger_materials batch for job summary',
        ),
        withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_fixtures')
              .select(JOBS_LEDGER_FIXTURES_EMBED)
              .in('job_id', chunk)
              .or('line_kind.eq.discount,line_unit_price.lt.0'),
          'jobs_ledger_fixtures discount rows for job summary',
        ),
      ])
      for (const m of (matRes ?? []) as unknown as JobsLedgerMaterial[]) {
        const jid = m.job_id
        const arr = materialsByJobId.get(jid) ?? []
        arr.push(m)
        materialsByJobId.set(jid, arr)
      }
      for (const f of (discRes ?? []) as unknown as JobsLedgerFixture[]) {
        const jid = f.job_id
        const arr = discountsByJobId.get(jid) ?? []
        arr.push(f)
        discountsByJobId.set(jid, arr)
      }
    }
    jobsWithDetails = jobsWithDetails.map((j) => ({
      ...j,
      materials: (materialsByJobId.get(j.id) ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      fixtures: (discountsByJobId.get(j.id) ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
    }))
  } catch (e) {
    console.warn('enrichJobsLedgerPrimaryRowsJobSummarySlim: materials batch failed', e)
  }

  return jobsWithDetails
}

export type FetchJobsLedgerWithDetailsForStagesOptions = {
  customerFilter?: string | null
  /** Default `all`: one query. Use `non_paid` and `paid` in sequence for a two-phase load. */
  statusScope?: JobsLedgerStatusScope
  /**
   * When true, use `enrichJobsLedgerPrimaryRowsJobSummarySlim` (materials only). Intended for Job Summary tab.
   */
  jobSummaryEnrich?: boolean
  /**
   * After the primary `jobs_ledger` query, keep only rows that pass the Job Summary min-HCP rule
   * (before enrichment) so we batch materials for fewer jobs.
   */
  minHcpExclusive?: number | null
  /**
   * v2.1825 (plan PR 4): fetch exactly these job ids (any status) with the
   * full stages embeds — the second phase of the lean search. `statusScope`
   * is ignored when set.
   */
  ids?: readonly string[]
}

export type FetchJobsLedgerStagesPrimaryResult =
  | { ok: true; rows: JobsLedgerStagesPrimaryRow[]; hiddenByMinHcp?: number }
  | { ok: false; error: string }

/**
 * The primary query alone (Pipeline load speed PR 2, v2.3600): the rows the board can paint
 * from — payments, invoices, team members and the to-one embeds ride on them — before any
 * enrichment pass. `fetchJobsLedgerWithDetailsForStages` is this plus the passes; the Stages
 * cache calls the two halves itself so the rows show while the passes run.
 */
export async function fetchJobsLedgerStagesPrimary(
  options: Omit<FetchJobsLedgerWithDetailsForStagesOptions, 'jobSummaryEnrich'> = {},
): Promise<FetchJobsLedgerStagesPrimaryResult> {
  const customerFilter = options.customerFilter?.trim() || null
  const statusScope = options.statusScope ?? 'all'
  const minHcp = options.minHcpExclusive

  const idsFilter = options.ids
  let rows: JobsLedgerStagesPrimaryRow[]
  try {
    const data = (await withSupabaseRetry(
      async () =>
        idsFilter != null
          ? supabase
              .from('jobs_ledger')
              .select(buildJobsListStagesPrimarySelect())
              .in('id', [...idsFilter])
              .order('hcp_number', { ascending: false })
          : buildJobsListStagesQuery(customerFilter, statusScope),
      'fetch jobs_ledger for stages',
    )) as unknown
    rows = (data as JobsLedgerStagesPrimaryRow[] | null) ?? []
    if (idsFilter == null && statusScope === 'ready_to_bill') {
      const companion = (await withSupabaseRetry(
        async () => buildWorkingWithRtbInvoiceQuery(customerFilter),
        'fetch working-with-RTB jobs for stages',
      )) as unknown
      const seen = new Set(rows.map((r) => r.id))
      for (const raw of (companion as Array<JobsLedgerStagesPrimaryRow & { rtb_gate?: unknown }> | null) ?? []) {
        const { rtb_gate: _gate, ...row } = raw
        if (!seen.has(row.id)) rows.push(row as JobsLedgerStagesPrimaryRow)
      }
    }
  } catch (e: unknown) {
    return { ok: false, error: formatErrorMessage(e, 'Failed to load jobs') }
  }
  let hiddenByMinHcp: number | undefined
  if (minHcp != null && !Number.isNaN(Number(minHcp)) && minHcp >= -1) {
    const floor = minHcp
    const before = rows.length
    rows = rows.filter((r) => jobSummaryRowMatchesMinHcp(r.hcp_number, floor))
    hiddenByMinHcp = before - rows.length
  }
  return { ok: true, rows, hiddenByMinHcp }
}

export async function fetchJobsLedgerWithDetailsForStages(
  options: FetchJobsLedgerWithDetailsForStagesOptions = {},
): Promise<FetchJobsLedgerWithDetailsResult> {
  const primary = await fetchJobsLedgerStagesPrimary(options)
  if (!primary.ok) return primary
  const { rows, hiddenByMinHcp } = primary
  if (rows.length === 0) {
    return { ok: true, jobs: [], hiddenByMinHcp }
  }
  const jobs = options.jobSummaryEnrich === true
    ? await enrichJobsLedgerPrimaryRowsJobSummarySlim(rows)
    : await enrichJobsLedgerPrimaryRows(rows)
  return { ok: true, jobs, hiddenByMinHcp }
}
