import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { RESTORE_BUNDLE_FUNCTION, RESTORE_TEST_PERSON_FUNCTION, type RestoreFunctionName } from './deletedRecordsRestoreDoor'

/** One restorable bundle in deleted_records_archive (a deleted job/bid and everything that went with it). */
export type DeletedRecordBundle = {
  group_key: string
  /** 'job' | 'bid' | 'partial' | the table name of whatever headed the bundle. */
  kind: string
  label: string
  row_count: number
  tables: string[]
  deleted_by: string | null
  deleted_by_name: string | null
  deleted_at: string
  /** { table_name: rows } — absent until the digest migration is applied; fall back to `tables`. */
  table_counts?: Record<string, number> | null
  /** Up to 5 trimmed rows (money tables first, head row excluded); absent pre-migration. */
  preview_items?: { table_name: string; fields: Record<string, unknown> }[] | null
  /** Triage digest (v2.1566 migration) — all absent until it is applied. */
  money_total?: number | null
  head_created_at?: string | null
  owner_user_id?: string | null
  owner_name?: string | null
}

/** Envelope returned by restore_deleted_records and restore_deleted_test_person (dry-run and real runs share the shape). */
export type RestoreDeletedRecordsResult = {
  ok: boolean
  /** Present on ok:false — 'not_authenticated' | 'forbidden' | 'not_found' | 'not_test' | 'blocked' | a SQLSTATE. */
  code?: string
  error?: string
  dry_run?: boolean
  group_key?: string
  /** { table_name: rows_inserted } */
  inserted?: Record<string, number>
  total?: number
  /** Non-fatal notes, e.g. a nullable reference cleared because its target is gone. */
  warnings?: string[]
  /** Reasons the bundle cannot be restored at all (nothing was committed). */
  blockers?: string[]
}

/** One archived row inside a bundle — row_data is to_jsonb(OLD), the complete deleted row. */
export type DeletedRecordRow = {
  id: string
  table_name: string
  record_id: string | null
  row_data: Record<string, unknown>
  deleted_at: string
}

/**
 * Dev-only: the still-restorable rows of one bundle, for the "What's inside"
 * view. Reads the archive table directly — its RLS policy is dev-only SELECT,
 * so non-devs get an empty list, same as the bundle RPC.
 */
export async function listDeletedRecordRows(groupKey: string): Promise<DeletedRecordRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      supabase
        .from('deleted_records_archive')
        .select('id, table_name, record_id, row_data, deleted_at')
        .eq('group_key', groupKey)
        .is('restored_at', null)
        .order('table_name')
        .order('deleted_at'),
    'list deleted record rows',
  )
  return (data ?? []) as DeletedRecordRow[]
}

/** Dev-only: restorable bundles, newest first. Non-devs get an empty list (enforced in the RPC). */
export async function listDeletedRecords(limit = 50): Promise<DeletedRecordBundle[]> {
  const data = await withSupabaseRetry(
    async () => supabase.schema('public').rpc('list_deleted_records', { p_limit: limit }),
    'list deleted records',
  )
  return (data ?? []) as DeletedRecordBundle[]
}

/**
 * Dev-only: put a whole deleted bundle back. All-or-nothing.
 * Pass dryRun=true to preview real per-table counts, warnings and blockers without committing.
 *
 * `fn` is the function the bundle goes back through (`restoreFunctionFor`). A deleted test person goes through
 * `restore_deleted_test_person` (punch list #443, row 12), which answers in the same shape. It is not in the
 * generated types until the types PR after the push, so it is called by name, as the other take-backs call theirs.
 * Its real run is sent once: a second send after a lost answer would read as *no copy was kept*.
 */
export async function restoreDeletedRecords(
  groupKey: string,
  dryRun: boolean,
  fn: RestoreFunctionName = RESTORE_BUNDLE_FUNCTION,
): Promise<RestoreDeletedRecordsResult> {
  if (fn === RESTORE_TEST_PERSON_FUNCTION) {
    // The name is written out here, not read from the constant: check:calls-ahead finds a call by its literal name,
    // and it is what holds the deploy until the migration that makes this function is pushed.
    const answer = await withSupabaseRetry(
      async () => supabase.rpc('restore_deleted_test_person' as never, { p_group_key: groupKey, p_dry_run: dryRun } as never),
      dryRun ? 'preview putting the test person back' : 'put the test person back',
      dryRun ? {} : { maxRetries: 0 },
    )
    return (answer ?? { ok: false, error: 'No response from restore.' }) as unknown as RestoreDeletedRecordsResult
  }
  const data = await withSupabaseRetry(
    async () =>
      supabase.schema('public').rpc('restore_deleted_records', {
        p_group_key: groupKey,
        p_dry_run: dryRun,
      }),
    dryRun ? 'preview restore of deleted records' : 'restore deleted records',
  )
  return (data ?? { ok: false, error: 'No response from restore.' }) as unknown as RestoreDeletedRecordsResult
}
