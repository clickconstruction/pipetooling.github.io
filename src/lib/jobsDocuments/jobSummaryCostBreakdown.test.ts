import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LaborJob } from '../../types/laborJob'
import { formatWorkDateYmdWeekdayLongFriendly } from '../../utils/dateUtils'
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
    expect(html).toContain('<h2>Team</h2>')
    expect(html).toContain('<td>Ana</td>')
    // person-summary footer total = team 240 + card 0 + supply 0
    expect(html).toContain('$240.00')
    // work-date alloc row rendered from byWorkDate (formatter output varies by
    // environment TZ/Intl data, so assert against the formatter itself)
    expect(html).toContain(`<td>${formatWorkDateYmdWeekdayLongFriendly('2026-07-01')}</td>`)
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

describe('v2.6670 · the print counts card charges by the table’s rule and draws fuel as its own line', () => {
  const fuel = { tagId: 'tag-fuel', name: 'Fuel & gas', icon: '⛽', usd: 85 }

  it('takes card charges already on a supply-house invoice off Parts cost, as the table does, and says so', () => {
    const html = buildJobSummaryCostBreakdownHtml(
      baseInput({ partsFromTally: 100, invoicesFromSupplyHouses: 300, billedMaterialsSum: 50, cardCharges: 200, cardChargesLinkedToInvoices: 120 }),
    )
    // 100 + 300 + 50 + (200 − 120) — never the 650 the old print read.
    expect(html).toContain('<td style="text-align:right">$530.00</td>')
    expect(html).not.toContain('$650.00')
    expect(html).toContain('Card charges — $200.00')
    expect(html).toContain('$120.00 of the card charges is also on a supply-house invoice and is counted there, so Parts cost counts $80.00 of card charges.')
  })

  it('a linked figure above the card charges counts only the card charges (the table’s clamp); none says nothing', () => {
    const clamped = buildJobSummaryCostBreakdownHtml(baseInput({ cardCharges: 50, cardChargesLinkedToInvoices: 90 }))
    expect(clamped).toContain('<td style="text-align:right">—</td>') // parts cost 50 − 50 = 0
    const none = buildJobSummaryCostBreakdownHtml(baseInput({ cardCharges: 50 }))
    expect(none).toContain('<td style="text-align:right">$50.00</td>')
    expect(none).not.toContain('also on a supply-house invoice')
  })

  it('draws each cost line under Parts cost as the table does and as its own line in the Parts Cost section', () => {
    const html = buildJobSummaryCostBreakdownHtml(baseInput({ cardCharges: 200, costLines: [fuel, { tagId: 'tag-zero', name: 'Tolls', icon: '🛣', usd: 0 }] }))
    expect(html).toContain('<td style="text-align:right">$200.00<div class="cost-line"><span aria-hidden="true">⛽</span> fuel &amp; gas $85.00</div></td>')
    expect(html).toContain('<h3 style="font-size:1rem"><span aria-hidden="true">⛽</span> Fuel &amp; gas — $85.00</h3>')
    expect(html).toContain('Inside Parts cost, not added to it.')
    expect(html).not.toContain('Tolls') // a $0 line is not drawn, as in the table
    expect(html).toContain('.cost-line {')
  })

  it('with no cost lines the print reads as before', () => {
    const html = buildJobSummaryCostBreakdownHtml(baseInput({ cardCharges: 200 }))
    expect(html).not.toContain('cost-line"')
    expect(html).not.toContain('Inside Parts cost')
  })
})
