/**
 * Materials on site: the write behind Fix the name (v2.7212). One row of `job_part_renames`; the database's
 * triggers set the name on the job's typed ledger rows and fill the row (`20261113230000_on_site_part_renames.sql`).
 * Not an outbox press: it changes rows the phone already drew, so it needs a signal and says so when it has none.
 */
import { supabase } from '../supabase'

type RenameRow = { id: string; old_name: string; new_name: string; row_count: number }

// The generated types learn the table at the regeneration after the push.
const table = () => supabase.from('job_part_renames' as never)

async function insert(row: Record<string, unknown>): Promise<RenameRow> {
  const { data, error } = await table().insert(row as never).select('id, old_name, new_name, row_count').single()
  if (error) throw error
  return data as unknown as RenameRow
}

/** Rename a typed part on a job. Answers the rename's id, for its undo. Throws the database's own error. */
export async function renamePart(jobId: string, from: string, to: string): Promise<{ id: string; rows: number }> {
  const r = await insert({ job_id: jobId, old_name: from, new_name: to })
  return { id: r.id, rows: r.row_count }
}

/** Take a rename back: the old name goes back on the rows it changed that still carry its new name. */
export async function undoPartRename(jobId: string, renameId: string): Promise<{ id: string; rows: number }> {
  const r = await insert({ job_id: jobId, undo_of: renameId })
  return { id: r.id, rows: r.row_count }
}
