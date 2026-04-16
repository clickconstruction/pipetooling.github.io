import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/** `work_date` values (YYYY-MM-DD) marked correct in People → Hours for the inclusive range. */
export async function fetchHoursDaysCorrectWorkDates(startYmd: string, endYmd: string): Promise<Set<string>> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase.from('hours_days_correct').select('work_date').gte('work_date', startYmd).lte('work_date', endYmd),
    'fetch hours_days_correct in range',
  )
  const set = new Set<string>()
  for (const r of rows ?? []) {
    if (r?.work_date) set.add(r.work_date)
  }
  return set
}
