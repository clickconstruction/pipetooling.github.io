/**
 * The profit words, in one place (v2.2852, journey-map Tier-1 #5c). A job carries four
 * profit-shaped numbers on four surfaces, each with its own definition:
 *
 *   Job Summary row    Gross        = revenue − team labor − subs − parts      (before overhead)
 *   Job Summary row    True profit  = gross − the job's overhead share         (the bottom line)
 *   Job Detail band    "Profit"     = Total Bill − parts − sub labor           (before team labor AND overhead)
 *   Charges timeline   green line   = payments received − charges to date     (cash, not margin)
 *
 * Nothing here changes the math — it labels each figure with what it leaves out, using the
 * names the code already had for Gross / True profit (v2.2692) rather than minting new ones.
 * Pure — no React/supabase.
 */

export type ProfitFigureKind = 'gross' | 'trueProfit' | 'jobDetailMargin' | 'chartCash'

export type ProfitFigureLabel = {
  /** Column header / cell label. */
  label: string
  /** Hover text: the formula and what is not taken out. */
  tooltip: string
}

export const PROFIT_FIGURE_LABELS: Readonly<Record<ProfitFigureKind, ProfitFigureLabel>> = {
  gross: {
    label: 'Gross',
    tooltip: 'Gross profit: revenue − team labor − subs − parts. Before overhead.',
  },
  trueProfit: {
    label: 'True profit',
    tooltip: "True profit: gross − the job's overhead share. The bottom line.",
  },
  jobDetailMargin: {
    label: 'Margin before team labor',
    tooltip: 'Total Bill − parts − sub labor. Team wages and overhead are not taken out — see Job Summary for gross and true profit.',
  },
  chartCash: {
    label: 'Cash position',
    tooltip: 'Payments received − charges to date. Money in hand on the job so far, not a margin.',
  },
}

export function profitFigureLabel(kind: ProfitFigureKind): ProfitFigureLabel {
  return PROFIT_FIGURE_LABELS[kind]
}

/** The Job Detail profit band's one-line footnote. */
export const JOB_DETAIL_MARGIN_FOOTNOTE =
  'Margin before team labor = Total Bill − parts − sub labor. Team wages and overhead are not taken out; Job Summary carries gross and true profit.'

/**
 * The charges-timeline legend word for the green line. When the viewer's chart leaves team
 * labor out (wage-privacy gate — assistants), the label says so, because the same job reads
 * +$35.7k to an assistant and +$1.6k to the owner (J6-5).
 */
export function chartCashLegendLabel(teamLaborIncluded: boolean): string {
  return teamLaborIncluded ? 'cash position (paid − charges)' : 'cash position before team labor (paid − charges, wages not included)'
}

/** Tooltip row label for the green line's value. */
export function chartCashTooltipLabel(teamLaborIncluded: boolean): string {
  return teamLaborIncluded ? 'Cash position' : 'Cash position before team labor'
}

/** Crew P&L "Billing" column: it splits the job's gross total bill by hours — not cash, not revenue before overhead. */
export const CREW_PNL_BILLED_LABEL = 'Billed (gross)'
export const CREW_PNL_BILLED_TOOLTIP =
  "The job's gross total bill, credited by hours worked — not cash collected and not revenue before overhead."
