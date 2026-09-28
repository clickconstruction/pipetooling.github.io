// The per-person panel's one read, moved verbatim out of `loadReviewDataCore`
// in `PeopleReviewTab.tsx`. What it took from the component by closure — the
// period's two ends, the paid-in-full switch, the pay config and the two
// rosters — arrives as its input; the panel's resets, its stale-response
// guard and its state writes stay in the tab.

import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { denverCalendarDayKey, endOfYmdInAppTzMs, startOfYmdInAppTzMs } from '../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import { laborJobMatchesPerson } from './laborJobPersonMatch'
import { laborJobSubCost } from '../jobs/subLaborCost'
import { summarizeCardChargeAllocations } from '../jobs/cardChargeAllocationFilter'
import { loadCardChargeExclusions } from '../jobs/loadCardChargeExclusions'
import { netCardChargesByJobId } from '../jobs/netCardChargesByJob'
import { reviewJobEarned, reviewShareRatio } from './reviewEarned'
import { ymdAddYears } from './reviewDateRange'
import { fetchJobStatusesByIds, laborRowJobId, paged, throwIfQueryError } from './reviewLoaderQueries'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'
import type { CrewJobAssignment, CrewJobRow } from '../../utils/teamLabor'
import type { ReviewCrewJob, ReviewLaborContributor, ReviewLaborJob, ReviewReport, ReviewTask } from './reviewPersonTypes'

export type ReviewPersonData = {
  laborJobs: ReviewLaborJob[]
  crewJobs: ReviewCrewJob[]
  allocatedRevenue: number
  allocatedProfit: number
  hours: Array<{ work_date: string; hours: number }>
  reports: ReviewReport[]
  tasks: ReviewTask[]
  outstandingTasks: ReviewTask[]
  /** Who put labor on each job, the biggest cost first — the breakdown window's rows. */
  laborByJobAndPerson: Record<string, ReviewLaborContributor[]>
}

export type ReviewPersonDataInput = {
  personName: string
  start: string
  end: string
  onlyPaidJobs: boolean
  payConfig: Record<string, PayConfigRow>
  people: ReadonlyArray<{ id: string; name?: string | null }>
  users: ReadonlyArray<{ id: string; name?: string | null }>
}

/**
 * Everything the per-person panel shows for one person and one period: the
 * sheets and crew days they worked with each job's money and this person's
 * share of it, their hours, reports and tasks. Reads and shapes; holds no
 * React state — the tab resets its panel before the call and commits what
 * comes back after its stale-response guard. Throws when a read fails.
 */
export async function loadReviewPersonData(input: ReviewPersonDataInput): Promise<ReviewPersonData> {
  const { personName, start, end, onlyPaidJobs, payConfig, people, users } = input
  // Trimmed comparison: payConfig keys carry whitespace variance and a
  // trailing space here used to silently blank Tasks/Reports for the person.
  const personNameTrimmed = personName.trim()
  const userId = users.find((u) => (u.name ?? '').trim() === personNameTrimmed)?.id ?? null
  // people.id for the junction-first sub-sheet read below (identity plan
  // C1-7); pay config carries person_id post-Phase-B as a second source.
  const personId =
    people.find((p) => (p.name ?? '').trim() === personNameTrimmed)?.id ??
    (payConfig[personName] ?? payConfig[personNameTrimmed])?.person_id ??
    null

  // Same exclusion as derivePersonTeamSummary: the configured Office job is
  // overhead, not field revenue — without it the panel lists "Office" as a
  // Jobs Worked row with a large negative allocation the Team Summary row
  // above deliberately does not have.
  const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()

  // Id-first pay-config resolution (matches utils/teamLabor.ts): crew rows
  // carry person_id post-Phase-B, so a renamed pay-config row still finds
  // its wage/salary flag instead of silently dropping to $0 / hourly.
  const payConfigById: Record<string, PayConfigRow> = {}
  for (const row of Object.values(payConfig)) {
    if (row.person_id) payConfigById[row.person_id] = row
  }

  // Anchored to the selected period like loadTeamReviewUnion — see the
  // comment there. Old custom ranges used to fall entirely outside the
  // lookback and rendered '—' hours with 100%-of-job allocations.
  // Company calendar day (v2.2688), not the browser's.
  const twoYearsAgoYmd = ymdAddYears(denverCalendarDayKey(Date.now()), -2)
  const lookbackStart = start < twoYearsAgoYmd ? start : twoYearsAgoYmd

  const [assigneesRes, allLaborResForCostAllTime, crewRes, allCrewResForCostAllTime, hoursRes, reportsRes, tasksRes, outstandingTasksRes, settingsRes, tallyRes, allHoursRes, allHoursResAllTime] = await Promise.all([
    // Junction-first sub-sheet attribution (identity plan C1-7): the old
    // `.eq('assigned_to_name', personName)` reads silently returned zero
    // rows for any sheet with 2+ assignees — the column is a ' | '-delimited
    // multi-name string. The person's rows are derived below from the
    // company-wide lookback fetch (a superset of both old windows) via
    // laborJobMatchesPerson (junction row first, split-name fallback).
    personId
      ? paged((f, t) => supabase.from('people_labor_job_assignees').select('labor_job_id').eq('person_id', personId).order('labor_job_id').range(f, t), 'load review labor job assignees')
      : Promise.resolve({ data: [] }),
    paged((f, t) => supabase.from('people_labor_jobs').select('id, job_date, address, job_number, job_ledger_id, labor_rate, distance_miles, assigned_to_name').gte('job_date', lookbackStart).order('id').range(f, t), 'load review lifetime labor jobs'),
    paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load review period crew days'),
    paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', lookbackStart).order('work_date').order('person_name').range(f, t), 'load review lifetime crew days'),
    supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
    // list_reports_with_job_info has a deterministic ORDER BY (created_at), so .range() pages are stable.
    paged((f, t) => supabase.rpc('list_reports_with_job_info').range(f, t), 'load review reports'),
    userId
      ? supabase
          .from('checklist_instances')
          .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)')
          .eq('checklist_instance_assignees.user_id', userId)
          .not('completed_at', 'is', null)
          // Local-midnight instants, matching the Reports window below —
          // the previous zoneless strings resolved as UTC, shifting the
          // Tasks window ~6h against the Reports list rendered beside it.
          .gte('completed_at', new Date(start + 'T00:00:00').toISOString())
          .lt('completed_at', new Date(new Date(end + 'T00:00:00').getTime() + 86_400_000).toISOString())
      : Promise.resolve({ data: [] }),
    userId
      ? supabase
          .from('checklist_instances')
          .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)')
          .eq('checklist_instance_assignees.user_id', userId)
          .is('completed_at', null)
          .order('scheduled_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
    // list_tally_parts_with_po orders by created_at, so .range() pages are stable.
    paged((f, t) => supabase.rpc('list_tally_parts_with_po').range(f, t), 'load review tally parts'),
    paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load review period hours'),
    paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart).order('work_date').order('person_name').range(f, t), 'load review lifetime hours'),
  ])

  throwIfQueryError(
    [assigneesRes, allLaborResForCostAllTime, crewRes, allCrewResForCostAllTime, hoursRes, reportsRes, tasksRes, outstandingTasksRes, settingsRes, tallyRes, allHoursRes, allHoursResAllTime],
    'load review data',
  )
  const allLaborRowsForCostAllTime = (allLaborResForCostAllTime.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; job_ledger_id: string | null; labor_rate: number | null; distance_miles: number | null; assigned_to_name: string | null }>
  const junctionJobIds: ReadonlySet<string> = new Set(
    ((assigneesRes.data ?? []) as Array<{ labor_job_id: string }>).map((r) => r.labor_job_id),
  )
  // Derived person attributions (see the wave comment above). YMD strings
  // compare lexicographically === chronologically; null job_date rows are
  // excluded from the period window exactly as the old `.gte`/`.lte` did.
  const laborRows = allLaborRowsForCostAllTime.filter(
    (r) => laborJobMatchesPerson(r, junctionJobIds, personName) && r.job_date != null && r.job_date >= start && r.job_date <= end,
  )
  const personLaborRowsAllTime = allLaborRowsForCostAllTime.filter((r) => laborJobMatchesPerson(r, junctionJobIds, personName))
  const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
  const allCrewRowsForCostAllTime = (allCrewResForCostAllTime.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
  const hoursRows = (hoursRes.data ?? []) as Array<{ work_date: string; hours: number }>
  const allReports = (reportsRes.data ?? []) as Array<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string }>
  const taskInstances = (tasksRes.data ?? []) as Array<{ id: string; checklist_item_id: string; scheduled_date: string; completed_at: string | null; checklist_items: { title: string; links?: string[] | null } | null }>
  const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
  const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; part_id: string | null; price_at_time: number | null; fixture_cost: number | null; quantity: number }>
  const allHoursRows = (allHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
  const allHoursRowsAllTime = (allHoursResAllTime.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>

  const mileageCost = settingsRows.find((r) => r.key === 'drive_mileage_cost')?.value_num ?? 0.70
  const timePerMile = settingsRows.find((r) => r.key === 'drive_time_per_mile')?.value_num ?? 0.02

  const partsCostByJobId = new Map<string, number>()
  for (const r of tallyParts) {
    const cost = r.part_id == null
      ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
      : Number(r.price_at_time ?? 0) * Number(r.quantity)
    partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
  }

  const hoursMap: Record<string, number> = {}
  for (const h of allHoursRows) {
    hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
  }
  const hoursMapAllTime: Record<string, number> = {}
  for (const h of allHoursRowsAllTime) {
    hoursMapAllTime[`${h.person_name}:${h.work_date}`] = h.hours
  }

  // Chunked + paged: the id list here is every labor job company-wide in
  // the lookback (unbounded .in() lists eventually 414, and one chunk can
  // still return >1000 child rows).
  const allLaborJobIdsForCost = allLaborRowsForCostAllTime.map((r) => r.id)
  const laborItems = (await fetchAllRowsChunkedIn(
    allLaborJobIdsForCost,
    (chunk, f, t) => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(f, t),
    'load review labor items',
  )) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }>
  const itemsByJob = new Map<string, typeof laborItems>()
  for (const i of laborItems) {
    const list = itemsByJob.get(i.job_id) ?? []
    list.push(i)
    itemsByJob.set(i.job_id, list)
  }


  const crewByDatePerson: Record<string, CrewJobRow> = {}
  for (const r of crewRows) {
    crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
      job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
    }
  }
  const crewByDatePersonAllTime: Record<string, CrewJobRow> = {}
  for (const r of allCrewRowsForCostAllTime) {
    crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`] = {
      job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
    }
  }
  const crewJobIds = new Set<string>()
  const crewJobsWithLead: Array<{ work_date: string; job_id: string; pct: number }> = []
  for (const r of crewRows) {
    if (r.person_name !== personName) continue
    const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    for (const a of assignments) {
      // Skip the configured office job — overhead, not crew revenue
      // (mirrors derivePersonTeamSummary).
      if (officeJobLedgerId && a.job_id === officeJobLedgerId) continue
      crewJobIds.add(a.job_id)
      crewJobsWithLead.push({ work_date: r.work_date, job_id: a.job_id, pct: a.pct })
    }
  }

  const teamLaborCostByJobId = new Map<string, number>()
  for (const r of allCrewRowsForCostAllTime) {
    const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    const cfg = (r.person_id ? payConfigById[r.person_id] : undefined) ?? payConfig[r.person_name]
    const hours = hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0
    const rate = cfg?.hourly_wage ?? 0
    for (const a of assignments) {
      const pctHrs = hours * (a.pct / 100)
      const cost = pctHrs * rate
      teamLaborCostByJobId.set(a.job_id, (teamLaborCostByJobId.get(a.job_id) ?? 0) + cost)
    }
  }

  // v2.3068: sheets resolve by their link through the ledger-by-ids RPC — the same read the
  // crew rows use. No number lookup: every sheet carries job_ledger_id (v2.3055 back-fill).
  const laborLinkIds = [...new Set([...laborRows, ...personLaborRowsAllTime].map((r) => r.job_ledger_id ?? '').filter(Boolean))]
  const allJobIds = [...new Set([...crewJobIds, ...laborLinkIds])]
  const usePaidOnly = onlyPaidJobs
  // The ledger RPC has a deterministic ORDER BY, so .range() pages are stable.
  const crewJobsRes =
    allJobIds.length > 0
      ? await paged(
          (f, t) =>
            (usePaidOnly
              ? supabase.rpc('get_jobs_ledger_by_ids_paid_only', { p_job_ids: allJobIds })
              : supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds })
            ).range(f, t),
          'load review crew ledger jobs',
        )
      : { data: [] }
  throwIfQueryError([crewJobsRes], 'load review ledger jobs')
  const crewJobsLedger = (crewJobsRes.data ?? []) as Array<{
    id: string
    hcp_number: string
    click_number?: string
    job_name: string
    job_address: string
    revenue: number | null
    pct_complete: number | null
    service_type_id: string | null
    status?: string | null
  }>
  const jobsById = new Map<string, (typeof crewJobsLedger)[0]>()
  for (const j of crewJobsLedger) jobsById.set(j.id, j)
  // v2.3360: the ledger RPCs carry no status; finished jobs earn 100% under the Bridge's rule.
  const statusByJobId = await fetchJobStatusesByIds([...jobsById.keys()])
  for (const j of jobsById.values()) j.status = statusByJobId.get(j.id) ?? null

  // v2.3068: keyed by the sheet's job (link first) — built once the ledger maps exist.
  const laborCostByJobId = new Map<string, number>()
  const driveCostByJobId = new Map<string, number>()
  for (const r of allLaborRowsForCostAllTime) {
    const jobId = laborRowJobId(r)
    if (!jobId) continue
    const items = itemsByJob.get(r.id) ?? []
    const rate = r.labor_rate ?? 0
    const miles = Number(r.distance_miles) || 0
    const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
    // Jobs-page costing (v2.2686): line rate overrides + direct $ lines + drive.
    const laborCost = laborJobSubCost({ labor_rate: r.labor_rate, items, distance_miles: r.distance_miles }, mileageCost, timePerMile)
    laborCostByJobId.set(jobId, (laborCostByJobId.get(jobId) ?? 0) + laborCost)
    if (driveCost > 0) driveCostByJobId.set(jobId, (driveCostByJobId.get(jobId) ?? 0) + driveCost)
  }

  const laborByJobAndPerson = new Map<string, Map<string, { hours: number; subLaborCost: number; crewLaborCost: number }>>()
  const upsertContrib = (jobId: string, personName: string, hours: number, subCost: number, crewCost: number) => {
    let perJob = laborByJobAndPerson.get(jobId)
    if (!perJob) {
      perJob = new Map()
      laborByJobAndPerson.set(jobId, perJob)
    }
    const existing = perJob.get(personName) ?? { hours: 0, subLaborCost: 0, crewLaborCost: 0 }
    existing.hours += hours
    existing.subLaborCost += subCost
    existing.crewLaborCost += crewCost
    perJob.set(personName, existing)
  }
  for (const r of allLaborRowsForCostAllTime) {
    const jobId = laborRowJobId(r)
    if (!jobId) continue
    const items = itemsByJob.get(r.id) ?? []
    const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
    const rate = r.labor_rate ?? 0
    const miles = Number(r.distance_miles) || 0
    const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
    const cost = hrs * rate + driveCost
    const who = (r.assigned_to_name ?? '').trim() || '(Unassigned)'
    upsertContrib(jobId, who, hrs, cost, 0)
  }
  for (const r of allCrewRowsForCostAllTime) {
    const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    const cfg = (r.person_id ? payConfigById[r.person_id] : undefined) ?? payConfig[r.person_name]
    const hours = hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0
    const rate = cfg?.hourly_wage ?? 0
    for (const a of assignments) {
      const pctHrs = hours * (a.pct / 100)
      const cost = pctHrs * rate
      upsertContrib(a.job_id, r.person_name, pctHrs, 0, cost)
    }
  }

  const personLaborCostByJobId = new Map<string, number>()
  const personCrewLaborByJobId = new Map<string, number>()
  const personDriveCostByJobId = new Map<string, number>()
  // Person's own lifetime sub-labor per job — subtracted from laborCostByJobId
  // so "Subs:" consistently means sub-labor by OTHERS on the job (the labor
  // and crew rows used to disagree: per-row vs whole-book subtraction).
  const personSubLaborCostByJobId = new Map<string, number>()
  for (const r of personLaborRowsAllTime) {
    const jobId = laborRowJobId(r)
    if (!jobId) continue
    const items = itemsByJob.get(r.id) ?? []
    const rate = r.labor_rate ?? 0
    const miles = Number(r.distance_miles) || 0
    const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
    // Jobs-page costing (v2.2686): line rate overrides + direct $ lines + drive.
    const laborCost = laborJobSubCost({ labor_rate: r.labor_rate, items, distance_miles: r.distance_miles }, mileageCost, timePerMile)
    personSubLaborCostByJobId.set(jobId, (personSubLaborCostByJobId.get(jobId) ?? 0) + laborCost)
    personLaborCostByJobId.set(jobId, (personLaborCostByJobId.get(jobId) ?? 0) + laborCost)
    if (driveCost > 0) personDriveCostByJobId.set(jobId, (personDriveCostByJobId.get(jobId) ?? 0) + driveCost)
  }
  for (const r of allCrewRowsForCostAllTime) {
    if (r.person_name !== personName) continue
    const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    const cfg = (r.person_id ? payConfigById[r.person_id] : undefined) ?? payConfig[r.person_name]
    const hours = hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0
    const rate = cfg?.hourly_wage ?? 0
    for (const a of assignments) {
      const pctHrs = hours * (a.pct / 100)
      const cost = pctHrs * rate
      personLaborCostByJobId.set(a.job_id, (personLaborCostByJobId.get(a.job_id) ?? 0) + cost)
      personCrewLaborByJobId.set(a.job_id, (personCrewLaborByJobId.get(a.job_id) ?? 0) + cost)
    }
  }

  const personHoursOnJobAllTime = new Map<string, number>()
  for (const r of personLaborRowsAllTime) {
    const jobId = laborRowJobId(r)
    if (!jobId) continue
    const items = itemsByJob.get(r.id) ?? []
    const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
    personHoursOnJobAllTime.set(jobId, (personHoursOnJobAllTime.get(jobId) ?? 0) + hrs)
  }
  for (const r of allCrewRowsForCostAllTime) {
    if (r.person_name !== personName) continue
    const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    const hours = hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0
    for (const a of assignments) {
      const pctHrs = hours * (a.pct / 100)
      personHoursOnJobAllTime.set(a.job_id, (personHoursOnJobAllTime.get(a.job_id) ?? 0) + pctHrs)
    }
  }

  const jobIds = Array.from(jobsById.keys())
  // get_invoice_amounts_for_jobs aggregates one row per job (bounded by the
  // period's job count, no ORDER BY) so it stays single-shot; materials is
  // chunked+paged.
  const [invoiceRes, materialsRes, cardChargeRows] = await Promise.all([
    jobIds.length > 0 ? supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
    fetchAllRowsChunkedIn(
      jobIds,
      (chunk, f, t) => supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', chunk).order('id').range(f, t),
      'load review billed materials',
    ).then((rows) => ({ data: rows, error: null })),
    // Mercury debit-card purchases allocated to jobs — the canonical parts
    // composition (Jobs page / Job Summary) is tally + supply invoices +
    // billed materials + card charges; this loader used to omit the card
    // bucket, overstating profit on card-heavy jobs.
    fetchAllRowsChunkedIn(
      jobIds,
      (chunk, f, t) => supabase.from('mercury_transaction_job_allocations').select('job_id, amount, mercury_transaction_id').in('job_id', chunk).order('id').range(f, t),
      'load review card charges',
    ),
  ])
  throwIfQueryError([invoiceRes, materialsRes], 'load review job invoices/materials')
  const invoiceAmountByJob: Record<string, number> = {}
  for (const row of (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>) {
    invoiceAmountByJob[row.job_id] = Number(row.invoice_amount ?? 0)
  }
  const billedMaterialsByJobId = new Map<string, number>()
  for (const row of (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>) {
    billedMaterialsByJobId.set(row.job_id, (billedMaterialsByJobId.get(row.job_id) ?? 0) + Number(row.amount ?? 0))
  }
  // The ONE card-charge rule Job Summary applies (v2.2692 via `cardChargeAllocationFilter`):
  // Internal Transfers are not a cost, and a charge linked to a supply-house invoice is the
  // purchase the invoice allocation already counts — counted once. Review summed gross rows
  // until this, so the same job read a different parts cost on the two surfaces (J963).
  const cardAllocRows = (cardChargeRows as Array<{ job_id: string; amount: number; mercury_transaction_id: string | null }>).map((r) => ({ ...r, mercury_transaction_id: r.mercury_transaction_id ?? '' }))
  const cardExclusions = await loadCardChargeExclusions([...new Set(cardAllocRows.map((r) => r.mercury_transaction_id).filter((id) => id.length > 0))])
  const cardChargesByJobId = netCardChargesByJobId(summarizeCardChargeAllocations(cardAllocRows, cardExclusions))

  const laborRowsOfficeFiltered = officeJobLedgerId
    ? laborRows.filter((r) => {
        // Mirror derivePersonTeamSummary: sub-labor rows pointing at the
        // configured office job are overhead, not field revenue.
        const jobId = laborRowJobId(r)
        if (!jobId) return true
        return jobId !== officeJobLedgerId
      })
    : laborRows
  const laborRowsFiltered = usePaidOnly
    ? laborRowsOfficeFiltered.filter((r) => {
        const jobId = laborRowJobId(r)
        return !!jobId && jobsById.has(jobId)
      })
    : laborRowsOfficeFiltered
  const laborJobs: ReviewLaborJob[] = laborRowsFiltered.map((r) => {
    const items = itemsByJob.get(r.id) ?? []
    const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
    const hoursInfo = items.length > 0 ? `${totalHrs.toFixed(2)} (${items.length} items)` : '—'
    const jobId = laborRowJobId(r)
    const job = jobId ? jobsById.get(jobId) : null
    const rate = r.labor_rate ?? 0
    const miles = Number(r.distance_miles) || 0
    const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
    // Jobs-page costing (v2.2686): line rate overrides + direct $ lines + drive.
    const laborCost = laborJobSubCost({ labor_rate: r.labor_rate, items, distance_miles: r.distance_miles }, mileageCost, timePerMile)
    const partsCost = jobId ? (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0) + (cardChargesByJobId.get(jobId) ?? 0) : 0
    const totalBill = job?.revenue != null ? Number(job.revenue) : 0
    // The Bridge's rule (v2.3360): finished → 100%, a set % → that %, nothing → 50%.
    const earned = reviewJobEarned({ revenue: totalBill, pctComplete: job?.pct_complete ?? null, status: job?.status ?? null, lifetimeHours: 0 })
    const pctComplete = Math.round(earned.pctEffective * 100)
    const valueCreated = earned.valueCreated
    const totalJobLabor = jobId ? (laborCostByJobId.get(jobId) ?? 0) + (teamLaborCostByJobId.get(jobId) ?? 0) : 0
    const revenueBeforeOverhead = valueCreated - partsCost - totalJobLabor
    return {
      source: 'labor',
      id: r.id,
      job_date: r.job_date,
      address: r.address ?? '',
      hoursInfo,
      hours: totalHrs,
      job_number: r.job_number,
      click_number: job?.click_number ?? null,
      job_id: jobId,
      job_name: job?.job_name ?? '—',
      service_type_id: job?.service_type_id ?? null,
      laborCost,
      driveCost,
      partsCost,
      totalBill,
      valueCreated,
      pctComplete,
      revenueBeforeOverhead,
      allocatedTotalBill: 0,
      allocatedRevenueBeforeOverhead: 0,
      allocatedPartsCost: 0,
      subLaborCost: jobId ? Math.max(0, (laborCostByJobId.get(jobId) ?? 0) - (personSubLaborCostByJobId.get(jobId) ?? 0)) : 0,
      totalLaborOnJob: totalJobLabor,
      totalDriveCostOnJob: jobId ? (driveCostByJobId.get(jobId) ?? 0) : 0,
      totalJobHours: 0,
      userTotalHoursOnJob: 0,
      userTotalContributionToBill: 0,
      userTotalContributionToRevenue: 0,
      userTotalLaborOnJob: 0,
      userTotalDriveCostOnJob: jobId ? (personDriveCostByJobId.get(jobId) ?? 0) : 0,
    }
  })

  const jobsMap: Record<string, { hcp_number: string; click_number: string; job_name: string; job_address: string; revenue: number | null; pct_complete: number | null; service_type_id: string | null; status: string | null }> = {}
  for (const j of crewJobsLedger) {
    jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', click_number: j.click_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '', revenue: j.revenue, pct_complete: j.pct_complete, service_type_id: j.service_type_id ?? null, status: j.status ?? null }
  }
  const crewJobsWithLeadFiltered = usePaidOnly
    ? crewJobsWithLead.filter((c) => jobsById.has(c.job_id))
    : crewJobsWithLead
  const cfg = personName ? payConfig[personName] : undefined
  const crewJobs: ReviewCrewJob[] = crewJobsWithLeadFiltered.map((c) => {
    const j = jobsMap[c.job_id] ?? jobsById.get(c.job_id)
    const dayHours = hoursMap[`${personName}:${c.work_date}`] ?? 0
    const hours = dayHours * (c.pct / 100)
    const laborCost = hours * (cfg?.hourly_wage ?? 0)
    const partsCost = (partsCostByJobId.get(c.job_id) ?? 0) + (invoiceAmountByJob[c.job_id] ?? 0) + (billedMaterialsByJobId.get(c.job_id) ?? 0) + (cardChargesByJobId.get(c.job_id) ?? 0)
    const totalBill = j?.revenue != null ? Number(j.revenue) : 0
    const earned = reviewJobEarned({ revenue: totalBill, pctComplete: j?.pct_complete ?? null, status: j?.status ?? null, lifetimeHours: 0 })
    const pctComplete = Math.round(earned.pctEffective * 100)
    const valueCreated = earned.valueCreated
    const jobId = c.job_id
    const totalJobLabor = (laborCostByJobId.get(jobId) ?? 0) + (teamLaborCostByJobId.get(jobId) ?? 0)
    const revenueBeforeOverhead = valueCreated - partsCost - totalJobLabor
    return {
      source: 'crew',
      job_id: c.job_id,
      work_date: c.work_date,
      hcp_number: effectiveJobLedgerNumber(j?.hcp_number, j?.click_number) || '—',
      click_number: j?.click_number ?? '',
      job_name: j?.job_name ?? '—',
      job_address: j?.job_address ?? '—',
      service_type_id: j?.service_type_id ?? null,
      hours,
      laborCost,
      driveCost: 0,
      partsCost,
      totalBill,
      valueCreated,
      pctComplete,
      revenueBeforeOverhead,
      allocatedTotalBill: 0,
      allocatedRevenueBeforeOverhead: 0,
      allocatedPartsCost: 0,
      subLaborCost: jobId ? Math.max(0, (laborCostByJobId.get(jobId) ?? 0) - (personSubLaborCostByJobId.get(jobId) ?? 0)) : 0,
      totalLaborOnJob: totalJobLabor,
      totalDriveCostOnJob: jobId ? (driveCostByJobId.get(jobId) ?? 0) : 0,
      totalJobHours: 0,
      userTotalHoursOnJob: 0,
      userTotalContributionToBill: 0,
      userTotalContributionToRevenue: 0,
      userTotalLaborOnJob: 0,
      userTotalDriveCostOnJob: personDriveCostByJobId.get(c.job_id) ?? 0,
    }
  })

  // Company-calendar window, not the browser's zone (identical for a Central viewer; correct for a remote one).
  const startDate = startOfYmdInAppTzMs(start)
  const endDate = endOfYmdInAppTzMs(end)
  const reports = allReports.filter((r) => (r.created_by_name ?? '').trim() === personNameTrimmed && new Date(r.created_at).getTime() >= startDate && new Date(r.created_at).getTime() <= endDate)

  const tasks: ReviewTask[] = taskInstances.map((t) => ({
    id: t.id,
    title: (t.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled',
    links: (t.checklist_items as { title: string; links?: string[] | null } | null)?.links,
    scheduled_date: t.scheduled_date,
    completed_at: t.completed_at,
  }))

  const outstandingInstances = (outstandingTasksRes.data ?? []) as Array<{
    id: string
    checklist_item_id: string
    scheduled_date: string
    completed_at: string | null
    checklist_items: { title: string; links?: string[] | null } | null
  }>
  const outstandingTasks: ReviewTask[] = outstandingInstances
    .map((t) => ({
      id: t.id,
      title: (t.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled',
      links: (t.checklist_items as { title: string; links?: string[] | null } | null)?.links,
      scheduled_date: t.scheduled_date,
      completed_at: null as string | null,
      checklist_item_id: t.checklist_item_id,
    }))
    .sort((a, b) => {
      const as = (a.scheduled_date ?? '').trim()
      const bs = (b.scheduled_date ?? '').trim()
      if (!as && !bs) return 0
      if (!as) return 1
      if (!bs) return -1
      return as.localeCompare(bs)
    })

  const hoursOnJobInPeriod = new Map<string, number>()
  for (const j of laborJobs) {
    if (j.job_id) hoursOnJobInPeriod.set(j.job_id, (hoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
  }
  for (const j of crewJobs) {
    hoursOnJobInPeriod.set(j.job_id, (hoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
  }

  // Calendar arithmetic on the YYYY-MM-DD strings themselves (v2.2688) —
  // no Date round-trip through the browser's timezone.
  const lookbackStart2Y = ymdAddYears(start, -2)
  const lookbackEnd = ymdAddYears(end, 1)

  const [allLaborRes, allCrewRes, allHoursRes2] = await Promise.all([
    !(laborLinkIds.length > 0 || crewJobIds.size > 0) ? Promise.resolve({ data: [] }) : paged((f, t) => supabase.from('people_labor_jobs').select('id, job_number, job_ledger_id, job_date').gte('job_date', lookbackStart2Y).lte('job_date', lookbackEnd).order('id').range(f, t), 'load review windowed labor jobs'),
    paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd).order('work_date').order('person_name').range(f, t), 'load review windowed crew days'),
    paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd).order('work_date').order('person_name').range(f, t), 'load review windowed hours'),
  ])
  throwIfQueryError([allLaborRes, allCrewRes, allHoursRes2], 'load review lifetime hours')
  const allLaborRows = (allLaborRes.data ?? []) as Array<{ id: string; job_number: string | null; job_ledger_id: string | null; job_date: string | null }>
  const allCrewRows = (allCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
  const allHoursRows2 = (allHoursRes2.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
  const hoursMapAll: Record<string, number> = {}
  for (const h of allHoursRows2) {
    hoursMapAll[`${h.person_name}:${h.work_date}`] = h.hours
  }

  const allLaborJobIds = allLaborRows.map((r) => r.id)
  const allLaborItems = (await fetchAllRowsChunkedIn(
    allLaborJobIds,
    (chunk, f, t) => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(f, t),
    'load review lifetime labor items',
  )) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }>
  const itemsByLaborJobId = new Map<string, typeof allLaborItems>()
  for (const i of allLaborItems) {
    const list = itemsByLaborJobId.get(i.job_id) ?? []
    list.push(i)
    itemsByLaborJobId.set(i.job_id, list)
  }

  // v2.3068: a lifetime sheet counts when its job is one the review knows (link first).
  const periodLaborJobIds = new Set(laborRows.map((r) => laborRowJobId(r)).filter((id): id is string => !!id))
  const totalHoursOnJob = new Map<string, number>()
  const totalHoursOnJobInPeriod = new Map<string, number>()
  for (const r of allLaborRows) {
    const jobId = laborRowJobId(r)
    if (!jobId || !jobsById.has(jobId)) continue
    const items = itemsByLaborJobId.get(r.id) ?? []
    const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
    totalHoursOnJob.set(jobId, (totalHoursOnJob.get(jobId) ?? 0) + hrs)
    if (r.job_date && r.job_date >= start && r.job_date <= end && periodLaborJobIds.has(jobId)) {
      totalHoursOnJobInPeriod.set(jobId, (totalHoursOnJobInPeriod.get(jobId) ?? 0) + hrs)
    }
  }
  const allCrewByDatePerson: Record<string, CrewJobRow> = {}
  for (const r of allCrewRows) {
    allCrewByDatePerson[`${r.work_date}:${r.person_name}`] = {
      job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
    }
  }
  const allJobIdsForCrew = [...new Set([...crewJobIds, ...jobsById.keys()])]
  const jobIdsSet = new Set(allJobIdsForCrew)
  for (const r of allCrewRows) {
    const row = allCrewByDatePerson[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    const hours = hoursMapAll[`${r.person_name}:${r.work_date}`] ?? 0
    for (const a of assignments) {
      if (!jobIdsSet.has(a.job_id)) continue
      const pctHrs = hours * (a.pct / 100)
      totalHoursOnJob.set(a.job_id, (totalHoursOnJob.get(a.job_id) ?? 0) + pctHrs)
      if (r.work_date >= start && r.work_date <= end) {
        totalHoursOnJobInPeriod.set(a.job_id, (totalHoursOnJobInPeriod.get(a.job_id) ?? 0) + pctHrs)
      }
    }
  }

  // The Bridge's rule (v2.3360): value created = contract × (finished → 100% ·
  // a set % → that % · nothing → 50%); this person's share = their crew clock
  // hours on the job in the period ÷ the job's lifetime crew clock hours.
  // Sub labor sheets are a job cost, not a share of revenue.
  const allocationJobsMap = new Map<string, { valueCreated: number; revenueBeforeOverhead: number; totalLaborOnJob: number; lifetimeHours: number }>()
  const laborJobIdsSeen = new Set<string>()
  for (const r of laborRows) {
    const jobId = laborRowJobId(r)
    if (!jobId || laborJobIdsSeen.has(jobId)) continue
    laborJobIdsSeen.add(jobId)
    const job = jobsById.get(jobId)
    const subLaborCost = laborCostByJobId.get(jobId) ?? 0
    const teamLaborCost = teamLaborCostByJobId.get(jobId) ?? 0
    const totalLaborOnJob = subLaborCost + teamLaborCost
    const partsCost = (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0) + (cardChargesByJobId.get(jobId) ?? 0)
    const lifetimeHours = totalHoursOnJob.get(jobId) ?? 0
    const valueCreated = reviewJobEarned({ revenue: job?.revenue != null ? Number(job.revenue) : null, pctComplete: job?.pct_complete ?? null, status: job?.status ?? null, lifetimeHours }).valueCreated
    const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
    allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob, lifetimeHours })
  }
  for (const jobId of crewJobIds) {
    if (allocationJobsMap.has(jobId)) continue
    const j = jobsById.get(jobId)
    const subLaborCost = laborCostByJobId.get(jobId) ?? 0
    const totalLaborOnJob = subLaborCost + (teamLaborCostByJobId.get(jobId) ?? 0)
    const partsCost = (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0) + (cardChargesByJobId.get(jobId) ?? 0)
    const lifetimeHours = totalHoursOnJob.get(jobId) ?? 0
    const valueCreated = reviewJobEarned({ revenue: j?.revenue != null ? Number(j.revenue) : null, pctComplete: j?.pct_complete ?? null, status: j?.status ?? null, lifetimeHours }).valueCreated
    const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
    allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob, lifetimeHours })
  }

  const crewHoursOnJobInPeriod = new Map<string, number>()
  for (const j of crewJobs) {
    crewHoursOnJobInPeriod.set(j.job_id, (crewHoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
  }

  let allocatedRevenue = 0
  let allocatedProfit = 0
  for (const [jobId, { valueCreated, revenueBeforeOverhead, lifetimeHours }] of allocationJobsMap) {
    const ratio = reviewShareRatio(crewHoursOnJobInPeriod.get(jobId) ?? 0, lifetimeHours)
    allocatedRevenue += valueCreated * ratio
    allocatedProfit += revenueBeforeOverhead * ratio
  }

  for (const j of laborJobs) {
    j.totalJobHours = j.job_id ? (totalHoursOnJob.get(j.job_id) ?? 0) : 0
    j.userTotalHoursOnJob = j.job_id ? (personHoursOnJobAllTime.get(j.job_id) ?? 0) : 0
    j.userTotalLaborOnJob = j.job_id ? (personLaborCostByJobId.get(j.job_id) ?? 0) : 0
    // A sheet has no clock hours: it is a job cost, not a share of revenue (v2.3360).
    const costRatio = 0
    const revenueCostRatio = reviewShareRatio(j.userTotalHoursOnJob, j.totalJobHours)
    j.userTotalContributionToBill = j.valueCreated * revenueCostRatio
    j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
    j.allocatedTotalBill = j.valueCreated * costRatio
    j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
    j.allocatedPartsCost = j.partsCost * costRatio
  }
  for (const j of crewJobs) {
    j.totalJobHours = totalHoursOnJob.get(j.job_id) ?? 0
    j.userTotalHoursOnJob = personHoursOnJobAllTime.get(j.job_id) ?? 0
    j.userTotalLaborOnJob = personLaborCostByJobId.get(j.job_id) ?? 0
    // Hours share (v2.3360): this row's crew hours ÷ the job's lifetime crew hours.
    const costRatio = reviewShareRatio(j.hours, j.totalJobHours)
    const revenueCostRatio = reviewShareRatio(j.userTotalHoursOnJob, j.totalJobHours)
    j.userTotalContributionToBill = j.valueCreated * revenueCostRatio
    j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
    j.allocatedTotalBill = j.valueCreated * costRatio
    j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
    j.allocatedPartsCost = j.partsCost * costRatio
  }

  const breakdownByJob: Record<string, ReviewLaborContributor[]> = {}
  for (const [jobId, perJob] of laborByJobAndPerson.entries()) {
    const rows: ReviewLaborContributor[] = []
    for (const [personName, agg] of perJob.entries()) {
      rows.push({
        personName,
        hours: agg.hours,
        laborCost: agg.subLaborCost + agg.crewLaborCost,
        subLaborCost: agg.subLaborCost,
        crewLaborCost: agg.crewLaborCost,
      })
    }
    rows.sort((a, b) => b.laborCost - a.laborCost || b.hours - a.hours || a.personName.localeCompare(b.personName))
    breakdownByJob[jobId] = rows
  }
  return {
    laborJobs,
    crewJobs,
    allocatedRevenue,
    allocatedProfit,
    hours: hoursRows.map((r) => ({ work_date: r.work_date, hours: r.hours })),
    reports: reports.map((r) => ({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at })),
    tasks,
    outstandingTasks,
    laborByJobAndPerson: breakdownByJob,
  }
}
