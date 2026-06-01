import { describe, expect, it } from 'vitest'
import {
  buildExactLaborPageHtml,
  buildRoughLaborPageHtml,
  type ExactLaborPageInput,
  type LaborPageCosts,
  type RoughLaborPageInput,
} from './laborPage'

const baseCosts: LaborPageCosts = {
  totalMaterials: 206.71,
  taxPercent: 8.25,
  rate: 75,
  totalHours: 12.5,
  laborCost: 937.5,
  distance: 39,
  ratePerMile: 0.7,
  numTrips: 12.3,
  drivingCost: 334.42,
  estimatorCost: 9000,
  travelCost: 250,
  laborCostWithDriving: 10521.92,
  grandTotal: 10728.63,
}

const rows = [
  { fixture: 'Toilet', count: 3, roughPerUnit: 1.5, topPerUnit: 0.5, trimPerUnit: 0.25, totalHrs: 6.75 },
  { fixture: 'Sink', count: 2, roughPerUnit: 1, topPerUnit: 0.5, trimPerUnit: 0.25, totalHrs: 3.5 },
]
const totals = { rough: 6.5, top: 2.5, trim: 1.25 }

describe('buildRoughLaborPageHtml', () => {
  const base: RoughLaborPageInput = {
    title: 'My Bid — Labor',
    rows,
    totals,
    costs: baseCosts,
    materials: [
      {
        fixture: 'Toilet',
        count: 3,
        lines: [
          { partName: 'Wax Ring', unitPrice: 5, quantity: 2 },
          { partName: 'PVC Pipe', unitPrice: 1.5, quantity: 4 },
        ],
      },
      { fixture: 'Sink', count: 2, lines: [] },
    ],
  }

  it('escapes and renders the title in <title> and <h1>', () => {
    const html = buildRoughLaborPageHtml({ ...base, title: 'A & B <x>' })
    expect(html).toContain('<title>A &amp; B &lt;x&gt;</title>')
    expect(html).toContain('<h1>A &amp; B &lt;x&gt;</h1>')
  })

  it('uses the rough materials heading and pre-tax summary label', () => {
    const html = buildRoughLaborPageHtml(base)
    expect(html).toContain('<h2>Materials (rough takeoff)</h2>')
    expect(html).toContain('Materials total (pre-tax): $206.71')
    expect(html).toContain('Our total cost is: $10,728.63')
  })

  it('renders a per-fixture materials block only when it has lines', () => {
    const html = buildRoughLaborPageHtml(base)
    // Toilet has lines -> block with count label.
    expect(html).toContain('Toilet <span style="font-weight:400; color:#6b7280">(count 3)</span>')
    // Sink has no lines -> no materials block for it.
    expect(html).not.toContain('Sink <span')
  })

  it('formats material line unit, qty and count-weighted total', () => {
    const html = buildRoughLaborPageHtml(base)
    // Totals are count-weighted (Toilet count 3).
    // Wax Ring: unit $5.00, qty 2, x3 = $30.00
    expect(html).toContain('>$5.00</td>')
    expect(html).toContain('>2</td>')
    expect(html).toContain('>$30.00</td>')
    // PVC Pipe: unit $1.50, qty 4, x3 = $18.00
    expect(html).toContain('>$1.50</td>')
    expect(html).toContain('>$18.00</td>')
  })

  it('escapes material part names', () => {
    const html = buildRoughLaborPageHtml({
      ...base,
      materials: [{ fixture: 'F', count: 1, lines: [{ partName: 'A & <b>', unitPrice: 1, quantity: 1 }] }],
    })
    expect(html).toContain('A &amp; &lt;b&gt;')
  })

  it('falls back to the em dash when a material fixture is null', () => {
    const html = buildRoughLaborPageHtml({
      ...base,
      materials: [{ fixture: null, count: 1, lines: [{ partName: 'X', unitPrice: 1, quantity: 1 }] }],
    })
    expect(html).toContain('—')
  })
})

describe('buildExactLaborPageHtml', () => {
  const base: ExactLaborPageInput = {
    title: 'My Bid — Labor',
    rows,
    totals,
    costs: baseCosts,
    pos: [
      {
        stageLabel: 'Rough In',
        poName: 'Job Parts 523',
        stageMaterialTotal: 206.71,
        items: [{ part_name: 'Coupling', quantity: 10, price_at_time: 2.5, template_name: 'Tmpl' }],
      },
      { stageLabel: 'Top Out', poName: '—', stageMaterialTotal: 0, items: [] },
      { stageLabel: 'Trim Set', poName: '—', stageMaterialTotal: 0, items: [] },
    ],
  }

  it('renders three PO sections with the PO (stage) headers and names', () => {
    const html = buildExactLaborPageHtml(base)
    expect(html).toContain('<strong>PO (Rough In)</strong> Job Parts 523 — $206.71')
    expect(html).toContain('<strong>PO (Top Out)</strong> — — $0.00')
    expect(html).toContain('<strong>PO (Trim Set)</strong> — — $0.00')
  })

  it('uses the exact materials heading and "Materials Total:" summary label', () => {
    const html = buildExactLaborPageHtml(base)
    expect(html).toContain('<h2>Materials</h2>')
    expect(html).toContain('Materials Total: $206.71')
  })

  it('renders Subtotal/Tax/stage Total rows for a non-empty PO', () => {
    const html = buildExactLaborPageHtml(base)
    // Subtotal = 10 * 2.5 = 25.00 ; tax @8.25% = 2.06 ; total = 27.06
    expect(html).toContain('Subtotal:')
    expect(html).toContain('$25.00')
    expect(html).toContain('Tax:')
    expect(html).toContain('$2.06')
    expect(html).toContain('Rough In Total:')
    expect(html).toContain('$27.06')
  })

  it('shows the empty-PO state for stages without items', () => {
    const html = buildExactLaborPageHtml(base)
    expect(html).toContain('No items in this PO.')
  })

  it('escapes PO names and item part names', () => {
    const html = buildExactLaborPageHtml({
      ...base,
      pos: [
        {
          stageLabel: 'Rough In',
          poName: 'PO & <1>',
          stageMaterialTotal: 1,
          items: [{ part_name: 'P & <q>', quantity: 1, price_at_time: 1, template_name: null }],
        },
        { stageLabel: 'Top Out', poName: '—', stageMaterialTotal: 0, items: [] },
        { stageLabel: 'Trim Set', poName: '—', stageMaterialTotal: 0, items: [] },
      ],
    })
    expect(html).toContain('PO &amp; &lt;1&gt;')
    expect(html).toContain('P &amp; &lt;q&gt;')
  })
})

describe('laborTableAndSummary (shared, via both builders)', () => {
  const base: RoughLaborPageInput = {
    title: 'T',
    rows,
    totals,
    costs: baseCosts,
    materials: [],
  }

  it('renders a labor row per fixture plus a totals row', () => {
    const html = buildRoughLaborPageHtml(base)
    expect(html).toContain('>Toilet</td>')
    expect(html).toContain('>Sink</td>')
    // Totals row uses the precomputed stage totals + costs.totalHours.
    expect(html).toContain('>6.50 hrs</td>')
    expect(html).toContain('>2.50 hrs</td>')
    expect(html).toContain('>1.25 hrs</td>')
    expect(html).toContain('>12.50 hrs</td>')
  })

  it('shows the "No labor rows" empty state and no totals row', () => {
    const html = buildRoughLaborPageHtml({ ...base, rows: [], totals: null })
    expect(html).toContain('No labor rows')
    expect(html).not.toContain('>Totals</td>')
  })

  it('includes Driving / Estimator / Travel lines when their costs are positive', () => {
    const html = buildRoughLaborPageHtml(base)
    expect(html).toContain('Driving: $334.42')
    expect(html).toContain('12.3 trips × $0.70/mi × 39 mi')
    expect(html).toContain('Estimator: $9,000.00')
    expect(html).toContain('Travel: $250.00')
  })

  it('omits Driving / Estimator / Travel lines when their costs are zero', () => {
    const html = buildRoughLaborPageHtml({
      ...base,
      costs: { ...baseCosts, distance: 0, drivingCost: 0, estimatorCost: 0, travelCost: 0 },
    })
    expect(html).not.toContain('Driving:')
    expect(html).not.toContain('Estimator:')
    expect(html).not.toContain('Travel:')
    // Manhours + Labor total always render.
    expect(html).toContain('Manhours: $937.50')
    expect(html).toContain('Labor total: $10,521.92')
  })
})
