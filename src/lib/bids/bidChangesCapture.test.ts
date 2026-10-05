/**
 * Bid history is written by one database trigger, `record_bid_change()`, attached to the tables
 * that hold what people type on a bid (punch list #73, PR 1). The SQL cannot run here, so this pins
 * the migration's two lists to the generated types: every table it attaches to must exist, and
 * every `bids` column `bid_changes_bid_columns()` names must be a column of `bids`. A misspelled
 * name would otherwise fail only at `supabase db push` (CREATE TRIGGER … UPDATE OF errors), and a
 * renamed column would silently stop being recorded. The trigger itself is run by
 * `npm run test:pg:bid-changes`.
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
