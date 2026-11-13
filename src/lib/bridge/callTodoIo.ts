import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { TodoCard } from './callTodoState'

/**
 * The read behind `callTodoState.ts` (punch list #334, PR 9): the to-do cards made for one of the Bridge's things,
 * with the people on each and the day each was finished. A card is found by its own tag (`source_tag`, PR 12), and
 * by a link that carries one of the Bridge's tagged addresses, for a card made before the tag had a column. The owner and a dev read every card.
 * Reads only; a card is made and changed in the app's own task windows.
 */

/** Addresses or tags asked for in one request: the list rides in the query, so it is kept short. */
const LINKS_PER_READ = 20

type ItemRow = { id: string; title: string; links: string[] | null; created_at: string | null; due_date: string | null; source_tag?: string | null }
type InstanceRow = { id: string; checklist_item_id: string; completed_at: string | null; completed_by_user_id: string | null }
type AssigneeRow = { checklist_item_id: string; user_id: string; display_order: number }

/**
 * `tags` are the things' own keys. `links` are the full tagged addresses, as the cards store them. `toYmd` turns a
 * timestamp into a day. `names` is who the page already knows by account; anyone missing is read once.
 */
export async function loadTodoCards(db: SupabaseClient<Database>, tags: ReadonlyArray<string>, links: ReadonlyArray<string>, toYmd: (iso: string) => string, names: ReadonlyMap<string, string>): Promise<TodoCard[]> {
  if (tags.length === 0 && links.length === 0) return []
  const chunked = (list: ReadonlyArray<string>): string[][] => {
    const out: string[][] = []
    for (let i = 0; i < list.length; i += LINKS_PER_READ) out.push(list.slice(i, i + LINKS_PER_READ))
    return out
  }
  // The column is younger than the generated types; the types PR after the push removes the unknown step.
  const cards = db.from('checklist_items') as unknown as { select: (cols: string) => { in: (col: string, values: string[]) => PromiseLike<{ data: ItemRow[] | null; error: { message: string } | null }> } }
  const [byTag, byLink] = await Promise.all([
    // By the card's own tag. A read that fails here (the column not there yet) leaves the cards to their links.
    Promise.all(chunked(tags).map(async (chunk) => (await cards.select('id, title, links, created_at, due_date, source_tag').in('source_tag', chunk)).data)).catch(() => [] as Array<ItemRow[] | null>),
    Promise.all(chunked(links).map((chunk) => withSupabaseRetry(async () => db.from('checklist_items').select('id, title, links, created_at, due_date').overlaps('links', chunk), 'bridge to-do cards') as Promise<ItemRow[] | null>)),
  ])
  const items = new Map<string, ItemRow>()
  // The read by tag wins: its row carries the tag.
  for (const rows of [...byLink, ...byTag]) for (const r of rows ?? []) items.set(r.id, r)
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
      tag: item.source_tag ?? null,
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
