/**
 * Materials on site (punch list #297, the finish line, v2.6927): reading which of a job's box photos are due a move of
 * their Drive file, and asking photo-save to move them now. The marks live in a small store of their own, apart from
 * the on-site store's read, so a screen opened before the column existed, or a read that fails, costs the strip and
 * never the boxes. Browser io, not pure; the words are `boxPhotoRefileStrip.ts`'s.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { combinePhotosSentence, mayAskRefile, refileAsksAgain, type RefileMark } from './boxPhotoRefileStrip'

const db = supabase as unknown as SupabaseClient

export interface RefileJobState {
  marks: RefileMark[]
  /** The most marks seen on this job since the page opened, so the count can read *5 of 12 moved*. */
  seenMost: number
  /** An ask of ours is running. */
  asking: boolean
}

const EMPTY: RefileJobState = { marks: [], seenMost: 0, asking: false }
const jobs = new Map<string, RefileJobState>()
const listeners = new Set<() => void>()
let version = 0

function set(jobId: string, patch: Partial<RefileJobState>): void {
  jobs.set(jobId, { ...(jobs.get(jobId) ?? EMPTY), ...patch })
  version += 1
  for (const l of listeners) l()
}

export function subscribeRefile(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function refileVersion(): number {
  return version
}

export function refileJobState(jobId: string): RefileJobState {
  return jobs.get(jobId) ?? EMPTY
}

/** For tests: forget every job. */
export function resetRefileState(): void {
  jobs.clear()
  version += 1
}

type MarkRow = { id: string; file_name: string; refile_due_at: string; fail_why: string | null }

/** Reads the job's marks. A read that fails leaves what is shown as it was: the strip is never the page's failure. */
export async function refreshRefileMarks(jobId: string): Promise<RefileMark[]> {
  const { data, error } = await db.from('job_box_photos').select('id, file_name, refile_due_at, fail_why').eq('job_id', jobId).not('refile_due_at', 'is', null).not('drive_file_id', 'is', null).order('taken_at', { ascending: true })
  if (error) return refileJobState(jobId).marks
  const marks = ((data ?? []) as MarkRow[]).map((r) => ({ id: r.id, fileName: r.file_name, dueAt: r.refile_due_at, failWhy: r.fail_why }))
  set(jobId, { marks, seenMost: marks.length === 0 ? 0 : Math.max(refileJobState(jobId).seenMost, marks.length) })
  return marks
}

interface RefileAnswer {
  moved?: unknown[]
  left?: number
}

/**
 * Asks photo-save to move the job's files now, again while it answers that some were not reached, and reads the marks
 * after each answer so the count moves. Throws with the function's own words when it refuses; the sweep moves what is
 * left either way.
 */
export async function runBoxPhotoRefile(jobId: string): Promise<void> {
  if (refileJobState(jobId).asking) return
  set(jobId, { asking: true })
  try {
    for (let round = 1; ; round += 1) {
      const r = (await supabase.functions.invoke('photo-save', { body: { refile_box_photos: jobId } })) as FnResult
      const problem = await fnProblem(r, 'The photos’ files did not move.')
      if (problem) throw new Error(problem)
      await refreshRefileMarks(jobId)
      if (!refileAsksAgain(r.data as RefileAnswer | null, round)) break
    }
  } finally {
    set(jobId, { asking: false })
    await refreshRefileMarks(jobId)
  }
}

/**
 * After a combine: the sentence its finish adds when the kept job has box photos on their way, with the ask started
 * for a role that may make it. Never throws and never waits on Drive: a read that fails says nothing, and an ask that
 * fails is finished by the sweep, since the database has marked each photo due.
 */
export async function afterCombineBoxPhotos(targetJobId: string, role: string | null | undefined): Promise<string> {
  try {
    const marks = await refreshRefileMarks(targetJobId)
    const due = marks.filter((m) => !m.failWhy).length
    if (due > 0 && mayAskRefile(role)) void runBoxPhotoRefile(targetJobId).catch(() => {})
    return combinePhotosSentence(due)
  } catch {
    return ''
  }
}
