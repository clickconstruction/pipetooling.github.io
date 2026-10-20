import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { ScheduleBlockLite } from './scheduleMatch'

/** The dispatch schedule's blocks over a day range (v2.5223): who was on which job, when. Read for the approvals queue's on-the-schedule rule. */
export async function fetchScheduleBlocksForRange(fromYmd: string, toYmd: string): Promise<ScheduleBlockLite[]> {
  const data = await withSupabaseRetry(
    async () => supabase.from('job_schedule_blocks').select('assignee_user_id, work_date, job_id, time_start, time_end').gte('work_date', fromYmd).lte('work_date', toYmd),
    'load schedule blocks for the approvals queue',
  )
  return (data ?? []) as ScheduleBlockLite[]
}
