/**
 * Equipment pre-use check (punch list #270): Dispatch's plan, a machine on a job's day, as the schedule reads and
 * writes it. A day's plan is read once and shared by every block on the board (one read for the week's chips, not one
 * per block); a write refreshes the day and tells every subscriber.
 */
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { todayDay, type Machine, type MachineAssignment, type MachineCheck } from './machines'
import { jobWordsOf, machineFromRow, templateFromRow } from './machinesIo'
import { checksOfVehicles } from './checksIo'

type AssignmentRow = Database['public']['Tables']['machine_assignments']['Row']
type JobWordsRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }

export interface DayPlan {
  day: string
  machines: Machine[]
  assignments: MachineAssignment[]
  /** Sixty days of the machines' checks, for the held chip. */
  checks: MachineCheck[]
}

const plans = new Map<string, DayPlan>()
const reads = new Map<string, Promise<DayPlan>>()
const listeners = new Set<() => void>()

export function subscribePlans(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function peekDay(day: string): DayPlan | null {
  return plans.get(day) ?? null
}

async function readDay(day: string): Promise<DayPlan> {
  const [vehicles, templates, assignments] = await Promise.all([
    supabase.from('vehicles').select('*').eq('kind', 'machine').order('unit_label', { ascending: true }),
    supabase.from('machine_templates').select('*').eq('active', true),
    supabase.from('machine_assignments').select('*').eq('work_date', day),
  ])
  for (const r of [vehicles, templates, assignments]) if (r.error) throw r.error
  const ts = (templates.data ?? []).map(templateFromRow)
  const ids = (vehicles.data ?? []).map((v) => v.id)
  const [places, checks] = await Promise.all([
    ids.length ? supabase.from('vehicle_possessions').select('vehicle_id, job_id, start_date').in('vehicle_id', ids).is('end_date', null).not('job_id', 'is', null) : Promise.resolve({ data: [] as { vehicle_id: string; job_id: string | null; start_date: string }[], error: null }),
    checksOfVehicles(ids),
  ])
  if (places.error) throw places.error
  const jobIds = new Set<string>()
  for (const p of places.data ?? []) if (p.job_id) jobIds.add(p.job_id)
  for (const a of (assignments.data ?? []) as AssignmentRow[]) jobIds.add(a.job_id)
  const words = new Map<string, string>()
  if (jobIds.size) {
    const { data, error } = await supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name').in('id', [...jobIds])
    if (error) throw error
    for (const j of (data ?? []) as JobWordsRow[]) words.set(j.id, jobWordsOf(j))
  }
  const placeOf = new Map<string, { jobId: string; jobWords: string; since: string }>()
  for (const p of places.data ?? []) if (p.job_id) placeOf.set(p.vehicle_id, { jobId: p.job_id, jobWords: words.get(p.job_id) ?? '', since: p.start_date })
  return {
    day,
    machines: (vehicles.data ?? []).map((v) => machineFromRow(v, ts, placeOf.get(v.id) ?? null)),
    assignments: ((assignments.data ?? []) as AssignmentRow[]).map((a) => assignmentFromRow(a, words.get(a.job_id) ?? '')),
    checks: checks.checks,
  }
}

export function assignmentFromRow(a: AssignmentRow, jobWords: string): MachineAssignment {
  return { id: a.id, machineId: a.vehicle_id, jobId: a.job_id, jobWords, day: a.work_date, broughtBy: a.brought_by, answer: a.answer as MachineAssignment['answer'], answeredAt: a.answered_at, why: a.why }
}

/** The day's plan, read once and shared; `fresh` reads again. */
export function loadDay(day: string, fresh = false): Promise<DayPlan> {
  if (!fresh) {
    const have = plans.get(day)
    if (have) return Promise.resolve(have)
    const going = reads.get(day)
    if (going) return going
  }
  const p = readDay(day)
    .then((plan) => {
      plans.set(day, plan)
      reads.delete(day)
      listeners.forEach((l) => l())
      return plan
    })
    .catch((e) => {
      reads.delete(day)
      throw e
    })
  reads.set(day, p)
  return p
}

async function refresh(day: string) {
  await loadDay(day, true)
}

export async function addAssignment(input: { machineId: string; jobId: string; day: string; createdBy: string | null }): Promise<void> {
  const { error } = await supabase.from('machine_assignments').insert({ vehicle_id: input.machineId, job_id: input.jobId, work_date: input.day, created_by: input.createdBy })
  if (error && error.code !== '23505') throw error
  await refresh(input.day)
}

export async function patchAssignment(a: MachineAssignment, change: { broughtBy?: string; answer?: MachineAssignment['answer']; why?: string }): Promise<void> {
  const update: Database['public']['Tables']['machine_assignments']['Update'] = {}
  if (change.broughtBy !== undefined) update.brought_by = change.broughtBy
  if (change.answer !== undefined) {
    update.answer = change.answer
    update.answered_at = change.answer ? new Date().toISOString() : null
  }
  if (change.why !== undefined) update.why = change.why
  const { error } = await supabase.from('machine_assignments').update(update).eq('id', a.id)
  if (error) throw error
  await refresh(a.day)
}

export async function removeAssignment(a: MachineAssignment): Promise<void> {
  const { error } = await supabase.from('machine_assignments').delete().eq('id', a.id)
  if (error) throw error
  await refresh(a.day)
}

/** Forget what was read, so the next look reads again (after a write elsewhere). */
export function forgetDay(day = todayDay()): void {
  plans.delete(day)
  listeners.forEach((l) => l())
}
