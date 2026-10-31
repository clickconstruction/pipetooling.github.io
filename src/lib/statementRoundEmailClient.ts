/**
 * IO for the `statement_round` stream (v2.2771): the office week RPC, the
 * statement-round-email-dispatch edge function (preview / test send, caller
 * JWT), and statement_round_email_requests (scheduled chains are plain
 * RLS-gated rows; the pg_cron dispatcher sends). Pure logic lives in
 * statementRoundEmail.ts.
 */
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { isOfficeWeekPayload, type OfficeWeekPayload } from './statementWeekEmail'
import type { StatementRoundChainInsert, StatementRoundRequestRow } from './statementRoundEmail'

/**
 * The office's statement week (punch list #49) — every GC over the line,
 * whoever its account man is — from get_my_statement_week. Null on a refusal
 * or a lost signal so the Needs You row stays quiet.
 */
export async function fetchMyStatementWeek(): Promise<OfficeWeekPayload | null> {
  try {
    const data = await withSupabaseRetry(async () => await supabase.rpc('get_my_statement_week'), 'my statement week')
    return isOfficeWeekPayload(data) ? data : null
  } catch {
    return null
  }
}

type FnResult = { data: unknown; error: { message?: string } | null }

function fnError(r: FnResult, fallback: string): string | null {
  if (r.error) return r.error.message || fallback
  const d = r.data as { error?: string } | null
  if (d && typeof d.error === 'string' && d.error) return d.error
  return null
}

/** mode 'preview' — the rendered email HTML for the CALLER's own round, or a colleague's when `recipientUserId` is given (v2.2781). */
export async function fetchStatementRoundEmailPreview(recipientUserId?: string): Promise<string> {
  const r = (await supabase.functions.invoke('statement-round-email-dispatch', {
    body: { mode: 'preview', ...(recipientUserId ? { recipient_user_id: recipientUserId } : {}) },
  })) as FnResult
  const err = fnError(r, 'Preview failed')
  if (err) throw new Error(err)
  const html = (r.data as { html?: string } | null)?.html
  if (!html) throw new Error('Preview returned no HTML')
  return html
}

/** mode 'test_send' — the caller's own round to their own address, [TEST]-prefixed. */
export async function sendStatementRoundEmailTest(): Promise<void> {
  const r = (await supabase.functions.invoke('statement-round-email-dispatch', { body: { mode: 'test_send' } })) as FnResult
  const err = fnError(r, 'Test send failed')
  if (err) throw new Error(err)
}

/** Pending (unsent) requests the caller may see: theirs, addressed to them, or all for devs. */
export async function listPendingStatementRoundRequests(): Promise<StatementRoundRequestRow[]> {
  const { data, error } = await supabase
    .from('statement_round_email_requests')
    .select('id, requested_by, recipient_user_id, send_at, repeat_weekly')
    .is('sent_at', null)
    .order('send_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as StatementRoundRequestRow[]
}

/** Apply a chain edit plan: inserts first, then cancels (a failed insert leaves the old chains in place). */
export async function applyStatementRoundChainPlan(plan: { inserts: StatementRoundChainInsert[]; cancelIds: string[] }): Promise<void> {
  if (plan.inserts.length > 0) {
    const { error } = await supabase.from('statement_round_email_requests').insert(plan.inserts)
    if (error) throw new Error(error.message)
  }
  if (plan.cancelIds.length > 0) {
    const { error } = await supabase.from('statement_round_email_requests').delete().in('id', plan.cancelIds).is('sent_at', null)
    if (error) throw new Error(error.message)
  }
}
