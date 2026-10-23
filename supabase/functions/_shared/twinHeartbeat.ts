/**
 * The robot heartbeat's shape (Robot rounds, punch list #142, v2.5730). One copy, read by
 * twin-mcp (the writer) and by the client (`twinConsoleDisplay.ts` and, from PR 2, the bid's
 * robot sheet), tested from `src/lib/twins/twinHeartbeat.test.ts`. Pure: no Deno, no DOM.
 *
 * A heartbeat says where the robot is in words a person reads on the bid: the step (one of
 * seven), what it has read, what it has written, what it waits on, what comes next. The step
 * is also what the bar on the bid lights.
 */

export const HEARTBEAT_STATES = ['working', 'blocked', 'done', 'idle'] as const
export type HeartbeatState = (typeof HEARTBEAT_STATES)[number]

/** The seven steps of a robot's run on a bid, in order — the bar on the bid and the ring on the icon. */
export const HEARTBEAT_STEPS = ['picked_up', 'plans', 'reading', 'counting', 'pricing', 'sealed', 'questions'] as const
export type HeartbeatStep = (typeof HEARTBEAT_STEPS)[number]

/** The step's words, as the sheet, the ring's tooltip and the ledger print them. */
export const HEARTBEAT_STEP_WORDS: Record<HeartbeatStep, string> = {
  picked_up: 'Picked it up',
  plans: 'Plans filed',
  reading: 'Reading the sheets',
  counting: 'Counting',
  pricing: 'Pricing',
  sealed: 'Sealed',
  questions: 'Questions for you',
}

export type HeartbeatProgress = {
  step?: HeartbeatStep
  /** What it has read, e.g. "12 of 31 sheets". */
  read?: string
  /** What it has written, e.g. "two notes on my copy". */
  wrote?: string
  /** What it waits on, as the words after "Waiting on": "you: the plans", "nothing". */
  waiting_on?: string
  /** What it does next, e.g. "the fixture schedule on P-601". */
  next?: string
  /** On a collapsed idle row: how many rounds checked in during this stretch. */
  rounds?: number
  /**
   * On a round's check-in (v2.5753): how many live bids the one rule would let it claim right
   * then, counted by the server, and the bids it passes over with the reason. A stretch's
   * `nothing` is how many of its rounds saw no bid to claim, the count the Console's Today line
   * reads, so a round that went on to work a bid is not a round that found nothing.
   */
  ready?: number
  held?: HeartbeatHeld[]
  nothing?: number
}

/** One bid a round passed over: "b515", its project, and why in plain words. */
export type HeartbeatHeld = { bid: string; project?: string; why: string }

const TEXT_KEYS = ['read', 'wrote', 'waiting_on', 'next'] as const
const MAX_TEXT = 200
/** The same cap as `HELD_ON_CHECK_IN` in `shadowEligibility.ts`, which writes the list. */
const MAX_HELD = 12
const MAX_HELD_TEXT = 120

const nonNegativeInt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null)

function normalizeHeld(raw: unknown): HeartbeatHeld[] | null {
  if (!Array.isArray(raw)) return null
  const out: HeartbeatHeld[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const bid = typeof r.bid === 'string' ? r.bid.trim().slice(0, 24) : ''
    const why = typeof r.why === 'string' ? r.why.trim().slice(0, MAX_HELD_TEXT) : ''
    if (!bid || !why) continue
    const project = typeof r.project === 'string' && r.project.trim() ? r.project.trim().slice(0, MAX_HELD_TEXT) : undefined
    out.push(project ? { bid, project, why } : { bid, why })
    if (out.length >= MAX_HELD) break
  }
  return out.length ? out : null
}

/**
 * The shape a heartbeat may carry: known keys only, strings trimmed and capped, an unknown step
 * dropped. Null when nothing usable was sent, so the row's column stays null as before.
 */
export function normalizeHeartbeatProgress(raw: unknown): HeartbeatProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const out: HeartbeatProgress = {}
  const step = typeof r.step === 'string' ? r.step.trim().toLowerCase().replace(/[\s-]+/g, '_') : ''
  if ((HEARTBEAT_STEPS as readonly string[]).includes(step)) out.step = step as HeartbeatStep
  for (const k of TEXT_KEYS) {
    const v = r[k]
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, MAX_TEXT)
  }
  if (typeof r.rounds === 'number' && Number.isFinite(r.rounds) && r.rounds > 0) out.rounds = Math.floor(r.rounds)
  const ready = nonNegativeInt(r.ready)
  if (ready != null) out.ready = ready
  const nothing = nonNegativeInt(r.nothing)
  if (nothing != null) out.nothing = nothing
  const held = normalizeHeld(r.held)
  if (held) out.held = held
  return Object.keys(out).length ? out : null
}

/** A sentence for the shape, so the sheet, the icon and the ledger say the same thing. */
export function heartbeatWords(progress: HeartbeatProgress | null | undefined, state: string | null | undefined): string {
  if (state === 'idle') {
    const n = progress?.rounds ?? 0
    return n > 1 ? `Nothing to do. ${n} rounds found nothing.` : 'Nothing to do.'
  }
  if (state === 'blocked') {
    return progress?.waiting_on ? `Waiting on ${stripStop(progress.waiting_on)}.` : 'Blocked.'
  }
  if (state === 'done') return 'Done.'
  if (!progress?.step) return 'Working.'
  const head = HEARTBEAT_STEP_WORDS[progress.step]
  return progress.read ? `${head}, ${stripStop(progress.read)}.` : `${head}.`
}

/**
 * The bids a round passed over, from its check-in (v2.5753): "Passed over 2 bids. b516 Take 5,
 * made over 30 days ago and nobody asked. b519 Dollar Tree, not a plumbing bid." Empty when the
 * check-in carried none, so the Console's Today line never contradicts the Queue above it.
 */
export function heartbeatHeldWords(progress: HeartbeatProgress | null | undefined): string {
  const held = progress?.held ?? []
  if (held.length === 0) return ''
  const head = `Passed over ${held.length} bid${held.length === 1 ? '' : 's'}.`
  const items = held.map((h) => {
    const why = stripStop(h.why)
    const lower = why.charAt(0).toLowerCase() + why.slice(1)
    return `${h.bid}${h.project ? ` ${stripStop(h.project)}` : ''}, ${lower}.`
  })
  return [head, ...items].join(' ')
}

/** The rest of the shape, after the sentence: what it wrote and what comes next. */
export function heartbeatDetailWords(progress: HeartbeatProgress | null | undefined): string {
  if (!progress) return ''
  const parts: string[] = []
  if (progress.wrote) parts.push(`Wrote: ${stripStop(progress.wrote)}.`)
  if (progress.next) parts.push(`Next: ${stripStop(progress.next)}.`)
  return parts.join(' ')
}

function stripStop(s: string): string {
  return s.trim().replace(/[.!?]+$/, '')
}
