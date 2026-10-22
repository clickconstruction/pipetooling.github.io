/**
 * The robots' status rows on the Console (Robot rounds PR 3, punch list #142, decision 8): one
 * row per key, a key being a seat on a Mac. Alive, Quiet or Asleep from the key's last call;
 * when it checked in; what it has in hand; the last five things the robot finished. Pure, over
 * one `robot_agents()` row; the words pass the plain-words rules under test.
 */
import { heartbeatWords, type HeartbeatProgress } from '../../../supabase/functions/_shared/twinHeartbeat'
import { relativeTimeFrom } from '../twinConsoleDisplay'
import { ROBOT_ALIVE_MS } from './robotProgress'

/** Fifteen minutes with no call inside its hours, three rounds missed: the key is asleep. */
export const ROBOT_ASLEEP_MS = 15 * 60_000

export type RobotRecentKind = 'sealed' | 'scored' | 'parked' | 'matrix' | 'matrix_blocked' | 'submittal' | 'report'

/** One finished thing, as `robot_agents()` lists it. */
export type RobotRecentItem = {
  kind: RobotRecentKind
  at: string
  /** The human bid, for the door. */
  bid_id?: string | null
  /** The human bid's number, e.g. "509". */
  bid_number: string | null
  project: string | null
  /** The shell's number for a shadow, e.g. "2038". */
  shell_number: string | null
  /** Questions asked, rows written, asks filed — by kind. */
  count: number | null
  /** A report's label, a task's kind, a matrix's status. */
  label: string | null
  /** The scored run's delta, percent, when the kind is scored. */
  delta_pct: number | string | null
}

/** One row of `robot_agents()`. */
export type RobotAgentRow = {
  credential_id: string
  key_label: string
  key_created_at: string
  twin_user_id: string
  twin_name: string | null
  twin_kind: 'estimator' | 'pricer' | string
  last_seen_at: string | null
  stopped_at: string | null
  stopped_by_name: string | null
  heartbeat_at: string | null
  heartbeat_state: string | null
  heartbeat_stage: string | null
  heartbeat_progress: HeartbeatProgress | null
  heartbeat_is_round: boolean
  heartbeat_bid_number: string | null
  heartbeat_project: string | null
  /** The human bid behind the shell the heartbeat names, when the shell has one. */
  heartbeat_source_bid_number: string | null
  heartbeat_source_bid_id?: string | null
  /** True while that shell is open and unlocked. */
  holds_open_shell: boolean
  idle_rounds_today: number
  recent: RobotRecentItem[]
}

export type RobotAgentState = 'alive' | 'quiet' | 'asleep' | 'stopping' | 'stopped' | 'never'

export type RobotAgentView = {
  credentialId: string
  /** "Twin Estimator 1" */
  robot: string
  /** "on Robert's Mac Mini" */
  seat: string
  kind: 'estimator' | 'pricer'
  state: RobotAgentState
  /** The light's word: Alive, Quiet, Asleep, Stopping after b511, Stopped by Robert 3:10 PM, Never checked in. */
  word: string
  tone: 'green' | 'amber' | 'gray' | 'blue'
  /** "Checked in 2m ago." or "Last check-in 3d ago." */
  checkedIn: string
  /** The exact time behind the check-in sentence, for the hover. */
  checkedInAt: string | null
  /** "Reading the sheets on b511, 12 of 31 sheets, since 2:04 PM." or "Nothing in hand." */
  now: string
  /** The bid the robot holds, if any. */
  nowBidNumber: string | null
  /** The five finished things, newest first, in words with a door. */
  recent: Array<{ at: string; words: string; door: { kind: 'bid' | 'matrix' | 'submittals'; bidId: string | null; bidNumber: string | null } }>
  /** The bid the robot holds, for the door. */
  nowBidId: string | null
  /** "1 bid sealed, 1 parked. 88 rounds found nothing to do." */
  today: string | null
  stoppedAt: string | null
  canStop: boolean
}

export function agentState(row: RobotAgentRow, nowMs: number): { state: RobotAgentState; word: string; tone: RobotAgentView['tone'] } {
  if (row.stopped_at) {
    if (row.holds_open_shell) return { state: 'stopping', word: `Stopping after ${row.heartbeat_source_bid_number ? `b${row.heartbeat_source_bid_number}` : 'this bid'}`, tone: 'blue' }
    const by = row.stopped_by_name ? ` by ${row.stopped_by_name}` : ''
    return { state: 'stopped', word: `Stopped${by} ${relativeTimeFrom(row.stopped_at, nowMs)}`, tone: 'gray' }
  }
  if (!row.last_seen_at) return { state: 'never', word: 'Never checked in', tone: 'gray' }
  const ago = nowMs - Date.parse(row.last_seen_at)
  if (ago <= ROBOT_ALIVE_MS) return { state: 'alive', word: 'Alive', tone: 'green' }
  if (ago <= ROBOT_ASLEEP_MS) return { state: 'quiet', word: 'Quiet', tone: 'amber' }
  return { state: 'asleep', word: 'Asleep', tone: 'gray' }
}

function stripStop(s: string): string {
  return s.trim().replace(/[.!?]+$/, '')
}

/** The words for one finished thing, and where it opens. */
export function recentWorkLine(item: RobotRecentItem): RobotAgentView['recent'][number] {
  const bid = item.bid_number ? `b${item.bid_number}` : 'a bid'
  const shell = item.shell_number ? `b${item.shell_number}` : 'its copy'
  const project = item.project ? ` ${item.project}` : ''
  const asked = item.count && item.count > 0 ? ` Asked ${item.count} question${item.count === 1 ? '' : 's'}.` : ''
  let words: string
  const bidId = item.bid_id ?? null
  let door: RobotAgentView['recent'][number]['door'] = { kind: 'bid', bidId, bidNumber: item.bid_number }
  switch (item.kind) {
    case 'sealed':
      words = `Sealed ${shell} for ${bid}${project}.${asked}`
      break
    case 'scored': {
      const d = item.delta_pct == null ? NaN : Number(item.delta_pct)
      const delta = Number.isFinite(d) ? ` Scored since, ${Math.abs(Math.round(d))} percent ${d < 0 ? 'under' : 'over'} ours.` : ' Scored since.'
      words = `Sealed ${shell} for ${bid}${project}.${delta}`
      break
    }
    case 'parked':
      words = `Parked ${shell} for ${bid}${project}. Waiting on the plans.`
      break
    case 'matrix':
      words = `Matrix ready for ${bid}${project}${item.count ? `, ${item.count} ask${item.count === 1 ? '' : 's'}` : ''}.`
      door = { kind: 'matrix', bidId, bidNumber: item.bid_number }
      break
    case 'matrix_blocked':
      words = `Matrix blocked on ${bid}${project}.`
      door = { kind: 'matrix', bidId, bidNumber: item.bid_number }
      break
    case 'submittal':
      words = `${submittalWords(item.label, item.count)} on ${bid}${project}.`
      door = { kind: 'submittals', bidId, bidNumber: item.bid_number }
      break
    default:
      words = `Filed its report${item.label ? ` ${stripStop(item.label)}` : ''}.`
  }
  return { at: item.at, words, door }
}

function submittalWords(kind: string | null, count: number | null): string {
  const n = count ?? 0
  switch (kind) {
    case 'read_schedule':
      return n > 0 ? `Read the fixture schedule, ${n} row${n === 1 ? '' : 's'}` : 'Read the fixture schedule'
    case 'file_cut_sheets':
      return n > 0 ? `Filed ${n} cut sheet${n === 1 ? '' : 's'}` : 'Filed cut sheets'
    case 'read_redlines':
      return 'Read the reviewer’s redlines'
    default:
      return 'Finished a submittal task'
  }
}

/** "1 bid sealed, 1 parked. 88 rounds found nothing to do." from today's items; null with nothing to say. */
export function todayLine(recent: readonly RobotRecentItem[], idleRounds: number, todayStartMs: number): string | null {
  const today = recent.filter((r) => Date.parse(r.at) >= todayStartMs)
  const sealed = today.filter((r) => r.kind === 'sealed' || r.kind === 'scored').length
  const parked = today.filter((r) => r.kind === 'parked').length
  const matrices = today.filter((r) => r.kind === 'matrix').length
  const tasks = today.filter((r) => r.kind === 'submittal').length
  const parts: string[] = []
  if (sealed) parts.push(`${sealed} bid${sealed === 1 ? '' : 's'} sealed`)
  if (parked) parts.push(`${parked} parked`)
  if (matrices) parts.push(`${matrices} matri${matrices === 1 ? 'x' : 'ces'} ready`)
  if (tasks) parts.push(`${tasks} submittal task${tasks === 1 ? '' : 's'} done`)
  const first = parts.length ? `${capitalize(parts.join(', '))}.` : ''
  const second = idleRounds > 0 ? `${idleRounds} round${idleRounds === 1 ? '' : 's'} found nothing to do.` : ''
  const line = [first, second].filter(Boolean).join(' ')
  return line || null
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The row's Now sentence: the heartbeat's words on the bid it names, or Nothing in hand. */
export function nowWords(row: RobotAgentRow): string {
  const bid = row.heartbeat_source_bid_number ?? row.heartbeat_bid_number
  if (!row.holds_open_shell || !bid) return 'Nothing in hand.'
  const base = stripStop(heartbeatWords(row.heartbeat_progress, row.heartbeat_state))
  return `${base} on b${bid}.`
}

export function buildRobotAgentView(row: RobotAgentRow, nowMs: number, todayStartMs: number, canStop: boolean): RobotAgentView {
  const { state, word, tone } = agentState(row, nowMs)
  const checkedInAt = row.last_seen_at
  const checkedIn = !checkedInAt ? 'Never checked in.' : state === 'alive' || state === 'quiet' ? `Checked in ${relativeTimeFrom(checkedInAt, nowMs)}.` : `Last check-in ${relativeTimeFrom(checkedInAt, nowMs)}.`
  const kind = row.twin_kind === 'pricer' ? 'pricer' : 'estimator'
  return {
    credentialId: row.credential_id,
    robot: row.twin_name?.trim() || (kind === 'pricer' ? 'Twin Pricer' : 'Twin Estimator'),
    seat: `on ${row.key_label || 'a Mac'}`,
    kind,
    state,
    word,
    tone,
    checkedIn,
    checkedInAt,
    now: nowWords(row),
    nowBidNumber: row.holds_open_shell ? (row.heartbeat_source_bid_number ?? row.heartbeat_bid_number) : null,
    nowBidId: row.holds_open_shell ? (row.heartbeat_source_bid_id ?? null) : null,
    recent: (row.recent ?? []).slice(0, 5).map(recentWorkLine),
    today: todayLine(row.recent ?? [], row.idle_rounds_today, todayStartMs),
    stoppedAt: row.stopped_at,
    canStop,
  }
}

/** Keys seen in the last seven days, the live ones first, then by last call. */
export function sortRobotAgents(views: readonly RobotAgentView[]): RobotAgentView[] {
  const rank: Record<RobotAgentState, number> = { alive: 0, stopping: 1, quiet: 2, stopped: 3, asleep: 4, never: 5 }
  return [...views].sort((a, b) => rank[a.state] - rank[b.state] || (Date.parse(b.checkedInAt ?? '') || 0) - (Date.parse(a.checkedInAt ?? '') || 0))
}
