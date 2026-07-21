import { describe, expect, it } from 'vitest'
import type { LaborJob } from '../../types/laborJob'
import { buildJobSubSheetHtml, buildLaborFormSubSheetHtml, buildSubLaborSheetHtml } from './subLaborSheet'

describe('buildSubLaborSheetHtml', () => {
  it('renders the empty-rows placeholder and a $0.00 total', () => {
    const html = buildSubLaborSheetHtml({ title: 'T', rows: [], costFallbackRate: 20, displayRateFallback: 0 })
    expect(html).toContain('No labor rows')
    expect(html).toContain('<td style="text-align:right">$0.00</td>')
  })

  it('renders a per-unit row: count × hrs_per_unit at the row rate', () => {
    const html = buildSubLaborSheetHtml({
      title: 'T',
      rows: [{ fixture: 'Lav', count: 3, hrs_per_unit: 2, labor_rate: 25 }],
      costFallbackRate: 20,
      displayRateFallback: 0,
    })
    expect(html).toContain('<td>Lav</td>')
    expect(html).toContain('<td style="text-align:center">3</td>')
    expect(html).toContain('<td style="text-align:right">6.00</td>')
    expect(html).toContain('<td style="text-align:right">$25.00</td>')
    expect(html).toContain('<td style="text-align:right">$150.00</td>')
  })

  it('renders a fixed row: hours are hrs_per_unit regardless of count', () => {
    const html = buildSubLaborSheetHtml({
      title: 'T',
      rows: [{ fixture: 'Rough-in', count: 4, hrs_per_unit: 5, is_fixed: true, labor_rate: 10 }],
      costFallbackRate: 20,
      displayRateFallback: 0,
    })
    expect(html).toContain('<td style="text-align:right">5.00</td>')
    expect(html).toContain('<td style="text-align:right">$50.00</td>')
  })

  it('renders a direct-amount row with dashes and the direct cost', () => {
    const html = buildSubLaborSheetHtml({
      title: 'T',
      rows: [{ fixture: 'Change order', count: 1, hrs_per_unit: 0, direct_labor_amount: 425 }],
      costFallbackRate: 20,
      displayRateFallback: 0,
    })
    expect(html).toContain(
      '<td>Change order</td><td style="text-align:center">—</td><td style="text-align:right">—</td><td style="text-align:right">—</td><td style="text-align:right">$425.00</td>',
    )
  })

  it('escapes HTML in the title and fixture names', () => {
    const html = buildSubLaborSheetHtml({
      title: 'A & B <Plumbing>',
      rows: [{ fixture: '<script>', count: 1, hrs_per_unit: 1, labor_rate: 1 }],
      costFallbackRate: 1,
      displayRateFallback: 0,
    })
    expect(html).toContain('<title>A &amp; B &lt;Plumbing&gt;</title>')
    expect(html).toContain('<td>&lt;script&gt;</td>')
    expect(html).not.toContain('<script>')
  })
})

describe('buildLaborFormSubSheetHtml', () => {
  it('drops blank-fixture rows, labels empty crews "Labor", and shows rate 0 for rate-less rows', () => {
    const html = buildLaborFormSubSheetHtml({
      assignedNames: [],
      address: '',
      rows: [
        { fixture: '  ', count: 1, hrs_per_unit: 1, labor_rate: 50 },
        { fixture: 'Sink', count: 2, hrs_per_unit: 1, labor_rate: null },
      ],
      dateStr: '7/20/2026',
    })
    expect(html).toContain('<h1>Labor — Job — 7/20/2026</h1>')
    expect(html).toContain('<td>Sink</td>')
    expect(html).not.toContain('<td></td>')
    // Display rate falls back to 0 while the line cost uses the FIRST form
    // row's rate (50) — the historical fallback pair.
    expect(html).toContain('<td style="text-align:right">$0.00</td>')
    expect(html).toContain('<td style="text-align:right">$100.00</td>')
  })

  it('joins assigned names and keeps the address in the title', () => {
    const html = buildLaborFormSubSheetHtml({
      assignedNames: ['Ana', 'Bo'],
      address: '12 Main St',
      rows: [{ fixture: 'Lav', count: 1, hrs_per_unit: 1, labor_rate: 20 }],
      dateStr: '1/2/2026',
    })
    expect(html).toContain('<h1>Ana, Bo — 12 Main St — 1/2/2026</h1>')
  })
})

describe('buildJobSubSheetHtml', () => {
  const baseJob = {
    assigned_to_name: 'Cid',
    job_number: 'HCP-9',
    address: '5 Oak Ave',
    job_date: '2026-07-01',
    created_at: '2026-06-01T00:00:00Z',
    labor_rate: 30,
    items: [{ fixture: 'WC', count: 2, hrs_per_unit: 1.5, labor_rate: null }],
  } as unknown as LaborJob

  it('titles with number + address and falls back rate-less items to the job rate', () => {
    const html = buildJobSubSheetHtml(baseJob, '7/1/2026')
    expect(html).toContain('<h1>Cid — HCP-9 — 5 Oak Ave — 7/1/2026</h1>')
    expect(html).toContain('<td style="text-align:right">$30.00</td>')
    expect(html).toContain('<td style="text-align:right">$90.00</td>')
  })

  it('omits the job-number segment when absent and prints all items unfiltered', () => {
    const job = { ...baseJob, job_number: null, items: [] } as unknown as LaborJob
    const html = buildJobSubSheetHtml(job, '7/1/2026')
    expect(html).toContain('<h1>Cid — 5 Oak Ave — 7/1/2026</h1>')
    expect(html).toContain('No labor rows')
  })
})
