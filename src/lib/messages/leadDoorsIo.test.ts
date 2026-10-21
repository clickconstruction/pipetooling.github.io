import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import { DatabaseError } from '../../utils/errorHandling'
import { leadFacts } from './leadDoors'
import { supabaseLeadDoorsIo } from './leadDoorsIo'

vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../companyOwner', () => ({ resolveCompanyOwnerUserId: vi.fn(async () => 'owner-1') }))
vi.mock('../estimateMasterUser', () => ({ resolveEstimateMasterUserId: vi.fn(async () => 'owner-1') }))
const nav = vi.hoisted(() => ({ recordNavClick: vi.fn() }))
vi.mock('../navClickTelemetry', () => nav)

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose inserts record their rows and answer the table's result. */
function fakeClient(answers: Record<string, Result>) {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'single']) {
        chain[m] = (...args: unknown[]) => {
          calls.push([m, ...args])
          return chain
        }
      }
      chain.insert = (row: unknown) => {
        calls.push(['insert', table, row])
        return chain
      }
      chain.then = (ok: (r: Result) => unknown, no: (e: unknown) => unknown) => Promise.resolve(answers[table] ?? { data: null, error: null }).then(ok, no)
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

const LENA = leadFacts({ id: 'lena', name: 'Lena Ortiz', channels: [{ id: 'ch1', kind: 'phone', value: '(830) 555-0101' } as never] }, 'Can you come Thursday?')

describe('a lead’s doors: the two writes (punch list #140 PR 8)', () => {
  it('makes the customer, then re-points the thread at them through name_contact, never contact_for_customer', async () => {
    const { client, calls } = fakeClient({ customers: { data: { id: 'cust-1' }, error: null } })
    const name = vi.fn(async () => 'u-rosa')
    await expect(supabaseLeadDoorsIo(client, name).convert('lena', LENA, { userId: 'u-rosa' }, '2026-10-21')).resolves.toEqual({ customerId: 'cust-1' })
    expect(calls).toContainEqual(['insert', 'customers', { name: 'Lena Ortiz', address: null, contact_info: { phone: '(830) 555-0101', email: null }, customer_type: 'residential', date_met: '2026-10-21', master_user_id: 'owner-1' }])
    expect(name).toHaveBeenCalledWith('lena', { record: { table: 'customers', id: 'cust-1' }, kind: 'customer' })
    expect(calls.filter((c) => c[0] === 'from').map((c) => c[1])).toEqual(['customers'])
  })

  it('a refused customer row makes no contact change', async () => {
    const { client } = fakeClient({ customers: { data: null, error: { message: 'new row violates row-level security policy for table "customers"', code: '42501' } } })
    const name = vi.fn(async () => 'u-rosa')
    await expect(supabaseLeadDoorsIo(client, name).convert('lena', LENA, { userId: 'u-rosa' }, '2026-10-21')).rejects.toBeInstanceOf(DatabaseError)
    expect(name).not.toHaveBeenCalled()
  })

  it('starts a draft estimate on the customer, the row the Estimates page makes, and answers its number', async () => {
    const { client, calls } = fakeClient({ estimates: { data: { id: 'e-1', estimate_number: 42 }, error: null } })
    await expect(supabaseLeadDoorsIo(client, vi.fn()).startEstimate('cust-1', { userId: 'u-rosa', role: 'assistant' })).resolves.toEqual({ estimateNumber: 42 })
    const insert = calls.find((c) => c[0] === 'insert' && c[1] === 'estimates')![2] as Record<string, unknown>
    expect(insert).toMatchObject({ master_user_id: 'owner-1', created_by: 'u-rosa', title: '', terms_snapshot: '', total_cents: 0, project_id: null, customer_id: 'cust-1' })
    expect(Array.isArray(insert.line_items_snapshot) && (insert.line_items_snapshot as unknown[]).length).toBe(1)
    expect(nav.recordNavClick).toHaveBeenCalledWith('u-rosa', 'assistant', 'estimate_draft_created', '#lead:estimate')
  })
})
