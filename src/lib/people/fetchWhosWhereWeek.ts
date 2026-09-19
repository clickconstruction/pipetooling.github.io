/**
 * People → Who's where (to-dos/whos-where, PR 1): the loader.
 *
 * One company week of the two tables the page projects — clock sessions (pending
 * and approved; open ones kept, the Dashboard clock strip reads them too) and
 * dispatch blocks — plus the roster and the office job id. Labels are resolved here
 * so the kernel stays pure. Paged with `fetchAllRows`: a week of org-wide sessions
 * can pass PostgREST's silent 1,000-row cap.
 */
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { formatBidLedgerShortLine, formatJobLedgerShortLine, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'
import { fetchActiveUsers } from './fetchActiveUsers'
import { pgTimeMinutes, sessionMinutes, wwTargetKeyFor, type WhosWhereData, type WwBlock, type WwPerson, type WwSession, type WwTarget } from './whosWhere'

type JobEmbed = { hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; customer_name: string | null; service_type_id: string | null } | null
type BidEmbed = { bid_number: string | null; project_name: string | null; address: string | null; service_type_id: string | null } | null

type SessionRow = {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  job_ledger_id: string | null
  bid_id: string | null
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
  shared_block_group_id: string | null
  jobs_ledger: JobEmbed
  bids: BidEmbed
}

const JOB_EMBED_COLS = 'hcp_number,click_number,job_name,job_address,customer_name,service_type_id'
const BID_EMBED = 'bids(bid_number,project_name,address,service_type_id)'
const SESSION_SELECT = `id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, jobs_ledger!clock_sessions_job_ledger_id_fkey(${JOB_EMBED_COLS}), ${BID_EMBED}`
const BLOCK_SELECT = `id, assignee_user_id, work_date, time_start, time_end, job_id, bid_id, shared_block_group_id, jobs_ledger(${JOB_EMBED_COLS}), ${BID_EMBED}`

function targetFor(key: string, job: JobEmbed, bid: BidEmbed, officeJobId: string | null, prefixMap: LedgerPrefixMap): WwTarget {
  if (job) {
    const isOffice = officeJobId != null && key === `job:${officeJobId}`
    const name = (job.job_name ?? '').trim()
    const customer = (job.customer_name ?? '').trim()
    return {
      key,
      label: isOffice ? 'Office' : formatJobLedgerShortLine(prefixMap, job.service_type_id, job.hcp_number, job.job_name, job.click_number),
      detail: customer && customer !== name ? customer : null,
      address: (job.job_address ?? '').trim() || null,
      isOffice,
    }
  }
  if (bid) {
    return { key, label: formatBidLedgerShortLine(prefixMap, bid.service_type_id, bid.bid_number, bid.project_name), detail: null, address: (bid.address ?? '').trim() || null, isOffice: false }
  }
  return { key, label: 'Unknown job', detail: null, address: null, isOffice: false }
}

/** Everything Who's where needs for one week (`startYmd`..`endYmd` inclusive, company calendar). */
export async function fetchWhosWhereWeek(startYmd: string, endYmd: string, prefixMap: LedgerPrefixMap): Promise<WhosWhereData> {
  const [sessionRows, blockRows, roster, officeJobId] = await Promise.all([
    fetchAllRows<SessionRow>(
      (from, to) =>
        supabase
          .from('clock_sessions')
          .select(SESSION_SELECT)
          .gte('work_date', startYmd)
          .lte('work_date', endYmd)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .order('clocked_in_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: SessionRow[] | null; error: { message: string } | null; status?: number }>,
      "who's where clock_sessions",
    ),
    fetchAllRows<BlockRow>(
      (from, to) =>
        supabase
          .from('job_schedule_blocks')
          .select(BLOCK_SELECT)
          .gte('work_date', startYmd)
          .lte('work_date', endYmd)
          .order('work_date', { ascending: true })
          .order('time_start', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: BlockRow[] | null; error: { message: string } | null; status?: number }>,
      "who's where job_schedule_blocks",
    ),
    fetchActiveUsers<{ id: string; name: string | null; role: string | null; needs_supervision: boolean | null }>('id, name, role, needs_supervision', { includeDev: true }),
    fetchOverheadOfficeJobLedgerIdFromAppSettings().catch(() => null),
  ])

  const targets: Record<string, WwTarget> = {}
  const sessions: WwSession[] = []
  for (const r of sessionRows) {
    const win = sessionMinutes(r.clocked_in_at, r.clocked_out_at)
    if (!win) continue
    const key = wwTargetKeyFor(r.job_ledger_id, r.bid_id)
    if (!targets[key] && key !== 'none') targets[key] = targetFor(key, r.jobs_ledger, r.bids, officeJobId, prefixMap)
    sessions.push({ id: r.id, userId: r.user_id, workDate: r.work_date, startMin: win.startMin, endMin: win.endMin, targetKey: key })
  }
  const blocks: WwBlock[] = []
  for (const r of blockRows) {
    const key = wwTargetKeyFor(r.job_id, r.bid_id)
    if (!targets[key] && key !== 'none') targets[key] = targetFor(key, r.jobs_ledger, r.bids, officeJobId, prefixMap)
    const startMin = pgTimeMinutes(r.time_start)
    const endMin = Math.max(startMin, pgTimeMinutes(r.time_end))
    blocks.push({ id: r.id, userId: r.assignee_user_id, workDate: r.work_date, startMin, endMin, targetKey: key, groupId: r.shared_block_group_id })
  }
  const people: WwPerson[] = roster.data.map((u) => ({ id: u.id, name: (u.name ?? '').trim() || 'Unnamed', role: u.role, needsSupervision: u.needs_supervision ?? true }))
  return { sessions, blocks, roster: people, targets }
}
