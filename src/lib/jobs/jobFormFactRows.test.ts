import { describe, it, expect } from 'vitest'
import {
  accountManRowValue,
  customerRowSummary,
  dateMetRowAgo,
  dateMetRowValue,
  folderRowLinks,
  teamRowValue,
} from './jobFormFactRows'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

function customer(overrides: Partial<CustomerRow>): CustomerRow {
  return {
    id: 'c1',
    name: 'Todd Cop',
    address: '6414 Maverick Oak Dr San Antonio, TX 78240',
    master_user_id: 'master-1',
    contact_info: null,
    customer_type: null,
    date_met: null,
    ...overrides,
  } as CustomerRow
}

const users = [
  { id: 'u1', name: 'Abraham' },
  { id: 'u2', name: 'Paige' },
  { id: 'u3', name: 'Malachi' },
]

describe('accountManRowValue', () => {
  it('is null with no account man', () => {
    expect(accountManRowValue(users, null, null)).toBeNull()
  })
  it('shows name with relationship label, defaulting to primary', () => {
    expect(accountManRowValue(users, 'u3', null)).toBe('Malachi · Primary communicator')
    expect(accountManRowValue(users, 'u3', 'only')).toBe('Malachi · Only communicator')
  })
  it('is null when the user id is unknown', () => {
    expect(accountManRowValue(users, 'ghost', 'primary')).toBeNull()
  })
})

describe('teamRowValue', () => {
  it('is null for an empty team', () => {
    expect(teamRowValue(users, [])).toBeNull()
  })
  it('joins names in assignment order, falling back to the id', () => {
    expect(teamRowValue(users, ['u1', 'u2', 'ghost'])).toBe('Abraham, Paige, ghost')
  })
})

describe('customerRowSummary', () => {
  it('is null when nothing is set', () => {
    expect(
      customerRowSummary({
        customers: [],
        customerId: null,
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        masterUserId: 'master-1',
      }),
    ).toBeNull()
  })
  it('linked customer carries its address and no chip', () => {
    const summary = customerRowSummary({
      customers: [customer({})],
      customerId: 'c1',
      customerName: 'Todd Cop',
      customerEmail: '',
      customerPhone: '',
      masterUserId: 'master-1',
    })
    expect(summary).toEqual({
      name: 'Todd Cop',
      linked: true,
      address: '6414 Maverick Oak Dr San Antonio, TX 78240',
      notInCustomers: false,
    })
  })
  it('unlinked form customer with no matching row flags Not in Customers', () => {
    const summary = customerRowSummary({
      customers: [customer({})],
      customerId: null,
      customerName: 'Someone Else',
      customerEmail: '',
      customerPhone: '',
      masterUserId: 'master-1',
    })
    expect(summary?.linked).toBe(false)
    expect(summary?.notInCustomers).toBe(true)
    expect(summary?.address).toBeNull()
  })
  it('unlinked name matching a single same-master row does not flag', () => {
    const summary = customerRowSummary({
      customers: [customer({})],
      customerId: null,
      customerName: 'Todd Cop',
      customerEmail: '',
      customerPhone: '',
      masterUserId: 'master-1',
    })
    expect(summary?.notInCustomers).toBe(false)
  })
})

describe('folderRowLinks', () => {
  it('trims to null', () => {
    expect(folderRowLinks('  ', '')).toEqual({ files: null, pictures: null })
  })
  it('keeps set urls', () => {
    expect(folderRowLinks('https://a', ' https://b ')).toEqual({ files: 'https://a', pictures: 'https://b' })
  })
})

describe('dateMetRowValue', () => {
  it('formats zero-padded MM/DD/YY without timezone shifting', () => {
    expect(dateMetRowValue('2026-08-15')).toBe('08/15/26')
    expect(dateMetRowValue('2026-01-02')).toBe('01/02/26')
  })
  it('is null for blank or malformed input', () => {
    expect(dateMetRowValue('')).toBeNull()
    expect(dateMetRowValue('08/15/2026')).toBeNull()
  })
})

describe('dateMetRowAgo', () => {
  const now = new Date('2026-08-16T12:00:00')
  it('buckets into days, weeks, and months like the Pipeline "Open N"', () => {
    expect(dateMetRowAgo('2026-08-14', now)).toBe('2 days ago')
    expect(dateMetRowAgo('2026-07-30', now)).toBe('2 weeks ago')
    expect(dateMetRowAgo('2026-06-09', now)).toBe('2 months ago')
  })
  it('collapses sub-day ages to today', () => {
    expect(dateMetRowAgo('2026-08-16', now)).toBe('today')
  })
  it('is null for blank or malformed input', () => {
    expect(dateMetRowAgo('', now)).toBeNull()
    expect(dateMetRowAgo('junk', now)).toBeNull()
  })
})
