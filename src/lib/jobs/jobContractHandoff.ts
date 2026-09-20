/**
 * Signing it on paper, PR 2 (v2.3629): recording that the unsigned PDF was handed or mailed.
 * A hand-off counts as sent — the sweep asks whether the customer has been asked — so the draft
 * becomes `sent` with `sent_channel = 'handed'`: no token, no reminders (a reminder emails a
 * signing link this row does not have), and a `sent` event with `channel: 'handed'` so the Day
 * book counts it like any other send. Filing the signed page converts the same row
 * (`fileSignedJobContract`). Pure rules first; one thin write below.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { JobContractRow } from './jobContractLifecycle'

export type JobContractSentChannel = 'link' | 'pdf_email' | 'handed'

/** The row's channel; NULL and anything unknown read as a signing link (every send before v2.3629). */
export function jobContractSentChannel(row: object | null | undefined): JobContractSentChannel {
  // `object`, not a shape: the generated row type does not carry the column until the types are regenerated.
  const c = (row as { sent_channel?: string | null } | null | undefined)?.sent_channel
  return c === 'handed' || c === 'pdf_email' ? c : 'link'
}

/** A sent row the office is waiting to get back on paper — the one a filing converts in place. */
export function isHandedAwaitingPaper(row: { status: string; voided_at?: string | null; sent_channel?: string | null } | null | undefined): boolean {
  return Boolean(row && row.status === 'sent' && !row.voided_at && jobContractSentChannel(row) === 'handed')
}

/**
 * A sent row whose signature is expected back on paper — handed over, or (v2.3631) emailed as a
 * PDF to sign by hand. Filing the signed page converts this row in place: it is the same document.
 */
export function isAwaitingPaperCopy(row: { status: string; voided_at?: string | null; sent_channel?: string | null } | null | undefined): boolean {
  if (!row || row.status !== 'sent' || row.voided_at) return false
  const c = jobContractSentChannel(row)
  return c === 'handed' || c === 'pdf_email'
}

/** Why a hand-off cannot be recorded, or null when it can. */
export function handoffBlocker(row: Pick<JobContractRow, 'status' | 'voided_at' | 'body_html'> | null): string | null {
  if (!row) return 'Save the agreement first.'
  if (row.voided_at || row.status === 'voided') return 'This agreement was voided.'
  if (row.status === 'signed') return 'This agreement is already signed.'
  if (row.status === 'sent') return 'This agreement is already out — file the signed copy when it comes back.'
  if (!(row.body_html ?? '').trim()) return 'Add the terms before handing it over.'
  return null
}

/** The stamp itself — what a hand-off writes onto the draft. */
export function handoffPatch(row: Pick<JobContractRow, 'sent_at' | 'send_count'>, nowIso: string) {
  return {
    status: 'sent' as const,
    sent_channel: 'handed' as const,
    sent_at: row.sent_at ?? nowIso,
    last_sent_at: nowIso,
    send_count: (row.send_count ?? 0) + 1,
    next_reminder_at: null,
  }
}

export async function markJobContractHanded(input: { row: JobContractRow; authUserId: string | null }): Promise<JobContractRow | null> {
  const blocker = handoffBlocker(input.row)
  if (blocker) throw new Error(blocker)
  const patch = handoffPatch(input.row, new Date().toISOString())
  // Guarded to a draft, so a send that won the race is not overwritten.
  const updated = await withSupabaseRetry<JobContractRow>(
    () => supabase.from('job_contracts').update(patch).eq('id', input.row.id).eq('status', 'draft').select('*').single(),
    'record contract hand-off',
  )
  if (updated) {
    await supabase.from('job_contract_events').insert({ contract_id: updated.id, event_type: 'sent', metadata: { channel: 'handed', to: null, revision: updated.revision }, actor_user_id: input.authUserId })
  }
  return updated
}
