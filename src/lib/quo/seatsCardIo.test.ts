import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import { DatabaseError } from '../../utils/errorHandling'
import { SEATS_NOT_SAVED } from '../messages/assignRule'
import { supabaseQuoSeatsIo } from './seatsCardIo'

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

describe('the company phone seats’ read and write', () => {
  it('reads the row and the office team', async () => {
    const { client, calls } = fakeClient({
      setting: { data: { value_text: `{"USrosa2": "${ROSA}"}` }, error: null },
      users: { data: [{ id: ROSA, name: 'Rosa', role: 'assistant' }], error: null },
    })
    const read = await supabaseQuoSeatsIo(client).load()
    expect(read.seats).toEqual([{ quoUserId: 'USrosa2', userId: ROSA }])
    expect(read.team).toEqual([{ id: ROSA, name: 'Rosa', role: 'assistant' }])
    expect(calls).toContainEqual(['eq', 'key', 'messages_quo_seats_v1'])
  })

  it('reads no seats from a row not there yet', async () => {
    const { client } = fakeClient({ setting: { data: null, error: null }, users: { data: [], error: null } })
    expect((await supabaseQuoSeatsIo(client).load()).seats).toEqual([])
  })

  it('saves the seats as the functions read them, on its own row', async () => {
    const { client, calls } = fakeClient({ update: { data: [{ key: 'messages_quo_seats_v1' }], error: null } })
    await supabaseQuoSeatsIo(client).save([{ quoUserId: 'USrosa2', userId: ROSA }])
    expect(calls).toContainEqual(['update', { value_text: `{"USrosa2":"${ROSA}"}` }])
    expect(calls).toContainEqual(['eq', 'key', 'messages_quo_seats_v1'])
    expect(calls).toContainEqual(['select', 'key'])
  })

  it('says a save that came back with no row was refused', async () => {
    const { client } = fakeClient({ update: { data: [], error: null } })
    await expect(supabaseQuoSeatsIo(client).save([])).rejects.toThrow(SEATS_NOT_SAVED)
  })

  it('rejects a failed read with the database’s error', async () => {
    const { client } = fakeClient({ setting: { data: null, error: { message: 'offline', code: '08006' } }, users: { data: [], error: null } })
    await expect(supabaseQuoSeatsIo(client).load()).rejects.toBeInstanceOf(DatabaseError)
  })
})
