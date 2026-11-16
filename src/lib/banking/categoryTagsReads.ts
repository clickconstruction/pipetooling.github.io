/**
 * The category tags' two reads the cost-line split needs, with the client passed in (punch list #360, PR 4), so a
 * job's costs can be read as the service role on the edge; `categoryTagsData.ts` binds the app's client and keeps
 * the writes and the hook.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import type { CategoryTagColor, CategoryTagMemberRow, CategoryTagRow } from './categoryTags'

type TagDbRow = Database['public']['Tables']['mercury_category_tags']['Row']
type MemberDbRow = Database['public']['Tables']['mercury_category_tag_members']['Row']

function toTagRow(r: TagDbRow): CategoryTagRow {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color as CategoryTagColor,
    sort_order: r.sort_order,
    default_key: r.default_key,
    show_as_cost_line: r.show_as_cost_line,
    hide_from_picker: r.hide_from_picker,
  }
}

export async function readCategoryTags(db: SupabaseClient<Database>): Promise<{ tags: CategoryTagRow[]; members: CategoryTagMemberRow[] }> {
  const [tagsRes, membersRes] = await Promise.all([
    withSupabaseRetry(
      async () => await db.from('mercury_category_tags').select('*').order('sort_order').order('name'),
      'load category tags',
    ),
    withSupabaseRetry(async () => await db.from('mercury_category_tag_members').select('tag_id, bank_category, label_id'), 'load category tag members'),
  ])
  const tags = ((tagsRes as TagDbRow[] | null) ?? []).map(toTagRow)
  const members = ((membersRes as Pick<MemberDbRow, 'tag_id' | 'bank_category' | 'label_id'>[] | null) ?? []).map((m) => ({
    tag_id: m.tag_id,
    bank_category: m.bank_category,
    label_id: m.label_id,
  }))
  return { tags, members }
}

/** Mercury tx id → its accounting label id (drag-sort assignment), chunked. Used by the cost-line split. */
export async function readLabelIdByTxId(db: SupabaseClient<Database>, txIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (txIds.length === 0) return out
  const rows = (await fetchAllRowsChunkedIn(
    [...txIds],
    (chunk, from, to) =>
      db
        .from('mercury_transaction_drag_sort_assignments')
        .select('mercury_transaction_id, label_id')
        .in('mercury_transaction_id', chunk)
        .order('mercury_transaction_id')
        .range(from, to),
    'load accounting labels by tx',
  )) as Array<{ mercury_transaction_id: string; label_id: string }>
  for (const r of rows) out.set(r.mercury_transaction_id, r.label_id)
  return out
}
