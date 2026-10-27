import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
/**
 * The Build desk (punch list #192, v2.5929): the reads the Bridge does not
 * already make, read once when the desk first opens, over the open jobs'
 * ids. The Schedule's blocks for the next BUILD_DESK_CREW_DAYS days with the
 * assignees' names, for the crew chips; and each job's lifetime approved
 * hours through `loadEarnedJobs`, the earned rule's denominator, so a moving
 * row can say how many hours it expects. The hours, the percent points and
 * the open jobs are on the page already. Read-only; nothing new on the server.
 */
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { ymdAddDays } from '../../../utils/dateUtils'
import { fetchAllRowsChunkedIn } from '../../supabasePaging'
import { loadEarnedJobs } from '../loadBridgeData'
import { BUILD_DESK_CREW_DAYS, type BuildDeskBlock, type BuildDeskReads } from './buildDesk'

type BlockRow = { job_id: string | null; work_date: string; assignee_user_id: string }
type UserRow = { id: string; name: string | null }

export async function loadBuildDeskReads(db: SupabaseClient<Database>, args: { jobIds: ReadonlyArray<string>; todayYmd: string; crewDays?: number }): Promise<BuildDeskReads> {
  const jobIds = [...new Set(args.jobIds)]
  const crewDays = args.crewDays ?? BUILD_DESK_CREW_DAYS
  const crewEnd = ymdAddDays(args.todayYmd, crewDays - 1)
  const [blockRows, earned] = await Promise.all([
    jobIds.length
      ? fetchAllRowsChunkedIn<BlockRow, string>(
          jobIds,
          async (chunk, from, to) => ({
            data: (await withSupabaseRetry(async () => db.from('job_schedule_blocks').select('job_id, work_date, assignee_user_id').in('job_id', chunk).gte('work_date', args.todayYmd).lte('work_date', crewEnd).order('id').range(from, to), 'build desk schedule blocks')) as BlockRow[] | null,
            error: null,
          }),
          'build desk schedule blocks',
        )
      : Promise.resolve([] as BlockRow[]),
    jobIds.length ? loadEarnedJobs(db, jobIds) : Promise.resolve({ jobs: [], earnedJobs: [], lifetimeHoursAsOf: new Map<string, number>() }),
  ])
  const blocks: BuildDeskBlock[] = []
  for (const r of blockRows) if (r.job_id) blocks.push({ jobId: r.job_id, workDate: r.work_date, assigneeUserId: r.assignee_user_id })
  const userIds = [...new Set(blocks.map((b) => b.assigneeUserId))]
  const userRows = userIds.length
    ? await fetchAllRowsChunkedIn<UserRow, string>(
        userIds,
        async (chunk, from, to) => ({
          data: (await withSupabaseRetry(async () => db.from('users').select('id, name').in('id', chunk).order('id').range(from, to), 'build desk crew names')) as UserRow[] | null,
          error: null,
        }),
        'build desk crew names',
      )
    : []
  const names = new Map<string, string>()
  for (const u of userRows) if (u.name) names.set(u.id, u.name)
  const lifetimeHours = new Map<string, number>()
  for (const j of earned.earnedJobs) lifetimeHours.set(j.id, j.lifetimeHours)
  return { blocks, names, lifetimeHours }
}
