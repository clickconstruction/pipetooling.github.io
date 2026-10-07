/**
 * GC mode, the real build: the shapes the kernels read, the plan kernels' (`plans.ts`) first and the
 * job as the schedule's kernels read it at the end. They are the GC mode prototype's own shapes
 * (branch spike/gc-mode, `src/lib/gcMode/gcTypes.ts`), so its records fit them as they are. The plans:
 * to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md and SCHEDULE_REAL_BUILD.md on branch spike/gc-mode.
 */
import type { CrewCount, LookAheadReason, ProjectSchedule, RoughSchedule, ScheduleSend, ScheduleTemplate, ScheduleWait, ScheduleWhatIf } from './schedule/types'

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

export type InviteStatus = 'invited' | 'opened' | 'bid' | 'declined'

/**
 * One line of the story with a company on one ask: a call, a text, an email, a nudge, or what
 * they said in their portal. A line can carry their word: the day they said the quote will come.
 */
export interface AskContact {
  on: string
  by: string
  how: 'call' | 'text' | 'email' | 'nudge' | 'portal'
  note: string
  /** Their promise: the quote by this day. The newest one on the ask is the one that counts. */
  promisedBy?: string
}

/** Quick picks for why a company is out of an ask (gcDecline.ts has the words). */
export type DeclineReason = 'busy' | 'far' | 'size' | 'scope' | 'terms' | 'other'

export interface DeclineReasonNote {
  reason: DeclineReason
  /** Their words, as the office took them. Optional unless the reason is 'other'. */
  note: string
  on: string
}

/** What a new company tells us about itself in its portal (question 3). */
export interface PartnerVettingForm {
  license: string
  /** Their insurance company and the policy's limits, as they wrote it. */
  insurance: string
  yearsInBusiness: number
  /** Two or three people we can call, as they wrote them. */
  references: string
  /** Jobs like ours they did, as they wrote them. */
  pastJobs: string
  sentOn: string
}

/**
 * Where a company stands with us (the owner, 2026-10-04, question 3): anyone can quote, and award
 * stays locked until the office approves them. A known company has no record and counts as approved.
 */
export interface PartnerVetting {
  status: 'new' | 'approved' | 'declined'
  /** Approved up to this many dollars on one award. Unset: no limit. */
  limit?: number
  /** The day the office decided, and who. */
  decidedOn?: string
  decidedBy?: string
  /** Why we declined, or a note on the approval. */
  note?: string
  /** Their form. Unset: not sent yet. */
  form?: PartnerVettingForm
}

/** Promises other than a quote date (question 8). Each lane keeps its own kinds; see gcPromises.ts. */
export type PromiseKind = 'insurance' | 'w9' | 'sow' | 'start' | 'submittals' | 'delivery' | 'payApp' | 'punch' | 'closeout' | 'msa'

/** A paper the office sends a trade from its company window (the owner, 2026-10-04): to sign, or to send us. */
export type PaperKind = 'msa' | 'sow' | 'insurance' | 'w9' | 'waiver'

/** One send of a paper from the company window: the first one, or a reminder. Each sets the day it is due. */
export interface PaperSend {
  id: string
  partnerId: string
  paper: PaperKind
  projectId?: string
  packageId?: string
  on: string
  /** The day it is due: sign by, or send by. Follow up chases it after. */
  by: string
  /** A line of the office's own, added to the email. */
  note: string
  /** The first send of a master agreement or a statement of work: the same send the Contracts tab makes. */
  first: boolean
  /** A lien waiver's draws, by number. */
  draws?: number[]
}

/**
 * A date a company gave us for something other than a quote (the owner, 2026-10-04, question 8).
 * It is kept when the thing happens (`promisesKeptBy` in gcPromises.ts) or when the office marks it.
 */
export interface TradePromise {
  id: string
  partnerId: string
  kind: PromiseKind
  /** The job and trade it is for. Unset: about the company itself (insurance, a W-9). */
  projectId?: string
  packageId?: string
  /** What they promised, in a few words: "the renewed insurance certificate". */
  what: string
  by: string
  madeOn: string
  /** Who wrote it down: the office (they said it on the phone) or the trade (in its portal). */
  from: 'office' | 'trade'
  /** Earlier dates they gave for the same thing, newest first: a day that passed before it moved counts against them. */
  moved?: { by: string; on: string }[]
  /** The day it came. Unset: not yet. */
  keptOn?: string
}

/** One of our people on a project, for a trade to call: the superintendent on site, the project manager. */
export interface ProjectContact {
  role: 'superintendent' | 'projectManager'
  name: string
  phone: string
  email?: string
}

/** Why a bid to an owner was lost: Trades mode's loss reasons, in GC words (gcLost.ts). */
export type GcLostWhy = 'price' | 'other_builder' | 'project_died' | 'no_bid' | 'no_answer'

export interface PlanSet {
  rev: number
  /** Package ids whose scope this set changed. A bid priced on an older set is stale for them. */
  touches: string[]
}

export interface ScopeItem {
  id: string
  label: string
}

export interface SubBid {
  amount: number
  basedOnRev: number
  submittedOn: string
  includes: Record<string, Includes>
  /** The office's plug for a scope item the bid leaves out, so two bids compare like with like. */
  plugs: Record<string, number>
  /** How many days the number holds from the day it was sent. Unset: the company did not say. */
  goodForDays?: number
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
  /** Their own words, when they differ from the name. */
  said?: string
  /** "$38 per cy": what it costs if it comes up, for things like rock. */
  unitPrice?: { amount: number; unit: string }
}

export interface BidAlternate {
  label: string
  /** Added to the number when plus, taken off when minus. */
  amount: number
}

export interface Invite {
  id: string
  partnerId: string
  status: InviteStatus
  invitedOn: string
  bid: SubBid | null
  /** Why they are out, when the office took the answer by phone: will not do it, or cannot. */
  declinedWhy?: 'wont' | 'cant'
  /** The reason the office wrote down with it (the owner, 2026-10-04); kept with the job and the company. */
  declineReason?: DeclineReasonNote
  /** Every contact on this ask, newest first. Lines are added, never changed. */
  contacts?: AskContact[]
}

export interface SovLine {
  id: string
  label: string
  amount: number
  pctReported: number
  pctBilled: number
}

export interface Draw {
  number: number
  retainage: number
  net: number
  status: 'requested' | 'approved' | 'paid'
  waiver: 'conditional' | 'unconditional'
}

export interface Sow {
  status: 'draft' | 'sent' | 'signed'
  price: number
  sov: SovLine[]
  draws: Draw[]
  /** Pay applications the office sent back, oldest first. A resend takes the same number. */
  sentBack?: DrawSentBack[]
  /** The day we sent it to the trade to sign. Unset: not sent, or before the day was kept. */
  sentOn?: string
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

export type GcStage = 'pursuing' | 'buyout' | 'building'

export interface Partner {
  id: string
  company: string
  contact: string
  trades: string[]
  msa: 'none' | 'sent' | 'signed'
  msaSignedOn: string | null
  coiExpires: string | null
  w9: boolean
  invited: number
  bids: number
  /** Promises of a quote date before today's live asks: how many they made, how many they kept. */
  promisesMade: number
  promisesKept: number
  /** The day we sent the master agreement. Unset: not sent, or before the day was kept. */
  msaSentOn?: string
  /** Whether we have checked them (question 3). Unset: a company we know, approved. */
  vetting?: PartnerVetting
  /** The contact's phone and email, for Follow up's Call, Text and Email (the owner, 2026-10-04). Unset: a made-up one stands in (`partnerReach`). */
  phone?: string
  email?: string
}

/**
 * One company, one record: the app's own customers. The same row can be the owner we build for,
 * the architect who drew the plans, and a GC we bid a trade to in Trades mode. What a company is
 * on a project is the project's to say (customerId, architectId), never the record's.
 */
export interface GcCustomer {
  id: string
  name: string
}

export interface GcProject {
  id: string
  name: string
  address: string
  /** Where the job is, for the drive from each trade partner. */
  town: string
  /** The day our own bid went to the owner. Bid tabs stay shut until then. Null: not sent yet. */
  ourBidSentOn: string | null
  /** A rough schedule drawn while we bid, for our bid's weeks to build (G-45). Absent: none drawn. */
  rough?: RoughSchedule
  /** The day we pressed Start. The trades were told then. */
  startedOn: string | null
  customerId: string
  /** The customer's name, kept on the row for display. */
  owner: string
  /**
   * Who our customer is to the job (the owner, 2026-10-04: "Sometimes we are working for the owner,
   * sometimes we are working for another GC or an owner's rep who then works and bills the owner"):
   * another general contractor or an owner's rep. Missing: the owner.
   */
  customerRole?: CustomerRole
  /** Changes to our contract with the owner, oldest first. Absent: none yet. */
  changeOrders?: ChangeOrder[]
  stage: GcStage
  bidDue: string | null
  planSets: PlanSet[]
  packages: TradePackage[]
  generalConditions: number
  contingencyPct: number
  feePct: number
  /** The day we closed the job: every trade closed out and our own crew done. */
  closedOn?: string | null
  /** The schedule we draw while buying out; Start locks it as the baseline (owner, 2026-10-02). */
  schedule?: ProjectSchedule
  /** Our people on the job, for a trade to call (Portal lane). Unset: none named yet. */
  team?: ProjectContact[]
  /**
   * The day we heard the owner picked another builder (owner, 2026-10-03). The project keeps its
   * stage ('pursuing') and leaves Bidding for the board's Lost section. Absent or null: not lost.
   */
  lostOn?: string | null
  /** Why we lost it, in Trades mode's loss reasons (gcLost.ts). */
  lostWhy?: GcLostWhy | null
  /** Who the owner picked, when we know. */
  wonBy?: string | null
  /** The superintendent's daily log (Building lane, 2026-10-04): one per working day. Unset: none yet. */
  dailyLogs?: DailyLog[]
  /** What the work waits on from outside the trades (the Gantt, Phase 4): deliveries, the customer's decisions, permits, the utility. Unset: none. */
  waits?: ScheduleWait[]
  /** The customer's schedule as we sent it on its own (the Gantt, G-94), every send kept as it went, newest last. Unset: never sent. */
  scheduleSends?: ScheduleSend[]
  /** A what-if copy of the schedule (the Gantt, G-81), beside it and never inside it: only the Schedule tab reads it. Unset: none open. */
  whatIf?: ScheduleWhatIf
  /** Each trade's own word on how many a day it will have on site in a week (G-142), from its portal, newest first. Unset: none yet. */
  crewCounts?: CrewCount[]
}

/**
 * The superintendent's daily log for one day on the job (owner, 2026-10-04): the weather, who
 * was on site and how many, what got done, what held work up, and who came by.
 */
export interface DailyLog {
  /** The day it is for, YYYY-MM-DD. */
  date: string
  /** Work stopped for the weather. */
  weatherStop: boolean
  /** Each trade on site that day and how many workers. A trade not listed was not there. */
  crews: { packageId: string; workers: number }[]
  /** What held work up: whose (null: the job's own), why, and a note. */
  delays: { packageId: string | null; reason: LookAheadReason; note: string }[]
}

export interface GcState {
  today: string
  customers: GcCustomer[]
  projects: GcProject[]
  partners: Partner[]
  /** Promises other than a quote date (question 8). Unset: none yet. */
  tradePromises?: TradePromise[]
  /** Papers sent from a company window, oldest first (the owner, 2026-10-04). */
  paperSends?: PaperSend[]
  /** Schedule templates, oldest first (G-44): a job's shape for the next job like it. Unset: none saved. */
  scheduleTemplates?: ScheduleTemplate[]
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
  sentOn: string | null
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
