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
}

/** One drawing in the set. The discipline is read from the number's letters (E-201 → Electrical). */
export interface PlanSheet {
  id: string
  title: string
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
  lines: { sovId: string; toPct: number }[]
  /** The G702/G703 the trade sent with this draw. Absent on a draw asked for without one. */
  payApp?: DrawPayApp
  /**
   * The retainage release: the last draw, asked for once the work is accepted. It pays back what
   * was held (retainage is negative, net is the release) and its waivers are the final-payment ones.
   */
  final?: boolean
  /** Approved for less than asked: what the trade asked for, why we approved less, and the day we did. */
  asked?: { gross: number; retainage: number; net: number; lines: { sovId: string; toPct: number }[]; note: string; on: string }
  /** The day we approved it. Unset: not yet, or before the day was kept. */
  approvedOn?: string
  /** The day we paid it. Unset: not yet, or before the day was kept. */
  paidOn?: string
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
  /** The day we sent it to the trade to sign. Unset: not sent, or before the day was kept. */
  sentOn?: string
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
  /** The day they first went through their portal's welcome. Unset: never, or before the portal kept it. */
  portalOpenedOn?: string
  /** The day we sent the master agreement. Unset: not sent, or before the day was kept. */
  msaSentOn?: string
  /** The language the company chose in its portal; its messages go out in it too. Unset: English. */
  lang?: 'en' | 'es'
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
  /** Changes to our contract with the owner, oldest first. Absent: none yet. */
  changeOrders?: ChangeOrder[]
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
}

/** Why a bid to an owner was lost: Trades mode's loss reasons, in GC words (gcLost.ts). */
export type GcLostWhy = 'price' | 'other_builder' | 'project_died' | 'no_bid' | 'no_answer'

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
      /** The portal's bid form adds these; a bid without them is the same as before. */
      goodForDays?: number
      alternates?: BidAlternate[]
      quoteFile?: string
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
  /** The trade sends a new insurance certificate from its portal. `expires`: the day the policy runs out. */
  | { type: 'tradeUploadCoi'; partnerId: string; expires: string }
  /** The trade fills in and signs a W-9 in its portal. */
  | { type: 'tradeSignW9'; partnerId: string }
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
      newLines?: { packageId: string; label: string; sheets: string[] }[]
      /** Days this set adds to scheduled activities, by line id. What waits on them moves out too. */
      schedulePushes?: Record<string, number>
      /** Answered questions this set carries, in its note. */
      questionIds?: string[]
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
  | { type: 'draftSchedule'; projectId: string; start: string }
  | { type: 'setScheduleActivity'; projectId: string; lineId: string; start: string; finish: string; after: string[] }
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
  /** A trade asks a question about the plans: in its portal, or by phone and the office types it. */
  | { type: 'tradeAskQuestion'; projectId: string; packageId: string; partnerId: string; text: string; sheets: string[] }
  /** We send a trade's question to the architect. */
  | { type: 'sendQuestionToArchitect'; projectId: string; questionId: string }
  /** We record the architect's answer and send it to the companies on the trade. */
  | { type: 'answerQuestion'; projectId: string; questionId: string; answer: string; recipients: string[] }
  /** The owner picked another builder: the bid leaves Bidding for the board's Lost section (owner, 2026-10-03). */
  | { type: 'markLost'; projectId: string; why: GcLostWhy; wonBy: string | null; note: string }
  /** A lost bid comes back: the owner returns to us, and it is in Bidding again. */
  | { type: 'reopenLost'; projectId: string }

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

/** One pay application we sent the owner, kept as it went. The next one starts from its lines. */
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
  /**
   * An inspection (owner, 2026-10-03): the job's own activity, not a trade's line, with no dollars.
   * Its packageId is '' and its lineId its own (`${projectId}-insp-roughin`). It counts on the
   * critical path, not in work done against the plan. Passed: the day it passed.
   */
  inspection?: { label: string; passedOn?: string }
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
  /** Locked at Start: each activity's planned start and finish then, by line id. Null: not locked yet. */
  baseline: { lockedOn: string; activities: Record<string, { start: string; finish: string }> } | null
  lookAhead: LookAheadMark[]
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
}
