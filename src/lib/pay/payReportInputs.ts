import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrewBidAssignment, CrewBidRow, CrewJobAssignment, CrewJobRow } from '../../utils/teamLabor'
import { computePayReportAssignmentsBreakdown, type PayReportAssignmentDayBreakdown } from '../payReportAssignmentsBreakdown'
import type { PayStubHtmlContext, PayStubHtmlHousing, PayStubHtmlVehicle } from '../peopleDocuments/buildPayStubHtml'

/**
 * The pay report's inputs beyond the day rows and the totals — everything `buildPayStubHtml`
 * needs that comes from other tables: the crew's job and bid lines per day (through the two
 * lookup RPCs and `computePayReportAssignmentsBreakdown`), the vehicles and housing the
 * person held in the period, their pending offsets, the stub's deductions, additional lines
 * and (for a saved stub) its payments, and the contact line. `src/pages/People.tsx` carried
 * this three times over — generate, view, print — with only local names differing (the People
 * map's Stage A; v2.3874). One fetch now, taking `supabase` the way `generatePayStubRecord`
 * does, so the Person desk's Leave flow can read the same report.
 */

export type PayReportRosterUser = { id: string; name: string | null; email?: string | null; phone?: string | null }
export type PayReportRosterPerson = { name: string | null; email?: string | null; phone?: string | null }

/** The roster user whose name is the pay name (case-blind, trimmed); null when none. */
export function payReportUserForName(users: ReadonlyArray<PayReportRosterUser>, personName: string): PayReportRosterUser | null {
  const n = personName.trim().toLowerCase()
  return users.find((u) => (u.name ?? '').trim().toLowerCase() === n) ?? null
}

/** The contact line: the People row's email and phone, else the user's, else nulls. */
export function payReportContact(people: ReadonlyArray<PayReportRosterPerson>, users: ReadonlyArray<PayReportRosterUser>, personName: string): PayStubHtmlContext['contact'] {
  const n = personName.trim()
  const p = people.find((x) => x.name?.trim() === n)
  if (p) return { email: p.email ?? null, phone: p.phone ?? null }
  const u = users.find((x) => x.name?.trim() === n)
  if (u) return { email: u.email ?? null, phone: u.phone ?? null }
  return { email: null, phone: null }
}

type CrewMaps = { crewByDatePerson: Record<string, CrewJobRow>; crewBidsByDatePerson: Record<string, CrewBidRow> }

/** The crew's job and bid assignments in the period, keyed `work_date:person_name`. */
export async function fetchPayReportCrewMaps(supabase: SupabaseClient, periodStart: string, periodEnd: string): Promise<CrewMaps> {
  const [{ data: crewData }, { data: crewBidsData }] = await Promise.all([
    supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', periodStart).lte('work_date', periodEnd),
    supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').gte('work_date', periodStart).lte('work_date', periodEnd),
  ])
  const crewByDatePerson: Record<string, CrewJobRow> = {}
  for (const r of (crewData ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>) {
    crewByDatePerson[`${r.work_date}:${r.person_name}`] = { job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [] }
  }
  const crewBidsByDatePerson: Record<string, CrewBidRow> = {}
  for (const r of (crewBidsData ?? []) as Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] }>) {
    crewBidsByDatePerson[`${r.work_date}:${r.person_name}`] = { bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [] }
  }
  return { crewByDatePerson, crewBidsByDatePerson }
}

/** The jobs and bids the person's days name, looked up by id — only when there are any. */
export async function fetchPayReportJobBidMaps(
  supabase: SupabaseClient,
  personName: string,
  dayRows: ReadonlyArray<{ work_date: string }>,
  maps: CrewMaps,
): Promise<{ jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }>; bidsMap: Record<string, { bid_number: string; project_name: string; address: string }> }> {
  const jobIds = new Set<string>()
  const bidIds = new Set<string>()
  for (const r of dayRows) {
    for (const a of maps.crewByDatePerson[`${r.work_date}:${personName}`]?.job_assignments ?? []) jobIds.add(a.job_id)
    for (const a of maps.crewBidsByDatePerson[`${r.work_date}:${personName}`]?.bid_assignments ?? []) bidIds.add(a.bid_id)
  }
  const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
  const bidsMap: Record<string, { bid_number: string; project_name: string; address: string }> = {}
  if (jobIds.size > 0) {
    const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [...jobIds] })
    for (const j of (jobsData ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
    }
  }
  if (bidIds.size > 0) {
    const { data: bidsData } = await supabase.rpc('get_bids_by_ids', { p_bid_ids: [...bidIds] })
    for (const b of (bidsData ?? []) as { id: string; bid_number: string; project_name: string; address: string }[]) {
      bidsMap[b.id] = { bid_number: b.bid_number ?? '', project_name: b.project_name ?? '', address: b.address ?? '' }
    }
  }
  return { jobsMap, bidsMap }
}

/** The vehicles a user held at any point in the period, with their weekly costs. */
export async function fetchPayReportVehicles(supabase: SupabaseClient, userId: string | null, periodStart: string, periodEnd: string): Promise<PayStubHtmlVehicle[]> {
  if (!userId) return []
  const { data: possData } = await supabase
    .from('vehicle_possessions')
    .select('vehicle_id, start_date')
    .eq('user_id', userId)
    .lte('start_date', periodEnd)
    .or(`end_date.is.null,end_date.gte.${periodStart}`)
    .order('start_date', { ascending: false })
  const poss = (possData ?? []) as { vehicle_id: string; start_date: string }[]
  const vehicleIds = [...new Set(poss.filter((p) => p.start_date <= periodEnd).map((p) => p.vehicle_id))]
  const result: PayStubHtmlVehicle[] = []
  for (const vehicleId of vehicleIds) {
    const { data: vehicleData } = await supabase.from('vehicles').select('year, make, model, vin, weekly_insurance_cost, weekly_registration_cost').eq('id', vehicleId).single()
    if (!vehicleData) continue
    const v = vehicleData as { year: number | null; make: string; model: string; vin: string | null; weekly_insurance_cost: number; weekly_registration_cost: number }
    result.push({ year: v.year ?? 0, make: v.make ?? '', model: v.model ?? '', vin: v.vin ?? null, weekly_insurance_cost: v.weekly_insurance_cost ?? 0, weekly_registration_cost: v.weekly_registration_cost ?? 0 })
  }
  return result
}

/** The housing a user held at any point in the period, with its weekly costs. */
export async function fetchPayReportHousing(supabase: SupabaseClient, userId: string | null, periodStart: string, periodEnd: string): Promise<PayStubHtmlHousing[]> {
  if (!userId) return []
  const { data: possData } = await supabase
    .from('housing_possessions')
    .select('housing_id, start_date')
    .eq('user_id', userId)
    .lte('start_date', periodEnd)
    .or(`end_date.is.null,end_date.gte.${periodStart}`)
    .order('start_date', { ascending: false })
  const poss = (possData ?? []) as { housing_id: string; start_date: string }[]
  const housingIds = [...new Set(poss.filter((p) => p.start_date <= periodEnd).map((p) => p.housing_id))]
  const result: PayStubHtmlHousing[] = []
  for (const hid of housingIds) {
    const { data: row } = await supabase.from('housing_units').select('address, rent_per_week, utilities_per_week, insurance_per_week').eq('id', hid).single()
    if (!row) continue
    const h = row as { address: string; rent_per_week: number; utilities_per_week: number; insurance_per_week: number }
    result.push({ address: h.address ?? '', rent_per_week: Number(h.rent_per_week) || 0, utilities_per_week: Number(h.utilities_per_week) || 0, insurance_per_week: Number(h.insurance_per_week) || 0 })
  }
  return result
}

/** The person's offsets not yet on any pay report. */
export async function fetchPayReportPendingOffsets(supabase: SupabaseClient, personName: string): Promise<Array<{ type: string; amount: number; description: string | null }>> {
  const { data } = await supabase.from('person_offsets').select('type, amount, description').eq('person_name', personName.trim()).is('pay_stub_id', null)
  return ((data ?? []) as { type: string; amount: number; description: string | null }[]).map((r) => ({ type: r.type, amount: r.amount, description: r.description }))
}

export type PayReportInputsArgs = {
  personName: string
  periodStart: string
  periodEnd: string
  /** The report's days — from the stub's saved days or the hours book; the caller decides. */
  dayRows: ReadonlyArray<{ work_date: string; hours: number }>
  payStubId: string
  users: ReadonlyArray<PayReportRosterUser>
  people: ReadonlyArray<PayReportRosterPerson>
  /** A saved stub's physical payments; off for the just-generated preview, which has none. */
  includePayments: boolean
}

export type PayReportInputs = Required<Pick<PayStubHtmlContext, 'contact' | 'rowsWithJobs' | 'vehicles' | 'housingRows' | 'pendingOffsets' | 'lessDeductionLines' | 'additionalLines' | 'physicalPayments'>> & {
  rowsWithJobs: PayReportAssignmentDayBreakdown[]
}

/** Everything the pay report's HTML needs beyond the days and the totals, in one fetch. */
export async function fetchPayReportInputs(supabase: SupabaseClient, a: PayReportInputsArgs): Promise<PayReportInputs> {
  const personName = a.personName.trim()
  const crew = await fetchPayReportCrewMaps(supabase, a.periodStart, a.periodEnd)
  const { jobsMap, bidsMap } = await fetchPayReportJobBidMaps(supabase, personName, a.dayRows, crew)
  const rowsWithJobs = computePayReportAssignmentsBreakdown(personName, [...a.dayRows], crew.crewByDatePerson, crew.crewBidsByDatePerson, jobsMap, bidsMap)
  const userId = payReportUserForName(a.users, personName)?.id ?? null
  const [vehicles, housingRows, pendingOffsets, dedRes, addRes, payRes] = await Promise.all([
    fetchPayReportVehicles(supabase, userId, a.periodStart, a.periodEnd),
    fetchPayReportHousing(supabase, userId, a.periodStart, a.periodEnd),
    fetchPayReportPendingOffsets(supabase, personName),
    supabase.from('pay_stub_deductions').select('amount, description, source').eq('pay_stub_id', a.payStubId).order('created_at', { ascending: true }),
    supabase.from('pay_stub_additional_lines').select('description, quantity, rate, line_total').eq('pay_stub_id', a.payStubId).order('created_at', { ascending: true }),
    a.includePayments
      ? supabase.from('pay_stub_payments').select('paid_at, amount, memo').eq('pay_stub_id', a.payStubId).order('paid_at', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ paid_at: string; amount: number; memo: string | null }> }),
  ])
  return {
    contact: payReportContact(a.people, a.users, personName),
    rowsWithJobs,
    vehicles,
    housingRows,
    pendingOffsets,
    lessDeductionLines: ((dedRes.data ?? []) as { amount: number; description: string; source: string }[]).map((r) => ({ amount: r.amount, description: r.description, source: r.source })),
    additionalLines: ((addRes.data ?? []) as { description: string; quantity: number; rate: number; line_total: number }[]).map((r) => ({ description: r.description, quantity: r.quantity, rate: r.rate, line_total: r.line_total })),
    physicalPayments: ((payRes.data ?? []) as { paid_at: string; amount: number; memo: string | null }[]).map((r) => ({ paid_at: r.paid_at, amount: r.amount, memo: r.memo })),
  }
}
