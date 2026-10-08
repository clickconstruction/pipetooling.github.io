/**
 * GC mode, the real build, the Building lane's U3a-ii: the daily log's read and its one press. The rows
 * come back as `DailyLogRow` for `withDailyLogs` (./dailyLogRows.ts). The press is `gc_save_daily_log`
 * (migration 20261009120000), which refuses in its own words. Building's tables are a dev's while it is
 * built (`canUseGcBuilding`), so their policies are the gate here.
 */
import { supabase } from '../supabase'
import type { Json } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import type { DailyLogPayload, DailyLogRow } from './dailyLogRows'

/** The rows of a read, or the read's problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** Every daily log on these jobs, each with its crews and what held work up, in one read. */
export async function loadGcDailyLogs(projectIds: string[]): Promise<DailyLogRow[]> {
  if (projectIds.length === 0) return []
  return taken(
    await supabase.from('gc_daily_logs').select('*, gc_daily_log_crews(*), gc_daily_log_delays(*)').in('project_id', projectIds).order('log_date'),
    'load the daily logs',
  )
}

/** A day's log saved, with its crews and delays, in place of that day's if it has one. Returns the log's id. */
export async function saveGcDailyLog(log: DailyLogPayload): Promise<string> {
  return taken(await supabase.rpc('gc_save_daily_log', { log: log as unknown as Json }), 'save the daily log')
}
