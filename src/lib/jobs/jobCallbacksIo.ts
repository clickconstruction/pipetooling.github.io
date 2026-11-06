/**
 * The Rework pairs' verdicts (punch list #255, v2.6589): read by the first jobs, written one pair at a time through an
 * upsert under the table's own policy (the leader and the office). `job_callbacks` is not in the generated types until
 * the types PR after the push, so the client reads it untyped; a table not there yet reads as none.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { CallbackVerdict, JobCallbackRow } from './jobCallbacks'

export interface JobCallbacksIo {
  forFirstJobs(firstJobIds: readonly string[]): Promise<JobCallbackRow[]>
  setVerdict(firstJobId: string, secondJobId: string, verdict: CallbackVerdict, byName: string): Promise<void>
}

export function supabaseJobCallbacksIo(client: unknown = supabase): JobCallbacksIo {
  const db = client as SupabaseClient
  return {
    async forFirstJobs(firstJobIds) {
      const ids = [...new Set(firstJobIds.filter(Boolean))]
      if (!ids.length) return []
      const out: JobCallbackRow[] = []
      for (let i = 0; i < ids.length; i += 200) {
        const r = await db.from('job_callbacks').select('first_job_id, second_job_id, verdict, decided_by_name, decided_at').in('first_job_id', ids.slice(i, i + 200))
        if (r.error) return out
        out.push(...((r.data ?? []) as JobCallbackRow[]))
      }
      return out
    },
    async setVerdict(firstJobId, secondJobId, verdict, byName) {
      const r = await db.from('job_callbacks').upsert({ first_job_id: firstJobId, second_job_id: secondJobId, verdict, decided_by_name: byName, decided_at: new Date().toISOString() }, { onConflict: 'first_job_id,second_job_id' }).select('first_job_id')
      checkSupabaseError(r, 'record the verdict')
      if (!((r.data ?? []) as unknown[]).length) throw new Error('The verdict was not recorded. The leader and the office press it, and the push that adds it must be on.')
    },
  }
}
