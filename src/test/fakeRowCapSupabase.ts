import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export type FakeRowCapCall = {
  table: string
  select: string | null
  order: string[]
  range: [number, number] | null
  in: [string, unknown[]] | null
  eq: Array<[string, unknown]>
  limit: number | null
}

/**
 * Recording fake client that mimics PostgREST's silent `max_rows` cap:
 * un-ranged reads return at most 1,000 rows with NO error, ranged reads slice.
 * `.in()` and `.eq()` filter, `.limit()` trims; `.order()` is recorded, not
 * applied — rows come back in the order the table was given. Every awaited
 * query is recorded in `calls`. `failOnCall` (1-based, counted across tables)
 * makes that one read resolve with an error and no rows: `failWith` is that
 * error (default `{ message: 'boom' }`) and `failStatus` the HTTP status
 * beside it (`0` with `code: ''` is how supabase-js reports a dropped fetch).
 */
export function makeFakeRowCapSupabase(
  tables: Record<string, Array<Record<string, unknown>>>,
  opts: { failOnCall?: number; failWith?: { message: string; code?: string }; failStatus?: number } = {},
) {
  const calls: FakeRowCapCall[] = []
  function builder(table: string) {
    const call: FakeRowCapCall = { table, select: null, order: [], range: null, in: null, eq: [], limit: null }
    const b = {
      select: (columns: string) => { call.select = columns; return b },
      in: (col: string, vals: unknown[]) => { call.in = [col, vals]; return b },
      eq: (col: string, val: unknown) => { call.eq.push([col, val]); return b },
      limit: (count: number) => { call.limit = count; return b },
      order: (col: string) => { call.order.push(col); return b },
      range: (from: number, to: number) => { call.range = [from, to]; return b },
      then: (
        resolve: (r: { data: unknown[] | null; error: { message: string; code?: string } | null; status?: number }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        calls.push(call)
        if (opts.failOnCall === calls.length) {
          const failure = { data: null, error: opts.failWith ?? { message: 'boom' }, status: opts.failStatus }
          return Promise.resolve(failure).then(resolve, reject)
        }
        let rows = tables[table] ?? []
        const inFilter = call.in
        if (inFilter) rows = rows.filter((r) => inFilter[1].includes(r[inFilter[0]]))
        for (const [col, val] of call.eq) rows = rows.filter((r) => r[col] === val)
        const ranged = call.range ? rows.slice(call.range[0], call.range[1] + 1) : rows.slice(0, 1000)
        const data = call.limit == null ? ranged : ranged.slice(0, call.limit)
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return b
  }
  // An RPC reads as the table `rpc:<name>` (its arguments are not applied): enough to test paging.
  const client = { from: (table: string) => builder(table), rpc: (fn: string) => builder(`rpc:${fn}`) } as unknown as SupabaseClient<Database>
  return { client, calls }
}
