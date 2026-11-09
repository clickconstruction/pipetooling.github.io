/**
 * The theme-mark verbs (v2.6552, punch list #269): plan_theme_marks → apply_theme_marks POST dev_theme_marks_write as
 * the dev — a theme from the catalog on an HR entry, a piece of evidence, a matter document or a matter event, with
 * why it fits and how it proves the theme, kept or proposed. The shape is checked in the kernel, the thing and the
 * theme in the database; the server declares both verbs; the migration is gated and closed to anon; the docs have
 * their rows.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WRITE_VERBS, alreadyApplied, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261106010000_dev_theme_marks_write.sql', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')

const T1 = '11111111-1111-4111-8111-111111111111'
const E1 = '22222222-2222-4222-8222-222222222222'
const D1 = '33333333-3333-4333-8333-333333333333'

describe('the theme-mark verbs (v2.6552)', () => {
  it('are on the allowlist, plan before apply, over the one dry-run wrapper', () => {
    expect(WRITE_VERBS.plan_theme_marks).toEqual({ rpc: 'dev_theme_marks_write', step: 'plan' })
    expect(WRITE_VERBS.apply_theme_marks).toEqual({ rpc: 'dev_theme_marks_write', step: 'apply' })
    expect(SERVER).toContain("name: 'plan_theme_marks'")
    expect(SERVER).toContain("name: 'apply_theme_marks'")
    expect(SERVER).toContain("case 'plan_theme_marks':")
    expect(SERVER).toContain("case 'apply_theme_marks':")
    expect(SERVER).toContain("const SERVER_VERSION = '0.51.0'")
    expect(SERVER).toContain('fifty-seven verbs')
  })

  it('shapes the marks and the stand, and refuses a bad one in words', () => {
    const hash = 'ab'.repeat(32)
    const good = writeRpcBody('plan_theme_marks', { marks: [{ theme_id: T1, target_kind: 'HR_Entry', target_id: E1, why: ' said one thing, did another ', proves_by: 'Document' }, { theme_id: T1, target_kind: 'matter_document', target_id: D1 }] })
    expect(good).toEqual({
      ok: true,
      rpc: 'dev_theme_marks_write',
      step: 'plan',
      body: { p: { stand: 'kept', marks: [{ theme_id: T1, target_kind: 'hr_entry', target_id: E1, why: 'said one thing, did another', proves_by: 'document' }, { theme_id: T1, target_kind: 'matter_document', target_id: D1 }] }, p_dry_run: true },
      dryRunBody: { p: { stand: 'kept', marks: [{ theme_id: T1, target_kind: 'hr_entry', target_id: E1, why: 'said one thing, did another', proves_by: 'document' }, { theme_id: T1, target_kind: 'matter_document', target_id: D1 }] }, p_dry_run: true },
      target: '2 marks',
      planHash: null,
    })
    const proposed = writeRpcBody('apply_theme_marks', { stand: 'Proposed', marks: [{ theme_id: T1, target_kind: 'hr_evidence', target_id: E1 }], plan_hash: hash })
    expect(proposed.ok && proposed.body).toEqual({ p: { stand: 'proposed', marks: [{ theme_id: T1, target_kind: 'hr_evidence', target_id: E1 }] }, p_dry_run: false })
    expect(proposed.ok && proposed.target).toBe('1 mark')
    expect(proposed.ok && proposed.planHash).toBe(hash)
    for (const bad of [
      {},
      { marks: [] },
      { marks: [{ theme_id: 'x', target_kind: 'hr_entry', target_id: E1 }] },
      { marks: [{ theme_id: T1, target_kind: 'license', target_id: E1 }] },
      { marks: [{ theme_id: T1, target_kind: 'hr_entry', target_id: E1, proves_by: 'hearsay' }] },
      { marks: [{ theme_id: T1, target_kind: 'hr_entry', target_id: E1, why: 'x'.repeat(201) }] },
      { stand: 'maybe', marks: [{ theme_id: T1, target_kind: 'hr_entry', target_id: E1 }] },
      { marks: Array.from({ length: 101 }, () => ({ theme_id: T1, target_kind: 'hr_entry', target_id: E1 })) },
    ]) {
      const r = writeRpcBody('plan_theme_marks', bad)
      expect(r.ok).toBe(false)
      expect(!r.ok && r.error).toContain('plan_theme_marks needs marks')
    }
    expect(alreadyApplied('apply_theme_marks', { target: '2 marks', at: '2026-11-06T00:00:00Z' })).toContain('on those marks at 2026-11-06T00:00:00Z')
    expect(alreadyApplied('apply_theme_marks', { target: null, at: null })).toContain('By theme view')
  })

  it('the migration is gated to devs, closed to anon, resolves each mark and creates no table', () => {
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_theme_marks_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_theme_marks_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_theme_marks_write(jsonb, boolean) TO authenticated;')
    expect(MIGRATION).not.toMatch(/CREATE TABLE/i)
    for (const kind of ['hr_entry', 'hr_evidence', 'matter_document', 'matter_entry']) expect(MIGRATION).toContain(`'${kind}'`)
    expect(MIGRATION).toContain("v_state := 'already'")
    expect(MIGRATION).toContain("INSERT INTO public.legal_theme_marks")
    expect(MIGRATION).toContain("'dev seat'")
  })

  it('the docs carry the verbs', () => {
    expect(README).toContain('`plan_theme_marks(marks, stand?)` · `apply_theme_marks(marks, plan_hash, stand?)`')
    expect(EDGE).toContain('dev_theme_marks_write')
  })
})
