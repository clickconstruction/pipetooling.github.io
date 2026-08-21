import { describe, it, expect } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import {
  buildPortalProperties,
  normalizeAddressKey,
  splitAddress,
  type PropertyJobRow,
} from '../../../supabase/functions/_shared/portalProperties'

function job(over: Partial<PropertyJobRow> & { id: string }): PropertyJobRow {
  return { status: 'billed', job_address: null, hcp_number: null, click_number: null, ...over }
}

describe('splitAddress', () => {
  it('drops state and zip, splits street from city', () => {
    expect(splitAddress('150 E Sonterra Blvd 200B San Antonio, TX 78258')).toEqual({
      street: '150 E Sonterra Blvd 200B San Antonio',
      city: null,
    })
    expect(splitAddress('4110 N Main St, Taylor, TX 76574')).toEqual({ street: '4110 N Main St', city: 'Taylor' })
    expect(splitAddress('88 Canyon Lake Dr, Canyon Lake')).toEqual({ street: '88 Canyon Lake Dr', city: 'Canyon Lake' })
  })

  it('handles trailing zip without state and addresses with no city', () => {
    expect(splitAddress('416 Springtown Way 78666')).toEqual({ street: '416 Springtown Way', city: null })
    expect(splitAddress('900 Broadway')).toEqual({ street: '900 Broadway', city: null })
  })
})

describe('normalizeAddressKey', () => {
  it('is case/whitespace-insensitive but never fuzzy', () => {
    expect(normalizeAddressKey('150 E Sonterra  Blvd 200B, San Antonio')).toBe(
      normalizeAddressKey('150 e sonterra blvd 200b, san antonio'),
    )
    expect(normalizeAddressKey('150 E Sonterra Blvd 200B')).not.toBe(normalizeAddressKey('150 E Sonterra Blvd 200A'))
  })

  it('merges comma/zip/state-typo variants of one address (the Springtown case)', () => {
    const a = normalizeAddressKey('415 Springtown Way San Marcos, TX 78666')
    expect(normalizeAddressKey('415 Springtown Way, San Marcos, TX 7866')).toBe(a)
    expect(normalizeAddressKey('415 Springtown Way, San Marcos')).toBe(a)
    expect(normalizeAddressKey('Hospital-415 Springtown Way San Marcos, TX')).not.toBe(a)
  })
})

describe('buildPortalProperties', () => {
  it('collapses same-address jobs to one row backed by the newest job', () => {
    const props = buildPortalProperties([
      job({ id: 'a', hcp_number: '789', job_address: '150 E Sonterra Blvd 200B San Antonio, TX 78258' }),
      job({ id: 'b', hcp_number: '915', job_address: '150 E Sonterra Blvd 200B  San Antonio, TX 78258' }),
      job({ id: 'c', hcp_number: '880', job_address: '150 e sonterra blvd 200b san antonio, tx 78258' }),
      job({ id: 'd', hcp_number: '963', job_address: '415 Springtown Way, San Marcos, TX 78666' }),
    ])
    expect(props).toHaveLength(2)
    expect(props[0]).toMatchObject({ jobId: 'd', street: '415 Springtown Way', city: 'San Marcos' })
    expect(props[1]).toMatchObject({ jobId: 'b' }) // 915 is the newest Sonterra job
  })

  it('drops paid jobs and jobs without an address', () => {
    const props = buildPortalProperties([
      job({ id: 'p', status: 'paid', hcp_number: '1', job_address: '1 Paid St, Austin, TX' }),
      job({ id: 'n', hcp_number: '2', job_address: '   ' }),
      job({ id: 'k', hcp_number: '3', job_address: '2 Open Rd, Austin, TX' }),
    ])
    expect(props).toEqual([{ jobId: 'k', street: '2 Open Rd', city: 'Austin' }])
  })

  it('orders rows newest job first and never merges different suites', () => {
    const props = buildPortalProperties([
      job({ id: 'x', hcp_number: '100', job_address: '10 Elm St Ste A, Waco, TX' }),
      job({ id: 'y', hcp_number: '200', job_address: '10 Elm St Ste B, Waco, TX' }),
    ])
    expect(props.map((p) => p.jobId)).toEqual(['y', 'x'])
  })

  it('falls back to click_number when hcp is blank', () => {
    const props = buildPortalProperties([
      job({ id: 'h', hcp_number: '', click_number: '50', job_address: '5 Oak St, Hutto, TX' }),
      job({ id: 'i', hcp_number: '40', job_address: '5 Oak St, Hutto, TX' }),
    ])
    expect(props[0]?.jobId).toBe('h')
  })
})
