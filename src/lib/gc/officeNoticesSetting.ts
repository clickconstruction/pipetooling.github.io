/**
 * The office's GC notices' switch (GC mode, Owner Billing's O10): the app_settings row `gc_office_notices_on_v1`,
 * inserted 'false' by migration 20261010060000. On, it holds the day it went on, an ISO date: only a pay application
 * sent since then gets notices, so turning it on never sends a backlog. Anything that is not a real day reads off
 * (`gcOfficeNoticesSince`). The owner turns it on in Settings → Jobs & billing; dev and the owner write it (a key-scoped
 * UPDATE policy). `gc-office-notices` reads the same row.
 */
import { supabase } from '../supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { GC_OFFICE_NOTICES_SETTING_KEY, gcOfficeNoticesSince } from '../../../supabase/functions/_shared/gcOfficeNotices'

/** The day it went on, or null for off. A missing row, or a read that fails, is off. */
export async function fetchGcOfficeNoticesSince(): Promise<string | null> {
  const { data, error } = await supabase.from('app_settings').select('value_text').eq('key', GC_OFFICE_NOTICES_SETTING_KEY).maybeSingle()
  if (error) return null
  return gcOfficeNoticesSince(data?.value_text ?? null)
}

/**
 * Turn it on (today's day) or off ('false'), and say the day it holds. An UPDATE, not an upsert: the owner holds only
 * the key-scoped UPDATE policy, and the row comes from the migration.
 */
export async function setGcOfficeNoticesOn(on: boolean): Promise<string | null> {
  const value = on ? todayYmdInAppTz() : 'false'
  const { data, error } = await supabase.from('app_settings').update({ value_text: value }).eq('key', GC_OFFICE_NOTICES_SETTING_KEY).select('key')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('Only the owner or a dev can turn this on.')
  return gcOfficeNoticesSince(value)
}
