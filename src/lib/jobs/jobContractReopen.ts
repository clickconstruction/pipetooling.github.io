/**
 * Edit & re-send while unopened (Signing it on paper PR 6, v2.3647). A sent agreement the
 * customer has not opened goes back to a draft **in place** — same row, same signing link,
 * revision + 1 — so a typo caught an hour later no longer means void-and-revise and a voided
 * row in the history (2026-09-03: three of them on one job in one day). Once they have opened
 * it, what they read stays on the record and Void & redo is the only way; a page handed over
 * on paper cannot be edited out of their hands either. Pure rules first; one guarded write.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { jobContractSentChannel } from './jobContractHandoff'
import type { JobContractRow } from './jobContractLifecycle'

type ReopenRowLike = Pick<JobContractRow, 'status' | 'voided_at' | 'first_viewed_at' | 'view_count' | 'revision'> & { sent_channel?: string | null }

/** Why Edit & re-send is not offered, or null when it is. */
export function reopenBlocker(row: ReopenRowLike | null): string | null {
  if (!row) return 'Nothing has been sent yet.'
  if (row.voided_at || row.status === 'voided') return 'This agreement was voided.'
  if (row.status === 'signed') return 'This agreement is signed.'
  if (row.status !== 'sent') return 'This agreement is still a draft — just edit it.'
  if (row.first_viewed_at || (row.view_count ?? 0) > 0) return 'They have opened it — what they read stays on the record. Use Void & redo.'
  if (jobContractSentChannel(row) === 'handed') return 'The page is already in their hands — Void & redo if it has to change.'
  return null
}

/** What the customer may still be holding — said before the office edits. */
export function reopenNote(row: ReopenRowLike): string {
  const next = row.revision + 1
  return jobContractSentChannel(row) === 'pdf_email'
    ? `They have revision ${row.revision} as a PDF in their inbox and have not opened the link. The one you send next is marked revision ${next} — file only a signed revision ${next}.`
    : `They have not opened it. It unlocks here as revision ${next}; the same link carries it when you send again, and shows nothing until you do.`
}

/** The write itself: back to a draft, one revision on, no reminder waiting. History (sent_at, send_count, the channel) stays. */
export function reopenPatch(row: Pick<JobContractRow, 'revision'>) {
  return { status: 'draft' as const, revision: row.revision + 1, next_reminder_at: null }
}

export type ReopenResult = { ok: true; row: JobContractRow } | { ok: false; reason: 'opened' | 'blocked' | 'error'; message: string }

export async function reopenUnopenedJobContract(input: { row: JobContractRow; authUserId: string | null }): Promise<ReopenResult> {
  const blocker = reopenBlocker(input.row)
  if (blocker) return { ok: false, reason: 'blocked', message: blocker }
  try {
    // Guarded on the row still being sent AND still unopened: a customer who opens the link
    // between our read and this write wins, and the office is told.
    const { data, error } = await supabase
      .from('job_contracts')
      .update(reopenPatch(input.row))
      .eq('id', input.row.id)
      .eq('status', 'sent')
      .is('first_viewed_at', null)
      .select('*')
    if (error) return { ok: false, reason: 'error', message: error.message }
    const row = ((data ?? []) as JobContractRow[])[0]
    if (!row) return { ok: false, reason: 'opened', message: 'They opened it just now — what they read stays on the record. Use Void & redo.' }
    // Fail-soft: the event type lands with the migration; the revision bump is the record until then.
    await withSupabaseRetry(
      () => supabase.from('job_contract_events').insert({ contract_id: row.id, event_type: 'reopened', metadata: { from_revision: input.row.revision, to_revision: row.revision, channel: jobContractSentChannel(input.row) }, actor_user_id: input.authUserId }),
      'log contract reopened',
    ).catch(() => undefined)
    return { ok: true, row }
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Could not unlock the agreement.' }
  }
}
