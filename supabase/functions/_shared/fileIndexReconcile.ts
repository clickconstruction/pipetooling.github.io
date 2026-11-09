/**
 * The sweep's reconcile step (punch list #240, v2.6417). The sweep lists by Drive's modified time, and a file moved into
 * the Shared Drive keeps its old one, so the listing never shows it: most of the job rows carried a date older than the
 * drive itself. So each run, once its stamped pass left no files behind, also lists the whole drive (the sweep's own
 * lister from the dawn, as `index_check` does), reads every row's id a thousand at a time (PostgREST answers at most a
 * thousand a call and says nothing) and hands the files with no row to the one pass, newest first, up to the sweep's cap,
 * whatever their date. Its result never reaches the sweep's stamp or cursor: those old dates would move the stamp
 * backwards. It runs last in the sweep, in its own catch, so a heavy PDF that stops the worker or a Drive error here
 * costs neither the stamp nor the rechecks. A dozen Drive lists a run at today's size, far under Drive's quota.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { filesChangedSince, indexFiles, type IndexContext } from './fileIndex.ts'
import { CHECK_FILES_MAX, filesWithNoRow, type ReconcileStep } from './fileIndexCheckKernel.ts'
import { SWEEP_MAX_FILES } from './fileIndexKernel.ts'

const DAWN = '1970-01-01T00:00:00.000Z'
const ROW_PAGE = 1000

/** Every row's id, a page at a time until a short page, in a total order so none is read twice or missed. */
export async function allIndexRowIds(admin: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>()
  for (let from = 0; ; from += ROW_PAGE) {
    // Drive rows alone (#285): a record's row is keyed on its own id and is never in the drive's listing.
    const { data, error } = await admin.from('file_index').select('drive_file_id').eq('source', 'drive').order('drive_file_id').range(from, from + ROW_PAGE - 1)
    if (error) throw new Error(`file_index did not read: ${error.message}`)
    const rows = (data ?? []) as { drive_file_id: string }[]
    for (const r of rows) ids.add(r.drive_file_id)
    if (rows.length < ROW_PAGE) return ids
  }
}

/** The step: the drive against the rows, and the files with no row through the pass, newest first, up to `max`. */
export async function reconcileSweep(ctx: IndexContext, opts: { max?: number } = {}): Promise<ReconcileStep> {
  const started = Date.now()
  const [listed, rowIds] = await Promise.all([filesChangedSince(ctx, DAWN, CHECK_FILES_MAX, true), allIndexRowIds(ctx.admin)])
  const missing = filesWithNoRow(listed.files, rowIds)
  const max = Math.max(0, opts.max ?? SWEEP_MAX_FILES)
  const batch = missing.slice(0, max)
  // The pass's own clock starts here, after the listing, so a dozen Drive lists never eat its budget; what the request
  // has spent parsing (`ctx.spend`) is shared with the stamped pass, since the worker's CPU is.
  const pass = batch.length > 0 ? await indexFiles(ctx, batch, { max, startedMs: Date.now() }) : null
  return {
    filesInDrive: listed.files.length,
    capped: listed.more,
    rows: rowIds.size,
    noRow: missing.length,
    taken: pass ? pass.planned - pass.remaining : 0,
    indexed: pass?.indexed ?? 0,
    held: pass?.held.length ?? 0,
    ms: Date.now() - started,
  }
}
