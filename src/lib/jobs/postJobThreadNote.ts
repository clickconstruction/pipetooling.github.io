import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

/**
 * Plain thread-note insert for hosts without the useJobThreadNotes hook
 * (e.g. JobFormModal's "% done" auto-note). No optimistic UI — realtime and
 * the next stats fetch pick it up. Returns false instead of throwing so
 * callers can treat the note as best-effort.
 */
export async function postJobThreadNoteBody(jobId: string, authorUserId: string, body: string): Promise<boolean> {
  const trimmed = body.trim()
  if (!jobId || !authorUserId || !trimmed) return false
  try {
    await withSupabaseRetry(
      async () =>
        supabase.from('jobs_ledger_thread_notes').insert({
          job_id: jobId,
          author_user_id: authorUserId,
          body: trimmed,
        }),
      'post job thread note',
    )
    return true
  } catch {
    return false
  }
}
