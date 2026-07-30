import { describe, expect, it } from 'vitest'
import { NO_CUSTOMER_TYPE_LABEL } from '../../constants/customerTypeLabels'
import type { Database } from '../../types/database'
import {
  customerListImpliesLinkedRow,
  customerTypeShortLabel,
  extractContactFromCustomer,
  getCustomerDisplay,
} from './jobFormCustomerDisplay'

type CustomerRow = Database['public']['Tables']['customers']['Row']

function customer(overrides: Partial<CustomerRow>): CustomerRow {
  return {
    id: 'c1',
    name: 'Jane Doe',
    address: null,
    contact_info: null,
    customer_type: null,
    date_met: null,
    master_user_id: 'm1',
    archived_at: null,
    ...overrides,
  } as CustomerRow
}

describe('getCustomerDisplay', () => {
  it('is "name - address" with an address, bare name without', () => {
    expect(getCustomerDisplay(customer({ address: '12 Oak St' }))).toBe('Jane Doe - 12 Oak St')
    expect(getCustomerDisplay(customer({}))).toBe('Jane Doe')
  })
})

describe('extractContactFromCustomer', () => {
  it('reads phone/email from the contact_info blob', () => {
    expect(extractContactFromCustomer(customer({ contact_info: { phone: '555', email: 'a@b.c' } }))).toEqual({
      phone: '555',
      email: 'a@b.c',
    })
  })

  it('tolerates null, non-object, and missing/non-string keys', () => {
    expect(extractContactFromCustomer(customer({ contact_info: null }))).toEqual({ phone: '', email: '' })
    expect(extractContactFromCustomer(customer({ contact_info: 'oops' }))).toEqual({ phone: '', email: '' })
    expect(extractContactFromCustomer(customer({ contact_info: { phone: 5 } }))).toEqual({ phone: '', email: '' })
  })
})

describe('customerTypeShortLabel', () => {
  it('capitalizes the two known types', () => {
    expect(customerTypeShortLabel(customer({ customer_type: 'residential' }))).toBe('Residential')
    expect(customerTypeShortLabel(customer({ customer_type: 'commercial' }))).toBe('Commercial')
  })

  it('labels missing types and passes custom values through', () => {
    expect(customerTypeShortLabel(customer({ customer_type: null }))).toBe(NO_CUSTOMER_TYPE_LABEL)
    expect(customerTypeShortLabel(customer({ customer_type: '' }))).toBe(NO_CUSTOMER_TYPE_LABEL)
    expect(customerTypeShortLabel(customer({ customer_type: 'HOA' }))).toBe('HOA')
  })
})

describe('customerListImpliesLinkedRow', () => {
  const rows = [
    customer({ id: 'a', name: 'Jane Doe', master_user_id: 'm1' }),
    customer({ id: 'b', name: 'Jane Doe', master_user_id: 'm2' }),
    customer({ id: 'c', name: 'Bob Roe', master_user_id: 'm2' }),
  ]

  it('matches exactly one same-named row under the job master', () => {
    expect(customerListImpliesLinkedRow(rows, 'm1', 'jane doe')).toBe(true)
  })

  it('falls back to a single overall name match when the master has none', () => {
    expect(customerListImpliesLinkedRow(rows, 'm3', 'Bob Roe')).toBe(true)
  })

  it('is false for blank names, no matches, or ambiguous matches', () => {
    expect(customerListImpliesLinkedRow(rows, 'm1', '  ')).toBe(false)
    expect(customerListImpliesLinkedRow(rows, 'm1', 'Nobody')).toBe(false)
    expect(customerListImpliesLinkedRow(rows, 'm3', 'Jane Doe')).toBe(false)
  })
})
