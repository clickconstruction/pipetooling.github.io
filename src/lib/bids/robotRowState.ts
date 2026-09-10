/**
 * The Bid Board robot icon, one bid in → one state out.
 *
 * Since auto-shadowing (v2.2936, weekday batches since 2026-09-06) every
 * eligible plumbing bid gets a robot without anyone asking, so the icon no
 * longer offers a "request" click. On a live bid it says one of two things:
 * the robot is on it (queued → working → sealed → scored), or the robot needs
 * something from a person (plans it can't open, a question it asked). Sent
 * and decided bids wear their reference grade instead. One kernel decides the
 * glyph, the tooltip, the status timeline and the needs list, so the row and
 * its sheets can never disagree.
 *
 * Pure module — no React, no Supabase.
 */
import { robotBidReadiness, type RobotReadinessBidFields } from './robotBidReadiness'
import { ROBOT_INTAKE_ACCOUNT } from './robotReadinessLine'
import { referenceGrade, type ReferenceGradeLetter, type ReferencePresence } from './referenceGrade'
import type { ShadowRunRow } from './shadowStory'

export interface RobotRowBid extends RobotReadinessBidFields {
  id: string
  outcome: string | null
  bid_date_sent: string | null
  bid_value: number | string | null
  robot_opt_out?: boolean | null
  plans_robot_readable?: boolean | null
  plans_robot_probe_note?: string | null
  robot_requested_at?: string | null
}

export type RobotRowRun = Pick<
  ShadowRunRow,
  'status' | 'created_at' | 'locked_at' | 'scored_at' | 'delta_pct' | 'shadow_bid_number' | 'requested_by_name' | 'teacher_name'
>

export interface RobotRowInput {
  bid: RobotRowBid
  /** Name of the bid's service type ('Plumbing', 'Electrical', …); null when unknown. */
  serviceTypeName: string | null
  /** The paired twin bid's number (bids.twin_source_bid_id), null when none. */
  twinBidNumber: string | null
  /** The bid's shadow run from list_shadow_runs(), null when none. */
  run: RobotRowRun | null
  /** Open estimator-audience twin_questions about this bid. */
  openQuestions: number
  /** v2.3212: how many of those are plans asks — the robot needs a different plan set on this bid. */
  plansAsks?: number
  /** Counts/pricing presence from list_reference_presence(); null when not loaded for this bid. */
  presence: Pick<ReferencePresence, 'hasCounts' | 'hasPricing'> | null
}

export interface RobotGap {
  key: 'plans' | 'plans-unreadable' | 'service-type' | 'gc' | 'distance' | 'due-date'
  label: string
  fix: string
  /** Required gaps stop the robot; the rest are warnings shown in the sheet. */
  required: boolean
  /** Offer "Copy intake address" — the plans aren't shared with the robots' account. */
  copyIntake?: boolean
}

export type RobotRowState =
  | { kind: 'none'; title: string }
  | { kind: 'off'; reason: 'opt-out' | 'division'; title: string }
  | { kind: 'needs'; badge: string; title: string; gaps: RobotGap[]; questions: number }
  | { kind: 'queued'; title: string }
  | { kind: 'working'; title: string; twinBidNumber: string | null }
  | { kind: 'sealed'; title: string; lockedAt: string | null; twinBidNumber: string | null }
  | { kind: 'scored'; title: string; deltaPct: number | null; twinBidNumber: string | null }
  | { kind: 'grade'; title: string; grade: ReferenceGradeLetter }

const PLUMBING = /plumbing/i

function hasValue(bid: RobotRowBid): boolean {
  return bid.bid_value != null && Number(bid.bid_value) > 0
}

/** The gaps a robot would trip on, required first — shared by the icon and the needs sheet. */
export function robotGaps(bid: RobotRowBid): RobotGap[] {
  const readiness = robotBidReadiness(bid)
  const gaps: RobotGap[] = []
  const plansItem = readiness.items.find((i) => i.key === 'plans')
  if (plansItem && !plansItem.ok) {
    gaps.push({ key: 'plans', label: 'No plans link', fix: 'Paste the plan set (a Drive file or folder) on the Edit form under Job Plans.', required: true })
  } else if (bid.plans_robot_readable === false) {
    const note = bid.plans_robot_probe_note ?? ''
    const notShared = /not shared|no permission|403|404/i.test(note)
    gaps.push({
      key: 'plans-unreadable',
      label: notShared ? 'Plans aren’t shared with the robots' : 'Robots couldn’t open the plans',
      fix: notShared
        ? `Share the ${/folder/i.test(note) ? 'folder' : 'file'} with ${ROBOT_INTAKE_ACCOUNT} as Viewer, then check again from the Edit form.`
        : note || 'Open the link yourself — if it works for you, re-save the bid so the robots retry.',
      required: true,
      copyIntake: notShared,
    })
  }
  for (const item of readiness.items) {
    if (item.key === 'plans' || item.ok) continue
    gaps.push({ key: item.key, label: item.label, fix: item.fix, required: item.required })
  }
  return gaps
}

export function formatDeltaPct(delta: number | null | undefined): string | null {
  if (delta == null || !Number.isFinite(Number(delta))) return null
  const n = Number(delta)
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function robotRowState(input: RobotRowInput): RobotRowState {
  const { bid, run, twinBidNumber } = input
  const project = bid.project_name?.trim() || 'this bid'
  const twin = twinBidNumber ?? run?.shadow_bid_number ?? null

  // A decided bid is a reference — the icon answers "can a robot learn from this?".
  if (bid.outcome) return gradeState(input, project)

  if (bid.robot_opt_out === true) {
    return { kind: 'off', reason: 'opt-out', title: `Robots leave ${project} alone — opted out on the bid form (untick “Don’t let robots shadow this bid” to put it back)` }
  }
  if (input.serviceTypeName && !PLUMBING.test(input.serviceTypeName)) {
    return { kind: 'off', reason: 'division', title: `Robots don’t bid ${input.serviceTypeName.toLowerCase()} yet — plumbing only` }
  }

  const scored = run?.status === 'scored'
  const locked = scored || run?.status === 'locked'
  if (scored) {
    const delta = formatDeltaPct(run?.delta_pct)
    return {
      kind: 'scored',
      deltaPct: run?.delta_pct == null ? null : Number(run.delta_pct),
      twinBidNumber: twin,
      title: delta ? `Robot was ${delta} against your number on ${project} — click to compare` : `Robot scored against your number on ${project} — click to compare`,
    }
  }
  if (locked) {
    return {
      kind: 'sealed',
      lockedAt: run?.locked_at ?? null,
      twinBidNumber: twin,
      title: bid.bid_date_sent
        ? `Robot sealed its number on ${project} — it scores once your bid value is on record`
        : `Robot sealed its number on ${project} — it shows when you send`,
    }
  }

  const gaps = robotGaps(bid)
  const blocking = gaps.filter((g) => g.required)
  if (blocking.length > 0 || input.openQuestions > 0) {
    const q = input.openQuestions
    const title =
      q > 0 && blocking.length === 0
        ? (input.plansAsks ?? 0) > 0
          ? `Robot needs a different plan set on ${project} — click to fix${q > 1 ? ` (${q} open)` : ''}`
          : `Robot asked ${q === 1 ? 'a question' : `${q} questions`} about ${project} — click to answer`
        : `Robot needs something on ${project}: ${blocking[0]?.label.toLowerCase() ?? ''}${q > 0 ? ` · ${q} open question${q === 1 ? '' : 's'}` : ''}`
    return { kind: 'needs', badge: q > 0 ? String(q > 9 ? '9+' : q) : '?', title, gaps, questions: q }
  }

  if (bid.bid_date_sent) {
    // Sent without a robot: the record is history now — show what it can teach.
    if (run || twin) {
      return {
        kind: 'working',
        twinBidNumber: twin,
        title: twin ? `Robot bid b${twin} is on ${project} — click to compare` : `Robot is still working on ${project}`,
      }
    }
    return gradeState(input, project)
  }
  if (run || twin) {
    return { kind: 'working', twinBidNumber: twin, title: `Robot is on it — reading the plans and counting ${project}` }
  }
  return { kind: 'queued', title: `Robot queued — it picks up ${project} in the next batch` }
}

function gradeState(input: RobotRowInput, project: string): RobotRowState {
  const { bid, presence } = input
  // A decided bid grades from whatever is known (as the board always has); a
  // sent-undecided bid waits for the presence read so it never flashes a wrong letter.
  if (!bid.outcome && !presence) return { kind: 'none', title: '' }
  const grade = referenceGrade({
    hasPlans: !!bid.plans_link?.trim(),
    hasValue: hasValue(bid),
    hasCounts: presence?.hasCounts ?? false,
    hasPricing: presence?.hasPricing ?? false,
  })
  return { kind: 'grade', grade, title: `Reference grade ${grade} on ${project} — how much can a robot learn from this record? Click for details.` }
}

export interface RobotTimelineStep {
  label: string
  /** ISO instant when known; the sheet formats it. */
  at: string | null
  detail: string | null
  state: 'done' | 'now' | 'todo'
}

/** The status sheet's timeline: what the robot has done on this bid and what comes next. */
export function robotStatusTimeline(input: RobotRowInput): RobotTimelineStep[] {
  const { bid, run, twinBidNumber } = input
  const twin = twinBidNumber ?? run?.shadow_bid_number ?? null
  const claimed = !!(run || twin)
  const scored = run?.status === 'scored'
  const locked = scored || run?.status === 'locked'
  const sent = !!bid.bid_date_sent
  const delta = formatDeltaPct(run?.delta_pct)
  const teacher = run?.teacher_name ? ` · scored against ${run.teacher_name}’s number` : ''
  return [
    {
      label: claimed ? (run?.requested_by_name ? `Picked it up — asked for by ${run.requested_by_name}` : 'Picked it up') : 'Picks it up in the next batch',
      at: run?.created_at ?? null,
      detail: claimed ? (twin ? `robot bid b${twin}` : null) : 'Robots claim live plumbing bids with readable plans on a weekday batch.',
      state: claimed ? 'done' : 'now',
    },
    {
      label: 'Reads the plans, counts, and prices on its own book',
      at: null,
      detail: locked ? null : claimed ? 'In progress — its counts land on the robot bid as it goes.' : null,
      state: locked ? 'done' : claimed ? 'now' : 'todo',
    },
    {
      label: 'Seals its number',
      at: run?.locked_at ?? null,
      detail: locked && !scored ? 'Locked. Nobody sees the number until you send — not even the office.' : locked ? null : 'Locked away before your number exists, so it can’t anchor you.',
      state: locked ? 'done' : 'todo',
    },
    {
      label: sent ? 'You sent the bid' : 'You send the bid',
      at: bid.bid_date_sent ?? null,
      detail: sent ? null : 'Mark sent on the Cover Letter or Edit Bid; the score lands the moment a bid value is on record.',
      state: sent ? 'done' : locked ? 'now' : 'todo',
    },
    {
      label: scored ? `Scored ${delta ?? ''}`.trim() : 'Scored',
      at: run?.scored_at ?? null,
      detail: scored ? `Robot’s sealed total against the number you sent${teacher}.` : sent && locked ? 'Waiting on a bid value — add it on Edit Bid.' : null,
      state: scored ? 'done' : sent && locked ? 'now' : 'todo',
    },
  ]
}
