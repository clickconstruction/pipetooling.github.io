import { describe, expect, it } from 'vitest'
import {
  estimateDeclinedRowLabel,
  estimateLinkedJobHcp,
  estimateListAddOnCount,
  estimateListCustomerColumnLines,
  estimateListCustomerSubline,
  estimateListOptionsCount,
  estimateListOptionsSuffix,
  estimateListRowMatchesSearch,
  estimateStatusLabel,
  formatEstimateMoney,
  type EstimateListRow,
} from './estimateListRows'
import { getCustomerDisplay } from '../customerContactDisplay'
import { MAX_ESTIMATE_OPTIONS } from './estimateOptions'

const row = (over: Partial<EstimateListRow> = {}): EstimateListRow =>
  ({
    id: 'e1',
    estimate_number: 1042,
    title: 'Kitchen rough-in',
    status: 'sent',
    total_cents: 123_456,
    customer_email: null,
    for_address: null,
    customers: null,
    options_snapshot: null,
    ...over,
  }) as unknown as EstimateListRow

describe('the options tell', () => {
  const opt = (key: string, kind?: string) => ({ key, kind })
  it('counts keyed entries only, capped at the product max', () => {
    expect(estimateListOptionsCount(null)).toBe(0)
    expect(estimateListOptionsCount([opt('a'), { key: '  ' }, 'junk', null, opt('b')])).toBe(2)
    expect(estimateListOptionsCount(Array.from({ length: 10 }, (_, i) => opt(`k${i}`)))).toBe(MAX_ESTIMATE_OPTIONS)
  })
  it('counts add-ons among the keyed entries, inside the same cap', () => {
    expect(estimateListAddOnCount([opt('a'), opt('b', 'add_on'), opt('c', 'add_on'), 'junk'])).toBe(2)
    expect(estimateListAddOnCount([...Array.from({ length: MAX_ESTIMATE_OPTIONS }, (_, i) => opt(`k${i}`)), opt('late', 'add_on')])).toBe(0)
  })
  it('the suffix reads once there is a choice, names add-ons singular or plural, and goes quiet once accepted', () => {
    expect(estimateListOptionsSuffix({ status: 'sent', options_snapshot: [opt('a')] })).toBe('')
    expect(estimateListOptionsSuffix({ status: 'sent', options_snapshot: [opt('a'), opt('b'), opt('c')] })).toBe(' · 3 options')
    expect(estimateListOptionsSuffix({ status: 'sent', options_snapshot: [opt('a'), opt('b'), opt('c', 'add_on')] })).toBe(' · 3 options · 1 add-on')
    expect(estimateListOptionsSuffix({ status: 'sent', options_snapshot: [opt('a'), opt('b'), opt('c', 'add_on'), opt('d', 'add_on')] })).toBe(' · 4 options · 2 add-ons')
    expect(estimateListOptionsSuffix({ status: 'customer_accepted', options_snapshot: [opt('a'), opt('b')] })).toBe('')
  })
})

describe('the Declined chip', () => {
  const NOW = Date.parse('2026-09-26T12:00:00Z')
  it('reads Declined with no event; with one, who said no and how long ago', () => {
    expect(estimateDeclinedRowLabel(undefined, NOW)).toBe('Declined')
    expect(estimateDeclinedRowLabel([{ estimate_id: 'e1', event_type: 'public_link_view', occurred_at: '', client_ip: null, metadata: null }], NOW)).toBe('Declined')
    const label = estimateDeclinedRowLabel([{ estimate_id: 'e1', event_type: 'declined', occurred_at: '2026-09-24T12:00:00Z', client_ip: null, metadata: null }], NOW)
    expect(label.startsWith('Declined')).toBe(true)
    expect(label).toMatch(/ · .+/)
    expect(estimateDeclinedRowLabel([{ estimate_id: 'e1', event_type: 'declined', occurred_at: '', client_ip: null, metadata: null }], NOW)).not.toMatch(/ · /)
  })
})

describe('the small words', () => {
  it('the linked job number, trimmed, else null', () => {
    expect(estimateLinkedJobHcp({ jobs_ledger: { hcp_number: ' 4021 ' } })).toBe('4021')
    expect(estimateLinkedJobHcp({ jobs_ledger: { hcp_number: '' } })).toBeNull()
    expect(estimateLinkedJobHcp({})).toBeNull()
  })
  it('money is a USD currency string of the cents', () => {
    expect(formatEstimateMoney(123_456)).toMatch(/^\$?1,234\.56$|^US\$1,234\.56$/)
    expect(formatEstimateMoney(0)).toMatch(/0\.00$/)
  })
  it('every status has its word; an unknown one prints itself', () => {
    expect(['draft', 'sent', 'customer_accepted', 'declined', 'superseded'].map((s) => estimateStatusLabel(s as never))).toEqual(['Draft', 'Sent', 'Accepted', 'Declined', 'Superseded'])
    expect(estimateStatusLabel('archived' as never)).toBe('archived')
  })
})

describe('the customer line', () => {
  it('prefers the CRM customer, then the email, then the address, then a dash', () => {
    const cust = { name: 'Ana Ruiz', address: '12 Oak St', contact_info: null }
    expect(estimateListCustomerSubline(row({ customers: cust, customer_email: 'x@y.test', for_address: '9 Elm' }))).toBe(getCustomerDisplay({ name: 'Ana Ruiz', address: '12 Oak St' }))
    expect(estimateListCustomerSubline(row({ customers: { name: ' ', address: '', contact_info: null }, customer_email: ' x@y.test ' }))).toBe('x@y.test')
    expect(estimateListCustomerSubline(row({ for_address: ' 9 Elm ' }))).toBe('9 Elm')
    expect(estimateListCustomerSubline(row())).toBe('—')
  })
  it('the Stages column splits name and address onto two lines when both exist', () => {
    expect(estimateListCustomerColumnLines(row({ customers: { name: 'Ana Ruiz', address: '12 Oak St', contact_info: null } }))).toEqual({ primary: 'Ana Ruiz', secondary: '12 Oak St' })
    expect(estimateListCustomerColumnLines(row({ customers: { name: 'Ana Ruiz', address: '', contact_info: null } }))).toEqual({ primary: 'Ana Ruiz', secondary: null })
    expect(estimateListCustomerColumnLines(row({ customers: { name: '', address: '12 Oak St', contact_info: null } }))).toEqual({ primary: '12 Oak St', secondary: null })
    expect(estimateListCustomerColumnLines(row({ customers: { name: '', address: '', contact_info: null }, customer_email: 'x@y.test' }))).toEqual({ primary: 'x@y.test', secondary: null })
    expect(estimateListCustomerColumnLines(row({ for_address: '9 Elm' }))).toEqual({ primary: '9 Elm', secondary: null })
    expect(estimateListCustomerColumnLines(row())).toEqual({ primary: '—', secondary: null })
  })
})

describe('the search', () => {
  const r = row({ customers: { name: 'Ana Ruiz', address: '12 Oak St', contact_info: null }, status: 'customer_accepted' })
  it('matches the number, the title, the customer, the status word or key, and the money; blank matches all', () => {
    expect(estimateListRowMatchesSearch(r, '')).toBe(true)
    expect(estimateListRowMatchesSearch(r, '  ')).toBe(true)
    expect(estimateListRowMatchesSearch(r, '1042')).toBe(true)
    expect(estimateListRowMatchesSearch(r, 'ROUGH-IN')).toBe(true)
    expect(estimateListRowMatchesSearch(r, 'ruiz')).toBe(true)
    expect(estimateListRowMatchesSearch(r, 'accepted')).toBe(true)
    expect(estimateListRowMatchesSearch(r, 'customer_acc')).toBe(true)
    expect(estimateListRowMatchesSearch(r, '1,234.56')).toBe(true)
    expect(estimateListRowMatchesSearch(r, 'bathroom')).toBe(false)
  })
})
