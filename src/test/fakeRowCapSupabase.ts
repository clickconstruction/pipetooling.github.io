import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export type FakeRowCapCall = {
  table: string
  select: string | null
  order: string[]
  range: [number, number] | null
  in: [string, unknown[]] | null
}

/**
 * Recording fake client that mimics PostgREST's silent `max_rows` cap:
 * un-ranged reads return at most 1,000 rows with NO error, ranged reads slice.
 * Every awaited query is recorded in `calls`. `failOnCall` (1-based, counted
 * across tables) makes that one read resolve with an error and no rows.
 */
export function makeFakeRowCapSupabase(
  tables: Record<string, Array<Record<string, unknown>>>,
  opts: { failOnCall?: number } = {},
) {
  const calls: FakeRowCapCall[] = []
  function builder(table: string) {
    const call: FakeRowCapCall = { table, select: null, order: [], range: null, in: null }
    const b = {
      select: (columns: string) => { call.select = columns; return b },
      in: (col: string, vals: unknown[]) => { call.in = [col, vals]; return b },
      order: (col: string) => { call.order.push(col); return b },
      range: (from: number, to: number) => { call.range = [from, to]; return b },
      then: (
        resolve: (r: { data: unknown[] | null; error: { message: string } | null }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        calls.push(call)
        if (opts.failOnCall === calls.length) {
          return Promise.resolve({ data: null, error: { message: 'boom' } }).then(resolve, reject)
        }
        let rows = tables[table] ?? []
        const inFilter = call.in
        if (inFilter) rows = rows.filter((r) => inFilter[1].includes(r[inFilter[0]]))
        const data = call.range ? rows.slice(call.range[0], call.range[1] + 1) : rows.slice(0, 1000)
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return b
  }
  const client = { from: (table: string) => builder(table) } as unknown as SupabaseClient<Database>
  return { client, calls }
}
