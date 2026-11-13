import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { TodoCard } from './callTodoState'

/**
 * The read behind `callTodoState.ts` (punch list #334, PR 9): the to-do cards whose links carry one of the Bridge's
 * tagged addresses, with the people on each and the day each was finished. The owner and a dev read every card.
 * Reads only; a card is made and changed in the app's own task windows.
 */

/** Addresses asked for in one request: the list rides in the query, so it is kept short. */
const LINKS_PER_READ = 20

type ItemRow = { id: string; title: string; links: string[] | null; created_at: string | null; due_date: string | null }
type InstanceRow = { id: string; checklist_item_id: string; completed_at: string | null; completed_by_user_id: string | null }
type AssigneeRow = { checklist_item_id: string; user_id: string; display_order: number }

/**
 * `links` are the full tagged addresses, as the cards store them. `toYmd` turns a timestamp into the viewer's day.
 * `names` is who the page already knows by account; anyone missing is read once.
 */
export async function loadTodoCards(db: SupabaseClient<Database>, links: ReadonlyArray<string>, toYmd: (iso: string) => string, names: ReadonlyMap<string, string>): Promise<TodoCard[]> {
  if (links.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < links.length; i += LINKS_PER_READ) chunks.push(links.slice(i, i + LINKS_PER_READ))
  const found = await Promise.all(chunks.map((chunk) => withSupabaseRetry(async () => db.from('checklist_items').select('id, title, links, created_at, due_date').overlaps('links', chunk), 'bridge to-do cards') as Promise<ItemRow[] | null>))
  const items = new Map<string, ItemRow>()
  for (const rows of found) for (const r of rows ?? []) items.set(r.id, r)
  const ids = [...items.keys()]
  if (ids.length === 0) return []
  const [instances, assignees] = (await Promise.all([
    withSupabaseRetry(async () => db.from('checklist_instances').select('id, checklist_item_id, completed_at, completed_by_user_id').in('checklist_item_id', ids), 'bridge to-do instances'),
    withSupabaseRetry(async () => db.from('checklist_item_assignees').select('checklist_item_id, user_id, display_order').in('checklist_item_id', ids), 'bridge to-do people'),
  ])) as [InstanceRow[] | null, AssigneeRow[] | null]
  // Names: the page's own list first, then one read for anyone it does not hold (a helper, an archived account).
  const known = new Map(names)
  const wanted = new Set<string>()
  for (const a of assignees ?? []) if (!known.has(a.user_id)) wanted.add(a.user_id)
  for (const i of instances ?? []) if (i.completed_by_user_id && !known.has(i.completed_by_user_id)) wanted.add(i.completed_by_user_id)
  if (wanted.size > 0) {
    const rows = (await withSupabaseRetry(async () => db.from('users').select('id, name').in('id', [...wanted]), 'bridge to-do names')) as Array<{ id: string; name: string | null }> | null
    for (const u of rows ?? []) if (u.name) known.set(u.id, u.name)
  }
  return ids.map((id) => {
    const item = items.get(id) as ItemRow
    return {
      itemId: id,
      title: item.title,
      links: item.links ?? [],
      madeYmd: item.created_at ? toYmd(item.created_at) : '',
      dueYmd: item.due_date,
      who: (assignees ?? [])
        .filter((a) => a.checklist_item_id === id)
        .sort((a, b) => a.display_order - b.display_order)
        .map((a) => known.get(a.user_id) ?? 'Someone'),
      instances: (instances ?? []).filter((i) => i.checklist_item_id === id).map((i) => ({ id: i.id, doneYmd: i.completed_at ? toYmd(i.completed_at) : null, doneBy: i.completed_by_user_id ? (known.get(i.completed_by_user_id) ?? null) : null })),
    }
  })
}
