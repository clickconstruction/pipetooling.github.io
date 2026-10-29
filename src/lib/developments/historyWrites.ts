/**
 * The History look's one write (punch list #208 PR 2h): keep an entry, a dated line that never
 * changes, in `development_history_entries`. The row is the draft the composer built plus who kept
 * it; the table has no UPDATE policy, so a correction is a second line. The MCP path (PR 2m) writes
 * through the dev seat's wrapper RPC with `via = 'mcp'`; this is the app's path, `via = 'app'`.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { draftToRow, rowToEntry, type HistoryDraft, type HistoryEntry, type HistoryRow } from './history'

export async function keepHistoryEntry(draft: HistoryDraft, developmentId: string, author: { userId: string; name: string | null }): Promise<HistoryEntry> {
  const { data, error } = await supabase
    .from('development_history_entries' as never)
    .insert(draftToRow(draft, developmentId, author.userId) as never)
    .select('*')
    .single()
  if (error) throw new Error(formatErrorMessage(error))
  return rowToEntry(data as unknown as HistoryRow, new Map(author.name ? [[author.userId, author.name]] : []))
}
