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
}

/** One drawing in the set. The discipline is read from the number's letters (E-201 → Electrical). */
export interface PlanSheet {
  id: string
  title: string
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
  note: string
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
  id: string
  number: number
  requestedOn: string
  gross: number
  retainage: number
  net: number
  status: 'requested' | 'approved' | 'paid'
  waiver: 'conditional' | 'unconditional'
  lines: { sovId: string; toPct: number }[]
  /** The G702/G703 the trade sent with this draw. Absent on a draw asked for without one. */
  payApp?: DrawPayApp
}

export interface Sow {
  status: 'draft' | 'sent' | 'signed'
  price: number
  retainagePct: number
  basedOnRev: number
  sov: SovLine[]
  signedOn: string | null
  draws: Draw[]
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
  selfPerform: { ref: string; value: number; note: string } | null
  invites: Invite[]
  /** An invite id, 'plug' (our budget) or 'self'. */
  carried: string | null
  awardedInviteId: string | null
  sow: Sow | null
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
}

/** What we have billed the owner on a project we are building, and what they have paid. */
export interface OwnerBilling {
  billed: number
  paid: number
  retainageHeld: number
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

export interface GcProject {
  id: string
  name: string
  address: string
  /** Where the job is, for the drive from each trade partner. */
  town: string
  /** The day our own bid went to the owner. Bid tabs stay shut until then. Null: not sent yet. */
  ourBidSentOn: string | null
  /** Going into the job: our contract with the owner, the permit, the day work starts. */
  ownerContractSignedOn: string | null
  permitOn: string | null
  startDate: string | null
  /** The day we pressed Start. The trades were told then. */
  startedOn: string | null
  customerId: string
  /** The customer's name, kept on the row for display. */
  owner: string
  ownerBilling: OwnerBilling | null
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
  planSets: PlanSet[]
  packages: TradePackage[]
  generalConditions: number
  contingencyPct: number
  feePct: number
}

export interface LogEntry {
  id: number
  who: 'office' | 'trade'
  text: string
}

export interface GcState {
  today: string
  customers: GcCustomer[]
  projects: GcProject[]
  partners: Partner[]
  log: LogEntry[]
}

export type GcAction =
  | { type: 'issueAddendum'; projectId: string; note: string; sheets: string[]; touches: string[]; recipients?: string[] }
  | { type: 'tradeConfirmBid'; projectId: string; packageId: string; inviteId: string }
  | { type: 'setStartItem'; projectId: string; item: 'ownerContract' | 'permit'; done: boolean }
  | { type: 'setStartDate'; projectId: string; date: string }
  | { type: 'startProject'; projectId: string }
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
    }
  | { type: 'tradeDecline'; projectId: string; packageId: string; inviteId: string }
  | { type: 'officeDecline'; projectId: string; packageId: string; inviteId: string; why: 'wont' | 'cant' }
  | { type: 'setPlug'; projectId: string; packageId: string; inviteId: string; scopeId: string; amount: number }
  | { type: 'carry'; projectId: string; packageId: string; carried: string | null }
  | { type: 'markWon'; projectId: string }
  | { type: 'markBidSent'; projectId: string }
  | { type: 'shareBidTab'; projectId: string; packageId: string; showNames: boolean }
  | { type: 'tradeSeeBidTab'; projectId: string; packageId: string; partnerId: string }
  | { type: 'award'; projectId: string; packageId: string; inviteId: string }
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
  | { type: 'addPartner'; company: string; contact: string; trade: string; base: string | null; maxMiles: number | null }
  | { type: 'setCoverage'; partnerId: string; base: string | null; maxMiles: number | null }
  | { type: 'reset' }
  | { type: 'createProject'; draft: NewProjectDraft }
  | {
      type: 'tradeSendPayApp'
      projectId: string
      packageId: string
      /** Percent done per line, as the pay application claims it. */
      toPct: Record<string, number>
      periodTo: string
      address: string
      license: string
      signedBy: string
      signedTitle: string
    }

/** One trade on a new project, as the office left it in the New project window. */
export interface NewTradeDraft {
  trade: string
  /** Our own number for the trade. 0 when none was typed. */
  budget: number
  /** We do this trade ourselves: its number comes from our own bid in Trades mode. */
  ours: boolean
  /** The scope lines, each a piece of work a quote says yes or no to. */
  scope: string[]
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
  trades: NewTradeDraft[]
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
