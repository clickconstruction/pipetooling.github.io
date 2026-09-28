/**
 * Bids lens bars — which pills the 🤖 Robots bar and the Followup bar draw, for whom, and
 * what each says.
 *
 * The Bids map's step 3 (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended extraction order):
 * the two bars were ten hand-written copies of one segmented button in `src/pages/Bids.tsx`.
 * `BidsLensBar` draws what these answer. Pure: no React, no supabase.
 *
 * The role conditions are the bars' own, kept as they were — not `bidsTabOpenFor`: a Followup
 * lens can be entered by state alone (the Bid Board's Last contact door), where the router's
 * gates never ran.
 */
import { canWorkRobotAudits } from './bidAudits'
import type { BidsTabKey } from './bidsTabAccess'

type Role = string | null | undefined

/** `new` — emerald word pill; `count` — amber number pill; `dev` — the boxed DEV mark. */
export type BidsLensBadgeTone = 'new' | 'count' | 'dev'

export type BidsLens = {
  key: BidsTabKey
  label: string
  title?: string
  testId?: string
  badge?: { text: string; tone: BidsLensBadgeTone }
  /** Quiet words drawn before this pill, inside the bar ("Old:"). */
  leadIn?: string
}

/** The Robots bar draws only when more than one of its lenses has something to show. */
export function robotLensBarShows(input: { robotBidCount: number; anyAudits: boolean; role: Role }): boolean {
  return [input.robotBidCount > 0, input.anyAudits, canWorkRobotAudits(input.role)].filter(Boolean).length > 1
}

const DEV_BADGE = { text: 'DEV', tone: 'dev' } as const

/**
 * Robot Board · Audits · Scoreboard (audit roles) · Queue (dev, only while it is the open
 * lens — it opens from the Console) · Console (dev).
 */
export function robotLenses(input: { role: Role; activeTab: string; mirrorCount: number | null; auditsPending: number }): BidsLens[] {
  const lenses: BidsLens[] = [
    {
      key: 'robot-board',
      label: input.mirrorCount == null ? 'Robot Board' : `Robot Board · ${input.mirrorCount}`,
      title: "Our bids seen through the robots — the same sections as the Bid Board, with the robot's number and how far off it was once we sent.",
    },
    {
      key: 'audits',
      label: input.auditsPending > 0 ? `Audits · ${input.auditsPending}` : 'Audits',
      title: "Robot bids awaiting a human audit — quick links, the robot's questions, and your sectioned notes in one place.",
    },
  ]
  if (canWorkRobotAudits(input.role)) {
    lenses.push({
      key: 'robot-scoreboard',
      label: 'Scoreboard',
      title: 'How close the robots are to our numbers, by job type — your part, every sealed run on a live bid, and the practice runs on past bids.',
    })
  }
  // v2.3222: the Shadows lens folded into the Robot Board mirror; the dev Queue keeps its
  // URL (?tab=robot-queue) and opens from the Console lens (v2.3224) with the other operator tools.
  if (input.role === 'dev' && input.activeTab === 'robot-queue') {
    lenses.push({
      key: 'robot-queue',
      label: 'Queue',
      title: 'Dev only — every robot-able bid and the backtest candidates. Opens from the Console lens.',
      badge: DEV_BADGE,
    })
  }
  // Console (v2.3224, dev): the operator's desk — the Desktop setup command and kickoff, the
  // Claude Code handoff, the queue door, operator-lane questions, the run ledger. Estimators
  // never see this pill; keys and seats stay on Settings → Digital twins.
  if (input.role === 'dev') {
    lenses.push({
      key: 'robot-console',
      label: 'Console',
      title: "Dev only — run the robots: the Claude Desktop setup command and kickoff, the Claude Code handoff, which bids want a robot, the robots' operator questions, and the run ledger.",
      badge: DEV_BADGE,
    })
  }
  return lenses
}

/** Call queue · Old: By builder · By status · Why we lost · Waiting to hear · Job accounts; a superintendent keeps By builder alone. */
export function followupLenses(input: { role: Role; jobAccountsMissing: number }): BidsLens[] {
  if (input.role === 'superintendent') return [{ key: 'builder-review', label: 'By builder' }]
  return [
    { key: 'call-queue', label: 'Call queue', badge: { text: 'new', tone: 'new' } },
    { key: 'builder-review', label: 'By builder', leadIn: 'Old:' },
    { key: 'submission-followup', label: 'By status' },
    { key: 'why-we-lost', label: 'Why we lost' },
    { key: 'waiting-to-hear', label: 'Waiting to hear' },
    {
      key: 'job-accounts',
      label: 'Job accounts',
      title: 'Every won job still missing a supply-house account, grouped by house — one email per house',
      testId: 'followup-job-accounts-tab',
      ...(input.jobAccountsMissing > 0 ? { badge: { text: String(input.jobAccountsMissing), tone: 'count' as const } } : {}),
    },
  ]
}

/** The "N need a reason" chip beside the Followup bar: office roles, off the Why we lost lens, while any lost bid has no reason. */
export function followupNeedsReasonChipShows(input: { role: Role; activeTab: string; lostNeedingReason: number }): boolean {
  return input.role !== 'superintendent' && input.activeTab !== 'why-we-lost' && input.lostNeedingReason > 0
}

/** The one line beside the Followup bar that says what the open lens is for. */
export function followupLensCaption(activeTab: string): string {
  switch (activeTab) {
    case 'call-queue':
      return 'One queue — who to call, and what each call collects. The old lenses stay next door.'
    case 'builder-review':
      return 'The call queue — every builder, oldest contact first, all trades.'
    case 'submission-followup':
      return 'The status tables — outcome sections, followup sheets, scripts.'
    case 'why-we-lost':
      return 'Record and review why bids were lost — built for the Friday GC calls.'
    case 'job-accounts':
      return 'Every won job still missing a supply-house account — soonest first parts run first, one email per house.'
    default:
      return 'Chase recent sent bids for answers and bid tabs — newest first.'
  }
}
