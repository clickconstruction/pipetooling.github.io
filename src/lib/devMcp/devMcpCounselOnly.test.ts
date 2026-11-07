/**
 * Counsel-only evidence and the dev seat (v2.6554, punch list #269 PR 2): the seat names itself on every PostgREST,
 * storage and function call with X-Dev-Seat, which the restrictive policies read; plan_person_evidence carries
 * counsel_only; an apply of one never asks Drive; get_person_file names the hold from a definer's count; the
 * migration gates the flag the way the doc says.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const PERSON_FILE = readFileSync('supabase/functions/_shared/devMcpPersonFile.ts', 'utf8')
const FILER = readFileSync('supabase/functions/hr-evidence-drive/index.ts', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261106020000_evidence_counsel_only.sql', 'utf8')
const HR_DOC = readFileSync('docs/HR_FILES.md', 'utf8')

describe('counsel-only and the seat (v2.6554)', () => {
  it('the seat names itself on every call it makes as the dev', () => {
    const auth = SERVER.match(/Authorization: `Bearer \$\{jwt\}`/g)?.length ?? 0
    const named = SERVER.match(/Authorization: `Bearer \$\{jwt\}`, 'X-Dev-Seat': 'dev-mcp'/g)?.length ?? 0
    expect(auth).toBeGreaterThan(5)
    expect(named).toBe(auth)
    expect(SERVER).toContain("const SERVER_VERSION = '0.38.1'")
  })

  it('plan_person_evidence carries counsel_only only when true, and an apply of one never asks Drive', () => {
    const base = { person_id: '11111111-1111-4111-8111-111111111111', dated_on: '2026-11-05', title: 'A recording', memo: 'What it holds.', files: [{ name: 'a.m4a', drive_url: 'https://drive.google.com/file/d/abcdefghijklmnop/view' }] }
    const plain = writeRpcBody('plan_person_evidence', { evidence: base })
    expect(plain.ok && (plain.body as { p: Record<string, unknown> }).p.counsel_only).toBeUndefined()
    const held = writeRpcBody('plan_person_evidence', { evidence: { ...base, counsel_only: true } })
    expect(held.ok && (held.body as { p: Record<string, unknown> }).p.counsel_only).toBe(true)
    const off = writeRpcBody('plan_person_evidence', { evidence: { ...base, counsel_only: 'yes' } })
    expect(off.ok && (off.body as { p: Record<string, unknown> }).p.counsel_only).toBeUndefined()
    expect(SERVER).toContain("const counselOnly = (built.body as { p?: { counsel_only?: unknown } }).p?.counsel_only === true")
    expect(SERVER).toContain('never filed in Drive, never read by the agent or by this seat')
  })

  it('get_person_file names the hold from the definer count, the filer skips the record, and the migration gates it the way the doc says', () => {
    expect(PERSON_FILE).toContain("reader.rpc('person_counsel_only_count', { p_person_id: personId })")
    expect(PERSON_FILE).toContain('counsel-only record')
    expect(FILER).toContain('if (record.counsel_only) return { filed: 0, remaining: 0, failWhy: null, folderUrl: null }')
    expect(FILER).toContain(".eq('counsel_only', false)")
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(MIGRATION).toContain('ADD COLUMN IF NOT EXISTS counsel_only boolean NOT NULL DEFAULT false')
    expect(MIGRATION).toContain("AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (counsel_only AND public.request_is_dev_seat()))")
    expect(MIGRATION).toContain("FOR SELECT TO hr_agent USING (evidence_id IS NULL OR NOT public.evidence_is_counsel_only(evidence_id))")
    expect(MIGRATION).toContain("'counsel_only', v_counsel")
    expect(MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(HR_DOC).toContain('not a second password')
  })
})
