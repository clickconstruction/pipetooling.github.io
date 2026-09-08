import { describe, expect, it } from 'vitest'
import { jobCountsByProperty, propertyStreetKey, suggestPropertiesFromJobs } from './customerPropertiesFromJobs'

const props = [
  { id: 'p1', address: '412 Gruene Rd, New Braunfels, TX 78130' },
  { id: 'p2', address: '55 Pecan Ct, San Marcos, TX 78666' },
]

describe('propertyStreetKey', () => {
  it('is the normalized street line', () => {
    expect(propertyStreetKey('412  Gruene RD, New Braunfels, TX')).toBe('412 gruene rd')
    expect(propertyStreetKey('')).toBe('')
  })
})

describe('jobCountsByProperty', () => {
  it('counts linked jobs and unlinked jobs whose street line matches', () => {
    const counts = jobCountsByProperty(props, [
      { id: 'j1', job_address: 'somewhere else', customer_address_id: 'p1' },
      { id: 'j2', job_address: '412 GRUENE RD, New Braunfels, TX 78130', customer_address_id: null },
      { id: 'j3', job_address: '3311 Loop 337, New Braunfels, TX', customer_address_id: null },
      { id: 'j4', job_address: '55 Pecan Ct, San Marcos, TX 78666', customer_address_id: 'p2' },
      { id: 'j5', job_address: null, customer_address_id: 'gone' },
    ])
    expect(counts.get('p1')).toBe(2)
    expect(counts.get('p2')).toBe(1)
    expect(counts.size).toBe(2)
  })
})

describe('suggestPropertiesFromJobs', () => {
  it('offers unsaved job addresses, one per street line, most jobs first, newest spelling', () => {
    const out = suggestPropertiesFromJobs(props, [
      { id: 'j1', job_address: '3311 Loop 337, New Braunfels, TX 78130', customer_address_id: null },
      { id: 'j2', job_address: '3311 LOOP 337, NEW BRAUNFELS, TX', customer_address_id: null },
      { id: 'j3', job_address: '412 Gruene Rd, New Braunfels, TX 78130', customer_address_id: null }, // saved already
      { id: 'j4', job_address: '9 Elm St, Kyle, TX', customer_address_id: null },
      { id: 'j5', job_address: 'linked elsewhere', customer_address_id: 'p1' },
      { id: 'j6', job_address: '   ', customer_address_id: null },
    ])
    expect(out).toEqual([
      { address: '3311 Loop 337, New Braunfels, TX 78130', jobCount: 2 },
      { address: '9 Elm St, Kyle, TX', jobCount: 1 },
    ])
  })
  it('is empty when every job address is saved or linked', () => {
    expect(suggestPropertiesFromJobs(props, [{ id: 'j', job_address: '55 Pecan Ct, San Marcos', customer_address_id: null }])).toEqual([])
    expect(suggestPropertiesFromJobs([], [])).toEqual([])
  })
})
