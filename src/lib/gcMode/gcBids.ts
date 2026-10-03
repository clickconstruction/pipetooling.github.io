/**
 * GC mode — design spike. Bids: comparing quotes all in, what we carry, our price to the owner, bid tabs, statement-of-work money.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Invite, ScopeItem, Sow, TradePackage } from './gcTypes'
import { money, shortDate } from './gcWords'
import { ownBidPriced, partnerById } from './gcLookups'

/** The bid plus the office's plug for every scope item it does not clearly include. */
export function leveledTotal(pkg: TradePackage, invite: Invite): number | null {
  const bid = invite.bid
  if (!bid) return null
  const plugs = pkg.scope.reduce((sum, item) => {
    return bid.includes[item.id] === 'yes' ? sum : sum + (bid.plugs[item.id] ?? 0)
  }, 0)
  return bid.amount + plugs
}

/**
 * The work a quote does not clearly include and has no cost set for. While any is left, the
 * quote's all-in number is not known: `leveledTotal` counts it as $0, so every screen that shows
 * that total marks it "+ ?". The same rule as `compareBids` ("No cost is set for … yet").
 */
export function uncostedLines(pkg: TradePackage, invite: Invite): ScopeItem[] {
  const bid = invite.bid
  if (!bid) return []
  return pkg.scope.filter((item) => bid.includes[item.id] !== 'yes' && !((bid.plugs[item.id] ?? 0) > 0))
}

/**
 * The work with no cost in the quote we carry (or awarded) on a trade. Empty for our own bid, our
 * budget, a statement of work (its price is the contract) and a trade with nothing carried.
 */
export function carriedUncosted(pkg: TradePackage): ScopeItem[] {
  if (pkg.selfPerform || pkg.sow || pkg.carried === 'plug') return []
  const invite = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
  return invite ? uncostedLines(pkg, invite) : []
}

/** The trades whose carried quote is missing a cost: our price to the owner is not known while any is. */
export function proposalUncosted(project: GcProject): TradePackage[] {
  return project.packages.filter((pkg) => carriedUncosted(pkg).length > 0)
}

/** Our price's gap named trade by trade: "In Roofing, 1 line has no cost yet: roof curbs." */
export function proposalUncostedWords(project: GcProject): string {
  return proposalUncosted(project)
    .map((pkg) => `In ${pkg.trade}, ${uncostedWords(carriedUncosted(pkg))}`)
    .join(' ')
}

/** "1 line has no cost yet: roof curbs." Said beside a "+ ?" so the number's gap is named. */
export function uncostedWords(items: ScopeItem[]): string {
  if (items.length === 0) return ''
  const names = listWords(items.map((i) => i.label.toLowerCase()))
  return items.length === 1 ? `1 line has no cost yet: ${names}.` : `${items.length} lines have no cost yet: ${names}.`
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

/** 'self-unpriced': our own Trades mode bid is started but not priced yet (`ownBidPriced`). */
export type Coverage = 'self' | 'self-unpriced' | 'awarded' | 'carried' | 'plug' | 'bids' | 'waiting' | 'empty'

export function packageCoverage(pkg: TradePackage): Coverage {
  if (pkg.selfPerform) return ownBidPriced(pkg) ? 'self' : 'self-unpriced'
  if (pkg.awardedInviteId) return 'awarded'
  if (pkg.carried === 'plug') return 'plug'
  if (pkg.carried) return 'carried'
  if (bidsIn(pkg).length > 0) return 'bids'
  if (pkg.invites.some((i) => i.status !== 'declined')) return 'waiting'
  return 'empty'
}

/** The trade's number in our price is our own budget, not anyone's quote. */
export function isGuess(pkg: TradePackage): boolean {
  return !pkg.selfPerform && !pkg.awardedInviteId && !pkg.sow && pkg.carried === 'plug'
}

export function carriedAmount(pkg: TradePackage): number | null {
  // Our own bid counts once it is priced (the owner, 2026-10-02): until then its value is our guess, a hole.
  if (pkg.selfPerform) return ownBidPriced(pkg) ? pkg.selfPerform.value : null
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

/** The least quotes we want on a trade, from different companies, before we trust the number. */
export const BIDS_WANTED = 2
