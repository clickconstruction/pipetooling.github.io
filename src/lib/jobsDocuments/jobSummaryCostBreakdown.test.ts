import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LaborJob } from '../../types/laborJob'
import { buildJobSummaryCostBreakdownHtml, type JobSummaryCostBreakdownInput } from './jobSummaryCostBreakdown'

function baseInput(p: Partial<JobSummaryCostBreakdownInput> = {}): JobSummaryCostBreakdownInput {
  return {
    job: {
      id: 'j1',
      hcp_number: 'HCP-7',
      job_name: 'Repipe',
      job_address: '9 Elm',
      materials: [],
    } as unknown as JobWithDetails,
    teamLaborRow: null,
    teamLaborCost: 0,
    subLaborJobs: [],
    partsFromTally: 0,
    billedMaterialsSum: 0,
    invoicesFromSupplyHouses: 0,
    cardCharges: 0,
    totalBill: 0,
    profit: 0,
    tallyPartsForJob: [],
    mileageCost: 0,
    timePerMile: 0,
    invoiceRows: [],
    mercuryRows: [],
    clockSessions: [],
    clockSessionsLoaded: false,
    nicknameByDebitCard: {},
    generated: 'TEST-GENERATED',
    ...p,
  }
}

describe('buildJobSummaryCostBreakdownHtml', () => {
  it('renders the empty-state document with header, injected timestamp, and dash cells', () => {
    const html = buildJobSummaryCostBreakdownHtml(baseInput())
    expect(html).toContain('<h1>HCP-7 — Repipe — 9 Elm</h1>')
    expect(html).toContain('<title>HCP-7 — Repipe — 9 Elm — Cost breakdown</title>')
    expect(html).toContain('Cost breakdown · TEST-GENERATED')
    expect(html).toContain('No per-person team labor or card data.')
    expect(html).toContain('No team labor for this job.')
    expect(html).toContain('No sub labor for this HCP.')
    expect(html).toContain('<strong>Revenue (billing):</strong> —')
  })

  it('renders team labor breakdown with per-person work-date tables when sessions are loaded', () => {
    const html = buildJobSummaryCostBreakdownHtml(
      baseInput({
        teamLaborRow: {
          manHours: 8,
          breakdown: [
            { personName: 'Ana', hours: 8, cost: 240, byWorkDate: [{ workDate: '2026-07-01', hours: 8, cost: 240 }] },
          ],
        },
        teamLaborCost: 240,
        clockSessionsLoaded: true,
        clockSessions: [],
      }),
    )
    expect(html).toContain('<h2>Team Labor</h2>')
    expect(html).toContain('<td>Ana</td>')
    // person-summary footer total = team 240 + card 0 + supply 0
    expect(html).toContain('$240.00')
    // work-date alloc row rendered from byWorkDate
    expect(html).toContain('<td>Jul 1, 2026</td>')
  })

  it('renders supply-house invoices with the unassigned person-summary row', () => {
    const html = buildJobSummaryCostBreakdownHtml(
      baseInput({
        invoicesFromSupplyHouses: 120,
        invoiceRows: [
          {
            supply_house_name: 'Ferg & Son',
            invoice_number: 'INV<1>',
            invoice_date: '2026-07-02',
            allocated_amount: 120,
          } as unknown as JobSummaryCostBreakdownInput['invoiceRows'][number],
        ],
      }),
    )
    expect(html).toContain('Invoices from supply houses — $120.00')
    expect(html).toContain('Ferg &amp; Son')
    expect(html).toContain('INV&lt;1&gt;')
    expect(html).toContain('<td>Unassigned</td>')
  })

  it('renders the unavailable notes when the detail fetch fallbacks failed', () => {
    const html = buildJobSummaryCostBreakdownHtml(
      baseInput({
        invoicesFromSupplyHouses: 50,
        invoiceDetailUnavailable: true,
        cardCharges: 50,
        cardDetailUnavailable: true,
      }),
    )
    expect(html).toContain('Invoice line detail unavailable.')
    expect(html).toContain('Card charge line detail unavailable.')
  })

  it('sums sub labor jobs and lists contractors', () => {
    const lj = { assigned_to_name: 'Sub Co', job_date: '2026-07-03', items: [], labor_rate: 0 } as unknown as LaborJob
    const html = buildJobSummaryCostBreakdownHtml(baseInput({ subLaborJobs: [lj] }))
    expect(html).toContain('<h2>Sub Labor</h2>')
    expect(html).toContain('Sub Co')
    expect(html).toContain('2026-07-03')
  })
})
