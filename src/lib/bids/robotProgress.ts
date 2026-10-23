/**
 * The robot's progress on one bid (Robot rounds PR 2, punch list #142): the seven steps, the lit
 * one, the ring's fill, and the words the icon's tooltip, the sheet and the Robot Board row all
 * print. One kernel over the `robot_progress()` row, so the four never disagree. Pure.
 *
 * The step comes first from the facts the robot's own verbs leave on its shell (the claim, the
 * plans link, the substrate, the audit row the takeoff makes, the count rows, the lock, the
 * questions), so the bar moves even when the robot forgets to heartbeat; the heartbeat adds the
 * inside of a step ("12 of 31 sheets") and the words it chose.
 */
import { HEARTBEAT_STEPS, HEARTBEAT_STEP_WORDS, heartbeatWords, type HeartbeatProgress, type HeartbeatStep } from '../../../supabase/functions/_shared/twinHeartbeat'
import { relativeTimeFrom } from '../twinConsoleDisplay'

/** One row of `robot_progress(p_bid_ids)`. */
export type RobotProgressRow = {
  bid_id: string
  shell_bid_id: string
  shell_bid_number: string | null
  run_status: string
  claimed_at: string
  plans_filed: boolean
  read_at: string | null
  counted_at: string | null
  priced_at: string | null
  locked_at: string | null
  scored_at: string | null
  questions_at: string | null
  heartbeat_at: string | null
  heartbeat_state: string | null
  heartbeat_stage: string | null
  heartbeat_progress: HeartbeatProgress | null
  heartbeat_is_round: boolean
  key_label: string | null
  key_last_seen_at: string | null
  median_minutes: number | string | null
}

/** Ten minutes with no word while a shell is open and unlocked: the robot went quiet on this bid. */
export const ROBOT_QUIET_MS = 10 * 60_000
/** A key that called within seven minutes (the five-minute round plus two of grace) is alive. */
export const ROBOT_ALIVE_MS = 7 * 60_000

/** The Robots lenses' one sentence about the fleet, from the newest key's last call; null when no key ever called. */
export function robotCheckedInWords(lastSeenAt: string | null | undefined, nowMs: number): string | null {
  if (!lastSeenAt) return null
  const t = Date.parse(lastSeenAt)
  if (!Number.isFinite(t)) return null
  const when = relativeTimeFrom(lastSeenAt, nowMs)
  return nowMs - t <= ROBOT_ALIVE_MS ? `The robots checked in ${when}.` : `The robots last checked in ${when}.`
}

export type RobotProgressStepState = 'done' | 'now' | 'todo'

export type RobotProgressStep = {
  key: HeartbeatStep
  label: string
  state: RobotProgressStepState
  at: string | null
  /** The inside of the lit step, from the heartbeat: "12 of 31 sheets". */
  detail: string | null
}

export type RobotProgressTone = 'blue' | 'amber' | 'green' | 'gray'

export type RobotProgress = {
  steps: RobotProgressStep[]
  /** Steps done, 0..7. */
  done: number
  /** The lit step's index, or null when every step is done. */
  nowIndex: number | null
  /** The ring's fill, 0..1: steps done of seven plus the lit step's inside fraction. Full once sealed. */
  fraction: number
  tone: RobotProgressTone
  sealed: boolean
  void: boolean
  /** True while the shell is open and unlocked and nothing has spoken for ROBOT_QUIET_MS. */
  quiet: boolean
  /**
   * v2.5751: a heartbeat landed within ROBOT_QUIET_MS and the shell is open and unlocked — a robot
   * is on this bid right now. The key's last call does not count: it may be on another bid.
   */
  live: boolean
  /** The newest of the heartbeat and the key's last call. */
  lastWordAt: string | null
  /** "Step 3 of 7. Reading the sheets, 12 of 31 sheets. Last word 2 minutes ago." */
  sentence: string
  /** The shape's own sentence, for the row's sub-line: "Reading the sheets, 12 of 31 sheets." */
  words: string
  /** "Robert's Mac Mini", the key's label, or null. */
  host: string | null
  /** "Most bids take about an hour.", once ten runs have locked; else null. */
  usualWords: string | null
}

const STEP_INDEX: Record<HeartbeatStep, number> = Object.fromEntries(HEARTBEAT_STEPS.map((s, i) => [s, i])) as Record<HeartbeatStep, number>

/** "12 of 31 sheets" → 12/31; anything else null. */
export function insideFraction(read: string | null | undefined): number | null {
  if (!read) return null
  const m = /(\d+)\s+of\s+(\d+)/i.exec(read)
  if (!m) return null
  const a = Number(m[1]), b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null
  return Math.max(0, Math.min(1, a / b))
}

function newest(...isos: Array<string | null | undefined>): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const iso of isos) {
    if (!iso) continue
    const t = Date.parse(iso)
    if (Number.isFinite(t) && t > bestMs) { bestMs = t; best = iso }
  }
  return best
}

/** The usual run, from the median minutes between claim and lock once ten runs exist. */
export function usualRunWords(medianMinutes: number | string | null | undefined): string | null {
  const m = medianMinutes == null ? NaN : Number(medianMinutes)
  if (!Number.isFinite(m) || m <= 0) return null
  if (m < 45) return `Most bids take about ${Math.max(5, Math.round(m / 5) * 5)} minutes.`
  if (m < 90) return 'Most bids take about an hour.'
  const hours = Math.round(m / 30) / 2
  return `Most bids take about ${hours % 1 === 0 ? hours : hours.toFixed(1)} hours.`
}

export function buildRobotProgress(row: RobotProgressRow, nowMs: number): RobotProgress {
  const isVoid = row.run_status === 'void'
  const sealed = !!row.locked_at
  const hb = row.heartbeat_progress ?? null
  const hbState = row.heartbeat_state ?? null
  const finished = hbState === 'done' || !!row.questions_at

  // The facts each step leaves, in order.
  const doneAt: Array<string | null> = [
    row.claimed_at,
    row.plans_filed ? row.claimed_at : null,
    row.read_at,
    row.counted_at,
    row.priced_at,
    row.locked_at,
    row.questions_at ?? (hbState === 'done' && sealed ? row.heartbeat_at : null),
  ]
  // Done is contiguous from the start: a later fact without the earlier ones (a takeoff with no
  // substrate row) still counts the earlier steps as passed.
  let lastDone = -1
  for (let i = doneAt.length - 1; i >= 0; i--) if (doneAt[i]) { lastDone = i; break }
  // The heartbeat may be ahead of the facts (it says counting before the takeoff lands).
  const hbIndex = hb?.step ? STEP_INDEX[hb.step] : -1
  const litFromFacts = lastDone + 1
  const nowIndex = finished && sealed ? null : Math.min(HEARTBEAT_STEPS.length - 1, Math.max(litFromFacts, hbIndex >= 0 && hbIndex > lastDone ? hbIndex : litFromFacts))
  const done = nowIndex == null ? HEARTBEAT_STEPS.length : nowIndex

  const steps: RobotProgressStep[] = HEARTBEAT_STEPS.map((key, i) => ({
    key,
    label: HEARTBEAT_STEP_WORDS[key],
    state: i < done ? 'done' : i === nowIndex ? 'now' : 'todo',
    at: i < done ? (doneAt[i] ?? null) : null,
    detail: i === nowIndex && hb?.step === key && hb.read ? hb.read : null,
  }))

  const lastWordAt = newest(row.heartbeat_at, row.key_last_seen_at)
  const quiet = !sealed && !isVoid && lastWordAt != null && nowMs - Date.parse(lastWordAt) > ROBOT_QUIET_MS
  const hbAt = row.heartbeat_at ? Date.parse(row.heartbeat_at) : NaN
  const live = !sealed && !isVoid && Number.isFinite(hbAt) && nowMs - hbAt <= ROBOT_QUIET_MS
  const inside = nowIndex != null && hb?.step && STEP_INDEX[hb.step] === nowIndex ? (insideFraction(hb.read) ?? 0) : 0
  const fraction = sealed ? 1 : Math.max(0, Math.min(1, (done + inside) / HEARTBEAT_STEPS.length))
  const tone: RobotProgressTone = isVoid ? 'gray' : sealed ? 'green' : quiet ? 'amber' : 'blue'

  const words = sealed
    ? row.scored_at ? 'Scored.' : 'Sealed. Its number shows when you send.'
    : isVoid
      ? 'Set aside.'
      : nowIndex != null && (!hb?.step || STEP_INDEX[hb.step] !== nowIndex || hbState === 'done')
        ? `${HEARTBEAT_STEP_WORDS[HEARTBEAT_STEPS[nowIndex]!]}.`
        : heartbeatWords(hb, hbState === 'done' ? 'working' : hbState)
  const lastWord = lastWordAt ? `Last word ${relativeTimeFrom(lastWordAt, nowMs)}.` : ''
  const sentence = sealed || isVoid
    ? words
    : quiet
      ? `The robot went quiet on this bid ${relativeTimeFrom(lastWordAt!, nowMs)}. Another round picks it up within ten minutes.`
      : [`Step ${done + 1} of ${HEARTBEAT_STEPS.length}.`, words, lastWord].filter(Boolean).join(' ')

  return {
    steps,
    done,
    nowIndex,
    fraction,
    tone,
    sealed,
    void: isVoid,
    quiet,
    live,
    lastWordAt,
    sentence,
    words,
    host: row.key_label?.trim() || null,
    usualWords: usualRunWords(row.median_minutes),
  }
}

/** The ring's fill and tone for an icon with no progress row: by the icon's own state. */
export function ringFillForState(kind: string): { fraction: number; tone: RobotProgressTone } | null {
  switch (kind) {
    case 'queued':
      return { fraction: 0, tone: 'gray' }
    case 'working':
      return { fraction: 1 / HEARTBEAT_STEPS.length, tone: 'blue' }
    case 'sealed':
    case 'scored':
      return { fraction: 1, tone: 'green' }
    case 'needs':
      return { fraction: 0, tone: 'amber' }
    default:
      return null
  }
}

/**
 * v2.5751: the progress the icon, the sheet and the comparison modal draw for a bid. An unsent bid
 * shows its row whatever it says. A sent bid's icon reads its score, not an old run, so it shows
 * the row only while a robot is live on it — a coverage shadow worked after send (b497, 36 minutes
 * of real work behind a one-step fill); a stale, void or sealed row leaves the icon to its own state.
 */
export function ringProgressFor(progress: RobotProgress | null | undefined, bid: { bid_date_sent: string | null }): RobotProgress | null {
  if (!progress) return null
  if (!bid.bid_date_sent) return progress
  return progress.live ? progress : null
}

/**
 * v2.5751: the bids `robot_progress()` is asked about — every undecided bid of ours with a run or a
 * pairing, sent or not. A decided bid wears its grade and a backtest on it is the twins program's.
 */
export function progressBidIds<B extends { id: string; outcome: string | null }>(bids: readonly B[], hasRun: (bid: B) => boolean): string[] {
  return bids.filter((b) => !b.outcome && hasRun(b)).map((b) => b.id)
}

/** The map the board, the row and the sheet share: bid id → progress. */
export function robotProgressByBid(rows: readonly RobotProgressRow[], nowMs: number): ReadonlyMap<string, RobotProgress> {
  const out = new Map<string, RobotProgress>()
  for (const r of rows) if (!out.has(r.bid_id)) out.set(r.bid_id, buildRobotProgress(r, nowMs))
  return out
}
