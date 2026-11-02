/**
 * The index check's io (punch list #240, v2.6364): every file in the Shared Drive (the sweep's own lister from the dawn
 * of the drive, folders left out, capped) against every `file_index` row (read in pages of a thousand, since PostgREST
 * answers at most a thousand rows a call), reconciled by `fileIndexCheckKernel.ts`. A read of Drive and of our table,
 * nothing written; under `drive-link`'s `index_check`.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { filesChangedSince, type IndexContext } from './fileIndex.ts'
import { CHECK_FILES_MAX, reconcile, type CheckRow, type IndexCheck } from './fileIndexCheckKernel.ts'

const DAWN = '1970-01-01T00:00:00.000Z'

/** Every row, a thousand at a time. */
export async function allIndexRows(admin: SupabaseClient): Promise<CheckRow[]> {
  const out: CheckRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('file_index').select('drive_file_id, modified_at, text_why, text_source').order('drive_file_id').range(from, from + 999)
    if (error) throw new Error(`file_index did not read: ${error.message}`)
    const rows = (data ?? []) as CheckRow[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

export async function indexCheck(ctx: IndexContext, max = CHECK_FILES_MAX): Promise<IndexCheck> {
  const cap = Math.min(CHECK_FILES_MAX, Math.max(1, max))
  const [listed, rows] = await Promise.all([filesChangedSince(ctx, DAWN, cap, true), allIndexRows(ctx.admin)])
  return reconcile(listed.files, rows, listed.more)
}
