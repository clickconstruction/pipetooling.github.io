/**
 * Pipeline money-card view models (money story strip + Today's money moves).
 *
 * Pure builders over the lean StagesHeaderStats spine (v2.1821) plus the AR
 * unallocated count — every figure shown already exists in the header stats,
 * so the money card costs no extra fetches. The component stays thin: it renders
 * whatever these return and wires each card/move key to an existing surface.
 */
import { formatUsdNoCents } from './jobFormatting'
import type { StagesHeaderStats } from './stagesHeaderStats'

export type PipelineStoryCardKey = 'ready-to-ask' | 'waiting-on-customers' | 'in-collections' | 'collected'

export type PipelineStoryCard = {
  key: PipelineStoryCardKey
  label: string
  value: string
  sub: string
  tone: 'green' | 'red-edge' | 'plain'
  /** waiting-on-customers only: dollar weights for the age bar segments. */
  ageBar?: { fresh: number; mid: number; old: number }
  ageBarLabels?: { left: string; right: string }
  /** collected only: daily totals oldest→newest for the sparkline. */
  spark?: number[]
}

export function buildPipelineMoneyStory(
  stats: StagesHeaderStats,
  opts: { includeCollected?: boolean } = {},
): PipelineStoryCard[] {
  // Collected is wage-adjacent cash flow — owner call (v2.1916): devs and
  // master technicians only; everyone else gets the three billing cards.
  const includeCollected = opts.includeCollected ?? true
  const readyToAsk = stats.capableToBill + stats.readyToBill.total
  const { billed, billedAging: aging, collections } = stats
  const oldSum = aging.sum90
  const midSum = aging.sum30_90
  const freshSum = Math.max(0, billed.total - oldSum - midSum)
  const collectedTotal = stats.collectedByDay.reduce((s, d) => s + d.total, 0)
  const cards: PipelineStoryCard[] = [
    {
      key: 'ready-to-ask',
      label: 'ready to ask for',
      value: formatUsdNoCents(readyToAsk),
      sub: `${formatUsdNoCents(stats.capableToBill)} capable in Working · ${formatUsdNoCents(stats.readyToBill.total)} in Ready to Bill`,
      tone: 'green',
    },
    {
      key: 'waiting-on-customers',
      label: 'waiting on customers',
      value: formatUsdNoCents(billed.total),
      sub: `${billed.count} bill${billed.count === 1 ? '' : 's'} in Billed Awaiting Payment`,
      tone: aging.count90 > 0 ? 'red-edge' : 'plain',
      ageBar: { fresh: freshSum, mid: midSum, old: oldSum },
      ageBarLabels: {
        left: `under 30d ${formatUsdNoCents(freshSum)}`,
        right: `90+ ${formatUsdNoCents(oldSum)} · ${aging.count90} bill${aging.count90 === 1 ? '' : 's'}`,
      },
    },
    {
      key: 'in-collections',
      label: 'in collections',
      value: formatUsdNoCents(collections.total),
      sub: `${collections.count} job${collections.count === 1 ? '' : 's'}`,
      tone: 'plain',
    },
    {
      key: 'collected',
      label: `collected · last ${stats.collectedByDay.length} days`,
      value: formatUsdNoCents(collectedTotal),
      sub: 'payments recorded, all stages',
      tone: 'plain',
      spark: stats.collectedByDay.map((d) => d.total),
    },
  ]
  return includeCollected ? cards : cards.filter((c) => c.key !== 'collected')
}

export type PipelineMoveKey = 'bill-capable' | 'chase-90' | 'allocate-deposits' | 'fix-dates'

export type PipelineMove = {
  key: PipelineMoveKey
  icon: string
  claim: string
  why: string
  actionLabel: string
  /** Quiet standing card (v2.1977): nothing to act on, but the door stays open (AR's zero-deposit state). */
  idle?: boolean
  /** Amber count bubble beside the claim (matches the section-header AR badge). */
  badgeCount?: number
}

export function buildPipelineMoneyMoves(input: {
  stats: StagesHeaderStats
  arUnallocatedCount: number | null
  canOpenAr: boolean
}): PipelineMove[] {
  const { stats, arUnallocatedCount, canOpenAr } = input
  const moves: PipelineMove[] = []
  if (stats.capableToBill > 0) {
    moves.push({
      key: 'bill-capable',
      icon: '🧾',
      claim: `Bill the finished work — ${formatUsdNoCents(stats.capableToBill)}`,
      why: 'Working jobs are past their billable progress',
      actionLabel: 'Capable list',
    })
  }
  if (stats.billedAging.count90 > 0) {
    moves.push({
      key: 'chase-90',
      icon: '⏰',
      claim: `Chase the 90+ tail — ${formatUsdNoCents(stats.billedAging.sum90)}`,
      why: `${stats.billedAging.count90} bill${stats.billedAging.count90 === 1 ? '' : 's'} waiting 90+ days`,
      actionLabel: 'Show 90+',
    })
  }
  // Accounts Receivable is a STANDING card for AR roles (v2.1977): busy state
  // is the classic "Allocate N deposits" move with the header badge's amber
  // count; zero deposits goes quiet but keeps the door open — AR is the
  // daily payments surface, not just an alarm.
  if (canOpenAr) {
    const n = arUnallocatedCount ?? 0
    if (n > 0) {
      moves.push({
        key: 'allocate-deposits',
        icon: '💵',
        claim: `Allocate ${n} bank deposit${n === 1 ? '' : 's'}`,
        why: 'money already received, not yet applied to bills',
        actionLabel: 'Accounts Receivable',
        badgeCount: n,
      })
    } else {
      moves.push({
        key: 'allocate-deposits',
        icon: '💵',
        claim: 'Accounts Receivable',
        why: 'every deposit is applied — open to review payments and allocations',
        actionLabel: 'Open',
        idle: true,
      })
    }
  }
  if (stats.billedNoDate > 0) {
    moves.push({
      key: 'fix-dates',
      icon: '🩹',
      claim: `${stats.billedNoDate} billed job${stats.billedNoDate === 1 ? ' has' : 's have'} no bill line`,
      why: "their money can't age, be chased, or be forecast — each needs its bill line created",
      actionLabel: 'Show them',
    })
  }
  return moves
}

export type PipelineFixupKey = 'no-customer' | 'no-pictures' | 'no-email'

export type PipelineFixup = {
  key: PipelineFixupKey
  label: string
  tone: 'red' | 'amber'
  title: string
}

/**
 * Data-gap chips docked at the foot of Today's Money Opportunities (v2.1961):
 * the toolbar alert buttons ("No customer" / "No customer pictures" /
 * "No email"), rebuilt as quiet pills inside the money card (the toolbar
 * strip itself retired with the Old view, v2.2012).
 * Zero-count chips are dropped; an empty list hides the whole strip.
 */
export function buildPipelineFixups(counts: {
  noCustomer: number
  noPictures: number
  noEmail: number
}): PipelineFixup[] {
  const out: PipelineFixup[] = []
  if (counts.noCustomer > 0) {
    out.push({
      key: 'no-customer',
      label: `No customer · ${counts.noCustomer}`,
      tone: 'red',
      title: 'Jobs missing a linked customer — they cannot be billed at all. Click to list them.',
    })
  }
  if (counts.noPictures > 0) {
    out.push({
      key: 'no-pictures',
      label: `No customer pictures · ${counts.noPictures}`,
      tone: 'red',
      title: 'Working jobs missing their Customer Pictures link. Click to list them.',
    })
  }
  if (counts.noEmail > 0) {
    out.push({
      key: 'no-email',
      label: `No email · ${counts.noEmail}`,
      tone: 'amber',
      title: 'Ready to Bill jobs with no customer email — Stripe and emailed invoices need one. Click to list them.',
    })
  }
  return out
}
