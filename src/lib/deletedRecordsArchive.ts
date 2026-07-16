import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

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
}

/** Envelope returned by restore_deleted_records (dry-run and real runs share the shape). */
export type RestoreDeletedRecordsResult = {
  ok: boolean
  /** Present on ok:false — 'forbidden' | 'not_found' | 'blocked' | a SQLSTATE. */
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
 */
export async function restoreDeletedRecords(groupKey: string, dryRun: boolean): Promise<RestoreDeletedRecordsResult> {
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
