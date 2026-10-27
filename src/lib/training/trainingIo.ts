/**
 * Training's reads and writes (punch list #111): the catalog (`training_courses`), a person's own record
 * (`training_lesson_passes`, `training_passes`) and the two write doors (`training_pass_lesson`,
 * `training_finish_course`, migration 20261015060000). Every read fails soft while the migration is not on
 * prod (`missing: true`), so the client may deploy first. The rows are typed by hand until the types
 * regenerate after the push; the client is reached untyped for that reason alone.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '../../hooks/useAuth'
import { supabase } from '../supabase'
import { ROLES } from '../userRoles'
import { TRAINING_DUE_SOON_DAYS_DEFAULT, TRAINING_GOOD_FOR_MONTHS_DEFAULT, trainingChip, type CourseStanding, type TrainingColour, type TrainingPass, type TrainingPolicy } from './trainingState'

const db = supabase as unknown as SupabaseClient

type PgError = { code?: string | null; message?: string | null } | null

/**
 * A refused read as an Error that keeps the server's code (v2.5962): the page's own sentence then leads
 * the class sentence, *Could not read your training. You don't have access to this record.*, and a lost
 * signal still reads by its fetch signature. Pure.
 */
export function trainingReadError(error: PgError, fallback: string): Error & { code?: string } {
  const out: Error & { code?: string } = new Error(error?.message?.trim() || fallback)
  const code = error?.code == null ? '' : String(error.code).trim()
  if (code) out.code = code
  return out
}

/** "There is no such table / function yet": the migration has not been pushed. */
export function isNotThereYetError(error: PgError): boolean {
  if (!error) return false
  if (['PGRST202', 'PGRST205', 'PGRST200', '42883', '42P01'].includes(String(error.code ?? ''))) return true
  return /could not find the (function|table|relation)|does not exist|schema cache/i.test(error.message ?? '')
}

export type TrainingCourseRow = {
  slug: string
  title: string
  enabled: boolean
  required_roles: string[] | null
  good_for_months: number | null
  due_soon_days: number | null
  retake_from: string | null
  /** Open to every role (v2.5610); read as false until the column is on prod. */
  offered?: boolean | null
  updated_at?: string | null
}

export function policyFromRow(r: TrainingCourseRow): TrainingPolicy {
  const known = new Set<string>(ROLES)
  return {
    slug: r.slug,
    title: r.title,
    on: Boolean(r.enabled),
    requiredRoles: (r.required_roles ?? []).filter((x): x is UserRole => known.has(x)),
    goodForMonths: r.good_for_months ?? TRAINING_GOOD_FOR_MONTHS_DEFAULT,
    dueSoonDays: r.due_soon_days ?? TRAINING_DUE_SOON_DAYS_DEFAULT,
    retakeFrom: r.retake_from,
    offered: Boolean(r.offered),
  }
}

/** Every column, so a client deployed before a column's migration is pushed still reads the catalog (v2.5610's `offered`). */
const COURSE_COLUMNS = '*'

/** Every course the app has a policy row for, on or off. Everyone signed in may read it. */
export async function loadTrainingCatalog(): Promise<{ policies: TrainingPolicy[]; missing: boolean }> {
  const { data, error } = await db.from('training_courses').select(COURSE_COLUMNS).order('title')
  if (error) {
    if (isNotThereYetError(error)) return { policies: [], missing: true }
    throw trainingReadError(error, 'Could not read the training courses')
  }
  return { policies: ((data ?? []) as TrainingCourseRow[]).map(policyFromRow), missing: false }
}

export type MyTraining = {
  /** course slug → the lesson keys passed. */
  lessonPasses: Record<string, string[]>
  passes: TrainingPass[]
  missing: boolean
}

/** One person's own record: the lessons they passed and their passes of each final check. RLS gives a person their own rows. */
export async function loadMyTraining(userId: string): Promise<MyTraining> {
  const [lessons, passes] = await Promise.all([
    db.from('training_lesson_passes').select('course_slug, lesson_key').eq('user_id', userId),
    db.from('training_passes').select('course_slug, passed_on, content_version').eq('user_id', userId).order('passed_on', { ascending: false }),
  ])
  if (lessons.error || passes.error) {
    const err = lessons.error ?? passes.error
    if (isNotThereYetError(err)) return { lessonPasses: {}, passes: [], missing: true }
    throw trainingReadError(err, 'Could not read your training')
  }
  const lessonPasses: Record<string, string[]> = {}
  for (const r of (lessons.data ?? []) as Array<{ course_slug: string; lesson_key: string }>) {
    ;(lessonPasses[r.course_slug] ??= []).push(r.lesson_key)
  }
  const out: TrainingPass[] = ((passes.data ?? []) as Array<{ course_slug: string; passed_on: string; content_version: string }>).map((r) => ({
    slug: r.course_slug,
    passedOn: r.passed_on,
    contentVersion: r.content_version,
  }))
  return { lessonPasses, passes: out, missing: false }
}

export type TrainingStandingRow = {
  user_id: string
  name: string | null
  role: string
  colour: TrainingColour
  passed_on: string | null
  due_on: string | null
  days_to_due: number | null
}

/** Everyone active who must take a course, with their colour, worst first: `training_standings`, office only (empty for anyone else). */
export async function loadTrainingStandings(courseSlug: string): Promise<{ rows: TrainingStandingRow[]; missing: boolean }> {
  const { data, error } = await db.rpc('training_standings', { p_course_slug: courseSlug })
  if (error) {
    if (isNotThereYetError(error)) return { rows: [], missing: true }
    throw new Error(error.message)
  }
  return { rows: (data ?? []) as TrainingStandingRow[], missing: false }
}

/**
 * The People rail's training facts (v2.5568): per account, the chip `trainingChip` gives from their standings on
 * every course that is on. One `training_standings` call per course; the office reads them all, anyone else reads
 * none, and a prod without the tables yet reads none.
 */
export async function loadTrainingChipsByUser(): Promise<Record<string, { tone: 'red' | 'amber'; label: string; long: string }>> {
  const catalog = await loadTrainingCatalog()
  const on = catalog.policies.filter((p) => p.on)
  if (catalog.missing || on.length === 0) return {}
  const byUser = new Map<string, CourseStanding[]>()
  for (const policy of on) {
    const { rows } = await loadTrainingStandings(policy.slug)
    for (const r of rows) {
      const list = byUser.get(r.user_id) ?? []
      list.push({ slug: policy.slug, title: policy.title, colour: r.colour, passedOn: r.passed_on, dueOn: r.due_on, daysToDue: r.days_to_due })
      byUser.set(r.user_id, list)
    }
  }
  const out: Record<string, { tone: 'red' | 'amber'; label: string; long: string }> = {}
  for (const [userId, standings] of byUser) {
    const chip = trainingChip(standings)
    if (chip) out[userId] = chip
  }
  return out
}

export type TrainingPolicyPatch = Partial<{ enabled: boolean; required_roles: string[]; good_for_months: number; due_soon_days: number; retake_from: string | null; offered: boolean }>

/**
 * How many people have passed a course, for Settings → Training's *N took it* on an offered course (v2.5610). The
 * office reads every pass; anyone else reads their own, so the count is theirs alone and the tab never shows it.
 */
export async function loadTrainingTakenCount(courseSlug: string): Promise<number> {
  const { data, error } = await db.from('training_passes').select('user_id').eq('course_slug', courseSlug)
  if (error) {
    if (isNotThereYetError(error)) return 0
    throw new Error(error.message)
  }
  return new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)).size
}

/** A dev's change to a course's policy (RLS: `is_dev()`). */
export async function saveTrainingPolicy(courseSlug: string, patch: TrainingPolicyPatch, updatedBy: string): Promise<void> {
  const { error } = await db.from('training_courses').update({ ...patch, updated_by: updatedBy }).eq('slug', courseSlug)
  if (error) throw rpcError(error, 'Could not save the course')
}

function rpcError(error: PgError, fallback: string): Error {
  if (!error) return new Error(fallback)
  if (isNotThereYetError(error)) return new Error('Training is not switched on yet. Try again after the next update.')
  return new Error(error.message || fallback)
}

/** The signed-in person passed a lesson, every check right, after `tries` tries. */
export async function passLesson(courseSlug: string, lessonKey: string, tries: number): Promise<void> {
  const { error } = await db.rpc('training_pass_lesson', { p_course_slug: courseSlug, p_lesson_key: lessonKey, p_tries: tries })
  if (error) throw rpcError(error, 'Could not record the lesson')
}

export type FinishCourseArgs = {
  courseSlug: string
  contentVersion: string
  score: number
  total: number
  pass: number
  answers: Record<string, number>
}

/** The signed-in person passed the final check. Returns the pass's id. */
export async function finishCourse(a: FinishCourseArgs): Promise<string> {
  const { data, error } = await db.rpc('training_finish_course', {
    p_course_slug: a.courseSlug,
    p_content_version: a.contentVersion,
    p_score: a.score,
    p_total: a.total,
    p_pass: a.pass,
    p_answers: a.answers,
  })
  if (error) throw rpcError(error, 'Could not record the pass')
  return String(data ?? '')
}
