import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEED_FLOWS } from '../flows/seed'
import { BLANKS, THEIRS, blanksIn } from './blanks'
import { shortcutWord } from './shortcut'

/** The starter quick replies' migration (punch list #126 PR 4): the eleven lines the owner approved on 2026-10-29. */
const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261029200000_quick_replies_starter.sql'), 'utf8')
const code = SQL.split('\n')
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n')

/** The seed's rows as the function reads them: its place, its shortcut, its words and its step. */
const ROWS = Array.from(code.matchAll(/\((\d+), '([a-z0-9-]+)', '((?:[^']|'')*)', (NULL|'[a-z_]+')\)/g)).map((m) => ({
  n: Number(m[1]),
  shortcut: m[2] as string,
  words: (m[3] as string).replace(/''/g, "'"),
  step: m[4] === 'NULL' ? null : (m[4] as string).slice(1, -1),
}))

const SHORTCUTS = ['gotit', 'access', 'photo', 'late', 'back', 'bill', 'thanks', 'paid', 'found', 'estimate', 'remind']
const STEPS: Readonly<Record<string, string>> = { found: 'found', estimate: 'approved', remind: 'paid' }

describe('the starter quick replies migration', () => {
  it('starts with the lock timeout, makes no table, and runs the seed once as the database’s own', () => {
    expect(SQL.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(code).not.toMatch(/CREATE TABLE/i)
    expect(code).toContain('CREATE OR REPLACE FUNCTION public.quick_replies_seed_starter()')
    expect(code).toContain('REVOKE ALL ON FUNCTION public.quick_replies_seed_starter() FROM PUBLIC, anon, authenticated;')
    expect(code.match(/SELECT public\.quick_replies_seed_starter\(\);/g)).toHaveLength(1)
  })

  it('seeds the eleven lines in the card’s order, each with its one-word shortcut, no two alike', () => {
    expect(ROWS.map((r) => r.n)).toEqual(SHORTCUTS.map((_, i) => i + 1))
    expect(ROWS.map((r) => r.shortcut)).toEqual(SHORTCUTS)
    for (const r of ROWS) expect(shortcutWord(r.shortcut)).toEqual({ word: r.shortcut })
    expect(new Set(ROWS.map((r) => r.shortcut)).size).toBe(11)
  })

  it('puts the three step lines on steps of the residential flow and the eight any-time lines on none', () => {
    const residential = new Set(SEED_FLOWS.residential.lanes.flatMap((l) => l.steps).map((s) => s.id))
    for (const r of ROWS) {
      expect(r.step).toBe(STEPS[r.shortcut] ?? null)
      if (r.step) expect(residential.has(r.step)).toBe(true)
    }
    // Booked, Working, Done and Billed keep the app's own words: no starter line sits on them.
    expect(ROWS.some((r) => r.step && ['booked', 'working', 'done', 'billed', 'review'].includes(r.step))).toBe(false)
  })

  it('names the customer in every line, and uses only blanks the app fills or the person types', () => {
    const known = new Set([...BLANKS.map((b) => b.key), ...THEIRS.map((b) => b.key)])
    const theirs = new Set(THEIRS.map((b) => b.key))
    for (const r of ROWS) {
      expect(r.words).toContain('{first}')
      for (const key of blanksIn(r.words)) expect(known.has(key), `${r.shortcut} uses {${key}}`).toBe(true)
    }
    // {thing} and {found} are the person's to type before it sends: only the photo ask and What we found hold one.
    const typed = ROWS.filter((r) => blanksIn(r.words).some((k) => theirs.has(k))).map((r) => r.shortcut)
    expect(typed).toEqual(['photo', 'found'])
  })

  it('carries the bill’s pay page on /bill and /remind, so a bill picked from the / list reads a starter line', () => {
    expect(ROWS.filter((r) => r.words.includes('{bill}')).map((r) => r.shortcut)).toEqual(['bill', 'remind'])
  })

  it('writes the words as the owner approved them: trimmed, under the column’s limit, team lines for customers, no Spanish', () => {
    for (const r of ROWS) {
      expect(r.words).toBe(r.words.trim())
      expect(r.words).not.toMatch(/ {2}/)
      expect(r.words.length).toBeLessThanOrEqual(1000)
    }
    expect(ROWS[0]?.words).toBe('{first}, this is {me} with Click Plumbing. We got your message and will call you back today.')
    expect(code).toContain("VALUES (r.words, 'customer', r.step_key, 'team', r.shortcut)")
    expect(code).not.toMatch(/text_es/)
  })

  it('leaves out a line the office already has: its words, its shortcut on a live team line, or a team line on its step', () => {
    expect(code).toContain('WHERE lower(btrim(q.text)) = lower(r.words)')
    expect(code).toContain("WHERE v.kind = 'added' AND lower(btrim(v.to_text)) = lower(r.words)")
    expect(code).toContain("WHERE q.scope = 'team' AND q.removed_at IS NULL AND q.shortcut = r.shortcut")
    expect(code).toContain("WHERE q.scope = 'team' AND q.for_kind = 'customer' AND q.removed_at IS NULL AND q.step_key = r.step_key")
  })
})
