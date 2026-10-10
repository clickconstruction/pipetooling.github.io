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

/**
 * The bid tab for one trade: every quote, low to high, given back to the companies that quoted.
 * It is the thanks for bidding: a company that sees where it stood keeps answering our asks.
 */
export interface BidTab {
  sharedOn: string
  /** False: the other companies read "Another company". Each one always sees its own name. */
  showNames: boolean
  /** Partner ids that have opened it in their portal. */
  seenBy: string[]
}

/** A place a company drives from, or a project sits in. The real build reads the app's geocoded addresses. */
export interface Town {
  name: string
  lat: number
  lng: number
}

/** A question a trade asked about the plans. The architect answers; every bidder on the trade gets it. */
export interface PlanQuestion {
  id: string
  packageId: string
  partnerId: string
  text: string
  askedOn: string
  answeredOn: string | null
  answer: string | null
  /** The sheets the question is about. */
  sheets?: string[]
  /** The day we sent it to the architect. Missing: not sent yet. */
  sentToArchitectOn?: string
  /** Who got the answer, and when. */
  answerSentTo?: { partnerId: string; on: string }[]
  /** The plan set that carried the answer. */
  inSetRev?: number
  /** Asked at the pre-bid meeting, not by phone or email. */
  atPreBid?: boolean
}

/**
 * A pre-bid meeting or site walk before our bid is due (the owner, 2026-10-04: "Let's build the
 * pre bid meeting into the prototype"). The companies quoting are invited; what they ask there
 * goes the way of any question, and the minutes ride in the next set.
 */
export interface PreBidMeeting {
  /** The day, YYYY-MM-DD, and the time, like "10:00". */
  on: string
  at: string
  place: string
  /** Who runs it: the architect's meeting, or our own walk with the trades. */
  host: 'architect' | 'us'
  /** A company has to come to quote. */
  mandatory: boolean
  /** The companies that came, by partner id. Null: not held yet. */
  attended: string[] | null
  /** The set that carried the minutes. Missing: not sent yet. */
  minutesInSetRev?: number
  /**
   * The day it was set, or last moved: the day of the invitation every company got. A move sends a
   * new one. Missing: set before the prototype kept it.
   */
  setOn?: string
}

export interface PlanSet {
  rev: number
  label: string
  issuedOn: string
  /** Package ids whose scope this set changed. A bid priced on an older set is stale for them. */
  touches: string[]
}

export interface ScopeItem {
  id: string
  label: string
}

/** A line of a trade's own schedule of values, as it wrote it (question 4): often rough-in, top out, trim. */
export interface TheirSovLine {
  label: string
  amount: number
}

export interface SubBid {
  amount: number
  basedOnRev: number
  submittedOn: string
  includes: Record<string, Includes>
  /** The office's plug for a scope item the bid leaves out, so two bids compare like with like. */
  plugs: Record<string, number>
  note: string
  /** How many days the number holds from the day it was sent. Unset: the company did not say. */
  goodForDays?: number
  /** Another way to do the work, at a different price: what it is, and what it adds (plus) or takes off (minus). */
  alternates?: BidAlternate[]
  /** The company's own quote, attached in its portal. Only the file's name is kept in the prototype. */
  quoteFile?: string
  /**
   * Alternates the office took, by label (question 14, the Board lane's call, 2026-10-04): a taken
   * alternate moves the all-in number and what we carry; one not taken changes nothing.
   */
  takenAlternates?: string[]
  /** The company's own schedule of values, sent with its quote (question 4): "Rough-in", $98,000. Unset: not sent. */
  sov?: TheirSovLine[]
  /**
   * What their quote leaves out, as they listed it (the owner, 2026-10-04: track exclusions per
   * company). From the portal's quote form or typed by the office from an emailed quote.
   */
  exclusions?: QuoteExclusion[]
  /** Exclusion names they answered about: in `exclusions` means left out, otherwise it is in their price. */
  exclusionsAnswered?: string[]
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

/**
 * The kinds of email a company's people can get (owner, 2026-10-05): quotes and plans while we
 * bid; the job once it is theirs (its plans, answers, start days); contracts and changes; pay,
 * waivers, insurance and charges. Every kind goes to at least one person.
 */
export type PortalMailGroup = 'quotes' | 'job' | 'contracts' | 'pay'

/** Someone at a company besides its main contact, and the emails they get. */
export interface PartnerPerson {
  id: string
  name: string
  email: string
  /** What they do there, in the company's words ("Bookkeeper"). Empty: not said. */
  role: string
  gets: PortalMailGroup[]
}

/**
 * A charge to a trade (owner, 2026-10-05): cleanup, damage, or work we had to finish for it. The
 * company sees it in its portal with the reason and the photo, and agrees or disputes it by
 * `answerBy`. One it agreed to, one we kept after its dispute, or one it never answered can come
 * off an approved draw it has not been paid yet (`Draw.backCharges`).
 */
export interface BackCharge {
  id: string
  amount: number
  /** What it is for, in the office's words. */
  reason: string
  /** The photo sent with it: its name. Null: none. */
  photo: string | null
  sentOn: string
  /** The day to answer by. After it, a charge with no answer can come off a draw. */
  answerBy: string
  status: 'open' | 'agreed' | 'disputed' | 'kept' | 'dropped'
  /** The company's answer: the day, and its note when it disputed. */
  answer?: { on: string; note: string }
  /** The office's answer to a dispute, or why it dropped the charge. */
  settled?: { on: string; note: string }
  /** The draw it came off, and the day. */
  taken?: { drawId: string; on: string }
}

/**
 * A change a trade asked us for from its portal (Portal lane, owner 2026-10-04): it hit something on
 * site no one could see, the customer asked it for more, or the plans changed. The office makes it a
 * change order to the customer (`changeOrderId`) or turns it down with a reason. Once the customer
 * signs, the change goes to the trade to sign the usual way (`ChangeOrder.tradeChange`).
 */
export interface TradeChangeRequest {
  id: string
  packageId: string
  partnerId: string
  askedOn: string
  /** What changed, in the trade's words. */
  description: string
  reason: ChangeOrderReason
  /** What the trade asks for the work. */
  amount: number
  /** The working days it adds, as the trade sees it. 0: none. */
  days: number
  /** The file sent with it (a photo, a ticket): its name. Null: none. */
  file: string | null
  /** The change order the office made of it. Null: not yet. */
  changeOrderId: string | null
  /** The office turned it down: the day and why. Null: not turned down. */
  turnedDown: { on: string; note: string } | null
}

export interface Invite {
  id: string
  partnerId: string
  status: InviteStatus
  invitedOn: string
  /** The newest plan set this trade has opened in their portal. */
  seenRev: number | null
  bid: SubBid | null
  /** The last day the office chased them on this ask. */
  nudgedOn?: string
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
  /**
   * A line a signed change order added to the statement of work (Building lane): the change's
   * cost to the trade. Readers of the original contract leave these out (`sowContractSum` adds them).
   */
  changeOrderId?: string
}

export interface Draw {
  id: string
  number: number
  requestedOn: string
  gross: number
  retainage: number
  net: number
  status: 'requested' | 'approved' | 'paid'
  waiver: 'conditional' | 'unconditional'
  /** What the draw claims per line: work in place, and materials stored on site in dollars (question 12). */
  lines: { sovId: string; toPct: number; stored?: number }[]
  /** The G702/G703 the trade sent with this draw. Absent on a draw asked for without one. */
  payApp?: DrawPayApp
  /**
   * The retainage release: the last draw, asked for once the work is accepted. It pays back what
   * was held (retainage is negative, net is the release) and its waivers are the final-payment ones.
   */
  final?: boolean
  /** Approved for less than asked: what the trade asked for, why we approved less, and the day we did. */
  asked?: { gross: number; retainage: number; net: number; lines: { sovId: string; toPct: number; stored?: number }[]; note: string; on: string }
  /** The day we approved it. Unset: not yet, or before the day was kept. */
  approvedOn?: string
  /** The day we paid it. Unset: not yet, or before the day was kept. */
  paidOn?: string
  /** Back-charges the office took off this draw (Portal lane, owner 2026-10-05): net is already less by these. */
  backCharges?: { chargeId: string; amount: number }[]
}

export interface Sow {
  status: 'draft' | 'sent' | 'signed'
  price: number
  retainagePct: number
  basedOnRev: number
  sov: SovLine[]
  signedOn: string | null
  draws: Draw[]
  /** Closeout: the day we accepted the work, after the punch list. Null or absent: not yet. */
  acceptedOn?: string | null
  /** Pay applications the office sent back, oldest first. A resend takes the same number. */
  sentBack?: DrawSentBack[]
  /** What we charged the company for: cleanup, damage, work we finished for them. Oldest first (Portal lane). */
  backCharges?: BackCharge[]
  /** The day we sent it to the trade to sign. Unset: not sent, or before the day was kept. */
  sentOn?: string
  /**
   * The trade's own first schedule of values (the owner, 2026-10-04, question 4), from its quote at
   * award or sent later from its portal. Shown beside ours; draws stay by percent on ours.
   */
  theirSov?: TheirSovLine[]
  /**
   * What the contract says they will not do (the owner, 2026-10-04: "once we've got the job, we send
   * them a contract specifying what they're going to do"): their exclusions, each with who does it
   * instead when we know. Set at award from their quote.
   */
  excluded?: { name: string; by: string | null; unitPrice?: { amount: number; unit: string } }[]
}

export interface TradePackage {
  id: string
  trade: string
  bidTab: BidTab | null
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
  /** The estimator who awarded it (question 7). Unset: awarded before the prototype kept it. */
  awardedBy?: string
  /** The day it was awarded, for the company's Activity (2026-10-04). Unset: awarded before the prototype kept it. */
  awardedOn?: string
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
  /** Coverage: the town their crews drive from. Null: not set yet. */
  base: string | null
  /**
   * Coverage: the point they drive from, from the app's geocoded addresses (the real build, the
   * Board's B2). Unset: the town in `base` stands in, read from the prototype's list of towns.
   */
  basePoint?: Town
  /** Coverage: how far they are willing to drive, in miles. Null: not set yet. */
  maxMiles: number | null
  msa: 'none' | 'sent' | 'signed'
  msaSignedOn: string | null
  coiExpires: string | null
  w9: boolean
  invited: number
  bids: number
  won: number
  /** Promises of a quote date before today's live asks: how many they made, how many they kept. */
  promisesMade: number
  promisesKept: number
  /** Their mailing address for the pay application. Asked once, in their first one. */
  address?: string
  /** Their license line for the pay application. Optional. */
  license?: string
  /** The day they first went through their portal's welcome. Unset: never, or before the portal kept it. */
  portalOpenedOn?: string
  /** The day we sent the master agreement. Unset: not sent, or before the day was kept. */
  msaSentOn?: string
  /** Whether we have checked them (question 3). Unset: a company we know, approved. */
  vetting?: PartnerVetting
  /** Calls and notes with the company itself, not about one ask (the company window, 2026-10-04). Newest first. */
  contacts?: { on: string; by: string; note: string }[]
  /** The contact's phone and email, for Follow up's Call, Text and Email (the owner, 2026-10-04). Unset: a made-up one stands in (`partnerReach`). */
  phone?: string
  email?: string
  /** Others at the company and the emails each gets, named in its portal (Portal lane, owner 2026-10-05). */
  people?: PartnerPerson[]
  /** The emails the main contact gets. Unset: every kind. */
  contactGets?: PortalMailGroup[]
}

/** What we have billed the owner on a project we are building, and what they have paid. */
export interface OwnerBilling {
  billed: number
  paid: number
  retainageHeld: number
  /** Our pay applications to the owner, oldest first, as each went. Absent: none sent yet. */
  payApps?: OwnerPayAppSent[]
  /** The day the owner accepted the work, recorded by our office (O7a) or pressed in their portal (O7c). Absent: not yet. Our final pay application waits for it. */
  acceptedOn?: string
  /** They accepted it in their portal (O7c). Absent: our office recorded it. */
  acceptedInPortal?: boolean
  /** Interest on late bills we sent the owner, oldest first: a bill of its own, never on the pay application. */
  interestBills?: OwnerInterestBill[]
}

/** A bill for the interest on the owner's late bills (owner's go-ahead, 2026-10-04). */
export interface OwnerInterestBill {
  number: number
  sentOn: string
  amount: number
  paidOn: string | null
}

/**
 * One company, one record: the app's own customers. The same row can be the owner we build for,
 * the architect who drew the plans, and a GC we bid a trade to in Trades mode. What a company is
 * on a project is the project's to say (customerId, architectId), never the record's.
 */
export interface GcCustomer {
  id: string
  name: string
  contact: string
  phone: string
  email: string
  address: string
  /** Average days from our bill to their payment. Null: they have not paid us yet. */
  payDays: number | null
  retainagePct: number | null
  portalOn: boolean
  /** One call log, whatever they are to us. */
  contacts: { on: string; by: string; note: string }[]
}

export interface GcProject {
  id: string
  name: string
  address: string
  /** Where the job is, for the drive from each trade partner. */
  town: string
  /** Where the job is, from the app's geocoded addresses (the real build, the Board's B2). Unset: `town` stands in. */
  point?: Town
  /** The day our own bid went to the owner. Bid tabs stay shut until then. Null: not sent yet. */
  ourBidSentOn: string | null
  /** A rough schedule drawn while we bid, for our bid's weeks to build (G-45). Absent: none drawn. */
  rough?: RoughSchedule
  /** Going into the job: our contract with the owner, the permit, the day work starts. */
  ownerContractSignedOn: string | null
  /** The day our contract went to the customer to sign in their portal (the owner, 2026-10-04). Unset: not sent from the app. */
  ownerContractSentOn?: string
  /**
   * The owner's price as they signed it, by line: each trade by its package id, then 'gc',
   * 'contingency' and 'fee' (owner, 2026-10-04). Bill the owner reads it, so buying a trade out for
   * more or less never changes their price; only a change order does. Absent: not signed yet, or
   * signed before it was kept, and the price follows what we carry (`ownerContractWorthNow`).
   */
  ownerContractWorth?: Record<string, number>
  /** Retainage that drops once the work is far enough along, if we chose it for this job. Absent: held to the end. */
  ownerRetainageStep?: OwnerRetainageStep
  /** Interest on the owner's late bills, if we chose to charge it on this job: a percent a month. Absent: none. */
  ownerLateInterest?: { pctPerMonth: number }
  /**
   * The contract's days to pay after the architect's certificate (`gc_projects.owner_pay_days`, decision 7). It stands
   * in for the customer's usual days to pay when they have never paid us (O5d). Null or absent: not typed.
   */
  ownerPayDays?: number | null
  /** The owner contract's fee a day for finishing past substantial completion (liquidated damages), as we entered it. Absent: none. */
  ownerLateFinish?: { perDay: number }
  permitOn: string | null
  startDate: string | null
  /** The day we pressed Start. The trades were told then. */
  startedOn: string | null
  customerId: string
  /** The customer's name, kept on the row for display. */
  owner: string
  propertyOwner?: string
  /**
   * Who our customer is to the job (the owner, 2026-10-04: "Sometimes we are working for the owner,
   * sometimes we are working for another GC or an owner's rep who then works and bills the owner"):
   * another general contractor or an owner's rep. Missing: the owner.
   */
  customerRole?: CustomerRole
  ownerBilling: OwnerBilling | null
  /** Changes to our contract with the owner, oldest first. Absent: none yet. */
  changeOrders?: ChangeOrder[]
  /** Changes the trades asked us for, from their portals, oldest first (Portal lane). Absent: none yet. */
  changeRequests?: TradeChangeRequest[]
  /** A customer record too: the firm that drew the plans. */
  architectId: string
  /** The firm's name, kept on the row for display. */
  architect: string
  questions: PlanQuestion[]
  stage: GcStage
  bidDue: string | null
  sizeNote: string
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
  /** The pre-bid meeting, once one is set. Missing: none. */
  preBid?: PreBidMeeting
  /** The punch list (Building lane, 2026-10-03): what is left to fix on each trade's work. Unset: none yet. */
  punch?: PunchItem[]
  /** The superintendent's daily log (Building lane, 2026-10-04): one per working day. Unset: none yet. */
  dailyLogs?: DailyLog[]
  /** The submittal register (Building lane, 2026-10-04): what each trade sends for approval before its work. Unset: none yet. */
  submittals?: Submittal[]
  /** The weekly reports sent to the customer (Building lane, 2026-10-05), every send, newest last. Unset: none yet. */
  weeklyReports?: WeeklyReportSent[]
  /** Questions about the plans while we build (RFIs; the owner, 2026-10-05), numbered in order. */
  rfis?: Rfi[]
  /** What the work waits on from outside the trades (the Gantt, Phase 4): deliveries, the customer's decisions, permits, the utility. Unset: none. */
  waits?: ScheduleWait[]
  /** The customer's schedule as we sent it on its own (the Gantt, G-94), every send kept as it went, newest last. Unset: never sent. */
  scheduleSends?: ScheduleSend[]
  /** A what-if copy of the schedule (the Gantt, G-81), beside it and never inside it: only the Schedule tab reads it. Unset: none open. */
  whatIf?: ScheduleWhatIf
  /** Each trade's own word on how many a day it will have on site in a week (G-142), from its portal, newest first. Unset: none yet. */
  crewCounts?: CrewCount[]
}

/** A weekly report as it went to the customer (Building lane, 2026-10-05): kept as sent, for their portal. */
export interface WeeklyReportSent {
  /** The Monday of the week it covers. */
  weekOf: string
  sentOn: string
  from: 'me' | 'company'
  /** Who sent it, from me: the signed-in name. */
  by: string
  /** Who it went to, and whether the architect was copied. */
  to: string
  copiedArchitect: boolean
  subject: string
  body: string
}

export type WeatherSky = 'clear' | 'cloudy' | 'rain' | 'storm' | 'wind'

export type SubmittalKind = 'product data' | 'shop drawings' | 'samples'

export type SubmittalAnswer = 'approved' | 'approved as noted' | 'revise'

/** One time a trade sent a submittal, and what came of it. */
export interface SubmittalRound {
  sentOn: string
  /** The file it sent, by name (the prototype keeps no files). */
  file: string
  note: string
  /** The day we sent it to the architect. Null: with us. */
  toArchitectOn: string | null
  /** The day the architect answered. Null: not yet. */
  answeredOn: string | null
  answer: SubmittalAnswer | null
  answerNote: string
}

/**
 * A submittal (owner, 2026-10-04): product data, shop drawings or samples a trade sends for the
 * architect's approval before its work. It holds the schedule lines it covers until approved, and
 * is needed by the first of their starts less the days to get it on site.
 */
export interface Submittal {
  id: string
  /** Its number in the register: the spec section and a count, "26 24 16-01". */
  number: string
  packageId: string
  title: string
  kind: SubmittalKind
  specSection?: string
  /** The schedule lines (activities) it holds until approved. */
  lineIds: string[]
  /** Days from approval to the material on site: ordering, making, shipping. */
  leadDays: number
  /** When no line it holds is on the schedule: the day it is needed approved by. */
  neededBy?: string
  askedOn: string
  rounds: SubmittalRound[]
}

/**
 * The superintendent's daily log for one day on the job (owner, 2026-10-04): the weather, who
 * was on site and how many, what got done, what held work up, and who came by.
 */
export interface DailyLog {
  /** The day it is for, YYYY-MM-DD. */
  date: string
  sky: WeatherSky
  /** Degrees Fahrenheit. */
  high: number
  low: number
  /** Work stopped for the weather. */
  weatherStop: boolean
  /** Each trade on site that day and how many workers. A trade not listed was not there. */
  crews: { packageId: string; workers: number }[]
  /** What got done, in the superintendent's words. */
  done: string
  /** What held work up: whose (null: the job's own), why, and a note. */
  delays: { packageId: string | null; reason: LookAheadReason; note: string }[]
  /** Inspections and visitors: the inspector, the owner's walk, the architect. */
  visitors: string
  /** The day it was written. Later than `date`: caught up after the day. */
  writtenOn: string
}

/**
 * One punch-list item (owner, 2026-10-03): something left to fix on a trade's work, found when our
 * superintendent walks it. The trade marks it fixed in its portal; our superintendent checks it.
 * We accept a trade's work once every item on it is checked fixed.
 */
export interface PunchItem {
  id: string
  packageId: string
  /** What is wrong, as our superintendent wrote it. */
  text: string
  /** Where on the job: a room, a grid line. */
  where?: string
  addedOn: string
  /** The day the trade said it is fixed. Null: still open. */
  fixedOn: string | null
  /** The day our superintendent checked it fixed. Null: not checked yet. */
  checkedOn: string | null
  /** Checked and not fixed: sent back to the trade, how many times, with the last note. */
  sentBack?: { times: number; note: string; on: string }
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
  /** Reminders sent to customers from their window, oldest first (the owner, 2026-10-04). */
  customerSends?: CustomerSend[]
  /** Schedule templates, oldest first (G-44): a job's shape for the next job like it. Unset: none saved. */
  scheduleTemplates?: ScheduleTemplate[]
}

/** What the trade typed on a draw's pay application. The numbers are rebuilt from the draws (`payApplicationForDraw`). */
export interface DrawPayApp {
  periodTo: string
  address: string
  license: string
  signedBy: string
  signedTitle: string
  signedOn: string
}

/** A pay application the office sent back: the draw as the trade sent it, why, and what we see. */
export interface DrawSentBack {
  draw: Draw
  on: string
  note: string
  /** Lines where we see less done than they asked for. */
  lines: { sovId: string; weSee: number }[]
}

/** One pay application we sent the owner, kept as it went. The next one starts from its lines. */
/**
 * Retainage the owner holds that drops partway (the owner, 2026-10-04: we may offer it and choose
 * it per job). The owner holds their full percent until the work is `atPct` done, then `toPct`.
 */
export interface OwnerRetainageStep {
  /** How far along the work is when it drops, in percent of our price: 50 is half done. */
  atPct: number
  /** What the owner holds after that, in percent. Below their full percent. */
  toPct: number
  /**
   * 'after': the lower percent on the work past that point; what they held before stays held.
   * 'all': the lower percent on all the work once it is that far along, so some of what they held comes back.
   */
  way: 'after' | 'all'
}

export interface OwnerPayAppSent {
  number: number
  /** The bill day it went for. One a month. */
  periodTo: string
  sentOn: string
  /** Done so far on each of the owner's lines when it went, by line id. */
  doneToDate: Record<string, number>
  /** Every line's done so far, added up. */
  workToDate: number
  retainagePct: number
  /** What the owner holds on the work done so far. */
  retainage: number
  /** What it asked the owner to pay. */
  due: number
  /** The day the owner paid it. Null until they do. */
  paidOn: string | null
  /** The final pay application: it asks for the retainage the owner held, with our waivers on final payment. */
  final?: boolean
  /** Each line's scheduled value when it went, by line id. Absent on the made-up ones: today's values stand in. */
  worthByLine?: Record<string, number>
  /**
   * What the architect certified the owner should pay (owner's call, 2026-10-03: the architect
   * certifies first). Null: waiting on the architect. Absent: the made-up history, certified as asked.
   */
  certified?: number | null
  certifiedOn?: string | null
  /** Why the architect certified less than we asked. */
  certifiedNote?: string
  /** What the owner paid, once paid: the certified amount. Absent: as asked. */
  paidAmount?: number
  /** Each payment the owner made on it, oldest first. A part payment leaves the rest open. Absent: none, or the made-up history. */
  payments?: { on: string; amount: number }[]
  /** The owner's word on when they will pay, oldest first. The newest counts; a passed one stays on the record. */
  promises?: { by: string; madeOn: string; note: string; who: 'office' | 'owner' }[]
  /** The retainage step it went under, if the job had one then. */
  retainageStep?: OwnerRetainageStep
  /** Materials stored on site, not yet in place, on each line when it went (column F). Absent: none. */
  storedByLine?: Record<string, number>
  /**
   * Our reminders to pay it, oldest first: the day sent, the pay-by day we asked for, the office's line. Never a promise.
   * `emailed` false: filed, but its email did not go (O5b: no log written back on it).
   */
  reminders?: { on: string; by: string; note: string; subject?: string; lines?: string[]; emailed?: boolean }[]
  /**
   * The customer turned its bill to card in their portal (O8b): the bill as certified (`base`), the 3% card fee, what
   * Stripe asks and its card page. `undone`: the office took it back to a check bill. Absent: never on card. The fee
   * is a recovery of Stripe's cost: every figure reads the bill at its base (O8c).
   */
  card?: OwnerPayAppCard
}

/** A pay application's bill on card (O8b, O8c), as `gc_owner_card_bills` and the bill's row hold it. */
export interface OwnerPayAppCard {
  /** The bill's id (`jobs_ledger_invoices`), for its pay link and Back to a check bill. */
  invoiceId: string
  state: 'onCard' | 'undone'
  base: number
  fee: number
  total: number
  /** The day they chose card in their portal. */
  chosenOn: string
  /** The card page (`hosted_invoice_url`); null once taken back. */
  payUrl: string | null
  /** The day the office took it back to a check bill. */
  undoneOn: string | null
}

/** Why the work changed, in the words the app's change orders already use. */
export type ChangeOrderReason = 'owner' | 'field' | 'plans'

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
  reason: ChangeOrderReason
  /** Plain words: "+2 working days", "none". */
  schedule: string
  /** The trade the work belongs to. Null: our own work, under general conditions. */
  packageId: string | null
  /** What the work costs us. Negative: a credit, work coming out. */
  cost: number
  /** What it adds to the owner's price: the cost plus our fee on it, unless the office typed another. */
  price: number
  status: 'draft' | 'sent' | 'signed' | 'declined'
  sentOn: string | null
  /** The day the owner signed or declined it. */
  answeredOn: string | null
  /** They pressed it in their portal (O7c). Absent: the office recorded it, or no answer yet. */
  answeredInPortal?: boolean
  /** The reason they gave for declining it, one line (O7c). Absent: none given. */
  declinedNote?: string
  /** Percent of its work done, for the owner's bill. */
  pctDone: number
  /**
   * The trade's side (Building lane): the change sent to the company on that trade as an amendment
   * to its statement of work. Once they sign, it is a line of their statement of work (`sovLineId`).
   */
  tradeChange?: { status: 'sent' | 'signed'; sentOn: string; signedOn: string | null; sovLineId: string }
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

/** What an RFI's answer changes: nothing, the plans (a new set follows from Plans), or cost and days. */
export type RfiImpact = 'none' | 'plans' | 'cost'

/**
 * A question about the plans while we build (an RFI; the owner, 2026-10-05: its own tab, trades ask
 * from their portal, needed 3 days before the work, a cost answer starts a change order in one
 * click). It holds the work it is about until it is answered. Bidding questions stay on Plans
 * (`PlanQuestion`); these start once the job is ours.
 */
export interface Rfi {
  id: string
  /** RFI-001, RFI-002… on the job. */
  number: number
  question: string
  sheets: string[]
  /** The trade it is about: a cost answer's change order goes on it. Null: our own work. */
  packageId: string | null
  /** Who asked: a trade, from its portal or by phone. Null: our superintendent. */
  partnerId: string | null
  askedOn: string
  /** The schedule activities (line ids) it holds until answered. */
  holds: string[]
  /** The answer is needed this many days before the first held work starts. */
  neededDays: number
  sentToArchitectOn: string | null
  answer: { on: string; text: string; by: 'architect' | 'us'; impact: RfiImpact; cost: number; days: number } | null
  /** The change order a cost answer started. Null: none yet. */
  changeOrderId: string | null
}

/**
 * A paper sent to a customer from its window (the owner, 2026-10-04): our contract to sign in their
 * portal (the first send, then reminders), or a reminder on a change order waiting on their signature.
 */
export interface CustomerSend {
  id: string
  customerId: string
  projectId: string
  paper: 'contract' | 'changeOrder'
  /** A change order's reminder: which one. */
  changeOrderId?: string
  /** Our contract's first send; later ones are reminders. */
  first?: boolean
  on: string
  /** The day we asked them to sign by. */
  by: string
  note: string
}
