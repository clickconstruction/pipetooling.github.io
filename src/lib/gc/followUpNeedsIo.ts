/**
 * GC mode, the Dashboard's Follow up line: the people waiting on us in Follow up, each once, from cut 2's badge
 * (`follow_up_count`, v2.5289), the number Follow up's pill on /gc says too (call E1: one number on both). Until v2.5289
 * the line and the pill counted everyone the office waits on (`allPeople`); that count is now the heading of the asks
 * list on the tab. One read, so the hook still imports this file on demand and the Dashboard's chunk stays small.
 */
import { supabaseFollowUpIo } from '../followUp/followUpIo'
import type { GcNeedsYou } from './needsYou'

/** The line's words for a count: null when nobody waits on us. */
export function followUpNeedsWords(count: number): GcNeedsYou | null {
  if (!Number.isFinite(count) || count <= 0) return null
  return {
    count,
    late: false,
    title: `${count} ${count === 1 ? 'person is' : 'people are'} waiting on us`,
    detail: 'Answer them, or say what we owe them.',
  }
}

/** The line for now, or null when nobody waits on us. */
export async function loadGcFollowUpNeeds(): Promise<GcNeedsYou | null> {
  return followUpNeedsWords(await supabaseFollowUpIo().count())
}
