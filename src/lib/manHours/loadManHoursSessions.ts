// Every closed, standing clock session on record, with only the columns the Man
// hours fold reads (`manHoursByPeriod.ts`). The Year zoom shows every year, so
// there is no date floor. About 2,500 sessions as of 2026-10 and roughly 4,400
// a year: three pages today. Past about 20,000, move the fold into a database
// function that returns one row per day and side.

import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { ManHoursSession } from './manHoursByPeriod'

const SESSION_SELECT =
  'user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)'

/** Paged (the read crosses PostgREST's 1,000-row cap). Throws when a page fails. */
export async function loadManHoursSessions(): Promise<ManHoursSession[]> {
  // Fresh builder per page; `.order('id')` keeps pages stable.
  const makeQ = () =>
    supabase
      .from('clock_sessions')
      .select(SESSION_SELECT)
      .not('clocked_out_at', 'is', null)
      .is('rejected_at', null)
      .is('revoked_at', null)
      .order('id')
  return fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => makeQ().range(from, to), 'load man hours clock sessions')) as unknown as ManHoursSession[] | null,
      error: null,
    }),
    'load man hours clock sessions',
  )
}
