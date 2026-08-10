import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/**
 * "Hide the HCP field on New/Edit Job" (v2.1533, Settings → Jobs & dispatch,
 * dev only). HCP numbers are legacy — the org no longer issues them — but jobs
 * that already carry one must keep showing (and editing) it, so the flag only
 * hides the EMPTY entry field: JobFormModal computes per-open
 * `flag && no existing HCP` and never re-evaluates mid-edit.
 *
 * app_settings row `hide_hcp_entry_field` (value_text 'true') is mirrored into
 * localStorage so the modal can read it synchronously on open; the fetch
 * refreshes the mirror in the background (billCustomerMemoPresets pattern,
 * minus the preset machinery).
 */
export const HIDE_HCP_ENTRY_FIELD_KEY = 'hide_hcp_entry_field'
const STORAGE_KEY = 'pt-hide-hcp-entry-field'

/** Sync read of the cached flag (safe under jsdom/SSR — returns false on any failure). */
export function getHideHcpFieldCached(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeCache(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, 'true')
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private-mode storage failures just fall back to showing the field.
  }
}

/** Refresh the localStorage mirror from app_settings; returns the fresh value. */
export async function refreshHideHcpFieldCache(supabase: SupabaseClient<Database>): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value_text')
      .eq('key', HIDE_HCP_ENTRY_FIELD_KEY)
      .maybeSingle()
    const on = (data?.value_text ?? '').trim() === 'true'
    writeCache(on)
    return on
  } catch {
    return getHideHcpFieldCached()
  }
}

/** Dev settings write: upsert 'true' or delete the row, then mirror locally. */
export async function saveHideHcpFieldSetting(
  supabase: SupabaseClient<Database>,
  on: boolean,
): Promise<{ error: string | null }> {
  const res = on
    ? await supabase
        .from('app_settings')
        .upsert({ key: HIDE_HCP_ENTRY_FIELD_KEY, value_text: 'true' }, { onConflict: 'key' })
    : await supabase.from('app_settings').delete().eq('key', HIDE_HCP_ENTRY_FIELD_KEY)
  if (res.error) return { error: res.error.message }
  writeCache(on)
  return { error: null }
}

/**
 * Should THIS modal instance hide the HCP entry field? Pure (tested):
 * hide only when the flag is on AND the job has no HCP value — a job that
 * already carries a number keeps its field so the data stays visible/editable.
 */
export function shouldHideHcpEntryField(flagOn: boolean, existingHcpNumber: string | null | undefined): boolean {
  if (!flagOn) return false
  return (existingHcpNumber ?? '').trim() === ''
}
