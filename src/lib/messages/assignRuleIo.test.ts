import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import { DatabaseError } from '../../utils/errorHandling'
import { SEATS_NOT_SAVED } from './assignRule'
import { supabaseAssignRuleIo } from './assignRuleIo'

vi.mock('../supabase', () => ({ supabase: {} }))

const ROSA = '00000000-0000-4000-8000-0000000000a1'

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose queries record their calls and resolve with the result for their table, or the update's. */
function fakeClient(results: { setting?: Result; users?: Result; update?: Result }) {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      let updating = false
      const result = (): Result => (updating ? results.update : table === 'users' ? results.users : results.setting) ?? { data: null, error: null }
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order']) {
        chain[m] = (...args: unknown[]) => {
          calls.push([m, ...args])
          return chain
        }
      }
      chain.update = (row: unknown) => {
        calls.push(['update', row])
        updating = true
        return chain
      }
      chain.maybeSingle = () => {
        calls.push(['maybeSingle'])
        return Promise.resolve(result())
      }
      chain.then = (ok: (r: Result) => unknown, no: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, no)
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

describe('supabaseAssignRuleIo', () => {
  it('reads the seats and the office team', async () => {
    const { client, calls } = fakeClient({
      setting: { data: { value_text: `{"customer":"${ROSA}","trade":null,"arch":null}` }, error: null },
      users: { data: [{ id: ROSA, name: 'Rosa', role: 'assistant' }, { id: 'u2', name: null, role: null }], error: null },
    })
    await expect(supabaseAssignRuleIo(client).load()).resolves.toEqual({
      seats: { customer: ROSA, trade: null, arch: null },
      team: [
        { id: ROSA, name: 'Rosa', role: 'assistant' },
        { id: 'u2', name: '', role: '' },
      ],
    })
    expect(calls).toContainEqual(['eq', 'key', 'messages_assign_rule_v1'])
    expect(calls).toContainEqual(['in', 'role', ['dev', 'master_technician', 'assistant', 'controller', 'estimator']])
  })

  it('reads empty seats when the setting is not there yet', async () => {
    const { client } = fakeClient({ setting: { data: null, error: null }, users: { data: [], error: null } })
    await expect(supabaseAssignRuleIo(client).load()).resolves.toEqual({ seats: { customer: null, trade: null, arch: null }, team: [] })
  })

  it('saves the three seats on the one row', async () => {
    const { client, calls } = fakeClient({ update: { data: [{ key: 'messages_assign_rule_v1' }], error: null } })
    await supabaseAssignRuleIo(client).save({ customer: ROSA, trade: null, arch: null })
    expect(calls).toEqual([
      ['from', 'app_settings'],
      ['update', { value_text: `{"customer":"${ROSA}","trade":null,"arch":null}` }],
      ['eq', 'key', 'messages_assign_rule_v1'],
      ['select', 'key'],
    ])
  })

  it('says so when the save changed nothing, and keeps a refusal’s words', async () => {
    const none = fakeClient({ update: { data: [], error: null } })
    await expect(supabaseAssignRuleIo(none.client).save({ customer: null, trade: null, arch: null })).rejects.toThrow(SEATS_NOT_SAVED)
    const refused = fakeClient({ update: { data: null, error: { message: 'permission denied for table app_settings', code: '42501' } } })
    await expect(supabaseAssignRuleIo(refused.client).save({ customer: null, trade: null, arch: null })).rejects.toBeInstanceOf(DatabaseError)
  })
})
