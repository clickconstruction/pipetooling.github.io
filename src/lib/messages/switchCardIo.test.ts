import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import { DatabaseError } from '../../utils/errorHandling'
import { supabaseSwitchCardIo } from './switchCardIo'

vi.mock('../supabase', () => ({ supabase: {} }))

type Result = { data: unknown; error: { message: string; code?: string } | null }

function fakeClient(read: Result) {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'in']) {
        chain[m] = (...args: unknown[]) => {
          calls.push([m, ...args])
          return chain
        }
      }
      chain.then = (ok: (r: Result) => unknown, no: (e: unknown) => unknown) => Promise.resolve(read).then(ok, no)
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

describe('the switch card’s read (punch list #140 PR 2)', () => {
  it('reads the eight rows in one select and keys them by their setting', async () => {
    const { client, calls } = fakeClient({ data: [{ key: 'messages_texts_on_v1', value_text: 'true', value_num: null }, { key: 'messages_office_wait_minutes', value_text: null, value_num: 15 }], error: null })
    await expect(supabaseSwitchCardIo(client).load()).resolves.toEqual({ messages_texts_on_v1: { value_text: 'true', value_num: null }, messages_office_wait_minutes: { value_text: null, value_num: 15 } })
    expect(calls).toContainEqual(['select', 'key, value_text, value_num'])
    const keys = calls.find((c) => c[0] === 'in')![2] as string[]
    expect(keys).toHaveLength(8)
    expect(keys).toContain('messages_office_hours_v1')
    expect(calls.filter((c) => c[0] === 'from')).toEqual([['from', 'app_settings']])
  })

  it('answers nothing for rows that are not there, and keeps a refusal’s words', async () => {
    await expect(supabaseSwitchCardIo(fakeClient({ data: [], error: null }).client).load()).resolves.toEqual({})
    await expect(supabaseSwitchCardIo(fakeClient({ data: null, error: { message: 'permission denied for table app_settings', code: '42501' } }).client).load()).rejects.toBeInstanceOf(DatabaseError)
  })
})
