import { describe, expect, it } from 'vitest'
import {
  billingFixturesCellText,
  billingJobMatchesSearch,
  billingMaterialsCellText,
  sortJobsForBilling,
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
