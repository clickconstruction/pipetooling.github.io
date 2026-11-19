/**
 * A watch on what one person does with the material on site (`person_watches`,
 * `20261118150000_person_watches.sql`). Devs alone read a watch; for anyone else the reads answer
 * nothing and the screens draw as they did before. A watch is turned on, then lifted with a reason,
 * and never deleted. `noteBoxOpen` is the one call every box screen makes for every person: the
 * database writes a row only for a watched caller and answers nothing either way.
 */
import { supabase } from '../supabase'

export type PersonWatch = { id: string; userId: string; why: string; tellUserIds: string[]; setByName: string; setAt: string }
export type WatchedOpen = { containerId: string; at: string }

type WatchRow = { id: string; user_id: string; why: string; tell_user_ids: string[] | null; set_by_name: string; set_at: string }

// The generated types learn the two tables and the function at the regeneration after the push.
const watches = () => supabase.from('person_watches' as never)
const opens = () => supabase.from('watched_box_opens' as never)

const WATCH_COLS = 'id, user_id, why, tell_user_ids, set_by_name, set_at'
const watchOf = (r: WatchRow): PersonWatch => ({ id: r.id, userId: r.user_id, why: r.why ?? '', tellUserIds: r.tell_user_ids ?? [], setByName: r.set_by_name ?? '', setAt: r.set_at })

/** Every live watch. A dev's read; anyone else gets none. Throws the database's own error. */
export async function fetchLiveWatches(): Promise<PersonWatch[]> {
  const { data, error } = await watches().select(WATCH_COLS).is('lifted_at', null).order('set_at', { ascending: false }).limit(200)
  if (error) throw error
  return ((data ?? []) as unknown as WatchRow[]).map(watchOf)
}

/** The live watch on one person, or null. */
export async function fetchWatchOn(userId: string): Promise<PersonWatch | null> {
  const { data, error } = await watches().select(WATCH_COLS).eq('user_id', userId).is('lifted_at', null).limit(1)
  if (error) throw error
  const row = ((data ?? []) as unknown as WatchRow[])[0]
  return row ? watchOf(row) : null
}

/** Turn a watch on. The database stamps who set it and when. */
export async function setWatch(userId: string, why: string, tellUserIds: ReadonlyArray<string>): Promise<PersonWatch> {
  const { data, error } = await watches().insert({ user_id: userId, why: why.trim(), tell_user_ids: [...new Set(tellUserIds)] } as never).select(WATCH_COLS).single()
  if (error) throw error
  return watchOf(data as unknown as WatchRow)
}

/** Lift a watch, with its reason. It stays on record as lifted. */
export async function liftWatch(watchId: string, why: string): Promise<void> {
  const { data, error } = await watches().update({ lifted_at: new Date().toISOString(), lifted_why: why.trim() } as never).eq('id', watchId).select('id')
  if (error) throw error
  if (((data ?? []) as unknown[]).length === 0) throw new Error('The watch was not lifted. Only a dev lifts one.')
}

/** The boxes a watched person opened, newest first. A dev's read. */
export async function fetchWatchedOpens(watchId: string): Promise<WatchedOpen[]> {
  const { data, error } = await opens().select('container_id, at').eq('watch_id', watchId).order('at', { ascending: false }).limit(1000)
  if (error) throw error
  return ((data ?? []) as unknown as Array<{ container_id: string; at: string }>).map((r) => ({ containerId: r.container_id, at: r.at }))
}

/**
 * A box screen opened a box. Called for every person and never awaited: the answer is nothing either
 * way, and a failure of any kind is swallowed here, because an error on this call would be the one
 * sign of a watch.
 */
export function noteBoxOpen(containerId: string | null | undefined): void {
  if (!containerId) return
  try {
    const call = (supabase as unknown as { rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<unknown> | undefined }).rpc?.('on_site_note_box_open', { p_container_id: containerId })
    if (call && typeof (call as PromiseLike<unknown>).then === 'function') void (call as PromiseLike<unknown>).then(() => undefined, () => undefined)
  } catch {
    /* nothing to say */
  }
}
