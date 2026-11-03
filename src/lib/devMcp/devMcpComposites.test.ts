import { describe, expect, it } from 'vitest'
import { CATALOG_RPCS, CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { buildRowsQuery, buildRpcQuery } from '../../../supabase/functions/_shared/devMcpDoor'
import { ALL_ROWS_MAX, findBid, findCustomer, findJob, findPerson, getBid, getCustomer, getJob, getOnSite, jobNumberOf, onSiteBoxCode, readAllRows, readOnSiteMovements, type Reader, type Row, type RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import { boxCode } from '../materials/labels'
import { containerLines, type Movement } from '../materials/onSite'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

const JOB = '0e4dcd2b-a524-4056-b93c-16713041a6e7'
const CUSTOMER = '11111111-2222-4333-8444-555555555555'
const BID = '99999999-2222-4333-8444-555555555555'

/** Top-level plain columns of a PostgREST select (embeds and aliases are skipped — the API checks those). */
function plainColumns(select: string): string[] {
  const out: string[] = []
  let depth = 0
  let token = ''
  for (const ch of `${select},`) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      const t = token.trim()
      if (t && t !== '*' && !/[(:!]/.test(t)) out.push(t)
      token = ''
    } else token += ch
  }
  return out
}

/**
 * A reader that refuses what the real door would refuse: an RPC or table that is not in the
 * generated catalog, an argument the RPC does not take, a filter / order / plain select column
 * the table does not have. Whatever the composites ask for here, dev-mcp will accept live.
 */
function catalogReader(data: { rpc?: Record<string, unknown>; rows?: Record<string, Row[]> }): Reader & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    rpc: async (name, args = {}, limit) => {
      asked.push(`rpc:${name}`)
      const sigs = CATALOG_RPCS[name]
      if (!sigs) throw new Error(`rpc ${name} is not in the catalog`)
      const known = new Set(sigs.flatMap((s) => Object.keys(s.args).map((a) => a.replace(/\?$/, ''))))
      for (const a of Object.keys(args)) if (!known.has(a)) throw new Error(`rpc ${name} has no argument ${a}`)
      const built = buildRpcQuery(args, limit)
      if (!built.ok) throw new Error(built.error)
      return data.rpc?.[name] ?? []
    },
    rows: async (table: string, query: RowsQuery) => {
      asked.push(`rows:${table}`)
      const entry = CATALOG_TABLES[table]
      if (!entry) throw new Error(`table ${table} is not in the catalog`)
      const columns = new Set(Object.keys(entry.columns))
      const built = buildRowsQuery(query, columns)
      if (!built.ok) throw new Error(`${table}: ${built.error}`)
      for (const c of plainColumns(query.select ?? '*')) if (!columns.has(c)) throw new Error(`${table} has no column ${c} (select)`)
      return data.rows?.[table] ?? []
    },
  }
}

const noErrors = (value: unknown): string[] => {
  const found: string[] = []
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.error === 'string' && Object.keys(o).length === 1) found.push(`${path}: ${o.error}`)
      for (const [k, x] of Object.entries(o)) walk(x, `${path}.${k}`)
    }
  }
  walk(value, '$')
  return found
}

describe('dev-mcp composites', () => {
  it('reads a job number the way the app does', () => {
    for (const [h, c] of [['1031', ''], ['', '1032'], [null, ' 7 '], ['A', 'B'], [null, null]] as const) expect(jobNumberOf(h, c)).toBe(effectiveJobLedgerNumber(h, c))
  })

  it('every read the resolvers make is one the door accepts', async () => {
    const reader = catalogReader({})
    await findJob(reader, 'J1032')
    await findBid(reader, 'b482')
    await findCustomer(reader, 'Acme (North), Inc*')
    await findPerson(reader, 'Rob')
    expect(reader.asked).toContain('rpc:search_jobs_ledger')
    expect(reader.asked).toContain('rows:users')
  })

  it('get_job: every read is accepted, and the money is the Job window kernels over those rows', async () => {
    const reader = catalogReader({
      rows: {
        jobs_ledger: [{ id: JOB, hcp_number: '', click_number: '1032', job_name: 'ZZ TEST', status: 'working', revenue: 1200, payments_made: 1, service_type_id: 'st1', materials: [{ description: 'permit', amount: '50' }], invoices: [], payments: [{ invoice_id: null, amount: 1, paid_on: '2026-09-19' }], team: [{ users: { name: 'Al', role: 'helpers' } }] }],
        service_types: [{ id: 'st1', ledger_job_prefix: null, ledger_bid_prefix: 'B' }],
        supply_house_invoice_job_allocations: [{ pct: 50, supply_house_invoices: { invoice_number: 'S1', invoice_date: '2026-09-01', amount: 200, is_paid: false, on_job_account: true, supply_houses: { name: 'Morrison' } } }],
        mercury_transaction_job_allocations: [{ id: 'a1', amount: -40, note: null, mercury_transactions: { posted_at: '2026-09-02', counterparty_name: 'HD', raw: null } }],
        people_labor_jobs: [{ id: 'sheet1', job_number: '1032', labor_rate: 50, distance_miles: 0 }],
        people_labor_job_items: [{ job_id: 'sheet1', count: 2, hrs_per_unit: 3, is_fixed: false, labor_rate: null, direct_labor_amount: null }],
        app_settings: [{ key: 'drive_mileage_cost', value_num: 0.7 }],
      },
      rpc: {
        get_invoice_amounts_for_jobs: [{ job_id: JOB, invoice_amount: '100' }],
        list_tally_parts_with_po: [{ id: 't1', job_id: JOB, quantity: 2, part_id: 'p', price_at_time: 10 }, { id: 't2', job_id: 'other', quantity: 9, part_id: 'p', price_at_time: 99 }],
        get_man_hours_by_job: [{ job_id: JOB, man_hours: 6 }, { job_id: 'other', man_hours: 1 }],
      },
    })
    const out = (await getJob(reader, JOB, '2026-09-20')) as Record<string, unknown>
    expect(noErrors(out)).toEqual([])
    const job = out.job as Record<string, unknown>
    expect(job.label).toBe('J1032')
    expect(job.team).toEqual(['Al'])
    expect(job).not.toHaveProperty('materials')
    const money = out.money as { parts: Record<string, number>; profit: { partsCost: number; laborCost: number; totalBill: number; profit: number } }
    expect(money.parts).toEqual({ supply_invoices: 100, card_charges: 40, tally_parts: 20, other_charges: 50 })
    expect(money.profit.partsCost).toBe(210)
    expect(money.profit.laborCost).toBe(300)
    expect(money.profit.profit).toBe(1200 - 210 - 300)
    expect(out.hours).toEqual([{ job_id: JOB, man_hours: 6 }])
  })

  it('get_job: a failed cost source is reported in place and takes only the money with it', async () => {
    const reader = catalogReader({ rows: { jobs_ledger: [{ id: JOB, click_number: '1032', revenue: 10, materials: [], invoices: [], payments: [], team: [] }] } })
    const rows = reader.rows
    reader.rows = async (table, q) => {
      if (table === 'mercury_transaction_job_allocations') throw new Error('timeout')
      return rows(table, q)
    }
    const out = (await getJob(reader, JOB, '2026-09-20')) as Record<string, unknown>
    expect((out.money as { error: string }).error).toContain('timeout')
    expect((out.job as Record<string, unknown>).label).toBe('J1032')
  })

  it('get_job: a text ref that matches several jobs asks for one id', async () => {
    const reader = catalogReader({ rpc: { search_jobs_ledger: [{ id: 'a', click_number: '10', job_name: 'A' }, { id: 'b', click_number: '100', job_name: 'B' }] } })
    const out = (await getJob(reader, 'test', '2026-09-20')) as { refused: string }
    expect(out.refused).toContain('matches 2 jobs')
  })

  it('get_customer and get_bid: every read is accepted; the bid says where its total is not', async () => {
    const reader = catalogReader({
      rows: {
        customers: [{ id: CUSTOMER, name: 'Acme' }],
        bids: [{ id: BID, bid_number: '482', service_type_id: 'st1', project_name: 'Tower' }],
        service_types: [{ id: 'st1', ledger_job_prefix: 'J', ledger_bid_prefix: null }],
        jobs_ledger: [{ id: JOB, click_number: '1032', hcp_number: '', status: 'working', revenue: 100, payments_made: 0, service_type_id: 'st1', invoices: [], payments: [] }],
      },
    })
    const customer = (await getCustomer(reader, CUSTOMER, '2026-09-20')) as Record<string, unknown>
    expect(noErrors(customer)).toEqual([])
    expect((customer.jobs as Row[])[0]).toMatchObject({ label: 'J1032' })
    expect((customer.jobs as Row[])[0]).not.toHaveProperty('invoices')
    const bid = (await getBid(reader, BID)) as Record<string, unknown>
    expect(noErrors(bid)).toEqual([])
    expect((bid.bid as Row).label).toBe('B482')
    expect(String(bid.totals)).toContain('useBidPricingEngine')
  })
})

/**
 * A door over one table's rows that answers as PostgREST does: the `eq` / `in` / `gt` filters, the order, and the
 * door's own cut at 200 rows a read (`clampLimit`). What the catalog reader checks, this one serves.
 */
function pagingReader(rowsByTable: Record<string, Row[]>, base: Reader): Reader & { reads: Record<string, number> } {
  const reads: Record<string, number> = {}
  return {
    reads,
    rpc: base.rpc,
    rows: async (table: string, query: RowsQuery) => {
      await base.rows(table, query)
      reads[table] = (reads[table] ?? 0) + 1
      let rows = [...(rowsByTable[table] ?? [])]
      for (const f of query.filters ?? []) {
        if (f.op === 'eq') rows = rows.filter((r) => r[f.column] === f.value)
        else if (f.op === 'in') rows = rows.filter((r) => (f.value as unknown[]).includes(r[f.column]))
        else if (f.op === 'gt') rows = rows.filter((r) => String(r[f.column]) > String(f.value))
        else throw new Error(`pagingReader: no ${f.op}`)
      }
      for (const o of [...(query.order ?? [])].reverse()) rows.sort((a, b) => (String(a[o.column]) < String(b[o.column]) ? -1 : String(a[o.column]) > String(b[o.column]) ? 1 : 0) * (o.ascending === false ? -1 : 1))
      return rows.slice(0, Math.min(query.limit ?? 50, 200))
    },
  }
}

const pad = (n: number) => String(n).padStart(4, '0')

describe('the reads a big job outgrows (v2.6463)', () => {
  it('readAllRows takes every row a page at a time in key order, none twice, none skipped', async () => {
    const rows = Array.from({ length: 498 }, (_, i) => ({ id: `a${pad((i * 37) % 498)}`, job_id: JOB, amount: -1 }))
    const reader = pagingReader({ mercury_transaction_job_allocations: rows }, catalogReader({}))
    const read = await readAllRows(reader, 'mercury_transaction_job_allocations', { select: 'id,amount', filters: [{ column: 'job_id', op: 'eq', value: JOB }] })
    expect(read.capped).toBe(false)
    expect(read.rows).toHaveLength(498)
    expect(new Set(read.rows.map((r) => r.id)).size).toBe(498)
    expect(reader.reads.mercury_transaction_job_allocations).toBe(3)
  })

  it('a read that reaches the cap stops and says so; a select without the key cannot page', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => ({ id: `a${pad(i)}`, job_id: JOB }))
    const reader = pagingReader({ mercury_transaction_job_allocations: rows }, catalogReader({}))
    const capped = await readAllRows(reader, 'mercury_transaction_job_allocations', { select: 'id', filters: [] }, 'id', 400)
    expect(capped).toMatchObject({ capped: true })
    expect(capped.rows).toHaveLength(400)
    const keyless = pagingReader({ mercury_transaction_job_allocations: rows.map(({ job_id }) => ({ job_id, amount: -1 })) }, catalogReader({}))
    await expect(readAllRows(keyless, 'mercury_transaction_job_allocations', { select: 'amount', filters: [] })).rejects.toThrow('cannot page')
    expect(ALL_ROWS_MAX).toBe(5000)
  })

  it('get_job counts every card line, supply invoice and sheet item past the door’s 200', async () => {
    const card = Array.from({ length: 498 }, (_, i) => ({ id: `c${pad(i)}`, job_id: JOB, amount: -2, note: null, mercury_transaction_id: `t${i}`, mercury_transactions: { posted_at: '2026-09-02', counterparty_name: 'HD', amount: -2 } }))
    const supply = Array.from({ length: 230 }, (_, i) => ({ invoice_id: `i${pad(i)}`, job_id: JOB, pct: 100, supply_house_invoices: { invoice_number: `S${i}`, invoice_date: '2026-09-01', amount: 10, is_paid: true, on_job_account: false, supply_houses: { name: 'Morrison' } } }))
    const sheets = Array.from({ length: 120 }, (_, i) => ({ id: `s${pad(i)}`, job_ledger_id: JOB, job_number: '1032', labor_rate: 50, distance_miles: 0 }))
    const items = sheets.flatMap((s, i) => [0, 1].map((k) => ({ id: `it${pad(i)}${k}`, job_id: s.id, count: 1, hrs_per_unit: 1, is_fixed: false, labor_rate: null, direct_labor_amount: null })))
    const base = catalogReader({
      rows: { jobs_ledger: [{ id: JOB, click_number: '1032', revenue: 100000, materials: [], invoices: [], payments: [], team: [] }] },
      rpc: { get_invoice_amounts_for_jobs: [{ job_id: JOB, invoice_amount: '2300' }] },
    })
    const reader = pagingReader({ jobs_ledger: [{ id: JOB, click_number: '1032', revenue: 100000, materials: [], invoices: [], payments: [], team: [] }], service_types: [], mercury_transaction_job_allocations: card, supply_house_invoice_job_allocations: supply, people_labor_jobs: sheets, people_labor_job_items: items, app_settings: [] }, base)
    const out = (await getJob(reader, JOB, '2026-09-20')) as Record<string, unknown>
    expect(noErrors(out)).toEqual([])
    const money = out.money as { parts: Record<string, number>; counts: Record<string, number>; profit: { laborCost: number }; stopped_reads?: string[] }
    expect(money.counts).toMatchObject({ card_lines: 498, supply_invoice_lines: 230, sub_labor_sheets: 120 })
    expect(money.parts.card_charges).toBe(996)
    expect(money.profit.laborCost).toBe(120 * 2 * 50)
    expect(money).not.toHaveProperty('stopped_reads')
    // the sheet items go in reads of a hundred sheets, each one paged
    expect(reader.reads.people_labor_job_items).toBe(2 + 1)
  })
})

describe('read_on_site (v2.6367, punch list #209)', () => {
  const A2 = 'a2a2a2a2-0000-4000-8000-000000000a2a'
  const UNSORTED = 'c0c0c0c0-0000-4000-8000-00000000c0c0'
  const PLACE = 'd0d0d0d0-0000-4000-8000-00000000d0d0'
  const PART = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const mv = (id: string, over: Record<string, unknown>): Row => ({ id, job_id: JOB, part_id: PART, part_name: '3/4" copper 90', manufacturer: 'Nibco', quantity: 1, reason: 'used', from_container_id: null, to_container_id: null, note: '', source: null, item_id: null, by_user_id: null, by_name: 'Mateo', ...over })
  const movements = [
    mv('m1', { reason: 'delivered', quantity: 25, at: '2026-10-24T20:30:00Z', to_container_id: UNSORTED, by_name: 'Carla', source: 'INV-10422' }),
    mv('m2', { reason: 'moved', quantity: 25, at: '2026-10-27T13:00:00Z', from_container_id: UNSORTED, to_container_id: A2 }),
    mv('m3', { reason: 'used', quantity: 11, at: '2026-10-27T15:00:00Z', from_container_id: A2 }),
    mv('m4', { reason: 'counted', quantity: 12, at: '2026-10-28T18:48:00Z', from_container_id: A2, by_name: 'Jordan' }),
    mv('m5', { reason: 'delivered', quantity: 2, at: '2026-10-29T10:00:00Z', to_container_id: UNSORTED, part_id: null, part_name: '50 gal water heater', manufacturer: null, by_name: 'the receiving robot · MCP as Stephen', source: 'INV-10500' }),
  ]
  const rows = {
    jobs_ledger: [{ id: JOB, hcp_number: '972', click_number: '', job_name: 'ZZ Test job', job_address: '1 Test Way', service_type_id: 'st1' }],
    service_types: [{ id: 'st1', ledger_job_prefix: 'J', ledger_bid_prefix: 'B' }],
    job_places: [{ id: PLACE, job_id: JOB, name: 'Level 2', created_at: '2026-10-24T00:00:00Z' }],
    job_containers: [
      { id: UNSORTED, job_id: JOB, label: 'Unsorted', kind: 'unsorted', where_note: '', place_id: null, lat: null, lng: null, retired_at: null, created_at: '2026-10-24T20:00:00Z' },
      { id: A2, job_id: JOB, label: 'A2', kind: 'cage', where_note: 'by the north stair', place_id: PLACE, lat: 30.1, lng: -97.7, retired_at: null, created_at: '2026-10-24T21:00:00Z' },
      { id: 'b1b1b1b1-0000-4000-8000-0000000000b1', job_id: JOB, label: 'B1', kind: 'box', where_note: '', place_id: null, lat: null, lng: null, retired_at: '2026-10-30T00:00:00Z', created_at: '2026-10-25T00:00:00Z' },
    ],
    job_material_movements: movements,
  }
  type Loose = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  it('every read is one the door accepts, and the numbers are the kernel\'s: a count resets the line, Unsorted holds what nobody put away, a shortfall reads missing', async () => {
    const reader = catalogReader({ rows })
    const out = (await getOnSite(reader, JOB, new Date('2026-11-02T17:00:00Z'))) as Loose
    expect(noErrors(out)).toEqual([])
    expect(reader.asked).toEqual(expect.arrayContaining(['rows:jobs_ledger', 'rows:job_containers', 'rows:job_places', 'rows:job_material_movements']))
    expect(out.job.label).toBe('J972')
    expect(out.summary).toMatchObject({ containers: 1, retired: 1, lines_on_site: 2, waiting_in_unsorted: 1, due_a_count: [], missing_last_30_days: 1, ledger_rows: 5 })
    expect(out.summary.ledger_capped).toBeUndefined()
    const a2 = out.boxes.find((b: Loose) => b.container === 'A2')
    expect(a2).toMatchObject({ kind: 'cage', code: 'A2A2A2A2', place: 'Level 2', where: 'by the north stair', pinned: true, count_due: false, last_count: { at: '2026-10-28T18:48:00Z', by: 'Jordan' } })
    expect(a2.lines).toEqual([{ part: '3/4" copper 90 · Nibco', part_id: PART, on_hand: 12, last_touched: { at: '2026-10-28T18:48:00Z', by: 'Jordan' }, last_count_diff: -2, cannot_find_since_count: undefined }])
    const unsorted = out.boxes.find((b: Loose) => b.kind === 'unsorted')
    expect(unsorted.place).toBeNull()
    expect(unsorted.lines.map((l: Loose) => [l.part, l.on_hand])).toEqual([['50 gal water heater', 2]])
    expect(out.boxes.map((b: Loose) => b.container)).toEqual(['Unsorted', 'A2']) // the retired B1 is left out, Unsorted first
    expect(out.missing.counts_short).toEqual([{ container: 'A2', part: '3/4" copper 90 · Nibco', expected: 14, counted: 12, missing: 2, at: '2026-10-28T18:48:00Z', by: 'Jordan' }])
    expect(out.recent[0]).toMatchObject({ reason: 'delivered', to: 'Unsorted', by: 'the receiving robot · MCP as Stephen', source: 'INV-10500' })
    expect(out.recent).toHaveLength(5)
    // The same ledger through the screen's own kernel reads the same numbers.
    const kernel = containerLines(movements.map((r): Movement => ({ id: String(r.id), jobId: JOB, partId: (r.part_id as string | null) ?? null, partName: String(r.part_name), manufacturer: (r.manufacturer as string | null) ?? null, quantity: Number(r.quantity), reason: r.reason as Movement['reason'], fromContainerId: (r.from_container_id as string | null) ?? null, toContainerId: (r.to_container_id as string | null) ?? null, note: '', byUserId: null, byName: String(r.by_name), at: String(r.at), source: null, itemId: null })))
    expect(kernel.find((l) => l.containerId === A2)?.onHand).toBe(12)
    expect(onSiteBoxCode(A2)).toBe(boxCode(A2))
  })
  it('lists the retired boxes newest first with the screens\' own Bring back verdict: free, or the live box that carries the stencil now (v2.6406)', async () => {
    const oldA2 = { id: 'a0a0a0a0-0000-4000-8000-0000000000a0', job_id: JOB, label: 'a 2', kind: 'box', where_note: '', place_id: null, lat: null, lng: null, retired_at: '2026-10-20T00:00:00Z', created_at: '2026-10-01T00:00:00Z' }
    const out = (await getOnSite(catalogReader({ rows: { ...rows, job_containers: [...rows.job_containers, oldA2] } }), JOB, new Date('2026-11-02T17:00:00Z'))) as Loose
    expect(noErrors(out)).toEqual([])
    expect(out.summary.retired).toBe(2)
    expect(out.retired).toEqual([
      { container: 'B1', kind: 'box', id: 'b1b1b1b1-0000-4000-8000-0000000000b1', retired_at: '2026-10-30T00:00:00Z', bring_back: 'plan_container { action: bring_back }' },
      { container: 'a 2', kind: 'box', id: oldA2.id, retired_at: '2026-10-20T00:00:00Z', bring_back: 'A live cage on this job already carries a 2. Retire it first, or give it another stencil.' },
    ])
    expect(out.boxes.map((b: Loose) => b.container)).toEqual(['Unsorted', 'A2'])
    expect(out.writes).toContain('bring a retired one back')
  })
  it('a box 15 days past its count is due; a job with no boxes reads empty, not an error', async () => {
    const out = (await getOnSite(catalogReader({ rows: { ...rows, job_material_movements: movements.slice(0, 3) } }), JOB, new Date('2026-11-12T17:00:00Z'))) as Loose
    expect(out.summary.due_a_count).toEqual(['A2'])
    const empty = (await getOnSite(catalogReader({ rows: { jobs_ledger: rows.jobs_ledger, service_types: rows.service_types } }), JOB, new Date())) as Loose
    expect(noErrors(empty)).toEqual([])
    expect(empty.boxes).toEqual([])
    expect(empty.summary.containers).toBe(0)
  })
  it('reads the ledger a page at a time, oldest first, and dedupes the row a page boundary repeats', async () => {
    const all = Array.from({ length: 450 }, (_, i) => mv(`r${String(i).padStart(4, '0')}`, { at: `2026-10-${String(1 + Math.floor(i / 100)).padStart(2, '0')}T00:00:${String(i % 100).padStart(2, '0')}Z`, to_container_id: A2, reason: 'delivered' }))
    const reader = catalogReader({})
    const pages: string[] = []
    reader.rows = async (table, q) => {
      expect(table).toBe('job_material_movements')
      const since = q.filters?.find((f) => f.column === 'at' && f.op === 'gte')?.value as string | undefined
      pages.push(since ?? 'start')
      return all.filter((r) => !since || String(r.at) >= since).slice(0, q.limit)
    }
    const { movements: got, capped } = await readOnSiteMovements(reader, JOB)
    expect(got).toHaveLength(450)
    expect(new Set(got.map((m) => m.id)).size).toBe(450)
    expect(capped).toBe(false)
    expect(pages).toHaveLength(3)
  })
})
