import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { changeWords, docReadInput, getPersonDocument } from '../../../supabase/functions/_shared/devMcpDocRead'
import type { Reader, Row } from '../../../supabase/functions/_shared/devMcpComposites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261107080000_doc_read_by_section.sql', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const DOC = 'd1d2c3d4-0000-4000-8000-000000000012'
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

describe('get_person_document (a document a piece at a time, v2.6621)', () => {
  it('shapes the ask: doc_id or kind, one of the two; section a number or a heading', () => {
    expect(docReadInput({ person: PERSON, doc_id: DOC.toUpperCase(), section: 12 })).toEqual({ ok: true, docId: DOC, kind: null, section: '12' })
    expect(docReadInput({ person: PERSON, kind: 'narrative', section: ' 2. The spring ' })).toEqual({ ok: true, docId: null, kind: 'narrative', section: '2. The spring' })
    expect(docReadInput({ person: PERSON, kind: 'summary' })).toEqual({ ok: true, docId: null, kind: 'summary', section: null })
    expect(docReadInput({ person: PERSON })).toMatchObject({ ok: false, refused: expect.stringContaining('one of the two') })
    expect(docReadInput({ person: PERSON, doc_id: DOC, kind: 'summary' })).toMatchObject({ ok: false })
    expect(docReadInput({ person: PERSON, doc_id: 'nope' })).toMatchObject({ ok: false })
    expect(docReadInput({ person: PERSON, kind: 'history' })).toMatchObject({ ok: false })
  })

  it('the index without a section, then one section with its neighbours and the write that changes it', async () => {
    const index = { target: { doc_id: DOC, title: 'Company history', counsel_only: false, chars: 180000 }, lines: 290, sections: [{ i: 1, n: 1, heading: '1. How the person came to the team', level: 2, from_line: 1, to_line: 40, chars: 3000 }, { i: 2, n: 12, heading: '12. The training course', level: 2, from_line: 41, to_line: 90, chars: 4000 }], section: null }
    const r = reader(index)
    const out = await getPersonDocument(r, { person: 'Pat', doc_id: DOC }, { role: 'dev' })
    if ('refused' in out) throw new Error(out.refused)
    expect(r.asked).toEqual([{ name: 'dev_doc_read', args: { p_person_id: PERSON, p_doc_id: DOC, p_kind: null, p_section: null } }])
    expect(out.sections).toHaveLength(2)
    expect(out.section).toBeNull()
    expect(out.read_next).toContain('get_person_document { section: <n or heading> }')
    const one = { ...index, section: { ...index.sections[1]!, body: '## 12. The training course\n\nThe course.', cut: false, before: { n: 1, heading: '1. How the person came to the team' }, after: null } }
    const out2 = await getPersonDocument(reader(one), { person: PERSON, doc_id: DOC, section: 12 }, { role: 'dev' })
    if ('refused' in out2) throw new Error(out2.refused)
    expect(out2.section?.body).toContain('The course.')
    expect(out2.section?.before?.n).toBe(1)
    expect(out2.read_next).toBe(`Change this section with plan_person_doc { person_id, doc_id: "${DOC}", ops: [{ op: "replace_section", heading: "12. The training course", markdown }] }; insert_after the same heading adds after it.`)
    expect(changeWords({ docId: null, kind: 'narrative' }, { heading: null })).toContain('rewrites the whole document')
  })

  it('refuses another role before any read, and an unknown person', async () => {
    const r = reader({})
    expect(await getPersonDocument(r, { person: PERSON, kind: 'summary' }, { role: 'assistant' })).toMatchObject({ refused: expect.stringContaining('dev-only') })
    expect(r.asked).toEqual([])
    expect(await getPersonDocument(r, { person: 'nobody', kind: 'summary' }, { role: 'dev' })).toMatchObject({ refused: expect.stringContaining('No person') })
  })

  it('the server, the docs and the migration carry the verb; the function cuts sections as the headings read and refuses a section it lacks', () => {
    expect(SERVER).toContain("name: 'get_person_document'")
    expect(SERVER).toContain("case 'get_person_document': {")
    expect(README).toContain('`get_person_document(person, doc_id? \\| kind?, section?)`') // the pipe escaped for the table
    expect(MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_doc_read(p_person_id uuid, p_doc_id uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_section text DEFAULT NULL)')
    expect(MIGRATION).toContain("IF auth.uid() IS NULL OR NOT public.is_dev() THEN")
    expect(MIGRATION).toContain('FROM public.hr_doc_headings(v_text) h ORDER BY h.line_no')
    expect(MIGRATION).toContain("RAISE EXCEPTION 'dev_doc_read: no section \"%\" here. The sections: %'")
    expect(MIGRATION).toContain("'body', left(v_body, v_cap), 'cut', length(v_body) > v_cap")
    expect(MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_doc_read(uuid, uuid, text, text) FROM PUBLIC, anon;')
    expect(MIGRATION).not.toContain('CREATE TABLE')
  })
})
