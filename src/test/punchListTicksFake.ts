/**
 * A stand-in for the supabase client that keeps `punch_list_ticks` in memory, for the smokes of the punch list's
 * ticks (`PunchList.ticks.render.test.tsx`, `usePunchListTicks.render.test.tsx`). It answers the three calls the
 * hook makes (a select by person, an upsert of one row, a delete by card number or numbers), can be told to fail
 * a read or a write with a plain result error, and logs every write so a test can read what was sent. Any other
 * table answers an empty list.
 *
 *   const db = vi.hoisted(() => ({ fake: null as unknown as TicksFake }))
 *   vi.mock('../lib/supabase', async () => {
 *     const { makeTicksFake } = await import('../test/punchListTicksFake')
 *     db.fake = makeTicksFake()
 *     return { supabase: db.fake.supabase }
 *   })
 */
export interface FakeTickRow {
  user_id: string
  card_number: number
  section: string
  board_version: string
}

export interface TicksFake {
  rows: FakeTickRow[]
  /** A plain result error for the next reads, or null. */
  failRead: { code?: string; message: string } | null
  /** A plain result error for the next writes, or null. */
  failWrite: { code?: string; message: string } | null
  /** Every write that landed, in order: `upsert 299 ready v2.8196`, `delete 299`, `delete 2,9`. */
  log: string[]
  reads: number
  reset: () => void
  supabase: unknown
}

export function makeTicksFake(): TicksFake {
  const fake: TicksFake = {
    rows: [],
    failRead: null,
    failWrite: null,
    log: [],
    reads: 0,
    reset() {
      fake.rows = []
      fake.failRead = null
      fake.failWrite = null
      fake.log = []
      fake.reads = 0
    },
    supabase: null,
  }

  const from = (table: string) => {
    let op: 'select' | 'upsert' | 'delete' = 'select'
    let payload: FakeTickRow | null = null
    const filters: Record<string, unknown> = {}
    const run = (): { data: unknown; error: unknown } => {
      if (table !== 'punch_list_ticks') return { data: [], error: null }
      if (op === 'select') {
        fake.reads += 1
        if (fake.failRead) return { data: null, error: fake.failRead }
        return { data: fake.rows.filter((r) => r.user_id === filters.user_id).map((r) => ({ ...r })), error: null }
      }
      if (fake.failWrite) return { data: null, error: fake.failWrite }
      if (op === 'upsert' && payload) {
        const row = payload
        fake.rows = [...fake.rows.filter((r) => !(r.user_id === row.user_id && r.card_number === row.card_number)), { ...row }]
        fake.log.push(`upsert ${row.card_number} ${row.section} ${row.board_version}`)
      } else {
        const wanted = filters.card_number
        const gone = new Set(Array.isArray(wanted) ? (wanted as number[]) : [wanted as number])
        fake.rows = fake.rows.filter((r) => !(r.user_id === filters.user_id && gone.has(r.card_number)))
        fake.log.push(`delete ${[...gone].join(',')}`)
      }
      return { data: null, error: null }
    }
    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.insert = () => builder
    builder.upsert = (row: FakeTickRow) => {
      op = 'upsert'
      payload = row
      return builder
    }
    builder.delete = () => {
      op = 'delete'
      return builder
    }
    builder.eq = (col: string, value: unknown) => {
      filters[col] = value
      return builder
    }
    builder.in = (col: string, value: unknown) => {
      filters[col] = value
      return builder
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve(run()).then(onFulfilled, onRejected)
    return builder
  }

  fake.supabase = {
    from,
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => {
      const ch: Record<string, unknown> = {}
      ch.on = () => ch
      ch.subscribe = () => ch
      ch.unsubscribe = () => Promise.resolve('ok')
      return ch
    },
    removeChannel: () => {},
  }
  return fake
}
