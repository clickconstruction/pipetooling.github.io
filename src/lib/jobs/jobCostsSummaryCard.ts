import type { JobProfitSummary } from './jobProfitSummary'
import type { JobTeamLaborRowModel } from './jobTeamLaborRow'
import { PROFIT_FIGURE_LABELS } from './profitLabels'

/**
 * The compact Costs card on the Job window's Job tab (owner call, 2026-09-08):
 * one line each for Team labor, Sub labor, Parts, and the margin, each a tap
 * away from the Costs tab where the detail lives. Replaces the Parts Cost
 * accordions + Cost Timeline + Profit band the Job tab used to duplicate
 * from Bill.
 *
 * Role shape (unchanged gates, just one card):
 *   - parts (all four buckets) — anyone who sees the materials cost section
 *   - sub labor, team labor, margin — dev / master / controller
 * A wage-gated viewer sees a two-line card: Parts, and nothing else.
 */

export type JobCostsSummaryLine = {
  /** `tag:<id>` is a cost-line slice of the card charges drawn under Parts (⛽ Fuel & gas, punch list #52). */
  key: 'team' | 'sub' | 'parts' | 'margin' | `tag:${string}`
  label: string
  /** Formatted dollars, or '—' while loading / after a failed fetch. */
  value: string
  /** Quiet caption under the label ("8.0 h · Malachi", "includes 2 h awaiting approval"). */
  caption: string | null
  /** Hover text (the margin's formula). */
  title?: string
  emphasis?: 'margin'
  /** Green when positive, red when negative — margin only. */
  tone?: 'positive' | 'negative' | null
}

export type JobCostsSummaryCardModel = {
  lines: JobCostsSummaryLine[]
  /** True while anything the card shows is still loading. */
  loading: boolean
}

function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

export function buildJobCostsSummaryCard(args: {
  /** Parts total (supply + card + tally + other); null while loading; `failed` shows '—'. */
  partsTotal: number | null
  partsFailed: boolean
  /** Cost-line slices of the card charges inside `partsTotal` — each its own line after Parts, taken out of it. */
  cardCostLines?: ReadonlyArray<{ tagId: string; name: string; icon: string; usd: number }>
  /** Wage-gated block; `null` = the viewer may not see it → lines omitted. */
  wageGated: {
    teamLabor: JobTeamLaborRowModel | null
    teamLaborLoading: boolean
    teamLaborFailed: boolean
    profit: JobProfitSummary | null
    profitLoading: boolean
    profitFailed: boolean
  } | null
}): JobCostsSummaryCardModel {
  const lines: JobCostsSummaryLine[] = []
  let loading = args.partsTotal === null && !args.partsFailed

  if (args.wageGated) {
    const g = args.wageGated
    loading = loading || g.teamLaborLoading || g.profitLoading
    const team = g.teamLabor
    lines.push({
      key: 'team',
      label: 'Team labor',
      value: g.teamLaborFailed ? '—' : team ? usd(team.totalCost) : '—',
      caption: team ? [team.summaryLabel, team.pendingLabel].filter(Boolean).join(' · ') : null,
    })
    lines.push({
      key: 'sub',
      label: 'Sub labor',
      value: g.profitFailed ? '—' : g.profit ? usd(g.profit.laborCost) : '—',
      caption: null,
    })
  }

  const slices = args.partsFailed || args.partsTotal === null ? [] : (args.cardCostLines ?? []).filter((l) => Number.isFinite(l.usd) && l.usd > 0)
  const slicedUsd = slices.reduce((s, l) => s + l.usd, 0)
  lines.push({
    key: 'parts',
    label: 'Parts',
    value: args.partsFailed ? '—' : args.partsTotal !== null ? usd(args.partsTotal - slicedUsd) : '—',
    caption:
      slices.length > 0
        ? `supply house · card · tally · other charges — ${slices.map((l) => l.name.toLowerCase()).join(', ')} below`
        : 'supply house · card · tally · other charges',
  })
  for (const l of slices) {
    lines.push({ key: `tag:${l.tagId}`, label: `${l.icon} ${l.name}`, value: usd(l.usd), caption: 'card charges on this job' })
  }

  if (args.wageGated) {
    const g = args.wageGated
    const p = g.profit
    lines.push({
      key: 'margin',
      label: PROFIT_FIGURE_LABELS.jobDetailMargin.label,
      title: PROFIT_FIGURE_LABELS.jobDetailMargin.tooltip,
      value: g.profitFailed ? '—' : p ? usd(p.profit) : '—',
      caption: p ? `Total Bill ${usd(p.totalBill)} − parts − sub labor` : null,
      emphasis: 'margin',
      tone: p ? (p.profit >= 0 ? 'positive' : 'negative') : null,
    })
  }

  return { lines, loading }
}
