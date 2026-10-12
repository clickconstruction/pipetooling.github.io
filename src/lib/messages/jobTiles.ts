/**
 * Messages, cut 1's screens: a job as the thread names it, a tile on the person's rail and a tag on a line. Lifted from
 * the Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178: `jobNum`, `jobDay`,
 * `jobTag`; v1.34's tile and v1.36's badge then name). Pure.
 *
 * Its number: a bid's bid number, a GC project's number after "#", a Pipeline job's HCP or Click number. Its second
 * line is the job's day in words, from its facts and never typed: a bid's due day and whether ours went, a GC project's
 * stage, a Pipeline job's status.
 */
import { calendarYmdInAppTzFromIso, ymdDaysBetween } from '../../utils/dateUtils'
import { shortDate, weekdayDate } from '../gc/words'
import { jobNumberLabel } from '../jobs/jobSummaryCycle'
import { jobKey, type JobKind } from './load'

/** A `bids` row, as much as a tile reads. */
export interface BidTileRow {
  id: string
  bid_number: string | null
  project_name: string | null
  bid_due_date: string | null
  bid_date_sent: string | null
  outcome: string | null
}

/** A GC project: its `gc_projects` row with its `projects` row's name and number. */
export interface GcProjectTileRow {
  project_id: string
  name: string
  project_number: string | null
  stage: string
  bid_due: string | null
  our_bid_sent_on: string | null
  lost_on: string | null
  started_on: string | null
}

/** A `jobs_ledger` row, a Pipeline job. */
export interface PipelineTileRow {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  status: string | null
}

export interface JobTile {
  key: string
  kind: JobKind
  /** The badge: "B482", "#42", "J1077". */
  num: string
  name: string
  /** The second line, and how it reads: soon within a week, today, past. */
  day: { words: string; tone: '' | 'soon' | 'today' | 'past' }
}

const ymdOf = (value: string | null) => (value ? (value.length > 10 ? calendarYmdInAppTzFromIso(value) : value.slice(0, 10)) : '')

/** A due day against today: "bid due Thu Oct 8 · 6 days", "bid due today", "bid was due Thu Oct 8 · 3 days late". */
function dueWords(dueYmd: string, todayYmd: string): JobTile['day'] {
  const n = ymdDaysBetween(todayYmd, dueYmd) ?? 0
  const day = weekdayDate(dueYmd)
  if (n < 0) return { words: `bid was due ${day} · ${-n} day${n === -1 ? '' : 's'} late`, tone: 'past' }
  if (n === 0) return { words: 'bid due today', tone: 'today' }
  if (n <= 7) return { words: `bid due ${day} · ${n} day${n === 1 ? '' : 's'}`, tone: 'soon' }
  return { words: `bid due ${day}`, tone: '' }
}

export function bidTile(row: BidTileRow, todayYmd: string): JobTile {
  const sent = ymdOf(row.bid_date_sent)
  const due = ymdOf(row.bid_due_date)
  const outcome = row.outcome?.trim().toLowerCase() ?? ''
  const day: JobTile['day'] =
    outcome === 'won' || outcome === 'lost'
      ? { words: `bid ${outcome}`, tone: '' }
      : sent
        ? { words: `bid sent ${weekdayDate(sent)}`, tone: '' }
        : due
          ? dueWords(due, todayYmd)
          : { words: 'bid', tone: '' }
  return { key: jobKey({ kind: 'bid', id: row.id }), kind: 'bid', num: row.bid_number?.trim() || 'Bid', name: row.project_name?.trim() || 'A bid', day }
}

const STAGE_WORDS: Record<string, string> = { bidding: 'bidding', buyout: 'buying out', building: 'building', closed: 'closed' }

export function gcProjectTile(row: GcProjectTileRow, todayYmd: string): JobTile {
  const stage = row.stage.trim().toLowerCase()
  const lost = ymdOf(row.lost_on)
  const sent = ymdOf(row.our_bid_sent_on)
  const due = ymdOf(row.bid_due)
  const started = ymdOf(row.started_on)
  const day: JobTile['day'] = lost
    ? { words: `lost ${weekdayDate(lost)}`, tone: '' }
    : stage === 'bidding'
      ? sent
        ? { words: `bid sent ${weekdayDate(sent)}`, tone: '' }
        : due
          ? dueWords(due, todayYmd)
          : { words: 'bidding', tone: '' }
      : stage === 'building' && started
        ? { words: `building · since ${shortDate(started)}`, tone: '' }
        : { words: STAGE_WORDS[stage] ?? stage, tone: '' }
  const num = row.project_number?.trim()
  return { key: jobKey({ kind: 'project', id: row.project_id }), kind: 'project', num: num ? `#${num}` : 'GC', name: row.name.trim() || 'A GC project', day }
}

export function pipelineTile(row: PipelineTileRow): JobTile {
  const num = jobNumberLabel({ id: row.id, hcp_number: row.hcp_number, click_number: row.click_number })
  return {
    key: jobKey({ kind: 'pipeline', id: row.id }),
    kind: 'pipeline',
    num,
    name: row.job_name?.trim() || 'A Pipeline job',
    day: { words: row.status?.trim().toLowerCase() || 'in the Pipeline', tone: '' },
  }
}

/** The tiles by key, for a rail and a line's tag. */
export function jobTilesByKey(
  rows: { bids?: readonly BidTileRow[]; projects?: readonly GcProjectTileRow[]; pipeline?: readonly PipelineTileRow[] },
  todayYmd: string,
): Record<string, JobTile> {
  const tiles = [
    ...(rows.bids ?? []).map((r) => bidTile(r, todayYmd)),
    ...(rows.projects ?? []).map((r) => gcProjectTile(r, todayYmd)),
    ...(rows.pipeline ?? []).map(pipelineTile),
  ]
  return Object.fromEntries(tiles.map((t) => [t.key, t]))
}
