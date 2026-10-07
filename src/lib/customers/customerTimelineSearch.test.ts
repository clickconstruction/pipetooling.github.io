import { describe, expect, it } from 'vitest'
import { CUSTOMER_TIMELINE_PARAM, customerTimelineHref, customerTimelineSearchMatches, readCustomerTimelineParam } from './customerTimelineSearch'

const c = (id: string, name: string, archived_at: string | null = null) => ({ id, name, archived_at })
const customers = [
  c('1', 'Ridgeway Builders'),
  c('2', 'Ridgeway'),
  c('3', 'Old Ridgeway Homes', '2025-01-01T00:00:00Z'),
  c('4', 'Lee Park'),
  c('5', 'Parker Homes'),
  c('6', 'Park Place'),
  c('7', 'Parkside'),
]
const ID = '11111111-2222-4333-8444-555555555555'

describe('customerTimelineSearchMatches', () => {
  it('names one to three live customers whose name holds the search, the exact name first', () => {
    expect(customerTimelineSearchMatches('ridgeway', customers).map((x) => x.id)).toEqual(['2', '1'])
    expect(customerTimelineSearchMatches('  Ridgeway   Builders ', customers).map((x) => x.id)).toEqual(['1'])
    expect(customerTimelineSearchMatches('lee park', customers).map((x) => x.id)).toEqual(['4'])
  })

  it('stays quiet on a short search, a broad one, or one that names nobody', () => {
    expect(customerTimelineSearchMatches('ri', customers)).toEqual([])
    expect(customerTimelineSearchMatches('park', customers)).toEqual([])
    expect(customerTimelineSearchMatches('zzz', customers)).toEqual([])
  })
})

describe('the timeline link', () => {
  it('opens on the Pipeline, or keeps the page it is given', () => {
    expect(customerTimelineHref(ID)).toBe(`/jobs?tab=stages&${CUSTOMER_TIMELINE_PARAM}=${ID}`)
    expect(customerTimelineHref(ID, '/customers', '')).toBe(`/customers?${CUSTOMER_TIMELINE_PARAM}=${ID}`)
  })

  it('reads the customer once and strips it from the address', () => {
    expect(readCustomerTimelineParam(`?tab=stages&${CUSTOMER_TIMELINE_PARAM}=${ID}`)).toEqual({ customerId: ID, nextSearch: '?tab=stages' })
    expect(readCustomerTimelineParam(`?${CUSTOMER_TIMELINE_PARAM}=${ID}`)).toEqual({ customerId: ID, nextSearch: '' })
    expect(readCustomerTimelineParam(`?${CUSTOMER_TIMELINE_PARAM}=not-a-customer`)).toEqual({ customerId: null, nextSearch: '' })
    expect(readCustomerTimelineParam('?tab=stages')).toBeNull()
  })
})
