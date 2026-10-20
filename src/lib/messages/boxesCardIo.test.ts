import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import { BOXES_NOT_SAVED, EMPTY_BOXES } from './boxesCard'
import { supabaseBoxesCardIo } from './boxesCardIo'

vi.mock('../supabase', () => ({ supabase: {} }))

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose queries record their calls and resolve with the read's result, or the update's. */
function fakeClient(results: { setting?: Result; update?: Result }) {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      let updating = false
      const result = (): Result => (updating ? results.update : results.setting) ?? { data: null, error: null }
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) {
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

describe('the Inboxes card’s read and write', () => {
  it('reads the boxes row, and a row not there reads as every field empty', async () => {
    const { client, calls } = fakeClient({ setting: { data: { value_text: '{"team":{"address":"team@plumbing.example","phone":"","numberId":""}}' }, error: null } })
    const read = await supabaseBoxesCardIo(client).load()
    expect(read.team.address).toBe('team@plumbing.example')
    expect(read.bids).toEqual({ address: '', phone: '', numberId: '' })
    expect(calls).toContainEqual(['from', 'app_settings'])
    expect(calls).toContainEqual(['eq', 'key', 'messages_boxes_v1'])
    const none = fakeClient({ setting: { data: null, error: null } })
    expect(await supabaseBoxesCardIo(none.client).load()).toEqual(EMPTY_BOXES)
  })

  it('saves the cleaned row by its key and asks for the row back', async () => {
    const { client, calls } = fakeClient({ update: { data: [{ key: 'messages_boxes_v1' }], error: null } })
    await supabaseBoxesCardIo(client).save({ team: { address: ' team@plumbing.example ', phone: '5125550144', numberId: ' PNteam01 ' }, bids: { address: '', phone: '', numberId: '' } })
    expect(calls).toContainEqual([
      'update',
      { value_text: '{"team":{"address":"team@plumbing.example","phone":"(512) 555-0144","numberId":"PNteam01"},"bids":{"address":"","phone":"","numberId":""}}' },
    ])
    expect(calls).toContainEqual(['eq', 'key', 'messages_boxes_v1'])
    expect(calls).toContainEqual(['select', 'key'])
  })

  it('says a save that came back with no row was refused', async () => {
    const { client } = fakeClient({ update: { data: [], error: null } })
    await expect(supabaseBoxesCardIo(client).save(EMPTY_BOXES)).rejects.toThrow(BOXES_NOT_SAVED)
  })

  it('a read that fails says so', async () => {
    const { client } = fakeClient({ setting: { data: null, error: { message: 'permission denied' } } })
    await expect(supabaseBoxesCardIo(client).load()).rejects.toThrow()
  })
})
