import { describe, expect, it } from 'vitest'
import { CATALOG_RPCS, CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { buildRowsQuery, buildRpcQuery } from '../../../supabase/functions/_shared/devMcpDoor'
import { findBid, findCustomer, findJob, findPerson, getBid, getCustomer, getJob, jobNumberOf, type Reader, type Row, type RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
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
