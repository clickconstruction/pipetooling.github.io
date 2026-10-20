/**
 * The call log's one write (`logGcAskContact`): a line on an ask, or since the Board's B2b-iv a line of the company's
 * own, logged on its window's Activity, with no ask. And since B2b-v-ii a customer's line (`logGcCustomerContact`), with the
 * job it was about since B2b-viii-a, and a day a company gave for a paper (`recordGcTradePromise`). The client is a stub that
 * keeps what each insert and call sent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent = vi.hoisted(() => ({ rows: [] as { table: string; row: Record<string, unknown> }[], rpcs: [] as { fn: string; args: Record<string, unknown> }[] }))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        sent.rows.push({ table, row })
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'n9' }, error: null }) }) }
      },
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      sent.rpcs.push({ fn, args })
      return Promise.resolve({ data: 'pr9', error: null })
    },
  },
}))

import { logGcAskContact, logGcCustomerContact, recordGcTradePromise } from './gcIo'

beforeEach(() => {
  sent.rows.length = 0
  sent.rpcs.length = 0
})

describe('logGcAskContact', () => {
  it('logs a line of the company’s own with no ask', async () => {
    await logGcAskContact({ companyId: 'hillside', inviteId: null, on: '2026-10-10', byName: 'Rosa', how: 'text', note: 'Crew free from the 20th.', promisedBy: null })
    expect(sent.rows).toEqual([
      { table: 'gc_company_contacts', row: { company_id: 'hillside', invite_id: null, contacted_on: '2026-10-10', by_name: 'Rosa', how: 'text', note: 'Crew free from the 20th.', promised_by: null } },
    ])
  })

  it('still logs a line on an ask with the day they promised', async () => {
    await logGcAskContact({ companyId: 'hillside', inviteId: 'i2', on: '2026-10-10', byName: 'Rosa', how: 'call', note: 'Quote by Monday.', promisedBy: '2026-10-12' })
    expect(sent.rows[0]?.row).toMatchObject({ invite_id: 'i2', promised_by: '2026-10-12' })
  })
})

describe('logGcCustomerContact (the Board’s B2b-v-ii)', () => {
  it('logs a line in the customer’s call log, leaving who logged it to the sign-in', async () => {
    await logGcCustomerContact({ customerId: 'c1', on: '2026-10-10', byName: 'Rosa', how: 'call', note: 'They will sign Monday.' })
    expect(sent.rows).toEqual([{ table: 'gc_customer_contacts', row: { customer_id: 'c1', contacted_on: '2026-10-10', by_name: 'Rosa', how: 'call', note: 'They will sign Monday.' } }])
  })

  it('names the job it was about, when it was about one (B2b-viii-a)', async () => {
    await logGcCustomerContact({ customerId: 'c1', projectId: 'p1', on: '2026-10-10', byName: 'Rosa', how: 'text', note: 'Texted about pay application 3.' })
    expect(sent.rows[0]?.row).toMatchObject({ customer_id: 'c1', project_id: 'p1' })
  })
})

describe('recordGcTradePromise (the Board’s B2b-viii-a)', () => {
  it('writes the day down through gc_record_promise, by the office, with what it is', async () => {
    expect(await recordGcTradePromise({ companyId: 'pecanvalley', kind: 'closeout', projectId: 'fairoaksd', packageId: 'felec', dueOn: '2026-10-08', what: 'the waiver for draw 1' })).toBe('pr9')
    expect(sent.rpcs).toEqual([
      { fn: 'gc_record_promise', args: { p: { companyId: 'pecanvalley', kind: 'closeout', dueOn: '2026-10-08', source: 'office', what: 'the waiver for draw 1', projectId: 'fairoaksd', packageId: 'felec' } } },
    ])
  })

  it('leaves the job and trade out for a paper about the company itself', async () => {
    await recordGcTradePromise({ companyId: 'pecanvalley', kind: 'insurance', projectId: null, packageId: null, dueOn: '2026-10-08', what: 'your insurance certificate' })
    expect(sent.rpcs[0]?.args).toEqual({ p: { companyId: 'pecanvalley', kind: 'insurance', dueOn: '2026-10-08', source: 'office', what: 'your insurance certificate' } })
  })
})
