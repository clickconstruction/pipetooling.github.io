import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import { DatabaseError } from '../../utils/errorHandling'
import { OFFICE_HOURS } from './hasRule'
import { OFFICE_HOURS_WORDS } from './officeHoursCard'
import { supabaseOfficeHoursIo } from './officeHoursCardIo'

vi.mock('../supabase', () => ({ supabase: {} }))

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose queries record their calls and resolve with the read's result, or the update's. */
function fakeClient(results: { read?: Result; update?: Result }) {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      let updating = false
      const result = (): Result => (updating ? results.update : results.read) ?? { data: null, error: null }
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'maybeSingle']) {
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
      chain.then = (ok: (r: Result) => unknown, no: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, no)
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

const SAVED = '{"days":[1,2,3,4,5],"opens":"08:00","closes":"16:00","techUntil":"17:00","emergency":null,"savedAt":"2026-10-21T15:00:00.000Z"}'

describe('the Office hours card’s read and write (punch list #140 PR 1)', () => {
  it('reads the hours from their row and keeps the row’s own text', async () => {
    const { client, calls } = fakeClient({ read: { data: { value_text: SAVED }, error: null } })
    await expect(supabaseOfficeHoursIo(client).load()).resolves.toEqual({
      hours: { days: [1, 2, 3, 4, 5], opens: '08:00', closes: '16:00', techUntil: '17:00', emergency: null },
      raw: SAVED,
    })
    expect(calls).toContainEqual(['eq', 'key', 'messages_office_hours_v1'])
    expect(calls).toContainEqual(['maybeSingle'])
  })

  it('reads the defaults when the row is not there, and says so with a null text', async () => {
    const { client } = fakeClient({ read: { data: null, error: null } })
    await expect(supabaseOfficeHoursIo(client).load()).resolves.toEqual({ hours: OFFICE_HOURS, raw: null })
  })

  it('writes the row and nothing else', async () => {
    const { client, calls } = fakeClient({ update: { data: [{ key: 'messages_office_hours_v1' }], error: null } })
    await supabaseOfficeHoursIo(client).save(SAVED)
    expect(calls).toContainEqual(['update', { value_text: SAVED }])
    expect(calls).toContainEqual(['eq', 'key', 'messages_office_hours_v1'])
    expect(calls.filter((c) => c[0] === 'from')).toEqual([['from', 'app_settings']])
  })

  it('says so when the write changed nothing, and keeps a refusal’s words', async () => {
    const none = fakeClient({ update: { data: [], error: null } })
    await expect(supabaseOfficeHoursIo(none.client).save(SAVED)).rejects.toThrow(OFFICE_HOURS_WORDS.notSaved)
    const refused = fakeClient({ update: { data: null, error: { message: 'permission denied for table app_settings', code: '42501' } } })
    await expect(supabaseOfficeHoursIo(refused.client).save(SAVED)).rejects.toBeInstanceOf(DatabaseError)
  })
})
