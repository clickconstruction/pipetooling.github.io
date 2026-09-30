/**
 * Added hours nobody other than the typist has looked at (`list_typed_hours_waiting`, v2.4242).
 * The function answers only the people who approve hours; everyone else gets an empty list. A
 * failed read is an empty list too — this feeds a nudge and a section, never a blocking screen.
 */
import { supabase } from '../supabase'
import { parseTypedWaitingRow, type TypedWaitingRow } from './typedHours'

export async function loadTypedHoursWaiting(): Promise<TypedWaitingRow[]> {
  try {
    const { data, error } = await supabase.rpc('list_typed_hours_waiting')
    if (error) return []
    return ((data ?? []) as unknown[]).map(parseTypedWaitingRow).filter((r): r is TypedWaitingRow => r !== null)
  } catch {
    return []
  }
}

/** "Looks right" on hours typed onto approved time. Returns null, or the reason it was refused. */
export async function confirmTypedEntry(entryId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('confirm_clock_typed_entry', { p_entry_id: entryId })
  if (error) return error.message
  return typeof data === 'string' && data !== '' ? data : null
}
