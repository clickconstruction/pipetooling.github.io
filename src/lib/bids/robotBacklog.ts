/**
 * The robots' backlog, for a dev's Dashboard (v2.3287): what wants a robot
 * bid and what wants a price matrix, in one sentence. Pure — the hook feeds
 * it the open human bids (through the same queue kernel the Console uses, so
 * the numbers can never disagree), the open price-matrix requests, and the
 * clock. Absent (null) when nothing is waiting: silence means caught up.
 */
import { buildRobotQueue, type RobotQueueBidFields } from './robotQueue'

export type RobotBacklogBid = RobotQueueBidFields

export type RobotBacklogRequest = {
  id: string
  status: string
  requested_at: string
  claimed_at: string | null
  heartbeat_at: string | null
  bid: { bid_number: string | null; project_name: string | null } | null
}

export type RobotBacklog = {
  /** Robot-able bids nobody has shadowed: requested by a person + ready on their own. */
  bidsWaiting: number
  bidsRequested: number
  /** Age of the oldest human request, ms; null when none requested. */
  oldestRequestMs: number | null
  /** "BP482 Marriott shell" — the oldest request, else the soonest-due ready bid. */
  firstBid: string | null
  /** A human request older than a week — the backlog is a fire, not a pile. */
  requestOverdue: boolean
  /** Open price-matrix requests: queued + working + blocked. */
  matricesOpen: number
  /** Working with no heartbeat for over an hour, or blocked — the robot needs a person. */
  matricesStuck: number
  oldestMatrixMs: number | null
  firstMatrix: string | null
}

export const ROBOT_BACKLOG_REQUEST_OVERDUE_MS = 7 * 86400000
export const ROBOT_BACKLOG_HEARTBEAT_STALE_MS = 60 * 60000
/** Same rule as the Console: a bid due more than 30 days ago is stale, not backlog. */
export const ROBOT_BACKLOG_STALE_DUE_DAYS = 30

function bidLabel(b: { bid_number: string | null; project_name: string | null }): string {
  const num = (b.bid_number ?? '').trim()
  const proj = (b.project_name ?? '').trim()
  const head = num ? `BP${num.replace(/^bp/i, '')}` : 'a bid'
  return proj ? `${head} ${proj}` : head
}

export function buildRobotBacklog(
  bids: readonly RobotBacklogBid[],
  twinExistsForBidId: (bidId: string) => boolean,
  requests: readonly RobotBacklogRequest[],
  nowMs: number,
): RobotBacklog | null {
  const staleDueBefore = new Date(nowMs - ROBOT_BACKLOG_STALE_DUE_DAYS * 86400000).toISOString().slice(0, 10)
  const queue = buildRobotQueue(bids, twinExistsForBidId, { staleDueBefore })
  const bidsWaiting = queue.requested.length + queue.ready.length
  const oldestReq = queue.requested[0] ?? null
  const oldestRequestMs = oldestReq?.robot_requested_at ? Math.max(0, nowMs - new Date(oldestReq.robot_requested_at).getTime()) : null
  const firstBidRow = oldestReq ?? queue.ready[0] ?? null

  const open = requests.filter((r) => r.status === 'queued' || r.status === 'working' || r.status === 'blocked')
  const stuck = open.filter((r) => {
    if (r.status === 'blocked') return true
    if (r.status !== 'working') return false
    const beat = r.heartbeat_at ?? r.claimed_at
    return !beat || nowMs - new Date(beat).getTime() > ROBOT_BACKLOG_HEARTBEAT_STALE_MS
  })
  const byAge = [...open].sort((a, b) => a.requested_at.localeCompare(b.requested_at))
  const oldestMx = byAge[0] ?? null

  if (bidsWaiting === 0 && open.length === 0) return null
  return {
    bidsWaiting,
    bidsRequested: queue.requested.length,
    oldestRequestMs,
    firstBid: firstBidRow ? bidLabel(firstBidRow) : null,
    requestOverdue: oldestRequestMs != null && oldestRequestMs > ROBOT_BACKLOG_REQUEST_OVERDUE_MS,
    matricesOpen: open.length,
    matricesStuck: stuck.length,
    oldestMatrixMs: oldestMx ? Math.max(0, nowMs - new Date(oldestMx.requested_at).getTime()) : null,
    firstMatrix: oldestMx?.bid ? bidLabel(oldestMx.bid) : oldestMx ? 'a bid' : null,
  }
}

/** "3 days" · "5 hours" · "20 minutes" · "just now" — coarse on purpose; a backlog is not a stopwatch. */
export function describeBacklogAge(ms: number): string {
  const m = Math.floor(ms / 60000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m} minutes`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'}`
}
