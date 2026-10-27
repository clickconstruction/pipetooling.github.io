import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export type ProxyFakeStep = { method: string; args: unknown[] }
export type ProxyFakeRead = { table: string; steps: ProxyFakeStep[] }

/**
 * A stand-in client for a loader's reads (v2.5978). Every builder call (`select`, `gte`, `in`, `order`, `range` and the
 * rest) is recorded and hands the builder back, and awaiting it resolves the table's rows whole, with no error. Nothing
 * is filtered, so a test gives each table only the rows its reads would return, and reads `reads` for what the loader
 * asked. `fakeRowCapSupabase.ts` is the one that filters and caps.
 */
export function makeProxyFakeSupabase(rows: Record<string, ReadonlyArray<Record<string, unknown>>>) {
  const reads: ProxyFakeRead[] = []
  const db = {
    from(table: string) {
      const steps: ProxyFakeStep[] = []
      reads.push({ table, steps })
      const builder: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: rows[table] ?? [], error: null })
            return (...args: unknown[]) => {
              steps.push({ method: String(prop), args })
              return builder
            }
          },
        },
      )
      return builder
    },
  }
  return { db: db as unknown as SupabaseClient<Database>, reads }
}

/** The arguments of every `method` call the loader made on `table`, in order. */
export const proxyFakeCalls = (reads: ReadonlyArray<ProxyFakeRead>, table: string, method: string): unknown[][] =>
  reads.filter((r) => r.table === table).flatMap((r) => r.steps.filter((s) => s.method === method).map((s) => s.args))
