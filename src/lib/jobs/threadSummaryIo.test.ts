import { describe, expect, it, vi } from 'vitest'

/**
 * The Where it stands card's reads (v2.5973): with no line tied to the job, the customer's people still come from the
 * job's customer (their own contact and the contacts of the people at that customer), so a promise or a debt on their
 * thread is read. A failed extra read leaves the lines' people alone. The client is a fake that records each read.
 */
vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../messages/messagesIo', () => ({ loadJobMessages: vi.fn(async () => []) }))

import { loadThreadSummaryFacts } from './threadSummaryIo'

type Row = Record<string, unknown>

/** A fake client: each table answers the rows given, and every filter is recorded. */
function fakeDb(tables: Record<string, Row[] | 'fails'>) {
  const calls: string[] = []
  const from = (table: string) => {
    const filters: string[] = []
    const answer = () => {
      calls.push(`${table}${filters.length ? ' ' + filters.join(' ') : ''}`)
      const rows = tables[table]
      if (rows === 'fails') return Promise.reject(new Error(`${table} refused`))
      return Promise.resolve({ data: rows ?? [], error: null })
    }
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (filters.push(`${c}=${String(v)}`), q),
      in: (c: string, v: unknown[]) => (filters.push(`${c} in ${v.join(',')}`), q),
      is: (c: string, v: unknown) => (filters.push(`${c} is ${String(v)}`), q),
      gte: (c: string, v: unknown) => (filters.push(`${c}>=${String(v)}`), q),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => answer().then(ok, bad),
    }
    return q
  }
  return { client: { from }, calls }
}

const JOB = { id: 'j-1104', status: 'working', createdAt: '2026-10-01T00:00:00Z', customerId: 'cust-dana' }

describe('loadThreadSummaryFacts', () => {
  it('reads what we owe and the promises of the customer’s own contact and its people’s, with no line on the job', async () => {
    const { client, calls } = fakeDb({
      contacts: [{ id: 'c-dana' }],
      customer_contact_persons: [{ id: 'p-sam' }],
      contact_owed: [{ id: 'o1', contact_id: 'c-dana' }],
      message_promises: [],
    })
    const facts = await loadThreadSummaryFacts(JOB, '2026-10-27', client)
    expect(facts.people.sort()).toEqual(['c-dana'])
    expect(facts.owed).toEqual([{ id: 'o1', contact_id: 'c-dana' }])
    expect(calls).toContain('contacts customer_id=cust-dana')
    expect(calls).toContain('customer_contact_persons customer_id=cust-dana')
    expect(calls).toContain('contacts customer_contact_person_id in p-sam')
    expect(calls.find((c) => c.startsWith('contact_owed'))).toBe('contact_owed contact_id in c-dana done_at is null')
  })

  it('reads nothing more when the job has no customer and no line', async () => {
    const { client, calls } = fakeDb({})
    const facts = await loadThreadSummaryFacts({ ...JOB, customerId: null }, '2026-10-27', client)
    expect(facts).toEqual({ lines: [], owed: [], promises: [], people: [] })
    expect(calls).toEqual([])
  })

  it('fails soft when the customer’s people cannot be read', async () => {
    const { client } = fakeDb({ contacts: 'fails', customer_contact_persons: 'fails' })
    const facts = await loadThreadSummaryFacts(JOB, '2026-10-27', client)
    expect(facts.people).toEqual([])
    expect(facts.owed).toEqual([])
  })
})
