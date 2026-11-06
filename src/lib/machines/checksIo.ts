/**
 * Equipment pre-use check (punch list #270): the reads and writes behind the check sheet, the Job Mode line and the
 * label's door. A check is a `machine_checks` row the sheet patches as each press lands; its photos are
 * `machine_check_photos` rows with the bytes in the `machine-check-photos` bucket until the sweep files them; a hold is
 * a `machine_held` row on Dispatch's inbox. The rows map through `machinesIo.ts`'s mappers.
 */
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { createDispatchRequest } from '../dispatchRequestHelpers'
import { heldWhy, machineName, placeAfterLeaving, todayDay, type Answer, type CheckKind, type LeftWhere, type Levels, type Machine, type MachineAssignment, type MachineCheck, type MachinePhoto, type MachineQuestion } from './machines'
import { checkFromRow, jobWordsOf, machineFromRow, placeMachine, questionFromRow, templateFromRow, type MachineTemplate } from './machinesIo'

type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type PhotoRow = Database['public']['Tables']['machine_check_photos']['Row']
type AssignmentRow = Database['public']['Tables']['machine_assignments']['Row']
type JobWordsRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }

const BUCKET = 'machine-check-photos'
const DAYS_BACK = 60

export interface MachineForCheck {
  machine: Machine
  questions: MachineQuestion[]
  checks: MachineCheck[]
  templates: MachineTemplate[]
}

async function jobWordsById(ids: Iterable<string>): Promise<Map<string, string>> {
  const list = [...new Set([...ids])]
  const words = new Map<string, string>()
  if (list.length === 0) return words
  const { data, error } = await supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name').in('id', list)
  if (error) throw error
  for (const j of (data ?? []) as JobWordsRow[]) words.set(j.id, jobWordsOf(j))
  return words
}

export async function checksOfVehicles(vehicleIds: readonly string[]): Promise<{ checks: MachineCheck[]; words: Map<string, string> }> {
  if (vehicleIds.length === 0) return { checks: [], words: new Map() }
  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString().slice(0, 10)
  const { data, error } = await supabase.from('machine_checks').select('*').in('vehicle_id', [...vehicleIds]).gte('work_date', since).order('started_at', { ascending: false })
  if (error) throw error
  const rows = data ?? []
  const photos = rows.length ? await supabase.from('machine_check_photos').select('*').in('check_id', rows.map((c) => c.id)) : { data: [] as PhotoRow[], error: null }
  if (photos.error) throw photos.error
  const words = await jobWordsById(rows.map((c) => c.job_id).filter((x): x is string => Boolean(x)))
  return { checks: rows.map((c) => checkFromRow(c, (photos.data ?? []) as PhotoRow[], c.job_id ? words.get(c.job_id) ?? null : null)), words }
}

async function placeOf(vehicleId: string): Promise<{ jobId: string; jobWords: string; since: string } | null> {
  const { data, error } = await supabase.from('vehicle_possessions').select('id, vehicle_id, job_id, start_date').eq('vehicle_id', vehicleId).is('end_date', null).not('job_id', 'is', null).order('start_date', { ascending: false }).limit(1)
  if (error) throw error
  const p = data?.[0]
  if (!p?.job_id) return null
  const words = await jobWordsById([p.job_id])
  return { jobId: p.job_id, jobWords: words.get(p.job_id) ?? '', since: p.start_date }
}

/** One machine by its label's code or its id, with its template's gauges, its questions and its recent checks. */
export async function loadMachineForCheck(by: { code?: string; id?: string }): Promise<MachineForCheck | null> {
  let q = supabase.from('vehicles').select('*').eq('kind', 'machine')
  q = by.id ? q.eq('id', by.id) : q.eq('code', (by.code ?? '').replace(/[^0-9a-z]/gi, '').toUpperCase())
  const { data, error } = await q.limit(1)
  if (error) throw error
  const v = data?.[0] as VehicleRow | undefined
  if (!v) return null
  const [templates, questions, place, checks] = await Promise.all([
    supabase.from('machine_templates').select('*').eq('active', true).order('sort', { ascending: true }),
    supabase.from('machine_check_questions').select('*').eq('active', true).order('sort', { ascending: true }),
    placeOf(v.id),
    checksOfVehicles([v.id]),
  ])
  if (templates.error) throw templates.error
  if (questions.error) throw questions.error
  const ts = (templates.data ?? []).map(templateFromRow)
  return { machine: machineFromRow(v, ts, place), questions: (questions.data ?? []).map(questionFromRow), checks: checks.checks, templates: ts }
}

/** The active templates alone, for the label's Add this machine on a code the board does not know. */
export async function loadTemplates(): Promise<MachineTemplate[]> {
  const { data, error } = await supabase.from('machine_templates').select('*').eq('active', true).order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []).map(templateFromRow)
}

/** Every check question, for the block editor's blanks line under a template: the template's and every machine's. */
export async function loadQuestions(): Promise<MachineQuestion[]> {
  const { data, error } = await supabase.from('machine_check_questions').select('*').order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []).map(questionFromRow)
}

export interface JobMachines {
  machines: Machine[]
  questions: MachineQuestion[]
  checks: MachineCheck[]
  assignments: MachineAssignment[]
}

function assignmentFromRow(a: AssignmentRow, jobWords: string): MachineAssignment {
  return { id: a.id, machineId: a.vehicle_id, jobId: a.job_id, jobWords, day: a.work_date, broughtBy: a.brought_by, answer: a.answer as MachineAssignment['answer'], answeredAt: a.answered_at, why: a.why }
}

/** The machines a job's day shows: the ones placed on it and the ones planned for it today, with their checks. */
export async function loadJobMachines(jobId: string, day = todayDay()): Promise<JobMachines> {
  const [placed, planned, templates, questions] = await Promise.all([
    supabase.from('vehicle_possessions').select('id, vehicle_id, job_id, start_date').eq('job_id', jobId).is('end_date', null),
    supabase.from('machine_assignments').select('*').eq('job_id', jobId).eq('work_date', day),
    supabase.from('machine_templates').select('*').eq('active', true).order('sort', { ascending: true }),
    supabase.from('machine_check_questions').select('*').eq('active', true).order('sort', { ascending: true }),
  ])
  for (const r of [placed, planned, templates, questions]) if (r.error) throw r.error
  const ids = new Set<string>()
  for (const p of placed.data ?? []) ids.add(p.vehicle_id)
  for (const a of planned.data ?? []) ids.add(a.vehicle_id)
  if (ids.size === 0) return { machines: [], questions: [], checks: [], assignments: [] }
  const { data: vehicles, error } = await supabase.from('vehicles').select('*').in('id', [...ids]).eq('kind', 'machine')
  if (error) throw error
  const words = await jobWordsById([jobId])
  const jobWords = words.get(jobId) ?? ''
  const ts = (templates.data ?? []).map(templateFromRow)
  const placedIds = new Set((placed.data ?? []).map((p) => p.vehicle_id))
  const sinceOf = new Map((placed.data ?? []).map((p) => [p.vehicle_id, p.start_date] as const))
  const machines = (vehicles ?? []).map((v) => machineFromRow(v, ts, placedIds.has(v.id) ? { jobId, jobWords, since: sinceOf.get(v.id) ?? day } : null))
  const checks = await checksOfVehicles(machines.map((m) => m.id))
  return { machines, questions: (questions.data ?? []).map(questionFromRow), checks: checks.checks, assignments: (planned.data ?? []).map((a) => assignmentFromRow(a, jobWords)) }
}

/** Today's unfinished check of this kind by this person, else a new row. */
export async function startCheck(input: { machine: Machine; kind: CheckKind; jobId: string | null; byUserId: string | null; byName: string; day?: string }): Promise<MachineCheck> {
  const day = input.day ?? todayDay()
  const open = await supabase.from('machine_checks').select('*').eq('vehicle_id', input.machine.id).eq('work_date', day).eq('kind', input.kind).eq('verdict', 'unfinished').eq('by_name', input.byName).order('started_at', { ascending: false }).limit(1)
  if (open.error) throw open.error
  const words = input.jobId ? await jobWordsById([input.jobId]) : new Map<string, string>()
  const existing = open.data?.[0]
  if (existing) return checkFromRow(existing, [], existing.job_id ? words.get(existing.job_id) ?? null : null)
  const { data, error } = await supabase
    .from('machine_checks')
    .insert({ vehicle_id: input.machine.id, kind: input.kind, job_id: input.jobId, work_date: day, by_user_id: input.byUserId, by_name: input.byName })
    .select('*')
    .single()
  if (error) throw error
  return checkFromRow(data, [], input.jobId ? words.get(input.jobId) ?? null : null)
}

export async function patchCheck(id: string, fields: { answers?: Answer[]; levels?: Levels; hours?: number | null; leftWhere?: LeftWhere | null; leftJobId?: string | null }): Promise<void> {
  const update: Database['public']['Tables']['machine_checks']['Update'] = { updated_at: new Date().toISOString() }
  if (fields.answers !== undefined) update.answers = fields.answers as unknown as Database['public']['Tables']['machine_checks']['Update']['answers']
  if (fields.levels !== undefined) update.levels = fields.levels as unknown as Database['public']['Tables']['machine_checks']['Update']['levels']
  if (fields.hours !== undefined) update.hours = fields.hours
  if (fields.leftWhere !== undefined) update.left_where = fields.leftWhere
  if (fields.leftJobId !== undefined) update.left_job_id = fields.leftJobId
  const { error } = await supabase.from('machine_checks').update(update).eq('id', id)
  if (error) throw error
}

/** The sign press: the verdict and the stamp; a leaving check moves the machine where it said. */
export async function signCheck(check: MachineCheck, machine: Machine, verdict: 'safe' | 'held', other: { id: string; words: string } | null): Promise<void> {
  const { error } = await supabase.from('machine_checks').update({ signed_at: new Date().toISOString(), verdict, updated_at: new Date().toISOString() }).eq('id', check.id)
  if (error) throw error
  if (check.kind === 'post' && check.leftWhere) {
    const place = placeAfterLeaving(machine, check.leftWhere, other)
    if (place.jobId !== machine.jobId) await placeMachine(machine.id, place.jobId ? { id: place.jobId } : null)
  }
}

/** A held machine on Dispatch's inbox, once per check; answers the request's id, or null when one already stands. */
export async function holdMachine(check: MachineCheck, machine: Machine, job: { id: string; words: string }, userId: string): Promise<string | null> {
  const why = heldWhy(check)
  const made = await createDispatchRequest({
    fromUserId: userId,
    jobId: job.id,
    title: `${machine.unitLabel} ${machine.make} ${machine.model} is held · ${why} (${check.kind === 'pre' ? 'pre-use' : 'leaving'} check)`,
    referenceSummary: `${machineName(machine)} on ${job.words}`,
    pendingAction: 'machine_held',
    pendingPayload: { vehicle_id: machine.id, check_id: check.id, why },
  })
  const id = made.outcome === 'created' ? made.id : null
  if (id) {
    const { error } = await supabase.from('machine_checks').update({ dispatch_request_id: id }).eq('id', check.id)
    if (error) throw error
  }
  return id
}

/** Dispatch's word on a held machine: it runs. */
export async function runAnyway(checkId: string, userId: string | null, byName: string): Promise<void> {
  const { error } = await supabase.from('machine_checks').update({ run_anyway_by_user_id: userId, run_anyway_by_name: byName, run_anyway_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', checkId)
  if (error) throw error
}

/** A photo on a check: the row first (its id names the object), the bytes into the bucket, the path on the row. */
export async function addCheckPhoto(input: { check: MachineCheck; machine: Machine; shot: string; fileName: string; blob: Blob; byUserId: string | null }): Promise<MachinePhoto> {
  const { data, error } = await supabase
    .from('machine_check_photos')
    .insert({ check_id: input.check.id, vehicle_id: input.machine.id, job_id: input.check.jobId, shot: input.shot, file_name: input.fileName, by_user_id: input.byUserId, bytes: input.blob.size })
    .select('*')
    .single()
  if (error) throw error
  const path = `${input.machine.id}/${data.id}.jpg`
  const up = await supabase.storage.from(BUCKET).upload(path, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: false })
  if (up.error) throw up.error
  const { error: kept } = await supabase.from('machine_check_photos').update({ storage_path: path }).eq('id', data.id)
  if (kept) throw kept
  return { id: data.id, shot: data.shot, fileName: data.file_name, src: URL.createObjectURL(input.blob), driveFileId: null, filedAt: null, failWhy: null }
}

/** A URL to draw a photo still in the bucket; null once the sweep has filed and deleted it. */
export async function photoSrc(vehicleId: string, photoId: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(`${vehicleId}/${photoId}.jpg`, 3600)
  return data?.signedUrl ?? null
}

/** The morning's answer on a planned machine; Here puts it on the job. */
export async function answerArrival(assignment: MachineAssignment, machine: Machine, answer: NonNullable<MachineAssignment['answer']>, why = ''): Promise<void> {
  const { error } = await supabase.from('machine_assignments').update({ answer, answered_at: new Date().toISOString(), why }).eq('id', assignment.id)
  if (error) throw error
  if (answer === 'here' && machine.jobId !== assignment.jobId) await placeMachine(machine.id, { id: assignment.jobId })
}
