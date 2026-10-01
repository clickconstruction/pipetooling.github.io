import { describe, expect, it, vi } from 'vitest'
import {
  NOT_APPLIED,
  createCountToolingSeat,
  extraAccessForRole,
  nameTakenByAnother,
  passwordProblem,
  renameAccount,
  setAccountExtraAccess,
  setAccountPassword,
  setAccountTrades,
  setCanRunAJob,
  tradesColumnForRole,
  tradesValue,
} from './accountWrites'

type Call = { table: string; op: string; args: unknown[] }

/** A recording stand-in for the Supabase client: each table answers reads with its rows and writes with `updated`. */
function fakeClient(opts: { rows?: Record<string, unknown[]>; updated?: unknown[]; updateError?: string; invoke?: (name: string, body: unknown) => { data: unknown; error: unknown } } = {}) {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      let mode: 'read' | 'write' = 'read'
      const b: Record<string, unknown> = {}
      for (const op of ['select', 'eq', 'ilike', 'is', 'limit']) {
        b[op] = (...args: unknown[]) => {
          calls.push({ table, op, args })
          return b
        }
      }
      b.update = (...args: unknown[]) => {
        mode = 'write'
        calls.push({ table, op: 'update', args })
        return b
      }
      b.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve(
          mode === 'write'
            ? { data: opts.updateError ? null : (opts.updated ?? [{ id: 'u1' }]), error: opts.updateError ? { message: opts.updateError } : null }
            : { data: opts.rows?.[table] ?? [], error: null },
        ).then(ok)
      return b
    },
    functions: {
      invoke: vi.fn(async (name: string, o: { body: unknown }) => opts.invoke?.(name, o.body) ?? { data: {}, error: null }),
    },
  }
  return { client: client as never, calls }
}

const updates = (calls: Call[]) => calls.filter((c) => c.op === 'update').map((c) => ({ table: c.table, patch: c.args[0] }))

describe('account rows on the desk', () => {
  it('names the trades column per role, and only the roles that have one', () => {
    expect(tradesColumnForRole('estimator')).toBe('estimator_service_type_ids')
    expect(tradesColumnForRole('helpers')).toBe('helpers_service_type_ids')
    expect(tradesColumnForRole('subcontractor')).toBe('subcontractor_service_type_ids')
    expect(tradesColumnForRole('assistant')).toBeNull()
    expect(tradesValue([])).toBeNull()
    expect(tradesValue(['a', 'b', 'a'])).toEqual(['a', 'b'])
  })

  it('offers the Hiring board to office roles and estimators, Prospects to estimators only', () => {
    expect(extraAccessForRole('estimator').map((x) => x.field)).toEqual(['team_prospects_access', 'estimator_prospects_access'])
    expect(extraAccessForRole('assistant').map((x) => x.field)).toEqual(['team_prospects_access'])
    expect(extraAccessForRole('helpers')).toEqual([])
    expect(extraAccessForRole('controller')).toEqual([])
  })

  it('checks a typed password before anything is sent', () => {
    expect(passwordProblem('abc', 'abc')).toBe('Use at least 6 characters.')
    expect(passwordProblem('abcdef', 'abcdeg')).toBe('The two passwords do not match.')
    expect(passwordProblem('abcdef', 'abcdef')).toBeNull()
  })
})

describe('the writes', () => {
  it('a write RLS filtered to nothing says it did not apply', async () => {
    const { client } = fakeClient({ updated: [] })
    await expect(setCanRunAJob(client, { userId: 'u1', canRun: true })).rejects.toThrow(NOT_APPLIED)
  })

  it('supervision is stored the other way round: can run means needs_supervision false', async () => {
    const { client, calls } = fakeClient()
    await setCanRunAJob(client, { userId: 'u1', canRun: true })
    await setCanRunAJob(client, { userId: 'u1', canRun: false })
    expect(updates(calls)).toEqual([
      { table: 'users', patch: { needs_supervision: false } },
      { table: 'users', patch: { needs_supervision: true } },
    ])
  })

  it('trades go to the role\'s own column, empty meaning all', async () => {
    const { client, calls } = fakeClient()
    await setAccountTrades(client, { userId: 'u1', role: 'helpers', ids: [] })
    await setAccountTrades(client, { userId: 'u1', role: 'estimator', ids: ['plum'] })
    expect(updates(calls)).toEqual([
      { table: 'users', patch: { helpers_service_type_ids: null } },
      { table: 'users', patch: { estimator_service_type_ids: ['plum'] } },
    ])
    await expect(setAccountTrades(client, { userId: 'u1', role: 'assistant', ids: ['plum'] })).rejects.toThrow('no trades')
  })

  it('extra access writes the one flag', async () => {
    const { client, calls } = fakeClient()
    await setAccountExtraAccess(client, { userId: 'u1', field: 'team_prospects_access', on: true })
    expect(updates(calls)).toEqual([{ table: 'users', patch: { team_prospects_access: true } }])
  })

  it('a name someone else has is refused; their own roster row is not someone else', async () => {
    const taken = fakeClient({ rows: { users: [{ id: 'u2', name: 'Wendi Whites' }] } })
    expect(await nameTakenByAnother(taken.client, { userId: 'u1', name: 'wendi whites' })).toBe(true)
    const own = fakeClient({ rows: { people: [{ id: 'p1', name: 'Wendi Whites', account_user_id: 'u1' }], users: [{ id: 'u1', name: 'Wendi' }] } })
    expect(await nameTakenByAnother(own.client, { userId: 'u1', name: 'Wendi Whites' })).toBe(false)
    // A % in a name is matched as itself, not as a wildcard.
    const pct = fakeClient()
    await nameTakenByAnother(pct.client, { userId: 'u1', name: '50% Crew' })
    expect(pct.calls.find((c) => c.op === 'ilike')?.args).toEqual(['name', '50\\% Crew'])
  })

  it('a rename writes the name, then moves every name the account went by', async () => {
    const { client, calls } = fakeClient()
    const cascade = vi.fn(async () => {})
    await renameAccount(client, { userId: 'u1', email: 'w@x.com', oldName: 'Wendi', newName: ' Wendi Whites ' }, { getNames: async () => ['Wendi', 'Wendy'], cascade })
    expect(updates(calls)).toEqual([{ table: 'users', patch: { name: 'Wendi Whites' } }])
    expect(cascade.mock.calls).toEqual([
      ['Wendi', 'Wendi Whites'],
      ['Wendy', 'Wendi Whites'],
    ])
  })

  it('a rename refuses an empty or taken name and writes nothing', async () => {
    const empty = fakeClient()
    await expect(renameAccount(empty.client, { userId: 'u1', email: null, oldName: 'A', newName: '  ' }, { getNames: async () => [], cascade: async () => {} })).rejects.toThrow('Type a name first.')
    const taken = fakeClient({ rows: { users: [{ id: 'u2', name: 'Kyle' }] } })
    await expect(renameAccount(taken.client, { userId: 'u1', email: null, oldName: 'A', newName: 'Kyle' }, { getNames: async () => [], cascade: async () => {} })).rejects.toThrow('already called "Kyle"')
    expect(updates(empty.calls).concat(updates(taken.calls))).toEqual([])
  })

  it('a password goes to set-user-password; its refusal comes back as the message', async () => {
    const ok = fakeClient()
    await setAccountPassword(ok.client, { userId: 'u1', password: 'secret1' })
    expect((ok.client as unknown as { functions: { invoke: ReturnType<typeof vi.fn> } }).functions.invoke).toHaveBeenCalledWith('set-user-password', { body: { user_id: 'u1', password: 'secret1' } })
    const refused = fakeClient({ invoke: () => ({ data: { error: 'Only devs can set passwords' }, error: null }) })
    await expect(setAccountPassword(refused.client, { userId: 'u1', password: 'secret1' })).rejects.toThrow('Only devs can set passwords')
  })

  it('a CountTooling seat is made over the bridge, then its id is stored', async () => {
    const { client, calls } = fakeClient({ invoke: () => ({ data: { ct_user_id: 'ct-9' }, error: null }) })
    expect(await createCountToolingSeat(client, { userId: 'u1', email: 'w@x.com', name: 'Wendi' })).toBe('ct-9')
    expect(updates(calls)).toEqual([{ table: 'users', patch: { counttooling_user_id: 'ct-9' } }])
    const none = fakeClient({ invoke: () => ({ data: {}, error: null }) })
    await expect(createCountToolingSeat(none.client, { userId: 'u1', email: 'w@x.com', name: null })).rejects.toThrow('no seat')
    expect(updates(none.calls)).toEqual([])
  })
})
