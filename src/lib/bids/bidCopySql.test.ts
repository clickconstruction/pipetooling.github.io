/**
 * The four functions that copy or move a bid's takeoff (a new version, the count-row clone it
 * calls, a duplicate, an adopt) name their columns one by one, so a column added to a table later
 * is silently left out of every copy. That is how a new version lost its stage boxes and its Sold
 * in rule (v2.4388, punch list #78). The SQL cannot run here, so these pin each function's newest
 * body to the generated types: a new column, or a new table that hangs off a count row, fails
 * here until the copy learns it or it is listed below with the reason it stays behind.
 * The copies themselves are run by `npm run test:pg:combined-copies`.
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

/** The newest body of a function: from its last CREATE to the `$$;` that closes it. */
function newestBody(name: string): string {
  const create = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION "?public"?\\."?${name}"?\\s*\\(`)
  const file = migrationFiles.filter((f) => create.test(migrationSql.get(f)!)).pop()
  expect(file, `a migration defines ${name}`).toBeDefined()
  const sql = migrationSql.get(file!)!
  const start = sql.search(create)
  return sql.slice(start, sql.indexOf('$$;', start))
}

/** The columns a body's INSERTs into a table name, across every INSERT into it. */
function insertedColumns(body: string, table: string): Set<string> {
  const cols = new Set<string>()
  for (const m of body.matchAll(new RegExp(`INSERT INTO public\\.${table}\\s*\\(([^)]*)\\)`, 'g'))) {
    for (const c of m[1]!.split(',')) cols.add(c.trim())
  }
  return cols
}

const versionBody = newestBody('create_bid_version')
const cloneBody = newestBody('clone_count_rows_to_bid_version')
const duplicateBody = newestBody('duplicate_bid_to_service_type')
const adoptBody = newestBody('adopt_bid_as_version')

/** Columns no copy carries: the row's own identity and clock. */
const OWN = ['id', 'created_at', 'updated_at']

describe('the generated types still read as this test expects', () => {
  it('finds the takeoff tables and their columns', () => {
    expect(tableColumns.get('bids_takeoff_rough_part_lines')).toContain('order_increment')
    expect(tableColumns.get('bid_takeoff_stage_splits')).toEqual(expect.arrayContaining(['count_row_id', 'line_id', 'part_id', 'rough_in', 'source']))
    expect(tableColumns.size).toBeGreaterThan(100)
  })
})

describe('a copy of a takeoff names every column of the rows it copies (v2.4388)', () => {
  it.each([
    // [what, the body, the table, columns left out on purpose]
    ['a new version: part lines', versionBody, 'bids_takeoff_rough_part_lines', ['created_at', 'updated_at']],
    ['a new version: By Stage picks', versionBody, 'bids_takeoff_template_mappings', OWN],
    ['a new version: line and part stage boxes', versionBody, 'bid_takeoff_stage_splits', OWN],
    ['the count-row clone: count rows', cloneBody, 'bids_count_rows', ['id', 'created_at']],
    ['the count-row clone: fixture stage boxes', cloneBody, 'bid_takeoff_stage_splits', OWN],
    // A duplicate is one unsplit bid, so it carries no version column.
    ['a duplicate: count rows', duplicateBody, 'bids_count_rows', ['id', 'created_at', 'bid_version_id']],
    ['a duplicate: part lines', duplicateBody, 'bids_takeoff_rough_part_lines', ['created_at', 'updated_at', 'bid_version_id']],
    ['a duplicate: By Stage picks', duplicateBody, 'bids_takeoff_template_mappings', [...OWN, 'bid_version_id']],
    ['a duplicate: stage boxes', duplicateBody, 'bid_takeoff_stage_splits', OWN],
    // updated_by is stamped by the table's own trigger: whoever makes the copy.
    ['a duplicate: custom prices', duplicateBody, 'bid_count_row_custom_prices', [...OWN, 'updated_by']],
    ['a duplicate: hidden rows', duplicateBody, 'bid_count_row_submission_hides', OWN],
    ['a duplicate: price assignments', duplicateBody, 'bid_pricing_assignments', [...OWN, 'updated_by']],
    // The stage purchase orders belong to the bid they were raised on.
    ['a duplicate: the cost estimate', duplicateBody, 'cost_estimates', [...OWN, 'purchase_order_id_rough_in', 'purchase_order_id_top_out', 'purchase_order_id_trim_set']],
    ['a duplicate: labor rows', duplicateBody, 'cost_estimate_labor_rows', ['id', 'created_at']],
    // Quoted fixture costs (v2.4413). A new version keeps every column; applied_at is the day the quote was applied.
    ['the count-row clone: quoted costs', cloneBody, 'bid_count_row_custom_costs', ['id']],
    ['a duplicate: quoted costs', duplicateBody, 'bid_count_row_custom_costs', ['id']],
    // The bid's own prices (v2.4413). A copy is one plain bid (no version), and a robot's mark is not a human copy's.
    ['a duplicate: the bid\'s own prices', duplicateBody, 'price_book_versions', ['id', 'created_at', 'bid_version_id', 'is_robot']],
    ['a duplicate: their book entries', duplicateBody, 'price_book_entries', ['id', 'created_at']],
  ] as const)('%s', (_what, body, table, leftOut) => {
    const columns = tableColumns.get(table)
    expect(columns, `${table} is in database.ts`).toBeDefined()
    const named = insertedColumns(body, table)
    expect(named.size, `the body inserts into ${table}`).toBeGreaterThan(0)
    const missing = columns!.filter((c) => !named.has(c) && !(leftOut as readonly string[]).includes(c))
    expect(missing, `${table} columns the copy drops`).toEqual([])
  })
})

describe('every table that hangs off a count row is handled by every copy (v2.4388)', () => {
  /**
   * Left behind on purpose (the owner's yes, 2026-10-02, punch list #79): a submittal's takeoff
   * picks belong to the bid the submittal was built on. A submittal is built after the award, and
   * a bid is copied or adopted before it is sent. A new table goes here only with a decision.
   */
  const NOT_CARRIED_YET = ['bid_submittal_takeoff_choices']
  /**
   * Not a row on a count row at all, so never copied, re-keyed or moved: `bid_changes` is the bid
   * history ledger (punch list #73, v2.4598). It carries count_row_id and bid_id to find a
   * fixture's past, with no key to either. A copy keeps no one else's history; the trigger records
   * the copy's own new rows as the new bid's first changes. An adopt leaves the old bid's history
   * under the old bid id, where it was written.
   */
  const NOT_A_COUNT_ROW_CHILD = ['bid_changes']
  const hangingOffCountRows = [...tableColumns]
    .filter(([t, cols]) => cols.includes('count_row_id') && cols.includes('bid_id') && !NOT_A_COUNT_ROW_CHILD.includes(t))
    .map(([t]) => t)
    .sort()

  it('knows the tables', () => {
    // The ledger is in the types with both columns; the exemption above is what keeps it out.
    expect(tableColumns.get('bid_changes')).toEqual(expect.arrayContaining(['count_row_id', 'bid_id']))
    expect(hangingOffCountRows).toEqual([
      'bid_count_row_custom_costs',
      'bid_count_row_custom_prices',
      'bid_count_row_submission_hides',
      'bid_pricing_assignments',
      'bid_submittal_takeoff_choices',
      'bid_takeoff_stage_splits',
      'bids_takeoff_rough_part_lines',
      'bids_takeoff_template_mappings',
    ])
  })

  const carried = hangingOffCountRows.filter((t) => !NOT_CARRIED_YET.includes(t))

  it.each(carried)('a new version re-keys or copies %s onto the cloned rows', (table) => {
    expect(cloneBody).toMatch(new RegExp(`(UPDATE|INSERT INTO) public\\.${table}\\b`))
  })

  it.each(carried)('a duplicate copies %s', (table) => {
    expect(duplicateBody).toMatch(new RegExp(`INSERT INTO public\\.${table}\\b`))
  })

  it.each(carried)('an adopt moves %s to the package', (table) => {
    expect(adoptBody).toMatch(new RegExp(`UPDATE public\\.${table}\\s+SET bid_id = p_target_bid_id`))
  })
})

describe('a duplicate is one version and owns its prices (v2.4413)', () => {
  it('copies only the count rows of the version the bid is on', () => {
    expect(duplicateBody).toMatch(/ORDER BY \(bv\.id = v_src\.selected_bid_version_id\) DESC NULLS LAST, bv\.sort_order, bv\.created_at/)
    expect(duplicateBody).toMatch(/FROM public\.bids_count_rows\s+WHERE bid_id = p_source_bid_id\s+AND bid_version_id IS NOT DISTINCT FROM v_version/)
  })

  it.each(['bid_count_row_custom_prices', 'bid_count_row_submission_hides', 'bid_pricing_assignments'])('re-keys %s onto the cloned price, and leaves a row on an uncloned price of the first bid', (table) => {
    const insert = duplicateBody.slice(duplicateBody.indexOf(`INSERT INTO public.${table}`))
    const statement = insert.slice(0, insert.indexOf(';'))
    expect(statement).toContain('COALESCE(pm.new_id,')
    expect(statement).toContain('(pv.bid_id IS NULL OR pm.new_id IS NOT NULL)')
  })

  it('copies quoted costs only within the trade, and only for a caller who may write them', () => {
    expect(duplicateBody).toContain('IF v_src.service_type_id = p_target_service_type_id AND public.can_write_bid_custom_costs() THEN')
    expect(cloneBody).toContain('IF public.can_write_bid_custom_costs() THEN')
  })
})

