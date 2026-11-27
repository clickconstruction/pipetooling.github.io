/**
 * A Build job's wait, read and written (punch list #192, write A, v2.8723). The read is the table's own, under the
 * reader's rights: whoever reads a job reads its wait. A read the database refuses answers null, never a throw, so a
 * screen draws as it did before and offers no press to name a wait. The two writes go through `set_job_build_wait`,
 * which answers in words when it refuses, and those words are what the person reads.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { checkSupabaseError } from '../../../utils/errorHandling'
import { buildWaitReasonOf, type BuildWait, type BuildWaitReason } from './buildWaits'

export type BuildWaitsIo = {
  /** Every wait that is not lifted, or null when the read was refused. */
  loadOpen: () => Promise<BuildWait[] | null>
  mark: (jobId: string, reason: BuildWaitReason, note: string) => Promise<void>
  lift: (jobId: string) => Promise<void>
}

/** Fired when a wait is marked or lifted, so the job's card and the job window read again. */
export const BUILD_WAITS_CHANGED_EVENT = 'build-waits-changed'

type WaitRow = { job_id: string; reason: string; note: string | null; since_at: string; marked_by_name: string | null }

// The table and its function are not in the generated types until the types PR, so the client is cast once here.
const db = supabase as unknown as SupabaseClient

function changed(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(BUILD_WAITS_CHANGED_EVENT))
}

/** A row as the screens read it. A reason this build does not know is left out, not guessed at. */
export function buildWaitFromRow(r: WaitRow): BuildWait | null {
  const reason = buildWaitReasonOf(r.reason)
  if (!reason || !r.job_id || !r.since_at) return null
  return { jobId: r.job_id, reason, note: (r.note ?? '').trim(), sinceYmd: calendarYmdInAppTzFromIso(r.since_at), markedByName: (r.marked_by_name ?? '').trim() }
}

export function buildWaitsIoOver(client: SupabaseClient): BuildWaitsIo {
  const set = async (args: { p_job_id: string; p_waits: boolean; p_reason?: string; p_note?: string }, what: string) => {
    const result = await client.rpc('set_job_build_wait', args)
    checkSupabaseError(result, what)
    const answer = (result.data ?? {}) as { ok?: unknown; error?: unknown }
    if (answer.ok !== true) throw new Error(typeof answer.error === 'string' && answer.error ? answer.error : 'The job was not changed. Try again in a minute.')
    changed()
  }
  return {
    async loadOpen() {
      try {
        const { data, error } = await client.from('job_build_waits').select('job_id, reason, note, since_at, marked_by_name').is('lifted_at', null).order('since_at', { ascending: false }).limit(500)
        if (error) return null
        return ((data ?? []) as WaitRow[]).map(buildWaitFromRow).filter((w): w is BuildWait => w !== null)
      } catch {
        return null
      }
    },
    mark: (jobId, reason, note) => set({ p_job_id: jobId, p_waits: true, p_reason: reason, p_note: note.trim() }, 'mark the job waiting'),
    lift: (jobId) => set({ p_job_id: jobId, p_waits: false }, 'lift the wait'),
  }
}

export const buildWaitsIo: BuildWaitsIo = buildWaitsIoOver(db)
