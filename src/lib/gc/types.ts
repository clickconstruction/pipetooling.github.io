/**
 * GC mode, the real build: the shapes the kernels read, the plan kernels' (`plans.ts`) first and the
 * job as the schedule's kernels read it at the end. They are the GC mode prototype's own shapes
 * (branch spike/gc-mode, `src/lib/gcMode/gcTypes.ts`), so its records fit them as they are. The plans:
 * to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md and SCHEDULE_REAL_BUILD.md on branch spike/gc-mode.
 */
import type { ProjectSchedule, ScheduleWhatIf } from './schedule/types'

/** One drawing in a set: its number, like "E-201", and its title. */
export interface PlanSheet {
  id: string
  title: string
  /** The office's pick, when the number's letters do not say which discipline it is (`SHEET_DISCIPLINES`). */
  discipline?: string
  /** The page of the plan PDF it was read from. */
  page?: number
}

/** One section of the project manual (the specs): its number, like "09 91 23", and its title. */
export interface SpecSection {
  id: string
  title: string
}

/** Work a trade's quote leaves out, and who does it instead: another trade, "the owner" or "us". */
export interface ScopeExclusion {
  label: string
  by: string
}

/**
 * Who our customer is to the job (the owner, 2026-10-04: "Sometimes we are working for the owner,
 * sometimes we are working for another GC or an owner's rep who then works and bills the owner").
 */
export type CustomerRole = 'owner' | 'gc' | 'ownersRep'

/** A line the office saved to the scope book by hand. */
export interface ScopeBookSaved {
  trade: string
  words: string
  spec?: string
  leavesOut?: ScopeExclusion
  savedOn: string
}

/** A change to a line of the scope book. A null spec or "leaves out" clears it. */
export interface ScopeBookEdit {
  trade: string
  /** The line as the book had it. */
  words: string
  to: { words: string; spec?: string | null; leavesOut?: ScopeExclusion | null }
}

/** Two lines of one trade that say the same thing: `from` folds into `into`. */
export interface ScopeBookMerge {
  trade: string
  from: string
  into: string
}

/** A named list of one trade's lines, taken into a scope in one press. */
export interface ScopeBookSet {
  id: string
  trade: string
  name: string
  lines: string[]
  savedOn: string
  /** The project whose scope it was saved from. */
  fromProjectId?: string
}

/**
 * What the office changed in the scope book (the owner, 2026-10-04). The book itself is read from
 * every scope on our jobs and the usual lines (`scopeBook`); this holds only the hand-made part.
 */
export interface ScopeBookStore {
  saved: ScopeBookSaved[]
  edits: ScopeBookEdit[]
  merges: ScopeBookMerge[]
  sets: ScopeBookSet[]
}

// ---------------------------------------------------------------------------------------------
// The job as main's kernels read it (the schedule's PR 1a, 2026-10-07)
// ---------------------------------------------------------------------------------------------

/*
 * Each shape below keeps the prototype's name (`gcTypes.ts`, branch spike/gc-mode) with only the
 * fields main's kernels read, so the prototype's own records fit it as they are. A lane that lifts
 * more kernels adds the fields they read. PR 6 of to-dos/gc-mode/SCHEDULE_REAL_BUILD.md builds
 * `GcProject` from New project's `GcProjectView` (`projectRows.ts`) and the schedule's rows.
 */

export type Includes = 'yes' | 'no' | 'unclear'

export interface ScopeItem {
  id: string
  label: string
}

export interface SubBid {
  amount: number
  includes: Record<string, Includes>
  /** The office's plug for a scope item the bid leaves out, so two bids compare like with like. */
  plugs: Record<string, number>
  /** Another way to do the work, at a different price: what it is, and what it adds (plus) or takes off (minus). */
  alternates?: BidAlternate[]
  /**
   * Alternates the office took, by label (question 14, the Board lane's call, 2026-10-04): a taken
   * alternate moves the all-in number and what we carry; one not taken changes nothing.
   */
  takenAlternates?: string[]
  /**
   * What their quote leaves out, as they listed it (the owner, 2026-10-04: track exclusions per
   * company). From the portal's quote form or typed by the office from an emailed quote.
   */
  exclusions?: QuoteExclusion[]
  /** The office's cost to cover each exclusion, by name, so the all-in number compares like with like. */
  exclusionCovers?: Record<string, number>
}

/** One thing a quote leaves out: the shared name ("Permits and fees"), their words, a unit price if it comes up. */
export interface QuoteExclusion {
  name: string
}

export interface BidAlternate {
  label: string
  /** Added to the number when plus, taken off when minus. */
  amount: number
}

export interface Invite {
  id: string
  partnerId: string
  bid: SubBid | null
}

export interface SovLine {
  id: string
  label: string
  amount: number
  pctReported: number
}

export interface Draw {
  number: number
}

export interface Sow {
  price: number
  sov: SovLine[]
  draws: Draw[]
  /** Pay applications the office sent back, oldest first. A resend takes the same number. */
  sentBack?: DrawSentBack[]
}

export interface TradePackage {
  id: string
  trade: string
  scope: ScopeItem[]
  /** Our own number for the trade before anyone bids. Carried as a plug when no bid is in. */
  budget: number
  /** We do this trade ourselves: the package is a Trades mode bid, not an invitation. */
  selfPerform: {
    ref: string
    value: number
    note: string
    /** Our own crew's percent done, reported on Bill the owner. Absent: nothing reported yet. */
    pctDone?: number
    /**
     * Our own crew's percent done on each stage (a scope line id), the way the Pipeline runs the
     * job (owner, 2026-10-02). When present, pctDone follows from it. Absent: none reported by stage.
     */
    pctByLine?: Record<string, number>
    /**
     * False: our own bid in Trades mode is started but not priced, so `value` is only our guess and
     * the trade is not a real number yet (the owner, 2026-10-02). Absent: priced.
     */
    priced?: boolean
  } | null
  invites: Invite[]
  /** An invite id, 'plug' (our budget) or 'self'. */
  carried: string | null
  awardedInviteId: string | null
  sow: Sow | null
  /** Work this trade's quote leaves out, and who does it instead. Missing: none said. */
  excludes?: ScopeExclusion[]
}

export interface Partner {
  id: string
  company: string
}

export interface GcProject {
  id: string
  name: string
  /** The day we pressed Start. The trades were told then. */
  startedOn: string | null
  /** Changes to our contract with the owner, oldest first. Absent: none yet. */
  changeOrders?: ChangeOrder[]
  packages: TradePackage[]
  /** The schedule we draw while buying out; Start locks it as the baseline (owner, 2026-10-02). */
  schedule?: ProjectSchedule
  /** A what-if copy of the schedule (the Gantt, G-81), beside it and never inside it: only the Schedule tab reads it. Unset: none open. */
  whatIf?: ScheduleWhatIf
}

export interface GcState {
  today: string
  projects: GcProject[]
  partners: Partner[]
}

/** A pay application the office sent back: the draw as the trade sent it, why, and what we see. */
export interface DrawSentBack {
  draw: Draw
  /** Lines where we see less done than they asked for. */
  lines: { sovId: string; weSee: number }[]
}

/**
 * A change to our contract with the owner: what changed, what it costs us, what it adds to their
 * price, and their signature. The owner side is the Owner Billing lane's; amending the trade's
 * statement of work to match is the Building lane's to add (new fields only).
 */
export interface ChangeOrder {
  id: string
  number: number
  /** What is changing, in a sentence, with the plan reference if there is one. */
  description: string
  /** The trade the work belongs to. Null: our own work, under general conditions. */
  packageId: string | null
  status: 'draft' | 'sent' | 'signed' | 'declined'
  /** The day the owner signed or declined it. */
  answeredOn: string | null
  /**
   * The days it adds to the job: the days a set of plans pushed the schedule out (New Project), or
   * typed by the office. Absent or 0: none. A signed one adds them to the contract time.
   */
  days?: number
  /**
   * A time extension for days on the chart already (the Gantt, G-141): the standing moves at the
   * customer's door its days come from. G-76 never puts its days on the schedule again, and once it
   * is signed G-98 stops counting those moves as the customer's. Unset: an ordinary change order.
   */
  daysOnChart?: string[]
}
