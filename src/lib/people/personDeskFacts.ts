import { supabase } from '../supabase'
import { buildApprovalsQueue } from './approvalsQueue'
import { fetchAllPendingClockSessions } from './fetchAllPendingClockSessions'
import { buildSubComplianceBadges } from './subCompliance'
import { subLaborJobBalance } from '../subLaborOutstanding'
import { vehicleDisplayName } from '../vehicleFleet'
import type { EndEmploymentFacts, StartEmploymentFacts } from './lifecycleChecklist'
import type { PersonKey } from './personKey'

/**
 * The reads behind the Person Desk lifecycle flows (PR 2). Every query is one
 * the tabs already run; RLS decides what the viewer sees, and an unreadable
 * table degrades to "unknown" rather than a false "all clear".
 */

export type PayConfigFacts = { exists: boolean; hourlyWage: number | null; officeWage: number | null; isSalary: boolean; recordHoursButSalary: boolean }

export async function loadPayConfigFacts(payName: string | null): Promise<PayConfigFacts | null> {
  if (!payName) return null
  const { data, error } = await supabase
    .from('people_pay_config')
    .select('person_name, hourly_wage, office_hourly_wage, is_salary, record_hours_but_salary')
    .eq('person_name', payName)
    .maybeSingle()
  if (error) return null
  const row = data as { hourly_wage: number | null; office_hourly_wage: number | null; is_salary: boolean | null; record_hours_but_salary: boolean | null } | null
  if (!row) return { exists: false, hourlyWage: null, officeWage: null, isSalary: false, recordHoursButSalary: false }
  return { exists: true, hourlyWage: row.hourly_wage, officeWage: row.office_hourly_wage, isSalary: !!row.is_salary, recordHoursButSalary: !!row.record_hours_but_salary }
}

export async function loadEndEmploymentFacts(key: PersonKey, endDateYmd: string, todayYmd: string): Promise<EndEmploymentFacts> {
  const userId = key.userId
  const personId = key.personId
  const [pay, pending, openRows, stubRows, sheets, portal, vehicles, housing, leaders, commitments, docs] = await Promise.all([
    loadPayConfigFacts(key.payName),
    userId ? fetchAllPendingClockSessions({ userId }).catch(() => []) : Promise.resolve([]),
    userId ? supabase.from('clock_sessions').select('id').eq('user_id', userId).is('clocked_out_at', null).is('revoked_at', null).limit(1) : Promise.resolve({ data: [] }),
    key.payName ? supabase.from('pay_stubs').select('period_end').eq('person_name', key.payName).order('period_end', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    key.isSub && personId
      ? supabase.from('people_labor_job_assignees').select('labor_job_id, people_labor_jobs(id, labor_rate, people_labor_job_items(fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount), people_labor_job_payments(id, amount, memo, created_at))').eq('person_id', personId)
      : Promise.resolve({ data: null }),
    key.isSub && personId ? supabase.from('sub_portal_links').select('id').eq('person_id', personId).is('revoked_at', null).limit(1) : Promise.resolve({ data: null }),
    userId ? supabase.from('vehicle_possessions').select('id, vehicle_id, start_date, vehicles(year, make, model)').eq('user_id', userId).is('end_date', null) : Promise.resolve({ data: [] }),
    userId ? supabase.from('housing_possessions').select('id, start_date, housing_units(address)').eq('user_id', userId).or(`end_date.is.null,end_date.gte.${todayYmd}`) : Promise.resolve({ data: [] }),
    userId ? supabase.from('team_leader_assignments').select('id, leader_user_id, users!team_leader_assignments_leader_user_id_fkey(name)').eq('member_user_id', userId) : Promise.resolve({ data: [] }),
    personId ? supabase.from('step_commitments').select('status').eq('person_id', personId).in('status', ['offered', 'accepted']) : Promise.resolve({ data: [] }),
    key.isSub && personId ? supabase.from('person_contract_documents').select('doc_type, status, expires_at').eq('person_id', personId) : Promise.resolve({ data: [] }),
  ])

  const queue = buildApprovalsQueue(pending, { todayYmd })

  let subBalance: EndEmploymentFacts['subBalance'] = null
  if (key.isSub && personId) {
    const rows = ((sheets as { data: unknown[] | null }).data ?? []) as Array<{ people_labor_jobs: { id: string; labor_rate: number | null; people_labor_job_items: unknown[]; people_labor_job_payments: unknown[] } | null }>
    let balance = 0
    let backcharges = 0
    let count = 0
    for (const r of rows) {
      const j = r.people_labor_jobs
      if (!j) continue
      count += 1
      const b = subLaborJobBalance({
        labor_rate: j.labor_rate,
        items: j.people_labor_job_items as never,
        payments: j.people_labor_job_payments as never,
      })
      balance += b.balance
      backcharges += b.backcharges
    }
    subBalance = { balance: Math.round(balance * 100) / 100, backcharges: Math.round(backcharges * 100) / 100, sheets: count }
  }

  const leaderRows = ((leaders as { data: unknown[] | null }).data ?? []) as Array<{ id: string; users: { name: string | null } | { name: string | null }[] | null }>
  const vehicleRows = ((vehicles as { data: unknown[] | null }).data ?? []) as Array<{ id: string; vehicle_id: string; start_date: string; vehicles: { year: number | null; make: string | null; model: string | null } | null }>
  const housingRows = ((housing as { data: unknown[] | null }).data ?? []) as Array<{ id: string; start_date: string; housing_units: { address: string | null } | null }>
  const commitmentRows = ((commitments as { data: unknown[] | null }).data ?? []) as Array<{ status: string }>
  const docRows = ((docs as { data: unknown[] | null }).data ?? []) as Array<{ doc_type: string; status: string; expires_at: string | null }>
  const portalRows = (portal as { data: unknown[] | null }).data

  return {
    endDateYmd,
    isSub: key.isSub,
    hasPayConfig: Boolean(pay?.exists),
    openSession: (((openRows as { data: unknown[] | null }).data ?? []).length) > 0,
    pendingSessions: { count: queue.count, hours: queue.hours },
    lastPayReportEnd: (((stubRows as { data: Array<{ period_end: string }> | null }).data ?? [])[0]?.period_end) ?? null,
    subBalance,
    portalOn: key.isSub && personId ? (portalRows ?? []).length > 0 : null,
    vehiclesHeld: vehicleRows.map((v) => ({
      possessionId: v.id,
      vehicleId: v.vehicle_id,
      label: v.vehicles ? vehicleDisplayName({ year: v.vehicles.year ?? null, make: v.vehicles.make ?? '', model: v.vehicles.model ?? '' } as never) : 'Vehicle',
      since: v.start_date,
    })),
    housing: housingRows.map((h) => ({ possessionId: h.id, label: h.housing_units?.address ?? 'Housing', since: h.start_date })),
    leaders: leaderRows.map((l) => {
      const u = Array.isArray(l.users) ? l.users[0] : l.users
      return { assignmentId: l.id, name: u?.name?.trim() || 'Leader' }
    }),
    workOrders: { offered: commitmentRows.filter((c) => c.status === 'offered').length, accepted: commitmentRows.filter((c) => c.status === 'accepted').length },
    missingDocs: key.isSub ? buildSubComplianceBadges(docRows, todayYmd).filter((b) => b.state === 'missing').map((b) => b.label) : [],
  }
}

export async function loadStartEmploymentFacts(key: PersonKey, todayYmd: string): Promise<StartEmploymentFacts> {
  const userId = key.userId
  const personId = key.personId
  const [pay, person, leaders, assignments, docs, vehicles, housing] = await Promise.all([
    loadPayConfigFacts(key.payName),
    personId ? supabase.from('people').select('start_date').eq('id', personId).maybeSingle() : Promise.resolve({ data: null }),
    userId ? supabase.from('team_leader_assignments').select('id', { count: 'exact', head: true }).eq('member_user_id', userId) : Promise.resolve({ count: 0 }),
    key.payName ? supabase.from('person_contract_assignments').select('id', { count: 'exact', head: true }).eq('person_name', key.payName) : Promise.resolve({ count: 0 }),
    personId ? supabase.from('person_contract_documents').select('id', { count: 'exact', head: true }).eq('person_id', personId) : Promise.resolve({ count: 0 }),
    userId ? supabase.from('vehicle_possessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('end_date', null) : Promise.resolve({ count: 0 }),
    userId ? supabase.from('housing_possessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).or(`end_date.is.null,end_date.gte.${todayYmd}`) : Promise.resolve({ count: 0 }),
  ])
  const startDate = ((person as { data: { start_date: string | null } | null }).data?.start_date) ?? null
  return {
    hasRosterRow: Boolean(personId),
    startDate,
    hasPayConfig: Boolean(pay?.exists),
    payConfigured: Boolean(pay?.exists && (pay.isSalary || (pay.hourlyWage ?? 0) > 0)),
    leaders: (leaders as { count: number | null }).count ?? 0,
    paperworkAssigned: ((assignments as { count: number | null }).count ?? 0) > 0 || ((docs as { count: number | null }).count ?? 0) > 0,
    vehiclesHeld: (vehicles as { count: number | null }).count ?? 0,
    housing: (housing as { count: number | null }).count ?? 0,
    hasLogin: Boolean(userId),
  }
}
