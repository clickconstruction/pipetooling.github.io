/**
 * GC mode — design spike. The record shapes: the state, every action, and the records inside them. Imports nothing.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */

export type GcStage = 'pursuing' | 'buyout' | 'building'

export type InviteStatus = 'invited' | 'opened' | 'bid' | 'declined'

export type Includes = 'yes' | 'no' | 'unclear'

export interface PlanSet {
  rev: number
  label: string
  issuedOn: string
  note: string
  changedSheets: string[]
  /** Package ids whose scope this set changed. A bid priced on an older set is stale for them. */
  touches: string[]
  /** Who was emailed when the set went out, and whether it changed their trade. */
  sentTo?: { partnerId: string; on: string; touched: boolean }[]
  /** Sheets this set adds to the index, with the titles the office gave them. */
  addedSheets?: PlanSheet[]
  /** Scope lines this set adds to trades already on the job. Quotes in before it never answered them. */
  addedLines?: { packageId: string; scopeId: string }[]
  /** Days this set added to scheduled activities, by line id. What waited on them moved too. */
  pushed?: { lineId: string; days: number }[]
  /** Sections of the project manual this set revises, like "09 91 23". */
  changedSpecs?: string[]
  /** Sections this set adds to the manual, with the titles the office gave them. */
  addedSpecs?: SpecSection[]
  /** Sheets this set takes out of the set. Each is in `changedSheets` too, so a reader of what changed sees it. */
  removedSheets?: string[]
  /** Sheets this set renames: the number stays, the title changes. Each is in `changedSheets` too. */
  retitledSheets?: PlanSheet[]
  /** Sections this set takes out of the manual, and the ones it renames. Each is in `changedSpecs` too. */
  removedSpecs?: string[]
  retitledSpecs?: SpecSection[]
  /**
   * Who on our team checked the set's files before it went out (the owner, 2026-10-04: the plans
   * live in Google Drive, uploaded by someone who checks them). Missing: a set from before.
   */
  checkedBy?: string
  /** Where the set's files are in Google Drive, and whether anyone with the link can open them. Missing: a set from before. */
  drive?: PlanSetDrive
}

/**
 * A set's Google Drive link (the owner, 2026-10-04: "I want to always have it go to a Google Drive
 * link"), with the last check of who can open it: anyone with the link, or only some people.
 */
export interface PlanSetDrive {
  url: string
  access: 'anyone' | 'restricted'
  checkedOn: string
}

/** One drawing in the set. The discipline is read from the number's letters (E-201 → Electrical). */
export interface PlanSheet {
  id: string
  title: string
  /** The discipline the office picked, where the number's letters do not say it. Missing: read from the letters. */
  discipline?: string
  /** The page of the plan PDF the sheet was read from. Missing: typed or pasted. */
  page?: number
}

/** Work a trade's quote leaves out, and who does it instead: another trade, "the owner" or "us". */
export interface ScopeExclusion {
  label: string
  by: string
}

/** One section of the project manual (the specs): its number, like "09 91 23", and its title. */
export interface SpecSection {
  id: string
  title: string
}

export interface ScopeItem {
  id: string
  label: string
  /**
   * The sheets this line reads from. Missing: not said, so a guess from the line's words is shown.
   * Empty: the trade's sheets as a whole, no one sheet in particular.
   */
  sheets?: string[]
  /** The sections of the project manual this line reads from. Missing: not said. */
  specs?: string[]
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

/** A line of a trade's own schedule of values, as it wrote it (question 4): often rough-in, top out, trim. */
export interface TheirSovLine {
  label: string
  amount: number
}

export interface BidAlternate {
  label: string
  /** Added to the number when plus, taken off when minus. */
  amount: number
}

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

/** Quick picks for why a company is out of an ask (gcDecline.ts has the words). */
export type DeclineReason = 'busy' | 'far' | 'size' | 'scope' | 'terms' | 'other'

export interface DeclineReasonNote {
  reason: DeclineReason
  /** Their words, as the office took them. Optional unless the reason is 'other'. */
  note: string
  on: string
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
  /** The day their warranty letter came in. Kept as a record: closeout no longer asks for it (owner, 2026-10-02). */
  warrantyOn?: string | null
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

/** A place a company drives from, or a project sits in. The real build reads the app's geocoded addresses. */
export interface Town {
  name: string
  lat: number
  lng: number
}

export interface Partner {
  id: string
  company: string
  contact: string
  trades: string[]
  /** Coverage: the town their crews drive from. Null: not set yet. */
  base: string | null
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
  /** The language the company chose in its portal; its messages go out in it too. Unset: English. */
  lang?: 'en' | 'es'
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

/** What we have billed the owner on a project we are building, and what they have paid. */
export interface OwnerBilling {
  billed: number
  paid: number
  retainageHeld: number
  /** Our pay applications to the owner, oldest first, as each went. Absent: none sent yet. */
  payApps?: OwnerPayAppSent[]
  /** The day the owner accepted the work in their portal. Absent: not yet. Our final pay application waits for it. */
  acceptedOn?: string
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
  kind: string
  contact: string
  contactRole: string
  phone: string
  email: string
  address: string
  /** As an owner. Null: they have never been one for us. */
  howTheyBuy: string | null
  /** Average days from our bill to their payment. Null: they have not paid us yet. */
  payDays: number | null
  retainagePct: number | null
  portalOn: boolean
  portalLastOpened: string | null
  /** As an architect: average days from a question to their answer. Null: no answer yet. */
  answerDays: number | null
  /** One call log, whatever they are to us. */
  contacts: { on: string; by: string; note: string }[]
  past: { name: string; year: number; outcome: 'built' | 'lost'; value: number; note: string }[]
  /** What Trades mode knows about the same company. */
  tradesNote: string | null
}

/** One of our people on a project, for a trade to call: the superintendent on site, the project manager. */
export interface ProjectContact {
  role: 'superintendent' | 'projectManager'
  name: string
  phone: string
  email?: string
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

/**
 * A rough schedule drawn while we bid (the Gantt's G-45): the start day and the stage lengths it is
 * drawn from, by the first draft's own kernel. Never the schedule itself: the trades' and the
 * customer's views read `GcProject.schedule`, and this stays out of it.
 */
export interface RoughSchedule {
  /** The day work would start, as the office assumes it while bidding. */
  start: string
  /** This job's stage lengths in days, by stage key. A stage not named takes its usual days. */
  days: Record<string, number>
  by: string
  on: string
  /** The weeks to build and the finish as they went with our bid: kept when the bid went in, or at award if it was never marked sent. */
  kept?: { on: string; weeks: number; finish: string; at: 'bid' | 'award' }
  /** The template it was drawn from (G-44). Unset: the stage days alone. */
  template?: TemplateUse
  /** A copy of that template's lines, so every redraw reads the copy and no edit to the template reaches the rough (G-44). */
  like?: TemplateLine[]
}

/**
 * A line of a schedule template (G-44): one line of a trade, or one of the two inspections the first
 * draft draws, as it ran on the job it was saved from. No dates: its days, what it waits on and how
 * many days after them it started.
 */
export interface TemplateLine {
  /** "Roofing". Empty for one of the job's two inspections. */
  trade: string
  /** "TPO membrane", or "Rough-in inspection". Another job's line of the same trade and name takes it, whatever the case. */
  label: string
  /** The stage the first draft puts it in. */
  stage: string
  /** Its days, both ends counted. */
  days: number
  /** The lines it waits on, by trade and name, each with the office's gap on that wait (G-35) when one was set. */
  after: { trade: string; label: string; gap?: number }[]
  /** Days after the last of those finished that it started. With nothing to wait on: days after the job's first day. */
  offset: number
}

/** A job's schedule shape kept to start the next job like it (G-44). Never dates, companies, percents or moves. */
export interface ScheduleTemplate {
  id: string
  name: string
  /** The job it was saved from, by its name then, and how much of its work was done. */
  from: { projectId: string; name: string; donePct: number }
  on: string
  by: string
  lines: TemplateLine[]
  /** Each stage's span on that job in days, first start to last finish, in build order: what the card shows. */
  stages: { key: string; days: number }[]
  /** From the job's first day to substantial completion, in whole weeks. */
  weeks: number
  /** Set aside: not offered for new jobs. The jobs drawn from it keep what they drew. */
  asideOn?: string
}

/** The template a draw came from, by the name it had that day (G-44). */
export interface TemplateUse {
  id: string
  name: string
  on: string
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
  /** The owner contract's fee a day for finishing past substantial completion (liquidated damages), as we entered it. Absent: none. */
  ownerLateFinish?: { perDay: number }
  permitOn: string | null
  startDate: string | null
  /** The day we pressed Start. The trades were told then. */
  startedOn: string | null
  /** Started before everything was in (question 7): who, why, and what was missing that day. */
  startedAnyway?: { by: string; reason: string; missing: string[] }
  customerId: string
  /** The customer's name, kept on the row for display. */
  owner: string
  /**
   * The owner of the property, when it is not our customer (the owner, 2026-10-04: "owner should
   * become customer and then there should be a button to add owner different than customer"): a
   * tenant finish-out, say, where the landlord owns the building. A customer record and its name,
   * like `customerId` and `owner`. Missing: the customer owns it.
   */
  propertyOwnerId?: string
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
  /** The sheet index of the bid set. An addendum names the sheets it changed or added. */
  sheets: PlanSheet[]
  /** The project manual's table of contents: its sections. Missing: no manual came in. */
  specs?: SpecSection[]
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
  lostNote?: string | null
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

/**
 * A trade's own word on how many people a day it will have on site in a week (G-142), from its
 * portal's look-ahead. Kept newest first: the newest for a trade and week is the one that counts,
 * and the ones before it say when a count was cut.
 */
export interface CrewCount {
  packageId: string
  partnerId: string
  /** The Monday of the week it is for. */
  weekOf: string
  /** About how many people a day, a whole number. 0: nobody that week. */
  count: number
  /** The day they said it. */
  on: string
}

/** The customer's schedule sent on its own, dated and kept as sent (G-94). */
export interface ScheduleSend {
  id: string
  on: string
  by: string
  /** Who it went to: the customer's contact and company. */
  to: string
  subject: string
  /** The letter, one paragraph a line. */
  lines: string[]
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

/** Why a bid to an owner was lost: Trades mode's loss reasons, in GC words (gcLost.ts). */
export type GcLostWhy = 'price' | 'other_builder' | 'project_died' | 'no_bid' | 'no_answer'

export interface LogEntry {
  id: number
  who: 'office' | 'trade'
  text: string
}

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

export interface GcState {
  today: string
  customers: GcCustomer[]
  projects: GcProject[]
  partners: Partner[]
  log: LogEntry[]
  /** Promises other than a quote date (question 8). Unset: none yet. */
  tradePromises?: TradePromise[]
  /** Papers sent from a company window, oldest first (the owner, 2026-10-04). */
  paperSends?: PaperSend[]
  /** Reminders sent to customers from their window, oldest first (the owner, 2026-10-04). */
  customerSends?: CustomerSend[]
  /** The office's changes to the scope book. Unset: nothing changed yet. */
  scopeBook?: ScopeBookStore
  /** Schedule templates, oldest first (G-44): a job's shape for the next job like it. Unset: none saved. */
  scheduleTemplates?: ScheduleTemplate[]
}

export type GcAction =
  | { type: 'issueAddendum'; projectId: string; note: string; sheets: string[]; touches: string[]; recipients?: string[] }
  | { type: 'tradeConfirmBid'; projectId: string; packageId: string; inviteId: string }
  | { type: 'setStartItem'; projectId: string; item: 'ownerContract' | 'permit'; done: boolean }
  | { type: 'setStartDate'; projectId: string; date: string }
  /** `anyway`: start with steps still missing (the owner, 2026-10-04, question 7), saying why and who. */
  | { type: 'startProject'; projectId: string; anyway?: { reason: string; by: string } }
  | { type: 'invite'; projectId: string; packageId: string; partnerId: string }
  | { type: 'nudge'; projectId: string; packageId: string; inviteId: string; about: string }
  | {
      type: 'logContact'
      projectId: string
      packageId: string
      inviteId: string
      how: 'call' | 'text' | 'email'
      note: string
      promisedBy: string | null
    }
  | { type: 'tradePromise'; projectId: string; packageId: string; inviteId: string; promisedBy: string }
  | { type: 'tradeOpenPlans'; projectId: string; packageId: string; inviteId: string }
  | {
      type: 'tradeSubmitBid'
      projectId: string
      packageId: string
      inviteId: string
      amount: number
      includes: Record<string, Includes>
      note: string
      /** The portal's bid form adds these; a bid without them is the same as before. */
      goodForDays?: number
      alternates?: BidAlternate[]
      quoteFile?: string
      /** Their schedule of values (question 4). It should add up to the amount; the portal checks. */
      sov?: TheirSovLine[]
      /** What their quote leaves out, and the exclusion names they answered about (the portal's form). */
      exclusions?: QuoteExclusion[]
      exclusionsAnswered?: string[]
    }
  /** The office records an exclusion from an emailed quote, or that they now include one (excluded: false). */
  | { type: 'setQuoteExclusion'; projectId: string; packageId: string; inviteId: string; name: string; excluded: boolean; said?: string; unitPrice?: { amount: number; unit: string } }
  /** The office's cost to cover an exclusion on one quote. 0 clears it. */
  | { type: 'setExclusionCover'; projectId: string; packageId: string; inviteId: string; name: string; amount: number }
  /** The trade sends its schedule of values for a statement of work that has none yet (question 4). */
  | { type: 'tradeSendSov'; projectId: string; packageId: string; sov: TheirSovLine[] }
  | { type: 'tradeDecline'; projectId: string; packageId: string; inviteId: string }
  /** `reason` and `note` (the owner, 2026-10-04): why, kept with the job and the company. */
  | { type: 'officeDecline'; projectId: string; packageId: string; inviteId: string; why: 'wont' | 'cant'; reason?: DeclineReason; note?: string }
  | { type: 'setPlug'; projectId: string; packageId: string; inviteId: string; scopeId: string; amount: number }
  | { type: 'carry'; projectId: string; packageId: string; carried: string | null }
  | { type: 'markWon'; projectId: string }
  | { type: 'markBidSent'; projectId: string }
  | { type: 'shareBidTab'; projectId: string; packageId: string; showNames: boolean }
  | { type: 'tradeSeeBidTab'; projectId: string; packageId: string; partnerId: string }
  /** `by`: the estimator who awarded it (question 7: any estimator on our team); the bid tab names them to us. */
  | { type: 'award'; projectId: string; packageId: string; inviteId: string; by?: string }
  | { type: 'sendMsa'; partnerId: string }
  | { type: 'tradeSignMsa'; partnerId: string }
  | { type: 'sendSow'; projectId: string; packageId: string }
  | { type: 'tradeSignSow'; projectId: string; packageId: string }
  | { type: 'tradeReport'; projectId: string; packageId: string; sovId: string; pct: number }
  | { type: 'tradeRequestDraw'; projectId: string; packageId: string }
  | { type: 'approveDraw'; projectId: string; packageId: string; drawId: string }
  | { type: 'payDraw'; projectId: string; packageId: string; drawId: string }
  | { type: 'tradeSignUnconditional'; projectId: string; packageId: string; drawId: string }
  | { type: 'setMarkup'; projectId: string; field: 'generalConditions' | 'contingencyPct' | 'feePct'; value: number }
  | { type: 'logCustomerContact'; customerId: string; note: string }
  /** A call or note with a trade company, from its window's Activity tab. */
  | { type: 'logPartnerContact'; partnerId: string; note: string }
  /** Turn a customer's portal on (we send them the link) or off, from its window's *Their portal* tab. */
  | { type: 'setCustomerPortal'; customerId: string; on: boolean }
  /** Remind a customer to sign a change order, from its window, by a day (the owner, 2026-10-04). */
  | { type: 'remindCustomer'; customerId: string; projectId: string; changeOrderId: string; by: string; note: string }
  /** Send our contract to the customer to sign in their portal, or remind them, by a day (the owner, 2026-10-04). */
  | { type: 'sendOwnerContract'; projectId: string; by: string; note: string }
  /** The customer signs our contract in their portal. */
  | { type: 'ownerSignContract'; projectId: string }
  /** Send a paper from the company window: to sign, or to send us, due on a day (the owner, 2026-10-04). */
  | { type: 'sendPaper'; partnerId: string; paper: PaperKind; projectId?: string; packageId?: string; by: string; note: string }
  /** `known: false`: a company new to us, not vetted yet (question 3). Unset: one we know. */
  | { type: 'addPartner'; company: string; contact: string; trade: string; base: string | null; maxMiles: number | null; known?: boolean; address?: string }
  /** `address` (the owner, 2026-10-05): the office types where they are and the drive is worked out from it; `base` is then the town read from it. */
  | { type: 'setCoverage'; partnerId: string; base: string | null; maxMiles: number | null; address?: string }
  | { type: 'reset' }
  | { type: 'createProject'; draft: NewProjectDraft }
  | {
      type: 'tradeSendPayApp'
      projectId: string
      packageId: string
      /** Percent done per line, as the pay application claims it. */
      toPct: Record<string, number>
      /** Materials stored on site per line, in dollars (question 12). Absent: none. */
      stored?: Record<string, number>
      periodTo: string
      address: string
      license: string
      signedBy: string
      signedTitle: string
    }
  /** The trade sends a new insurance certificate from its portal. `expires`: the day the policy runs out. */
  | { type: 'tradeUploadCoi'; partnerId: string; expires: string }
  /** The trade fills in and signs a W-9 in its portal. */
  | { type: 'tradeSignW9'; partnerId: string }
  /** The office decides on a company (question 3): approve, approve up to a limit, or decline. */
  | { type: 'vetPartner'; partnerId: string; status: 'approved' | 'declined'; limit?: number; note?: string; by: string }
  /** A new company sends its form from its portal (question 3). */
  | { type: 'tradeVettingForm'; partnerId: string; form: Omit<PartnerVettingForm, 'sentOn'> }
  /** A date a company gave for something other than a quote (question 8). A new date on an open one moves it. */
  | { type: 'recordPromise'; partnerId: string; kind: PromiseKind; projectId?: string; packageId?: string; by: string; from: 'office' | 'trade'; what?: string }
  /** It came: the office marks an open promise kept, for a kind the app does not see happen. */
  | { type: 'keepPromise'; id: string }
  | { type: 'sendOwnerPayApp'; projectId: string }
  | { type: 'ownerPaid'; projectId: string; number: number }
  | {
      type: 'issuePlanSet'
      projectId: string
      /** What the set is called: "Addendum 2", "Bulletin 1", "Permit set". */
      label: string
      note: string
      sheets: string[]
      /** The sheets in `sheets` that are new to the index, with their titles. */
      addedSheets: PlanSheet[]
      touches: string[]
      recipients: string[]
      /** Trades the job did not have that this set brings. Each gets a package; nobody is asked yet. */
      newTrades: NewTradeDraft[]
      /** Scope lines this set adds to trades already on the job, with the sheets each reads from. */
      newLines?: { packageId: string; label: string; sheets: string[]; specs?: string[] }[]
      /** Days this set adds to scheduled activities, by line id. What waits on them moves out too. */
      schedulePushes?: Record<string, number>
      /** Answered questions this set carries, in its note. */
      questionIds?: string[]
      /** Sections of the manual this set revises, and the ones in that list new to the manual with their titles. */
      specs?: string[]
      addedSpecs?: SpecSection[]
      /** Sheets and sections this set takes out or renames. Each is also in `sheets` or `specs`. */
      removedSheets?: string[]
      retitledSheets?: PlanSheet[]
      removedSpecs?: string[]
      retitledSpecs?: SpecSection[]
      /** Scope lines whose sheets or sections all go, tied to new ones. An empty list: the trade as a whole. */
      retiedLines?: { packageId: string; scopeId: string; sheets?: string[]; specs?: string[] }[]
      /** Who on our team checked the set's files before it went out. */
      checkedBy?: string
      /** The set carries the pre-bid meeting's minutes. */
      preBidMinutes?: boolean
      /** The set's Google Drive link and its last check. */
      drive?: PlanSetDrive
    }
  | { type: 'acceptWork'; projectId: string; packageId: string }
  | { type: 'tradeSendWarranty'; projectId: string; packageId: string }
  | {
      type: 'tradeSendFinalPayApp'
      projectId: string
      packageId: string
      periodTo: string
      address: string
      license: string
      signedBy: string
      signedTitle: string
    }
  | { type: 'approveRetainage'; projectId: string; packageId: string; drawId: string }
  /** Our own crew's percent done on a trade we do ourselves, reported in the office. */
  | { type: 'selfReport'; projectId: string; packageId: string; pct: number }
  | {
      type: 'sendDrawBack'
      projectId: string
      packageId: string
      drawId: string
      /** What is not right, in the office's words. The trade reads it in its portal. */
      note: string
      /** Lines where we see less done than they asked for: the percent we see. */
      weSee: Record<string, number>
    }
  /** The company presses Got it on its portal's first-visit welcome. */
  | { type: 'tradeOpenPortal'; partnerId: string }
  /** The trade answers the lines of its number the office could not read: each one in it, or left out. The number stays. */
  | { type: 'tradeAnswerLines'; projectId: string; packageId: string; inviteId: string; answers: Record<string, 'yes' | 'no'> }
  /** The owner accepts the work in their portal: the punch list is done. */
  | { type: 'ownerAcceptsWork'; projectId: string }
  /** Our final pay application to the owner: the retainage they hold, with our conditional waiver on final payment. */
  | { type: 'sendOwnerFinalPayApp'; projectId: string }
  | { type: 'closeJob'; projectId: string }
  | {
      type: 'approveDrawLess'
      projectId: string
      packageId: string
      drawId: string
      /** The percent we approve on each line we doubt. Lines left out are approved as asked. */
      weApprove: Record<string, number>
      note: string
    }
  | { type: 'selfReportStage'; projectId: string; packageId: string; lineId: string; pct: number }
  /** Our own bid in Trades mode is priced: the trade carries a real number from now on. */
  | { type: 'priceOwnBid'; projectId: string; packageId: string; value: number }
  | {
      type: 'draftSchedule'
      projectId: string
      start: string
      /** The rough's stage lengths, by stage key (G-45). Absent: the usual ones. */
      days?: Record<string, number>
      /** A template to draw from (G-44): its lines, or the rough's copy when the rough was drawn from it. */
      templateId?: string
    }
  /** `why` (the Gantt, Phase 2): the explanation a move is saved with. The screens always send it; it is kept in `schedule.moves`. */
  | { type: 'setScheduleActivity'; projectId: string; lineId: string; start: string; finish: string; after: string[]; why?: { reason: ScheduleMoveReason; note: string; by: string }; lag?: Record<string, number>; notBefore?: string | null; mustFinishBy?: string | null; changeOrderId?: string; lateNoticeId?: string }
  | { type: 'setScheduleMilestone'; projectId: string; milestone: ScheduleMilestone }
  | { type: 'removeScheduleMilestone'; projectId: string; milestoneId: string }
  | { type: 'verifyLookAhead'; projectId: string; weekOf: string; lineId: string; done: boolean; reason?: LookAheadReason }
  | { type: 'crewMarkLookAhead'; projectId: string; weekOf: string; lineId: string; done: boolean; reason?: LookAheadReason }
  /** The trade marks one look-ahead activity done or not for a week, in its portal. A verified mark stays as verified. */
  | { type: 'tradeMarkLookAhead'; projectId: string; packageId: string; lineId: string; weekOf: string; done: boolean; reason?: LookAheadReason }
  /** The company picks English or Spanish in its portal. Kept on its record: its messages go out in it. */
  | { type: 'tradeSetLanguage'; partnerId: string; lang: 'en' | 'es' }
  /** A change order to the owner, drafted on Bill the owner. */
  | {
      type: 'draftChangeOrder'
      projectId: string
      description: string
      reason: ChangeOrderReason
      schedule: string
      packageId: string | null
      cost: number
      price: number
      /** The days it adds to the job. Absent: none. */
      days?: number
    }
  | { type: 'sendChangeOrder'; projectId: string; changeOrderId: string }
  /** The owner signs a change order in their portal. */
  | { type: 'ownerSignChangeOrder'; projectId: string; changeOrderId: string }
  /** The owner declines a change order in their portal. */
  | { type: 'ownerDeclineChangeOrder'; projectId: string; changeOrderId: string }
  /** How much of a signed change order's work is done, for the owner's bill. */
  | { type: 'setChangeOrderPct'; projectId: string; changeOrderId: string; pct: number }
  /** The office sets a company's language, say when it asks for Spanish on a call. Same record as tradeSetLanguage. */
  | { type: 'setPartnerLanguage'; partnerId: string; lang: 'en' | 'es' }
  /** Send a signed change order to the trade as a change to its statement of work. */
  | { type: 'sendTradeChange'; projectId: string; changeOrderId: string }
  /** The trade signs the change in its portal: it becomes a line of its statement of work. */
  | { type: 'tradeSignChange'; projectId: string; changeOrderId: string }
  /** The architect certifies one of our pay applications to the owner, for what we asked or less. */
  | { type: 'architectCertify'; projectId: string; number: number; amount: number; note: string }
  /** Our superintendent records an inspection passed, today. */
  | { type: 'passInspection'; projectId: string; lineId: string }
  /** Our superintendent records an inspection failed, today: what, whose work, and the re-inspection day. */
  | { type: 'failInspection'; projectId: string; lineId: string; note: string; packageIds: string[]; reinspectOn: string }
  /** A trade asks a question about the plans: in its portal, or by phone and the office types it. */
  | { type: 'tradeAskQuestion'; projectId: string; packageId: string; partnerId: string; text: string; sheets: string[]; atPreBid?: boolean }
  /** We send a trade's question to the architect. */
  | { type: 'sendQuestionToArchitect'; projectId: string; questionId: string }
  /** We record the architect's answer and send it to the companies on the trade. */
  | { type: 'answerQuestion'; projectId: string; questionId: string; answer: string; recipients: string[] }
  /** The owner picked another builder: the bid leaves Bidding for the board's Lost section (owner, 2026-10-03). */
  | { type: 'markLost'; projectId: string; why: GcLostWhy; wonBy: string | null; note: string }
  /** A lost bid comes back: the owner returns to us, and it is in Bidding again. */
  | { type: 'reopenLost'; projectId: string }
  /** The owner pays part of a certified pay application. The rest stays open. */
  | { type: 'ownerPayPart'; projectId: string; number: number; amount: number }
  /** The owner's word on when they will pay: taken by the office on a call, or given in their portal. */
  | { type: 'ownerPromisePay'; projectId: string; number: number; by: string; note: string; who: 'office' | 'owner' }
  /** Our superintendent adds an item to a trade's punch list. */
  | { type: 'addPunchItem'; projectId: string; packageId: string; text: string; where?: string }
  /** The trade marks a punch item fixed in its portal. */
  | { type: 'tradeFixPunchItem'; projectId: string; itemId: string }
  /** Our superintendent checks a fixed item: fixed, or sent back with a note. */
  | { type: 'checkPunchItem'; projectId: string; itemId: string; fixed: boolean; note?: string }
  /** The office takes (or puts back) one of a quote's alternates on Compare quotes (question 14). */
  | { type: 'takeAlternate'; projectId: string; packageId: string; inviteId: string; label: string; taken: boolean }
  /** Our superintendent writes the daily log for a day (today, or a day missed); it replaces that day's. */
  | { type: 'saveDailyLog'; projectId: string; log: Omit<DailyLog, 'writtenOn'> }
  /** The office adds a submittal to a trade's register. */
  | {
      type: 'addSubmittal'
      projectId: string
      packageId: string
      title: string
      kind: SubmittalKind
      specSection?: string
      lineIds: string[]
      leadDays: number
      neededBy?: string
    }
  /** The trade sends a submittal from its portal (or again, after a revise). */
  | { type: 'tradeSendSubmittal'; projectId: string; submittalId: string; file: string; note: string }
  /** We have looked at it and send it to the architect. */
  | { type: 'sendSubmittalToArchitect'; projectId: string; submittalId: string }
  /** We record the architect's answer: approved, approved as noted, or revise and resubmit. */
  | { type: 'answerSubmittal'; projectId: string; submittalId: string; answer: SubmittalAnswer; note: string }
  /** The weekly report to the customer, as written (Building lane, 2026-10-05). A second one for the same week replaces the first. */
  | { type: 'sendWeeklyReport'; projectId: string; weekOf: string; from: 'me' | 'company'; by: string; copyArchitect: boolean; subject: string; body: string }
  /** We choose, per job, whether the owner's retainage drops partway (null: held to the end). */
  | { type: 'setOwnerRetainageStep'; projectId: string; step: OwnerRetainageStep | null }
  /** We choose, per job, whether the owner pays interest on a late bill (null: we do not charge it). */
  | { type: 'setOwnerLateInterest'; projectId: string; pctPerMonth: number | null }
  /** We bill the owner the interest built up on late bills and not billed yet. */
  | { type: 'sendOwnerInterestBill'; projectId: string }
  /** The owner pays an interest bill (in their portal, or the office marks it). */
  | { type: 'ownerPaidInterest'; projectId: string; number: number }
  /** We enter the owner contract's late fee a day (null: the contract has none). */
  | { type: 'setOwnerLateFinish'; projectId: string; perDay: number | null }
  /** We remind the customer to pay a pay application past its due day (email only). */
  | { type: 'remindCustomerToPay'; projectId: string; number: number; by: string; note: string }
  /** We set the pre-bid meeting, or move it, while we bid. */
  | { type: 'schedulePreBid'; projectId: string; on: string; at: string; place: string; host: 'architect' | 'us'; mandatory: boolean }
  /** We record which companies came to the pre-bid meeting. */
  | { type: 'recordPreBidAttendance'; projectId: string; partnerIds: string[] }
  /** The scope book (the owner, 2026-10-04): a line saved by hand, a line changed, two lines folded into one, a set saved. */
  | { type: 'saveToScopeBook'; trade: string; words: string; spec?: string; leavesOut?: ScopeExclusion }
  | { type: 'editScopeBookLine'; trade: string; words: string; to: ScopeBookEdit['to'] }
  | { type: 'mergeScopeBookLines'; trade: string; from: string; into: string }
  | { type: 'saveScopeSet'; trade: string; name: string; lines: string[]; fromProjectId?: string }
  /** A set's Google Drive link checked again (the owner, 2026-10-04): the warning stays until anyone with the link can open it. */
  | { type: 'checkPlanSetDrive'; projectId: string; rev: number; access: 'anyone' | 'restricted' }
  /** A trade asks us for a change to its work, in its portal (owner, 2026-10-04): what, why, how much, the days. */
  | {
      type: 'tradeAskChange'
      projectId: string
      packageId: string
      partnerId: string
      description: string
      reason: ChangeOrderReason
      amount: number
      days: number
      /** The file sent with it (a photo, a ticket): its name. Null: none. */
      file: string | null
    }
  /**
   * The office makes a trade's change request a change order to the customer: drafted the way
   * draftChangeOrder drafts one, on the request's trade and reason, and linked to the request.
   */
  | { type: 'draftChangeOrderFromRequest'; projectId: string; requestId: string; description: string; cost: number; price: number; days: number }
  /** The office turns a trade's change request down, and says why. The trade reads it in its portal. */
  | { type: 'turnDownChangeRequest'; projectId: string; requestId: string; note: string }
  /** The office charges a trade for cleanup, damage, or work we finished for it (owner, 2026-10-05). */
  | { type: 'backCharge'; projectId: string; packageId: string; amount: number; reason: string; photo: string | null }
  /** The trade agrees to a back-charge, or disputes it and says why, in its portal. */
  | { type: 'tradeAnswerBackCharge'; projectId: string; packageId: string; chargeId: string; agree: boolean; note: string }
  /** The office keeps a back-charge (after a dispute, or with no answer) or drops it, and says why. */
  | { type: 'settleBackCharge'; projectId: string; packageId: string; chargeId: string; keep: boolean; note: string }
  /** The office takes a back-charge off an approved draw it has not paid yet. */
  | { type: 'takeBackCharge'; projectId: string; packageId: string; chargeId: string; drawId: string }
  /** A company names someone else to get some of our emails, in its portal (owner, 2026-10-05). */
  | { type: 'tradeAddPerson'; partnerId: string; name: string; email: string; role: string; gets: PortalMailGroup[] }
  /** A company takes someone off its emails. What only they got goes back to the main contact. */
  | { type: 'tradeRemovePerson'; partnerId: string; personId: string }
  /** A company changes which emails one person gets. Null: the main contact. Every kind keeps someone. */
  | { type: 'tradeSetGets'; partnerId: string; personId: string | null; gets: PortalMailGroup[] }
  /** An RFI the office records: from our superintendent, or a trade that called. */
  | { type: 'addRfi'; projectId: string; question: string; sheets: string[]; packageId: string | null; partnerId: string | null; holds: string[]; neededDays: number }
  /** A trade asks a question about the plans from its portal while we build. It comes to the office first. */
  | { type: 'tradeAskRfi'; projectId: string; packageId: string; partnerId: string; question: string; sheets: string[] }
  | { type: 'sendRfiToArchitect'; projectId: string; rfiId: string }
  /** The architect's answer, recorded by the office, or the office's own. */
  | { type: 'answerRfi'; projectId: string; rfiId: string; text: string; by: 'architect' | 'us'; impact: RfiImpact; cost: number; days: number }
  /** An answer that costs money or days starts a draft change order on Bill the customer, filled in from it. */
  | { type: 'draftChangeOrderFromRfi'; projectId: string; rfiId: string }
  /** Put the last move on the schedule back (the Gantt, Phase 2). The move stays on the record, marked undone. */
  | { type: 'undoScheduleMove'; projectId: string; moveId: string; by: string }
  /** A weekly walk finished: what was kept as drawn and what was moved. The moves themselves were saved as they were made. */
  | { type: 'recordScheduleWalk'; projectId: string; by: string; kept: string[]; moveIds: string[]; skipped: number; keptEarly?: string[] }
  /** Tell the trades (the Gantt, Phase 3): the companies whose dates these moves changed get one message each. In the prototype it is written, never sent. */
  | { type: 'tellTradesMoves'; projectId: string; moveIds: string[]; by: string }
  /** Something the work waits on from outside the trades (the Gantt, Phase 4: G-73 to G-75): put it on the schedule, tied to the work that needs it. */
  | { type: 'addScheduleWait'; projectId: string; kind: WaitKind; title: string; packageId: string | null; who: string; lineIds: string[]; expectedOn: string; askedOn?: string | null; note?: string }
  /** It moved a step: ordered, asked for, applied for or requested; shipped (a delivery); in; or the expected day changed. */
  | { type: 'setScheduleWaitStep'; projectId: string; waitId: string; step: 'asked' | 'shipped' | 'done' | 'expected'; on: string; note?: string }
  | { type: 'removeScheduleWait'; projectId: string; waitId: string }
  /** An activity that is no trade's line (the Gantt, G-38): mobilize, cure time, the customer's own work. `holdsUp`: the lines that wait on it from now on. */
  | { type: 'addScheduleActivity'; projectId: string; label: string; who: string; start: string; finish: string; after: string[]; holdsUp: string[]; by: string }
  /** The office marks an added activity done, or not done after all. */
  | { type: 'setAddedActivityDone'; projectId: string; lineId: string; on: string | null }
  /** An added activity comes off the schedule; whatever waited on it stops waiting. */
  | { type: 'removeScheduleActivity'; projectId: string; lineId: string }
  /** The day an activity really started or finished (G-55), from the walk or the editor. Null clears one; unset leaves it. */
  | { type: 'setActualDates'; projectId: string; lineId: string; actualStart?: string | null; actualFinish?: string | null; by: string }
  /** A new baseline after a signed change order (G-41): the plan as it stands becomes the one measured against; the old one is kept and named. */
  | { type: 'setScheduleBaseline'; projectId: string; name: string; why: string; by: string }
  /** Put an undone move back (G-40), while everything it touched still sits where the undo left it. */
  | { type: 'redoScheduleMove'; projectId: string; moveId: string; by: string }
  /** The customer's schedule sent on its own (G-94): the letter as it stands today, kept as sent. Written, never sent, in the prototype. */
  | { type: 'sendCustomerSchedule'; projectId: string; by: string }
  /** A company answers a dates message from its portal: the dates work, or it needs another day, with a note. */
  | { type: 'tradeAnswerDates'; projectId: string; partnerId: string; moveId: string; ok: boolean; day?: string; note?: string }
  /** A company tells us from its portal that it will be late (the Gantt, G-117): a new finish, or a new start for work not started, with why. */
  | { type: 'tradeSayLate'; projectId: string; partnerId: string; lineId: string; day: string; reason: LookAheadReason; note: string }
  /** The office needs the day as drawn: its words go back to the company's portal (G-117). */
  | { type: 'pushBackLateNotice'; projectId: string; noticeId: string; note: string; by: string }
  /** After a push back, the company says it will make the day (G-117). */
  | { type: 'tradeKeepDay'; projectId: string; partnerId: string; noticeId: string }
  /** Work finished early (G-37): its plan catches up, and what was right behind it comes in by the days it gave back. On a press, never by itself. `leaveOut`: the activities a trade cannot start sooner. */
  | { type: 'pullScheduleEarlier'; projectId: string; leaveOut: string[]; why: { reason: ScheduleMoveReason; note: string; by: string } }
  /** Draw or redraw the rough schedule while we bid (G-45): only on a job still bidding, not lost, before our bid goes in. */
  | {
      type: 'setRough'
      projectId: string
      start: string
      days: Record<string, number>
      by: string
      /** A template (G-44): its id copies its lines to the rough; null goes back to the stage days alone; absent keeps what the rough had. */
      templateId?: string | null
    }
  /** Schedule templates (G-44): save a job's shape, rename one, set one aside or bring it back. */
  | { type: 'saveScheduleTemplate'; projectId: string; name: string; by: string }
  | { type: 'renameScheduleTemplate'; templateId: string; name: string }
  | { type: 'setAsideScheduleTemplate'; templateId: string; aside: boolean; by: string }
  /** Days got back (G-82): one offer from the late job's list, by its key, re-planned from the state and saved as one move. On a press, never by itself. */
  | { type: 'recoverScheduleDays'; projectId: string; key: string; why: { reason: ScheduleMoveReason; note: string; by: string } }
  /** A trade says from its portal how many people a day it will have on site in a coming week (G-142). */
  | { type: 'tradeSetCrewCount'; projectId: string; partnerId: string; packageId: string; weekOf: string; count: number }
  /** A what-if copy of the schedule to try moves on (G-81), made from the real one. One per job. */
  | { type: 'startWhatIf'; projectId: string; by: string }
  /** A move tried on the what-if copy (G-81): setScheduleActivity, pullScheduleEarlier, undoScheduleMove, redoScheduleMove or recoverScheduleDays (G-82). Any other is refused. */
  | { type: 'inWhatIf'; projectId: string; action: GcAction; by: string }
  /** Keep the what-if (G-81): its standing moves go on the real schedule, oldest first, as real moves. `whys`: the reasons for moves tried with none, by the copy's move id. */
  | { type: 'keepWhatIf'; projectId: string; by: string; whys: Record<string, { reason: ScheduleMoveReason; note: string }> }
  /** Throw the what-if away (G-81): the copy goes, the real schedule stays as it is. */
  | { type: 'throwAwayWhatIf'; projectId: string; by: string }
  /** Split a line into parts (G-39): each with a name and dates, the first starting and the last ending with the line. Its percent and dates stay. */
  | { type: 'splitActivity'; projectId: string; lineId: string; parts: { name: string; start: string; finish: string }[]; by: string }
  /** Make a split line one bar again (G-39): the parts go, its percent and dates stay. */
  | { type: 'joinActivity'; projectId: string; lineId: string; by: string }
  /** One part of a split line moved (G-39): the line's span follows its parts, and what waits on it moves as for any move. `why` as on setScheduleActivity. */
  | { type: 'moveActivityPart'; projectId: string; lineId: string; partId: string; start: string; finish: string; why?: { reason: ScheduleMoveReason; note: string; by: string } }
  /** A trade reports one part of a split line from its portal (G-39): the line's percent follows. */
  | { type: 'tradeReportPart'; projectId: string; packageId: string; sovId: string; partId: string; pct: number }
  /** Our own crew reports one part of a split stage (G-39): the stage's percent follows. */
  | { type: 'selfReportPart'; projectId: string; packageId: string; lineId: string; partId: string; pct: number }
  /** The office says where bars' work is (G-83): each line id to its place, or null to take it off. A trade's bars and our own crew's only. */
  | { type: 'setActivityPlaces'; projectId: string; places: Record<string, string | null> }

/** One trade on a new project, as the office left it in the New project window. */
export interface NewTradeDraft {
  trade: string
  /** Our own number for the trade. 0 when none was typed. */
  budget: number
  /** We do this trade ourselves: its number comes from our own bid in Trades mode. */
  ours: boolean
  /** The scope lines, each a piece of work a quote says yes or no to. */
  scope: string[]
  /** The sheets each scope line reads from, in the order of `scope`. Missing: not said. */
  scopeSheets?: string[][]
  /** The sections of the project manual each scope line reads from, in the order of `scope`. */
  scopeSpecs?: string[][]
  /** Work the trade's quote leaves out, and who does it instead. */
  excludes?: ScopeExclusion[]
}

/** What the office fills in before a project exists. The reducer makes the project from it. */
export interface NewProjectDraft {
  name: string
  address: string
  town: string
  /** A customer record, or null for a company named for the first time in ownerName. */
  customerId: string | null
  ownerName: string
  /** A customer record too, or null for a firm named for the first time in architectName. */
  architectId: string | null
  architectName: string
  bidDue: string | null
  sizeNote: string
  /** The first set of plans: what it is called, the day it came in, a line about it, its sheets. */
  setLabel: string
  issuedOn: string
  setNote: string
  sheets: PlanSheet[]
  /** The project manual's sections, read from its table of contents. Missing or empty: none came in. */
  specs?: SpecSection[]
  trades: NewTradeDraft[]
  /** The first set's Google Drive link and its last check. */
  drive?: PlanSetDrive
  /** The owner of the property when it is not the customer: a record, or null with a name for someone new. */
  propertyOwnerId?: string | null
  propertyOwnerName?: string
  /** Who we work for. Missing: the owner. */
  customerRole?: CustomerRole
}

/** Who our customer is to the job: the owner, another general contractor, or an owner's rep. */
export type CustomerRole = 'owner' | 'gc' | 'ownersRep'

/** What the trade typed on a draw's pay application. The numbers are rebuilt from the draws (`payApplicationForDraw`). */
export interface DrawPayApp {
  periodTo: string
  address: string
  license: string
  signedBy: string
  signedTitle: string
  signedOn: string
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
  /** Our reminders to pay it, oldest first: the day sent, the pay-by day we asked for, the office's line. Never a promise. */
  reminders?: { on: string; by: string; note: string; subject?: string; lines?: string[] }[]
}

/** A pay application the office sent back: the draw as the trade sent it, why, and what we see. */
export interface DrawSentBack {
  draw: Draw
  on: string
  note: string
  /** Lines where we see less done than they asked for. */
  lines: { sovId: string; weSee: number }[]
}

/**
 * One activity on the schedule (owner, 2026-10-02: several per trade): a line of a trade's
 * statement of work, or a stage our own crew runs. The same line the trade reports and draws on.
 */
export interface ScheduleActivity {
  /** The schedule-of-values line id (a trade we hire) or the scope line id (our own crew). */
  lineId: string
  packageId: string
  /** Planned start and finish, YYYY-MM-DD, both days counted. */
  start: string
  finish: string
  /** The activities (line ids) it waits on: it starts after each one finishes. */
  after: string[]
  /** Days of gap after one it waits on finishes before it may start (the Gantt, G-35: cure time, a lead time), by that line's id. Unset: none. */
  lag?: Record<string, number>
  /** A day it cannot start before: a delivery, a permit (G-36). Unset: none. */
  notBefore?: string
  /** A day it must finish by: a date in the contract, an inspection booked (G-36). Unset: none. */
  mustFinishBy?: string
  /**
   * An inspection (owner, 2026-10-03): the job's own activity, not a trade's line, with no dollars.
   * Its packageId is '' and its lineId its own (`${projectId}-insp-roughin`). It counts on the
   * critical path, not in work done against the plan. Passed: the day it passed.
   */
  inspection?: { label: string; passedOn?: string; failed?: InspectionFailure[] }
  /**
   * An activity that is no line of a trade's statement of work (the Gantt, G-38): mobilize, cure
   * time, the customer's own work. Its packageId is '' and its lineId its own (`${projectId}-own-N`).
   * No dollars and nobody reports it: the office marks it done. It counts on the critical path.
   */
  added?: { label: string; who: string; doneOn: string | null }
  /** The day it really started, beside the planned one (the Gantt, G-55): set by the walk or the editor. Unset: not recorded. */
  actualStart?: string
  /** The day it really finished (G-55). Unset: not recorded. */
  actualFinish?: string
  /** Where on the job its work is, in the office's word: Roof, Inside, Level 2 (G-83). Unset: no place yet. A guess is never kept here until the office keeps it. */
  place?: string
  /** A line split into parts (G-39): first floor, second floor. The line's dates are their span, its percent their weighted sum. Unset: one bar. */
  parts?: ActivityPart[]
}

/**
 * One part of a split line (the Gantt, G-39): a floor or an area of the work, with its own dates
 * and percent. Its days are counted from the line's start, so every move of the line carries it:
 * a drag, a push, a pull, days got back, Undo, a what-if. The part that ends last ends with the
 * line, so a new finish on the line lands on it.
 */
export interface ActivityPart {
  /** `${lineId}-p1` */
  id: string
  /** "Sales floor", as the office named it. */
  name: string
  /** Its first day, in days from the line's start. 0: with the line. */
  from: number
  /** Its days. The part that ends last ends with the line, whatever this says. */
  days: number
  /** Its share of the line's work, in percent, set from the days at the split and kept. The shares add up to 100. */
  share: number
  /** Percent done, as its trade or our own crew reported it. */
  pct: number
  /** The day it really started and finished, set by its reports (G-55). Unset: not yet. */
  actualStart?: string
  actualFinish?: string
}

/**
 * An inspection that did not pass (owner, 2026-10-03): the day, what failed, whose work it was,
 * and the day it is inspected again. The activity moves to that day; what waits on it moves out.
 */
export interface InspectionFailure {
  on: string
  note: string
  /** The trades whose work failed. Empty: not known. */
  packageIds: string[]
  reinspectOn: string
}

/** A date the schedule must meet: dry-in, the rough-in inspection, substantial completion. */
export interface ScheduleMilestone {
  id: string
  label: string
  planned: string
  /** The trade it belongs to. Null: the job's own. */
  packageId: string | null
  /** The day it was met. Null: not yet. */
  metOn: string | null
}

export type LookAheadReason = 'weather' | 'trade before' | 'materials' | 'crew' | 'other'

/**
 * A week's look-ahead mark (owner, 2026-10-02): the trade marks an activity done or not in its
 * portal; our superintendent verifies the mark or corrects it. Only a verified mark counts.
 */
export interface LookAheadMark {
  /** The Monday of the week. */
  weekOf: string
  lineId: string
  packageId: string
  /** The trade's mark. */
  done: boolean
  /** Why not, when not done. */
  reason?: LookAheadReason
  markedOn: string
  /** The day our superintendent verified it. Null: waiting on them. */
  verifiedOn: string | null
  /** The superintendent's mark, when it differs from the trade's. */
  verifiedDone?: boolean
  /** Why not, in the superintendent's words, when they corrected a "done" to not done. */
  verifiedReason?: LookAheadReason
}

export interface ProjectSchedule {
  activities: ScheduleActivity[]
  milestones: ScheduleMilestone[]
  /** Locked at Start, or set anew after a signed change order (G-41): each activity's planned start and finish then, by line id. Null: not locked yet. */
  baseline: ScheduleBaseline | null
  /** The baselines retired by a new one (G-41), oldest first, each kept and named. Unset: only the one at Start. */
  baselines?: ScheduleBaseline[]
  lookAhead: LookAheadMark[]
  /** Every move made with an explanation, newest first (the owner, 2026-10-05; the Gantt, Phase 2). Unset: none yet. */
  moves?: ScheduleMove[]
  /** Every weekly walk of the schedule, newest first (the owner, 2026-10-05: "build the weekly walk"). Unset: never walked. */
  walks?: ScheduleWalk[]
  /** Every late notice a trade sent from its portal, newest first (the Gantt, G-117). Unset: none yet. */
  lateNotices?: LateNotice[]
  /** The template its first draft was drawn from (G-44). Unset: none. */
  template?: TemplateUse
}

/** A plan the schedule is measured against (G-41): the one locked at Start, or one set after a signed change order, named. */
export interface ScheduleBaseline {
  lockedOn: string
  activities: Record<string, { start: string; finish: string }>
  /** "At Start", "After change order 2". Unset: the one at Start. */
  name?: string
  by?: string
  why?: string
}

/**
 * One weekly walk of the schedule (the Gantt, G-52): someone went through every bar that should
 * have moved, kept it as drawn or moved it with an explanation. It is what makes the chart true on
 * a given day, so the day and the person are kept, with what was kept and what was moved.
 */
export interface ScheduleWalk {
  id: string
  on: string
  by: string
  /** The activities looked at and left as drawn. */
  kept: string[]
  /** The moves made during the walk, by id (`schedule.moves`). */
  moveIds: string[]
  /** How many bars the walk listed and nobody looked at. */
  skipped: number
  /** The early finishes the walk answered with Keep the dates (G-37): no work is pulled in after them. Unset: none. */
  keptEarly?: string[]
}

/** Why a bar moved: the look-ahead's reasons, and the ones a move adds. */
export type ScheduleMoveReason = 'weather' | 'trade before' | 'materials' | 'crew' | 'customer' | 'plans' | 'inspection' | 'us' | 'change order' | 'other' | 'early' | 'recovery'

/**
 * One move on the schedule (the owner, 2026-10-05: "anyone on our team may move a bar, when a bar
 * is moved an explanation should be given and recorded"). Who, when, which activity, its dates
 * before and after, the reason picked and their own words, and what it pushed. Kept for good: an
 * undone move stays on the record with the day it was undone.
 */
export interface ScheduleMove {
  id: string
  /** The day it was made. */
  on: string
  by: string
  lineId: string
  from: { start: string; finish: string }
  to: { start: string; finish: string }
  reason: ScheduleMoveReason
  /** The explanation, in their own words. Never empty. */
  note: string
  /** What it waits on changed with it. */
  linksChanged?: boolean
  /** What comes after it that moved out with it, each with its dates before and after. */
  pushed: { lineId: string; from: { start: string; finish: string }; to: { start: string; finish: string } }[]
  /** The job's last finish before and after: how many days the move cost or gave back. */
  finishFrom: string
  finishTo: string
  /** The day it was undone, and who undid it. Unset: it stands. */
  undoneOn?: string
  undoneBy?: string
  /** The day the companies whose dates it changed were told, and which (the Gantt, Phase 3: Tell the trades). Unset: not told yet. */
  toldOn?: string
  toldTo?: string[]
  /** Each company's answer from its portal: the dates work, or it needs another day. */
  answers?: { partnerId: string; on: string; ok: boolean; day?: string; note?: string }[]
  /** The signed change order whose days this move put on the schedule (the Gantt, G-76). Unset: an ordinary move. */
  changeOrderId?: string
  /** The trade's late notice this move took (the Gantt, G-117). Unset: an ordinary move. */
  lateNoticeId?: string
  /**
   * A pull (G-37): these lines finished early and their plans caught up (the move's own line is the
   * first); everything else in `pushed` came in after them, not out. Tell the trades skips the
   * finished lines: their work is done. Unset: an ordinary move.
   */
  pull?: { finished: string[] }
  /**
   * Days got back (G-82): side by side, the line now starts before the work it waits on (`after`)
   * finishes, its gap there changed from `gapWas` to `gap`, which Undo and Redo put back too; or a
   * second crew on it. Everything in `pushed` came in behind it. Unset: an ordinary move.
   */
  recovery?: { how: 'side' | 'crew'; after?: string; gapWas?: number; gap?: number }
  /** Tried in a what-if copy with no reason yet (G-81): its reason and words are a stand-in, and Keep asks for real ones. Never on a real move. */
  noWhy?: boolean
  /** Kept from a what-if copy made on this day (G-81): tried there first, then put on the real schedule with its reason. Unset: an ordinary move. */
  fromWhatIf?: string
  /** A part of a split line moved (G-39): which, and every part's days from the line's start before and after, so Undo and Redo put them back. Unset: the line moved whole, its parts with it. */
  parts?: { id: string; was: { id: string; from: number; days: number }[]; now: { id: string; from: number; days: number }[] }
}

/** One activity's planned dates and waits, as a what-if copy saw them on the real schedule (G-81). */
export interface WhatIfBase {
  start: string
  finish: string
  after: string[]
  lag?: Record<string, number>
  notBefore?: string
  mustFinishBy?: string
  /** A split line's parts (G-39): their days from its start. */
  parts?: { id: string; from: number; days: number }[]
}

/**
 * A what-if copy of the schedule (the Gantt, G-81): the real schedule when it was made, with moves
 * of its own tried on it, kept onto the real one as real moves or thrown away. It is never walked,
 * told, sent or baselined, and nothing outside the Schedule tab reads it.
 */
export interface ScheduleWhatIf {
  /** The copy, with its own history of moves tried. */
  schedule: ProjectSchedule
  /** Each activity's planned dates and waits on the real schedule when the copy was made. Keep is safe only while the real one still has them. */
  base: Record<string, WhatIfBase>
  on: string
  by: string
}

/**
 * A trade's word from its portal that it will be late (the Gantt, G-117): the new day, why, and
 * the office's answer. Nothing moves until the office takes it as a move (`ScheduleMove.lateNoticeId`)
 * or pushes back. Where it stands is read each time (`lateNoticeState` in gcLateNotices.ts).
 */
export interface LateNotice {
  /** `late-1`, `late-2`, … kept newest first. */
  id: string
  partnerId: string
  lineId: string
  /** The day it was sent. */
  on: string
  /** Who at the company sent it: its contact. */
  by: string
  /** Under way: the day asked for is a new finish. Not started: a new start, the bar moving whole. */
  started: boolean
  /** The bar's dates when it was sent. */
  was: { start: string; finish: string }
  /** The dates it asks for. */
  to: { start: string; finish: string }
  reason: LookAheadReason
  /** What happened, in their words. Never empty. */
  note: string
  /** The office needs the day as drawn, and said why. */
  pushedBack?: { on: string; by: string; note: string }
  /** After a push back, the company said it will make the day. */
  kept?: { on: string }
}

/** What the work waits on from outside the trades (G-73 to G-75): a long-lead delivery, a decision the customer owes, a permit, the utility's work. */
export type WaitKind = 'delivery' | 'decision' | 'permit' | 'utility'

/**
 * One thing the work waits on that is not a trade's work (the Gantt, Phase 4): a long-lead item
 * on order, a decision the customer owes us, a permit the city owes us, the utility's part. It
 * holds the activities that need it until it is in, and it is drawn on the chart as a row of its
 * own, so the day it is expected reads beside the day the work needs it.
 */
export interface ScheduleWait {
  id: string
  kind: WaitKind
  /** "Rooftop units", "Restroom tile", "Electrical service permit", "The transformer". */
  title: string
  /** The trade whose work needs it. Null: the job's own. */
  packageId: string | null
  /** Who we wait on, by name: the supplier, the customer, the city, the utility. */
  who: string
  /** The activities (line ids) that cannot start until it is in. */
  lineIds: string[]
  /** The day it was ordered, asked for, applied for or requested. Null: not yet. */
  askedOn: string | null
  /** The day it is expected: the supplier's date, the day the customer said, the city's turnaround. */
  expectedOn: string
  /** A delivery only: the day it shipped. Null: not yet. */
  shippedOn?: string | null
  /** The day it came: on site, decided, issued, done. Null: still waiting. */
  doneOn: string | null
  /** Who said the expected day, or what is holding it up. */
  note?: string
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
