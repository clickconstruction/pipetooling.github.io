import { describe, expect, it } from 'vitest'
import { buildLaborSubSheetHtml, buildAllLaborSubSheetsHtml, type LaborSubSheetRow } from './laborSubSheet'

const rows: LaborSubSheetRow[] = [
  { fixture: 'Toilet', count: 2, is_fixed: false, rough_in_hrs_per_unit: 1.5, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 0.5 },
  // Fixed row: per-row cell uses count x hrs, but the stage TOTAL uses hrs only.
  { fixture: "Men's Room", count: 5, is_fixed: true, rough_in_hrs_per_unit: 2, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0 },
]

describe('buildLaborSubSheetHtml', () => {
  it('renders the stage title and table headers', () => {
    const html = buildLaborSubSheetHtml({ bidName: 'Acme Tower', stageLabel: 'Rough In', stage: 'rough_in', rows, rate: 100 })
    expect(html).toContain('Acme Tower — Rough In Labor Sub Sheet')
    expect(html).toContain('<th>Fixture or Tie-in</th>')
  })

  it('computes per-row cost as rate x hours x count (ignoring is_fixed)', () => {
    const html = buildLaborSubSheetHtml({ bidName: 'Acme', stageLabel: 'Rough In', stage: 'rough_in', rows, rate: 100 })
    expect(html).toContain('$300.00') // Toilet: 100 * 1.5 * 2
    expect(html).toContain('$1,000.00') // Men's Room per-row: 100 * 2 * 5
  })

  it('computes the stage total with is_fixed-aware hours (fixed row contributes hours only)', () => {
    const html = buildLaborSubSheetHtml({ bidName: 'Acme', stageLabel: 'Rough In', stage: 'rough_in', rows, rate: 100 })
    // total = 100*(2*1.5) + 100*(2) = 300 + 200 = 500 (NOT 1300)
    expect(html).toContain('Total:</td><td style="text-align:right">$500.00</td>')
  })

  it('escapes apostrophes in fixture names via the shared escapeHtml', () => {
    const html = buildLaborSubSheetHtml({ bidName: 'Acme', stageLabel: 'Rough In', stage: 'rough_in', rows, rate: 100 })
    expect(html).toContain('Men&#39;s Room')
  })

  it('falls back to "Bid" and renders an empty-state row', () => {
    const html = buildLaborSubSheetHtml({ bidName: '', stageLabel: 'Top Out', stage: 'top_out', rows: [], rate: 100 })
    expect(html).toContain('Bid — Top Out Labor Sub Sheet')
    expect(html).toContain('No labor rows')
    expect(html).toContain('$0.00')
  })
})

describe('buildAllLaborSubSheetsHtml', () => {
  it('renders all three stage sections under one title', () => {
    const html = buildAllLaborSubSheetsHtml({ bidName: 'Acme Tower', rows, rate: 100 })
    expect(html).toContain('Acme Tower — Labor Sub Sheets')
    expect(html).toContain('<h2>Rough In</h2>')
    expect(html).toContain('<h2>Top Out</h2>')
    expect(html).toContain('<h2>Trim Set</h2>')
  })

  it('applies the same is_fixed total rule per stage', () => {
    const html = buildAllLaborSubSheetsHtml({ bidName: 'Acme', rows, rate: 100 })
    // Rough In total = 500 (as above); Top Out total = 100*(2*1) + 100*0 = 200
    expect(html).toContain('$500.00')
    expect(html).toContain('$200.00')
  })
})
