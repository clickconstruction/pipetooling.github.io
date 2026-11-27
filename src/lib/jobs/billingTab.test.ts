import { describe, expect, it } from 'vitest'
import { billingJobMatchesSearch } from './billingTab'

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

describe('billingJobMatchesSearch — line items (v2.1619)', () => {
  const job = {
    hcp_number: '917',
    job_name: 'John Inglow',
    job_address: '1 Elm St',
    customer_name: 'Inglow Family',
    fixtures: [{ name: 'Water heater', line_description: 'Replaced burner assembly' }],
    materials: [{ description: 'Permit fee' }],
  }
  it('matches fixture names, descriptions, charges, and customer', () => {
    expect(billingJobMatchesSearch(job, 'water heater')).toBe(true)
    expect(billingJobMatchesSearch(job, 'burner')).toBe(true)
    expect(billingJobMatchesSearch(job, 'permit')).toBe(true)
    expect(billingJobMatchesSearch(job, 'inglow family')).toBe(true)
    expect(billingJobMatchesSearch(job, 'faucet')).toBe(false)
  })
})
