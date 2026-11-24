/**
 * dev-mcp's check_query_plan (punch list #430, server 0.133.0): a dev reads the plan of a fixed statement as themself.
 * The statements live in the database function (migration 20261124063000); the seat names their keys, passes one on by
 * shape, and fits the plan's lines to a reply. Every table name below is made up.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  QUERY_PLAN_GAP, QUERY_PLAN_RPC, QUERY_PLAN_STATEMENTS, QUERY_PLAN_WINDOW_CHARS,
  findInPlan, fitPlan, planLines, queryPlanArgs, queryPlanReading, queryPlanReply, walkedRelations,
} from '../../../supabase/functions/_shared/devMcpQueryPlan'
import { REPLY_MAX_CHARS } from '../../../supabase/functions/_shared/devMcpDoor'

const MIGRATION = readFileSync('supabase/migrations/20261124063000_dev_query_plan.sql', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const NOTES = readFileSync('docs/dev-mcp/SERVER_NOTES.md', 'utf8')

// A plan as EXPLAIN (ANALYZE, BUFFERS) writes one: a loop over papers that finds a party by key and walks the shops.
const PLAN = [
  'Nested Loop Left Join  (cost=1.00..90.00 rows=10 width=64) (actual time=0.100..2.000 rows=10 loops=1)',
  '  Join Filter: (shops.id = papers.shop_id)',
  '  Buffers: shared hit=40',
  '  ->  Nested Loop Left Join  (cost=0.50..40.00 rows=10 width=48) (actual time=0.050..1.000 rows=10 loops=1)',
  '        ->  Seq Scan on papers  (cost=0.00..5.00 rows=10 width=32) (actual time=0.010..0.020 rows=10 loops=1)',
  '              Filter: (kind = \'signed\'::text)',
  '        ->  Index Scan using parties_pkey on parties  (cost=0.28..3.00 rows=1 width=16) (actual time=0.005..0.005 rows=1 loops=10)',
  '              Index Cond: (id = papers.party_id)',
  '              Filter: (owner_id = auth.uid())',
  '              SubPlan 1',
  '                ->  Index Only Scan using owners_pkey on owners  (cost=0.15..2.00 rows=1 width=0) (never executed)',
  '                      Index Cond: (id = parties.owner_id)',
  '  ->  Materialize  (cost=0.00..12.00 rows=200 width=16) (actual time=0.001..0.050 rows=200 loops=10)',
  '        ->  Seq Scan on shops  (cost=0.00..11.00 rows=200 width=16) (actual time=0.010..0.300 rows=200 loops=1)',
  '              Filter: (owner_id = auth.uid())',
  'Planning:',
  '  Buffers: shared hit=12',
  'Planning Time: 1.250 ms',
  'Execution Time: 2.345 ms',
]

describe('check_query_plan — a key, never SQL', () => {
  it('the seat names the statements the migration holds, word for word, and no other', () => {
    for (const sql of Object.values(QUERY_PLAN_STATEMENTS)) {
      expect(MIGRATION).toContain(`FOR v_line IN EXPLAIN (ANALYZE, BUFFERS) ${sql} LOOP`)
      expect(MIGRATION).toContain(`FOR v_line IN EXPLAIN ${sql} LOOP`)
    }
    for (const key of Object.keys(QUERY_PLAN_STATEMENTS)) expect(MIGRATION).toContain(`p_key = '${key}' THEN`)
    expect(MIGRATION.match(/FOR v_line IN EXPLAIN /g)).toHaveLength(Object.keys(QUERY_PLAN_STATEMENTS).length * 2)
    expect(MIGRATION).toContain(`HINT = 'The statements are: ${Object.keys(QUERY_PLAN_STATEMENTS).join(', ')}.'`)
  })

  it('the migration is the caller\'s own plan, devs only, read only, with no dynamic SQL', () => {
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    const body = MIGRATION.slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION'), MIGRATION.indexOf('COMMENT ON FUNCTION'))
    expect(body).toContain(`CREATE OR REPLACE FUNCTION public.${QUERY_PLAN_RPC}(p_key text, p_analyze boolean DEFAULT true, p_max_chars integer DEFAULT 400000)`)
    expect(body).toContain('LANGUAGE plpgsql VOLATILE SECURITY INVOKER')
    expect(body).not.toMatch(/SECURITY DEFINER/)
    expect(body).not.toMatch(/\bEXECUTE\b/i)
    expect(body).not.toMatch(/\bformat\s*\(/i)
    // The gate comes first, then the transaction is turned read only, then a statement runs.
    const gate = body.indexOf('IF NOT public.is_dev() THEN')
    const readOnly = body.indexOf("PERFORM set_config('transaction_read_only', 'on', true);")
    const first = body.indexOf('FOR v_line IN EXPLAIN')
    expect(gate).toBeGreaterThan(0)
    expect(readOnly).toBeGreaterThan(gate)
    expect(first).toBeGreaterThan(readOnly)
    expect(MIGRATION).toContain(`REVOKE EXECUTE ON FUNCTION public.${QUERY_PLAN_RPC}(text, boolean, integer) FROM PUBLIC, anon;`)
    expect(MIGRATION).toContain(`GRANT EXECUTE ON FUNCTION public.${QUERY_PLAN_RPC}(text, boolean, integer) TO authenticated;`)
  })

  it('passes a key on by its shape and refuses anything that could be SQL before the database is asked', () => {
    expect(queryPlanArgs({ statement: 'agreements_on_file' })).toEqual({ ok: true, args: { p_key: 'agreements_on_file', p_analyze: true }, find: null, from: 1 })
    expect(queryPlanArgs({ statement: ' people_hours_recorded ', analyze: false })).toMatchObject({ ok: true, args: { p_key: 'people_hours_recorded', p_analyze: false } })
    // Only a plain false turns analyze off; a key the seat has not heard of is the database's to refuse.
    expect(queryPlanArgs({ statement: 'agreements_on_file', analyze: 'false' })).toMatchObject({ ok: true, args: { p_analyze: true } })
    expect(queryPlanArgs({ statement: 'a_statement_added_later' })).toMatchObject({ ok: true, args: { p_key: 'a_statement_added_later' } })
    for (const bad of ['SELECT 1', 'agreements_on_file; DELETE FROM papers', 'agreements_on_file WHERE true', "x' --", 'Agreements_On_File', 'public.agreements_on_file', '1abc', 'a'.repeat(61)]) {
      expect(queryPlanArgs({ statement: bad })).toMatchObject({ ok: false, error: expect.stringContaining('never SQL') })
    }
    expect(queryPlanArgs({})).toMatchObject({ ok: false, error: expect.stringContaining('agreements_on_file, people_hours_recorded') })
    expect(queryPlanArgs({ statement: 42 })).toMatchObject({ ok: false })
  })

  it('find and from stay in the seat: neither is an argument of the RPC', () => {
    const ask = queryPlanArgs({ statement: 'agreements_on_file', find: ' customers ' })
    expect(ask).toEqual({ ok: true, args: { p_key: 'agreements_on_file', p_analyze: true }, find: 'customers', from: 1 })
    expect(queryPlanArgs({ statement: 'agreements_on_file', from: 400 })).toMatchObject({ ok: true, from: 400, find: null })
    expect(queryPlanArgs({ statement: 'agreements_on_file', find: '' })).toMatchObject({ ok: false })
    expect(queryPlanArgs({ statement: 'agreements_on_file', find: 'x'.repeat(81) })).toMatchObject({ ok: false, error: expect.stringContaining('80 is the most') })
    expect(queryPlanArgs({ statement: 'agreements_on_file', from: 0 })).toMatchObject({ ok: false })
    expect(queryPlanArgs({ statement: 'agreements_on_file', from: 2.5 })).toMatchObject({ ok: false })
    expect(queryPlanArgs({ statement: 'agreements_on_file', find: 'shops', from: 3 })).toMatchObject({ ok: false, error: expect.stringContaining('not both') })
  })
})

describe('check_query_plan — reading a plan', () => {
  it('names the relations read whole, with how many scans name each', () => {
    expect(walkedRelations(PLAN)).toEqual([{ relation: 'papers', scans: 1 }, { relation: 'shops', scans: 1 }])
    expect(walkedRelations([...PLAN, '  ->  Parallel Seq Scan on shops s2  (cost=0.00..1.00 rows=1 width=4)'])).toContainEqual({ relation: 'shops', scans: 2 })
    expect(walkedRelations(['Index Scan using parties_pkey on parties'])).toEqual([])
  })

  it('find shows a node with every node above it, and the lines of each: the join over a scan', () => {
    const { indices, matches } = findInPlan(PLAN, 'SHOPS')
    // `shops` is in the top join's filter (line 2) and on the scan (line 14).
    expect(matches).toBe(2)
    expect(indices.map((i) => PLAN[i].trim().split('  ')[0])).toEqual([
      'Nested Loop Left Join', 'Join Filter: (shops.id = papers.shop_id)', 'Buffers: shared hit=40',
      '->', '->', 'Filter: (owner_id = auth.uid())',
    ])
    expect(indices).toEqual([0, 1, 2, 12, 13, 14])
    // A line inside a SubPlan brings the SubPlan's header, the node that owns it, and the joins above: not its siblings.
    const deep = findInPlan(PLAN, 'owners_pkey')
    expect(deep.matches).toBe(1)
    expect(deep.indices).toEqual([0, 1, 2, 3, 6, 7, 8, 9, 10, 11])
    // The times are no node: a match there is the line alone.
    expect(findInPlan(PLAN, 'Execution Time')).toEqual({ indices: [18], matches: 1 })
    expect(findInPlan(PLAN, 'no such thing')).toEqual({ indices: [], matches: 0 })
  })

  it('fits a window of lines to the budget and says where the next one starts', () => {
    const whole = fitPlan(PLAN, { find: null, from: 1 })
    expect(whole).toEqual({ lines: PLAN, from: 1, to: PLAN.length, next_from: null })
    const first = fitPlan(PLAN, { find: null, from: 1 }, 300)
    expect(first.from).toBe(1)
    expect(first.lines.join('\n').length).toBeLessThanOrEqual(300)
    expect(first.next_from).toBe((first.to ?? 0) + 1)
    // Walking the windows reads every line once, in order.
    const seen: string[] = []
    let from: number | null = 1
    let calls = 0
    while (from != null && calls < 50) {
      const w = fitPlan(PLAN, { find: null, from }, 300)
      seen.push(...w.lines)
      from = w.next_from ?? null
      calls += 1
    }
    expect(seen).toEqual(PLAN)
    // A line longer than the budget still goes out, alone: a window is never empty.
    expect(fitPlan(PLAN, { find: null, from: 1 }, 10).lines).toEqual([PLAN[0]])
    // Past the end reads the last line and stops.
    expect(fitPlan(PLAN, { find: null, from: 999 })).toMatchObject({ from: PLAN.length, next_from: null })
  })

  it('a find reply marks what it skipped, and says what did not fit', () => {
    const fit = fitPlan(PLAN, { find: 'shops', from: 1 })
    expect(fit.lines).toEqual([PLAN[0], PLAN[1], PLAN[2], QUERY_PLAN_GAP, PLAN[12], PLAN[13], PLAN[14], QUERY_PLAN_GAP])
    expect(fit).toMatchObject({ find: 'shops', matches: 2, shown: 6, held_back: 0 })
    expect(PLAN).not.toContain(QUERY_PLAN_GAP)
    const tight = fitPlan(PLAN, { find: 'shops', from: 1 }, 200)
    expect(tight.shown).toBeLessThan(6)
    expect(tight.held_back).toBe(6 - (tight.shown ?? 0))
    expect(fitPlan(PLAN, { find: 'nothing', from: 1 })).toMatchObject({ lines: [], matches: 0, shown: 0 })
  })

  it('the reading is of the whole plan, whatever the window shows', () => {
    const body = { key: 'agreements_on_file', analyzed: true, line_count: PLAN.length, cut: false, lines: PLAN }
    expect(queryPlanReading(body)).toBe('agreements_on_file: analyzed, so the statement ran: planning 1.25 ms, execution 2.345 ms; Seq Scan on papers, shops; 19 lines. A Seq Scan is a walk only where it sits under a loop: read its lines.')
    const windowed = queryPlanReply(body, { find: null, from: 1 }, 300)
    expect(windowed.reading).toContain('execution 2.345 ms')
    expect(windowed.reading).toContain(`from: ${String(windowed.next_from)} reads on`)
    expect(windowed).toMatchObject({ key: 'agreements_on_file', analyzed: true, line_count: 19, from: 1 })
    const found = queryPlanReply(body, { find: 'shops', from: 1 })
    expect(found.reading).toContain('2 lines hold "shops"')
    expect(found).toMatchObject({ find: 'shops', matches: 2, shown: 6 })
    expect(queryPlanReply(body, { find: 'zebra', from: 1 }).reading).toContain('Nothing in the plan holds "zebra".')
    const alone = queryPlanReading({ key: 'people_hours_recorded', analyzed: false, line_count: 2, cut: false, lines: ['Index Scan using parties_pkey on parties', '  Index Cond: (id = 1)'] })
    expect(alone).toBe('people_hours_recorded: the plan alone, nothing ran; no Seq Scan anywhere in it; 2 lines. A Seq Scan is a walk only where it sits under a loop: read its lines.')
  })

  it('a plan the database cut reads as cut, and a reply of another shape still reads', () => {
    const cut = { key: 'agreements_on_file', analyzed: true, line_count: 500, cut: true, lines: PLAN.slice(0, 5), left_out: 491, last_lines: PLAN.slice(15) }
    const got = planLines(cut)
    expect(got).toMatchObject({ total: 500, cutByDatabase: 491 })
    expect(got.lines[5]).toBe(`${QUERY_PLAN_GAP} 491 lines left out by the database's cap`)
    expect(queryPlanReading(cut)).toContain("500 lines, 491 left out by the database's cap, so a scan there is not counted")
    expect(queryPlanReply(cut, { find: null, from: 1 })).toMatchObject({ left_out_by_database: 491 })
    for (const body of [null, 'text', [], { lines: 'no' }, { key: 7 }]) expect(typeof queryPlanReading(body)).toBe('string')
    expect(queryPlanReading({ key: 'agreements_on_file', lines: [] })).toBe('agreements_on_file: the database answered with no plan lines.')
  })

  it('a full window leaves room for the reply around it', () => {
    expect(QUERY_PLAN_WINDOW_CHARS).toBeLessThan(REPLY_MAX_CHARS - 20_000)
    const long = Array.from({ length: 3000 }, (_, i) => `  ->  Index Scan using parties_pkey on parties p${i}  (cost=0.28..3.00 rows=1 width=16) "quoted"`)
    const reply = queryPlanReply({ key: 'agreements_on_file', analyzed: false, line_count: long.length, cut: false, lines: ['Append', ...long] }, { find: null, from: 1 })
    expect(JSON.stringify(reply).length).toBeLessThan(REPLY_MAX_CHARS)
    const found = queryPlanReply({ key: 'agreements_on_file', analyzed: false, line_count: long.length, cut: false, lines: ['Append', ...long] }, { find: 'parties', from: 1 })
    expect(JSON.stringify(found).length).toBeLessThan(REPLY_MAX_CHARS)
    expect(found.held_back).toBeGreaterThan(0)
  })
})

describe('check_query_plan — the server, the README and the notes carry it', () => {
  it('the verb is on the server, over the GET door, under its version', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.133.0'")
    expect(SERVER).toContain("name: 'check_query_plan',")
    const route = SERVER.slice(SERVER.indexOf("case 'check_query_plan': {"), SERVER.indexOf("case 'mint_twin_setup_code': {"))
    expect(route).toContain('restGet(await jwt(), `rpc/${QUERY_PLAN_RPC}`, built.query)')
    expect(route).toContain('buildRpcQuery(ask.args)')
    expect(route).not.toContain('restPost')
    // find and from never leave the seat: the query is built from the key and analyze alone.
    expect(route).not.toMatch(/buildRpcQuery\([^)]*find/)
    expect(README).toContain('`check_query_plan(statement, analyze?, find?, from?)`')
    expect(NOTES).toContain('0.133.0 (')
  })
})
