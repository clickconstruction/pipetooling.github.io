import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CASE_SEARCH_SOURCES, caseSearchInput, readNextFor, searchCase } from '../../../supabase/functions/_shared/devMcpCaseSearch'
import type { Reader, Row } from '../../../supabase/functions/_shared/devMcpComposites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261107070000_case_search.sql', 'utf8')
const FILES_MIGRATION = readFileSync('supabase/migrations/20261108220000_case_search_files.sql', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const people: Row[] = [{ id: PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2025-02-01', end_date: null, archived_at: null, account_user_id: null }]

function reader(rpcReply: unknown): Reader & { asked: unknown[] } {
  const asked: unknown[] = []
  return {
    asked,
    rpc: async (name, args) => {
      asked.push({ name, args })
      return rpcReply
    },
    rows: async (table, q) => {
      if (table !== 'people') throw new Error(`relation "${table}" does not exist`)
      let out = people
      for (const f of q.filters ?? []) {
        if (f.op === 'eq') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'ilike') out = out.filter((r) => String(r[f.column] ?? '').toLowerCase().includes(String(f.value).replace(/[%*]/g, '').toLowerCase()))
      }
      return out
    },
  }
}

describe('search_case (one full-text search across a person\'s case, v2.6620)', () => {
  it('shapes the ask: q required and bounded, in from the seven sources (files since v2.6719), limit 1 to 100 with 40 the default', () => {
    expect(caseSearchInput({ person: PERSON, q: 'rock', in: 'files' })).toEqual({ ok: true, q: 'rock', in: 'files', limit: 40 })
    expect(caseSearchInput({ person: PERSON, q: '  generator trip ' })).toEqual({ ok: true, q: 'generator trip', in: null, limit: 40 })
    expect(caseSearchInput({ person: PERSON, q: 'x', in: 'documents', limit: 500 })).toEqual({ ok: true, q: 'x', in: 'documents', limit: 100 })
    expect(caseSearchInput({ person: PERSON, q: '' })).toMatchObject({ ok: false, refused: expect.stringContaining('needs q') })
    expect(caseSearchInput({ person: PERSON, q: 'x', in: 'mail' })).toMatchObject({ ok: false, refused: expect.stringContaining(CASE_SEARCH_SOURCES.join(', ')) })
    expect(caseSearchInput({ person: PERSON, q: 'y'.repeat(401) })).toMatchObject({ ok: false })
  })

  it('resolves the person, calls dev_case_search as the dev, and hands each hit the verb that reads it further', async () => {
    const r = reader({
      q: 'generator', query: "'generat'", in: null, person_id: PERSON, matter_id: 'm1', count: 3, shown: 3,
      hits: [
        { source: 'document', id: 'd1', title: 'Company history', section_n: 12, section: '12. The spring trips', day: '2026-11-07', counsel_only: false, rank: 0.31, snippet: 'the «generator» trip' },
        { source: 'entry', id: 'e1', title: null, section_n: null, section: null, day: '2026-09-01', counsel_only: false, rank: 0.2, snippet: 'billed for a «generator»' },
        { source: 'evidence', id: 'r1', title: 'Call K', section_n: null, section: null, day: '2026-09-01', counsel_only: true, rank: 0.1, snippet: 'the «generator» itemized' },
        { source: 'file', id: 'aaaaaaaa-1111-4222-8333-444444444444', title: 'Call K transcript.md', section_n: null, section: null, day: '2026-09-01', counsel_only: true, rank: 0.09, snippet: 'Pat: the «generator» was on the bill', record_kind: 'evidence', record_id: 'r1', record_title: 'Call K' },
      ],
    })
    const out = await searchCase(r, { person: 'Pat', q: 'generator' }, { role: 'dev' })
    if ('refused' in out) throw new Error(out.refused)
    expect(r.asked).toEqual([{ name: 'dev_case_search', args: { p_person_id: PERSON, p_q: 'generator', p_in: null, p_limit: 40 } }])
    expect(out).toMatchObject({ person: { id: PERSON, name: 'Pat Doe' }, q: 'generator', query: "'generat'", matter_id: 'm1', count: 3, shown: 4, by_source: { document: 1, entry: 1, evidence: 1, file: 1 } })
    expect(out.hits[0]).toMatchObject({ source: 'document', section_n: 12, read_next: expect.stringContaining('plan_person_doc { doc_id, ops }') })
    expect(out.hits[2]).toMatchObject({ counsel_only: true, read_next: expect.stringContaining('evidence') })
    expect(readNextFor('matter_document')).toContain('a file hit')
    // #285 PR 2: a file hit carries the record it hangs on and reads further through the index row and the record.
    expect(out.hits[3]).toMatchObject({ source: 'file', record_kind: 'evidence', record_id: 'r1', record_title: 'Call K', counsel_only: true, read_next: expect.stringContaining('file_index') })
    expect(out.note).toContain('in: files')
  })

  it('refuses another role before any read, and an unknown person', async () => {
    const r = reader({ hits: [] })
    expect(await searchCase(r, { person: PERSON, q: 'x' }, { role: 'assistant' })).toMatchObject({ refused: expect.stringContaining('dev-only') })
    expect(r.asked).toEqual([])
    expect(await searchCase(r, { person: 'nobody', q: 'x' }, { role: 'dev' })).toMatchObject({ refused: expect.stringContaining('No person') })
  })

  it('the server, the docs and the migration carry the verb: the section splitter, the five GIN indexes, the seven sources, devs only', () => {
    expect(SERVER).toContain("name: 'search_case'")
    expect(SERVER).toContain("case 'search_case': {")
    expect(README).toContain('`search_case(person, q, in?, limit?)`')
    expect(MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.hr_doc_sections(md text)')
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_case_search(p_person_id uuid, p_q text, p_in text DEFAULT NULL, p_limit int DEFAULT 40)')
    expect(MIGRATION).toContain("IF auth.uid() IS NULL OR NOT public.is_dev() THEN")
    expect(MIGRATION).toContain("websearch_to_tsquery('english', p_q)")
    expect((MIGRATION.match(/USING gin \(to_tsvector\('english'/g) ?? []).length).toBe(5)
    for (const src of ["'entry'::text AS source", "'evidence'", "'document'", 'f.kind, f.id::text', "'matter_narrative'", "'matter_entry'", "'matter_document'"]) expect(MIGRATION).toContain(src)
    expect(MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_case_search(uuid, text, text, int) FROM PUBLIC, anon;')
    expect(MIGRATION).not.toContain('CREATE TABLE')
  })

  it('the files migration (v2.6719, #285 PR 2) replaces the search with the file source, the record columns on every branch, in: files, and the record rows’ GIN', () => {
    expect(FILES_MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(FILES_MIGRATION).toContain("CREATE INDEX IF NOT EXISTS file_index_record_text_fts ON public.file_index USING gin (to_tsvector('english', coalesce(text, ''))) WHERE source <> 'drive';")
    expect(FILES_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_case_search(p_person_id uuid, p_q text, p_in text DEFAULT NULL, p_limit int DEFAULT 40)')
    expect(FILES_MIGRATION).toContain("IF auth.uid() IS NULL OR NOT public.is_dev() THEN")
    expect(FILES_MIGRATION).toContain("p_in NOT IN ('entries', 'evidence', 'documents', 'summary', 'narrative', 'matter', 'files')")
    for (const src of ["'entry'::text AS source", "'evidence'", "'document'", 'f.kind, f.id::text', "'matter_narrative'", "'matter_entry'", "'matter_document'", "SELECT 'file', f.drive_file_id, f.name"]) expect(FILES_MIGRATION).toContain(src)
    expect(FILES_MIGRATION).toContain('NULL::text AS record_kind, NULL::text AS record_id, NULL::text AS record_title')
    // Every branch but the file's carries the three nulls: eight branches (#288's sectioned matter text among them), seven with the nulls.
    expect((FILES_MIGRATION.match(/\n           NULL, NULL, NULL\n/g) ?? []).length).toBe(7)
    expect(FILES_MIGRATION).toContain('JOIN public.documents t ON t.id = d.text_document_id')
    expect(FILES_MIGRATION).toContain("AND (f.source <> 'matter_document' OR d.text_document_id IS NULL)")
    expect(FILES_MIGRATION).toContain('PUSH THIS ONLY ONCE 20261108210000 IS ON MAIN')
    expect(FILES_MIGRATION).toContain("WHERE f.source <> 'drive' AND f.text IS NOT NULL")
    expect(FILES_MIGRATION).toContain("AND (f.person_id = p_person_id OR (v_matter IS NOT NULL AND f.matter_id = v_matter))")
    expect(FILES_MIGRATION).toContain("AND (p_in IS NULL OR p_in = 'files')")
    expect(FILES_MIGRATION).toContain("'record_kind', r.record_kind, 'record_id', r.record_id, 'record_title', r.record_title")
    expect(FILES_MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_case_search(uuid, text, text, int) FROM PUBLIC, anon;')
    expect(FILES_MIGRATION).not.toContain('CREATE TABLE')
    expect(SERVER).toContain('matter | files; every source when left out')
  })
})
