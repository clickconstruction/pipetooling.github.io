/**
 * Bid history is written by one database trigger, `record_bid_change()`, attached to the tables
 * that hold what people type on a bid (punch list #73, PR 1). The SQL cannot run here, so this pins
 * the migration to the generated types: every table it attaches to must exist, every `bids` column
 * `bid_changes_bid_columns()` names must be a column of `bids`, and every column the function reads
 * by name must exist on the table it reads it from. A misspelled list entry would otherwise fail
 * only at `supabase db push` (CREATE TRIGGER … UPDATE OF errors); a renamed column the function
 * reads would turn capture off for that table with no error anywhere, because the trigger catches
 * its own errors. The trigger itself is run by `npm run test:pg:bid-changes`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')
const TYPES = readFileSync(resolve(ROOT, 'src/types/database.ts'), 'utf8')

/** Every table's columns, read off the generated `Row` blocks. */
const tableColumns = (() => {
  const tables = TYPES.slice(TYPES.indexOf('\n    Tables: {', TYPES.indexOf('  public: {')), TYPES.indexOf('\n    Views: {', TYPES.indexOf('  public: {')))
  const out = new Map<string, string[]>()
  for (const m of tables.matchAll(/\n {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/g)) {
    out.set(m[1]!, [...m[2]!.matchAll(/^ {10}(\w+)\??:/gm)].map((c) => c[1]!))
  }
  return out
})()

const migrationFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
const migrationSql = new Map(migrationFiles.map((f) => [f, readFileSync(resolve(MIGRATIONS, f), 'utf8')]))

/** The names in the newest definition of a function that returns `ARRAY[ … ]::text[]`. */
function newestList(name: string): string[] {
  const marker = `CREATE OR REPLACE FUNCTION public.${name}()`
  const file = migrationFiles.filter((f) => migrationSql.get(f)!.includes(marker)).pop()
  expect(file, `a migration defines ${name}`).toBeDefined()
  const sql = migrationSql.get(file!)!
  const array = /ARRAY\[([\s\S]*?)\]::text\[\]/.exec(sql.slice(sql.indexOf(marker)))
  expect(array, `${name} returns an ARRAY[…]::text[]`).not.toBeNull()
  return [...array![1]!.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!)
}

const bidColumns = newestList('bid_changes_bid_columns')
const triggerTables = newestList('bid_changes_tables')

/** The newest body of `record_bid_change()`: from its last CREATE to the `$$;` that closes it. */
const triggerBody = (() => {
  const marker = 'CREATE OR REPLACE FUNCTION public.record_bid_change()'
  const file = migrationFiles.filter((f) => migrationSql.get(f)!.includes(marker)).pop()
  expect(file, 'a migration defines record_bid_change').toBeDefined()
  const sql = migrationSql.get(file!)!
  const start = sql.indexOf(marker)
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('AS $$', start)))
})()

/**
 * The columns `record_bid_change()` reads off the written row, table by table. Mirrors the
 * function: when it starts reading a new column, add it here (the last test below fails until then).
 */
const DIRECT_COST = ['id', 'cost_estimate_id', 'note']
const READS: Record<string, string[]> = {
  bids: ['id'],
  bids_count_rows: ['id', 'bid_id', 'fixture', 'bid_version_id'],
  bid_count_row_custom_prices: ['id', 'bid_id', 'count_row_id'],
  bid_count_row_custom_costs: ['id', 'bid_id', 'count_row_id', 'house_name'],
  bid_pricing_assignments: ['id', 'bid_id', 'count_row_id'],
  bids_takeoff_rough_part_lines: ['id', 'bid_id', 'count_row_id', 'bid_version_id', 'part_id'],
  bid_takeoff_stage_splits: ['id', 'bid_id', 'count_row_id'],
  cost_estimates: ['id', 'bid_id'],
  cost_estimate_labor_rows: ['id', 'cost_estimate_id', 'fixture'],
  cost_estimate_equipment_rows: DIRECT_COST,
  cost_estimate_other_rows: DIRECT_COST,
  cost_estimate_permit_rows: DIRECT_COST,
  cost_estimate_subcontractor_rows: DIRECT_COST,
  cost_estimate_waste_rows: DIRECT_COST,
  bid_sov_lines: ['id', 'bid_id', 'label'],
  bid_payment_schedule_rows: ['id', 'bid_id', 'timing'],
  bid_versions: ['id', 'bid_id', 'name'],
}

/** The tables it looks a row up in (the parent, or the archive's snapshot of it), and what it reads there. */
const LOOKUPS: Record<string, string[]> = {
  bids: ['id'],
  bids_count_rows: ['id', 'fixture', 'bid_version_id'],
  cost_estimates: ['id', 'bid_id'],
  material_parts: ['id', 'name'],
  deleted_records_archive: ['table_name', 'record_id', 'row_data', 'deleted_at'],
}

describe('the generated types still read as this test expects', () => {
  it('finds bids and its columns', () => {
    expect(tableColumns.get('bids')).toContain('bid_value')
    expect(tableColumns.get('bids_count_rows')).toContain('fixture')
  })
})

describe('bid history: what the trigger is attached to', () => {
  it('names seventeen tables, each one a table in the generated types', () => {
    expect(triggerTables).toHaveLength(17)
    expect(new Set(triggerTables).size).toBe(17)
    for (const t of triggerTables) expect(tableColumns.has(t), `${t} is a table`).toBe(true)
  })

  it('leaves out By Stage’s mappings table (nothing writes it since v2.4396)', () => {
    expect(triggerTables).not.toContain('bids_takeoff_template_mappings')
  })

  it('attaches to bids last, so its lock is held the shortest', () => {
    expect(triggerTables[triggerTables.length - 1]).toBe('bids')
  })

  it('reads every table it labels: each has an id, and a bid id or a cost estimate', () => {
    for (const t of triggerTables) {
      const cols = tableColumns.get(t)!
      expect(cols, `${t} has an id`).toContain('id')
      if (t !== 'bids') expect(cols.includes('bid_id') || cols.includes('cost_estimate_id'), `${t} reaches its bid`).toBe(true)
    }
  })
})

describe('bid history: the bids columns it records', () => {
  it('names only columns of bids, once each', () => {
    const bids = new Set(tableColumns.get('bids'))
    for (const c of bidColumns) expect(bids.has(c), `bids.${c} exists`).toBe(true)
    expect(new Set(bidColumns).size).toBe(bidColumns.length)
  })

  it('keeps what Edit Bid saves and leaves out the stamps and the robots', () => {
    for (const c of ['bid_value', 'agreed_value', 'notes', 'outcome', 'bid_due_date', 'selected_price_book_version_id', 'alternate_group_tags']) {
      expect(bidColumns, c).toContain(c)
    }
    for (const c of bidColumns) expect(c, `${c} is not a stamp or a robot column`).not.toMatch(/^(updated_at|created_at|created_by|robot_|plans_robot_|twin_|backtest_|working_board_|next_followup_|last_contact)|_ack_|_attested_/)
  })
})

describe('bid history: the columns the trigger reads by name', () => {
  it('names a row of reads for exactly the seventeen tables', () => {
    expect(Object.keys(READS).sort()).toEqual([...triggerTables].sort())
  })

  it('reads only columns each table has', () => {
    for (const [table, cols] of Object.entries(READS)) {
      const have = new Set(tableColumns.get(table))
      for (const c of cols) expect(have.has(c), `${table}.${c} exists`).toBe(true)
    }
  })

  it('looks up only columns the parents and the archive have', () => {
    for (const [table, cols] of Object.entries(LOOKUPS)) {
      const have = new Set(tableColumns.get(table))
      for (const c of cols) expect(have.has(c), `${table}.${c} exists`).toBe(true)
    }
  })

  it('pins every key the function reads off a row or a snapshot', () => {
    const read = new Set([...triggerBody.matchAll(/(?:->>|\?)\s*'([a-z_]+)'/g)].map((m) => m[1]!))
    expect(read.size, 'the function reads keys by name').toBeGreaterThan(5)
    const pinned = new Set([...Object.values(READS).flat(), ...LOOKUPS.bids_count_rows!, ...LOOKUPS.cost_estimates!])
    for (const k of read) expect(pinned.has(k), `the key ${k} is pinned above`).toBe(true)
  })

  it('branches only on the seventeen tables', () => {
    const named = [
      ...[...triggerBody.matchAll(/TG_TABLE_NAME\s*(?:=|<>)\s*'([a-z_]+)'/g)].map((m) => m[1]!),
      ...[...triggerBody.matchAll(/TG_TABLE_NAME\s+IN\s*\(([^)]*)\)/g)].flatMap((m) => [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((n) => n[1]!)),
    ]
    expect(named.length, 'the function branches by table').toBeGreaterThan(5)
    for (const t of named) expect(triggerTables, `${t} is one of the seventeen`).toContain(t)
  })
})
