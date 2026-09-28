import { describe, expect, it } from 'vitest'
import { buildJobCostsSummaryCard } from './jobCostsSummaryCard'
import { buildJobTeamLaborRow } from './jobTeamLaborRow'

const profit = { laborCost: 1408.97, partsCost: 46376.21, totalBill: 249715.66, profit: 201930.48 }

describe('buildJobCostsSummaryCard', () => {
  it('gives a wage-gated viewer four lines in order: team, sub, parts, margin', () => {
    const team = buildJobTeamLaborRow([{ personName: 'Malachi', hours: 8, cost: 461.84, byWorkDate: [] }], 2)
    const card = buildJobCostsSummaryCard({
      partsTotal: 46376.21,
      partsFailed: false,
      wageGated: { teamLabor: team, teamLaborLoading: false, teamLaborFailed: false, profit, profitLoading: false, profitFailed: false },
    })
    expect(card.loading).toBe(false)
    expect(card.lines.map((l) => l.key)).toEqual(['team', 'sub', 'parts', 'margin'])
    expect(card.lines[0]).toMatchObject({ value: '$461.84', caption: '8.0 h · Malachi · includes 2.0 h awaiting approval' })
    expect(card.lines[1]).toMatchObject({ value: '$1,408.97' })
    expect(card.lines[2]).toMatchObject({ value: '$46,376.21' })
    expect(card.lines[3]).toMatchObject({ label: 'Margin before team labor', value: '$201,930.48', tone: 'positive', emphasis: 'margin' })
  })

  it('gives everyone else just the Parts line', () => {
    const card = buildJobCostsSummaryCard({ partsTotal: 530.12, partsFailed: false, wageGated: null })
    expect(card.lines.map((l) => l.key)).toEqual(['parts'])
    expect(card.lines[0]!.value).toBe('$530.12')
  })

  it('shows — while loading and after a failure, and reports loading', () => {
    const loading = buildJobCostsSummaryCard({
      partsTotal: null,
      partsFailed: false,
      wageGated: { teamLabor: null, teamLaborLoading: true, teamLaborFailed: false, profit: null, profitLoading: true, profitFailed: false },
    })
    expect(loading.loading).toBe(true)
    expect(loading.lines.every((l) => l.value === '—')).toBe(true)
    const failed = buildJobCostsSummaryCard({
      partsTotal: null,
      partsFailed: true,
      wageGated: { teamLabor: null, teamLaborLoading: false, teamLaborFailed: true, profit: null, profitLoading: false, profitFailed: true },
    })
    expect(failed.loading).toBe(false)
    expect(failed.lines.every((l) => l.value === '—')).toBe(true)
  })

  it('colors a negative margin red', () => {
    const card = buildJobCostsSummaryCard({
      partsTotal: 900,
      partsFailed: false,
      wageGated: { teamLabor: null, teamLaborLoading: false, teamLaborFailed: false, profit: { ...profit, profit: -12.5 }, profitLoading: false, profitFailed: false },
    })
    expect(card.lines.find((l) => l.key === 'margin')).toMatchObject({ value: '-$12.50', tone: 'negative' })
  })

  it('draws fuel as its own line after Parts, taken out of Parts — the margin does not move', () => {
    const fuel = { tagId: 'fuel', name: 'Fuel & gas', icon: '⛽', usd: 1_200 }
    const card = buildJobCostsSummaryCard({
      partsTotal: 46376.21,
      partsFailed: false,
      cardCostLines: [fuel],
      wageGated: { teamLabor: null, teamLaborLoading: false, teamLaborFailed: false, profit, profitLoading: false, profitFailed: false },
    })
    expect(card.lines.map((l) => l.key)).toEqual(['team', 'sub', 'parts', 'tag:fuel', 'margin'])
    expect(card.lines[2]).toMatchObject({ value: '$45,176.21', caption: 'supply house · card · tally · other charges — fuel & gas below' })
    expect(card.lines[3]).toMatchObject({ label: '⛽ Fuel & gas', value: '$1,200.00', caption: 'card charges on this job' })
    expect(card.lines[4]).toMatchObject({ value: '$201,930.48' })
  })

  it('shows the fuel line to a viewer who sees only Parts, and none while Parts loads or failed', () => {
    const fuel = { tagId: 'fuel', name: 'Fuel & gas', icon: '⛽', usd: 30 }
    expect(buildJobCostsSummaryCard({ partsTotal: 530.12, partsFailed: false, cardCostLines: [fuel], wageGated: null }).lines.map((l) => l.key)).toEqual(['parts', 'tag:fuel'])
    expect(buildJobCostsSummaryCard({ partsTotal: null, partsFailed: false, cardCostLines: [fuel], wageGated: null }).lines.map((l) => l.key)).toEqual(['parts'])
    expect(buildJobCostsSummaryCard({ partsTotal: 530.12, partsFailed: true, cardCostLines: [fuel], wageGated: null }).lines.map((l) => l.key)).toEqual(['parts'])
  })
})
