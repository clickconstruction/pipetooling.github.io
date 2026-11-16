import { afterEach, describe, expect, it, vi } from 'vitest'

/** The tables the read asks, by name, and the function's answer; made-up ZZ Test rows. */
const TABLES: Record<string, unknown> = {}
let rpcAnswer: { data: unknown; error: unknown } = { data: { ok: true, answer: 'public', jobs: [] }, error: null }
const rpcCalls: Array<{ name: string; args: unknown }> = []
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'is', 'order']) chain[m] = () => chain
      chain.maybeSingle = () => Promise.resolve({ data: TABLES[table] ?? null, error: null })
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: TABLES[table] ?? [], error: null })
      return chain
    },
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args })
      return Promise.resolve(rpcAnswer)
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

const { lienPublicOwnerName, readLienPublicProperty, setLienPublicAnswer } = await import('./lienPublicPropertyIo')

afterEach(() => {
  for (const k of Object.keys(TABLES)) delete TABLES[k]
  rpcCalls.length = 0
  rpcAnswer = { data: { ok: true, answer: 'public', jobs: [] }, error: null }
})

describe('readLienPublicProperty', () => {
  it('reads the record and every job at it, each with its money by the desk’s rule, its status, its bond, its GC and its papers', async () => {
    TABLES.customer_addresses = { id: 'addr-1', address: '100 Sample Rd, Sampletown', owner_name: 'ZZ TEST CITY OF', owner_company: 'ATTN REAL ESTATE MANAGER', lien_public_answer: null }
    TABLES.jobs_ledger = [
      { id: 'j883', hcp_number: '883', click_number: null, job_name: 'ZZ Test Drains', status: 'billed', revenue: 2918.4, payments_made: 0, gc_customer_id: 'gc-1', lien_payment_bond: 'unknown', collections_at: null },
      { id: 'j523', hcp_number: '523', click_number: null, job_name: 'ZZ Test Hills', status: 'working', revenue: 40000, payments_made: 0, gc_customer_id: 'gc-1', lien_payment_bond: 'yes', collections_at: '2026-11-16T18:00:00Z' },
    ]
    TABLES.jobs_ledger_invoices = [
      { id: 'i1', job_id: 'j883', status: 'billed', amount: 2918.4, sequence_order: 1, billed_at: '2026-09-01' },
      { id: 'i2', job_id: 'j523', status: 'billed', amount: 29323.4, sequence_order: 1, billed_at: '2026-09-01' },
    ]
    TABLES.jobs_ledger_payments = []
    TABLES.job_lien_desk_items = [{ job_id: 'j883', kind: 'notice_53_056', status: 'sent', months: ['2026-08'], sent_at: '2026-10-08T15:00:00Z', approved_at: null, voided_at: null }]
    TABLES.customers = [{ id: 'gc-1', name: 'ZZ Test Builders' }]
    const read = await readLienPublicProperty('addr-1')
    expect(read).toMatchObject({ addressId: 'addr-1', address: '100 Sample Rd, Sampletown', ownerName: 'ZZ TEST CITY OF', answer: null, answeredAt: null, reason: '' })
    expect(read.jobs.map((j) => [j.number, j.status, j.unpaid, j.bond, j.attorneySince, j.gcName, j.papers.length])).toEqual([
      ['883', 'billed', 2918.4, 'unknown', null, 'ZZ Test Builders', 1],
      ['523', 'working', 29323.4, 'yes', '2026-11-16T18:00:00Z', 'ZZ Test Builders', 0],
    ])
  })

  it('says so when the record cannot be read', async () => {
    await expect(readLienPublicProperty('addr-missing')).rejects.toThrow('The property record could not be read.')
  })

  it('names the owner, never an attention line', () => {
    expect(lienPublicOwnerName({ owner_name: 'ATTN REAL ESTATE MANAGER', owner_company: 'ZZ TEST CITY OF' })).toBe('ZZ TEST CITY OF')
    expect(lienPublicOwnerName({ owner_name: ' ', owner_company: '' })).toBe('')
  })
})

describe('setLienPublicAnswer', () => {
  it('hands the function the answer, the trimmed reason, the jobs and the bond, and reads back each job’s line', async () => {
    rpcAnswer = { data: { ok: true, answer: 'public', jobs: [{ job_id: 'j883', bond_set: true, on_attorney_list: true, already_on_list: false, held: null }] }, error: null }
    const res = await setLienPublicAnswer({ addressId: 'addr-1', answer: 'public', reason: '  City land.  ', jobs: [{ job_id: 'j883', note: 'City land. A lien notice was mailed Oct 8.' }], bond: 'no' })
    expect(rpcCalls).toEqual([
      { name: 'set_property_lien_public_answer', args: { p_address_id: 'addr-1', p_answer: 'public', p_reason: 'City land.', p_jobs: [{ job_id: 'j883', note: 'City land. A lien notice was mailed Oct 8.' }], p_payment_bond: 'no' } },
    ])
    expect(res).toEqual({ answer: 'public', jobs: [{ job_id: 'j883', bond_set: true, on_attorney_list: true, already_on_list: false, held: null }] })
  })

  it('sends no reason, no jobs and no bond when none is given', async () => {
    rpcAnswer = { data: { ok: true, answer: 'private', jobs: [] }, error: null }
    expect(await setLienPublicAnswer({ addressId: 'addr-1', answer: 'private' })).toEqual({ answer: 'private', jobs: [] })
    expect(rpcCalls[0]!.args).toEqual({ p_address_id: 'addr-1', p_answer: 'private', p_reason: null, p_jobs: [], p_payment_bond: null })
  })

  it('throws the function’s own words when it refuses', async () => {
    rpcAnswer = { data: { error: 'Not authorized to answer the public property question' }, error: null }
    await expect(setLienPublicAnswer({ addressId: 'addr-1', answer: 'private' })).rejects.toThrow('Not authorized to answer the public property question')
    rpcAnswer = { data: null, error: { message: 'Read-only (training) mode: changes are blocked.' } }
    await expect(setLienPublicAnswer({ addressId: 'addr-1', answer: 'private' })).rejects.toMatchObject({ message: 'Read-only (training) mode: changes are blocked.' })
  })
})
