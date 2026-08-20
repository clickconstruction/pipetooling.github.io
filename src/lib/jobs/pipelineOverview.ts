/**
 * Pipeline "New" view models (money story strip + Today's money moves).
 *
 * Pure builders over the lean StagesHeaderStats spine (v2.1821) plus the AR
 * unallocated count — every figure shown already exists in the header stats,
 * so the New view costs no extra fetches. The component stays thin: it renders
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
  /** collected only: weekly totals oldest→newest for the sparkline. */
  spark?: number[]
}

export function buildPipelineMoneyStory(stats: StagesHeaderStats): PipelineStoryCard[] {
  const readyToAsk = stats.capableToBill + stats.readyToBill.total
  const { billed, billedAging: aging, collections } = stats
  const oldSum = aging.sum90
  const midSum = aging.sum30_90
  const freshSum = Math.max(0, billed.total - oldSum - midSum)
  const collectedTotal = stats.collectedByWeek.reduce((s, w) => s + w.total, 0)
  return [
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
      label: `collected · last ${stats.collectedByWeek.length} wks`,
      value: formatUsdNoCents(collectedTotal),
      sub: 'payments recorded, all stages',
      tone: 'plain',
      spark: stats.collectedByWeek.map((w) => w.total),
    },
  ]
}

export type PipelineMoveKey = 'bill-capable' | 'chase-90' | 'allocate-deposits' | 'fix-dates'

export type PipelineMove = {
  key: PipelineMoveKey
  icon: string
  claim: string
  why: string
  actionLabel: string
}

export type PipelineMoneyMoves = {
  moves: PipelineMove[]
  /** Σ of the dollar figures named in the moves (capable + 90+ tail). */
  movesTotal: number
}

export function buildPipelineMoneyMoves(input: {
  stats: StagesHeaderStats
  arUnallocatedCount: number | null
  canOpenAr: boolean
}): PipelineMoneyMoves {
  const { stats, arUnallocatedCount, canOpenAr } = input
  const moves: PipelineMove[] = []
  let movesTotal = 0
  if (stats.capableToBill > 0) {
    movesTotal += stats.capableToBill
    moves.push({
      key: 'bill-capable',
      icon: '🧾',
      claim: `Bill the finished work — ${formatUsdNoCents(stats.capableToBill)}`,
      why: 'Working jobs are past their billable progress',
      actionLabel: 'Capable list',
    })
  }
  if (stats.billedAging.count90 > 0) {
    movesTotal += stats.billedAging.sum90
    moves.push({
      key: 'chase-90',
      icon: '⏰',
      claim: `Chase the 90+ tail — ${formatUsdNoCents(stats.billedAging.sum90)}`,
      why: `${stats.billedAging.count90} bill${stats.billedAging.count90 === 1 ? '' : 's'} waiting 90+ days`,
      actionLabel: 'Show 90+',
    })
  }
  if (canOpenAr && (arUnallocatedCount ?? 0) > 0) {
    const n = arUnallocatedCount ?? 0
    moves.push({
      key: 'allocate-deposits',
      icon: '💵',
      claim: `Allocate ${n} bank deposit${n === 1 ? '' : 's'}`,
      why: 'money already received, not yet applied to bills',
      actionLabel: 'Accounts Receivable',
    })
  }
  if (stats.billedNoDate > 0) {
    moves.push({
      key: 'fix-dates',
      icon: '🩹',
      claim: `${stats.billedNoDate} bill${stats.billedNoDate === 1 ? '' : 's'} ha${stats.billedNoDate === 1 ? 's' : 've'} no bill date`,
      why: "they can't age or be chased — set a date on each",
      actionLabel: 'Open Billed',
    })
  }
  return { moves, movesTotal }
}
