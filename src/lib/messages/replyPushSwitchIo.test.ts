import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import { DatabaseError } from '../../utils/errorHandling'
import { OFFICE_WAIT_NOT_SAVED, REPLY_PUSH_NOT_SAVED } from './replyPushSwitch'
import { supabaseReplyPushSwitchIo } from './replyPushSwitchIo'

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
      for (const m of ['select', 'eq', 'in']) {
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

describe('the reply push switch’s read and writes (v2.5540)', () => {
  it('reads the switch and the office’s wait from their two rows', async () => {
    const { client, calls } = fakeClient({
      read: { data: [{ key: 'messages_reply_push_on_v1', value_text: 'true', value_num: null }, { key: 'messages_office_wait_minutes', value_text: null, value_num: 30 }], error: null },
    })
    await expect(supabaseReplyPushSwitchIo(client).load()).resolves.toEqual({ on: true, waitMinutes: 30 })
    expect(calls).toContainEqual(['in', 'key', ['messages_reply_push_on_v1', 'messages_office_wait_minutes']])
  })

  it('reads off and the default wait when the rows are not there yet', async () => {
    const { client } = fakeClient({ read: { data: [], error: null } })
    await expect(supabaseReplyPushSwitchIo(client).load()).resolves.toEqual({ on: false, waitMinutes: 15 })
  })

  it('writes the switch and the wait each on its own row', async () => {
    const on = fakeClient({ update: { data: [{ key: 'messages_reply_push_on_v1' }], error: null } })
    await supabaseReplyPushSwitchIo(on.client).setOn(true)
    expect(on.calls).toContainEqual(['update', { value_text: 'true' }])
    expect(on.calls).toContainEqual(['eq', 'key', 'messages_reply_push_on_v1'])

    const wait = fakeClient({ update: { data: [{ key: 'messages_office_wait_minutes' }], error: null } })
    await supabaseReplyPushSwitchIo(wait.client).setWait(0)
    expect(wait.calls).toContainEqual(['update', { value_num: 0 }])
    expect(wait.calls).toContainEqual(['eq', 'key', 'messages_office_wait_minutes'])
  })

  it('says so when a write changed nothing, and keeps a refusal’s words', async () => {
    const none = fakeClient({ update: { data: [], error: null } })
    await expect(supabaseReplyPushSwitchIo(none.client).setOn(false)).rejects.toThrow(REPLY_PUSH_NOT_SAVED)
    await expect(supabaseReplyPushSwitchIo(none.client).setWait(5)).rejects.toThrow(OFFICE_WAIT_NOT_SAVED)
    const refused = fakeClient({ update: { data: null, error: { message: 'permission denied for table app_settings', code: '42501' } } })
    await expect(supabaseReplyPushSwitchIo(refused.client).setWait(5)).rejects.toBeInstanceOf(DatabaseError)
  })
})
