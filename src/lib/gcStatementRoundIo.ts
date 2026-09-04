/**
 * IO for the personal statement rounds (v2.2072): round marks (sent/skipped
 * per week+GC) and the standing sender assignment on customers. Pure logic
 * lives in jobs/gcStatementRounds.ts. All reads fail soft to empty so the
 * client and migration can deploy in either order.
 */

import { supabase } from './supabase'
import type { RoundMarkRow, StatementSendChannel } from './jobs/gcStatementRounds'

const MARK_COLUMNS = 'gc_customer_id, week_start, action, acted_by, acted_by_name, acted_at, channel, note'

export async function listGcStatementRoundMarks(weekStartYmd: string): Promise<RoundMarkRow[]> {
  const { data, error } = await supabase.from('gc_statement_round_marks').select(MARK_COLUMNS).eq('week_start', weekStartYmd)
  if (error) return []
  return (data ?? []) as RoundMarkRow[]
}

/**
 * Send history for one GC (v2.2761): every week's sent mark, newest first —
 * the posterity view behind the last-sent pill. Skips are left out.
 */
export async function listGcStatementSentHistory(gcCustomerId: string, limit = 60): Promise<RoundMarkRow[]> {
  const { data, error } = await supabase
    .from('gc_statement_round_marks')
    .select(MARK_COLUMNS)
    .eq('gc_customer_id', gcCustomerId)
    .eq('action', 'sent')
    .order('acted_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as RoundMarkRow[]
}

export async function upsertGcStatementRoundMark(row: {
  week_start: string
  gc_customer_id: string
  action: 'sent' | 'skipped'
  acted_by: string
  acted_by_name: string
  /** v2.2761 — how it went out; a skip carries no channel. */
  channel?: StatementSendChannel | null
  /** v2.2761 — optional note, trimmed; empty stores NULL. */
  note?: string | null
}): Promise<void> {
  const note = row.note?.trim() || null
  const { error } = await supabase
    .from('gc_statement_round_marks')
    .upsert({ ...row, channel: row.channel ?? null, note, acted_at: new Date().toISOString() }, { onConflict: 'week_start,gc_customer_id' })
  if (error) throw new Error(error.message)
}

/** Undo a mis-click: clear the week's mark so the GC re-enters its sender's round. */
export async function deleteGcStatementRoundMark(weekStartYmd: string, gcCustomerId: string): Promise<void> {
  const { error } = await supabase
    .from('gc_statement_round_marks')
    .delete()
    .eq('week_start', weekStartYmd)
    .eq('gc_customer_id', gcCustomerId)
  if (error) throw new Error(error.message)
}

/** Standing sender per GC — customers.statement_sender_user_id, missing/null rows omitted. */
export async function listGcStatementSenders(gcIds: readonly string[]): Promise<Map<string, string>> {
  if (gcIds.length === 0) return new Map()
  const { data, error } = await supabase.from('customers').select('id, statement_sender_user_id').in('id', [...gcIds])
  if (error) return new Map()
  const out = new Map<string, string>()
  for (const r of (data ?? []) as { id: string; statement_sender_user_id: string | null }[]) {
    if (r.statement_sender_user_id) out.set(r.id, r.statement_sender_user_id)
  }
  return out
}

export async function setGcStatementSender(gcCustomerId: string, userId: string | null): Promise<void> {
  const { error } = await supabase.from('customers').update({ statement_sender_user_id: userId }).eq('id', gcCustomerId)
  if (error) throw new Error(error.message)
}
