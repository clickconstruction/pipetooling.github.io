/**
 * GC mode, the real build, the Building lane's U4b: where the Submittals window talks to the database. It reads a
 * project's register in one round and carries each press to its function (migration 20261010005000_gc_submittal_writes,
 * the Building lane's U4a), which checks whose move it is and refuses in words. Nothing here decides anything: the
 * kernels in ./buildingSubmittals.ts do. The plan: to-dos/gc-mode/mockups/building-u4.md on branch spike/gc-mode.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { fnProblem, type FnResult } from './gcIo'
import { addSubmittalPayload, cameInPayload, type SubmittalCameIn, type SubmittalDraft, type SubmittalTables } from './submittalRows'
import type { SubmittalAnswer } from './types'

/** The rows of a read, or the read's problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** Ids an `.in()` filter takes at once, so a long register never makes a request line too long. */
const IN_CHUNK = 100

async function bySubmittal<T>(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: SupabaseResultError | null; status?: number }>, operation: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(...taken(await read(ids.slice(i, i + IN_CHUNK)), operation))
  return out
}

/** Every submittal on these projects, with the work each holds and its rounds, as their rows hold them. */
export async function loadGcSubmittals(projectIds: string[]): Promise<SubmittalTables> {
  if (projectIds.length === 0) return { submittals: [], holds: [], rounds: [] }
  const submittals = taken(await supabase.from('gc_submittals').select('*').in('project_id', projectIds).order('created_at'), 'load the submittals')
  const ids = submittals.map((s) => s.id)
  const [holds, rounds] = await Promise.all([
    bySubmittal(ids, (chunk) => supabase.from('gc_submittal_holds').select('*').in('submittal_id', chunk), 'load the work the submittals hold'),
    bySubmittal(ids, (chunk) => supabase.from('gc_submittal_rounds').select('*').in('submittal_id', chunk).order('round'), 'load the submittals’ rounds'),
  ])
  return { submittals, holds, rounds }
}

/** A new submittal in a trade's register, numbered by the database. Returns its id. */
export async function addSubmittal(draft: SubmittalDraft): Promise<string> {
  return taken(await supabase.rpc('gc_add_submittal', { s: addSubmittalPayload(draft) }), 'add the submittal')
}

/** A round that came by email, as the office records it. */
export async function submittalCameIn(cameIn: SubmittalCameIn): Promise<string> {
  return taken(await supabase.rpc('gc_submittal_came_in', { r: cameInPayload(cameIn) }), 'record the round')
}

/** The newest round goes to the architect by email through gc-architect-email, which records the send. */
export async function sendSubmittalToArchitect(submittalId: string): Promise<{ to: string }> {
  const r = (await supabase.functions.invoke('gc-architect-email', { body: { kind: 'submittal', submittal_id: submittalId } })) as FnResult
  const problem = await fnProblem(r, 'The submittal was not sent.')
  if (problem) throw new Error(problem)
  return { to: (r.data as { to: string }).to }
}

/** The newest round went to the architect some other way: the office marks it sent today. */
export async function markSubmittalSent(submittalId: string): Promise<void> {
  taken(await supabase.rpc('gc_send_submittal_to_architect', { p_submittal_id: submittalId }), 'mark it sent')
}

/** The architect's answer on the newest round. Revise needs what to change. */
export async function answerSubmittal(submittalId: string, answer: SubmittalAnswer, note: string): Promise<void> {
  taken(await supabase.rpc('gc_answer_submittal', { p_submittal_id: submittalId, p_answer: answer, p_note: note.trim() }), 'record the answer')
}
