import { describe, expect, it } from 'vitest'
import {
  buildFieldJobLookupCard,
  directionsUrlForAddress,
  doorsOnlyHeaderSearchEligible,
  fieldJobLookupEligible,
  headerSearchEligibleForRole,
  officeHeaderSearchEligible,
  officeTelHref,
} from './fieldJobLookup'
import type { UserRole } from '../hooks/useAuth'

const ROLES: UserRole[] = [
  'dev',
  'master_technician',
  'assistant',
  'controller',
  'subcontractor',
  'helpers',
  'estimator',
  'primary',
  'superintendent',
]

describe('header search eligibility (T5-01)', () => {
  it('office roles keep the full search; field roles get the lookup; the estimator, primary and superintendent get the doors', () => {
    const office = ROLES.filter((r) => officeHeaderSearchEligible(r, false))
    const field = ROLES.filter((r) => fieldJobLookupEligible(r, false))
    const doors = ROLES.filter((r) => doorsOnlyHeaderSearchEligible(r, false))
    expect(office).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
    expect(field).toEqual(['subcontractor', 'helpers'])
    // Go anywhere (punch list #181, PR 4): the three roles that had no box get the doors alone.
    expect(doors).toEqual(['estimator', 'primary', 'superintendent'])
    for (const r of ROLES) expect(headerSearchEligibleForRole(r, false)).toBe(true)
  })

  it('a role is in exactly one of the three modes', () => {
    for (const r of ROLES) {
      const modes = [officeHeaderSearchEligible(r, false), fieldJobLookupEligible(r, false), doorsOnlyHeaderSearchEligible(r, false)].filter(Boolean)
      expect(modes, r).toHaveLength(1)
    }
  })

  it('Farm Mode switches every entry point off', () => {
    for (const r of ROLES) expect(headerSearchEligibleForRole(r, true)).toBe(false)
  })

  it('a null role (cold load) mounts nothing', () => {
    expect(headerSearchEligibleForRole(null, false)).toBe(false)
    expect(headerSearchEligibleForRole(undefined, false)).toBe(false)
  })
})

describe('directions + office phone hrefs', () => {
  it('encodes the address into a Google Maps directions link', () => {
    expect(directionsUrlForAddress(' 1200 Example Rd, Kyle TX ')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=1200%20Example%20Rd%2C%20Kyle%20TX',
    )
  })
  it('returns null for a blank address', () => {
    expect(directionsUrlForAddress('')).toBeNull()
    expect(directionsUrlForAddress('   ')).toBeNull()
    expect(directionsUrlForAddress(null)).toBeNull()
  })
  it('turns the office phone into an E.164 tel: link', () => {
    expect(officeTelHref('(512) 360-0599')).toBe('tel:+15123600599')
    expect(officeTelHref('1-512-360-0599')).toBe('tel:+15123600599')
    expect(officeTelHref('')).toBeNull()
    expect(officeTelHref(null)).toBeNull()
  })
})

describe('buildFieldJobLookupCard', () => {
  it('shapes number, name, address, trade and directions from an RPC row', () => {
    const card = buildFieldJobLookupCard(
      { job_name: ' Example Plaza ', job_address: '1200 Example Rd, Kyle TX', service_type_name: 'Plumbing' },
      'J878',
    )
    expect(card).toEqual({
      number: 'J878',
      name: 'Example Plaza',
      address: '1200 Example Rd, Kyle TX',
      serviceType: 'Plumbing',
      directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=1200%20Example%20Rd%2C%20Kyle%20TX',
    })
  })
  it('falls back honestly when the row is thin', () => {
    const card = buildFieldJobLookupCard({ job_name: '', job_address: null, service_type_name: '' }, null)
    expect(card.number).toBe('—')
    expect(card.name).toBe('Job')
    expect(card.address).toBeNull()
    expect(card.serviceType).toBeNull()
    expect(card.directionsUrl).toBeNull()
  })
})
