import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../types/database'
import { DatabaseError } from '../../utils/errorHandling'
import { APP_SENDS_NOT_SAVED } from './appSends'
import { supabaseAppSendsIo } from './appSendsIo'

vi.mock('../supabase', () => ({ supabase: {} }))

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose queries record their calls and resolve with the result for their table, or the update's. */
function fakeClient(results: { settings?: Result; replies?: Result; now?: Result; update?: Result }) {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      let updating = false
      let single = false
      const result = (): Result =>
        (updating ? results.update : table === 'quick_replies' ? results.replies : single ? results.now : results.settings) ?? { data: null, error: null }
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
      chain.maybeSingle = () => {
        calls.push(['maybeSingle'])
        single = true
        return Promise.resolve(result())
      }
      chain.then = (ok: (r: Result) => unknown, no: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, no)
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

const summary = JSON.stringify({ at: '2026-10-13T14:00:00.000Z', dry: false, sent: 0, kept: { off: 11 }, words: ['No text went.'] })

describe('supabaseAppSendsIo', () => {
  it('reads the switch, the newest run and the team’s quick replies', async () => {
    const { client, calls } = fakeClient({
      settings: {
        data: [
          { key: 'messages_nudge_app_sends_v1', value_text: '{"trade":{"portal":true}}' },
          { key: 'messages_nudge_last_run_v1', value_text: summary },
        ],
        error: null,
      },
      replies: {
        data: [
          { id: 'q1', text: 'Did the invite reach you?', for_kind: 'trade', step_key: 'portal', scope: 'team', added_by: null, added_at: '2026-10-01T00:00:00Z', removed_at: null },
          { id: 'q2', text: 'Mine only.', for_kind: 'trade', step_key: 'portal', scope: 'mine', added_by: 'u1', added_at: '2026-10-01T00:00:00Z', removed_at: null },
        ],
        error: null,
      },
    })
    const read = await supabaseAppSendsIo(client).load()
    expect(read.sends).toEqual({ trade: { portal: true } })
    expect(read.lastRun).toMatchObject({ at: '2026-10-13T14:00:00.000Z', sent: 0, kept: { off: 11 }, words: ['No text went.'] })
    expect(read.quickReplies.map((q) => q.id)).toEqual(['q1'])
    expect(calls).toContainEqual(['in', 'key', ['messages_nudge_app_sends_v1', 'messages_nudge_last_run_v1']])
  })

  it('reads none yet as the settings ship, and the step’s own words when the quick replies do not read', async () => {
    const { client } = fakeClient({
      settings: {
        data: [
          { key: 'messages_nudge_app_sends_v1', value_text: '{}' },
          { key: 'messages_nudge_last_run_v1', value_text: '{}' },
        ],
        error: null,
      },
      replies: { data: null, error: { message: 'permission denied', code: '42501' } },
    })
    await expect(supabaseAppSendsIo(client).load()).resolves.toEqual({ sends: {}, lastRun: null, quickReplies: [] })
  })

  it('says so when the settings do not read', async () => {
    const { client } = fakeClient({ settings: { data: null, error: { message: 'boom' } } })
    await expect(supabaseAppSendsIo(client).load()).rejects.toBeInstanceOf(DatabaseError)
  })

  it('turns a step on over the switch as stored now, keeping a step turned on since', async () => {
    const { client, calls } = fakeClient({
      now: { data: { value_text: '{"customer":{"yes":true}}' }, error: null },
      update: { data: [{ key: 'messages_nudge_app_sends_v1' }], error: null },
    })
    await expect(supabaseAppSendsIo(client).set('trade', 'portal', 'send')).resolves.toEqual({ customer: { yes: true }, trade: { portal: true } })
    expect(calls).toContainEqual(['update', { value_text: '{"customer":{"yes":true},"trade":{"portal":true}}' }])
    expect(calls).toContainEqual(['eq', 'key', 'messages_nudge_app_sends_v1'])
  })

  it('says the switch did not change when the policy matches no row', async () => {
    const { client } = fakeClient({
      now: { data: { value_text: '{}' }, error: null },
      update: { data: [], error: null },
    })
    await expect(supabaseAppSendsIo(client).set('trade', 'portal', 'send')).rejects.toThrow(APP_SENDS_NOT_SAVED)
  })
})
