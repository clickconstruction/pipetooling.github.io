import { describe, expect, it } from 'vitest'
import {
  CREW_PNL_BILLED_LABEL,
  CREW_PNL_BILLED_TOOLTIP,
  JOB_DETAIL_MARGIN_FOOTNOTE,
  PROFIT_FIGURE_LABELS,
  chartCashLegendLabel,
  chartCashTooltipLabel,
  profitFigureLabel,
  type ProfitFigureKind,
} from './profitLabels'

const KINDS: ProfitFigureKind[] = ['gross', 'trueProfit', 'jobDetailMargin', 'chartCash']

describe('profit figure labels — every number says what it excludes', () => {
  it('keeps the names the Job Summary already uses for Gross and True profit (no fourth name)', () => {
    expect(profitFigureLabel('gross').label).toBe('Gross')
    expect(profitFigureLabel('trueProfit').label).toBe('True profit')
  })
  it('labels the Job Detail band as margin before team labor and the chart as cash position', () => {
    expect(profitFigureLabel('jobDetailMargin').label).toBe('Margin before team labor')
    expect(profitFigureLabel('chartCash').label).toBe('Cash position')
  })
  it('every tooltip names what is left out or how it is computed', () => {
    expect(PROFIT_FIGURE_LABELS.gross.tooltip).toMatch(/before overhead/i)
    expect(PROFIT_FIGURE_LABELS.trueProfit.tooltip).toMatch(/overhead/i)
    expect(PROFIT_FIGURE_LABELS.jobDetailMargin.tooltip).toMatch(/team wages and overhead are not taken out/i)
    expect(PROFIT_FIGURE_LABELS.chartCash.tooltip).toMatch(/payments received − charges/i)
    for (const k of KINDS) expect(PROFIT_FIGURE_LABELS[k].tooltip.length).toBeGreaterThan(20)
  })
  it('no two figures share a label', () => {
    const labels = KINDS.map((k) => PROFIT_FIGURE_LABELS[k].label)
    expect(new Set(labels).size).toBe(labels.length)
  })
  it('the Job Detail footnote spells out the formula and the exclusions', () => {
    expect(JOB_DETAIL_MARGIN_FOOTNOTE).toMatch(/Total Bill − parts − sub labor/)
    expect(JOB_DETAIL_MARGIN_FOOTNOTE).toMatch(/team wages and overhead/i)
  })
})

describe('charges timeline green-line label', () => {
  it('reads as cash position for a viewer whose chart includes team labor', () => {
    expect(chartCashLegendLabel(true)).toBe('cash position (paid − charges)')
    expect(chartCashTooltipLabel(true)).toBe('Cash position')
  })
  it('says "before team labor" when wages are stripped (assistant view, J6-5)', () => {
    expect(chartCashLegendLabel(false)).toMatch(/^cash position before team labor/)
    expect(chartCashLegendLabel(false)).toMatch(/wages not included/)
    expect(chartCashTooltipLabel(false)).toBe('Cash position before team labor')
  })
})

describe('Crew P&L billing column', () => {
  it('is labeled as the gross bill, with the exclusions in the tooltip (J8-F4)', () => {
    expect(CREW_PNL_BILLED_LABEL).toBe('Billed (gross)')
    expect(CREW_PNL_BILLED_TOOLTIP).toMatch(/not cash collected/)
    expect(CREW_PNL_BILLED_TOOLTIP).toMatch(/not revenue before overhead/)
  })
})
