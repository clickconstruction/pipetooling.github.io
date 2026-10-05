import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CARD_CHARGES_WINDOW_RPC,
  cardChargeWindowRowFromRpc,
  fetchCardChargesWindow,
  type CardChargesWindowClient,
  type CardChargesWindowRpcRow,
} from './cardChargesWindow'

function rpcRow(i: number, over: Partial<CardChargesWindowRpcRow> = {}): CardChargesWindowRpcRow {
  return {
    mercury_transaction_id: `tx${i}`,
    posted_at: new Date(Date.UTC(2026, 8, 1) + i * 3600_000).toISOString(),
    amount: -10,
    counterparty_name: 'Store',
    kind: 'debitCardTransaction',
    status: 'sent',
    bank_category: null,
    debit_card_id: null,
    card_nickname: null,
    card_role: null,
    holder_user_id: null,
    holder_name: null,
    attributed_user_id: null,
    attributed_person_id: null,
    label_id: null,
    label_default_key: null,
    payroll_marked: false,
    job_splits: [],
    invoice_links: [],
    sorted_at: null,
    sorted_by_name: null,
    viewer_can_sort: true,
    ...over,
  }
}

/** A stub of `supabase.rpc(name, params).range(...)` that caps an un-ranged read at 1,000 rows, as PostgREST does. */
function makeRpcStub(total: number, opts: { failOnCall?: number } = {}) {
  const rows = Array.from({ length: total }, (_, i) => rpcRow(i))
  const calls: Array<{ rpc: string; params: unknown; range: [number, number] | null }> = []
  const client = {
    rpc: (name: string, params: unknown) => {
      const call = { rpc: name, params, range: null as [number, number] | null }
      const builder = {
        range: (from: number, to: number) => {
          call.range = [from, to]
          return builder
        },
        then: (resolve: (r: { data: unknown[] | null; error: { message: string } | null }) => unknown) => {
          calls.push(call)
          if (opts.failOnCall === calls.length) return Promise.resolve({ data: null, error: { message: 'boom' } }).then(resolve)
          const slice = call.range ? rows.slice(call.range[0], call.range[1] + 1) : rows.slice(0, 1000)
          return Promise.resolve({ data: slice, error: null }).then(resolve)
        },
      }
      return builder
    },
  } as unknown as CardChargesWindowClient
  return { client, calls }
}

describe('fetchCardChargesWindow', () => {
  it('pages past the 1,000-row cap and passes the window', async () => {
    const { client, calls } = makeRpcStub(1300)
    const rows = await fetchCardChargesWindow({ startYmd: '2026-07-08', endYmd: '2026-10-05' }, client)
    expect(calls.map((c) => c.rpc)).toEqual([CARD_CHARGES_WINDOW_RPC, CARD_CHARGES_WINDOW_RPC])
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(calls[0]?.params).toEqual({ p_start_ymd: '2026-07-08', p_end_ymd: '2026-10-05' })
    expect(rows).toHaveLength(1300)
    expect(rows[1299]?.id).toBe('tx1299')
  })

  it('reads one page when it comes back short', async () => {
    const { client, calls } = makeRpcStub(3)
    const rows = await fetchCardChargesWindow({ startYmd: '2026-09-05', endYmd: '2026-10-05' }, client)
    expect(calls).toHaveLength(1)
    expect(rows).toHaveLength(3)
  })

  it('throws on a failed page instead of returning a short list', async () => {
    const { client } = makeRpcStub(1300, { failOnCall: 2 })
    await expect(fetchCardChargesWindow({ startYmd: '2026-07-08', endYmd: '2026-10-05' }, client, 'window test')).rejects.toThrow()
  })
})

// The database checks the sql rows function when the migration creates it, but the plpgsql
// wrapper's RETURN QUERY is matched to its declared columns only at the first call. These keep
// the two lists — and the client's row type — the same, here, before any push.
const MIGRATION = readFileSync(join(__dirname, '../../../supabase/migrations/20261005212106_card_charges_window.sql'), 'utf8')

function returnsTableColumns(sql: string, fn: string): string[] {
  const head = `CREATE OR REPLACE FUNCTION public.${fn}(`
  const start = sql.indexOf(head)
  expect(start, `${fn} is created once`).toBeGreaterThanOrEqual(0)
  expect(sql.indexOf(head, start + 1), `${fn} is created once`).toBe(-1)
  const open = sql.indexOf('RETURNS TABLE (', start) + 'RETURNS TABLE ('.length
  const close = sql.indexOf('\n)', open)
  return sql
    .slice(open, close)
    .split(',')
    .map((c) => c.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
}

describe('the migration', () => {
  it('the wrapper returns exactly the columns of the checked sql function, in order, with their types', () => {
    const rows = returnsTableColumns(MIGRATION, '_card_charges_window_rows')
    expect(rows).toHaveLength(22)
    expect(returnsTableColumns(MIGRATION, 'list_card_charges_window')).toEqual(rows)
  })

  it('the client row type names every column the function returns', () => {
    const names = returnsTableColumns(MIGRATION, 'list_card_charges_window').map((c) => c.split(' ')[0])
    expect(Object.keys(rpcRow(0)).sort()).toEqual([...names].sort())
  })

  it('the rows function is sql (checked at create) and only the wrapper calls it', () => {
    const rowsFn = MIGRATION.slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public._card_charges_window_rows('), MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.list_card_charges_window('))
    expect(rowsFn).toMatch(/\nLANGUAGE sql\n/)
    for (const role of ['PUBLIC', 'anon', 'authenticated']) {
      expect(MIGRATION).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\._card_charges_window_rows\\([^)]*\\) FROM ${role};`))
    }
    expect(MIGRATION).not.toMatch(/GRANT [A-Z ,]*ON FUNCTION public\._card_charges_window_rows/)
    expect(MIGRATION).toMatch(/GRANT EXECUTE ON FUNCTION public\.list_card_charges_window\(date, date\) TO authenticated;/)
  })

  it('the wrapper checks the role before anything else and passes the payroll marks’ own rule', () => {
    const wrapper = MIGRATION.slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.list_card_charges_window('))
    const body = wrapper.slice(wrapper.indexOf('BEGIN'))
    expect(body.indexOf('IF NOT public.is_office_staff() THEN')).toBeGreaterThan(0)
    expect(body.indexOf('IF NOT public.is_office_staff() THEN')).toBeLessThan(body.indexOf('IF p_start_ymd IS NULL'))
    expect(body).toMatch(/_card_charges_window_rows\(v_lo, v_hi, auth\.uid\(\), public\.has_payroll_access\(\)\)/)
  })
})

describe('cardChargeWindowRowFromRpc', () => {
  it('reads the splits and invoice links with the Sorted RPC’s keys', () => {
    const row = cardChargeWindowRowFromRpc(
      rpcRow(1, {
        amount: '-42.50',
        holder_user_id: 'u-1',
        holder_name: 'Malachi R.',
        payroll_marked: null,
        viewer_can_sort: false,
        job_splits: [
          { job_id: 'j1', amount: -30, note: null, hcp_number: '101', click_number: null, job_name: 'Main St', service_type_id: 'st', created_at: '2026-09-02T15:00:00Z', created_by: 'u-2' },
          { job_id: 'j2', amount: '-12.50', hcp_number: null, click_number: 'C-7', job_name: 'Oak Ave' },
        ],
        invoice_links: [{ invoice_id: 'inv-1', invoice_number: '4471', invoice_date: '2026-09-01', amount: 42.5, supply_house_name: 'Ferguson', created_at: '2026-09-03T15:00:00Z' }],
      }),
    )
    expect(row).toMatchObject({ id: 'tx1', amount: -42.5, holderUserId: 'u-1', holderName: 'Malachi R.', payrollMarked: false, viewerCanSort: false })
    expect(row.splits).toEqual([
      { jobId: 'j1', amount: -30, hcpNumber: '101', clickNumber: null, jobName: 'Main St', serviceTypeId: 'st' },
      { jobId: 'j2', amount: -12.5, hcpNumber: null, clickNumber: 'C-7', jobName: 'Oak Ave', serviceTypeId: null },
    ])
    expect(row.invoiceLinks).toEqual([{ invoiceId: 'inv-1', invoiceNumber: '4471', supplyHouseName: 'Ferguson', amount: 42.5 }])
  })

  it('blank text is null and a bad amount is 0', () => {
    const row = cardChargeWindowRowFromRpc(rpcRow(2, { amount: 'n/a', counterparty_name: '  ', bank_category: '', job_splits: null, invoice_links: null }))
    expect(row).toMatchObject({ amount: 0, counterpartyName: null, bankCategory: null, splits: [], invoiceLinks: [] })
  })
})
