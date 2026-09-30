/**
 * Reads the typed-hours stamp for a list of clock sessions (`clock_typed_stamps`, v2.4242).
 * A stamp is a courtesy on top of the list it decorates: any failure — the function not on the
 * database yet, a dropped request — comes back as "no stamps", never as an error the list shows.
 */
import { supabase } from '../supabase'
import { parseTypedStampRow, type TypedStamp } from './typedHours'

const CHUNK = 150

export async function loadTypedStamps(sessionIds: readonly string[]): Promise<Map<string, TypedStamp>> {
  const out = new Map<string, TypedStamp>()
  const ids = Array.from(new Set(sessionIds.filter((id) => typeof id === 'string' && id !== '' && !id.startsWith('draft:'))))
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    try {
      const { data, error } = await supabase.rpc('clock_typed_stamps', { p_session_ids: chunk })
      if (error) continue
      for (const raw of (data ?? []) as unknown[]) {
        const parsed = parseTypedStampRow(raw)
        if (parsed && (parsed.stamp.hold || parsed.stamp.entries.length > 0)) out.set(parsed.sessionId, parsed.stamp)
      }
    } catch {
      // no stamps for this chunk
    }
  }
  return out
}
