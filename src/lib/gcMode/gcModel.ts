/**
 * GC mode — design spike (2026-10-02). Nothing here reads or writes the database: the page runs
 * on the fixture below through one reducer, so the office side and the trade's portal can be
 * played against each other. The shapes are drawn the way the tables would be, so the spike
 * doubles as a first schema sketch (a project → plan sets + trade packages → invites → a bid →
 * a statement of work under the master agreement → draws).
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

// ---------------------------------------------------------------------------------------------
// Words and dates
// ---------------------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** An amount in whole thousands, for a glance: 178400 reads "178", 1027746 reads "1,028". The K is drawn beside it. */
export function thousands(n: number): string {
  return Math.round(n / 1000).toLocaleString('en-US')
}

export function shortDate(iso: string | null): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  const month = MONTHS[Number(m) - 1]
  return month ? `${month} ${Number(d)}` : iso
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Wed Oct 8": the day of the week with the date, for a due date an estimator plans a week around. */
export function weekdayDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const day = WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()]
  return `${day} ${shortDate(iso)}`
}

function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}

export function daysUntil(iso: string, today: string): number {
  return Math.round(utcDay(iso) - utcDay(today))
}

export function planLabel(project: GcProject, rev: number | null): string {
  if (rev === null) return 'not opened'
  return project.planSets.find((s) => s.rev === rev)?.label ?? `Rev ${rev}`
}

// ---------------------------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------------------------

const DISCIPLINES: Record<string, string> = {
  G: 'General',
  C: 'Civil',
  A: 'Architectural',
  ID: 'Interiors',
  S: 'Structural',
  M: 'Mechanical',
  E: 'Electrical',
  P: 'Plumbing',
  FP: 'Fire protection',
}

export function sheetDiscipline(sheetId: string): string {
  const letters = sheetId.match(/^[A-Za-z]+/)?.[0].toUpperCase() ?? ''
  return DISCIPLINES[letters] ?? 'Other'
}

export interface SheetInSet extends PlanSheet {
  /** The newest set, up to the one being read, that changed this sheet. Null: as first issued. */
  changedInRev: number | null
  /** The sheet did not exist before an addendum named it. */
  added: boolean
}

/** The drawings as they stand at one set: the bid set's index plus what each addendum touched. */
export function sheetsAtRev(project: GcProject, rev: number): SheetInSet[] {
  const out = new Map<string, SheetInSet>()
  for (const sheet of project.sheets) out.set(sheet.id, { ...sheet, changedInRev: null, added: false })
  const sets = project.planSets.filter((s) => s.rev <= rev).sort((a, b) => a.rev - b.rev)
  for (const set of sets) {
    for (const id of set.changedSheets) {
      const known = out.get(id)
      out.set(id, known ? { ...known, changedInRev: set.rev } : { id, title: `Added by ${set.label}`, changedInRev: set.rev, added: true })
    }
  }
  return [...out.values()]
}

/** Sheet numbers found in pasted notes: "E-201", "FP-101". Each once, in the order they appear. */
export function sheetsInText(text: string): string[] {
  const found = text.toUpperCase().match(/\b[A-Z]{1,2}-\d{2,3}\b/g) ?? []
  return [...new Set(found)]
}

/** Which trades a drawing's discipline usually belongs to. A guess to start from, never the last word. */
const DISCIPLINE_TRADES: Record<string, string[]> = {
  Civil: ['Sitework'],
  Structural: ['Structural steel', 'Concrete'],
  Mechanical: ['HVAC'],
  Electrical: ['Electrical'],
  Plumbing: ['Plumbing'],
  'Fire protection': ['Fire sprinkler'],
  Interiors: ['Millwork', 'Framing and drywall'],
}

/** The package ids a list of changed sheets most likely touches. */
export function packagesForSheets(project: GcProject, sheets: string[]): string[] {
  const trades = new Set(sheets.flatMap((id) => DISCIPLINE_TRADES[sheetDiscipline(id)] ?? []))
  return project.packages.filter((p) => trades.has(p.trade)).map((p) => p.id)
}

export interface PlanRecipient {
  partner: Partner
  pkg: TradePackage
  invite: Invite
  /** The new set changes this company's trade. */
  touched: boolean
  /** They have a number in that the change may move. */
  hasBid: boolean
}

/**
 * Who hears about a new set of plans. While we are bidding: every company bidding, on every
 * trade. Once the job is ours: only the company on each trade (the one awarded, or the one we
 * carry until we award). A company that passed is never on the list.
 */
export function planRecipients(state: GcState, project: GcProject, touches: string[]): PlanRecipient[] {
  const out: PlanRecipient[] = []
  for (const pkg of project.packages) {
    const picked = pkg.awardedInviteId ?? (pkg.carried && pkg.carried !== 'plug' && pkg.carried !== 'self' ? pkg.carried : null)
    for (const invite of pkg.invites) {
      if (invite.status === 'declined') continue
      if (project.stage !== 'pursuing' && invite.id !== picked) continue
      const partner = partnerById(state, invite.partnerId)
      if (!partner) continue
      out.push({ partner, pkg, invite, touched: touches.includes(pkg.id), hasBid: invite.bid !== null })
    }
  }
  return out.sort((a, b) => Number(b.touched) - Number(a.touched))
}

/** The words a company reads when a new set goes out. Two versions: their trade changed, or it did not. */
export function planEmail(project: GcProject, label: string, note: string, sheets: string[], r: PlanRecipient | null): { subject: string; body: string[] } {
  const body = [`${label} for ${project.name} is out. Your portal now shows it.`, `What changed: ${note || 'see the sheets below.'}`]
  if (sheets.length > 0) body.push(`Sheets: ${sheets.join(', ')}.`)
  if (!r) return { subject: `${project.name}: ${label} is out`, body }
  if (r.touched && project.stage === 'pursuing') {
    body.push(
      r.hasBid
        ? `This changes ${r.pkg.trade.toLowerCase()}. Please open the plans and confirm your number, or send a new one${project.bidDue ? `, by ${weekdayDate(project.bidDue)}` : ''}.`
        : `This changes ${r.pkg.trade.toLowerCase()}. Please price the new set${project.bidDue ? `. Your number is due ${weekdayDate(project.bidDue)}` : ''}.`,
    )
  } else if (r.touched) {
    body.push(`This changes ${r.pkg.trade.toLowerCase()}. Build from this set. If it changes your price, tell us before you do the work.`)
  } else {
    body.push(`It does not change ${r.pkg.trade.toLowerCase()}. No action needed. It is for your records.`)
  }
  return { subject: `${project.name}: ${label} is out${r.touched ? ' and it changes your trade' : ''}`, body }
}

// ---------------------------------------------------------------------------------------------
// Going into the job: is everything signed?
// ---------------------------------------------------------------------------------------------

export interface StartCheck {
  key: string
  label: string
  done: boolean
  detail: string
}

export interface StartTradeRow {
  pkg: TradePackage
  partner: Partner | null
  invite: Invite | null
  /** Each step in the order it has to happen. */
  checks: StartCheck[]
  ready: boolean
  /** The one thing to do next on this trade, said as a sentence. Null when it is ready. */
  next: string | null
}

export interface StartChecklist {
  owner: StartCheck[]
  trades: StartTradeRow[]
  done: number
  total: number
  /** What still stands between us and starting, in plain words. */
  missing: string[]
  ready: boolean
}

/** Everything that has to be true before work starts, and what is still missing. */
export function startChecklist(state: GcState, project: GcProject): StartChecklist {
  const newest = currentRev(project)
  const owner: StartCheck[] = [
    {
      key: 'ownerContract',
      label: `Our contract with ${project.owner} is signed`,
      done: project.ownerContractSignedOn !== null,
      detail: project.ownerContractSignedOn ? `signed ${shortDate(project.ownerContractSignedOn)}` : 'not signed yet',
    },
    {
      key: 'permit',
      label: 'The permit is in hand',
      done: project.permitOn !== null,
      detail: project.permitOn ? `in hand ${shortDate(project.permitOn)}` : 'not yet',
    },
    {
      key: 'startDate',
      label: 'A start date is set',
      done: project.startDate !== null,
      detail: project.startDate ? weekdayDate(project.startDate) : 'no date yet',
    },
  ]
  const trades: StartTradeRow[] = project.packages.map((pkg) => {
    if (pkg.selfPerform) {
      return { pkg, partner: null, invite: null, ready: true, next: null, checks: [{ key: 'self', label: 'Ours', done: true, detail: `our own crew, ${pkg.selfPerform.ref}` }] }
    }
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId) ?? null
    const partner = invite ? (partnerById(state, invite.partnerId) ?? null) : null
    const coiOk = partner?.coiExpires != null && daysUntil(partner.coiExpires, state.today) >= 0
    const sow = pkg.sow
    const checks: StartCheck[] = [
      { key: 'awarded', label: 'Awarded', done: invite !== null, detail: partner ? partner.company : 'no company picked' },
      { key: 'msa', label: 'Master agreement', done: partner?.msa === 'signed', detail: partner?.msa === 'signed' ? 'signed' : partner?.msa === 'sent' ? 'sent, not signed' : 'not sent' },
      { key: 'coi', label: 'Insurance', done: coiOk, detail: coiOk ? `good to ${shortDate(partner?.coiExpires ?? null)}` : partner?.coiExpires ? 'expired' : 'none on file' },
      { key: 'w9', label: 'W-9', done: partner?.w9 === true, detail: partner?.w9 ? 'on file' : 'missing' },
      {
        key: 'sow',
        label: 'Statement of work',
        done: sow?.status === 'signed' && sow.basedOnRev === newest,
        detail: !sow
          ? 'not written'
          : sow.status === 'signed'
            ? sow.basedOnRev === newest
              ? `signed ${shortDate(sow.signedOn)}`
              : `signed on ${planLabel(project, sow.basedOnRev)}, older than the plans`
            : sow.status === 'sent'
              ? 'sent, not signed'
              : 'drafted, not sent',
      },
    ]
    // Until a company is awarded there is no paperwork to judge: say so instead of calling it missing.
    if (!partner) for (const c of checks) if (c.key !== 'awarded') c.detail = 'after the award'
    const firstOpen = checks.find((c) => !c.done)
    const next = !firstOpen
      ? null
      : firstOpen.key === 'awarded'
        ? 'Pick a company and award the trade.'
        : firstOpen.key === 'msa'
          ? partner?.msa === 'sent'
            ? `${partner.company} has the master agreement. Get it signed.`
            : 'Send the master agreement.'
          : firstOpen.key === 'coi'
            ? `Get a current insurance certificate from ${partner?.company ?? 'them'}.`
            : firstOpen.key === 'w9'
              ? `Get a W-9 from ${partner?.company ?? 'them'}.`
              : !sow || sow.status === 'draft'
                ? 'Send the statement of work.'
                : sow.status === 'sent'
                  ? `${partner?.company ?? 'They'} has the statement of work. Get it signed.`
                  : 'The plans changed after they signed. Send a new statement of work.'
    return { pkg, partner, invite, checks, ready: !firstOpen, next }
  })
  const all = [...owner, ...trades.flatMap((t) => t.checks)]
  const missing = [
    ...owner.filter((c) => !c.done).map((c) => `${c.label}: ${c.detail}.`),
    ...trades.filter((t) => !t.ready).map((t) => `${t.pkg.trade}: ${t.next}`),
  ]
  return { owner, trades, done: all.filter((c) => c.done).length, total: all.length, missing, ready: missing.length === 0 }
}

/** How many invited trade partners have opened the newest set. */
export function plansReach(project: GcProject): { have: number; of: number } {
  const rev = currentRev(project)
  const invites = project.packages.flatMap((p) => p.invites).filter((i) => i.status !== 'declined')
  return { have: invites.filter((i) => i.seenRev === rev).length, of: invites.length }
}

export function currentRev(project: GcProject): number {
  return project.planSets.reduce((max, s) => Math.max(max, s.rev), 0)
}

export function partnerById(state: GcState, id: string): Partner | undefined {
  return state.partners.find((p) => p.id === id)
}

/** The bid plus the office's plug for every scope item it does not clearly include. */
export function leveledTotal(pkg: TradePackage, invite: Invite): number | null {
  const bid = invite.bid
  if (!bid) return null
  const plugs = pkg.scope.reduce((sum, item) => {
    return bid.includes[item.id] === 'yes' ? sum : sum + (bid.plugs[item.id] ?? 0)
  }, 0)
  return bid.amount + plugs
}

/** A bid is stale when a plan set newer than its basis changed this package's scope. */
export function bidIsStale(project: GcProject, pkg: TradePackage, invite: Invite): boolean {
  const bid = invite.bid
  if (!bid) return false
  return project.planSets.some((s) => s.rev > bid.basedOnRev && s.touches.includes(pkg.id))
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** One bid read for the comparison: what it leaves out, what covering that costs, where it lands. */
export interface CompareLine {
  inviteId: string
  company: string
  text: string
  /** The bid plus the cost to cover what it leaves out. */
  allIn: number
  /** False while something it leaves out has no cost set: the all-in number is not known yet. */
  complete: boolean
}

export interface BidComparison {
  lines: CompareLine[]
  conclusion: string
  complete: boolean
}

/**
 * The bids on a trade compared for the same work, said in sentences. A bid that leaves work out
 * is not cheaper until the cost of that work is added back. That adding back is all "leveling" is.
 */
export function compareBids(state: GcState, project: GcProject, pkg: TradePackage): BidComparison {
  const lines: CompareLine[] = bidsIn(pkg).map((invite) => {
    const bid = invite.bid
    const company = partnerById(state, invite.partnerId)?.company ?? 'A company'
    if (!bid) return { inviteId: invite.id, company, text: '', allIn: 0, complete: true }
    const out = pkg.scope.filter((i) => bid.includes[i.id] === 'no')
    const unclear = pkg.scope.filter((i) => bid.includes[i.id] !== 'yes' && bid.includes[i.id] !== 'no')
    const gaps = [...out, ...unclear]
    const uncosted = gaps.filter((i) => !((bid.plugs[i.id] ?? 0) > 0))
    const added = gaps.reduce((sum, i) => sum + (bid.plugs[i.id] ?? 0), 0)
    const allIn = bid.amount + added
    const names = (items: ScopeItem[]) => listWords(items.map((i) => i.label.toLowerCase()))
    let text = `${company} bid ${money(bid.amount)}`
    if (gaps.length === 0) {
      text += ' and covers everything.'
    } else {
      const parts: string[] = []
      if (out.length > 0) parts.push(`left out ${names(out)}`)
      if (unclear.length > 0) parts.push(`is not clear about ${names(unclear)}`)
      text += ` and ${parts.join(' and ')}.`
      text +=
        uncosted.length > 0
          ? ` No cost is set for ${names(uncosted)} yet, so their real number is not known.`
          : ` Covering that adds ${money(added)}, so they come to ${money(allIn)}.`
    }
    if (bidIsStale(project, pkg, invite)) text += ' They priced an older set of plans, so ask them to confirm.'
    return { inviteId: invite.id, company, text, allIn, complete: uncosted.length === 0 }
  })
  const complete = lines.every((l) => l.complete)
  const sorted = [...lines].sort((a, b) => a.allIn - b.allIn)
  const low = sorted[0]
  const next = sorted[1]
  let conclusion = ''
  if (!low) conclusion = ''
  else if (!next) conclusion = `One bid only. You want at least ${BIDS_WANTED} to compare.`
  else if (!complete) conclusion = 'Set a cost for the work that is missing to see who is really lowest.'
  else {
    const lowestAsSent = [...bidsIn(pkg)].sort((a, b) => (a.bid?.amount ?? 0) - (b.bid?.amount ?? 0))[0]
    const flipped = lowestAsSent && lowestAsSent.id !== low.inviteId
    conclusion = `${flipped ? 'The lowest bid is not the lowest cost. ' : ''}${low.company} is lowest for the same work, by ${money(next.allIn - low.allIn)}.`
  }
  return { lines, conclusion, complete }
}

export function bidsIn(pkg: TradePackage): Invite[] {
  return pkg.invites.filter((i) => i.bid !== null)
}

export function lowLeveled(pkg: TradePackage): { invite: Invite; total: number } | null {
  let best: { invite: Invite; total: number } | null = null
  for (const invite of bidsIn(pkg)) {
    const total = leveledTotal(pkg, invite)
    if (total !== null && (best === null || total < best.total)) best = { invite, total }
  }
  return best
}

export type Coverage = 'self' | 'awarded' | 'carried' | 'plug' | 'bids' | 'waiting' | 'empty'

export function packageCoverage(pkg: TradePackage): Coverage {
  if (pkg.selfPerform) return 'self'
  if (pkg.awardedInviteId) return 'awarded'
  if (pkg.carried === 'plug') return 'plug'
  if (pkg.carried) return 'carried'
  if (bidsIn(pkg).length > 0) return 'bids'
  if (pkg.invites.some((i) => i.status !== 'declined')) return 'waiting'
  return 'empty'
}

export function carriedAmount(pkg: TradePackage): number | null {
  if (pkg.selfPerform) return pkg.selfPerform.value
  if (pkg.sow) return pkg.sow.price
  if (pkg.carried === 'plug') return pkg.budget
  const invite = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
  return invite ? leveledTotal(pkg, invite) : null
}

export interface ProposalTotals {
  trades: number
  holes: TradePackage[]
  plugged: TradePackage[]
  generalConditions: number
  contingency: number
  fee: number
  price: number
}

export function proposalTotals(project: GcProject): ProposalTotals {
  let trades = 0
  const holes: TradePackage[] = []
  const plugged: TradePackage[] = []
  for (const pkg of project.packages) {
    const amount = carriedAmount(pkg)
    if (amount === null) holes.push(pkg)
    else trades += amount
    if (pkg.carried === 'plug') plugged.push(pkg)
  }
  const cost = trades + project.generalConditions
  const contingency = (cost * project.contingencyPct) / 100
  const fee = ((cost + contingency) * project.feePct) / 100
  return {
    trades,
    holes,
    plugged,
    generalConditions: project.generalConditions,
    contingency,
    fee,
    price: cost + contingency + fee,
  }
}

export function sowMoney(sow: Sow): { billed: number; retainageHeld: number; paid: number; ready: number } {
  const billed = sow.sov.reduce((s, l) => s + (l.amount * l.pctBilled) / 100, 0)
  const ready = sow.sov.reduce((s, l) => s + (l.amount * Math.max(0, l.pctReported - l.pctBilled)) / 100, 0)
  const paid = sow.draws.filter((d) => d.status === 'paid').reduce((s, d) => s + d.net, 0)
  const retainageHeld = sow.draws.filter((d) => d.status !== 'requested').reduce((s, d) => s + d.retainage, 0)
  return { billed, retainageHeld, paid, ready }
}

export interface CustomerSummary {
  live: GcProject[]
  /** Our price on the projects we are still bidding to them. */
  inFront: number
  /** Our price on the projects they gave us. */
  underContract: number
  billed: number
  paid: number
  owed: number
  retainageHeld: number
  asked: number
  won: number
}

/** One customer across every project: what is live, what is owed, how often they pick us. */
export function customerSummary(state: GcState, customer: GcCustomer): CustomerSummary {
  const live = state.projects.filter((p) => p.customerId === customer.id)
  const sum: CustomerSummary = {
    live,
    inFront: 0,
    underContract: 0,
    billed: 0,
    paid: 0,
    owed: 0,
    retainageHeld: 0,
    asked: live.length + customer.past.length,
    won: customer.past.filter((p) => p.outcome === 'built').length,
  }
  for (const project of live) {
    const price = proposalTotals(project).price
    if (project.stage === 'pursuing') sum.inFront += price
    else {
      sum.underContract += price
      sum.won += 1
    }
    if (project.ownerBilling) {
      sum.billed += project.ownerBilling.billed
      sum.paid += project.ownerBilling.paid
      sum.retainageHeld += project.ownerBilling.retainageHeld
    }
  }
  sum.owed = sum.billed - sum.retainageHeld - sum.paid
  return sum
}

export interface ArchitectSummary {
  live: GcProject[]
  sets: number
  addenda: number
  waiting: { project: GcProject; question: PlanQuestion; days: number }[]
  answered: { project: GcProject; question: PlanQuestion }[]
}

/** The same company as an architect: the sets they issued, the questions they owe us. */
export function architectSummary(state: GcState, architect: GcCustomer): ArchitectSummary {
  const live = state.projects.filter((p) => p.architectId === architect.id)
  const sum: ArchitectSummary = { live, sets: 0, addenda: 0, waiting: [], answered: [] }
  for (const project of live) {
    sum.sets += project.planSets.length
    sum.addenda += project.planSets.filter((s) => s.rev > 0).length
    for (const question of project.questions) {
      if (question.answeredOn) sum.answered.push({ project, question })
      else sum.waiting.push({ project, question, days: daysUntil(state.today, question.askedOn) })
    }
  }
  sum.waiting.sort((a, b) => b.days - a.days)
  return sum
}

export const TOWNS: Town[] = [
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  { name: 'Bandera', lat: 29.7266, lng: -99.0734 },
  { name: 'Boerne', lat: 29.7947, lng: -98.732 },
  { name: 'Corpus Christi', lat: 27.8006, lng: -97.3964 },
  { name: 'Fredericksburg', lat: 30.2752, lng: -98.872 },
  { name: 'Helotes', lat: 29.578, lng: -98.6897 },
  { name: 'Kerrville', lat: 30.0474, lng: -99.1403 },
  { name: 'Laredo', lat: 27.5306, lng: -99.4803 },
  { name: 'New Braunfels', lat: 29.703, lng: -98.1245 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
  { name: 'San Marcos', lat: 29.8833, lng: -97.9414 },
  { name: 'Seguin', lat: 29.5688, lng: -97.9647 },
  { name: 'Waco', lat: 31.5493, lng: -97.1467 },
]

/** About how far the drive is: the straight line between two towns, plus a fifth for the roads. */
export function driveMiles(from: string, to: string): number | null {
  const a = TOWNS.find((t) => t.name === from)
  const b = TOWNS.find((t) => t.name === to)
  if (!a || !b) return null
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return Math.round(3959 * 2 * Math.asin(Math.sqrt(h)) * 1.2)
}

/** One trade partner's drive to one project: how far, and whether they go that far. */
export interface Travel {
  /** Null: their coverage is not set, so nothing is known and nothing is held against them. */
  miles: number | null
  inZone: boolean
}

export function travelFor(_state: GcState, partner: Partner, project: GcProject): Travel {
  const miles = partner.base ? driveMiles(partner.base, project.town) : null
  if (miles === null) return { miles: null, inZone: true }
  return { miles, inZone: partner.maxMiles === null || miles <= partner.maxMiles }
}

/** "38 mi", or "80 mi, past their 60". Empty when the coverage is not set. */
export function travelWords(travel: Travel, partner: Partner): string {
  if (travel.miles === null) return ''
  return travel.inZone ? `${travel.miles} mi` : `${travel.miles} mi, past their ${partner.maxMiles}`
}

/**
 * Where a company's word stands on one ask. kept: the quote came by the day. late: it came after.
 * pending: the day has not come. today: it is due today. passed: the day went by with no quote.
 */
export type PromiseState = 'kept' | 'late' | 'pending' | 'today' | 'passed'

export interface AskPromise {
  by: string
  madeOn: string
  state: PromiseState
  /** Days until the day (pending), or since it (passed, late). */
  days: number
}

/** The promise that counts on an ask: the newest date they gave. Null when they gave none. */
export function askPromise(invite: Invite, today: string): AskPromise | null {
  const line = (invite.contacts ?? []).find((c) => c.promisedBy)
  if (!line?.promisedBy) return null
  const by = line.promisedBy
  const until = daysUntil(by, today)
  if (invite.bid) {
    const late = daysUntil(invite.bid.submittedOn, by)
    return { by, madeOn: line.on, state: late <= 0 ? 'kept' : 'late', days: Math.max(0, late) }
  }
  return { by, madeOn: line.on, state: until > 0 ? 'pending' : until === 0 ? 'today' : 'passed', days: Math.abs(until) }
}

export function promiseWords(p: AskPromise): string {
  const day = weekdayDate(p.by)
  if (p.state === 'kept') return `kept their word: quote by ${day}`
  if (p.state === 'late') return `quote came ${p.days} ${p.days === 1 ? 'day' : 'days'} after their ${day}`
  if (p.state === 'pending') return `promised by ${day}`
  if (p.state === 'today') return `promised today, ${day}`
  return `promised ${day}, ${p.days} ${p.days === 1 ? 'day' : 'days'} past`
}

/**
 * How often a company's date held: the promises before today plus the ones settled on live asks.
 * A day that passed with no quote counts against them even after they give a new day. A day they
 * moved before it came does not.
 */
export function wordRecord(state: GcState, partner: Partner): { made: number; kept: number } {
  let made = partner.promisesMade
  let kept = partner.promisesKept
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      const invite = pkg.invites.find((i) => i.partnerId === partner.id)
      const lines = (invite?.contacts ?? []).filter((c) => c.promisedBy)
      lines.forEach((line, i) => {
        const by = line.promisedBy
        if (!by || !invite) return
        const quotedOn = invite.bid?.submittedOn ?? null
        const keptIt = quotedOn !== null && daysUntil(quotedOn, by) <= 0
        const newer = lines[i - 1]
        const movedInTime = newer !== undefined && daysUntil(newer.on, by) <= 0
        if (keptIt) {
          // One quote keeps one promise: the newest day they gave.
          if (i === 0) {
            made += 1
            kept += 1
          }
        } else if (daysUntil(by, state.today) < 0 && !movedInTime) {
          made += 1
        }
      })
    }
  }
  return { made, kept }
}

export type FollowUpWhy = 'passed' | 'today' | 'silent' | 'nodate' | 'waiting'

/** One company to chase on one ask, with the reason said as a sentence. */
export interface FollowUp {
  project: GcProject
  pkg: TradePackage
  invite: Invite
  partner: Partner
  why: FollowUpWhy
  words: string
  /** Lower sorts first. */
  order: number
}

/**
 * Everyone we are waiting on, the ones to call first. A promise that passed leads, then a promise
 * due today, then a company that never opened the ask, then one that has the plans and gave no
 * date. A promise not due yet is listed last, as waiting: nothing to do but know it.
 */
export function followUps(state: GcState): FollowUp[] {
  const out: FollowUp[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      if (!packageIsOpen(project, pkg)) continue
      for (const invite of pkg.invites) {
        if (invite.status !== 'invited' && invite.status !== 'opened') continue
        const partner = partnerById(state, invite.partnerId)
        if (!partner) continue
        const promise = askPromise(invite, state.today)
        const asked = daysUntil(state.today, invite.invitedOn)
        const due = project.bidDue ? ` Our bid is due ${weekdayDate(project.bidDue)}.` : ''
        const base = { project, pkg, invite, partner }
        if (promise?.state === 'passed') {
          out.push({ ...base, why: 'passed', order: -promise.days, words: `Promised a quote by ${weekdayDate(promise.by)}. That was ${promise.days} ${promise.days === 1 ? 'day' : 'days'} ago.${due}` })
        } else if (promise?.state === 'today') {
          out.push({ ...base, why: 'today', order: 100, words: `Promised a quote today.${due}` })
        } else if (promise?.state === 'pending') {
          out.push({ ...base, why: 'waiting', order: 400 + promise.days, words: `Promised a quote by ${weekdayDate(promise.by)}, in ${promise.days} ${promise.days === 1 ? 'day' : 'days'}.` })
        } else if (invite.status === 'invited' && asked > OPEN_WITHIN_DAYS) {
          out.push({ ...base, why: 'silent', order: 200 - asked, words: `Asked ${asked} days ago and has not opened it.${due}` })
        } else if (invite.status === 'opened') {
          out.push({ ...base, why: 'nodate', order: 300 - asked, words: `Has the plans and has not said when the quote will come.${due}` })
        }
      }
    }
  }
  return out.sort((a, b) => a.order - b.order)
}

export interface BidTabRow {
  partnerId: string
  company: string
  amount: number
  rank: number
  /** How far over the low quote, as a percent. 0 for the low. */
  overLowPct: number
  awarded: boolean
}

/** The quotes on a trade as each company sent them, low to high. Our own plugs stay out of it. */
export function bidTabRows(state: GcState, pkg: TradePackage): BidTabRow[] {
  const rows = bidsIn(pkg)
    .map((invite) => ({ invite, amount: invite.bid?.amount ?? 0 }))
    .sort((a, b) => a.amount - b.amount)
  const low = rows[0]?.amount ?? 0
  return rows.map(({ invite, amount }, i) => ({
    partnerId: invite.partnerId,
    company: partnerById(state, invite.partnerId)?.company ?? 'A company',
    amount,
    rank: i + 1,
    overLowPct: low > 0 ? Math.round(((amount - low) / low) * 1000) / 10 : 0,
    awarded: pkg.awardedInviteId === invite.id,
  }))
}

/** Bid tabs open once our own bid is in: before that, a tab would show one company another's price. */
export function bidTabsOpen(project: GcProject): boolean {
  return project.ourBidSentOn !== null || project.stage !== 'pursuing'
}

/** A tab needs two quotes to say anything. */
export function packageHasTab(pkg: TradePackage): boolean {
  return !pkg.selfPerform && bidsIn(pkg).length >= 2
}

/** What a company that quoted is told about how it came out. */
export function bidTabResult(project: GcProject, pkg: TradePackage, partnerId: string): string {
  if (project.stage === 'pursuing') {
    return `Click sent its bid${project.ourBidSentOn ? ` on ${shortDate(project.ourBidSentOn)}` : ''}. The owner has not picked a builder yet.`
  }
  if (pkg.awardedInviteId === null) return 'Click won the project. This trade is not awarded yet.'
  const winner = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  return winner?.partnerId === partnerId ? 'Click won the project. This trade is yours.' : 'Click won the project. This trade went to another company.'
}

/** One company in the line for a trade on a project, nearest first. */
export interface LineupRow {
  partner: Partner
  travel: Travel
  invite: Invite | null
  /** 1 is the closest. Null: no coverage set, so not on the map. */
  rank: number | null
}

/** Every company that does this trade, in the order to work through them: the shortest drive first. */
export function tradeLineup(state: GcState, project: GcProject, pkg: TradePackage): LineupRow[] {
  const rows = state.partners
    .filter((p) => p.trades.includes(pkg.trade))
    .map((partner) => ({
      partner,
      travel: travelFor(state, partner, project),
      invite: pkg.invites.find((i) => i.partnerId === partner.id) ?? null,
    }))
    .sort((a, b) => (a.travel.miles ?? 9999) - (b.travel.miles ?? 9999) || a.partner.company.localeCompare(b.partner.company))
  let rank = 0
  return rows.map((row) => ({ ...row, rank: row.travel.miles === null ? null : ++rank }))
}

/** The next company to offer the trade to: the closest one in range we have not asked. */
export function nextToAsk(rows: LineupRow[]): LineupRow | null {
  return rows.find((r) => r.invite === null && r.travel.inZone) ?? null
}

/** The least quotes we want on a trade, from different companies, before we trust the number. */
export const BIDS_WANTED = 2

/** One project's open ask for one trade: who we asked, who answered, how short we are. */
export interface TradeNeed {
  project: GcProject
  pkg: TradePackage
  bids: number
  /** Opened the plans, no number yet. */
  looking: number
  /** Asked and never opened it. */
  silent: number
  passed: number
  short: number
  daysLeft: number | null
}

export interface PartnerAsk {
  project: GcProject
  pkg: TradePackage
  invite: Invite
  /** Days since we asked. */
  waited: number
}

export interface TradeBench {
  trade: string
  partners: Partner[]
  needs: TradeNeed[]
  /** Bids still missing across every open ask. */
  short: number
  /** How much trouble the trade is in: missing bids weigh more the nearer the due date, and most with none in. */
  urgency: number
  /** Companies on the bench that would bid if asked: not counting the ones who mostly stay silent. */
  dependable: number
}

/** A trade is still open on a project until it is awarded. A trade we do ourselves never is. */
function packageIsOpen(project: GcProject, pkg: TradePackage): boolean {
  return !pkg.selfPerform && pkg.awardedInviteId === null && project.stage !== 'building'
}

export type AnswerRecord = 'new' | 'reliable' | 'mixed' | 'silent'

/** How a company has answered our asks so far. Two asks is the least we judge on. */
export function answerRecord(partner: Partner): AnswerRecord {
  if (partner.invited < 2) return 'new'
  const rate = partner.bids / partner.invited
  return rate >= 0.75 ? 'reliable' : rate >= 0.4 ? 'mixed' : 'silent'
}

export function partnerAsks(state: GcState, partnerId: string, trade: string): PartnerAsk[] {
  const out: PartnerAsk[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      if (pkg.trade !== trade) continue
      const invite = pkg.invites.find((i) => i.partnerId === partnerId)
      if (invite) out.push({ project, pkg, invite, waited: daysUntil(state.today, invite.invitedOn) })
    }
  }
  return out
}

/** Every trade with its bench of companies and its open asks, the trade in the most trouble first. */
export function tradeBenches(state: GcState): TradeBench[] {
  const byTrade = new Map<string, TradeBench>()
  const bench = (trade: string): TradeBench => {
    let b = byTrade.get(trade)
    if (!b) {
      b = { trade, partners: [], needs: [], short: 0, urgency: 0, dependable: 0 }
      byTrade.set(trade, b)
    }
    return b
  }
  for (const partner of state.partners) {
    for (const trade of partner.trades) {
      const b = bench(trade)
      b.partners.push(partner)
      if (answerRecord(partner) !== 'silent') b.dependable += 1
    }
  }
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      if (!packageIsOpen(project, pkg)) continue
      const bids = bidsIn(pkg).length
      const need: TradeNeed = {
        project,
        pkg,
        bids,
        looking: pkg.invites.filter((i) => i.status === 'opened').length,
        silent: pkg.invites.filter((i) => i.status === 'invited').length,
        passed: pkg.invites.filter((i) => i.status === 'declined').length,
        short: Math.max(0, BIDS_WANTED - bids),
        daysLeft: project.bidDue ? daysUntil(project.bidDue, state.today) : null,
      }
      const b = bench(pkg.trade)
      b.needs.push(need)
      b.short += need.short
      if (need.short > 0) {
        const near = need.daysLeft === null ? 1 : need.daysLeft <= 7 ? 3 : need.daysLeft <= 14 ? 2 : 1
        b.urgency += need.short * near + (bids === 0 ? 2 : 0)
      }
    }
  }
  const out = [...byTrade.values()]
  for (const b of out) {
    b.needs.sort((x, y) => (x.daysLeft ?? 999) - (y.daysLeft ?? 999))
    b.partners.sort((x, y) => y.bids / Math.max(1, y.invited) - x.bids / Math.max(1, x.invited))
  }
  return out.sort((x, y) => y.urgency - x.urgency || x.dependable - y.dependable || x.trade.localeCompare(y.trade))
}

/** A trade's bench is deep enough at this many companies that usually answer. */
export const BENCH_WANTED = 3
/** A company we ask should open the plans within this many days. */
export const OPEN_WITHIN_DAYS = 3

export type AssistantDo =
  | { kind: 'chase' }
  | { kind: 'tab'; projectId: string; packageId: string }
  | { kind: 'add'; trade: string }
  | { kind: 'ask'; projectId: string; packageId: string; partnerIds: string[] }
  | { kind: 'nudge'; projectId: string; packageId: string; inviteId: string; about: string }
  | { kind: 'msa'; partnerId: string }

export interface AssistantItem {
  id: string
  text: string
  /** The one press that moves it. Null: nothing to press, the words say what to do. */
  action: AssistantDo | null
  actionLabel: string
  /** Already done today, still not at the ideal. */
  doneNote: string | null
}

/** One standard the office holds itself to: the ideal, where we are, and what closes the gap. */
export interface AssistantRule {
  key: 'bench' | 'bids' | 'opened' | 'paperwork' | 'tabs' | 'word'
  title: string
  ideal: string
  now: string
  ok: boolean
  items: AssistantItem[]
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The assistant's list: each standard with its ideal, where we are, and the gaps, worst first. */
export function assistantRules(state: GcState): AssistantRule[] {
  const benches = tradeBenches(state)

  const thin = benches.filter((b) => b.dependable < BENCH_WANTED).sort((x, y) => x.dependable - y.dependable)
  const bench: AssistantRule = {
    key: 'bench',
    title: 'A deep bench in every trade',
    ideal: `Every trade has ${BENCH_WANTED} companies we can count on. A company counts until it has stayed silent on most of our asks.`,
    now: `${benches.length - thin.length} of ${plural(benches.length, 'trade', 'trades')} have ${BENCH_WANTED}.`,
    ok: thin.length === 0,
    items: thin.map((b) => ({
      id: `bench-${b.trade}`,
      text: `${b.trade} has ${b.dependable}. Find ${BENCH_WANTED - b.dependable} more.`,
      action: { kind: 'add', trade: b.trade },
      actionLabel: 'Add a company',
      doneNote: null,
    })),
  }

  const needs = benches.flatMap((b) => b.needs.map((need) => ({ bench: b, need })))
  const shortNeeds = needs.filter((n) => n.need.short > 0).sort((x, y) => (x.need.daysLeft ?? 999) - (y.need.daysLeft ?? 999) || x.need.bids - y.need.bids)
  const bids: AssistantRule = {
    key: 'bids',
    title: `${BIDS_WANTED} bids on every trade we put out`,
    ideal: `Every trade out to bid has ${BIDS_WANTED} bids before the due date. One company going quiet should not leave us with one number.`,
    now: `${needs.length - shortNeeds.length} of ${plural(needs.length, 'open ask', 'open asks')} have ${BIDS_WANTED} bids.`,
    ok: shortNeeds.length === 0,
    items: shortNeeds.map(({ bench: b, need }) => {
      const asked = new Set(need.pkg.invites.map((i) => i.partnerId))
      const notAsked = b.partners
        .filter((p) => !asked.has(p.id) && travelFor(state, p, need.project).inZone)
        .map((p) => p.id)
      const due = need.daysLeft === null ? '' : ` Due ${shortDate(need.project.bidDue)}, in ${plural(need.daysLeft, 'day', 'days')}.`
      return {
        id: `bids-${need.pkg.id}`,
        text: `${need.project.name}, ${b.trade}: ${need.bids} of ${BIDS_WANTED} bids.${due}`,
        action:
          notAsked.length > 0
            ? { kind: 'ask', projectId: need.project.id, packageId: need.pkg.id, partnerIds: notAsked }
            : { kind: 'add', trade: b.trade },
        actionLabel: notAsked.length > 0 ? `Ask the ${notAsked.length} we have not asked` : 'Everyone in range is asked. Add a company',
        doneNote: null,
      }
    }),
  }

  const asks: { project: GcProject; pkg: TradePackage; invite: Invite; partner: Partner; waited: number }[] = []
  let liveAsks = 0
  const askedPartners = new Map<string, Partner>()
  for (const { need } of needs) {
    for (const invite of need.pkg.invites) {
      const partner = partnerById(state, invite.partnerId)
      if (!partner || invite.status === 'declined') continue
      liveAsks += 1
      askedPartners.set(partner.id, partner)
      const waited = daysUntil(state.today, invite.invitedOn)
      if (invite.status === 'invited' && waited > OPEN_WITHIN_DAYS) asks.push({ project: need.project, pkg: need.pkg, invite, partner, waited })
    }
  }
  asks.sort((x, y) => y.waited - x.waited)
  const opened: AssistantRule = {
    key: 'opened',
    title: 'Every company we ask opens the plans',
    ideal: `A company we ask opens the plans within ${OPEN_WITHIN_DAYS} days. After that we call them.`,
    now: `${liveAsks - asks.length} of ${plural(liveAsks, 'ask', 'asks')} are opened or still inside ${OPEN_WITHIN_DAYS} days.`,
    ok: asks.length === 0,
    items: asks.map((a) => ({
      id: `opened-${a.invite.id}`,
      text: `${a.partner.company} has not opened ${a.project.name} in ${a.waited} days. Call ${a.partner.contact || 'them'}.`,
      action: {
        kind: 'nudge',
        projectId: a.project.id,
        packageId: a.pkg.id,
        inviteId: a.invite.id,
        about: `we have not seen you open ${a.project.name}. Are you bidding ${a.pkg.trade.toLowerCase()}?`,
      },
      actionLabel: 'Nudge them',
      doneNote: a.invite.nudgedOn === state.today ? 'nudged today' : null,
    })),
  }

  const missing = [...askedPartners.values()].filter((p) => partnerBlockers(p, state.today).length > 0)
  const paperwork: AssistantRule = {
    key: 'paperwork',
    title: 'Paperwork in before we award',
    ideal: 'Every company we ask has a signed master agreement, insurance on file and a W-9. Then an award is one press.',
    now: `${askedPartners.size - missing.length} of ${plural(askedPartners.size, 'company', 'companies')} we are asking have all three.`,
    ok: missing.length === 0,
    items: missing.map((p) => ({
      id: `paper-${p.id}`,
      text: `${p.company}: ${partnerBlockers(p, state.today).join(' ')}`,
      action: p.msa === 'none' ? { kind: 'msa', partnerId: p.id } : null,
      actionLabel: 'Send the master agreement',
      doneNote: p.msa === 'sent' ? 'master agreement sent, waiting on them' : null,
    })),
  }

  const tabbable = state.projects.flatMap((project) =>
    bidTabsOpen(project) ? project.packages.filter(packageHasTab).map((pkg) => ({ project, pkg })) : [],
  )
  const unshared = tabbable.filter(({ pkg }) => pkg.bidTab === null)
  const tabs: AssistantRule = {
    key: 'tabs',
    title: 'A bid tab back to everyone who quoted',
    ideal: 'Once our bid is in, every company that quoted sees where it stood. It is why they answer the next time we ask.',
    now: `${tabbable.length - unshared.length} of ${plural(tabbable.length, 'trade', 'trades')} with our bid in have a bid tab shared.`,
    ok: unshared.length === 0,
    items: unshared.map(({ project, pkg }) => ({
      id: `tab-${pkg.id}`,
      text: `${project.name}, ${pkg.trade}: ${bidsIn(pkg).length} companies quoted. No bid tab shared.`,
      action: { kind: 'tab', projectId: project.id, packageId: pkg.id },
      actionLabel: 'Share the bid tab',
      doneNote: null,
    })),
  }

  const chase = followUps(state)
  const given = chase.filter((f) => f.why === 'passed' || f.why === 'today' || f.why === 'waiting')
  const passed = chase.filter((f) => f.why === 'passed')
  const word: AssistantRule = {
    key: 'word',
    title: 'Every promise held to its day',
    ideal: 'When a company gives us a day for its quote, we write it down. The day after it passes with no quote, we call.',
    now: `${given.length - passed.length} of ${plural(given.length, 'promise', 'promises')} on live asks are still good.`,
    ok: passed.length === 0,
    items: passed.map((f) => ({
      id: `word-${f.invite.id}`,
      text: `${f.partner.company}, ${f.project.name}, ${f.pkg.trade}: ${f.words}`,
      action: { kind: 'chase' },
      actionLabel: 'Go to Follow up',
      doneNote: null,
    })),
  }

  return [bench, bids, opened, paperwork, tabs, word]
}

/** What stops paperwork or money from moving for this partner. Empty when nothing does. */
export function partnerBlockers(partner: Partner, today: string): string[] {
  const out: string[] = []
  if (partner.msa !== 'signed') out.push('The master agreement is not signed.')
  if (!partner.coiExpires) out.push('No insurance certificate is on file.')
  else if (daysUntil(partner.coiExpires, today) < 0) out.push(`Their insurance expired ${shortDate(partner.coiExpires)}.`)
  if (!partner.w9) out.push('No W-9 is on file.')
  return out
}

// ---------------------------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------------------------

function mapProject(state: GcState, projectId: string, fn: (p: GcProject) => GcProject): GcState {
  return { ...state, projects: state.projects.map((p) => (p.id === projectId ? fn(p) : p)) }
}

function mapPackage(project: GcProject, packageId: string, fn: (p: TradePackage) => TradePackage): GcProject {
  return { ...project, packages: project.packages.map((p) => (p.id === packageId ? fn(p) : p)) }
}

function mapInvite(pkg: TradePackage, inviteId: string, fn: (i: Invite) => Invite): TradePackage {
  return { ...pkg, invites: pkg.invites.map((i) => (i.id === inviteId ? fn(i) : i)) }
}

function mapSow(pkg: TradePackage, fn: (s: Sow) => Sow): TradePackage {
  return pkg.sow ? { ...pkg, sow: fn(pkg.sow) } : pkg
}

function logged(state: GcState, who: LogEntry['who'], text: string): GcState {
  const id = (state.log[0]?.id ?? 0) + 1
  return { ...state, log: [{ id, who, text }, ...state.log].slice(0, 30) }
}

function find(state: GcState, projectId: string, packageId: string, inviteId?: string) {
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((p) => p.id === packageId)
  const invite = inviteId ? pkg?.invites.find((i) => i.id === inviteId) : undefined
  const partner = invite ? partnerById(state, invite.partnerId) : undefined
  return { project, pkg, invite, partner }
}

function awardedPartner(state: GcState, pkg: TradePackage | undefined): Partner | undefined {
  const invite = pkg?.invites.find((i) => i.id === pkg.awardedInviteId)
  return invite ? partnerById(state, invite.partnerId) : undefined
}

/** A statement of work drawn from the leveled bid: the price, the scope as a schedule of values. */
function sowFromBid(project: GcProject, pkg: TradePackage, invite: Invite): Sow {
  const price = leveledTotal(pkg, invite) ?? pkg.budget
  const each = Math.floor(price / Math.max(1, pkg.scope.length) / 100) * 100
  const sov = pkg.scope.map((item, i) => ({
    id: item.id,
    label: item.label,
    amount: i === pkg.scope.length - 1 ? price - each * (pkg.scope.length - 1) : each,
    pctReported: 0,
    pctBilled: 0,
  }))
  return { status: 'draft', price, retainagePct: 10, basedOnRev: currentRev(project), sov, signedOn: null, draws: [] }
}

export function gcReducer(state: GcState, action: GcAction): GcState {
  switch (action.type) {
    case 'reset':
      return initialGcState()

    case 'issueAddendum': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const rev = currentRev(project) + 1
      const everyone = planRecipients(state, project, action.touches)
      const chosen = action.recipients ? everyone.filter((r) => action.recipients?.includes(r.partner.id)) : everyone
      const sentTo = [...new Map(chosen.map((r) => [r.partner.id, { partnerId: r.partner.id, on: state.today, touched: chosen.some((x) => x.partner.id === r.partner.id && x.touched) }])).values()]
      const set: PlanSet = {
        rev,
        label: `Addendum ${rev}`,
        issuedOn: state.today,
        note: action.note,
        changedSheets: action.sheets,
        touches: action.touches,
        sentTo,
      }
      const next = mapProject(state, action.projectId, (p) => ({ ...p, planSets: [...p.planSets, set] }))
      return logged(
        next,
        'office',
        `Issued ${set.label} on ${project.name} and emailed ${sentTo.length} ${sentTo.length === 1 ? 'company' : 'companies'}. ${sentTo.filter((x) => x.touched).length} were told it changes their trade.`,
      )
    }

    case 'invite': {
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = partnerById(state, action.partnerId)
      if (!project || !pkg || !partner) return state
      const invite: Invite = {
        id: `${pkg.id}-${partner.id}`,
        partnerId: partner.id,
        status: 'invited',
        invitedOn: state.today,
        seenRev: null,
        bid: null,
      }
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => ({ ...k, invites: [...k.invites, invite] })),
      )
      return logged(
        { ...next, partners: next.partners.map((p) => (p.id === partner.id ? { ...p, invited: p.invited + 1 } : p)) },
        'office',
        `Invited ${partner.company} to bid ${pkg.trade}.`,
      )
    }

    case 'nudge': {
      const { partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!partner) return state
      const line: AskContact = { on: state.today, by: 'You', how: 'nudge', note: `Nudged: ${action.about}` }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, action.packageId, (k) =>
          mapInvite(k, action.inviteId, (i) => ({ ...i, nudgedOn: state.today, contacts: [line, ...(i.contacts ?? [])] })),
        ),
      )
      return logged(next, 'office', `Nudged ${partner.company}: ${action.about}`)
    }

    case 'logContact': {
      const { pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !partner) return state
      const line: AskContact = {
        on: state.today,
        by: 'You',
        how: action.how,
        note: action.note,
        ...(action.promisedBy ? { promisedBy: action.promisedBy } : {}),
      }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, action.inviteId, (i) => ({ ...i, contacts: [line, ...(i.contacts ?? [])] }))),
      )
      return logged(
        next,
        'office',
        action.promisedBy
          ? `${partner.company} promised their ${pkg.trade} quote by ${weekdayDate(action.promisedBy)}.`
          : `Logged a ${action.how} with ${partner.company} about ${pkg.trade}.`,
      )
    }

    case 'tradePromise': {
      const { pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !partner) return state
      const line: AskContact = {
        on: state.today,
        by: partner.contact || partner.company,
        how: 'portal',
        note: 'Said in their portal when the quote will come.',
        promisedBy: action.promisedBy,
      }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, action.inviteId, (i) => ({ ...i, contacts: [line, ...(i.contacts ?? [])] }))),
      )
      return logged(next, 'trade', `${partner.company} promised their ${pkg.trade} quote by ${weekdayDate(action.promisedBy)}.`)
    }

    case 'tradeOpenPlans': {
      const { project, pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!project || !pkg || !partner) return state
      const rev = currentRev(project)
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapInvite(k, action.inviteId, (i) => ({
            ...i,
            seenRev: rev,
            status: i.status === 'invited' ? 'opened' : i.status,
          })),
        ),
      )
      return logged(next, 'trade', `${partner.company} opened ${planLabel(project, rev)}.`)
    }

    case 'tradeSubmitBid': {
      const { project, pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!project || !pkg || !invite || !partner) return state
      const revised = invite.bid !== null
      const bid: SubBid = {
        amount: action.amount,
        basedOnRev: invite.seenRev ?? currentRev(project),
        submittedOn: state.today,
        includes: action.includes,
        plugs: invite.bid?.plugs ?? {},
        note: action.note,
      }
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapInvite(k, invite.id, (i) => ({ ...i, status: 'bid', seenRev: bid.basedOnRev, bid })),
        ),
      )
      return logged(
        {
          ...next,
          partners: next.partners.map((p) => (p.id === partner.id && !revised ? { ...p, bids: p.bids + 1 } : p)),
        },
        'trade',
        `${partner.company} ${revised ? 'revised their bid to' : 'bid'} ${money(action.amount)} on ${pkg.trade}.`,
      )
    }

    case 'tradeConfirmBid': {
      const { project, pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!project || !pkg || !invite?.bid || !partner) return state
      const rev = currentRev(project)
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, invite.id, (i) => (i.bid ? { ...i, seenRev: rev, bid: { ...i.bid, basedOnRev: rev } } : i))),
      )
      return logged(next, 'trade', `${partner.company} confirmed their ${pkg.trade} number of ${money(invite.bid.amount)} stands on ${planLabel(project, rev)}.`)
    }

    case 'setStartItem': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const on = action.done ? state.today : null
      const next = mapProject(state, project.id, (p) => (action.item === 'ownerContract' ? { ...p, ownerContractSignedOn: on } : { ...p, permitOn: on }))
      const what = action.item === 'ownerContract' ? `Our contract with ${project.owner}` : 'The permit'
      return logged(next, 'office', action.done ? `${what} is marked done on ${project.name}.` : `${what} is marked not done on ${project.name}.`)
    }

    case 'setStartDate':
      return mapProject(state, action.projectId, (p) => ({ ...p, startDate: action.date || null }))

    case 'startProject': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const told = planRecipients(state, { ...project, stage: 'building' }, []).length
      const next = mapProject(state, project.id, (p) => ({ ...p, stage: 'building', startedOn: state.today }))
      return logged(
        next,
        'office',
        `${project.name} is started${project.startDate ? `. Work begins ${weekdayDate(project.startDate)}` : ''}. Emailed the ${told} ${told === 1 ? 'company' : 'companies'} on the job.`,
      )
    }

    case 'tradeDecline': {
      const { pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !partner) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, action.inviteId, (i) => ({ ...i, status: 'declined' }))),
      )
      return logged(next, 'trade', `${partner.company} passed on ${pkg.trade}.`)
    }

    case 'markBidSent': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const next = mapProject(state, project.id, (p) => ({ ...p, ourBidSentOn: state.today }))
      return logged(next, 'office', `Our bid on ${project.name} went to ${project.owner}. Bid tabs can go out now.`)
    }

    case 'shareBidTab': {
      const { project, pkg } = find(state, action.projectId, action.packageId)
      if (!project || !pkg) return state
      const first = pkg.bidTab === null
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => ({
          ...k,
          bidTab: { sharedOn: k.bidTab?.sharedOn ?? state.today, showNames: action.showNames, seenBy: k.bidTab?.seenBy ?? [] },
        })),
      )
      const n = bidsIn(pkg).length
      return logged(
        next,
        'office',
        first
          ? `Shared the ${pkg.trade} bid tab with the ${n} companies that quoted${action.showNames ? ', names shown' : ', names hidden'}.`
          : `The ${pkg.trade} bid tab now ${action.showNames ? 'shows' : 'hides'} company names.`,
      )
    }

    case 'tradeSeeBidTab': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = partnerById(state, action.partnerId)
      if (!pkg?.bidTab || !partner || pkg.bidTab.seenBy.includes(partner.id)) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => (k.bidTab ? { ...k, bidTab: { ...k.bidTab, seenBy: [...k.bidTab.seenBy, partner.id] } } : k)),
      )
      return logged(next, 'trade', `${partner.company} opened the ${pkg.trade} bid tab.`)
    }

    case 'officeDecline': {
      const { pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !partner) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, action.inviteId, (i) => ({ ...i, status: 'declined', declinedWhy: action.why }))),
      )
      return logged(next, 'office', `${partner.company} ${action.why === 'wont' ? 'will not do' : 'cannot do'} ${pkg.trade}. Offer it to the next company.`)
    }

    case 'setPlug':
      return mapProject(state, action.projectId, (p) =>
        mapPackage(p, action.packageId, (k) =>
          mapInvite(k, action.inviteId, (i) =>
            i.bid ? { ...i, bid: { ...i.bid, plugs: { ...i.bid.plugs, [action.scopeId]: action.amount } } } : i,
          ),
        ),
      )

    case 'carry': {
      const { pkg } = find(state, action.projectId, action.packageId)
      if (!pkg) return state
      const invite = pkg.invites.find((i) => i.id === action.carried)
      const partner = invite ? partnerById(state, invite.partnerId) : undefined
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => ({ ...k, carried: action.carried })),
      )
      const words =
        action.carried === null
          ? `Stopped carrying a number for ${pkg.trade}.`
          : action.carried === 'plug'
            ? `Carrying our budget of ${money(pkg.budget)} for ${pkg.trade}.`
            : `Carrying ${partner?.company ?? 'a bid'} for ${pkg.trade}.`
      return logged(next, 'office', words)
    }

    case 'markWon': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const next = mapProject(state, project.id, (p) => ({ ...p, stage: 'buyout' }))
      return logged(next, 'office', `We won ${project.name}. Buyout starts: award each trade.`)
    }

    case 'award': {
      const { project, pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!project || !pkg || !invite || !partner) return state
      const sow = sowFromBid(project, pkg, invite)
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => ({ ...k, carried: invite.id, awardedInviteId: invite.id, sow })),
      )
      return logged(
        { ...next, partners: next.partners.map((p) => (p.id === partner.id ? { ...p, won: p.won + 1 } : p)) },
        'office',
        `Awarded ${pkg.trade} to ${partner.company}. A statement of work is drafted from their bid.`,
      )
    }

    case 'sendMsa': {
      const partner = partnerById(state, action.partnerId)
      if (!partner) return state
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, msa: 'sent' } : p)) },
        'office',
        `Sent the master agreement to ${partner.company}.`,
      )
    }

    case 'tradeSignMsa': {
      const partner = partnerById(state, action.partnerId)
      if (!partner) return state
      return logged(
        {
          ...state,
          partners: state.partners.map((p) =>
            p.id === partner.id ? { ...p, msa: 'signed', msaSignedOn: state.today } : p,
          ),
        },
        'trade',
        `${partner.company} signed the master agreement.`,
      )
    }

    case 'sendSow': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      if (!pkg || !partner) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, status: 'sent' }))),
      )
      return logged(next, 'office', `Sent the ${pkg.trade} statement of work to ${partner.company}.`)
    }

    case 'tradeSignSow': {
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      if (!project || !pkg || !partner) return state
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, status: 'signed', signedOn: state.today }))),
      )
      return logged(next, 'trade', `${partner.company} signed the ${pkg.trade} statement of work.`)
    }

    case 'tradeReport': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const line = pkg?.sow?.sov.find((l) => l.id === action.sovId)
      if (!pkg || !partner || !line) return state
      const pct = Math.max(line.pctBilled, Math.min(100, action.pct))
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({
            ...s,
            sov: s.sov.map((l) => (l.id === line.id ? { ...l, pctReported: pct } : l)),
          })),
        ),
      )
      return logged(next, 'trade', `${partner.company} reported ${line.label} at ${pct}%.`)
    }

    case 'tradeRequestDraw': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      if (!pkg || !partner || !sow) return state
      const lines = sow.sov.filter((l) => l.pctReported > l.pctBilled)
      const gross = lines.reduce((s, l) => s + (l.amount * (l.pctReported - l.pctBilled)) / 100, 0)
      if (gross <= 0) return state
      const retainage = (gross * sow.retainagePct) / 100
      const number = sow.draws.length + 1
      const draw: Draw = {
        id: `${pkg.id}-draw-${number}`,
        number,
        requestedOn: state.today,
        gross,
        retainage,
        net: gross - retainage,
        status: 'requested',
        waiver: 'conditional',
        lines: lines.map((l) => ({ sovId: l.id, toPct: l.pctReported })),
      }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, draws: [...s.draws, draw] }))),
      )
      return logged(
        next,
        'trade',
        `${partner.company} asked for draw ${number} on ${pkg.trade}: ${money(gross)}, with a conditional waiver signed.`,
      )
    }

    case 'approveDraw': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const draw = pkg?.sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !draw) return state
      const toPct = new Map(draw.lines.map((l) => [l.sovId, l.toPct]))
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({
            ...s,
            sov: s.sov.map((l) => ({ ...l, pctBilled: Math.max(l.pctBilled, toPct.get(l.id) ?? 0) })),
            draws: s.draws.map((d) => (d.id === draw.id ? { ...d, status: 'approved' } : d)),
          })),
        ),
      )
      return logged(
        next,
        'office',
        `Approved draw ${draw.number} on ${pkg.trade}. ${money(draw.net)} to pay, ${money(draw.retainage)} held.`,
      )
    }

    case 'payDraw': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const draw = pkg?.sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !draw) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({ ...s, draws: s.draws.map((d) => (d.id === draw.id ? { ...d, status: 'paid' } : d)) })),
        ),
      )
      return logged(next, 'office', `Paid draw ${draw.number} on ${pkg.trade}: ${money(draw.net)}.`)
    }

    case 'tradeSignUnconditional': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const draw = pkg?.sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !partner || !draw) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({
            ...s,
            draws: s.draws.map((d) => (d.id === draw.id ? { ...d, waiver: 'unconditional' } : d)),
          })),
        ),
      )
      return logged(next, 'trade', `${partner.company} signed the unconditional waiver for draw ${draw.number}.`)
    }

    case 'logCustomerContact': {
      const customer = state.customers.find((c) => c.id === action.customerId)
      if (!customer) return state
      const entry = { on: state.today, by: 'You', note: action.note }
      return logged(
        { ...state, customers: state.customers.map((c) => (c.id === customer.id ? { ...c, contacts: [entry, ...c.contacts] } : c)) },
        'office',
        `Logged a contact with ${customer.name}.`,
      )
    }

    case 'addPartner': {
      const id = `new-${state.partners.length + 1}`
      const partner: Partner = {
        id,
        company: action.company,
        contact: action.contact,
        trades: [action.trade],
        base: action.base,
        maxMiles: action.maxMiles,
        msa: 'none',
        msaSignedOn: null,
        coiExpires: null,
        w9: false,
        invited: 0,
        bids: 0,
        won: 0,
        promisesMade: 0,
        promisesKept: 0,
      }
      return logged({ ...state, partners: [...state.partners, partner] }, 'office', `Added ${action.company} to ${action.trade}.`)
    }

    case 'setCoverage': {
      const partner = partnerById(state, action.partnerId)
      if (!partner) return state
      const words = action.base ? `from ${action.base}${action.maxMiles === null ? '' : `, goes ${action.maxMiles} miles`}` : 'not set'
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, base: action.base, maxMiles: action.maxMiles } : p)) },
        'office',
        `${partner.company} coverage: ${words}.`,
      )
    }

    case 'setMarkup':
      return mapProject(state, action.projectId, (p) => ({ ...p, [action.field]: action.value }))
  }
}

// ---------------------------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------------------------

function scope(prefix: string, labels: string[]): ScopeItem[] {
  return labels.map((label, i) => ({ id: `${prefix}-${i + 1}`, label }))
}

function bid(
  items: ScopeItem[],
  amount: number,
  basedOnRev: number,
  submittedOn: string,
  note = '',
  gaps: Record<string, Includes> = {},
  plugs: Record<string, number> = {},
): SubBid {
  const includes: Record<string, Includes> = {}
  for (const item of items) includes[item.id] = gaps[item.id] ?? 'yes'
  return { amount, basedOnRev, submittedOn, includes, plugs, note }
}

function invite(
  packageId: string,
  partnerId: string,
  status: InviteStatus,
  seenRev: number | null,
  b: SubBid | null = null,
): Invite {
  return { id: `${packageId}-${partnerId}`, partnerId, status, invitedOn: '2026-09-19', seenRev, bid: b }
}

function pkg(
  id: string,
  trade: string,
  items: ScopeItem[],
  budget: number,
  invites: Invite[],
  rest: Partial<TradePackage> = {},
): TradePackage {
  return {
    id,
    trade,
    bidTab: null,
    scope: items,
    budget,
    selfPerform: null,
    invites,
    carried: null,
    awardedInviteId: null,
    sow: null,
    ...rest,
  }
}

export function initialGcState(): GcState {
  const site = scope('site', ['Clearing and grading', 'Utilities to 5 ft of the building', 'Paving', 'Striping and signs'])
  const conc = scope('conc', ['Foundations', 'Slab on grade', 'Sidewalks and curbs', 'Rebar supply'])
  const steel = scope('steel', ['Structural steel', 'Joists and deck', 'Erection'])
  const roof = scope('roof', ['TPO membrane', 'Insulation', 'Sheet metal and flashing', 'Roof curbs'])
  const plumb = scope('plumb', ['Underground', 'Rough in', 'Top out', 'Trim'])
  const hvac = scope('hvac', ['Rooftop units', 'Ductwork', 'Controls', 'Test and balance'])
  const elec = scope('elec', ['Service and gear', 'Panels and feeders', 'Lighting', 'Fire alarm', 'Site lighting'])
  const fire = scope('fire', ['Design and permit', 'Mains and branch lines', 'Heads and trim'])

  const dry = scope('dry', ['Framing', 'Hang and tape', 'Ceilings'])
  const dElec = scope('delec', ['Panels and feeders', 'Lighting', 'Devices', 'Low voltage rough'])
  const dHvac = scope('dhvac', ['Split systems', 'Ductwork', 'Controls'])
  const mill = scope('mill', ['Reception desk', 'Operatory cabinets', 'Break room'])

  const boerne: GcProject = {
    id: 'boerne',
    name: 'Boerne Retail Shell',
    address: '1420 River Rd, Boerne',
    town: 'Boerne',
    ourBidSentOn: null,
    ownerContractSignedOn: null,
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: 'cibolo',
    owner: 'Cibolo Creek Partners',
    ownerBilling: null,
    architectId: 'marshvale',
    architect: 'Marsh & Vale Architects',
    questions: [
      {
        id: 'q-elec-1',
        packageId: 'elec',
        partnerId: 'brightline',
        text: 'E-301 shows a 400 amp service. The panel schedules add up to 520 amps. Which is right?',
        askedOn: '2026-09-30',
        answeredOn: null,
        answer: null,
      },
      {
        id: 'q-roof-1',
        packageId: 'roof',
        partnerId: 'summit',
        text: 'Who sets the roof curbs, the roofer or the mechanical contractor? A-401 and M-101 disagree.',
        askedOn: '2026-09-27',
        answeredOn: null,
        answer: null,
      },
      {
        id: 'q-site-1',
        packageId: 'site',
        partnerId: 'lonestar',
        text: 'Is striping part of sitework?',
        askedOn: '2026-09-24',
        answeredOn: '2026-09-26',
        answer: 'Yes. Striping and signs are in sitework. See note 14 on C-101.',
      },
    ],
    stage: 'pursuing',
    bidDue: '2026-10-08',
    sizeNote: '8,400 sq ft shell, three tenant bays',
    sheets: [
      { id: 'G-001', title: 'Cover and code summary' },
      { id: 'C-101', title: 'Site plan' },
      { id: 'C-201', title: 'Grading and drainage' },
      { id: 'C-301', title: 'Utility plan' },
      { id: 'A-101', title: 'Floor plan' },
      { id: 'A-201', title: 'Exterior elevations' },
      { id: 'A-301', title: 'Building sections' },
      { id: 'A-401', title: 'Wall sections and details' },
      { id: 'S-101', title: 'Foundation plan' },
      { id: 'S-201', title: 'Roof framing plan' },
      { id: 'M-101', title: 'Mechanical plan' },
      { id: 'M-201', title: 'Mechanical schedules' },
      { id: 'E-101', title: 'Lighting plan' },
      { id: 'E-201', title: 'Power plan' },
      { id: 'E-301', title: 'One-line diagram and panel schedules' },
      { id: 'P-101', title: 'Plumbing underground' },
      { id: 'P-102', title: 'Plumbing plan' },
      { id: 'FP-101', title: 'Fire sprinkler plan' },
    ],
    planSets: [
      { rev: 0, label: 'Bid set', issuedOn: '2026-09-18', note: 'The set the owner sent out to bid. 18 sheets.', changedSheets: [], touches: [] },
      {
        rev: 1,
        label: 'Addendum 1',
        issuedOn: '2026-09-29',
        note: 'The tenant panel moved to the east wall. RTU-2 is one size larger.',
        changedSheets: ['E-201', 'E-301', 'M-101', 'P-102'],
        touches: ['elec', 'hvac', 'plumb'],
        sentTo: ['lonestar', 'tricounty', 'hillside', 'alamo', 'guadalupe', 'bexar', 'summit', 'bluebonnet', 'coolbreeze', 'kendall', 'voltage', 'brightline', 'tejas'].map((partnerId) => ({
          partnerId,
          on: '2026-09-29',
          touched: ['coolbreeze', 'kendall', 'voltage', 'brightline', 'tejas'].includes(partnerId),
        })),
      },
    ],
    packages: [
      pkg('site', 'Sitework', site, 185_000, [
        invite('site', 'lonestar', 'bid', 1, bid(site, 178_400, 1, '2026-09-30', 'Striping by others.', { 'site-4': 'no' }, { 'site-4': 6_500 })),
        invite('site', 'tricounty', 'bid', 1, bid(site, 191_000, 1, '2026-10-01')),
        invite('site', 'hillside', 'opened', 0),
      ], { carried: 'site-lonestar' }),
      pkg('conc', 'Concrete', conc, 212_000, [
        invite('conc', 'alamo', 'bid', 1, bid(conc, 205_500, 1, '2026-09-30', 'Rebar per the structural drawings.', { 'conc-4': 'unclear' })),
        invite('conc', 'guadalupe', 'bid', 1, bid(conc, 219_800, 1, '2026-10-01')),
      ], { carried: 'conc-guadalupe' }),
      pkg('steel', 'Structural steel', steel, 164_000, [
        invite('steel', 'bexar', 'invited', null),
        invite('steel', 'comal', 'declined', 0),
      ]),
      pkg('roof', 'Roofing', roof, 118_000, [
        invite('roof', 'summit', 'bid', 1, bid(roof, 112_300, 1, '2026-09-28', 'Curbs by the mechanical contractor.', { 'roof-4': 'no' })),
        invite('roof', 'bluebonnet', 'opened', 1),
      ], { carried: 'roof-summit' }),
      pkg('plumb', 'Plumbing', plumb, 86_400, [], {
        selfPerform: { ref: 'BP 512', value: 86_400, note: 'Our own bid, priced in Trades mode.' },
        carried: 'self',
      }),
      pkg('hvac', 'HVAC', hvac, 142_000, [
        invite('hvac', 'coolbreeze', 'bid', 0, bid(hvac, 148_900, 0, '2026-09-25')),
        invite('hvac', 'kendall', 'bid', 1, bid(hvac, 139_200, 1, '2026-10-01', 'Test and balance by an independent firm.', { 'hvac-4': 'no' }, { 'hvac-4': 4_800 })),
      ]),
      pkg('elec', 'Electrical', elec, 171_000, [
        invite('elec', 'voltage', 'bid', 0, bid(elec, 166_000, 0, '2026-09-26', 'Fire alarm excluded.', { 'elec-4': 'no' }, { 'elec-4': 14_000 })),
        invite('elec', 'brightline', 'bid', 1, bid(elec, 182_500, 1, '2026-10-01')),
        invite('elec', 'tejas', 'opened', 0),
      ]),
      pkg('fire', 'Fire sprinkler', fire, 44_000, []),
    ],
    generalConditions: 138_000,
    contingencyPct: 3,
    feePct: 8,
  }

  const helotes: GcProject = {
    id: 'helotes',
    name: 'Helotes Dental Office',
    address: '9811 Bandera Rd, Suite 140, Helotes',
    town: 'Helotes',
    ourBidSentOn: '2026-08-27',
    ownerContractSignedOn: '2026-09-04',
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: 'raman',
    owner: 'Dr. Priya Raman',
    ownerBilling: { billed: 61_000, paid: 42_300, retainageHeld: 6_100 },
    architectId: 'ocotillo',
    architect: 'Studio Ocotillo',
    questions: [
      {
        id: 'q-dry-1',
        packageId: 'dry',
        partnerId: 'hillcountry',
        text: 'Are the operatory walls full height to the deck?',
        askedOn: '2026-08-18',
        answeredOn: '2026-08-19',
        answer: 'Yes, to the deck, with sound batts. See detail 4 on A-201.',
      },
    ],
    stage: 'buyout',
    bidDue: null,
    sizeNote: '3,100 sq ft tenant finish out, six operatories',
    sheets: [
      { id: 'G-001', title: 'Cover and code summary' },
      { id: 'A-101', title: 'Demolition and floor plan' },
      { id: 'A-102', title: 'Reflected ceiling plan' },
      { id: 'A-201', title: 'Interior elevations' },
      { id: 'A-501', title: 'Millwork details' },
      { id: 'ID-101', title: 'Finish plan' },
      { id: 'M-101', title: 'Mechanical plan' },
      { id: 'E-101', title: 'Lighting plan' },
      { id: 'E-102', title: 'Power and data plan' },
      { id: 'E-201', title: 'Panel schedules' },
      { id: 'P-101', title: 'Plumbing plan' },
      { id: 'P-201', title: 'Plumbing risers and dental air' },
    ],
    planSets: [
      { rev: 0, label: 'Permit set', issuedOn: '2026-08-11', note: 'The set the city approved. 12 sheets.', changedSheets: [], touches: [] },
    ],
    packages: [
      pkg('dry', 'Framing and drywall', dry, 66_000, [
        invite('dry', 'hillcountry', 'bid', 0, bid(dry, 64_200, 0, '2026-08-20')),
      ], {
        carried: 'dry-hillcountry',
        awardedInviteId: 'dry-hillcountry',
        sow: {
          status: 'signed',
          price: 64_200,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: '2026-08-29',
          sov: [
            { id: 'dry-1', label: 'Framing', amount: 22_000, pctReported: 100, pctBilled: 100 },
            { id: 'dry-2', label: 'Hang and tape', amount: 27_200, pctReported: 60, pctBilled: 0 },
            { id: 'dry-3', label: 'Ceilings', amount: 15_000, pctReported: 0, pctBilled: 0 },
          ],
          draws: [
            {
              id: 'dry-draw-1',
              number: 1,
              requestedOn: '2026-09-19',
              gross: 22_000,
              retainage: 2_200,
              net: 19_800,
              status: 'paid',
              waiver: 'unconditional',
              lines: [{ sovId: 'dry-1', toPct: 100 }],
            },
          ],
        },
      }),
      pkg('delec', 'Electrical', dElec, 58_000, [
        invite('delec', 'brightline', 'bid', 0, bid(dElec, 56_900, 0, '2026-08-21')),
        invite('delec', 'voltage', 'bid', 0, bid(dElec, 61_400, 0, '2026-08-22')),
      ], {
        carried: 'delec-brightline',
        awardedInviteId: 'delec-brightline',
        sow: {
          status: 'sent',
          price: 56_900,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: null,
          sov: [
            { id: 'delec-1', label: 'Panels and feeders', amount: 14_200, pctReported: 0, pctBilled: 0 },
            { id: 'delec-2', label: 'Lighting', amount: 14_200, pctReported: 0, pctBilled: 0 },
            { id: 'delec-3', label: 'Devices', amount: 14_200, pctReported: 0, pctBilled: 0 },
            { id: 'delec-4', label: 'Low voltage rough', amount: 14_300, pctReported: 0, pctBilled: 0 },
          ],
          draws: [],
        },
      }),
      pkg('dhvac', 'HVAC', dHvac, 49_000, [
        invite('dhvac', 'kendall', 'bid', 0, bid(dHvac, 47_600, 0, '2026-08-22')),
      ], {
        carried: 'dhvac-kendall',
        awardedInviteId: 'dhvac-kendall',
        sow: {
          status: 'draft',
          price: 47_600,
          retainagePct: 10,
          basedOnRev: 0,
          signedOn: null,
          sov: [
            { id: 'dhvac-1', label: 'Split systems', amount: 15_800, pctReported: 0, pctBilled: 0 },
            { id: 'dhvac-2', label: 'Ductwork', amount: 15_800, pctReported: 0, pctBilled: 0 },
            { id: 'dhvac-3', label: 'Controls', amount: 16_000, pctReported: 0, pctBilled: 0 },
          ],
          draws: [],
        },
      }),
      pkg('dplumb', 'Plumbing', scope('dplumb', ['Underground', 'Rough in', 'Top out', 'Trim']), 38_500, [], {
        selfPerform: { ref: 'J 1042', value: 38_500, note: 'Our own crew. The job runs on the Pipeline.' },
        carried: 'self',
      }),
      pkg('mill', 'Millwork', mill, 41_000, [
        invite('mill', 'cedar', 'bid', 0, bid(mill, 39_800, 0, '2026-08-25')),
        invite('mill', 'sawtooth', 'bid', 0, bid(mill, 43_100, 0, '2026-08-26')),
      ], { carried: 'mill-cedar' }),
    ],
    generalConditions: 52_000,
    contingencyPct: 3,
    feePct: 10,
  }

  const padB: GcProject = {
    id: 'padb',
    name: 'Boerne Retail Pad B',
    address: '1436 River Rd, Boerne',
    town: 'Boerne',
    ourBidSentOn: null,
    ownerContractSignedOn: null,
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: 'cibolo',
    owner: 'Cibolo Creek Partners',
    ownerBilling: null,
    architectId: 'marshvale',
    architect: 'Marsh & Vale Architects',
    questions: [],
    stage: 'pursuing',
    bidDue: '2026-10-22',
    sizeNote: '4,200 sq ft drive-through pad building',
    sheets: [
      { id: 'G-001', title: 'Cover and code summary' },
      { id: 'C-101', title: 'Site plan' },
      { id: 'A-101', title: 'Floor plan' },
      { id: 'A-201', title: 'Exterior elevations' },
      { id: 'S-101', title: 'Foundation plan' },
      { id: 'M-101', title: 'Mechanical plan' },
      { id: 'E-101', title: 'Power and lighting plan' },
      { id: 'P-101', title: 'Plumbing plan' },
    ],
    planSets: [
      { rev: 0, label: 'Pricing set', issuedOn: '2026-10-01', note: 'Early drawings for a budget price. 8 sheets.', changedSheets: [], touches: [] },
    ],
    packages: [
      pkg('bsite', 'Sitework', scope('bsite', ['Clearing and grading', 'Utilities to 5 ft of the building', 'Paving']), 96_000, []),
      pkg('bconc', 'Concrete', scope('bconc', ['Foundations', 'Slab on grade', 'Drive-through lane']), 118_000, []),
      pkg('bplumb', 'Plumbing', scope('bplumb', ['Underground', 'Rough in', 'Top out', 'Trim']), 61_000, [], {
        selfPerform: { ref: 'BP 518', value: 61_000, note: 'Our own bid, priced in Trades mode.' },
        carried: 'self',
      }),
    ],
    generalConditions: 74_000,
    contingencyPct: 5,
    feePct: 8,
  }

  const customers: GcCustomer[] = [
    {
      id: 'cibolo',
      name: 'Cibolo Creek Partners',
      kind: 'Developer',
      contact: 'Elena Marchetti',
      contactRole: 'Development manager',
      phone: '(830) 555-0142',
      email: 'elena@cibolocreekpartners.example',
      address: '200 Main Plaza, Suite 300, Boerne',
      howTheyBuy: 'Invites three general contractors and takes the low qualified price.',
      payDays: 38,
      retainagePct: 10,
      portalOn: true,
      portalLastOpened: '2026-09-30',
      answerDays: null,
      contacts: [
        { on: '2026-09-29', by: 'Robert', note: 'Elena sent Addendum 1. She wants the price to hold for 60 days.' },
        { on: '2026-09-18', by: 'Robert', note: 'Walked the site. Pad B will follow about two weeks behind the shell.' },
      ],
      past: [
        { name: 'Fair Oaks Shops, Building C', year: 2025, outcome: 'built', value: 1_420_000, note: 'Finished nine days early.' },
        { name: 'Herff Road Medical Shell', year: 2025, outcome: 'lost', value: 2_180_000, note: 'Lost by 2.1% to another general contractor.' },
        { name: 'Fair Oaks Shops, Building A', year: 2024, outcome: 'built', value: 1_265_000, note: '' },
      ],
      tradesNote: 'We also bid plumbing on four of their buildings under other general contractors, and won one.',
    },
    {
      id: 'raman',
      name: 'Dr. Priya Raman',
      kind: 'Owner who will use the space',
      contact: 'Dr. Priya Raman',
      contactRole: 'Owner',
      phone: '(210) 555-0177',
      email: 'priya@helotesdental.example',
      address: '9811 Bandera Rd, Suite 140, Helotes',
      howTheyBuy: 'Came to us by referral. Negotiated price, no other bidders.',
      payDays: 21,
      retainagePct: 10,
      portalOn: false,
      portalLastOpened: null,
      answerDays: null,
      contacts: [
        { on: '2026-09-26', by: 'Robert', note: 'She asked to move the opening to December 1. Told her millwork is the long lead.' },
      ],
      past: [],
      tradesNote: null,
    },
    {
      id: 'marshvale',
      name: 'Marsh & Vale Architects',
      kind: 'Architect',
      contact: 'Jonah Vale',
      contactRole: 'Project architect',
      phone: '(210) 555-0119',
      email: 'jonah@marshvale.example',
      address: '410 Broadway, Suite 210, San Antonio',
      howTheyBuy: null,
      payDays: null,
      retainagePct: null,
      portalOn: false,
      portalLastOpened: null,
      answerDays: 2,
      contacts: [
        { on: '2026-09-29', by: 'Robert', note: 'Jonah issued Addendum 1. He expects one more addendum before bid day.' },
        { on: '2026-08-14', by: 'Wendi', note: 'Called about the water heater schedule on a plumbing bid. Jonah answered the same day.' },
      ],
      past: [],
      tradesNote: 'They drew three buildings we bid plumbing on, and Fair Oaks Shops A and C, which we built.',
    },
    {
      id: 'ocotillo',
      name: 'Studio Ocotillo',
      kind: 'Architect',
      contact: 'Camila Reyes',
      contactRole: 'Principal',
      phone: '(210) 555-0163',
      email: 'camila@studioocotillo.example',
      address: '88 Pearl Pkwy, San Antonio',
      howTheyBuy: null,
      payDays: null,
      retainagePct: null,
      portalOn: false,
      portalLastOpened: null,
      answerDays: 1,
      contacts: [],
      past: [],
      tradesNote: null,
    },
  ]

  const partner = (
    id: string,
    company: string,
    contact: string,
    trades: string[],
    msa: Partner['msa'],
    coiExpires: string | null,
    w9: boolean,
    record: [number, number, number],
  ): Partner => ({
    id,
    company,
    contact,
    trades,
    base: null,
    maxMiles: null,
    msa,
    msaSignedOn: msa === 'signed' ? '2026-06-12' : null,
    coiExpires,
    w9,
    invited: record[0],
    bids: record[1],
    won: record[2],
    promisesMade: 0,
    promisesKept: 0,
  })

  /** Where each company drives from, and how far they will go. */
  const coverage: Record<string, [string, number]> = {
    lonestar: ['San Antonio', 75],
    tricounty: ['New Braunfels', 100],
    hillside: ['Kerrville', 50],
    alamo: ['San Antonio', 100],
    guadalupe: ['Seguin', 75],
    bexar: ['San Antonio', 150],
    comal: ['New Braunfels', 50],
    ironhorse: ['Austin', 150],
    summit: ['San Antonio', 100],
    bluebonnet: ['Austin', 75],
    coolbreeze: ['San Antonio', 100],
    kendall: ['Boerne', 75],
    voltage: ['San Antonio', 120],
    brightline: ['San Marcos', 100],
    tejas: ['Laredo', 200],
    redline: ['San Antonio', 100],
    aquashield: ['Waco', 100],
    hillcountry: ['Boerne', 60],
    cedar: ['Fredericksburg', 80],
    sawtooth: ['San Antonio', 100],
  }

  /** Promises of a quote date on earlier jobs: made, kept. */
  const word: Record<string, [number, number]> = {
    hillside: [2, 0],
    bluebonnet: [2, 1],
    tejas: [1, 0],
    coolbreeze: [3, 3],
    kendall: [3, 3],
    brightline: [4, 4],
    voltage: [5, 4],
    lonestar: [3, 2],
    summit: [2, 2],
    bexar: [2, 1],
  }

  /** The story so far on a few live asks, so Follow up opens with something to chase. */
  const story: Record<string, AskContact[]> = {
    'site-hillside': [
      { on: '2026-09-26', by: 'Robert', how: 'call', note: 'Greg is busy on a subdivision. Says he will price it by Wednesday.', promisedBy: '2026-09-30' },
    ],
    'roof-bluebonnet': [
      { on: '2026-09-30', by: 'Robert', how: 'call', note: 'Wes has the plans open. He will have a number Monday.', promisedBy: '2026-10-05' },
      { on: '2026-09-24', by: 'Robert', how: 'email', note: 'Sent the roof plan and the spec section again.' },
    ],
    'elec-tejas': [
      { on: '2026-10-01', by: 'Wendi', how: 'text', note: 'Bill texted back: quote by end of day Friday.', promisedBy: '2026-10-02' },
    ],
    'hvac-coolbreeze': [
      { on: '2026-09-22', by: 'Robert', how: 'call', note: 'Andre will quote by Friday the 26th.', promisedBy: '2026-09-26' },
    ],
  }
  const withStory = (project: GcProject): GcProject => ({
    ...project,
    packages: project.packages.map((k) => ({
      ...k,
      invites: k.invites.map((i) => (story[i.id] ? { ...i, contacts: story[i.id] } : i)),
    })),
  })

  return {
    today: '2026-10-02',
    customers,
    projects: [withStory(boerne), padB, helotes],
    partners: [
      partner('lonestar', 'Lonestar Earthworks', 'Dale Whitfield', ['Sitework'], 'signed', '2027-03-01', true, [6, 5, 2]),
      partner('tricounty', 'Tri-County Site', 'Marisol Vega', ['Sitework'], 'signed', '2027-01-15', true, [4, 4, 1]),
      partner('hillside', 'Hillside Excavation', 'Greg Paulk', ['Sitework'], 'none', null, false, [2, 0, 0]),
      partner('alamo', 'Alamo Concrete', 'Hector Luna', ['Concrete'], 'signed', '2026-12-20', true, [7, 6, 3]),
      partner('guadalupe', 'Guadalupe Flatwork', 'Ines Barrera', ['Concrete'], 'signed', '2027-02-10', true, [3, 3, 0]),
      partner('bexar', 'Bexar Steel Erectors', 'Tom Riddle', ['Structural steel'], 'signed', '2027-04-30', true, [3, 1, 1]),
      partner('comal', 'Comal Iron', 'Ray Odom', ['Structural steel'], 'none', null, true, [2, 0, 0]),
      partner('ironhorse', 'Iron Horse Fabrication', 'Luz Carrasco', ['Structural steel'], 'signed', '2027-05-05', true, [1, 1, 0]),
      partner('summit', 'Summit Roofing', 'Carla Nguyen', ['Roofing'], 'signed', '2027-06-01', true, [5, 5, 2]),
      partner('bluebonnet', 'Bluebonnet Roofing', 'Wes Hartley', ['Roofing'], 'sent', '2026-11-30', true, [2, 1, 0]),
      partner('coolbreeze', 'Cool Breeze Mechanical', 'Andre Wallace', ['HVAC'], 'signed', '2027-01-31', true, [5, 4, 1]),
      partner('kendall', 'Kendall Air', 'Josie Tran', ['HVAC'], 'sent', '2027-02-28', true, [4, 4, 1]),
      partner('voltage', 'Voltage Brothers', 'Sam Okafor', ['Electrical'], 'signed', '2026-09-15', true, [8, 7, 2]),
      partner('brightline', 'Brightline Electric', 'Nora Castillo', ['Electrical'], 'signed', '2027-03-20', true, [6, 6, 3]),
      partner('tejas', 'Tejas Power', 'Bill Sorrell', ['Electrical'], 'none', null, false, [1, 0, 0]),
      partner('redline', 'Redline Fire Protection', 'Mina Shah', ['Fire sprinkler'], 'signed', '2027-02-01', true, [3, 3, 2]),
      partner('aquashield', 'AquaShield Sprinkler', 'Pete Doyle', ['Fire sprinkler'], 'none', null, false, [0, 0, 0]),
      partner('hillcountry', 'Hill Country Interiors', 'Rosa Medina', ['Framing and drywall'], 'signed', '2027-04-12', true, [4, 4, 3]),
      partner('cedar', 'Cedar & Pine Millwork', 'Owen Blake', ['Millwork'], 'none', '2027-01-08', true, [2, 2, 0]),
      partner('sawtooth', 'Sawtooth Cabinet Co', 'Jill Arnett', ['Millwork'], 'signed', '2027-03-03', true, [2, 2, 1]),
    ].map((p) => {
      const c = coverage[p.id]
      const w = word[p.id] ?? [0, 0]
      return { ...p, promisesMade: w[0], promisesKept: w[1], ...(c ? { base: c[0], maxMiles: c[1] } : {}) }
    }),
    log: [],
  }
}
