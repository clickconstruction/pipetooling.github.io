/**
 * One rule for which live bid gets a robot (v2.5753, punch list #142 follow-up). Read by the
 * client's Queue and Console (the Ready count and the Held list) and by twin-mcp's
 * `next_shadow`, `get_shadow_queue` and a round's check-in heartbeat, so the count a person
 * reads and the bid the dispatcher claims can never disagree. Seen live 2026-10-23: the
 * Console read *Ready · 4* while the rounds reported *found nothing to do* — the client and the
 * dispatcher each had their own rule, and the round's own step 1 had no word on whether a
 * shell of its own was void, parked or orphaned. Pure: no Deno, no DOM, no supabase.
 */

/** The bid columns the rule reads. Logistics only: no value, no counts. */
export type ShadowCandidateBid = {
  id: string
  bid_number: string | number | null
  project_name: string | null
  plans_link: string | null
  service_type_id: string | null
  bid_due_date: string | null
  bid_date_sent: string | null
  outcome?: string | null
  created_at?: string | null
  robot_requested_at?: string | null
  robot_opt_out?: boolean | null
  plans_robot_readable?: boolean | null
  working_board_archived_at?: string | null
}

export type ShadowRunStatus = 'open' | 'locked' | 'scored' | 'void'

/** Why the rounds pass a bid over, the most final reason first. */
export type ShadowHoldReason =
  | 'robot_copy'
  | 'sent'
  | 'decided'
  | 'archived'
  | 'opted_out'
  | 'no_service_type'
  | 'not_plumbing'
  | 'no_plans'
  | 'plans_unreadable'
  | 'has_shadow'
  | 'stale_due'
  | 'too_old'

/** An unrequested bid older than this is left alone; a person's ask has no age limit. */
export const SHADOW_LOOKBACK_DAYS = 30
/** A bid whose due date passed this long ago is dead on the board, whatever its sent date says. */
export const SHADOW_STALE_DUE_DAYS = 30
/** A shell with no heartbeat or ledger note for this long is orphaned: the next round's first job. */
export const ROUND_ORPHAN_MINUTES = 15

export type ShadowRuleContext = {
  /** The Plumbing service type's id; null when the caller does not know it yet, and the division is not checked. */
  plumbingServiceTypeId: string | null
  nowMs: number
  /** Today in the company's calendar, YYYY-MM-DD. */
  todayYmd: string
  /** The bid's live shadow run, if any. A voided run is not live: it ended that shell, not the bid. */
  runStatusFor: (bidId: string) => ShadowRunStatus | null | undefined
  lookbackDays?: number
  staleDueDays?: number
}

const isBlank = (s: string | null | undefined): boolean => !s || !s.trim()

/** The `ZZ ` prefix: a robot's own copy, never a candidate. */
export function isRobotCopyName(projectName: string | null | undefined): boolean {
  return /^zz /i.test((projectName ?? '').trimStart())
}

/** YYYY-MM-DD minus N days, in the calendar (no time zone round trip). */
export function ymdMinusDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - days * 86400_000
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * The reason this bid is not claimed right now, or null when the next round may take it. The
 * order is the order a person would want to hear it: what ends the bid for robots first, then
 * what a person can fix, then what time decided.
 */
export function shadowHold(bid: ShadowCandidateBid, ctx: ShadowRuleContext): ShadowHoldReason | null {
  if (isRobotCopyName(bid.project_name)) return 'robot_copy'
  if (bid.bid_date_sent) return 'sent'
  if (bid.outcome != null && bid.outcome !== '') return 'decided'
  if (bid.working_board_archived_at) return 'archived'
  if (bid.robot_opt_out === true) return 'opted_out'
  if (!bid.service_type_id) return 'no_service_type'
  if (ctx.plumbingServiceTypeId && bid.service_type_id !== ctx.plumbingServiceTypeId) return 'not_plumbing'
  if (isBlank(bid.plans_link)) return 'no_plans'
  if (bid.plans_robot_readable === false) return 'plans_unreadable'
  const run = ctx.runStatusFor(bid.id)
  if (run && run !== 'void') return 'has_shadow'
  const staleBefore = ymdMinusDays(ctx.todayYmd, ctx.staleDueDays ?? SHADOW_STALE_DUE_DAYS)
  if (bid.bid_due_date && bid.bid_due_date.slice(0, 10) < staleBefore) return 'stale_due'
  if (!bid.robot_requested_at) {
    const createdMs = bid.created_at ? Date.parse(bid.created_at) : NaN
    const sinceMs = ctx.nowMs - (ctx.lookbackDays ?? SHADOW_LOOKBACK_DAYS) * 86400_000
    if (Number.isFinite(createdMs) && createdMs < sinceMs) return 'too_old'
  }
  return null
}

/** The reason in plain words, one short sentence, as the Queue's Held list and the round's heartbeat say it. */
export function shadowHoldWords(reason: ShadowHoldReason, days: { lookbackDays?: number; staleDueDays?: number } = {}): string {
  switch (reason) {
    case 'robot_copy':
      return 'A robot copy, not a bid of ours.'
    case 'sent':
      return 'Sent already.'
    case 'decided':
      return 'Decided already.'
    case 'archived':
      return 'Archived from the board.'
    case 'opted_out':
      return 'Left to a person.'
    case 'no_service_type':
      return 'No service type on the bid.'
    case 'not_plumbing':
      return 'Not a plumbing bid.'
    case 'no_plans':
      return 'No plans on the bid.'
    case 'plans_unreadable':
      return 'The robot cannot read the plans link.'
    case 'has_shadow':
      return 'A robot bid is on it already.'
    case 'stale_due':
      return `Its due date passed over ${days.staleDueDays ?? SHADOW_STALE_DUE_DAYS} days ago.`
    case 'too_old':
      return `Made over ${days.lookbackDays ?? SHADOW_LOOKBACK_DAYS} days ago and nobody asked.`
  }
}

/**
 * The reasons a person expects to see on the Queue: a live plumbing bid with plans that the rounds
 * still pass over. A sent, decided or archived bid is not live; a robot copy is not ours; a bid
 * with no plans or no service type has its own door on the board; another trade's bid is not the
 * robots' work at all (v2.5755: the first live check-in on 2026-10-23 listed 20 old electrical
 * bids while the Queue read Held · 0); a bid with a robot on it is covered, not held.
 */
export const HELD_REASONS: ReadonlySet<ShadowHoldReason> = new Set<ShadowHoldReason>(['opted_out', 'plans_unreadable', 'stale_due', 'too_old'])

/** How many held bids a round's check-in carries; the Queue page lists them all. */
export const HELD_ON_CHECK_IN = 12

export type ShadowHeld<B extends ShadowCandidateBid> = { bid: B; reason: ShadowHoldReason; words: string }

export type ShadowQueue<B extends ShadowCandidateBid> = {
  /** A person asked: oldest ask first, no age limit. */
  requested: B[]
  /** Claimable now: due date soonest first, then the oldest made. */
  ready: B[]
  /** Live bids with plans the rounds pass over, with the reason, in the Ready order. */
  held: Array<ShadowHeld<B>>
}

const dueThenCreated = <B extends ShadowCandidateBid>(a: B, b: B): number => {
  const ad = a.bid_due_date ?? ''
  const bd = b.bid_due_date ?? ''
  if (ad && bd && ad !== bd) return ad < bd ? -1 : 1
  if (ad && !bd) return -1
  if (!ad && bd) return 1
  return (a.created_at ?? '').localeCompare(b.created_at ?? '')
}

/**
 * The queue as every reader draws it and the dispatcher claims it: requested first, oldest ask
 * on top; then ready, due soonest first; then held with the reason. `[...requested, ...ready][0]`
 * is the bid the next round takes.
 */
export function buildShadowQueue<B extends ShadowCandidateBid>(bids: readonly B[], ctx: ShadowRuleContext): ShadowQueue<B> {
  const requested: B[] = []
  const ready: B[] = []
  const held: Array<ShadowHeld<B>> = []
  for (const bid of bids) {
    const reason = shadowHold(bid, ctx)
    if (reason == null) {
      if (bid.robot_requested_at) requested.push(bid)
      else ready.push(bid)
    } else if (HELD_REASONS.has(reason)) {
      held.push({ bid, reason, words: shadowHoldWords(reason, ctx) })
    }
  }
  requested.sort((a, b) => (a.robot_requested_at ?? '').localeCompare(b.robot_requested_at ?? ''))
  ready.sort(dueThenCreated)
  held.sort((a, b) => dueThenCreated(a.bid, b.bid))
  return { requested, ready, held }
}

/** "b515" from a bid's number, whatever type the row carries it as. */
export function bidRef(bidNumber: string | number | null | undefined): string {
  const n = bidNumber == null ? '' : String(bidNumber).trim()
  return n ? `b${n}` : 'a bid'
}

// ---------------------------------------------------------------------------
// A round's own shells (step 1 of the rounds kickoff): what the server tells the round about
// each shell it holds, so the round never guesses from a bare bid list whether a shell is void,
// parked, in another round's hands or orphaned. Seen live 2026-10-22: a round picked up b500,
// a shell voided weeks earlier whose reference had been sent, and worked it to a lock the
// server refused. Seen 2026-10-23 00:12 on: b493, a ZZ Shadow with no run behind it (its
// reference gone), read as an open shell, so every round ended with "no new claim while this
// shell is open" and never called the dispatcher, while the Queue read Ready · 4.
// ---------------------------------------------------------------------------

export type ShellHold = 'closed' | 'parked' | 'in_hand' | 'orphaned'

export type ShellHoldInput = {
  /** The shell's shadow run status; null when the bid has no run. */
  status: ShadowRunStatus | null
  /** The bid is named as a shadow shell (`ZZ Shadow …`): with no run behind it, it is residue, closed. */
  namedShadow?: boolean
  /** The reference was sent: a shadow of it can never lock blind now. */
  referenceSent: boolean
  /** An open plans ask on the shell or its reference waits for a person. */
  parked: boolean
  /** The latest heartbeat or ledger note on the shell, ISO; null when it has none. */
  lastWordAt: string | null
}

/**
 * closed: void, locked or scored, the reference was sent, or a ZZ Shadow with no run behind it — not a round's to touch.
 * parked: waiting on a person's plans; `next_shadow` hands it back when the ask is answered.
 * in_hand: a word within the orphan window, so another round of this key is working it.
 * orphaned: open, unparked and silent past the window: the next round's first job.
 */
export function shellHold(input: ShellHoldInput, nowMs: number, orphanMinutes = ROUND_ORPHAN_MINUTES): ShellHold | null {
  if (!input.status) return input.namedShadow ? 'closed' : null
  if (input.status !== 'open' || input.referenceSent) return 'closed'
  if (input.parked) return 'parked'
  const last = input.lastWordAt ? Date.parse(input.lastWordAt) : NaN
  if (Number.isFinite(last) && nowMs - last <= orphanMinutes * 60_000) return 'in_hand'
  return 'orphaned'
}

/** `ZZ Shadow …`: the name `createShadowShell` gives every shadow shell. */
export function isShadowShellName(projectName: string | null | undefined): boolean {
  return /^zz shadow /i.test((projectName ?? '').trimStart())
}

/** The hold in the words the kickoff and the Console use. */
export function shellHoldWords(hold: ShellHold): string {
  switch (hold) {
    case 'closed':
      return 'Closed. Not yours to touch this round.'
    case 'parked':
      return 'Parked on a plans ask. Leave it parked.'
    case 'in_hand':
      return 'Another round of this key is working it. Leave it alone.'
    case 'orphaned':
      return `No word for ${ROUND_ORPHAN_MINUTES} minutes. Your first job: resume it.`
  }
}
