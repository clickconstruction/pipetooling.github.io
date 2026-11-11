import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import type { BankAllocationRow, BankLineRow, BankRow, JobMoney, LaborJobRow, LaborPersonRow, LaborUserRow, SheetItemRow, SheetPayRow, SheetRow, SubLaborReads } from '../../../supabase/functions/_shared/devMcpSubLabor'

/**
 * The made-up world the sub labor verbs' tests run on (v2.6944): one job, one subcontractor with no login whose days
 * on it are known from their own day log, a teammate who is not a sub, a sub on the bench and one who left, and a
 * bank row that paid the sub and was allocated to the job as cost. Every name, number, amount and id is invented.
 *
 * `fakeRest` answers the kernel's one read and refuses what PostgREST would: a table, a select column, an embed, an
 * order column or a filter column the generated catalog does not have. A kernel that names a column the table lacks
 * fails here, not live.
 */

export const DEV = 'ffffffff-1111-4111-8111-111111111111'
export const JOB = 'aaaaaaaa-0000-4000-8000-000000000001'
export const OTHER_JOB = 'aaaaaaaa-0000-4000-8000-000000000002'
export const SUB_USER = 'bbbbbbbb-0000-4000-8000-000000000001'
export const SUB_ROW = 'bbbbbbbb-0000-4000-8000-000000000002'
export const MASTER_USER = 'bbbbbbbb-0000-4000-8000-000000000003'
export const MASTER_ROW = 'bbbbbbbb-0000-4000-8000-000000000004'
export const BENCH_ROW = 'bbbbbbbb-0000-4000-8000-000000000005'
export const GONE_ROW = 'bbbbbbbb-0000-4000-8000-000000000006'
export const TWIN_USER = 'bbbbbbbb-0000-4000-8000-000000000007'
export const SHEET = 'cccccccc-0000-4000-8000-000000000001'
export const SHEET_LINE = 'cccccccc-0000-4000-8000-000000000002'
export const SHEET_PAY = 'cccccccc-0000-4000-8000-000000000003'
export const BANK = 'dddddddd-0000-4000-8000-000000000001'
export const ALLOC = 'dddddddd-0000-4000-8000-000000000002'
export const TODAY = '2026-11-11'

type Row = Record<string, unknown>

export const job = (over: Partial<LaborJobRow> = {}): LaborJobRow => ({ id: JOB, job_name: 'ZZ TEST Cedar Ridge', job_address: '12 Cedar Ridge Rd', click_number: '9102', hcp_number: '', status: 'working', revenue: 20000, customer_name: 'ZZ TEST Builder', ...over })
export const otherJob = (over: Partial<LaborJobRow> = {}): LaborJobRow => job({ id: OTHER_JOB, job_name: 'ZZ TEST Birch Lane', job_address: '4 Birch Lane', click_number: '9103', ...over })

/** The sub: a users row with no login, and the roster row linked to it. */
export const subUser = (over: Partial<LaborUserRow> = {}): LaborUserRow => ({ id: SUB_USER, name: 'ZZ Sample Sub', email: null, role: 'subcontractor', archived_at: null, is_sample: false, is_digital_twin: false, ...over })
export const subRow = (over: Partial<LaborPersonRow> = {}): LaborPersonRow => ({ id: SUB_ROW, name: 'ZZ Sample Sub', kind: 'sub', email: null, end_date: null, archived_at: null, account_user_id: SUB_USER, ...over })
export const masterUser = (over: Partial<LaborUserRow> = {}): LaborUserRow => ({ id: MASTER_USER, name: 'ZZ Sample Master', email: 'master@example.test', role: 'master_technician', archived_at: null, is_sample: false, is_digital_twin: false, ...over })
export const masterRow = (over: Partial<LaborPersonRow> = {}): LaborPersonRow => ({ id: MASTER_ROW, name: 'ZZ Sample Master', kind: 'master_technician', email: 'master@example.test', end_date: null, archived_at: null, account_user_id: MASTER_USER, ...over })
export const benchRow = (over: Partial<LaborPersonRow> = {}): LaborPersonRow => ({ id: BENCH_ROW, name: 'ZZ Bench Sub', kind: 'sub', email: null, end_date: '2026-08-01', archived_at: null, account_user_id: null, ...over })
export const goneRow = (over: Partial<LaborPersonRow> = {}): LaborPersonRow => ({ id: GONE_ROW, name: 'ZZ Gone Sub', kind: 'sub', email: null, end_date: null, archived_at: '2026-07-01T12:00:00+00:00', account_user_id: null, ...over })
export const twinUser = (over: Partial<LaborUserRow> = {}): LaborUserRow => ({ id: TWIN_USER, name: 'ZZ Twin Estimator', email: null, role: 'estimator', archived_at: null, is_sample: false, is_digital_twin: true, ...over })

/** A sheet the sub already holds on the job: one flat line of $600 on 2026-10-15. */
export const sheet = (over: Partial<SheetRow> = {}): SheetRow => ({ id: SHEET, master_user_id: DEV, assigned_to_name: 'ZZ Sample Sub', address: '12 Cedar Ridge Rd', job_number: '9102', job_ledger_id: JOB, labor_rate: 20, distance_miles: 0, job_date: '2026-10-15', created_at: '2026-10-16T15:00:00+00:00', stage: 'working', step_id: null, ...over })
export const sheetLine = (over: Partial<SheetItemRow> = {}): SheetItemRow => ({ id: SHEET_LINE, job_id: SHEET, fixture: 'Set fixtures, unit 4', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: null, direct_labor_amount: 600, sequence_order: 1, ...over })
export const sheetPay = (over: Partial<SheetPayRow> = {}): SheetPayRow => ({ id: SHEET_PAY, job_id: SHEET, amount: 200, memo: 'ACH', payment_date: '2026-10-20', hidden_from_sub: false, sequence_order: 0, created_at: '2026-10-21T15:00:00+00:00', ...over })

/** The bank row that paid the sub $1,800, and its split onto the job as cost. */
export const bank = (over: Partial<BankRow> = {}): BankRow => ({ id: BANK, amount: -1800, posted_at: '2026-10-20T17:00:00+00:00', status: 'sent', kind: 'externalTransfer', counterparty_name: 'ZZ SAMPLE SUB LLC', ...over })
type BankLineWithJob = BankLineRow & { jobs_ledger: BankAllocationRow['jobs_ledger'] }
export const bankLine = (over: Partial<BankLineWithJob> = {}): BankLineWithJob => ({
  id: ALLOC,
  amount: -1800,
  note: 'October labor',
  job_id: JOB,
  mercury_transaction_id: BANK,
  mercury_transactions: { posted_at: '2026-10-20T17:00:00+00:00', counterparty_name: 'ZZ SAMPLE SUB LLC', amount: -1800 },
  jobs_ledger: { job_name: 'ZZ TEST Cedar Ridge', click_number: '9102', hcp_number: '' },
  ...over,
})

/** The job and the people, with no sheet and no bank row on the job yet. */
export function standingWorld(over: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    jobs_ledger: [job(), otherJob()],
    users: [subUser(), masterUser(), twinUser()],
    people: [subRow(), masterRow(), benchRow(), goneRow()],
    people_labor_jobs: [],
    people_labor_job_items: [],
    people_labor_job_payments: [],
    people_labor_job_assignees: [],
    app_settings: [],
    mercury_transactions: [bank()],
    mercury_transaction_job_allocations: [],
    ...over,
  }
}

/** The same world with the sub's $600 sheet on the job, tied to their roster row. */
export function worldWithSheet(over: Record<string, Row[]> = {}): Record<string, Row[]> {
  return standingWorld({ people_labor_jobs: [sheet()], people_labor_job_items: [sheetLine()], people_labor_job_assignees: [{ labor_job_id: SHEET, person_id: SUB_ROW }], ...over })
}

/** The profit band a job reads before the sheet: $20,000 billed, $4,000 of parts, no sub labor. */
export const MONEY: JobMoney = { profit: { laborCost: 0, partsCost: 4000, totalBill: 20000, profit: 16000 } }

function splitTop(v: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of v) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

export function fakeRest(data: Record<string, Row[]>, money: JobMoney | null = MONEY): SubLaborReads & { asked: string[] } {
  const asked: string[] = []
  const columnsOf = (table: string) => {
    const columns = CATALOG_TABLES[table]?.columns
    if (!columns) throw new Error(`table ${table} is not in the catalog`)
    return columns
  }
  const match = (table: string, query: string): Row[] => {
    const columns = columnsOf(table)
    const known = (c: string, where: string) => {
      if (!(c in columns)) throw new Error(`${table} has no column ${c} (${where})`)
    }
    let rows = [...(data[table] ?? [])]
    for (const pair of query.split('&').filter(Boolean)) {
      const at = pair.indexOf('=')
      const k = pair.slice(0, at)
      const v = pair.slice(at + 1)
      if (k === 'select') {
        for (const c of splitTop(v)) {
          const embed = /^([a-z_]+)\((.*)\)$/.exec(c)
          if (!embed) known(c, 'select')
          else for (const ec of embed[2]!.split(',')) if (!(ec in columnsOf(embed[1]!))) throw new Error(`${embed[1]} has no column ${ec} (embed)`)
        }
      } else if (k === 'order') {
        for (const c of v.split(',')) known(c.split('.')[0]!, 'order')
      } else if (k !== 'limit') {
        known(k, 'filter')
        if (v.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === v.slice(3))
        else if (v.startsWith('ilike.')) rows = rows.filter((r) => String(r[k] ?? '').toLowerCase() === decodeURIComponent(v.slice(6)).toLowerCase())
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
    ...(money ? { money: async () => money } : {}),
  }
}
