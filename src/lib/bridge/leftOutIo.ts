import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows } from '../supabasePaging'
import { BRIDGE_LEFT_OUT_SETTING_KEY, isLeftOut, leftOutText, parseLeftOut, type LeftOutRule } from './leftOut'

/**
 * The reads and the save behind what the Bridge leaves out (punch list #334, PR 2; `leftOut.ts` holds the rules).
 * The save is one `app_settings` row. A dev and the owner's role may write it, by the key-scoped policies of
 * `20261113050000_bridge_left_out_key_owner.sql`, the shape the cash keys got in v2.6964.
 */

export type LeftOutName = { id: string; name: string }

export type LeftOutRead = {
  rules: LeftOutRule[]
  /** True when the list was never saved: it is empty and nothing is left out. */
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

/** The saved row's text, or null when there is no row. */
async function readLeftOutText(db: SupabaseClient<Database>): Promise<string | null> {
  const row = (await withSupabaseRetry(async () => db.from('app_settings').select('value_text').eq('key', BRIDGE_LEFT_OUT_SETTING_KEY).maybeSingle(), 'bridge left out')) as { value_text: string | null } | null
  return row?.value_text ?? null
}

export async function loadLeftOut(db: SupabaseClient<Database>): Promise<LeftOutRead> {
  const [text, developments, customers] = await Promise.all([readLeftOutText(db), readDevelopments(db), readCustomers(db)])
  const saved = parseLeftOut(text)
  return { rules: saved ?? [], isDefault: saved == null, developments, customers }
}

/** The saved list alone, for a reader that draws no picker. No row, an empty row and broken text are an empty list, as on the page. */
export async function loadLeftOutRules(db: SupabaseClient<Database>): Promise<LeftOutRule[]> {
  return parseLeftOut(await readLeftOutText(db)) ?? []
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

/** The list as a reader with no page takes it: the rules, and the ids of the jobs they name. */
export type LeftOutScope = {
  rules: LeftOutRule[]
  jobIds: ReadonlySet<string>
  /** Set when a read failed. What was not read leaves nothing out, as on the page, and the reader says so. */
  error: unknown
}

/**
 * The list and its jobs in the page's two steps, for the Monday email (`sheetReads.ts`). It never throws. A list that
 * cannot be read is an empty list. A list that is read while its jobs are not keeps its rules for the bids and the
 * estimates and names no job, which is what the page does with the same two failures.
 */
export async function loadLeftOutScope(db: SupabaseClient<Database>): Promise<LeftOutScope> {
  let rules: LeftOutRule[] = []
  try {
    rules = await loadLeftOutRules(db)
    return { rules, jobIds: await loadLeftOutJobIds(db, rules), error: null }
  } catch (error) {
    return { rules, jobIds: new Set(), error }
  }
}
