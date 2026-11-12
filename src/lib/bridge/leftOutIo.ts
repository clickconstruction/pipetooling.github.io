import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows } from '../supabasePaging'
import { BRIDGE_LEFT_OUT_SETTING_KEY, defaultLeftOut, isLeftOut, leftOutText, parseLeftOut, type LeftOutRule } from './leftOut'

/**
 * The reads and the save behind what the Bridge leaves out (spike candidate 7, punch list #303; `leftOut.ts` holds
 * the rules). The save is one `app_settings` row. Today the database takes that write from a dev alone; the owner's
 * role needs a key-scoped policy, as the cash keys got in v2.6964. That migration is for the spike's wrap-up.
 */

export type LeftOutName = { id: string; name: string }

export type LeftOutRead = {
  rules: LeftOutRule[]
  /** True when the list was never saved and the default stands in. */
  isDefault: boolean
  /** Every development and customer, by name, for the picker. */
  developments: LeftOutName[]
  customers: LeftOutName[]
}

type NameRow = { id: string; name: string | null; archived_at?: string | null }

const shapeNames = (rows: NameRow[]): LeftOutName[] =>
  rows
    .filter((r) => !r.archived_at && (r.name ?? '').trim() !== '')
    .map((r) => ({ id: r.id, name: (r.name ?? '').trim() }))
    .sort((a, b) => a.name.localeCompare(b.name))

async function readDevelopments(db: SupabaseClient<Database>): Promise<LeftOutName[]> {
  const rows = await fetchAllRows(async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('developments').select('id, name, archived_at').order('id').range(from, to), 'bridge left out developments')) as NameRow[] | null, error: null }), 'bridge left out developments')
  return shapeNames(rows)
}

async function readCustomers(db: SupabaseClient<Database>): Promise<LeftOutName[]> {
  const rows = await fetchAllRows(async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('customers').select('id, name, archived_at').order('id').range(from, to), 'bridge left out customers')) as NameRow[] | null, error: null }), 'bridge left out customers')
  return shapeNames(rows)
}

export async function loadLeftOut(db: SupabaseClient<Database>): Promise<LeftOutRead> {
  const [row, developments, customers] = await Promise.all([
    withSupabaseRetry(async () => db.from('app_settings').select('value_text').eq('key', BRIDGE_LEFT_OUT_SETTING_KEY).maybeSingle(), 'bridge left out') as Promise<{ value_text: string | null } | null>,
    readDevelopments(db),
    readCustomers(db),
  ])
  const saved = parseLeftOut(row?.value_text)
  return { rules: saved ?? defaultLeftOut(developments), isDefault: saved == null, developments, customers }
}

export async function saveLeftOut(db: SupabaseClient<Database>, rules: ReadonlyArray<LeftOutRule>): Promise<void> {
  await withSupabaseRetry(async () => db.from('app_settings').upsert({ key: BRIDGE_LEFT_OUT_SETTING_KEY, value_text: leftOutText(rules) }, { onConflict: 'key' }), 'save bridge left out')
}

type JobRow = { id: string; development_id: string | null; customer_id: string | null; gc_customer_id: string | null; job_address: string | null }

/** The ids of every job a rule names. No rule, no read. */
export async function loadLeftOutJobIds(db: SupabaseClient<Database>, rules: ReadonlyArray<LeftOutRule>): Promise<Set<string>> {
  if (rules.length === 0) return new Set()
  const rows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select('id, development_id, customer_id, gc_customer_id, job_address').order('id').range(from, to), 'bridge left out jobs')) as JobRow[] | null,
      error: null,
    }),
    'bridge left out jobs',
  )
  const out = new Set<string>()
  for (const j of rows) if (isLeftOut({ developmentId: j.development_id, customerId: j.customer_id, gcCustomerId: j.gc_customer_id, address: j.job_address }, rules)) out.add(j.id)
  return out
}
