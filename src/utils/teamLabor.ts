import type { SupabaseClient } from '@supabase/supabase-js'

export type CrewJobAssignment = { job_id: string; pct: number }
export type CrewJobRow = { crew_lead_person_name: string | null; job_assignments: CrewJobAssignment[] }

export type TeamLaborRow = {
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  people: string[]
  manHours: number
  jobCost: number
  breakdown: Array<{ personName: string; hours: number; cost: number }>
}

export async function loadTeamLaborData(
  supabase: SupabaseClient
): Promise<TeamLaborRow[]> {
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  const startDate = twoYearsAgo.toLocaleDateString('en-CA')
  const [crewRes, hoursRes, configRes] = await Promise.all([
    supabase.from('people_crew_jobs').select('work_date, person_name, crew_lead_person_name, job_assignments'),
    supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', startDate),
    supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary'),
  ])
  const crewRows = (crewRes.data ?? []) as Array<{
    work_date: string
    person_name: string
    crew_lead_person_name: string | null
    job_assignments: CrewJobAssignment[]
  }>
  const hoursRows = (hoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
  const configRows = (configRes.data ?? []) as Array<{
    person_name: string
    hourly_wage: number | null
    is_salary: boolean
  }>
  const configMap: Record<string, { hourly_wage: number; is_salary: boolean }> = {}
  for (const c of configRows) {
    configMap[c.person_name] = { hourly_wage: c.hourly_wage ?? 0, is_salary: c.is_salary ?? false }
  }
  const hoursMap: Record<string, number> = {}
  for (const h of hoursRows) {
    hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
  }
  const crewByDatePerson: Record<string, CrewJobRow> = {}
  for (const r of crewRows) {
    crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
      crew_lead_person_name: r.crew_lead_person_name,
      job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
    }
  }
  function getEffectiveAssignments(personName: string, workDate: string): CrewJobAssignment[] {
    const key = `${workDate}:${personName}`
    const row = crewByDatePerson[key]
    if (!row) return []
    if (row.crew_lead_person_name) {
      const leadRow = crewByDatePerson[`${workDate}:${row.crew_lead_person_name}`]
      return leadRow?.job_assignments ?? []
    }
    return row.job_assignments
  }
  const jobAgg: Record<
    string,
    { people: Set<string>; hoursByPerson: Record<string, number>; costByPerson: Record<string, number> }
  > = {}
  for (const r of crewRows) {
    const assignments = getEffectiveAssignments(r.person_name, r.work_date)
    const cfg = configMap[r.person_name]
    const day = new Date(r.work_date + 'T12:00:00').getDay()
    const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${r.person_name}:${r.work_date}`] ?? 0)
    const rate = cfg?.hourly_wage ?? 0
    for (const a of assignments) {
      if (!jobAgg[a.job_id]) jobAgg[a.job_id] = { people: new Set(), hoursByPerson: {}, costByPerson: {} }
      const agg = jobAgg[a.job_id]!
      agg.people.add(r.person_name)
      const pctHrs = hours * (a.pct / 100)
      agg.hoursByPerson[r.person_name] = (agg.hoursByPerson[r.person_name] ?? 0) + pctHrs
      agg.costByPerson[r.person_name] = (agg.costByPerson[r.person_name] ?? 0) + pctHrs * rate
    }
  }
  const jobIds = Object.keys(jobAgg)
  if (jobIds.length === 0) return []
  const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds })
  const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
  for (const j of (jobsData ?? []) as {
    id: string
    hcp_number: string
    job_name: string
    job_address: string
  }[]) {
    jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
  }
  return jobIds.map((jobId) => {
    const agg = jobAgg[jobId]!
    const info = jobsMap[jobId] ?? { hcp_number: '', job_name: '', job_address: '' }
    const people = [...agg.people]
    const manHours = Object.values(agg.hoursByPerson).reduce((s, h) => s + h, 0)
    const jobCost = Object.values(agg.costByPerson).reduce((s, c) => s + c, 0)
    const breakdown = people.map((p) => ({
      personName: p,
      hours: agg.hoursByPerson[p] ?? 0,
      cost: agg.costByPerson[p] ?? 0,
    }))
    return {
      jobId,
      hcpNumber: info.hcp_number,
      jobName: info.job_name,
      jobAddress: info.job_address,
      people,
      manHours,
      jobCost,
      breakdown,
    }
  })
}
