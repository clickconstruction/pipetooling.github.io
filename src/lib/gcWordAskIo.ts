/**
 * IO for ask by link (punch list #49, step 7): mint / revoke a link (RPCs),
 * read the week's asks with their answers (RLS, office roles), email the link
 * (edge function, caller JWT), decide answers. Every read and call fails soft
 * with `missing` when the database or the function has not been updated yet,
 * so GC Review can say so instead of breaking.
 */
import { supabase } from './supabase'
import type { GcWordAskAnswerRow, GcWordAskRow } from './jobs/gcWordAskState'

const ASK_SELECT =
  'id, week_start, owner_user_id, owner_name, gc_ids, token, created_by_name, created_at, expires_at, emailed_at, emailed_to, opened_at, answered_at, revoked_at, answers:gc_word_ask_answers(id, ask_id, gc_customer_id, temperature, note, expected_pay_by, no_change, answered_at, status)'

type PgError = { code?: string | null; message?: string | null } | null

/** "There is no such table / function / relationship yet" — the migration has not been pushed. */
export function isNotThereYetError(error: PgError): boolean {
  if (!error) return false
  if (['PGRST202', 'PGRST205', 'PGRST200', '42883', '42P01'].includes(String(error.code ?? ''))) return true
  return /could not find the (function|table|relation)|does not exist|schema cache/i.test(error.message ?? '')
}

export async function listGcWordAsks(weekStartYmd: string): Promise<{ asks: GcWordAskRow[]; missing: boolean }> {
  const { data, error } = await supabase
    .from('gc_word_asks')
    .select(ASK_SELECT)
    .eq('week_start', weekStartYmd)
    .order('created_at', { ascending: true })
  if (error) return { asks: [], missing: isNotThereYetError(error) }
  const rows = (data ?? []) as unknown as Array<Omit<GcWordAskRow, 'answers'> & { answers: GcWordAskAnswerRow[] | null }>
  return { asks: rows.map((r) => ({ ...r, gc_ids: r.gc_ids ?? [], answers: r.answers ?? [] })), missing: false }
}

export type MintGcWordAskResult = { ok: true; askId: string; token: string; expiresAt: string; reused: boolean } | { ok: false; error: string; missing: boolean }

export async function mintGcWordAsk(ownerUserId: string, gcIds: readonly string[], rotate = false): Promise<MintGcWordAskResult> {
  const { data, error } = await supabase.rpc('mint_gc_word_ask', { p_owner_user_id: ownerUserId, p_gc_ids: [...gcIds], p_rotate: rotate })
  if (error) {
    const missing = isNotThereYetError(error)
    return { ok: false, error: missing ? 'Asking by link is not switched on yet — the database update has not been applied.' : error.message || 'Could not make the link.', missing }
  }
  const r = (data ?? {}) as { askId?: string; token?: string; expiresAt?: string; reused?: boolean; error?: string }
  if (r.error || !r.askId || !r.token) return { ok: false, error: r.error || 'Could not make the link.', missing: false }
  return { ok: true, askId: r.askId, token: r.token, expiresAt: r.expiresAt ?? '', reused: r.reused === true }
}

export async function revokeGcWordAsk(askId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('revoke_gc_word_ask', { p_ask_id: askId })
  if (error) return { ok: false, error: error.message }
  const r = (data ?? {}) as { revoked?: boolean; error?: string }
  return r.error ? { ok: false, error: r.error } : { ok: true }
}

/** Emails the account man his link. The function reads his address itself; the client never sends one. */
export async function emailGcWordAsk(askId: string): Promise<{ ok: true; emailedTo: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke('gc-word-ask', { body: { mode: 'email', askId } })
  const d = data as { ok?: boolean; emailedTo?: string; error?: string } | null
  if (d?.error) return { ok: false, error: d.error }
  if (error) {
    const notDeployed = /not found|404|failed to send a request/i.test(error.message ?? '')
    return { ok: false, error: notDeployed ? 'Emailing the link is not switched on yet — copy the link and text it instead.' : error.message || 'The email did not go out.' }
  }
  return d?.ok ? { ok: true, emailedTo: d.emailedTo ?? '' } : { ok: false, error: 'The email did not go out.' }
}

/** The office read these answers: accepted (saved as the week's word) or dismissed (set aside). */
export async function decideGcWordAnswers(answerIds: readonly string[], status: 'accepted' | 'dismissed', me: { id: string; name: string }): Promise<{ ok: boolean; error?: string }> {
  if (answerIds.length === 0) return { ok: true }
  const { error } = await supabase
    .from('gc_word_ask_answers')
    .update({ status, decided_by: me.id, decided_by_name: me.name, decided_at: new Date().toISOString() })
    .in('id', [...answerIds])
  return error ? { ok: false, error: error.message } : { ok: true }
}
