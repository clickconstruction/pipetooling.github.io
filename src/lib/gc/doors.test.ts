import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GC_TABLE_DOORS, NOT_GC_MODE_TABLES, type GcDoor } from './doors'

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

/** Who a table's policies let in: the money team, the office team, or dev only. */
function doorOf(words: string[]): GcDoor | 'none' | 'other' {
  if (words.length === 0) return 'none'
  if (words.some((w) => w.includes('gc_money_team()'))) return 'money'
  if (words.some((w) => w.includes('gc_office_team()'))) return 'office'
  if (words.some((w) => w.includes('is_dev()'))) return 'dev'
  return 'other'
}

const forSelect = (w: string) => /\bFOR\s+SELECT\b/i.test(w)

/**
 * Who writes a table: its policies but the `FOR SELECT` ones, or all of them when it has no other (a table the
 * service role alone writes). Who reads it: every policy, since `FOR ALL` reads too (O9).
 */
function writersOf(words: string[]): GcDoor | 'none' | 'other' {
  const writes = words.filter((w) => !forSelect(w))
  return doorOf(writes.length > 0 ? writes : words)
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
      .map(([t, d]) => ({ t, listed: d.door, policy: writersOf([...(policies.get(t)?.values() ?? [])]) }))
      .filter((x) => x.listed !== x.policy)
      .map((x) => `${x.t}: listed ${x.listed}, its policy says ${x.policy}`)
    expect(wrong).toEqual([])
  })

  it('each table is read by who the list says: its door, or the wider team its FOR SELECT policies name', () => {
    const wrong = Object.entries(GC_TABLE_DOORS)
      .map(([t, d]) => ({ t, listed: d.reads ?? d.door, policy: doorOf([...(policies.get(t)?.values() ?? [])]) }))
      .filter((x) => x.listed !== x.policy)
      .map((x) => `${x.t}: listed as read by ${x.listed}, its policies say ${x.policy}`)
    expect(wrong).toEqual([])
  })

  it('O9 opened the trades’ money to the money team for reading only, and writing stays a dev’s', () => {
    const seven = ['gc_sows', 'gc_sow_lines', 'gc_draws', 'gc_draw_lines', 'gc_sow_line_reports', 'gc_change_order_trade_sends', 'gc_back_charges']
    for (const t of seven) {
      const words = [...(policies.get(t)?.values() ?? [])]
      expect(GC_TABLE_DOORS[t]?.reads, t).toBe('money')
      expect(writersOf(words), t).toBe('dev')
      expect(policies.get(t)?.get(`${t}_money_read`), t).toMatch(/FOR SELECT TO authenticated USING \(\(SELECT public\.gc_money_team\(\)\)\)/)
    }
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
})
