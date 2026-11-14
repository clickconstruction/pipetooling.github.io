/**
 * The theme-review verbs (v2.6844): plan_theme_review → apply_theme_review POST dev_theme_review_write as the dev —
 * the proposed marks named are kept and the marks named come off, each with its reason, up to 200 a plan. The shape
 * is checked in the kernel, each mark in the database; the server declares both verbs; the migration is gated and
 * closed to anon and never rewords or deletes a mark; the docs have their rows. The database's own behaviour is
 * played in supabase/tests/theme_review (npm run test:pg:theme-review).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WRITE_VERBS, alreadyApplied, applyVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261110100000_dev_theme_review_write.sql', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const HR = readFileSync('docs/HR_FILES.md', 'utf8')
const BEDS = readFileSync('scripts/sql-beds.txt', 'utf8')

const M1 = '11111111-1111-4111-8111-111111111111'
const M2 = '22222222-2222-4222-8222-222222222222'
const M3 = '33333333-3333-4333-8333-333333333333'

describe('the theme-review verbs (v2.6844)', () => {
  it('are on the allowlist, plan before apply, over the one dry-run wrapper', () => {
    expect(WRITE_VERBS.plan_theme_review).toEqual({ rpc: 'dev_theme_review_write', step: 'plan' })
    expect(WRITE_VERBS.apply_theme_review).toEqual({ rpc: 'dev_theme_review_write', step: 'apply' })
    expect(applyVerbFor('plan_theme_review')).toBe('apply_theme_review')
    expect(SERVER).toContain("name: 'plan_theme_review'")
    expect(SERVER).toContain("name: 'apply_theme_review'")
    expect(SERVER).toContain("case 'plan_theme_review':")
    expect(SERVER).toContain("case 'apply_theme_review':")
    expect(SERVER).toContain("const SERVER_VERSION = '0.87.0'")
    expect(SERVER).toContain('Writes are one hundred and five verbs and nothing else:')
    expect(SERVER).toContain('plan_theme_review → apply_theme_review (the review of marks already there')
  })

  it('shapes keep and take_off, and refuses a bad one in words', () => {
    const hash = 'cd'.repeat(32)
    const good = writeRpcBody('plan_theme_review', { keep: [` ${M1.toUpperCase()} `, M2], take_off: [{ id: M3, why: '  the still is of another day  ' }] })
    expect(good).toEqual({
      ok: true,
      rpc: 'dev_theme_review_write',
      step: 'plan',
      body: { p: { keep: [M1, M2], take_off: [{ id: M3, why: 'the still is of another day' }] }, p_dry_run: true },
      dryRunBody: { p: { keep: [M1, M2], take_off: [{ id: M3, why: 'the still is of another day' }] }, p_dry_run: true },
      target: '3 marks',
      planHash: null,
    })
    const keepOnly = writeRpcBody('apply_theme_review', { keep: [M1], plan_hash: hash })
    expect(keepOnly.ok && keepOnly.body).toEqual({ p: { keep: [M1], take_off: [] }, p_dry_run: false })
    expect(keepOnly.ok && keepOnly.dryRunBody).toEqual({ p: { keep: [M1], take_off: [] }, p_dry_run: true })
    expect(keepOnly.ok && keepOnly.target).toBe('1 mark')
    expect(keepOnly.ok && keepOnly.planHash).toBe(hash)
    const offOnly = writeRpcBody('plan_theme_review', { take_off: [{ id: M2, why: 'not this theme' }] })
    expect(offOnly.ok && offOnly.body).toEqual({ p: { keep: [], take_off: [{ id: M2, why: 'not this theme' }] }, p_dry_run: true })
    for (const bad of [
      {},
      { keep: [], take_off: [] },
      { keep: M1 },
      { keep: ['the first one'] },
      { keep: [M1, M1] },
      { keep: [M1], take_off: [{ id: M1, why: 'both' }] },
      { take_off: [M2] },
      { take_off: [{ id: M2 }] },
      { take_off: [{ id: M2, why: '   ' }] },
      { take_off: [{ id: M2, why: 'x'.repeat(201) }] },
      { take_off: [{ id: 'x', why: 'no' }] },
      { keep: Array.from({ length: 201 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`) },
    ]) {
      const r = writeRpcBody('plan_theme_review', bad)
      expect(r.ok).toBe(false)
      expect(!r.ok && r.error).toContain('plan_theme_review needs keep and/or take_off')
    }
    // 200 across the two lists is the most a plan names.
    const full = writeRpcBody('plan_theme_review', { keep: Array.from({ length: 200 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`) })
    expect(full.ok && full.target).toBe('200 marks')
    expect(alreadyApplied('apply_theme_review', { target: '3 marks', at: '2026-11-10T00:00:00Z' })).toContain('on those marks at 2026-11-10T00:00:00Z')
    expect(alreadyApplied('apply_theme_review', { target: null, at: null })).toContain('By theme view')
  })

  it('the migration is gated to devs, closed to anon, stamps and never rewords or deletes', () => {
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_theme_review_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_theme_review_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_theme_review_write(jsonb, boolean) TO authenticated;')
    expect(MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(MIGRATION).not.toMatch(/DELETE FROM/i)
    expect(MIGRATION).not.toMatch(/INSERT INTO/i)
    expect(MIGRATION).toContain('SET kept_at = v_now, kept_by = auth.uid() WHERE id = v_id AND removed_at IS NULL AND kept_at IS NULL')
    expect(MIGRATION).toContain('SET removed_at = v_now, removed_by = auth.uid(), removed_why = v_off_why WHERE id = v_id AND removed_at IS NULL')
    // The only columns an UPDATE names are the two pairs of stamps.
    const sets = [...MIGRATION.matchAll(/UPDATE public\.legal_theme_marks SET ([^;]*?) WHERE/g)].map((m) => m[1])
    expect(sets).toEqual(['kept_at = v_now, kept_by = auth.uid()', 'removed_at = v_now, removed_by = auth.uid(), removed_why = v_off_why'])
    for (const state of ["v_state := 'held'", "v_state := 'already'"]) expect(MIGRATION).toContain(state)
    expect(MIGRATION).toContain('named twice')
  })

  it('the docs and the bed carry the verbs', () => {
    expect(README).toContain('`plan_theme_review(keep?, take_off?)` · `apply_theme_review(keep?, take_off?, plan_hash)`')
    expect(README).toContain("seventy-seven since v2.6844's review of marks")
    expect(EDGE).toContain('dev_theme_review_write')
    expect(HR).toContain('`plan_theme_review` → `apply_theme_review`')
    expect(BEDS.split('\n')).toContain('theme-review')
  })
})
