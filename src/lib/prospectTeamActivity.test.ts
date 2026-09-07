import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/**
 * Prospects → Team and the Quickfill prospects chart: the last 30 local
 * calendar days of calling activity, per user per day — unique prospects
 * touched by timer events ("marked") and by comments ("updated"). Pins the
 * eligible-user filter, the window bounds, the per-day unique counting, and
 * the zero-filled 30-day shape.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
const supabase = {
  from: (table: string) => {
    const steps: Step[] = []
    queries.push({ table, steps })
    const p: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table))
          return (...a: unknown[]) => {
            steps.push({ method: String(prop), args: a })
            return p
          }
        },
      },
    )
    return p
  },
} as unknown as SupabaseClient<Database>
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
  checkSupabaseError: (res: { error: { message: string } | null }, label: string) => {
    if (res.error) throw new Error(`${label}: ${res.error.message}`)
  },
}))

import { loadProspectTeamActivity } from './prospectTeamActivity'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const q = (table: string) => queries.find((x) => x.table === table)!
/** Local calendar-day key, the same way the loader builds its keys. */
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const localDay = (daysAgo: number, hour = 10) => {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour)
  return d
}
const users = [
  { id: 'u1', name: ' Ana ', email: 'ana@x.test', role: 'assistant' },
  { id: 'u2', name: null, email: 'bob@x.test', role: 'estimator' },
  { id: 'u3', name: '', email: null, role: 'dev' },
]

beforeEach(() => {
  queries.length = 0
  route = (table) => ({ data: table === 'users' ? users : [], error: null })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 7, 15, 30)) // a local afternoon, so day math is exercised in the runner's own zone
})
afterEach(() => vi.useRealTimers())

describe('loadProspectTeamActivity', () => {
  it('asks for office roles plus estimators with Prospects access, and bounds events and comments to the last 30 local days', async () => {
    await loadProspectTeamActivity(supabase)
    expect(argsOf(q('users').steps, 'or')).toEqual([['role.in.(dev,master_technician,assistant,controller),and(role.eq.estimator,estimator_prospects_access.eq.true)']])
    expect(argsOf(q('users').steps, 'order')).toEqual([['name']])
    const startIso = localDay(29, 0).toISOString()
    const endIso = new Date(localDay(0, 0).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
    for (const t of ['prospect_timer_events', 'prospect_comments']) {
      expect(argsOf(q(t).steps, 'gte')).toEqual([['created_at', startIso]])
      expect(argsOf(q(t).steps, 'lte')).toEqual([['created_at', endIso]])
    }
  })

  it('returns 30 zero-filled local days, oldest first, with every eligible user on each day named by name, else email, else Unknown', async () => {
    const out = await loadProspectTeamActivity(supabase)
    const days = Object.keys(out)
    expect(days).toHaveLength(30)
    expect(days[0]).toBe(key(localDay(29)))
    expect(days[29]).toBe(key(localDay(0)))
    expect(out[days[0]!]).toEqual([
      { user_id: 'u1', name: 'Ana', email: 'ana@x.test', cards_marked: 0, cards_updated: 0 },
      { user_id: 'u2', name: 'bob@x.test', email: 'bob@x.test', cards_marked: 0, cards_updated: 0 },
      { user_id: 'u3', name: 'Unknown', email: null, cards_marked: 0, cards_updated: 0 },
    ])
  })

  it('counts unique prospects per user per local day — repeat touches of one prospect count once, a timer event with no prospect counts nothing', async () => {
    const today = localDay(0)
    const yesterday = localDay(1)
    route = (table) => {
      if (table === 'users') return { data: users, error: null }
      if (table === 'prospect_timer_events')
        return {
          data: [
            { user_id: 'u1', prospect_id: 'p1', created_at: today.toISOString() },
            { user_id: 'u1', prospect_id: 'p1', created_at: new Date(today.getTime() + 3600_000).toISOString() }, // same prospect again
            { user_id: 'u1', prospect_id: 'p2', created_at: today.toISOString() },
            { user_id: 'u1', prospect_id: null, created_at: today.toISOString() }, // no prospect
            { user_id: 'u2', prospect_id: 'p1', created_at: yesterday.toISOString() },
          ],
          error: null,
        }
      return {
        data: [
          { created_by: 'u1', prospect_id: 'p1', created_at: today.toISOString() },
          { created_by: 'u2', prospect_id: 'p9', created_at: yesterday.toISOString() },
          { created_by: 'u2', prospect_id: 'p9', created_at: yesterday.toISOString() },
        ],
        error: null,
      }
    }
    const out = await loadProspectTeamActivity(supabase)
    const byUser = (d: Date) => Object.fromEntries(out[key(d)]!.map((r) => [r.user_id, [r.cards_marked, r.cards_updated]]))
    expect(byUser(today)).toEqual({ u1: [2, 1], u2: [0, 0], u3: [0, 0] })
    expect(byUser(yesterday)).toEqual({ u1: [0, 0], u2: [1, 1], u3: [0, 0] })
  })

  it('a failed read names its source and throws', async () => {
    route = (table) => (table === 'prospect_comments' ? { data: null, error: { message: 'rls' } } : { data: table === 'users' ? users : [], error: null })
    await expect(loadProspectTeamActivity(supabase)).rejects.toThrow('load prospect team comments: rls')
  })
})
