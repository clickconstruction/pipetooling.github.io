/**
 * Equipment pre-use check (punch list #270): the reads and writes behind the fleet board's machines. A machine is a
 * `vehicles` row with `kind = 'machine'`; its place is the open `vehicle_possessions` row with a `job_id`; its gauges
 * are its own `levels` or its template's; its walk's questions are every machine's, its template's and its own. The
 * rows map into the kernel's shapes here and nowhere else.
 */
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { todayDay, type LevelDef, type Machine, type MachineCheck, type MachineKind, type MachineQuestion, type Rental } from './machines'

type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type TemplateRow = Database['public']['Tables']['machine_templates']['Row']
type QuestionRow = Database['public']['Tables']['machine_check_questions']['Row']
type CheckRow = Database['public']['Tables']['machine_checks']['Row']
type PhotoRow = Database['public']['Tables']['machine_check_photos']['Row']
type PossessionRow = Pick<Database['public']['Tables']['vehicle_possessions']['Row'], 'id' | 'vehicle_id' | 'job_id' | 'start_date'>

export interface MachineTemplate {
  id: string
  name: string
  kind: MachineKind
  size: 'small' | 'medium' | 'large' | null
  levels: LevelDef[]
  sort: number
  active: boolean
}

export interface Fleet {
  machines: Machine[]
  templates: MachineTemplate[]
  questions: MachineQuestion[]
  checks: MachineCheck[]
}

const JOB_WORDS_SELECT = 'id, hcp_number, click_number, job_name'
type JobWordsRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }

export function jobWordsOf(j: JobWordsRow | null | undefined): string {
  if (!j) return ''
  return [j.hcp_number || j.click_number || null, j.job_name].filter(Boolean).join(' · ')
}

function levelsOf(raw: unknown): LevelDef[] {
  return Array.isArray(raw) ? (raw as LevelDef[]) : []
}

export function templateFromRow(r: TemplateRow): MachineTemplate {
  return { id: r.id, name: r.name, kind: r.machine_kind as MachineKind, size: (r.size as MachineTemplate['size']) ?? null, levels: levelsOf(r.levels), sort: r.sort, active: r.active }
}

export function questionFromRow(r: QuestionRow): MachineQuestion {
  return { id: r.id, templateId: r.template_id, machineId: r.vehicle_id, words: r.words, holdsMachine: r.holds_machine, when: r.asked_on as MachineQuestion['when'] }
}

export function rentalOf(v: Pick<VehicleRow, 'rental_from' | 'rental_agreement_no' | 'rental_out_on' | 'rental_due_back'>): Rental | null {
  if (!v.rental_from && !v.rental_agreement_no) return null
  return { from: v.rental_from ?? '', agreementNo: v.rental_agreement_no ?? '', outOn: v.rental_out_on ?? '', dueBack: v.rental_due_back ?? '' }
}

export function machineFromRow(v: VehicleRow, templates: readonly MachineTemplate[], place: { jobId: string; jobWords: string; since: string } | null): Machine {
  const t = templates.find((x) => x.id === v.template_id) ?? null
  const own = levelsOf(v.levels)
  return {
    id: v.id,
    unitLabel: v.unit_label ?? '',
    make: v.make,
    model: v.model,
    kind: (v.machine_kind as MachineKind | null) ?? t?.kind ?? 'other',
    templateId: v.template_id,
    code: v.code ?? '',
    jobId: place?.jobId ?? null,
    jobWords: place?.jobWords ?? null,
    heldSince: place?.since ?? null,
    levels: v.levels != null ? own : (t?.levels ?? []),
    rental: rentalOf(v),
    driveLink: v.google_drive_link,
  }
}

export function checkFromRow(c: CheckRow, photos: readonly PhotoRow[], jobWords: string | null): MachineCheck {
  const run = c.run_anyway_at ? { byName: c.run_anyway_by_name ?? '', at: c.run_anyway_at } : null
  return {
    id: c.id,
    kind: c.kind as MachineCheck['kind'],
    machineId: c.vehicle_id,
    jobId: c.job_id,
    jobWords,
    day: c.work_date,
    byName: c.by_name,
    startedAt: c.started_at,
    signedAt: c.signed_at,
    verdict: c.verdict as MachineCheck['verdict'],
    answers: Array.isArray(c.answers) ? (c.answers as unknown as MachineCheck['answers']) : [],
    levels: (c.levels && typeof c.levels === 'object' && !Array.isArray(c.levels) ? (c.levels as Record<string, number>) : {}) as MachineCheck['levels'],
    hours: c.hours,
    photos: photos.filter((p) => p.check_id === c.id).map((p) => ({ id: p.id, shot: p.shot, fileName: p.file_name, src: null, driveFileId: p.drive_file_id, filedAt: p.filed_at, failWhy: p.fail_why })),
    leftWhere: c.left_where as MachineCheck['leftWhere'],
    runAnyway: run,
    dispatchedAt: c.dispatch_request_id ? c.started_at : null,
  }
}

/** The fleet board's machines with their templates, questions, places and the newest checks (sixty days). */
export async function loadFleet(): Promise<Fleet> {
  const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
  const [vehicles, templates, questions, possessions, checks] = await Promise.all([
    supabase.from('vehicles').select('*').eq('kind', 'machine').order('unit_label', { ascending: true }),
    supabase.from('machine_templates').select('*').eq('active', true).order('sort', { ascending: true }),
    supabase.from('machine_check_questions').select('*').eq('active', true).order('sort', { ascending: true }),
    supabase.from('vehicle_possessions').select('id, vehicle_id, job_id, start_date').is('end_date', null).not('job_id', 'is', null),
    supabase.from('machine_checks').select('*').gte('work_date', since).order('started_at', { ascending: false }),
  ])
  for (const r of [vehicles, templates, questions, possessions, checks]) if (r.error) throw r.error
  const ts = (templates.data ?? []).map(templateFromRow)
  const jobIds = new Set<string>()
  for (const p of (possessions.data ?? []) as PossessionRow[]) if (p.job_id) jobIds.add(p.job_id)
  for (const c of checks.data ?? []) if (c.job_id) jobIds.add(c.job_id)
  const jobs = jobIds.size ? await supabase.from('jobs_ledger').select(JOB_WORDS_SELECT).in('id', [...jobIds]) : { data: [] as JobWordsRow[], error: null }
  if (jobs.error) throw jobs.error
  const words = new Map<string, string>()
  for (const j of (jobs.data ?? []) as JobWordsRow[]) words.set(j.id, jobWordsOf(j))
  const placeOf = new Map<string, { jobId: string; jobWords: string; since: string }>()
  for (const p of (possessions.data ?? []) as PossessionRow[]) if (p.job_id) placeOf.set(p.vehicle_id, { jobId: p.job_id, jobWords: words.get(p.job_id) ?? '', since: p.start_date })
  const checkIds = (checks.data ?? []).map((c) => c.id)
  const photos = checkIds.length ? await supabase.from('machine_check_photos').select('*').in('check_id', checkIds) : { data: [] as PhotoRow[], error: null }
  if (photos.error) throw photos.error
  return {
    machines: (vehicles.data ?? []).map((v) => machineFromRow(v, ts, placeOf.get(v.id) ?? null)),
    templates: ts,
    questions: (questions.data ?? []).map(questionFromRow),
    checks: (checks.data ?? []).map((c) => checkFromRow(c, (photos.data ?? []) as PhotoRow[], c.job_id ? words.get(c.job_id) ?? null : null)),
  }
}

/** Eight letters and digits for a new machine's label, from its unit and a few random characters. */
export function mintCode(unitLabel: string): string {
  const base = unitLabel.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 4)
  const rnd = Math.random().toString(36).replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8 - base.length)
  return (base + rnd).padEnd(8, 'X').slice(0, 8)
}

export async function addMachine(input: { unitLabel: string; make: string; model: string; templateId: string | null; kind: MachineKind; code?: string }): Promise<string> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ kind: 'machine', machine_kind: input.kind, unit_label: input.unitLabel, make: input.make, model: input.model, meter: 'hours', template_id: input.templateId, code: input.code ?? mintCode(input.unitLabel), weekly_insurance_cost: 0 })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function saveRental(vehicleId: string, rental: Rental | null): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({ rental_from: rental?.from.trim() || null, rental_agreement_no: rental?.agreementNo.trim() || null, rental_out_on: rental?.outOn || null, rental_due_back: rental?.dueBack || null, updated_at: new Date().toISOString() })
    .eq('id', vehicleId)
  if (error) throw error
}

/** The machine's own gauges; null goes back to the template's. */
export async function saveLevels(vehicleId: string, levels: LevelDef[] | null): Promise<void> {
  const { error } = await supabase.from('vehicles').update({ levels: levels as unknown as Database['public']['Tables']['vehicles']['Update']['levels'], updated_at: new Date().toISOString() }).eq('id', vehicleId)
  if (error) throw error
}

export async function saveTemplate(vehicleId: string, templateId: string | null, kind: MachineKind): Promise<void> {
  const { error } = await supabase.from('vehicles').update({ template_id: templateId, machine_kind: kind, updated_at: new Date().toISOString() }).eq('id', vehicleId)
  if (error) throw error
}

/**
 * Where the machine is: the open possession ends today and a new one starts on the job, or none when it goes to the
 * yard. The same move the hand-off on a truck makes, with a job as the holder.
 */
export async function placeMachine(vehicleId: string, job: { id: string } | null, day = todayDay()): Promise<void> {
  const open = await supabase.from('vehicle_possessions').select('id, job_id').eq('vehicle_id', vehicleId).is('end_date', null)
  if (open.error) throw open.error
  const ids = (open.data ?? []).map((p) => p.id)
  if (ids.length) {
    const { error } = await supabase.from('vehicle_possessions').update({ end_date: day }).in('id', ids)
    if (error) throw error
  }
  if (job) {
    const { error } = await supabase.from('vehicle_possessions').insert({ vehicle_id: vehicleId, job_id: job.id, start_date: day })
    if (error) throw error
  }
}
