/**
 * GC difficulty rating (punch list #357, PR 5): the reads and writes of the ask at the end of a job. The open asks
 * come from `gc_difficulty_open_asks()`, which reads as the person signed in; an answer or a put-away is one row of
 * `gc_difficulty_asks` per job. The names are read by name until the types are regenerated after the push, and a
 * database that does not have them yet reads as no asks.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { jobLabelOf } from '../people/superintendentScores'
import type { GcDifficultyOpenAsk } from './gcDifficultyAsk'

export const GC_DIFFICULTY_ASKS_CHANGED_EVENT = 'gc-difficulty-asks-changed'

type RawAsk = { job_id: string; customer_id: string; customer_name: string | null; hcp_number: string | null; click_number: string | null; job_name: string | null; closed_at: string }

export interface GcDifficultyAskIo {
  loadOpen(): Promise<GcDifficultyOpenAsk[]>
  /** The rating that answered these asks. */
  answer(asks: readonly Pick<GcDifficultyOpenAsk, 'jobId' | 'customerId'>[], ratingId: string): Promise<void>
  /** *Not now*: put away for good, for these jobs. */
  dismiss(asks: readonly Pick<GcDifficultyOpenAsk, 'jobId' | 'customerId'>[]): Promise<void>
}

const TABLE = 'gc_difficulty_asks' as never

async function settle(rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return
  // A job already settled (a second tab, a second press) keeps its first answer.
  const result = (await supabase.from(TABLE).upsert(rows as never, { onConflict: 'job_id,asked_user_id', ignoreDuplicates: true } as never)) as unknown as { error: unknown }
  checkSupabaseError(result as never, 'record the answer')
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GC_DIFFICULTY_ASKS_CHANGED_EVENT))
}

export function supabaseGcDifficultyAskIo(): GcDifficultyAskIo {
  return {
    async loadOpen() {
      const { data, error } = (await supabase.rpc('gc_difficulty_open_asks' as never)) as unknown as { data: RawAsk[] | null; error: unknown }
      if (error) throw error
      return (data ?? []).map((r) => ({ jobId: r.job_id, customerId: r.customer_id, customerName: r.customer_name ?? '', jobLabel: jobLabelOf(r), closedAt: r.closed_at }))
    },
    answer: (asks, ratingId) => settle(asks.map((a) => ({ job_id: a.jobId, customer_id: a.customerId, answered_rating_id: ratingId }))),
    dismiss: (asks) => {
      const at = new Date().toISOString()
      return settle(asks.map((a) => ({ job_id: a.jobId, customer_id: a.customerId, dismissed_at: at })))
    },
  }
}
