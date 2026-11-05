/**
 * The active-people query's one login rule (punch list #264): by default a person with no login is in — they are a
 * real worker on every roster, crew and pay list — and `withLogin` keeps only people who can sign in, for the
 * pickers that hand someone an app task, a pin or an imitation. The filter reads the column and drops rows here,
 * so the query's shape stays what every picker's test mock expects.
 */
import { describe, expect, it, vi } from 'vitest'

const calls: Array<{ op: string; args: unknown[] }> = []
let rows: Array<Record<string, unknown>> = []

vi.mock('../supabase', () => {
  const b: Record<string, unknown> = {}
  for (const op of ['select', 'is', 'eq', 'neq', 'in', 'order']) {
    b[op] = (...args: unknown[]) => {
      calls.push({ op, args })
      return b
    }
  }
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok)
  return { supabase: { from: () => b } }
})

import { activeUsersQuery } from './fetchActiveUsers'

const people = [
  { id: 'u-login', name: 'Ana Lind', login_attached_at: '2026-10-01T12:00:00Z' },
  { id: 'u-none', name: 'Rio Vance', login_attached_at: null },
]

describe('activeUsersQuery and the login rule', () => {
  it('keeps a person with no login by default', async () => {
    calls.length = 0
    rows = people
    const { data } = await activeUsersQuery('id, name')
    expect((data ?? []).map((r) => (r as { id: string }).id)).toEqual(['u-login', 'u-none'])
    expect(calls.find((c) => c.op === 'select')?.args[0]).toBe('id, name')
  })

  it('withLogin reads the column and drops the rows with none', async () => {
    calls.length = 0
    rows = people
    const { data } = await activeUsersQuery('id, name', { withLogin: true })
    expect((data ?? []).map((r) => (r as { id: string }).id)).toEqual(['u-login'])
    expect(calls.find((c) => c.op === 'select')?.args[0]).toBe('id, name, login_attached_at')
    // No new operator reaches the query: the rows are dropped after the read.
    expect(calls.map((c) => c.op)).not.toContain('not')
  })

  it('withLogin keeps a row the read did not stamp, the older meaning', async () => {
    rows = [{ id: 'u-old', name: 'Old Reader' }]
    const { data } = await activeUsersQuery('id, name', { withLogin: true })
    expect((data ?? []).map((r) => (r as { id: string }).id)).toEqual(['u-old'])
  })
})
