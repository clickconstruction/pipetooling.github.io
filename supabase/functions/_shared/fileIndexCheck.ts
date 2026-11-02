/**
 * The index check's io (punch list #240, v2.6364): every file in the Shared Drive (the sweep's own lister from the dawn
 * of the drive, folders left out, capped) against every `file_index` row (read in pages of a thousand, since PostgREST
 * answers at most a thousand rows a call whatever `.limit()` asks, and nothing says so), reconciled by
 * `fileIndexCheckKernel.ts`. A read of Drive and of our table, nothing written; under `drive-link`'s `index_check`.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { filesChangedSince, type IndexContext } from './fileIndex.ts'
import { CHECK_FILES_MAX, checkSample, reconcile, type CheckRow, type IndexCheck } from './fileIndexCheckKernel.ts'

const DAWN = '1970-01-01T00:00:00.000Z'
const ROW_PAGE = 1000

/** Every row, a page at a time until a short page, in a total order so no row is read twice or missed. */
export async function allIndexRows(admin: SupabaseClient): Promise<CheckRow[]> {
  const out: CheckRow[] = []
  for (let from = 0; ; from += ROW_PAGE) {
    const { data, error } = await admin.from('file_index').select('drive_file_id, modified_at, text_why, text_source, jobs_ledger_id, bid_id').order('drive_file_id').range(from, from + ROW_PAGE - 1)
    if (error) throw new Error(`file_index did not read: ${error.message}`)
    const rows = (data ?? []) as CheckRow[]
    out.push(...rows)
    if (rows.length < ROW_PAGE) break
  }
  return out
}

export async function indexCheck(ctx: IndexContext, opts: { max?: number | null; sample?: number | null } = {}): Promise<IndexCheck> {
  const cap = Math.min(CHECK_FILES_MAX, Math.max(1, opts.max ?? CHECK_FILES_MAX))
  const [listed, rows] = await Promise.all([filesChangedSince(ctx, DAWN, cap, true), allIndexRows(ctx.admin)])
  return reconcile(listed.files, rows, listed.more, checkSample(opts.sample))
}
