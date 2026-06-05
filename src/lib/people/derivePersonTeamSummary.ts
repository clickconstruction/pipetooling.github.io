// Pure per-person derivation kernel for the Team Summary.
//
// Extracted verbatim from `People.tsx`. Mirrors the allocation math at the
// bottom of `loadReviewData` (allocationJobsMap × costOnJobInPeriod,
// cost-based ratio). No supabase / React — slices the team-wide
// `TeamReviewUnion` into one person's `TeamSummaryRow`.

import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import type {
  GrossRevenueBreakdown,
  HoursBreakdown,
  NetRevenueBreakdown,
  OverheadSessionLine,
  ProfitAfterOverheadBreakdown,
  TeamSummaryRow,
} from '../../components/people/teamSummary/types'
import type { TeamReviewUnion } from './teamReviewTypes'

export function derivePersonTeamSummary(
  union: TeamReviewUnion,
  personName: string,
  payConfigSnapshot: Record<string, PayConfigRow>,
  onlyPaidJobs: boolean,
  days: string[],
): TeamSummaryRow {
  const cfg = payConfigSnapshot[personName]
  const officeJobIdForFilter = union.officeJobLedgerId

  const personPeriodLaborRows = union.periodLaborRows
    .filter((r) => r.assigned_to_name === personName)
    .filter((r) => {
      // Exclude sub-labor rows pointing at the configured office job — it's
      // overhead, not a field-revenue job. Without this filter the office
      // job appears in "Where the field hrs went" and gets a (typically
      // negative) revenue allocation.
      if (!officeJobIdForFilter) return true
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) return true
      return union.jobIdByHcp.get(hcp) !== officeJobIdForFilter
    })
  const laborRowsFiltered = onlyPaidJobs
    ? personPeriodLaborRows.filter((r) => {
        const hcp = (r.job_number ?? '').trim().toLowerCase()
        return hcp && union.jobIdByHcp.has(hcp)
      })
    : personPeriodLaborRows

  const laborJobs = laborRowsFiltered.map((r) => {
    const items = union.laborItemsByJobId.get(r.id) ?? []
    const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
    const rate = r.labor_rate ?? 0
    const miles = Number(r.distance_miles) || 0
    const driveCost = miles > 0 && rate > 0 ? miles * union.mileageCost + miles * union.timePerMile * rate : miles > 0 ? miles * union.mileageCost : 0
    const laborCost = totalHrs * rate + driveCost
    const hcp = (r.job_number ?? '').trim().toLowerCase()
    const jobId = hcp ? union.jobIdByHcp.get(hcp) ?? null : null
    return { jobId, hours: totalHrs, laborCost }
  })

  const crewJobIds = new Set<string>()
  const crewJobsWithLead: Array<{ work_date: string; job_id: string; pct: number }> = []
  for (const r of union.periodCrewRows) {
    if (r.person_name !== personName) continue
    const row = union.crewByDatePerson[`${r.work_date}:${r.person_name}`]
    const assignments = row?.job_assignments ?? []
    for (const a of assignments) {
      // Skip the configured office job — its time is overhead and is
      // already accounted for via clock sessions, not crew revenue.
      if (officeJobIdForFilter && a.job_id === officeJobIdForFilter) continue
      crewJobIds.add(a.job_id)
      crewJobsWithLead.push({ work_date: r.work_date, job_id: a.job_id, pct: a.pct })
    }
  }
  const crewJobsWithLeadFiltered = onlyPaidJobs
    ? crewJobsWithLead.filter((c) => union.jobsById.has(c.job_id))
    : crewJobsWithLead

  const crewJobs = crewJobsWithLeadFiltered.map((c) => {
    const day = new Date(c.work_date + 'T12:00:00').getDay()
    const dayHoursRaw = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (union.hoursMap[`${personName}:${c.work_date}`] ?? 0)
    // Convention 1 — pct is share of the total day; multiply by dayHoursRaw
    // so the period numerator stays on the same convention as the lifetime
    // denominator in `loadTeamReviewUnion.teamLaborCostByJobId`.
    const hours = dayHoursRaw * (c.pct / 100)
    const laborCost = hours * (cfg?.hourly_wage ?? 0)
    return { jobId: c.job_id, hours, laborCost }
  })

  const allocationJobsMap = new Map<string, { valueCreated: number; revenueBeforeOverhead: number; totalLaborOnJob: number }>()
  const laborJobIdsSeen = new Set<string>()
  for (const r of laborRowsFiltered) {
    const hcp = (r.job_number ?? '').trim().toLowerCase()
    const jobId = hcp ? union.jobIdByHcp.get(hcp) ?? null : null
    if (!jobId || laborJobIdsSeen.has(jobId)) continue
    laborJobIdsSeen.add(jobId)
    const job = union.jobsById.get(jobId)
    const subLaborCost = hcp ? (union.laborCostByHcp.get(hcp) ?? 0) : 0
    const teamLaborCost = union.teamLaborCostByJobId.get(jobId) ?? 0
    const totalLaborOnJob = subLaborCost + teamLaborCost
    const partsCost = (union.partsCostByJobId.get(jobId) ?? 0) + (union.invoiceAmountByJob[jobId] ?? 0) + (union.billedMaterialsByJobId.get(jobId) ?? 0)
    const totalBill = job?.revenue != null ? Number(job.revenue) : 0
    const pctComplete = job?.pct_complete ?? null
    const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
    const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
    allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob })
  }
  for (const jobId of crewJobIds) {
    if (allocationJobsMap.has(jobId)) continue
    const j = union.jobsById.get(jobId)
    const hcp = (j?.hcp_number ?? '').trim().toLowerCase()
    const subLaborCost = hcp ? (union.laborCostByHcp.get(hcp) ?? 0) : 0
    const totalLaborOnJob = subLaborCost + (union.teamLaborCostByJobId.get(jobId) ?? 0)
    const partsCost = (union.partsCostByJobId.get(jobId) ?? 0) + (union.invoiceAmountByJob[jobId] ?? 0) + (union.billedMaterialsByJobId.get(jobId) ?? 0)
    const totalBill = j?.revenue != null ? Number(j.revenue) : 0
    const pctComplete = j?.pct_complete ?? null
    const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
    const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
    allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob })
  }

  const costOnJobInPeriod = new Map<string, number>()
  for (const j of laborJobs) {
    if (j.jobId) costOnJobInPeriod.set(j.jobId, (costOnJobInPeriod.get(j.jobId) ?? 0) + j.laborCost)
  }
  for (const j of crewJobs) {
    costOnJobInPeriod.set(j.jobId, (costOnJobInPeriod.get(j.jobId) ?? 0) + j.laborCost)
  }

  let allocatedRevenue = 0
  let allocatedProfit = 0
  const grossBreakdownJobs: GrossRevenueBreakdown['jobs'] = []
  const netBreakdownJobs: NetRevenueBreakdown['jobs'] = []
  for (const [jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob }] of allocationJobsMap) {
    const costInPeriod = costOnJobInPeriod.get(jobId) ?? 0
    const ratio = totalLaborOnJob > 0 ? costInPeriod / totalLaborOnJob : (costInPeriod > 0 ? 1 : 0)
    const jobAllocated = valueCreated * ratio
    const jobAllocatedNet = revenueBeforeOverhead * ratio
    allocatedRevenue += jobAllocated
    allocatedProfit += jobAllocatedNet

    const job = union.jobsById.get(jobId)
    const hcp = (job?.hcp_number ?? '').trim().toUpperCase() || 'Unknown'
    const jobName = job?.job_name ?? ''
    const totalBill = job?.revenue != null ? Number(job.revenue) : 0
    const pctRaw = job?.pct_complete
    const partsCost = (union.partsCostByJobId.get(jobId) ?? 0) + (union.invoiceAmountByJob[jobId] ?? 0) + (union.billedMaterialsByJobId.get(jobId) ?? 0)
    grossBreakdownJobs.push({
      jobId,
      hcp,
      jobName,
      totalBill,
      pctComplete: pctRaw ?? 100,
      pctCompleteSource: pctRaw == null ? 'assumed' : 'set',
      valueCreated,
      totalLaborOnJob,
      costInPeriod,
      ratio,
      allocatedRevenue: jobAllocated,
    })
    netBreakdownJobs.push({
      jobId,
      hcp,
      jobName,
      valueCreated,
      partsCost,
      totalLaborOnJob,
      revenueBeforeOverhead,
      costInPeriod,
      ratio,
      allocatedNet: jobAllocatedNet,
    })
  }
  grossBreakdownJobs.sort((a, b) => b.allocatedRevenue - a.allocatedRevenue)
  netBreakdownJobs.sort((a, b) => b.allocatedNet - a.allocatedNet)
  const grossBreakdown: GrossRevenueBreakdown = { jobs: grossBreakdownJobs, total: allocatedRevenue }
  const netBreakdown: NetRevenueBreakdown = { jobs: netBreakdownJobs, total: allocatedProfit }

  const hoursOnJobInPeriod = new Map<string, number>()
  for (const j of laborJobs) {
    if (j.jobId) hoursOnJobInPeriod.set(j.jobId, (hoursOnJobInPeriod.get(j.jobId) ?? 0) + j.hours)
  }
  for (const j of crewJobs) {
    hoursOnJobInPeriod.set(j.jobId, (hoursOnJobInPeriod.get(j.jobId) ?? 0) + j.hours)
  }

  const personHoursRows = union.periodHoursRows.filter((r) => r.person_name === personName)
  const getHoursForDay = (d: string) => {
    if (!cfg) return 0
    const dayOfWeek = new Date(d + 'T12:00:00').getDay()
    return cfg.is_salary
      ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
      : (personHoursRows.find((h) => h.work_date === d)?.hours ?? 0)
  }
  const totalHoursPaidJobs = laborJobs.reduce((s, j) => s + j.hours, 0) + crewJobs.reduce((s, j) => s + j.hours, 0)
  const totalHours = onlyPaidJobs
    ? totalHoursPaidJobs
    : days.reduce((s, d) => s + getHoursForDay(d), 0)

  const overheadBuckets = union.overheadHoursByPerson[personName] ?? { office: 0, bid: 0 }
  const officeHours = overheadBuckets.office
  const bidHours = overheadBuckets.bid
  const overheadHours = officeHours + bidHours
  const fieldHours = onlyPaidJobs
    ? totalHours
    : Math.max(0, totalHours - overheadHours)
  const profitBreakdownJobs: ProfitAfterOverheadBreakdown['jobs'] = netBreakdownJobs.map((j) => ({
    jobId: j.jobId,
    hcp: j.hcp,
    jobName: j.jobName,
    allocatedNet: j.allocatedNet,
    hoursInPeriod: hoursOnJobInPeriod.get(j.jobId) ?? 0,
  }))
  const allocatedHoursTotal = profitBreakdownJobs.reduce((s, j) => s + j.hoursInPeriod, 0)
  const profitBreakdown: ProfitAfterOverheadBreakdown = {
    jobs: profitBreakdownJobs,
    totalNet: allocatedProfit,
    totalHours,
    fieldHours,
    overheadHours,
    unaccountedHours: Math.max(0, fieldHours - allocatedHoursTotal),
  }

  // Modal-display only -- includes the configured Office job AND bid
  // assignments so people who clocked into Office or a bid are visible in
  // the Hours-breakdown drilldown (otherwise the day shows "No crew
  // assignment"). Revenue / profit math uses `crewJobsWithLeadFiltered`,
  // which still excludes Office and bids on purpose.
  const crewByDateForPerson = new Map<string, Array<{ hcp: string; jobName: string; address: string; pct: number; hours: number; valueCreated: number }>>()
  const dayHoursForPerson = (workDate: string) => {
    const dayOfWeek = new Date(workDate + 'T12:00:00').getDay()
    return cfg?.is_salary
      ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
      : (union.hoursMap[`${personName}:${workDate}`] ?? 0)
  }
  for (const r of union.periodCrewRows) {
    if (r.person_name !== personName) continue
    const dayHoursRaw = dayHoursForPerson(r.work_date)
    for (const a of r.job_assignments) {
      const j = union.jobsById.get(a.job_id)
      const hcp = (j?.hcp_number ?? '').trim().toUpperCase() || 'Unknown'
      const jobName = (j?.job_name ?? '').trim()
      const address = (j?.job_address ?? '').trim()
      // Convention 1 -- pct is share of the total day; hours = day * pct/100.
      const hours = dayHoursRaw * (a.pct / 100)
      // Value Created this day for this person: their cost-share of the job's
      // Value Created, using the same `cost / total lifetime labor` ratio as
      // the Gross Revenue column, so the per-day values for a job sum to that
      // person's Gross for the job. pct_complete null is treated as 100% here
      // too (via allocationJobsMap). Office/bids aren't in allocationJobsMap
      // (no field revenue) -> $0.
      const dayAlloc = allocationJobsMap.get(a.job_id)
      const dayCost = hours * (cfg?.hourly_wage ?? 0)
      const valueCreated =
        dayAlloc && dayAlloc.totalLaborOnJob > 0
          ? dayAlloc.valueCreated * (dayCost / dayAlloc.totalLaborOnJob)
          : 0
      const list = crewByDateForPerson.get(r.work_date) ?? []
      list.push({ hcp, jobName, address, pct: a.pct, hours, valueCreated })
      crewByDateForPerson.set(r.work_date, list)
    }
  }
  for (const r of union.periodCrewBidRows) {
    if (r.person_name !== personName) continue
    const dayHoursRaw = dayHoursForPerson(r.work_date)
    for (const a of r.bid_assignments) {
      const meta = union.bidsById.get(a.bid_id)
      // Bid number prefixed with "B" so the modal's allocation column reads
      // "(pct) B249 | Project Name" and clearly distinguishes from a job.
      // Falls back to "B?" when bid metadata is missing (rare; the row was
      // synced but `get_bids_by_ids` filtered the bid out).
      const rawBidNumber = (meta?.bid_number ?? '').trim()
      const hcp = rawBidNumber
        ? (rawBidNumber.toUpperCase().startsWith('B') ? rawBidNumber.toUpperCase() : 'B' + rawBidNumber)
        : 'B?'
      const jobName = (meta?.project_name ?? '').trim()
      const address = (meta?.address ?? '').trim()
      const hours = dayHoursRaw * (a.pct / 100)
      // Bids create no field revenue, so no Value Created.
      const list = crewByDateForPerson.get(r.work_date) ?? []
      list.push({ hcp, jobName, address, pct: a.pct, hours, valueCreated: 0 })
      crewByDateForPerson.set(r.work_date, list)
    }
  }
  const dailyRowsBreakdown: HoursBreakdown['dailyRows'] = []
  for (const d of days) {
    const h = getHoursForDay(d)
    const allocs = crewByDateForPerson.get(d) ?? []
    if (h > 0 || allocs.length > 0) {
      dailyRowsBreakdown.push({ date: d, hours: h, crewAllocations: allocs })
    }
  }
  const subLaborRowsBreakdown: HoursBreakdown['subLaborRows'] = []
  for (const r of laborRowsFiltered) {
    const items = union.laborItemsByJobId.get(r.id) ?? []
    const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
    const hcp = (r.job_number ?? '').trim().toUpperCase() || 'Unknown'
    if (totalHrs > 0) {
      subLaborRowsBreakdown.push({ hcp, date: r.job_date ?? '', hours: totalHrs })
    }
  }
  const dailyTotal = dailyRowsBreakdown.reduce((s, r) => s + r.hours, 0)
  const crewTotal = crewJobs.reduce((s, j) => s + j.hours, 0)
  const subLaborTotal = subLaborRowsBreakdown.reduce((s, r) => s + r.hours, 0)
  const hoursBreakdown: HoursBreakdown = {
    source: !cfg ? 'unknown' : (cfg.is_salary ? 'salary' : 'hourly'),
    onlyPaidJobs,
    dailyRows: dailyRowsBreakdown,
    subLaborRows: subLaborRowsBreakdown,
    totals: { daily: dailyTotal, crew: crewTotal, subLabor: subLaborTotal, totalHours },
  }

  const hourlyWage = cfg?.hourly_wage ?? 0
  // Overhead labor only — Office + Bid hours × wage. Field labor is
  // already subtracted at the per-job level inside Net Revenue
  // (`job_net = revenue - parts - total_labor`), so re-listing it here
  // would visually double-count. Stored negative so the column reads
  // as a cost (red `negStyle`, `-$X` via `fmtMoney`) and flows naturally
  // into the footer total + per-bucket drilldown rows.
  const overheadLaborCost = -(overheadHours * hourlyWage)

  // Build the per-session display list for the Overhead-hours-breakdown
  // modal. Times are formatted in the company TZ; bid metadata is
  // resolved against `union.bidsById` so the iframe only renders strings.
  const overheadTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const overheadRawSessions = union.overheadSessionsByPerson[personName] ?? []
  const overheadSessions: OverheadSessionLine[] = overheadRawSessions
    .map((s) => {
      const inDate = new Date(s.clockedInIso)
      const outDate = new Date(s.clockedOutIso)
      const startTime = Number.isNaN(inDate.getTime())
        ? ''
        : overheadTimeFormatter.format(inDate)
      const endTime = Number.isNaN(outDate.getTime())
        ? ''
        : overheadTimeFormatter.format(outDate)
      let bidHcp = ''
      let bidName = ''
      let bidAddress = ''
      if (s.bucket === 'bid' && s.bidId) {
        const meta = union.bidsById.get(s.bidId)
        const rawBidNumber = (meta?.bid_number ?? '').trim()
        bidHcp = rawBidNumber
          ? rawBidNumber.toUpperCase().startsWith('B')
            ? rawBidNumber.toUpperCase()
            : 'B' + rawBidNumber
          : 'B?'
        bidName = (meta?.project_name ?? '').trim()
        bidAddress = (meta?.address ?? '').trim()
      }
      return {
        workDate: s.workDate,
        bucket: s.bucket,
        startTime,
        endTime,
        hours: s.hours,
        bidHcp,
        bidName,
        bidAddress,
      }
    })
    .sort((a, b) => {
      const byDate = a.workDate.localeCompare(b.workDate)
      if (byDate !== 0) return byDate
      return a.startTime.localeCompare(b.startTime)
    })
  return {
    personName,
    profit: allocatedProfit,
    gross: allocatedRevenue,
    revPerHour: totalHours > 0 ? allocatedRevenue / totalHours : 0,
    profitPerHour: totalHours > 0 ? allocatedProfit / totalHours : 0,
    totalHours,
    overheadHours,
    officeHours,
    bidHours,
    fieldHours,
    hourlyWage,
    overheadLaborCost,
    hoursBreakdown,
    grossBreakdown,
    netBreakdown,
    profitBreakdown,
    overheadSessions,
  }
}
