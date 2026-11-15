/**
 * Materials on site (punch list #209, v2.7305): the office's move of everything a job holds on site to another job,
 * through `on_site_move_job(p, p_dry_run)` (`20261115040000_on_site_move_job_office.sql`), the dev seat's body behind
 * the office's gate. The dry run does the move, reads both jobs and unwinds, so the plan is what the apply will do;
 * the apply runs the same body and leaves a note on both jobs. Browser io, not pure; the words are `onSiteMoveJob.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { afterCombineBoxPhotos, refreshRefileMarks } from './boxPhotoRefileIo'
import { readMovePlan, type OnSiteMovePlan } from './onSiteMoveJob'
import { loadJob } from './onSiteStore'

const db = supabase as unknown as SupabaseClient

async function call(fromJobId: string, toJobId: string, dryRun: boolean): Promise<OnSiteMovePlan> {
  // The generated types learn the function at the regeneration after the push.
  const { data, error } = await db.rpc('on_site_move_job', { p: { from_job: fromJobId, to_job: toJobId }, p_dry_run: dryRun })
  if (error) throw error
  const plan = readMovePlan(data)
  if (!plan) throw new Error('The database answered, but not with a plan. Nothing moved.')
  return plan
}

/** The dry run: the plan, with nothing written. Throws the database's own refusal. */
export function planOnSiteMove(fromJobId: string, toJobId: string): Promise<OnSiteMovePlan> {
  return call(fromJobId, toJobId, true)
}

/** The move itself. Throws the database's own refusal, after which nothing is written. */
export function applyOnSiteMove(fromJobId: string, toJobId: string): Promise<OnSiteMovePlan> {
  return call(fromJobId, toJobId, false)
}

/**
 * After the move landed: both jobs read again, so the source's page reads empty and the target's reads the moved
 * boxes; the source's photo marks read again too (v2.7329), since its strip keeps its own read and drew the moved
 * photos as still held until a reload; and the target's photos asked to move to its Drive folder as a combine asks
 * (`afterCombineBoxPhotos`). Hands back the photos' sentence, or '' when no file is due. Never throws: a read that
 * fails leaves the last good read, and the page's own refresh reads again.
 */
export async function afterOnSiteMove(fromJobId: string, toJobId: string, role: string | null | undefined): Promise<string> {
  await Promise.allSettled([loadJob(fromJobId, { force: true, quiet: true }), loadJob(toJobId, { force: true, quiet: true }), refreshRefileMarks(fromJobId)])
  return afterCombineBoxPhotos(toJobId, role)
}
