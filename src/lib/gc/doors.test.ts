import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GC_SCHEDULE_APPEND_ONLY, GC_TABLE_DOORS, NOT_GC_MODE_TABLES, type GcDoor } from './doors'

/**
 * Every GC table's policies as the migrations leave them, in file order: a `CREATE POLICY … ON
 * public.gc_…` adds one, a `DROP POLICY IF EXISTS` takes it away, and the doors' `FOREACH t IN ARRAY
 * ARRAY[…] LOOP … format('CREATE POLICY %I ON public.%I …', t || '_team', t)` blocks do the same for
 * each table they list. Each policy keeps its words, so the test reads who it lets in.
 */
function gcPolicies(): { created: Set<string>; policies: Map<string, Map<string, string>> } {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const created = new Set<string>()
  const policies = new Map<string, Map<string, string>>()
  const on = (t: string) => {
    if (!policies.has(t)) policies.set(t, new Map())
    return policies.get(t)!
  }
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8')
    for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(gc_[a-z_]+)/g)) created.add(m[1]!)
    const events: { at: number; drop: boolean; name: string; table: string; words: string }[] = []
    for (const m of sql.matchAll(/(DROP POLICY IF EXISTS|CREATE POLICY)\s+("[^"]+"|[A-Za-z0-9_]+)\s+ON\s+public\.(gc_[a-z_]+)([^;]*);/g)) {
      events.push({ at: m.index!, drop: m[1]!.startsWith('DROP'), name: m[2]!.replace(/"/g, ''), table: m[3]!, words: m[4]! })
    }
    for (const m of sql.matchAll(/FOREACH\s+t\s+IN\s+ARRAY\s+ARRAY\[([\s\S]*?)\]\s*LOOP([\s\S]*?)END LOOP/g)) {
      const tables = [...m[1]!.matchAll(/'(gc_[a-z_]+)'/g)].map((x) => x[1]!)
      for (const op of m[2]!.matchAll(/'(DROP POLICY IF EXISTS|CREATE POLICY) %I ON public\.%I([^']*)',\s*t \|\| '(_[a-z_]+)'/g)) {
        for (const t of tables) events.push({ at: m.index!, drop: op[1]!.startsWith('DROP'), name: t + op[3]!, table: t, words: op[2]! })
      }
    }
    for (const e of events.sort((a, b) => a.at - b.at)) {
      if (e.drop) on(e.table).delete(e.name)
      else on(e.table).set(e.name, e.words)
    }
  }
  return { created, policies }
}

/** Who a table's policies let in: the money team, the schedule's team, the office team, or dev only. */
function doorOf(words: string[]): GcDoor | 'none' | 'other' {
  if (words.length === 0) return 'none'
  if (words.some((w) => w.includes('gc_money_team()'))) return 'money'
  if (words.some((w) => /gc_on_(any_)?schedule_team\(/.test(w))) return 'schedule'
  if (words.some((w) => w.includes('gc_office_team()'))) return 'office'
  if (words.some((w) => w.includes('is_dev()'))) return 'dev'
  return 'other'
}

describe('GC mode: every table has a door', () => {
  const { created, policies } = gcPolicies()
  const gcMode = [...created].filter((t) => !(NOT_GC_MODE_TABLES as readonly string[]).includes(t))

  it('every GC table a migration creates is listed, with its lane', () => {
    const missing = gcMode.filter((t) => !GC_TABLE_DOORS[t])
    expect(missing, 'add each to src/lib/gc/doors.ts with its lane and door').toEqual([])
  })

  it('every listed table exists, so the list cannot rot', () => {
    expect(Object.keys(GC_TABLE_DOORS).filter((t) => !created.has(t))).toEqual([])
  })

  it('each table’s policy lets in who the list says', () => {
    const wrong = Object.entries(GC_TABLE_DOORS)
      .map(([t, d]) => ({ t, listed: d.door, policy: doorOf([...(policies.get(t)?.values() ?? [])]) }))
      .filter((x) => x.listed !== x.policy)
      .map((x) => `${x.t}: listed ${x.listed}, its policy says ${x.policy}`)
    expect(wrong).toEqual([])
  })

  it('a dev-only table says what opens it', () => {
    const silent = Object.entries(GC_TABLE_DOORS)
      .filter(([, d]) => d.door === 'dev' && !d.opens?.trim())
      .map(([t]) => t)
    expect(silent).toEqual([])
  })

  it('door 2 opened the Board to the office and kept the portal and our number shut', () => {
    for (const t of ['gc_companies', 'gc_invites', 'gc_quotes', 'gc_bid_tabs']) expect(doorOf([...(policies.get(t)?.values() ?? [])]), t).toBe('office')
    expect(doorOf([...(policies.get('gc_trade_portal_links')?.values() ?? [])])).toBe('dev')
    expect(doorOf([...(policies.get('gc_project_money')?.values() ?? [])])).toBe('money')
  })

  it('the schedule’s PR 10 opened its 23 tables to its team, and a what-if copy stays its own person’s', () => {
    const tables = Object.entries(GC_TABLE_DOORS).filter(([, d]) => d.lane === 'Schedule').map(([t]) => t)
    expect(tables).toHaveLength(23)
    for (const t of tables) expect(doorOf([...(policies.get(t)?.values() ?? [])]), t).toBe('schedule')
    expect([...(policies.get('gc_schedule_what_ifs')?.values() ?? [])].join(' ')).toContain('user_id = (SELECT auth.uid())')
  })
})

/**
 * What `authenticated` may write on each table, as the migrations' GRANT and REVOKE statements leave it, in file order.
 * A new table starts with every privilege (Supabase's default privileges). `REVOKE … FROM authenticated` takes the
 * named ones away and `GRANT … TO authenticated` gives them back, table-wide; `GRANT UPDATE (cols)` adds those columns.
 */
function tableWrites(): Map<string, { tableWide: Set<string>; columns: Set<string> }> {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const writes = new Map<string, { tableWide: Set<string>; columns: Set<string> }>()
  const of = (t: string) => {
    if (!writes.has(t)) writes.set(t, { tableWide: new Set(['UPDATE', 'DELETE', 'TRUNCATE']), columns: new Set() })
    return writes.get(t)!
  }
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8')
    for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(gc_[a-z_]+)/g)) of(m[1]!)
    for (const m of sql.matchAll(/\b(GRANT|REVOKE)\s+([A-Z][A-Z, ]*?)\s*(\(([^)]*)\))?\s+ON\s+(TABLE\s+)?((?:public\.gc_[a-z_]+\s*,\s*)*public\.gc_[a-z_]+)\s+(TO|FROM)\s+([^;]+);/g)) {
      if (!/\bauthenticated\b/.test(m[8]!)) continue
      const privs = m[2]!.trim() === 'ALL' || m[2]!.trim() === 'ALL PRIVILEGES' ? ['UPDATE', 'DELETE', 'TRUNCATE'] : m[2]!.split(',').map((p) => p.trim())
      const cols = m[4]?.split(',').map((c) => c.trim())
      for (const t of m[6]!.split(',').map((x) => x.trim().replace(/^public\./, ''))) {
        const w = of(t)
        if (cols) {
          if (m[1] === 'GRANT' && privs.includes('UPDATE')) for (const c of cols) w.columns.add(c)
          continue
        }
        for (const p of privs.filter((x) => ['UPDATE', 'DELETE', 'TRUNCATE'].includes(x))) {
          if (m[1] === 'GRANT') w.tableWide.add(p)
          else w.tableWide.delete(p)
        }
      }
    }
  }
  return writes
}

describe('GC mode: the schedule’s append-only rows stay append-only (the schedule’s PR 10)', () => {
  const writes = tableWrites()

  it('no append-only table has a table-wide UPDATE, DELETE or TRUNCATE for authenticated', () => {
    const open = Object.keys(GC_SCHEDULE_APPEND_ONLY)
      .map((t) => ({ t, w: [...(writes.get(t)?.tableWide ?? new Set(['missing']))] }))
      .filter((x) => x.w.length > 0)
      .map((x) => `${x.t}: ${x.w.join(', ')}`)
    expect(open).toEqual([])
  })

  it('each one’s column grants are exactly the columns the list names', () => {
    for (const [t, cols] of Object.entries(GC_SCHEDULE_APPEND_ONLY)) {
      expect([...(writes.get(t)?.columns ?? [])].sort(), t).toEqual([...cols].sort())
    }
  })

  it('reads a grant that would open one, so the check is not empty', () => {
    expect(writes.get('gc_schedule_activities')?.tableWide.has('UPDATE')).toBe(true)
  })
})
