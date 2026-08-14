import { describe, expect, it } from 'vitest'
import {
  BILLING_ATTENTION_LABEL,
  billingFixturesCellText,
  billingJobMatchesSearch,
  billingMaterialsCellText,
  sortJobsForBilling,
  billingJobNeedsAttention,
  billingRowMoneyTokens,
  billingTotals,
} from './billingTab'

describe('billingJobMatchesSearch', () => {
  const job = { hcp_number: 'HCP-120', job_name: 'Repipe Main', job_address: '9 Elm St' }

  it('matches blank queries and any of the three fields, case-insensitively', () => {
    expect(billingJobMatchesSearch(job, '')).toBe(true)
    expect(billingJobMatchesSearch(job, '  ')).toBe(true)
    expect(billingJobMatchesSearch(job, 'hcp-12')).toBe(true)
    expect(billingJobMatchesSearch(job, 'REPIPE')).toBe(true)
    expect(billingJobMatchesSearch(job, 'elm')).toBe(true)
    expect(billingJobMatchesSearch(job, 'oak')).toBe(false)
  })

  it('tolerates null fields', () => {
    expect(billingJobMatchesSearch({ hcp_number: null, job_name: null, job_address: null }, 'x')).toBe(false)
  })
})

describe('sortJobsForBilling', () => {
  const jobs = [{ hcp_number: 'HCP-9' }, { hcp_number: 'HCP-100' }, { hcp_number: 'HCP-20' }]

  it('sorts numerically, descending by default and ascending on request', () => {
    expect(sortJobsForBilling(jobs, false).map((j) => j.hcp_number)).toEqual(['HCP-100', 'HCP-20', 'HCP-9'])
    expect(sortJobsForBilling(jobs, true).map((j) => j.hcp_number)).toEqual(['HCP-9', 'HCP-20', 'HCP-100'])
  })

  it('does not mutate the input', () => {
    const input = [...jobs]
    sortJobsForBilling(input, true)
    expect(input.map((j) => j.hcp_number)).toEqual(['HCP-9', 'HCP-100', 'HCP-20'])
  })
})

describe('billingFixturesCellText', () => {
  it('returns a dash only for an empty list', () => {
    expect(billingFixturesCellText([])).toBe('—')
    // Non-empty list whose rows are all blank joins to '' (historical behavior)
    expect(billingFixturesCellText([{ name: ' ', count: 1 }])).toBe('')
  })

  it('formats count, positive unit price, and description lines', () => {
    expect(
      billingFixturesCellText([
        { name: 'Lav', count: 3, line_unit_price: 150, line_description: ' incl. trim ' },
        { name: 'WC', count: 1, line_unit_price: 0 },
      ]),
    ).toBe('Lav × 3 @ $150.00\nincl. trim\nWC')
  })
})

describe('billingMaterialsCellText', () => {
  it('returns a dash only for an empty list and drops blank zero rows', () => {
    expect(billingMaterialsCellText([])).toBe('—')
    expect(billingMaterialsCellText([{ description: ' ', amount: 0 }])).toBe('')
  })

  it('labels blank descriptions as Item and formats amounts', () => {
    expect(
      billingMaterialsCellText([
        { description: 'Permit', amount: 250 },
        { description: '', amount: 12.5 },
      ]),
    ).toBe('Permit: $250.00\nItem: $12.50')
  })
})

describe('billingJobMatchesSearch — line items (v2.1619)', () => {
  const job = {
    hcp_number: '917',
    job_name: 'John Ingram',
    job_address: '1 Elm St',
    customer_name: 'Ingram Family',
    fixtures: [{ name: 'Water heater', line_description: 'Replaced burner assembly' }],
    materials: [{ description: 'Permit fee' }],
  }
  it('matches fixture names, descriptions, charges, and customer', () => {
    expect(billingJobMatchesSearch(job, 'water heater')).toBe(true)
    expect(billingJobMatchesSearch(job, 'burner')).toBe(true)
    expect(billingJobMatchesSearch(job, 'permit')).toBe(true)
    expect(billingJobMatchesSearch(job, 'ingram family')).toBe(true)
    expect(billingJobMatchesSearch(job, 'faucet')).toBe(false)
  })
})

describe('billingJobNeedsAttention', () => {
  const labor = new Set(['917'])
  const team = new Set(['j1'])
  it('flags only when BOTH sub labor and team labor are missing (v2.1643); no HCP means not auditable', () => {
    expect(billingJobNeedsAttention({ id: 'j1', hcp_number: '917' }, labor, team)).toBe(false)
    expect(billingJobNeedsAttention({ id: 'j2', hcp_number: '917' }, labor, team)).toBe(false)
    expect(billingJobNeedsAttention({ id: 'j1', hcp_number: '999' }, labor, team)).toBe(false)
    expect(billingJobNeedsAttention({ id: 'j2', hcp_number: '999' }, labor, team)).toBe(true)
    expect(billingJobNeedsAttention({ id: 'j9', hcp_number: null }, labor, team)).toBe(false)
  })
})

describe('billingRowMoneyTokens / billingTotals', () => {
  it('splits paid / billed-open / unbilled and skips zero tokens', () => {
    const tokens = billingRowMoneyTokens({ revenue: 1000, payments_made: 200 }, 300)
    expect(tokens).toEqual([
      { label: 'paid $200.00', tone: 'paid' },
      { label: 'billed $300.00 open', tone: 'billed' },
      { label: 'unbilled $500.00', tone: 'unbilled' },
    ])
    expect(billingRowMoneyTokens({ revenue: 0, payments_made: 0 }, 0)).toEqual([])
  })
  it('totals the filtered rows', () => {
    expect(billingTotals([{ revenue: 100, payments_made: 40 }, { revenue: 50, payments_made: 0 }])).toEqual({
      count: 2,
      totalBill: 150,
      totalPaid: 40,
    })
  })
})

describe('BILLING_ATTENTION_LABEL', () => {
  it('keeps the owner phrasing for the both-missing icon', () => {
    expect(BILLING_ATTENTION_LABEL).toBe('No team labor or sub labor recorded for this job.')
  })
})
