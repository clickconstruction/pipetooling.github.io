/**
 * The Robots group's strip — the program in six numbers, plain words, one row (punch list
 * #63, PR 2, v2.4256). It was the Robot Board's alone (v2.3225); now it is the group's
 * header on every lens, and each tile is a door to the lens that works it. The Scoreboard
 * used to rephrase three of the six as sentences and Audits had none — one strip, one
 * vocabulary. Pure: the lens loads the runs and builds the mirror; this shapes the tiles.
 */
import type { BidsTabKey } from './bidsTabAccess'

export type RobotStripCounts = {
  /** Our bids with at least one robot run (`RobotMirror.rowCount`). */
  rowCount: number
  liveEligible: number
  uncoveredLive: number
  sealedCount: number
  needsCount: number
  /** Workable pending audits (the page's audit gate). */
  auditPending: number
  /** Days since the oldest pending audit was requested; null with none pending. */
  oldestAuditDays: number | null
  /** Kinds of job that earned first drafts, of those with a scored run. */
  gate: { met: number; total: number }
  /** v2.3234: sent bids that moved off their recorded best effort, and the dollars moved. */
  moved: { count: number; total: number }
}

export type RobotStripTile = {
  key: 'runs' | 'shadowed' | 'sealed' | 'needs' | 'audits' | 'gate' | 'moved'
  n: string
  label: string
  warn: boolean
  title: string
  /** The lens the tile opens. */
  door: BidsTabKey
}

const money = (v: number) => `$${Math.round(v).toLocaleString()}`

/** Days since the oldest pending audit was requested (null with none). */
export function oldestPendingAuditDays(audits: ReadonlyArray<{ status: string; requested_at: string }>, now: number = Date.now()): number | null {
  const pending = audits.filter((a) => a.status === 'pending').map((a) => Date.parse(a.requested_at)).filter(Number.isFinite)
  if (!pending.length) return null
  return Math.max(0, Math.floor((now - Math.min(...pending)) / 86400000))
}

export function buildRobotStripTiles(c: RobotStripCounts): RobotStripTile[] {
  const tiles: RobotStripTile[] = [
    { key: 'runs', n: String(c.rowCount), label: 'of our bids have a robot run', warn: false, title: 'Human bids with at least one shadow or backtest run — the Robot Board lists them', door: 'robot-board' },
    { key: 'shadowed', n: `${Math.max(0, c.liveEligible - c.uncoveredLive)} / ${c.liveEligible}`, label: 'live plumbing bids shadowed', warn: c.uncoveredLive > 0, title: 'Unsent, undecided bids with plans on file that a robot has (or could) shadow — every uncovered one is a free future reference', door: 'robot-board' },
    { key: 'sealed', n: String(c.sealedCount), label: 'sealed, waiting on your number', warn: false, title: 'Robot numbers locked away on live bids — each opens the moment you record your best effort on the Cover Letter, or mark the bid sent with a value', door: 'robot-board' },
    { key: 'needs', n: String(c.needsCount), label: 'need something from a person', warn: c.needsCount > 0, title: "Live bids the robot can't start on — no plans link, plans it can't open, or a question it asked. The Robot Board's Unsent section says what, with the door.", door: 'robot-board' },
    { key: 'audits', n: String(c.auditPending), label: c.oldestAuditDays != null && c.auditPending > 0 ? `audits waiting · oldest ${c.oldestAuditDays} d` : 'audits waiting', warn: c.auditPending > 0, title: 'Robot audits a person still owes a verdict — the Audits lens is the queue', door: 'audits' },
    { key: 'gate', n: `${c.gate.met} / ${c.gate.total}`, label: 'kinds of job earned first drafts', warn: false, title: 'A kind of job earns first drafts after five robot numbers in a row within 8% of ours — the Scoreboard keeps the count', door: 'robot-scoreboard' },
  ]
  if (c.moved.count > 0) {
    tiles.push({ key: 'moved', n: `${c.moved.count} · ${money(c.moved.total)}`, label: `bid${c.moved.count === 1 ? '' : 's'} moved after the robot's envelope`, warn: false, title: 'Sent bids whose value differs from the best effort recorded before the envelope opened, and the dollars moved in total', door: 'robot-board' })
  }
  return tiles
}
