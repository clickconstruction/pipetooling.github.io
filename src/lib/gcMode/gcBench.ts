/**
 * GC mode — design spike. Trade partners: the bench by trade, and Actions for assistants.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Invite, Partner, TradePackage } from './gcTypes'
import { daysUntil, shortDate } from './gcWords'
import { partnerById } from './gcLookups'
import { BIDS_WANTED, bidTabsOpen, bidsIn, packageHasTab } from './gcBids'
import { travelFor } from './gcMap'
import { answerRecord } from './gcReliability'
import { OPEN_WITHIN_DAYS, followUps, packageIsOpen } from './gcFollowUp'

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

// answerRecord moved to gcReliability.ts (question 7: the map's list reads it, and gcMap cannot import this file).

export function partnerAsks(state: GcState, partnerId: string, trade: string): PartnerAsk[] {
  const out: PartnerAsk[] = []
  for (const project of state.projects) {
    // "Asked right now": a lost bid is over for them too.
    if (project.lostOn) continue
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
  /** The trade it is about, for the trade headings (the owner, 2026-10-04). Null: not one trade. */
  trade: string | null
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
      trade: b.trade,
    })),
  }

  const needs = benches.flatMap((b) => b.needs.map((need) => ({ bench: b, need })))
  const shortNeeds = needs.filter((n) => n.need.short > 0).sort((x, y) => (x.need.daysLeft ?? 999) - (y.need.daysLeft ?? 999) || x.need.bids - y.need.bids)
  const bids: AssistantRule = {
    key: 'bids',
    title: `${BIDS_WANTED} quotes on every trade we put out`,
    ideal: `Every trade out for quotes has ${BIDS_WANTED} quotes before the due date. One company going quiet should not leave us with one number.`,
    now: `${needs.length - shortNeeds.length} of ${plural(needs.length, 'open ask', 'open asks')} have ${BIDS_WANTED} quotes.`,
    ok: shortNeeds.length === 0,
    items: shortNeeds.map(({ bench: b, need }) => {
      const asked = new Set(need.pkg.invites.map((i) => i.partnerId))
      const notAsked = b.partners
        .filter((p) => !asked.has(p.id) && travelFor(state, p, need.project).inZone)
        .map((p) => p.id)
      const due = need.daysLeft === null ? '' : ` Due ${shortDate(need.project.bidDue)}, in ${plural(need.daysLeft, 'day', 'days')}.`
      return {
        id: `bids-${need.pkg.id}`,
        text: `${need.project.name}, ${b.trade}: ${need.bids} of ${BIDS_WANTED} quotes.${due}`,
        action:
          notAsked.length > 0
            ? { kind: 'ask', projectId: need.project.id, packageId: need.pkg.id, partnerIds: notAsked }
            : { kind: 'add', trade: b.trade },
        actionLabel: notAsked.length > 0 ? `Ask the ${notAsked.length} we have not asked` : 'Everyone in range is asked. Add a company',
        doneNote: null,
        trade: b.trade,
      }
    }),
  }

  const asks: { project: GcProject; pkg: TradePackage; invite: Invite; partner: Partner; waited: number }[] = []
  let liveAsks = 0
  const askedPartners = new Map<string, Partner>()
  // The first trade we ask each company on: its paperwork goes under that trade's heading.
  const askedTrade = new Map<string, string>()
  for (const { need } of needs) {
    for (const invite of need.pkg.invites) {
      const partner = partnerById(state, invite.partnerId)
      if (!partner || invite.status === 'declined') continue
      liveAsks += 1
      askedPartners.set(partner.id, partner)
      if (!askedTrade.has(partner.id)) askedTrade.set(partner.id, need.pkg.trade)
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
      trade: a.pkg.trade,
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
      trade: askedTrade.get(p.id) ?? p.trades[0] ?? null,
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
      trade: pkg.trade,
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
      trade: f.pkg.trade,
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

/** Each trade's to-dos across every standard, for the trade strip (the owner, 2026-10-04). */
export function tradeTodoCounts(rules: AssistantRule[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const rule of rules) for (const item of rule.items) if (item.trade) out.set(item.trade, (out.get(item.trade) ?? 0) + 1)
  return out
}

/** A standard's to-dos under one heading per trade, in the order the trades first come up; no trade last. */
export function itemsByTrade(items: AssistantItem[]): { trade: string | null; items: AssistantItem[] }[] {
  const groups: { trade: string | null; items: AssistantItem[] }[] = []
  for (const item of items) {
    const group = groups.find((g) => g.trade === item.trade)
    if (group) group.items.push(item)
    else groups.push({ trade: item.trade, items: [item] })
  }
  return [...groups.filter((g) => g.trade !== null), ...groups.filter((g) => g.trade === null)]
}
