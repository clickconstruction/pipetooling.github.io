// The Team Summary's one read for the whole team, moved verbatim out of
// `PeopleReviewTab.tsx`. It reads and shapes; it holds no React state. The
// roster of app users — the Wheels fuel exclusion maps a card charge's user to
// a name through it — was the component's `users` prop, read by closure, and
// is the last parameter here.

import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import type { CrewBidAssignment, CrewJobAssignment, CrewJobRow } from '../../utils/teamLabor'
import { laborJobSubCost } from '../jobs/subLaborCost'
import { summarizeCardChargeAllocations } from '../jobs/cardChargeAllocationFilter'
import { loadCardChargeExclusions } from '../jobs/loadCardChargeExclusions'
import { netCardChargesByJobId } from '../jobs/netCardChargesByJob'
import { approvedClosedSessionHours, overheadBucketForSession, type OverheadClockSessionRow } from '../overheadDailyLabor'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'
import { costLineTags, sumTagChargesByJob } from '../mercuryTagSplit'
import { fetchLabelIdByTxId } from '../banking/categoryTagsData'
import type { CategoryTagLookups } from '../banking/categoryTags'
import { ymdAddYears } from './reviewDateRange'
import { fetchJobStatusesByIds, laborRowJobId, paged, throwIfQueryError } from './reviewLoaderQueries'
import { loadWheelsSnapshot } from './wheelsData'
import { loadFuelOffJobsByUserId } from './reviewVehicleFuel'
import type { TeamLaborItem, TeamLedgerRow, TeamPeriodLaborRow, TeamReviewUnion, TeamReviewVehicle } from './teamReviewTypes'

/**
 * Tier 3 — shared dataset fetched once for the whole team.
 * Replaces N × `loadReviewData()` round-trips with one set of queries that
 * covers every person in `showPeopleForReview`. Per-person numbers are then
 * derived from this union purely in JS by `derivePersonTeamSummary()`.
 */
export async function loadTeamReviewUnion(
  start: string,
  end: string,
  onlyPaidJobs: boolean,
  payConfigSnapshot: Record<string, PayConfigRow>,
  tagLookups: CategoryTagLookups,
  users: ReadonlyArray<{ id: string; name: string }>,
): Promise<TeamReviewUnion> {
  // Anchored to the SELECTED PERIOD, not just today: with a pure today−2y
  // lookback, any period starting more than 2 years back had zero lifetime
  // hours/cost rows, so the allocation-ratio fallback credited each person
  // 100% of every job. YYYY-MM-DD compares lexicographically. Company
  // calendar day (v2.2688), not the browser's.
  const twoYearsAgoYmd = ymdAddYears(denverCalendarDayKey(Date.now()), -2)
  const lookbackStart = start < twoYearsAgoYmd ? start : twoYearsAgoYmd

  const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()

  // Id-first pay-config resolution — see the identical index in
  // loadReviewDataCore.
  const payConfigSnapshotById: Record<string, PayConfigRow> = {}
  for (const row of Object.values(payConfigSnapshot)) {
    if (row.person_id) payConfigSnapshotById[row.person_id] = row
  }

  const overheadSessionsAllTimeFetchPromise = (async () => {
    // Period-bounded (was an unbounded 2-year fetch): the consumer below
    // discards everything outside [start, end], so the wider window only
    // bought silent max_rows truncation — which zeroed office hours for
    // whichever people fell past the 1000-row cap. Paged for the same
    // reason.
    const makeQ = () => {
      let q = supabase
        .from('clock_sessions')
        .select(
          'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
        )
        .gte('work_date', start)
        .lte('work_date', end)
      if (officeJobLedgerId) {
        q = q.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
      } else {
        q = q.not('bid_id', 'is', null)
      }
      return q.order('id')
    }
    const rows = await fetchAllRows(
      (f, t) => makeQ().range(f, t),
      'load team summary overhead sessions',
    )
    return rows as unknown as OverheadClockSessionRow[]
  })()

  const [
    periodLaborRes,
    allTimeLaborRes,
    periodCrewRes,
    allTimeCrewRes,
    periodCrewBidsRes,
    periodHoursRes,
    allTimeHoursRes,
    settingsRes,
    tallyRes,
    overheadSessionsAllTime,
  ] = await Promise.all([
    paged((f, t) => supabase.from('people_labor_jobs').select('id, job_date, address, job_number, job_ledger_id, labor_rate, distance_miles, assigned_to_name').gte('job_date', start).lte('job_date', end).order('id').range(f, t), 'load team summary period labor jobs'),
    paged((f, t) => supabase.from('people_labor_jobs').select('id, job_date, address, job_number, job_ledger_id, labor_rate, distance_miles, assigned_to_name').gte('job_date', lookbackStart).order('id').range(f, t), 'load team summary lifetime labor jobs'),
    paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load team summary period crew days'),
    paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', lookbackStart).order('work_date').order('person_name').range(f, t), 'load team summary lifetime crew days'),
    // Period-only bid crew rows -- modal display only, no all-time fetch needed.
    paged((f, t) => supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load team summary period crew bids'),
    paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load team summary period hours'),
    paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart).order('work_date').order('person_name').range(f, t), 'load team summary lifetime hours'),
    supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
    // list_tally_parts_with_po orders by created_at, so .range() pages are stable.
    paged((f, t) => supabase.rpc('list_tally_parts_with_po').range(f, t), 'load team summary tally parts'),
    overheadSessionsAllTimeFetchPromise,
  ])
  throwIfQueryError(
    [periodLaborRes, allTimeLaborRes, periodCrewRes, allTimeCrewRes, periodCrewBidsRes, periodHoursRes, allTimeHoursRes, settingsRes, tallyRes],
    'load team summary data',
  )

  // Derive the period buckets (for per-person totals shown in the Team
  // Summary) and the period per-day map (for `derivePersonTeamSummary`'s
  // overhead callouts). The lifetime crew labor cost denominator no longer
  // needs an all-time per-day overhead map under Option E — pct is share of
  // the total day so the multiplicand is `dayHoursRaw`, not `dayHoursRaw -
  // overheadOnDay`. One fetch, period-only views.
  const overheadHoursByPerson: Record<string, { office: number; bid: number }> = {}
  const overheadHoursByPersonByDate: Record<string, number> = {}
  const overheadSessionsByPerson: TeamReviewUnion['overheadSessionsByPerson'] = {}
  for (const s of overheadSessionsAllTime) {
    if (s.rejected_at || s.revoked_at) continue
    if (s.approved_at == null) continue
    const bucket = overheadBucketForSession(officeJobLedgerId, s.job_ledger_id, s.bid_id)
    if (bucket == null) continue
    const hrs = approvedClosedSessionHours(s)
    if (hrs == null || hrs <= 0) continue
    const name = (s.users?.name ?? '').trim()
    if (!name) continue
    const dateKey = `${name}:${s.work_date}`
    if (s.work_date >= start && s.work_date <= end) {
      const cur = overheadHoursByPerson[name] ?? { office: 0, bid: 0 }
      if (bucket === 'office') cur.office += hrs
      else cur.bid += hrs
      overheadHoursByPerson[name] = cur
      overheadHoursByPersonByDate[dateKey] = (overheadHoursByPersonByDate[dateKey] ?? 0) + hrs
      // Skip open sessions for the modal (no clock_out_iso to render); they
      // already contributed null hours and were filtered above.
      if (s.clocked_out_at) {
        const list = overheadSessionsByPerson[name] ?? []
        list.push({
          sessionId: s.id,
          workDate: s.work_date,
          bucket,
          clockedInIso: s.clocked_in_at,
          clockedOutIso: s.clocked_out_at,
          hours: hrs,
          bidId: s.bid_id ?? null,
        })
        overheadSessionsByPerson[name] = list
      }
    }
  }

  const periodLaborRows = (periodLaborRes.data ?? []) as TeamPeriodLaborRow[]
  const allTimeLaborRows = (allTimeLaborRes.data ?? []) as TeamPeriodLaborRow[]
  const periodCrewRows = (periodCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
  const allTimeCrewRows = (allTimeCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
  const periodCrewBidRowsRaw = (periodCrewBidsRes.data ?? []) as Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] | null }>
  const periodCrewBidRows = periodCrewBidRowsRaw.map((r) => ({
    work_date: r.work_date,
    person_name: r.person_name,
    bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
  }))
  const periodHoursRows = (periodHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
  const allTimeHoursRows = (allTimeHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
  const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
  const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; part_id: string | null; price_at_time: number | null; fixture_cost: number | null; quantity: number }>

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
  for (const h of periodHoursRows) {
    hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
  }
  const hoursMapAllTime: Record<string, number> = {}
  for (const h of allTimeHoursRows) {
    hoursMapAllTime[`${h.person_name}:${h.work_date}`] = h.hours
  }

  // Items for all-time labor jobs (for the laborCostByJobId lifetime calc).
  const allTimeLaborJobIds = allTimeLaborRows.map((r) => r.id)
  const laborItemsRes = {
    data: await fetchAllRowsChunkedIn(
      allTimeLaborJobIds,
      (chunk, f, t) => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(f, t),
      'load team summary labor items',
    ),
  }
  const laborItems = (laborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }>
  const laborItemsByJobId = new Map<string, TeamLaborItem[]>()
  for (const i of laborItems) {
    const list = laborItemsByJobId.get(i.job_id) ?? []
    list.push({ count: i.count, hrs_per_unit: i.hrs_per_unit, is_fixed: i.is_fixed, labor_rate: i.labor_rate, direct_labor_amount: i.direct_labor_amount })
    laborItemsByJobId.set(i.job_id, list)
  }


  const crewByDatePerson: Record<string, CrewJobRow> = {}
  for (const r of periodCrewRows) {
    crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
      job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
    }
  }
  const crewByDatePersonAllTime: Record<string, CrewJobRow> = {}
  for (const r of allTimeCrewRows) {
    crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`] = {
      job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
    }
  }

  // Lifetime crew labor cost per job (all crew members).
  // Convention 1 — crew pct is share of the total day (matches the
  // `sync_crew_jobs_from_clock` trigger denominator and `teamLabor.ts` /
  // `payReportAssignmentsBreakdown.ts`). Multiply by `dayHoursRaw` so this
  // lifetime denominator stays on the same convention as the period
  // numerator in `derivePersonTeamSummary` and as the cost figures shown
  // on pay reports / Person Review.
  const teamLaborCostByJobId = new Map<string, number>()
  const teamLaborHoursByJobId = new Map<string, number>()
  for (const r of allTimeCrewRows) {
    const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    const cfg = (r.person_id ? payConfigSnapshotById[r.person_id] : undefined) ?? payConfigSnapshot[r.person_name]
    const dayHoursRaw = hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0
    const rate = cfg?.hourly_wage ?? 0
    for (const a of assignments) {
      const pctHrs = dayHoursRaw * (a.pct / 100)
      const cost = pctHrs * rate
      teamLaborCostByJobId.set(a.job_id, (teamLaborCostByJobId.get(a.job_id) ?? 0) + cost)
      teamLaborHoursByJobId.set(a.job_id, (teamLaborHoursByJobId.get(a.job_id) ?? 0) + pctHrs)
    }
  }

  // Union of sheet links / crew jobIds across the whole team for the period (v2.3068).
  // No number lookup: every sheet carries job_ledger_id.
  const unionLaborLinkIds = [...new Set(periodLaborRows.map((r) => r.job_ledger_id ?? '').filter(Boolean))]
  const unionCrewJobIds = new Set<string>()
  for (const r of periodCrewRows) {
    const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    for (const a of assignments) {
      unionCrewJobIds.add(a.job_id)
    }
  }

  const allJobIds = [...new Set([...unionCrewJobIds, ...unionLaborLinkIds])]
  // Collect bid IDs across the period crew bid rows so we can resolve display
  // metadata (bid_number, project_name) for the Hours-breakdown modal.
  const unionCrewBidIds = new Set<string>()
  for (const r of periodCrewBidRows) {
    for (const a of r.bid_assignments) {
      if (a.bid_id) unionCrewBidIds.add(a.bid_id)
    }
  }
  const allBidIds = [...unionCrewBidIds]
  // The ledger RPCs have a deterministic ORDER BY, so .range() pages are stable.
  const [crewJobsRes, crewBidsRes] = await Promise.all([
    allJobIds.length > 0
      ? paged(
          (f, t) =>
            (onlyPaidJobs
              ? supabase.rpc('get_jobs_ledger_by_ids_paid_only', { p_job_ids: allJobIds })
              : supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds })
            ).range(f, t),
          'load team summary crew ledger jobs',
        )
      : { data: [] },
    allBidIds.length > 0
      ? paged((f, t) => supabase.rpc('get_bids_by_ids', { p_bid_ids: allBidIds }).range(f, t), 'load team summary bids')
      : { data: [] },
  ])
  throwIfQueryError([crewJobsRes, crewBidsRes], 'load team summary ledger jobs')
  const crewJobsLedger = (crewJobsRes.data ?? []) as TeamLedgerRow[]
  const jobsById = new Map<string, TeamLedgerRow>()
  for (const j of crewJobsLedger) jobsById.set(j.id, j)
  // v2.3360: the ledger RPCs carry no status; finished jobs earn 100% under the Bridge's rule.
  const unionStatusByJobId = await fetchJobStatusesByIds([...jobsById.keys()])
  for (const j of jobsById.values()) j.status = unionStatusByJobId.get(j.id) ?? null

  // Lifetime sub-labor cost per job (all assignees) — keyed by the sheet's link (v2.3068).
  const laborCostByJobId = new Map<string, number>()
  for (const r of allTimeLaborRows) {
    const jobId = laborRowJobId(r)
    if (!jobId) continue
    const items = laborItemsByJobId.get(r.id) ?? []
    // Jobs-page costing (v2.2686): line rate overrides + direct $ lines + drive.
    const laborCost = laborJobSubCost({ labor_rate: r.labor_rate, items, distance_miles: r.distance_miles }, mileageCost, timePerMile)
    laborCostByJobId.set(jobId, (laborCostByJobId.get(jobId) ?? 0) + laborCost)
  }
  const bidRows = (crewBidsRes.data ?? []) as Array<{ id: string; bid_number: string | null; project_name: string | null; address: string | null }>
  const bidsById = new Map<string, { bid_number: string; project_name: string; address: string }>()
  for (const b of bidRows) {
    bidsById.set(b.id, {
      bid_number: (b.bid_number ?? '').trim(),
      project_name: (b.project_name ?? '').trim(),
      address: (b.address ?? '').trim(),
    })
  }

  const jobIds = Array.from(jobsById.keys())
  // get_invoice_amounts_for_jobs aggregates one row per job (bounded, no
  // ORDER BY) so it stays single-shot; materials is chunked+paged.
  const [invoiceRes, materialsRes, cardChargeRows] = await Promise.all([
    jobIds.length > 0 ? supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
    fetchAllRowsChunkedIn(
      jobIds,
      (chunk, f, t) => supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', chunk).order('id').range(f, t),
      'load team summary billed materials',
    ).then((rows) => ({ data: rows, error: null })),
    // Mercury card charges — canonical parts composition, see loadReviewDataCore.
    // `mercury_transaction_id` rides along so the fuel slice can be split off (v2.2700).
    fetchAllRowsChunkedIn(
      jobIds,
      (chunk, f, t) => supabase.from('mercury_transaction_job_allocations').select('job_id, amount, mercury_transaction_id').in('job_id', chunk).order('id').range(f, t),
      'load team summary card charges',
    ),
  ])
  throwIfQueryError([invoiceRes, materialsRes], 'load team summary job invoices/materials')
  const invoiceAmountByJob: Record<string, number> = {}
  for (const row of (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>) {
    invoiceAmountByJob[row.job_id] = Number(row.invoice_amount ?? 0)
  }
  const billedMaterialsByJobId = new Map<string, number>()
  for (const row of (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>) {
    billedMaterialsByJobId.set(row.job_id, (billedMaterialsByJobId.get(row.job_id) ?? 0) + Number(row.amount ?? 0))
  }
  const cardRowsAll = cardChargeRows as Array<{ job_id: string; amount: number; mercury_transaction_id: string | null }>
  const cardTxIds = [...new Set(cardRowsAll.map((r) => r.mercury_transaction_id).filter((id): id is string => !!id))]

  // Wheels on Labor (v2.2735). Since v2.4653 (punch list #52 PR 5) fuel stays on the jobs it was
  // put on, here as on every job screen: a vehicle deal's fuel is no longer taken out of the job
  // purchases. The person's vehicle line charges only what is not on a job — the deal's fixed
  // $/field h and their fuel on no job in the period (`loadFuelOffJobsByUserId`).
  const vehicleByPersonName: Record<string, TeamReviewVehicle> = {}
  const [wheels, cardExclusions] = await Promise.all([
    loadWheelsSnapshot({ todayYmd: denverCalendarDayKey(Date.now()), users }).catch(() => null),
    loadCardChargeExclusions(cardTxIds),
  ])
  const dealRows = (wheels?.rows ?? []).filter((r) => r.arrangement !== 'none')
  const fuelOffJobs =
    dealRows.length > 0
      ? await loadFuelOffJobsByUserId({ startYmd: start, endYmd: end, lookups: tagLookups, fuelTagId: wheels?.fuelTag?.id ?? null, officeJobId: officeJobLedgerId }).catch(() => null)
      : null
  for (const r of dealRows) {
    vehicleByPersonName[r.name] = {
      arrangement: r.arrangement,
      fixedRate: r.fixedRate,
      fuelOffJobsUsd: r.userId ? (fuelOffJobs?.get(r.userId) ?? 0) : 0,
      truckName: r.truck?.name ?? null,
      note: fuelOffJobs ? r.note : `${r.note}; the card charges could not be read, so fuel on no job reads $0`,
    }
  }

  let labelIdByTxId = new Map<string, string>()
  const categoryByTxId = new Map<string, unknown>()
  if (cardTxIds.length > 0 && tagLookups.tagsById.size > 0) {
    const [labels, categoryRows] = await Promise.all([
      fetchLabelIdByTxId(cardTxIds).catch(() => new Map<string, string>()),
      fetchAllRowsChunkedIn(
        cardTxIds,
        (chunk, f, t) => supabase.from('mercury_transactions').select('id, mercury_category').in('id', chunk).order('id').range(f, t),
        'load team summary card categories',
      ).catch(() => [] as unknown[]),
    ])
    labelIdByTxId = labels
    for (const r of categoryRows as Array<{ id: string; mercury_category: unknown }>) categoryByTxId.set(r.id, r.mercury_category)
  }
  // The ONE card-charge rule Job Summary applies (v2.2692, `cardChargeAllocationFilter`):
  // Internal Transfers out; an invoice-linked charge counted once. Nothing else comes off.
  const cardSummary = summarizeCardChargeAllocations(
    cardRowsAll.map((r) => ({ ...r, mercury_transaction_id: r.mercury_transaction_id ?? '' })),
    cardExclusions,
  )
  const cardRows = cardSummary.counted
  const cardChargesByJobId = netCardChargesByJobId(cardSummary)
  // Cost-line tags (v2.2725): a card charge belongs to its accounting label's
  // tag, else its bank category's tag; only tags flagged "show as cost line"
  // become lines. Same classifier Jobs → Job Summary uses, over the rows that count.
  const tagChargesByJobId = new Map<string, ReadonlyMap<string, number>>()
  if (cardRows.length > 0 && tagLookups.tagsById.size > 0) {
    for (const [jobId, perTag] of sumTagChargesByJob(cardRows, labelIdByTxId, categoryByTxId, tagLookups)) tagChargesByJobId.set(jobId, perTag)
  }

  return {
    periodLaborRows,
    periodCrewRows,
    periodCrewBidRows,
    periodHoursRows,
    mileageCost,
    timePerMile,
    jobsById,
    bidsById,
    laborItemsByJobId,
    laborCostByJobId,
    teamLaborCostByJobId,
    teamLaborHoursByJobId,
    partsCostByJobId,
    invoiceAmountByJob,
    billedMaterialsByJobId,
    cardChargesByJobId,
    tagChargesByJobId,
    costLineTags: costLineTags(tagLookups),
    vehicleByPersonName,
    hoursMap,
    crewByDatePerson,
    overheadHoursByPerson,
    overheadHoursByPersonByDate,
    overheadSessionsByPerson,
    officeJobLedgerId,
  }
}
