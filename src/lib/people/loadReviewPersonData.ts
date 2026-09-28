// The per-person panel's reads, moved out of `loadReviewDataCore` in
// `PeopleReviewTab.tsx`. What the loader took from the component by closure —
// the period's two ends, the paid-in-full switch, the pay config and the two
// rosters — arrives as its input; the panel's resets, its stale-response
// guard and its state writes stay in the tab. The shaping of what is read is
// `buildReviewPersonAllocation` (`reviewPersonAllocation.ts`), pure.

import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import type { CrewJobAssignment } from '../../utils/teamLabor'
import { loadCardChargeExclusions } from '../jobs/loadCardChargeExclusions'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'
import { ymdAddYears } from './reviewDateRange'
import { fetchJobStatusesByIds, paged, throwIfQueryError } from './reviewLoaderQueries'
import { buildReviewPersonAllocation, reviewPersonJobScope, type ReviewPersonData } from './reviewPersonAllocation'

export type { ReviewPersonData }

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
 * share of it, their hours, reports and tasks. Four waves of reads — the
 * second, third and fourth ask for what the first named (the jobs in scope,
 * then their money, then the hours behind the shares) — and one call to the
 * kernel. Holds no React state. Throws when a read fails.
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
  const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
  const allCrewRowsForCostAllTime = (allCrewResForCostAllTime.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
  const hoursRows = (hoursRes.data ?? []) as Array<{ work_date: string; hours: number }>
  const allReports = (reportsRes.data ?? []) as Array<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string }>
  const taskInstances = (tasksRes.data ?? []) as Array<{ id: string; checklist_item_id: string; scheduled_date: string; completed_at: string | null; checklist_items: { title: string; links?: string[] | null } | null }>
  const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
  const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; part_id: string | null; price_at_time: number | null; fixture_cost: number | null; quantity: number }>
  const allHoursRows = (allHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
  const allHoursRowsAllTime = (allHoursResAllTime.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>

  const outstandingInstances = (outstandingTasksRes.data ?? []) as Array<{
    id: string
    checklist_item_id: string
    scheduled_date: string
    completed_at: string | null
    checklist_items: { title: string; links?: string[] | null } | null
  }>

  // Chunked + paged: the id list here is every labor job company-wide in
  // the lookback (unbounded .in() lists eventually 414, and one chunk can
  // still return >1000 child rows).
  const allLaborJobIdsForCost = allLaborRowsForCostAllTime.map((r) => r.id)
  const laborItems = (await fetchAllRowsChunkedIn(
    allLaborJobIdsForCost,
    (chunk, f, t) => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(f, t),
    'load review labor items',
  )) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }>

  const { laborLinkIds, crewJobIds, allJobIds } = reviewPersonJobScope({
    personName,
    start,
    end,
    officeJobLedgerId,
    junctionJobIds,
    allLaborRowsForCostAllTime,
    crewRows,
  })
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
  const invoiceRows = (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>
  const materialRows = (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>
  const cardAllocRows = (cardChargeRows as Array<{ job_id: string; amount: number; mercury_transaction_id: string | null }>).map((r) => ({ ...r, mercury_transaction_id: r.mercury_transaction_id ?? '' }))
  const cardExclusions = await loadCardChargeExclusions([...new Set(cardAllocRows.map((r) => r.mercury_transaction_id).filter((id) => id.length > 0))])

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
  const allLaborJobIds = allLaborRows.map((r) => r.id)
  const allLaborItems = (await fetchAllRowsChunkedIn(
    allLaborJobIds,
    (chunk, f, t) => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(f, t),
    'load review lifetime labor items',
  )) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }>

  return buildReviewPersonAllocation({
    personName,
    start,
    end,
    onlyPaidJobs,
    payConfig,
    officeJobLedgerId,
    junctionJobIds,
    allLaborRowsForCostAllTime,
    crewRows,
    allCrewRowsForCostAllTime,
    hoursRows,
    allReports,
    taskInstances,
    outstandingInstances,
    settingsRows,
    tallyParts,
    allHoursRows,
    allHoursRowsAllTime,
    laborItems,
    crewJobsLedger,
    invoiceRows,
    materialRows,
    cardAllocRows,
    cardExclusions,
    allLaborRows,
    allCrewRows,
    allHoursRows2,
    allLaborItems,
  })
}
