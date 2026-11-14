/**
 * Materials on site: a box's old names, read for its window's Cage tab (v2.7199). `job_container_names` is
 * written by the database's own trigger on a changed name (v2.7072) and read by whoever may touch the box's job.
 */
import { supabase } from '../supabase'
import type { BoxNameChange } from './boxHistory'

/** Every rename of one box, oldest first. Throws the database's own error, for the caller to word. */
export async function fetchBoxNames(containerId: string): Promise<BoxNameChange[]> {
  const { data, error } = await supabase.from('job_container_names').select('id, container_id, old_label, new_label, by_name, at').eq('container_id', containerId).order('at', { ascending: true }).limit(200)
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, containerId: r.container_id, oldLabel: r.old_label, newLabel: r.new_label, byName: r.by_name, at: r.at }))
}
