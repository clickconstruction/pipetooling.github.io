import { describe, expect, it } from 'vitest'
import { computeSimilarCustomersForCreate } from './similarCustomersForCreate'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

let seq = 0
function makeCustomer(p: Partial<Record<string, unknown>> = {}): CustomerRow {
  seq += 1
  return {
    id: `cust-${seq}`,
    name: `Customer ${seq}`,
    address: null,
    contact_info: null,
    date_met: null,
    master_user_id: 'master-1',
    customer_type: 'residential',
    archived_at: null,
    ...p,
  } as unknown as CustomerRow
}

describe('computeSimilarCustomersForCreate', () => {
  it('returns [] for an empty or whitespace name', () => {
    const all = [makeCustomer({ name: 'Alpha Builders' })]
    expect(computeSimilarCustomersForCreate(all, '', 'master-1')).toEqual([])
    expect(computeSimilarCustomersForCreate(all, '   ', 'master-1')).toEqual([])
  })

  it('matches by high similarity and by substring either way', () => {
    const exact = makeCustomer({ name: 'Alpha Builders' })
    const typo = makeCustomer({ name: 'Alpha Bulders' })
    const superstring = makeCustomer({ name: 'Alpha Builders of Austin LLC' })
    const unrelated = makeCustomer({ name: 'Zeta Mechanical' })
    const out = computeSimilarCustomersForCreate([unrelated, superstring, typo, exact], 'Alpha Builders', 'master-1')
    expect(out.map((c) => c.id)).toEqual([exact.id, typo.id, superstring.id])
  })

  it('drops customers owned by a different master — a cross-master pick can never link', () => {
    const mine = makeCustomer({ name: 'Alpha Builders', master_user_id: 'master-1' })
    const other = makeCustomer({ name: 'Alpha Builders', master_user_id: 'master-2' })
    const out = computeSimilarCustomersForCreate([other, mine], 'Alpha Builders', 'master-1')
    expect(out.map((c) => c.id)).toEqual([mine.id])
  })

  it('a null job master skips the ownership filter', () => {
    const a = makeCustomer({ name: 'Alpha Builders', master_user_id: 'master-1' })
    const b = makeCustomer({ name: 'Alpha Builders', master_user_id: 'master-2' })
    const out = computeSimilarCustomersForCreate([a, b], 'Alpha Builders', null)
    expect(out).toHaveLength(2)
  })

  it('caps the list at 10, best first', () => {
    const rows = Array.from({ length: 12 }, (_, i) => makeCustomer({ name: `Alpha Builders ${i}` }))
    const out = computeSimilarCustomersForCreate(rows, 'Alpha Builders', 'master-1')
    expect(out).toHaveLength(10)
  })

  it('tolerates null customer names', () => {
    const named = makeCustomer({ name: 'Alpha Builders' })
    const unnamed = makeCustomer({ name: null })
    const out = computeSimilarCustomersForCreate([unnamed, named], 'Alpha Builders', 'master-1')
    expect(out.map((c) => c.id)).toEqual([named.id])
  })
})
