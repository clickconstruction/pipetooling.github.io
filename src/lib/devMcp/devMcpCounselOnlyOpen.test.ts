/**
 * The dev seat reads counsel-only material (v2.6986). The owner opened it to the seat "for now": every seat fence asks
 * counsel_only_held_from_seat(), which answers false, so putting the fence back is one function body. The Drive filer,
 * the firm's portal and print and the hr_agent key keep their fences. get_person_file and get_case_brief name a hold
 * only for counsel-only items a definer's count names that the seat's read did not hand back.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { counselOnlyHeldReason, counselOnlyStillHeld } from '../../../supabase/functions/_shared/devMcpCounselOnly'

const DIR = 'supabase/migrations'
const STAMP = '20261112090000_dev_seat_reads_counsel_only.sql'
const MIGRATION = readFileSync(`${DIR}/${STAMP}`, 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const PERSON_FILE = readFileSync('supabase/functions/_shared/devMcpPersonFile.ts', 'utf8')
const CASE_BRIEF = readFileSync('supabase/functions/_shared/devMcpCaseBrief.ts', 'utf8')
const CASE_SEARCH = readFileSync('supabase/functions/_shared/devMcpCaseSearch.ts', 'utf8')
const FILER = readFileSync('supabase/functions/hr-evidence-drive/index.ts', 'utf8')

/** Every seat fence ever created: a restrictive policy named *_counsel_only_seat, with the migration that made it. */
function seatFences(): { name: string; table: string; file: string }[] {
  const out: { name: string; table: string; file: string }[] = []
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.sql') && f < STAMP).sort()) {
    const sql = readFileSync(`${DIR}/${file}`, 'utf8')
    for (const m of sql.matchAll(/CREATE POLICY (\w+_counsel_only_seat) ON public\.(\w+)/g)) out.push({ name: m[1]!, table: m[2]!, file })
  }
  return out
}

/** A function's body as one migration wrote it, from CREATE OR REPLACE to its closing $fn$;. */
function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  const end = sql.indexOf('$fn$;', start)
  return sql.slice(start, end)
}

describe('the dev seat reads counsel-only material (v2.6986)', () => {
  it('counselOnlyStillHeld names only what the count holds and the read did not hand back', () => {
    expect(counselOnlyStillHeld(12, 12)).toBe(0)
    expect(counselOnlyStillHeld(12, 0)).toBe(12)
    expect(counselOnlyStillHeld([3], 1)).toBe(2)
    expect(counselOnlyStillHeld(2, 5)).toBe(0)
    expect(counselOnlyStillHeld(null, 0)).toBe(0)
    expect(counselOnlyStillHeld('not a number', 0)).toBe(0)
    expect(counselOnlyHeldReason(1)).toBe('1 counsel-only record, kept from the seat; a dev reads it on People → HR')
    expect(counselOnlyHeldReason(4)).toBe('4 counsel-only records, kept from the seat; a dev reads them on People → HR')
  })

  it('the migration opens every seat fence through one switch that answers false', () => {
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(MIGRATION).not.toMatch(/CREATE TABLE/i)
    expect(MIGRATION).toMatch(/CREATE OR REPLACE FUNCTION public\.counsel_only_held_from_seat\(\)\s+RETURNS boolean LANGUAGE sql IMMUTABLE AS \$\$[\s\S]*?SELECT false\s+\$\$;/)
    const fences = seatFences()
    expect(fences.map((f) => f.name).sort()).toEqual([
      'documents_matter_counsel_only_seat',
      'file_index_counsel_only_seat',
      'legal_matter_documents_counsel_only_seat',
      'person_file_amendments_counsel_only_seat',
      'person_file_attachments_counsel_only_seat',
      'person_file_evidence_counsel_only_seat',
    ])
    for (const f of fences) {
      const at = MIGRATION.indexOf(`ALTER POLICY ${f.name} ON public.${f.table}`)
      expect(at, `${f.name} (made in ${f.file}) is altered here`).toBeGreaterThan(-1)
      const stmt = MIGRATION.slice(at, MIGRATION.indexOf(';', at))
      expect(stmt).toContain('public.request_is_dev_seat()')
      expect(stmt).toContain('public.counsel_only_held_from_seat()')
    }
  })

  it('dev_matter_doc_read changes in its refusal alone', () => {
    const before = functionBody(readFileSync(`${DIR}/20261108233000_matter_document_read_by_section.sql`, 'utf8'), 'dev_matter_doc_read')
    const after = functionBody(MIGRATION, 'dev_matter_doc_read')
    expect(before.length).toBeGreaterThan(500)
    expect(after).toBe(before.replace(
      'IF v_row.counsel_only AND public.request_is_dev_seat() THEN',
      'IF v_row.counsel_only AND public.request_is_dev_seat() AND public.counsel_only_held_from_seat() THEN',
    ))
  })

  it('the other fences stand: the hr_agent key, the Drive filer, the portal', () => {
    expect(MIGRATION).not.toMatch(/TO hr_agent USING/)
    expect(MIGRATION).not.toMatch(/DROP POLICY/)
    expect(FILER).toContain('if (record.counsel_only) return { filed: 0, remaining: 0, failWhy: null, folderUrl: null }')
    expect(readFileSync('supabase/functions/legal-portal/index.ts', 'utf8')).toContain('counsel_only')
  })

  it('the seat marks what it reads and names a hold only for what did not come back', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.83.0'")
    expect(SERVER).toContain('a counsel-only paper is read like any other since 0.76.0')
    expect(PERSON_FILE).toContain("drive_folder_url,filed_at,fail_why,counsel_only'")
    expect(PERSON_FILE).toContain("counselOnlyStillHeld(raw, evidenceRows.filter((r) => r.counsel_only === true).length)")
    expect(PERSON_FILE).toContain('...(r.counsel_only ? { counsel_only: true } : {})')
    expect(CASE_BRIEF).toContain("'id,title,state,dated_on,voided_at,mime,counsel_only'")
    expect(CASE_BRIEF).toContain('counselOnlyStillHeld(counselOnlyCount,')
    expect(CASE_SEARCH).toContain('evidence_title: r ? r.title : null')
  })
})
