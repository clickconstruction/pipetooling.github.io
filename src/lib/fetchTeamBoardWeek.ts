import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { LedgerPrefixMap } from './ledgerDisplayPrefixes'
import { formatBidLedgerShortLine, formatJobLedgerShortLine } from './ledgerDisplayPrefixes'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from './overheadOfficeJobSettings'
import { teamAckKey, type TeamBoardBlock, type TeamBoardSession, type TeamBoardSubSheet, type TeamTargetLabel } from './teamBoard'

type JobEmbed = { hcp_number: string | null; job_name: string | null; job_address: string | null; service_type_id: string | null; click_number?: string | null } | null
type BidEmbed = { bid_number: string | null; project_name: string | null; address: string | null; service_type_id: string | null } | null
type UserEmbed = { name: string | null } | null

type SessionRow = {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at: string | null
  job_ledger_id: string | null
  bid_id: string | null
  users: UserEmbed
  jobs_ledger: JobEmbed
  bids: BidEmbed
}
type BlockRow = {
  id: string
  assignee_user_id: string
  work_date: string
  time_start: string
  time_end: string
  job_id: string | null
  bid_id: string | null
  note: string | null
  users: UserEmbed
  jobs_ledger: JobEmbed
  bids: BidEmbed
}
type SheetRow = { id: string; job_number: string | null; job_date: string | null; assigned_to_name: string; address: string; stage: string }
type PayFlagRow = { person_name: string; is_salary: boolean }

export type TeamBoardWeekData = {
  sessions: TeamBoardSession[]
  blocks: TeamBoardBlock[]
  subSheets: TeamBoardSubSheet[]
  labels: Record<string, TeamTargetLabel>
  officeJobId: string | null
  payFlags: Record<string, { is_salary: boolean }>
  /** v2.2981: accepted chips this week — `teamAckKey` → row id (for undo). Empty when the table is not there yet. */
  ackIdByKey: Record<string, string>
}
type AckRow = { id: string; kind: 'over' | 'unplanned'; work_date: string; person_user_id: string; target_key: string }

/** Soft read: a missing table (before the migration push) means no acknowledgements, not an error. */
async function fetchAcksSoft(startYmd: string, endYmd: string): Promise<AckRow[]> {
  try {
    const { data, error } = await supabase.from('team_board_acks').select('id, kind, work_date, person_user_id, target_key').gte('work_date', startYmd).lte('work_date', endYmd).limit(2000)
    if (error) return []
    return (data ?? []) as AckRow[]
  } catch {
    return []
  }
}

const JOB_EMBED = 'jobs_ledger(hcp_number,job_name,job_address,service_type_id,click_number)'
const BID_EMBED = 'bids(bid_number,project_name,address,service_type_id)'

/**
 * Everything Jobs → Team needs for one week, in four reads: live closed clock
 * sessions (approved and pending), dispatch blocks, sub sheets dated in the
 * week, and the pay flags for person targets. Labels are resolved here so the
 * kernel stays pure.
 */
export async function fetchTeamBoardWeek(startYmd: string, endYmd: string, prefixMap: LedgerPrefixMap): Promise<TeamBoardWeekData> {
  const [sessionRows, blockRows, sheetRows, flagRows, officeJobId, ackRows] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .select(`id, user_id, work_date, clocked_in_at, clocked_out_at, approved_at, job_ledger_id, bid_id, users!clock_sessions_user_id_fkey(name), ${JOB_EMBED}, ${BID_EMBED}`)
          .gte('work_date', startYmd)
          .lte('work_date', endYmd)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('clocked_out_at', 'is', null)
          .order('clocked_in_at', { ascending: true })
          .limit(3000),
      'team board clock_sessions',
    ),
    withSupabaseRetry(
      async () =>
        supabase
          .from('job_schedule_blocks')
          .select(`id, assignee_user_id, work_date, time_start, time_end, job_id, bid_id, note, users!job_schedule_blocks_assignee_user_id_fkey(name), ${JOB_EMBED}, ${BID_EMBED}`)
          .gte('work_date', startYmd)
          .lte('work_date', endYmd)
          .order('work_date', { ascending: true })
          .limit(3000),
      'team board job_schedule_blocks',
    ),
    withSupabaseRetry(
      async () =>
        supabase.from('people_labor_jobs').select('id, job_number, job_date, assigned_to_name, address, stage').gte('job_date', startYmd).lte('job_date', endYmd).limit(500),
      'team board people_labor_jobs',
    ),
    withSupabaseRetry(async () => supabase.rpc('list_people_pay_flags'), 'team board pay flags'),
    fetchOverheadOfficeJobLedgerIdFromAppSettings().catch(() => null),
    fetchAcksSoft(startYmd, endYmd),
  ])

  const labels: Record<string, TeamTargetLabel> = {}
  const hcpToJobId: Record<string, string> = {}
  const noteJob = (id: string | null, j: JobEmbed) => {
    if (!id || !j) return
    labels[`job:${id}`] ??= { label: formatJobLedgerShortLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.click_number ?? null), sub: j.job_address ?? '', jobNumber: j.hcp_number }
    if (j.hcp_number) hcpToJobId[j.hcp_number.trim()] = id
  }
  const noteBid = (id: string | null, b: BidEmbed) => {
    if (!id || !b) return
    labels[`bid:${id}`] ??= { label: formatBidLedgerShortLine(prefixMap, b.service_type_id, b.bid_number, b.project_name), sub: b.address ?? '' }
  }

  const sessions: TeamBoardSession[] = ((sessionRows ?? []) as unknown as SessionRow[]).map((r) => {
    noteJob(r.job_ledger_id, r.jobs_ledger)
    noteBid(r.bid_id, r.bids)
    return { id: r.id, userId: r.user_id, personName: r.users?.name?.trim() ?? '', workDate: r.work_date, clockedInAt: r.clocked_in_at, clockedOutAt: r.clocked_out_at, approvedAt: r.approved_at, jobId: r.job_ledger_id, bidId: r.bid_id }
  })
  const blocks: TeamBoardBlock[] = ((blockRows ?? []) as unknown as BlockRow[]).map((r) => {
    noteJob(r.job_id, r.jobs_ledger)
    noteBid(r.bid_id, r.bids)
    return { id: r.id, userId: r.assignee_user_id, personName: r.users?.name?.trim() ?? '', workDate: r.work_date, timeStart: r.time_start, timeEnd: r.time_end, jobId: r.job_id, bidId: r.bid_id, note: r.note }
  })
  const subSheets: TeamBoardSubSheet[] = ((sheetRows ?? []) as SheetRow[])
    .filter((s) => !!s.job_date)
    .map((s) => ({ id: s.id, workDate: s.job_date as string, jobId: s.job_number ? (hcpToJobId[s.job_number.trim()] ?? null) : null, jobNumber: s.job_number, contractor: s.assigned_to_name, stage: s.stage, address: s.address }))
  const payFlags: Record<string, { is_salary: boolean }> = {}
  for (const f of (flagRows ?? []) as PayFlagRow[]) payFlags[f.person_name.trim()] = { is_salary: !!f.is_salary }

  const ackIdByKey: Record<string, string> = {}
  for (const a of ackRows) ackIdByKey[teamAckKey(a.kind, a.work_date, a.person_user_id, a.target_key)] = a.id

  return { sessions, blocks, subSheets, labels, officeJobId, payFlags, ackIdByKey }
}

/**
 * v2.2996: the `?teamLaborJob=` deep link (Edit Job → labor cost panel) should land on a week
 * where the job actually has hours. Returns the job's most recent work date with a live closed
 * session, or null.
 */
export async function fetchLatestWorkDateForJob(jobId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('clock_sessions')
      .select('work_date')
      .eq('job_ledger_id', jobId)
      .is('rejected_at', null)
      .is('revoked_at', null)
      .not('clocked_out_at', 'is', null)
      .order('work_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as { work_date: string } | null)?.work_date ?? null
  } catch {
    return null
  }
}
