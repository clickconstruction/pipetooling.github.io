import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same recording, chainable Supabase stand-in as teamFeedback.test.ts; the manager resolver
// this module falls back to is mocked so the two files test their own logic.
type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
type Handler = (table: string, steps: Step[]) => Result

let handler: Handler = () => ({ data: [], error: null })
const calls: Array<{ table: string; steps: Step[] }> = []
const resolveManager = vi.fn(async (_userId: string): Promise<string | null> => null)

function builder(table: string): unknown {
  const steps: Step[] = []
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: Result) => void) => {
            calls.push({ table, steps })
            resolve(handler(table, steps))
          }
        }
        return (...args: unknown[]) => {
          steps.push({ method: String(prop), args })
          return p
        }
      },
    },
  )
  return p
}

vi.mock('./supabase', () => ({ supabase: { from: (table: string) => builder(table) } }))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<Result>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
vi.mock('./teamFeedback', () => ({ resolveManagerUserIdForFeedback: (id: string) => resolveManager(id) }))

import { deleteUserTagOrg, fetchTagOrgOverridesForUserIds, fetchUserTagOrgSignals, resolveTagOrgMasterUserId, upsertUserTagOrg } from './tagOrg'

const argOf = (table: string, method: string) => calls.find((c) => c.table === table)?.steps.find((s) => s.method === method)?.args
const ilikeArgs = (table: string) => calls.filter((c) => c.table === table).map((c) => c.steps.find((s) => s.method === 'ilike')?.args)

beforeEach(() => {
  calls.length = 0
  handler = () => ({ data: [], error: null })
  resolveManager.mockReset()
  resolveManager.mockResolvedValue(null)
})

describe('overrides', () => {
  it('fetchTagOrgOverridesForUserIds maps user → master and skips the query for no ids', async () => {
    expect(await fetchTagOrgOverridesForUserIds([])).toEqual({})
    expect(calls).toHaveLength(0)
    handler = () => ({ data: [{ user_id: 'u1', master_user_id: 'M1' }, { user_id: 'u2', master_user_id: 'M2' }], error: null })
    expect(await fetchTagOrgOverridesForUserIds(['u1', 'u2'])).toEqual({ u1: 'M1', u2: 'M2' })
    expect(argOf('user_tag_org', 'in')).toEqual(['user_id', ['u1', 'u2']])
  })
  it('resolveTagOrgMasterUserId prefers the override and falls back to the feedback resolver', async () => {
    handler = () => ({ data: { master_user_id: 'M9' }, error: null })
    expect(await resolveTagOrgMasterUserId('u1')).toBe('M9')
    expect(resolveManager).not.toHaveBeenCalled()
    handler = () => ({ data: null, error: null })
    resolveManager.mockResolvedValue('M1')
    expect(await resolveTagOrgMasterUserId('u1')).toBe('M1')
    expect(resolveManager).toHaveBeenCalledWith('u1')
  })
  it('upsert and delete send the expected rows', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-06T12:00:00Z'))
    await upsertUserTagOrg('u1', 'M1', 'dev-1')
    expect(argOf('user_tag_org', 'upsert')).toEqual([{ user_id: 'u1', master_user_id: 'M1', set_by: 'dev-1', updated_at: '2026-09-06T12:00:00.000Z' }, { onConflict: 'user_id' }])
    vi.useRealTimers()
    calls.length = 0
    await deleteUserTagOrg('u1')
    expect(calls[0]?.steps.map((s) => s.method)).toEqual(['delete', 'eq'])
    expect(argOf('user_tag_org', 'eq')).toEqual(['user_id', 'u1'])
  })
})

describe('fetchUserTagOrgSignals', () => {
  it('returns empty signals for no ids without querying', async () => {
    expect(await fetchUserTagOrgSignals([])).toEqual({})
    expect(calls).toHaveLength(0)
  })

  it('aggregates adoption rows (deduped), the roster email hint (lowercased), and job masters with counts', async () => {
    handler = (table, steps) => {
      switch (table) {
        case 'master_assistants':
          return { data: [{ assistant_id: 'u1', master_id: 'M1' }, { assistant_id: 'u1', master_id: 'M1' }, { assistant_id: 'u1', master_id: 'M2' }], error: null }
        case 'master_superintendents':
          return { data: [{ superintendent_id: 'u2', master_id: 'M3' }], error: null }
        case 'master_primaries':
          return { data: [], error: null }
        case 'jobs_ledger_team_members':
          return { data: [{ user_id: 'u1', job_id: 'j1' }, { user_id: 'u1', job_id: 'j2' }, { user_id: 'u1', job_id: 'j3' }, { user_id: 'u2', job_id: 'orphan' }], error: null }
        case 'users':
          return { data: [{ id: 'u1', email: ' Pat@Example.com ' }, { id: 'u2', email: null }], error: null }
        case 'people': {
          const email = steps.find((s) => s.method === 'ilike')?.args[1]
          return { data: email === ' Pat@Example.com '.trim() ? [{ master_user_id: 'M1', email: 'pat@example.com' }] : [], error: null }
        }
        case 'jobs_ledger':
          return { data: [{ id: 'j1', master_user_id: 'M2' }, { id: 'j2', master_user_id: 'M1' }, { id: 'j3', master_user_id: 'M2' }], error: null }
        default:
          return { data: [], error: null }
      }
    }
    const out = await fetchUserTagOrgSignals(['u1', 'u2', 'u3'])
    expect(out.u1).toEqual({
      assistantMasters: ['M1', 'M2'],
      superintendentMasters: [],
      primaryMasters: [],
      jobMasters: [
        { masterId: 'M1', jobCount: 1 },
        { masterId: 'M2', jobCount: 2 },
      ],
      peopleEmailMaster: 'M1',
    })
    expect(out.u2).toEqual({ assistantMasters: [], superintendentMasters: ['M3'], primaryMasters: [], jobMasters: [], peopleEmailMaster: null })
    expect(out.u3).toEqual({ assistantMasters: [], superintendentMasters: [], primaryMasters: [], jobMasters: [], peopleEmailMaster: null })
    // one people lookup per distinct trimmed email; the orphan job never reaches jobs_ledger's master map
    expect(ilikeArgs('people')).toEqual([['email', 'Pat@Example.com']])
    expect(argOf('jobs_ledger', 'in')).toEqual(['id', ['j1', 'j2', 'j3', 'orphan']])
  })

  it('skips the people and jobs_ledger lookups when there are no emails or team rows', async () => {
    handler = (table) => (table === 'users' ? { data: [{ id: 'u1', email: '' }], error: null } : { data: [], error: null })
    await fetchUserTagOrgSignals(['u1'])
    expect(calls.map((c) => c.table)).not.toContain('people')
    expect(calls.map((c) => c.table)).not.toContain('jobs_ledger')
  })
})
