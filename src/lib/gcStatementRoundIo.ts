/**
 * IO for the personal statement rounds (v2.2072): round marks (sent/skipped
 * per week+GC) and the standing sender assignment on customers. Pure logic
 * lives in jobs/gcStatementRounds.ts. All reads fail soft to empty so the
 * client and migration can deploy in either order.
 */

import { supabase } from './supabase'
import type { RoundMarkAction, RoundMarkRow, StatementSendChannel, Temperature } from './jobs/gcStatementRounds'

const MARK_COLUMNS = 'gc_customer_id, week_start, action, acted_by, acted_by_name, acted_at, channel, note, temperature, expected_pay_by'
/** The word's own columns (migration 20260928032427) — read and written only once the database has them. */
export const MARK_WORD_COLUMNS = ['word_from_user_id', 'word_from_name', 'word_heard_via', 'word_entered_by', 'word_entered_by_name', 'word_at'] as const
const MARK_COLUMNS_WITH_WORD = `${MARK_COLUMNS}, ${MARK_WORD_COLUMNS.join(', ')}`

/** null = not asked yet. The client and the migration can land in either order: a read that fails on the new columns falls back to the old list. */
let wordColumnsAvailable: boolean | null = null

/** A PostgREST error that means "that column is not there" (42703 from Postgres, PGRST204 from the schema cache). */
export function isMissingColumnError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? '')
}

/** A mark's row without the word's columns — what a database from before the migration accepts. */
export function withoutWordColumns<T extends Record<string, unknown>>(row: T): Omit<T, (typeof MARK_WORD_COLUMNS)[number]> {
  const out: Record<string, unknown> = { ...row }
  for (const c of MARK_WORD_COLUMNS) delete out[c]
  return out as Omit<T, (typeof MARK_WORD_COLUMNS)[number]>
}

async function selectMarks(run: (columns: string) => PromiseLike<{ data: unknown; error: { code?: string | null; message?: string | null } | null }>): Promise<RoundMarkRow[]> {
  if (wordColumnsAvailable !== false) {
    const withWord = await run(MARK_COLUMNS_WITH_WORD)
    if (!withWord.error) {
      wordColumnsAvailable = true
      return (withWord.data ?? []) as RoundMarkRow[]
    }
    if (!isMissingColumnError(withWord.error)) return []
    wordColumnsAvailable = false
  }
  const { data, error } = await run(MARK_COLUMNS)
  if (error) return []
  return (data ?? []) as RoundMarkRow[]
}

export async function listGcStatementRoundMarks(weekStartYmd: string): Promise<RoundMarkRow[]> {
  return selectMarks((columns) => supabase.from('gc_statement_round_marks').select(columns).eq('week_start', weekStartYmd))
}

/** Marks for every week from `sinceWeekStartYmd` on (v2.2813): the temperature board's trend + the header pills. */
export async function listGcStatementRoundMarksSince(sinceWeekStartYmd: string): Promise<RoundMarkRow[]> {
  return selectMarks((columns) => supabase.from('gc_statement_round_marks').select(columns).gte('week_start', sinceWeekStartYmd))
}

/**
 * Send history for one GC (v2.2761): every week's sent and contacted mark,
 * newest first — the posterity view behind the last-sent pill. Skips are left out.
 */
export async function listGcStatementSentHistory(gcCustomerId: string, limit = 60): Promise<RoundMarkRow[]> {
  return selectMarks((columns) =>
    supabase
      .from('gc_statement_round_marks')
      .select(columns)
      .eq('gc_customer_id', gcCustomerId)
      .in('action', ['sent', 'contacted'])
      .order('acted_at', { ascending: false })
      .limit(limit),
  )
}

export async function upsertGcStatementRoundMark(row: {
  week_start: string
  gc_customer_id: string
  action: RoundMarkAction
  acted_by: string
  acted_by_name: string
  /** v2.2761 — how it went out; a skip carries no channel. */
  channel?: StatementSendChannel | string | null
  /** v2.2761 — optional note, trimmed; empty stores NULL. On contacted: the temperature answer. */
  note?: string | null
  /** v2.2813 — the temperature read (required by the form on contacted). */
  temperature?: Temperature | string | null
  /** v2.2813 — YYYY-MM-DD when they said they'd pay. */
  expected_pay_by?: string | null
  /** The day the mark stands on; omitted or null = now. A word written over a sent mark keeps the statement's day (`mergeRoundMarkWrite`). */
  acted_at?: string | null
  /** The word's source, how it was heard, who typed it and when — dropped when the database has no such columns yet. */
  word_from_user_id?: string | null
  word_from_name?: string | null
  word_heard_via?: string | null
  word_entered_by?: string | null
  word_entered_by_name?: string | null
  word_at?: string | null
}): Promise<void> {
  const note = row.note?.trim() || null
  const full = { ...row, channel: row.channel ?? null, note, temperature: row.temperature ?? null, expected_pay_by: row.expected_pay_by || null, acted_at: row.acted_at || new Date().toISOString() }
  const write = (payload: Record<string, unknown>) => supabase.from('gc_statement_round_marks').upsert(payload as never, { onConflict: 'week_start,gc_customer_id' })
  if (wordColumnsAvailable !== false) {
    const { error } = await write(full)
    if (!error) return
    if (!isMissingColumnError(error)) throw new Error(error.message)
    wordColumnsAvailable = false
  }
  const { error } = await write(withoutWordColumns(full))
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
