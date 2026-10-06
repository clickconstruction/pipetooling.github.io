import { describe, expect, it } from 'vitest'
import { propertyKindFollowWords, propertyKindHint, propertyKindRows, unpaidStage, type PropertyKindQueueJob } from './propertyKinds'

function job(over: Partial<PropertyKindQueueJob> & { id: string }): PropertyKindQueueJob {
  return {
    status: 'working',
    collections_at: null,
    customer_id: 'c1',
    gc_customer_id: null,
    customer_name: 'Dudley Mason',
    gc_name: null,
    customer_address_id: null,
    job_address: '2210 Hunt Lane, San Antonio, TX 78245',
    job_number: '1388',
    job_name: 'Slab leak, kitchen',
    open_balance: 0,
    ...over,
  }
}

describe('unpaidStage', () => {
  it('names the five unpaid stages and drops paid', () => {
    expect(unpaidStage({ status: 'waiting', collections_at: null })).toBe('Waiting')
    expect(unpaidStage({ status: null, collections_at: null })).toBe('Working')
    expect(unpaidStage({ status: 'ready_to_bill', collections_at: null })).toBe('Ready to Bill')
    expect(unpaidStage({ status: 'billed', collections_at: null })).toBe('Billed')
    expect(unpaidStage({ status: 'billed', collections_at: '2026-10-01T00:00:00Z' })).toBe('Collections')
    expect(unpaidStage({ status: 'paid', collections_at: null })).toBeNull()
  })
})

describe('propertyKindHint', () => {
  it('a GC on the job wins, then the customer type, then a word', () => {
    expect(propertyKindHint({ gcOnJob: true, customerType: 'residential', words: 'house' })).toEqual({ kind: 'non_residential', why: 'a GC on the job' })
    expect(propertyKindHint({ gcOnJob: false, customerType: 'Commercial', words: 'house' })?.kind).toBe('non_residential')
    expect(propertyKindHint({ gcOnJob: false, customerType: 'residential', words: 'Suite B' })).toEqual({ kind: 'residential', why: 'a homeowner account' })
    expect(propertyKindHint({ gcOnJob: false, customerType: null, words: '1402 · Tenant finish-out' })).toEqual({ kind: 'non_residential', why: '“Tenant” in the job\'s name' })
    expect(propertyKindHint({ gcOnJob: false, customerType: '', words: 'Water heater, house' })?.kind).toBe('residential')
    expect(propertyKindHint({ gcOnJob: false, customerType: null, words: 'Water heater swap' })).toBeNull()
  })
})

describe('propertyKindRows', () => {
  it('is loading until the kinds are read', () => {
    expect(propertyKindRows([job({ id: 'a' })], null, new Map())).toEqual({ rows: [], noCustomerCount: 0, loading: true })
  })

  it('one row per saved property, the jobs under it, marked and paid jobs left out', () => {
    const jobs = [
      job({ id: 'a', customer_address_id: 'p1', job_number: '1211', job_name: 'Suite B rough-in', status: 'billed', open_balance: 18420 }),
      job({ id: 'b', customer_address_id: 'p1', job_number: '1240', job_name: 'Suite C top-out', status: 'billed', open_balance: 9110 }),
      job({ id: 'c', customer_address_id: 'p2', job_number: '1300', status: 'paid' }),
      job({ id: 'd', customer_address_id: 'p3', job_number: '1301' }),
    ]
    const kinds = new Map([
      ['a', ''],
      ['b', ''],
      ['c', ''],
      ['d', 'residential'],
    ])
    const { rows, noCustomerCount, loading } = propertyKindRows(jobs, kinds, new Map())
    expect(loading).toBe(false)
    expect(noCustomerCount).toBe(0)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.key).toBe('addr:p1')
    expect(rows[0]?.jobs.map((j) => j.label)).toEqual(['1211 · Suite B rough-in', '1240 · Suite C top-out'])
    expect(rows[0]?.lienClock).toBe(true)
    expect(rows[0]?.openBalance).toBe(27530)
  })

  it('jobs with a typed address only group by customer and address; no customer and no GC is counted at the foot', () => {
    const jobs = [
      job({ id: 'a', job_address: '14110 Nacogdoches Rd' }),
      job({ id: 'b', job_address: ' 14110  Nacogdoches Rd ' }),
      job({ id: 'c', customer_id: 'c2', job_address: '14110 Nacogdoches Rd' }),
      job({ id: 'd', customer_id: null, gc_customer_id: null }),
    ]
    const kinds = new Map([
      ['a', ''],
      ['b', ''],
      ['c', ''],
    ])
    const { rows, noCustomerCount } = propertyKindRows(jobs, kinds, new Map())
    expect(noCustomerCount).toBe(1)
    expect(rows.map((r) => r.key)).toEqual(['typed:c1:14110 nacogdoches rd', 'typed:c2:14110 nacogdoches rd'])
    expect(rows[0]?.customerAddressId).toBeNull()
    expect(rows[0]?.jobs).toHaveLength(2)
  })

  it('a GC job with no customer keeps the property on the GC', () => {
    const jobs = [job({ id: 'a', customer_id: null, gc_customer_id: 'gc1', customer_name: null, gc_name: 'Ventana Builders' })]
    const { rows, noCustomerCount } = propertyKindRows(jobs, new Map([['a', '']]), new Map())
    expect(noCustomerCount).toBe(0)
    expect(rows[0]?.customerId).toBe('gc1')
    expect(rows[0]?.customerName).toBe('Ventana Builders')
    expect(rows[0]?.hint).toEqual({ kind: 'non_residential', why: 'a GC on the job' })
  })

  it('lien-clock rows first, then the biggest balance, then the address; the hint reads the customer type', () => {
    const jobs = [
      job({ id: 'w', customer_address_id: 'p1', job_address: 'A St', status: 'working' }),
      job({ id: 'b1', customer_address_id: 'p2', job_address: 'Z St', status: 'billed', open_balance: 100, customer_id: 'c9' }),
      job({ id: 'b2', customer_address_id: 'p3', job_address: 'B St', status: 'billed', collections_at: '2026-10-01', open_balance: 5000 }),
      job({ id: 'r', customer_address_id: 'p4', job_address: '0 St', status: 'ready_to_bill' }),
    ]
    const kinds = new Map(jobs.map((j) => [j.id, '']))
    const { rows } = propertyKindRows(jobs, kinds, new Map([['c9', 'commercial']]))
    expect(rows.map((r) => r.key)).toEqual(['addr:p3', 'addr:p2', 'addr:p4', 'addr:p1'])
    expect(rows[1]?.hint).toEqual({ kind: 'non_residential', why: 'a commercial account' })
    expect(rows[3]?.hint).toBeNull()
  })
})

describe('propertyKindFollowWords', () => {
  it('names the jobs a pick carries', () => {
    const j = (label: string) => ({ id: label, label, stage: 'Working' as const, openBalance: 0 })
    expect(propertyKindFollowWords([j('863 · Bath')])).toBe('863')
    expect(propertyKindFollowWords([j('1211 · A'), j('1240 · B')])).toBe('1211 and 1240')
    expect(propertyKindFollowWords([j('863 · A'), j('870 · B'), j('871 · C')])).toBe('863 and 2 other jobs')
  })
})
