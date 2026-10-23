/**
 * Quickfill → Percent complete, the writes (v2.5764).
 *
 * A save is the Pipeline's % done box's own path (`useJobsStagesMutations.updateJobPctComplete`):
 * a `jobs_ledger_thread_notes` row whose body starts "N% complete" (so Job activity, the
 * day-delta layer and the baseline parser read it as every other percent change), then
 * `jobs_ledger.pct_complete`. The note is best-effort there and here: a notes hiccup must
 * not block the percent.
 *
 * A dismissal is one `quickfill_item_snoozes` row per (kind, job), shared by the office,
 * `until` a week on. Before the table's migration lands the read fails soft (no snoozes)
 * and a dismissal says so instead of pretending.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { PERCENT_COMPLETE_SNOOZE_KIND, snoozeHolds, snoozeUntilIso } from './percentComplete'

// The snoozes table lands with this version's migration; the generated types follow in the
// next types PR, so the client reads it untyped until then (the legal firms block's pattern).
const db = supabase as unknown as SupabaseClient

export type QuickfillSnoozeRow = { kind: string; item_key: string; until: string; snoozed_by: string | null }

/** The office's live dismissals for one kind, as `item_key → until`. `available` is false before the table exists. */
export async function fetchQuickfillSnoozes(kind: string, nowIso: string): Promise<{ byKey: Map<string, string>; available: boolean }> {
  const byKey = new Map<string, string>()
  const { data, error } = await db.from('quickfill_item_snoozes').select('kind, item_key, until, snoozed_by').eq('kind', kind).gt('until', nowIso)
  if (error) return { byKey, available: false }
  for (const r of (data ?? []) as QuickfillSnoozeRow[]) if (snoozeHolds(r.until, nowIso)) byKey.set(r.item_key, r.until)
  return { byKey, available: true }
}

/** Dismiss one item for a week: an upsert on (kind, item_key). Resolves the `until` written. */
export async function snoozeQuickfillItem(input: { kind?: string; itemKey: string; byUserId: string | null; nowIso?: string }): Promise<string> {
  const until = snoozeUntilIso(input.nowIso ?? new Date().toISOString())
  const { error } = await db
    .from('quickfill_item_snoozes')
    .upsert({ kind: input.kind ?? PERCENT_COMPLETE_SNOOZE_KIND, item_key: input.itemKey, until, snoozed_by: input.byUserId }, { onConflict: 'kind,item_key' })
  if (error) throw new Error(error.message || 'Could not dismiss')
  return until
}

/** Take a dismissal back: the row goes. */
export async function unsnoozeQuickfillItem(input: { kind?: string; itemKey: string }): Promise<void> {
  const { error } = await db.from('quickfill_item_snoozes').delete().eq('kind', input.kind ?? PERCENT_COMPLETE_SNOOZE_KIND).eq('item_key', input.itemKey)
  if (error) throw new Error(error.message || 'Could not take the dismissal back')
}

/**
 * Set a job's % done the way the Pipeline's box does: the activity note first (best-effort),
 * then the column. `noteBody` starts "N% complete" (a null `pct`, the undo of a save on a job
 * that had none, posts the Pipeline's "Cleared % complete" body). Throws with the reason when
 * the percent itself does not land.
 */
export async function saveJobPercentFromQuickfill(input: { jobId: string; pct: number | null; noteBody: string; authUserId: string | null }): Promise<void> {
  if (input.authUserId) {
    try {
      await withSupabaseRetry(
        async () => supabase.from('jobs_ledger_thread_notes').insert({ job_id: input.jobId, author_user_id: input.authUserId!, body: input.noteBody.slice(0, 2000) }),
        'quickfill percent note',
      )
    } catch {
      /* the percent still saves; the thread's realtime/merge paths self-heal */
    }
  }
  const { error } = await supabase.from('jobs_ledger').update({ pct_complete: input.pct }).eq('id', input.jobId)
  if (error) throw new Error(error.message || 'Could not save the % done')
}
