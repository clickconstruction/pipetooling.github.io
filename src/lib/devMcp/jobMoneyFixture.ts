import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import type { BankRow, PayInvoiceRow, PayJobRow, PayRow } from '../../../supabase/functions/_shared/devMcpJobPayment'
import type { CombineJobRow } from '../../../supabase/functions/_shared/devMcpJobCombine'

/**
 * The made-up world the payment and combine verbs' tests run on (v2.6940): an old shell job that reads paid from a
 * payment row typed in months later with nothing behind it, beside the real job that holds the wire. Every name,
 * number, amount and id here is invented.
 *
 * `fakeRest` answers the two reads the kernels make — rows and an exact count — and refuses what PostgREST would: a
 * table, a select column, an order column or a filter column the generated catalog does not have. A kernel that
 * names a column the table lacks fails here, not live.
 */

export const DEV = 'ffffffff-1111-4111-8111-111111111111'
export const SHELL = '11111111-aaaa-4aaa-8aaa-000000000001'
export const REAL = '22222222-bbbb-4bbb-8bbb-000000000002'
export const SHELL_PAY = '33333333-cccc-4ccc-8ccc-000000000003'
export const REAL_PAY = '44444444-dddd-4ddd-8ddd-000000000004'
export const WIRE = '55555555-eeee-4eee-8eee-000000000005'
export const CUSTOMER = '66666666-ffff-4fff-8fff-000000000006'
export const OTHER_CUSTOMER = '77777777-abab-4bab-8bab-000000000007'
export const BILL = '88888888-cdcd-4dcd-8dcd-000000000008'
export const TODAY = '2026-11-11'

type Row = Record<string, unknown>

export const shellJob = (over: Partial<CombineJobRow> = {}): CombineJobRow => ({
  id: SHELL, job_name: 'ZZ TEST Maple Court shell', job_address: '10 Maple Court', click_number: '', hcp_number: '5501', status: 'paid', pct_complete: 100,
  revenue: 1000, payments_made: 1000, customer_id: CUSTOMER, customer_name: 'ZZ TEST Builder', prior_numbers: [], updated_at: '2026-06-02T15:00:00+00:00', ...over,
})
export const realJob = (over: Partial<CombineJobRow> = {}): CombineJobRow => ({
  id: REAL, job_name: 'ZZ TEST Maple Court', job_address: '10 Maple Court', click_number: '9001', hcp_number: '', status: 'paid', pct_complete: 100,
  revenue: 1000, payments_made: 1000, customer_id: CUSTOMER, customer_name: 'ZZ TEST Builder', prior_numbers: ['HCP 4400'], updated_at: '2026-03-04T15:00:00+00:00', ...over,
})
/** The row typed in months later: an amount and a day, and nothing that says where the money came from. */
export const shellPayment = (over: Partial<PayRow> = {}): PayRow => ({
  id: SHELL_PAY, job_id: SHELL, amount: 1000, paid_on: '2026-03-02', sent_on: null, note: null, payment_type: null, reference_number: null, invoice_id: null,
  mercury_transaction_id: null, stripe_credit_note_id: null, sequence_order: 0, created_at: '2026-06-02T15:00:00+00:00', created_by: DEV, ...over,
})
/** The real job's payment, tied to the wire. */
export const realPayment = (over: Partial<PayRow> = {}): PayRow => ({
  id: REAL_PAY, job_id: REAL, amount: 1000, paid_on: '2026-03-02', sent_on: null, note: null, payment_type: 'Wire', reference_number: 'ZZ-WIRE-1', invoice_id: null,
  mercury_transaction_id: WIRE, stripe_credit_note_id: null, sequence_order: 0, created_at: '2026-03-03T15:00:00+00:00', created_by: DEV, ...over,
})
export const wire = (over: Partial<BankRow> = {}): BankRow => ({ id: WIRE, amount: 1000, posted_at: '2026-03-02T17:00:00+00:00', status: 'sent', kind: 'incomingDomesticWire', counterparty_name: 'ZZ TEST Builder LLC', ...over })
export const bill = (over: Partial<PayInvoiceRow> & { job_id?: string } = {}): PayInvoiceRow & { job_id: string; sequence_order: number } => ({ id: BILL, job_id: SHELL, amount: 1000, status: 'paid', stripe_invoice_id: null, stripe_invoice_status: null, sequence_order: 0, ...over })

export const payJob = (job: CombineJobRow): PayJobRow => job

/** The two jobs as they stand before anything is fixed. */
export function standingWorld(over: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    jobs_ledger: [shellJob(), realJob()],
    jobs_ledger_payments: [shellPayment(), realPayment()],
    jobs_ledger_invoices: [],
    mercury_transactions: [wire()],
    ...over,
  }
}

export function fakeRest(data: Record<string, Row[]>): { asked: string[]; rows(table: string, query: string): Promise<Row[]>; count(table: string, query: string): Promise<number> } {
  const asked: string[] = []
  const match = (table: string, query: string): Row[] => {
    const columns = CATALOG_TABLES[table]?.columns
    if (!columns) throw new Error(`table ${table} is not in the catalog`)
    const known = (c: string, where: string) => {
      if (!(c in columns)) throw new Error(`${table} has no column ${c} (${where})`)
    }
    let rows = [...(data[table] ?? [])]
    for (const pair of query.split('&').filter(Boolean)) {
      const at = pair.indexOf('=')
      const k = pair.slice(0, at)
      const v = pair.slice(at + 1)
      if (k === 'select') {
        for (const c of v.split(',')) known(c, 'select')
      } else if (k === 'order') {
        for (const c of v.split(',')) known(c.split('.')[0]!, 'order')
      } else if (k !== 'limit') {
        known(k, 'filter')
        if (v.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === v.slice(3))
        else if (v.startsWith('neq.')) rows = rows.filter((r) => String(r[k]) !== v.slice(4))
        else if (v === 'is.null') rows = rows.filter((r) => r[k] == null)
        else if (v.startsWith('in.(')) rows = rows.filter((r) => v.slice(4, -1).split(',').includes(String(r[k])))
        else throw new Error(`fakeRest: no filter ${v}`)
      }
    }
    return rows
  }
  return {
    asked,
    rows: async (table, query) => {
      asked.push(`${table}?${query}`)
      return match(table, query)
    },
    count: async (table, query) => {
      asked.push(`count ${table}?${query}`)
      return match(table, query).length
    },
  }
}
