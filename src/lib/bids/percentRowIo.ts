/**
 * The Percent row on the database: a count row's rule (`bids_count_rows.percent_rule`, migration
 * 20261118220000) and the count row a new Percent row adds. Fail-soft before the push: a write
 * that fails for the column's absence says `missing`, as `rowMarksIo` does for the row's marks.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { isNotThereYetError } from '../gcWordAskIo'
import { BID_ACTIONS, withBidAction } from './bidActionHeader'
import { percentRuleToDb, type PercentRule } from './percentRow'
import type { RowKind } from './rowKinds'

type Client = SupabaseClient<Database>
type CountRowInsert = Database['public']['Tables']['bids_count_rows']['Insert']
type CountRowUpdate = Database['public']['Tables']['bids_count_rows']['Update']

export type PercentRowWrite = { error: string | null; missing: boolean }

/** The payload a new Percent row is inserted with: one row, counted as 1, last on the version. Pure. */
export function percentCountRowPayload(args: { bidId: string; bidVersionId: string | null; name: string; kind: RowKind; rule: PercentRule | null; sequenceOrder: number }): Record<string, unknown> {
  return {
    bid_id: args.bidId,
    bid_version_id: args.bidVersionId,
    fixture: args.name.trim(),
    count: 1,
    unit: 'ea',
    sequence_order: args.sequenceOrder,
    kind: args.kind,
    ...(args.rule ? { percent_rule: percentRuleToDb(args.rule) } : {}),
  }
}

/** Adds the count row a new Percent row is: last on its version, counted as 1. Its price is written after the rows reload. */
export async function insertPercentCountRow(
  supabase: Client,
  args: { bidId: string; bidVersionId: string | null; name: string; kind: RowKind; rule: PercentRule | null },
): Promise<PercentRowWrite & { id: string | null }> {
  const top = await supabase.from('bids_count_rows').select('sequence_order').eq('bid_id', args.bidId).order('sequence_order', { ascending: false }).limit(1)
  if (top.error) return { id: null, error: top.error.message, missing: false }
  const sequenceOrder = (Number(top.data?.[0]?.sequence_order) || 0) + 1
  const payload = percentCountRowPayload({ ...args, sequenceOrder }) as unknown as CountRowInsert
  const { data, error } = await withBidAction(supabase.from('bids_count_rows').insert(payload).select('id'), BID_ACTIONS.percentRow)
  if (error) return { id: null, error: error.message, missing: isNotThereYetError(error) }
  return { id: (data?.[0] as { id?: string } | undefined)?.id ?? null, error: null, missing: false }
}

/** Sets or clears one row's rule. */
export async function savePercentRule(supabase: Client, rowId: string, rule: PercentRule | null): Promise<PercentRowWrite> {
  const payload = { percent_rule: rule ? percentRuleToDb(rule) : null } as unknown as CountRowUpdate
  const { error } = await withBidAction(supabase.from('bids_count_rows').update(payload).eq('id', rowId), BID_ACTIONS.percentRow)
  if (error) return { error: error.message, missing: isNotThereYetError(error) }
  return { error: null, missing: false }
}

/** What a write that met a database without the column says. */
export const PERCENT_RULE_NOT_PUSHED = 'A row cannot keep a percent rule yet. The database update behind it has not been pushed.'
