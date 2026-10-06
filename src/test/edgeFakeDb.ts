/**
 * A fake Supabase client for running an edge function's own `index.ts` under vitest (the recipe in
 * `src/lib/submittals/submitSubmittalReview.run.test.ts`). Unlike that file's recorder, this one
 * holds rows and applies the query's equality filters (`eq`, `match`, `in`, `is`) to them, so a test
 * proves what the function's real query lets through, not only which tables it touched. Range and
 * ordering calls are accepted and ignored. Nothing here reaches a database.
 */
export type FakeRow = Record<string, unknown>

export type FakeDb = {
  /** Rows by table name. */
  tables: Record<string, FakeRow[]>
  /** `op table` per finished query, in order. */
  calls: string[]
  /** Every update and insert, with the rows it matched. */
  writes: Array<{ op: 'update' | 'insert'; table: string; values: FakeRow; matched: FakeRow[] }>
  /** RPC results by name. */
  rpcs: Record<string, unknown>
}

export function makeFakeDb(): FakeDb {
  return { tables: {}, calls: [], writes: [], rpcs: {} }
}

type Chain = Record<string, (...args: never[]) => unknown>

export function fakeTable(db: FakeDb, name: string): Chain {
  let op: 'select' | 'update' | 'insert' = 'select'
  let values: FakeRow = {}
  const where: Array<(r: FakeRow) => boolean> = []
  const run = (): FakeRow[] => {
    const matched = (db.tables[name] ?? []).filter((r) => where.every((w) => w(r)))
    db.calls.push(`${op} ${name}`)
    if (op !== 'select') db.writes.push({ op, table: name, values, matched })
    return op === 'select' ? matched : []
  }
  const chain: Chain = {}
  const self = () => chain
  for (const m of ['select', 'order', 'limit', 'lt', 'lte', 'gt', 'gte', 'neq', 'not', 'ilike', 'range']) chain[m] = self
  chain.eq = ((c: string, v: unknown) => (where.push((r) => r[c] === v), chain)) as never
  chain.match = ((q: FakeRow) => {
    for (const [c, v] of Object.entries(q)) where.push((r) => r[c] === v)
    return chain
  }) as never
  chain.in = ((c: string, vs: unknown[]) => (where.push((r) => vs.includes(r[c])), chain)) as never
  chain.is = ((c: string, v: unknown) => (where.push((r) => (r[c] ?? null) === v), chain)) as never
  chain.update = ((v: FakeRow) => ((op = 'update'), (values = v), chain)) as never
  chain.insert = ((v: FakeRow) => ((op = 'insert'), (values = v), chain)) as never
  chain.maybeSingle = (() => Promise.resolve({ data: run()[0] ?? null, error: null })) as never
  chain.single = (() => {
    const row = run()[0]
    return Promise.resolve(row ? { data: row, error: null } : { data: null, error: { message: 'no row' } })
  }) as never
  chain.then = ((resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: run(), error: null }).then(resolve, reject)) as never
  return chain
}

/**
 * A `createClient` stand-in: `auth.getUser` answers from `sessions` (bearer token → user id), and
 * `from` / `rpc` read the fake's tables. Every client the function makes (the caller's and the
 * service role's) reads the same rows; RLS is not modelled.
 */
export function fakeClient(db: FakeDb, sessions: Record<string, string>, bearer: () => string | null) {
  return {
    auth: {
      getUser: async (token?: string) => {
        db.calls.push('auth.getUser')
        const id = sessions[token ?? bearer() ?? '']
        return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } }
      },
    },
    from: (name: string) => fakeTable(db, name),
    rpc: async (name: string) => {
      db.calls.push(`rpc ${name}`)
      return { data: db.rpcs[name] ?? null, error: null }
    },
  }
}
