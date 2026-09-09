/**
 * Bid flow — the office's estimating poster ("When an estimate hits…"),
 * derived from data the bid already carries. One kernel decides what each
 * step means, so the board hairline, the opened-row strip and the workflow
 * tab strip can never disagree.
 *
 * The poster's twelve red-pen steps become ten here, because two pairs
 * read one signal each: Count + Import are both the bid's count rows, and
 * Send + Mark sent are both the sent date (the one sent rule, v2.2937).
 *
 * Rules honoured (docs pass 2026-09-09):
 * - Derive, never mint: every state reads existing columns and ledgers.
 * - "Sent" is `bids.bid_date_sent`; this kernel never re-derives it.
 * - A step the app keeps no record of is `untracked`, never "not done".
 * - Decided bids (won / lost / started) go quiet — no "next" ring.
 * - "Next" is the first unfinished step after the furthest finished one,
 *   so an old bid with no RFQ on record is not nagged about the RFQ desk.
 */

export type BidFlowStepKey =
  | 'drive'
  | 'rfq'
  | 'tooling'
  | 'count'
  | 'takeoffs'
  | 'price'
  | 'review'
  | 'letter'
  | 'filed'
  | 'sent'

export type BidFlowPhase = 'Intake' | 'Ask' | 'Count' | 'Build' | 'Review' | 'Letter' | 'Send'

export type BidFlowState = 'done' | 'next' | 'todo' | 'untracked' | 'loading'

/** Where a step's door lives. `edit` = the Edit Bid window; `review` = the Mark reviewed action; `null` = no door. */
export type BidFlowDoor = 'edit' | 'counts' | 'takeoffs' | 'labor' | 'pricing' | 'cover-letter' | 'review' | null

/** Facts the bid row does not carry; `null` = not loaded yet. */
export type BidFlowFacts = {
  hasRfq: boolean | null
  hasCounts: boolean | null
  hasTakeoffLines: boolean | null
  hasPriceAssignments: boolean | null
  hasRoom: boolean | null
}

export const EMPTY_BID_FLOW_FACTS: BidFlowFacts = {
  hasRfq: null,
  hasCounts: null,
  hasTakeoffLines: null,
  hasPriceAssignments: null,
  hasRoom: null,
}

/**
 * The bid columns the kernel reads (satisfied by `BidWithBuilder`).
 * `reviewed_at` is optional on purpose: a client built before the review
 * columns exist passes no key and the step reads as untracked; once the
 * column is on the row, `null` means "not yet" and a value means done.
 */
export type BidFlowSource = {
  drive_link: string | null
  plans_link: string | null
  count_tooling_link?: string | null
  count_tooling_plans_link: string | null
  bid_value: number | null
  bid_date_sent: string | null
  bid_submission_link: string | null
  outcome: string | null
  reviewed_at?: string | null
}

export type BidFlowStep = {
  key: BidFlowStepKey
  n: number
  label: string
  /** The poster's own words for the step. */
  poster: string
  phase: BidFlowPhase
  state: BidFlowState
  /** What the app reads to decide this step — shown in the tooltip so the proxy is never hidden. */
  proxy: string
  door: BidFlowDoor
}

export type BidFlow = {
  steps: BidFlowStep[]
  doneCount: number
  /** Steps that can be tracked at all (everything but `untracked`). */
  trackedCount: number
  /** First unfinished tracked step after the furthest finished one, or null. */
  next: BidFlowStep | null
  /** Any step still waiting on facts. */
  loading: boolean
  /** Won / lost / started — the strip renders quiet. */
  decided: boolean
  untrackedCount: number
}

type StepDef = Omit<BidFlowStep, 'state'>

export const BID_FLOW_STEP_DEFS: ReadonlyArray<StepDef> = [
  { key: 'drive', n: 1, label: 'Plans in Drive', poster: 'Load in Drive', phase: 'Intake', proxy: 'a project folder or plans link on the bid', door: 'edit' },
  { key: 'rfq', n: 2, label: 'Send RFQ', poster: 'Send RFQ', phase: 'Ask', proxy: 'a price request on the bid, app-sent or logged by hand', door: 'pricing' },
  { key: 'tooling', n: 3, label: 'Plans in Tooling', poster: 'Load in clicktooling', phase: 'Intake', proxy: 'a CountTooling link on the bid', door: 'edit' },
  { key: 'count', n: 4, label: 'Count & import', poster: 'Count, then import', phase: 'Count', proxy: 'count rows on the bid; the app cannot see CountTooling itself', door: 'counts' },
  { key: 'takeoffs', n: 5, label: 'Takeoffs', poster: 'Takeoffs from RFQ and loaded data', phase: 'Build', proxy: 'takeoff part lines on the bid', door: 'takeoffs' },
  { key: 'price', n: 6, label: 'Price', poster: 'Price', phase: 'Build', proxy: 'a bid value, or price-book assignments on the rows', door: 'pricing' },
  { key: 'review', n: 7, label: 'Review', poster: 'Review', phase: 'Review', proxy: 'the Mark reviewed stamp: who, when, and their notes', door: 'review' },
  { key: 'letter', n: 8, label: 'Cover letter', poster: 'Generate cover letter, save as PDF', phase: 'Letter', proxy: 'a published bid room, or the bid already sent', door: 'cover-letter' },
  { key: 'filed', n: 9, label: 'PDF filed', poster: 'Copy of PDF in Drive, link in app', phase: 'Letter', proxy: 'a bid submission link on the bid', door: 'cover-letter' },
  { key: 'sent', n: 10, label: 'Sent', poster: 'Send, follow up, mark sent', phase: 'Send', proxy: 'the sent date — the one sent rule', door: 'cover-letter' },
]

const DECIDED_OUTCOMES = new Set(['won', 'lost', 'started_or_complete'])

function nonBlank(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

type Eval = true | false | null | 'untracked'

/** `true` / `false` when the fact is known, `null` while loading, `'untracked'` when the app has no record. */
function evalStep(key: BidFlowStepKey, bid: BidFlowSource, facts: BidFlowFacts): Eval {
  switch (key) {
    case 'drive':
      return nonBlank(bid.drive_link) || nonBlank(bid.plans_link)
    case 'rfq':
      return facts.hasRfq
    case 'tooling':
      return nonBlank(bid.count_tooling_plans_link) || nonBlank(bid.count_tooling_link)
    case 'count':
      return facts.hasCounts
    case 'takeoffs':
      return facts.hasTakeoffLines
    case 'price':
      if (typeof bid.bid_value === 'number' && bid.bid_value > 0) return true
      return facts.hasPriceAssignments
    case 'review':
      if (!('reviewed_at' in bid) || bid.reviewed_at === undefined) return 'untracked'
      return nonBlank(bid.reviewed_at)
    case 'letter':
      if (nonBlank(bid.bid_date_sent)) return true
      return facts.hasRoom
    case 'filed':
      return nonBlank(bid.bid_submission_link)
    case 'sent':
      return nonBlank(bid.bid_date_sent)
  }
}

export function deriveBidFlow(bid: BidFlowSource, facts: BidFlowFacts = EMPTY_BID_FLOW_FACTS): BidFlow {
  const decided = DECIDED_OUTCOMES.has(bid.outcome ?? '')
  const evaluated = BID_FLOW_STEP_DEFS.map((def) => ({ def, v: evalStep(def.key, bid, facts) }))
  const loading = evaluated.some((e) => e.v === null)
  const lastDoneIdx = evaluated.reduce((acc, e, i) => (e.v === true ? i : acc), -1)
  const nextIdx = decided ? -1 : evaluated.findIndex((e, i) => i > lastDoneIdx && e.v === false)
  const steps: BidFlowStep[] = evaluated.map(({ def, v }, i) => {
    let state: BidFlowState
    if (v === 'untracked') state = 'untracked'
    else if (v === null) state = 'loading'
    else if (v) state = 'done'
    else if (i === nextIdx) state = 'next'
    else state = 'todo'
    return { ...def, state }
  })
  const doneCount = steps.filter((s) => s.state === 'done').length
  const untrackedCount = steps.filter((s) => s.state === 'untracked').length
  const next = steps.find((s) => s.state === 'next') ?? null
  return { steps, doneCount, trackedCount: steps.length - untrackedCount, next, loading, decided, untrackedCount }
}

/** One line for the strip header and every tooltip: "7 of 10 done · next: Cover letter". */
export function bidFlowSummary(flow: BidFlow): string {
  if (flow.loading) return 'reading the bid…'
  const base = `${flow.doneCount} of ${flow.trackedCount} done`
  if (flow.decided) return `${base} · decided`
  if (flow.next) return `${base} · next: ${flow.next.label}`
  return `${base} · waiting on the GC`
}

/** The hairline's segments: one per run of the same phase, in the poster's own order (Intake appears twice). */
export type BidFlowSegment = { phase: BidFlowPhase; steps: BidFlowStep[]; state: 'done' | 'next' | 'todo' | 'untracked' | 'loading' }

export function bidFlowSegments(flow: BidFlow): BidFlowSegment[] {
  const runs: Array<{ phase: BidFlowPhase; steps: BidFlowStep[] }> = []
  for (const s of flow.steps) {
    const last = runs[runs.length - 1]
    if (last && last.phase === s.phase) last.steps.push(s)
    else runs.push({ phase: s.phase, steps: [s] })
  }
  return runs.map((r) => {
    const tracked = r.steps.filter((s) => s.state !== 'untracked')
    let state: BidFlowSegment['state']
    if (tracked.length === 0) state = 'untracked'
    else if (tracked.some((s) => s.state === 'loading')) state = 'loading'
    else if (tracked.every((s) => s.state === 'done')) state = 'done'
    else if (tracked.some((s) => s.state === 'next')) state = 'next'
    else state = 'todo'
    return { phase: r.phase, steps: r.steps, state }
  })
}
