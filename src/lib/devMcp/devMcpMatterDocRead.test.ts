import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getMatterDocument, matterDocReadInput, matterReadNextWords } from '../../../supabase/functions/_shared/devMcpMatterDocRead'
import type { Reader } from '../../../supabase/functions/_shared/devMcpComposites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261108233000_matter_document_read_by_section.sql', 'utf8')

const MATTER = '7a1f3c2e-5b64-4d8a-9e21-0c3f5a7b9d11'
const DOC = 'd1d2c3d4-0000-4000-8000-000000000012'

function reader(rpcReply: unknown): Reader & { asked: unknown[] } {
  const asked: unknown[] = []
  return {
    asked,
    rpc: async (name, args) => {
      asked.push({ name, args })
      return rpcReply
    },
    rows: async (table) => {
      throw new Error(`relation "${table}" is not read here`)
    },
  }
}

describe('get_matter_document (a matter\'s text document a piece at a time, v2.6722, punch list #288 PR 3)', () => {
  it('shapes the ask: the matter and the Evidence row as uuids, section a number or a heading', () => {
    expect(matterDocReadInput({ matter_id: MATTER.toUpperCase(), doc_id: DOC, section: 3 })).toEqual({ ok: true, matterId: MATTER, docId: DOC, section: '3' })
    expect(matterDocReadInput({ matter_id: MATTER, doc_id: DOC, section: ' Held with counsel ' })).toEqual({ ok: true, matterId: MATTER, docId: DOC, section: 'Held with counsel' })
    expect(matterDocReadInput({ matter_id: MATTER, doc_id: DOC })).toEqual({ ok: true, matterId: MATTER, docId: DOC, section: null })
    expect(matterDocReadInput({ matter_id: 'burd', doc_id: DOC })).toMatchObject({ ok: false, refused: expect.stringContaining('matter_id') })
    expect(matterDocReadInput({ matter_id: MATTER, doc_id: 'memo' })).toMatchObject({ ok: false, refused: expect.stringContaining('doc_id') })
    expect(matterDocReadInput({ matter_id: MATTER, doc_id: DOC, section: 'x'.repeat(201) })).toMatchObject({ ok: false })
  })

  it('calls dev_matter_doc_read as the dev, hands back the index or the one section, and names what reads on', async () => {
    const index = { target: { document_id: DOC, title: 'Intake memo', counsel_only: true, chars: 9000 }, lines: 120, sections: [{ i: 1, n: 1, heading: '1. The facts', level: 2, from_line: 1, to_line: 60, chars: 4000 }, { i: 2, n: 2, heading: '2. Held with counsel', level: 2, from_line: 61, to_line: 120, chars: 5000 }], section: null }
    const r = reader(index)
    const out = await getMatterDocument(r, { matter_id: MATTER, doc_id: DOC }, { role: 'dev' })
    if ('refused' in out) throw new Error(out.refused)
    expect(r.asked).toEqual([{ name: 'dev_matter_doc_read', args: { p_matter_id: MATTER, p_doc_id: DOC, p_section: null } }])
    expect(out).toMatchObject({ matter_id: MATTER, lines: 120, section: null })
    expect(out.sections).toHaveLength(2)
    expect(out.target).toMatchObject({ counsel_only: true })
    expect(out.read_next).toContain('get_matter_document { matter_id, doc_id, section: <n or heading> }')
    const one = { ...index, section: { ...index.sections[1]!, body: '## 2. Held with counsel\n\nThe words.', cut: false, before: { n: 1, heading: '1. The facts' }, after: null } }
    const out2 = await getMatterDocument(reader(one), { matter_id: MATTER, doc_id: DOC, section: 2 }, { role: 'dev' })
    if ('refused' in out2) throw new Error(out2.refused)
    expect(out2.section?.body).toContain('The words.')
    expect(out2.read_next).toBe(matterReadNextWords(out2.section))
    expect(out2.read_next).toContain('read_rows on legal_matter_documents by id')
  })

  it('refuses another role before any read, and a bad ask', async () => {
    const r = reader({})
    expect(await getMatterDocument(r, { matter_id: MATTER, doc_id: DOC }, { role: 'assistant' })).toMatchObject({ refused: expect.stringContaining('dev only') })
    expect(await getMatterDocument(r, { matter_id: MATTER, doc_id: 'nope' }, { role: 'dev' })).toMatchObject({ refused: expect.stringContaining('doc_id') })
    expect(r.asked).toEqual([])
  })

  it('the server, the README and the migration carry the verb; the function refuses a file alone and a counsel-only paper to the seat, and the slice is one grammar', () => {
    expect(SERVER).toContain("name: 'get_matter_document'")
    expect(SERVER).toContain("case 'get_matter_document': {")
    expect(SERVER).toContain("const SERVER_VERSION = '0.65.0'")
    expect(README).toContain('`get_matter_document(matter_id, doc_id, section?)`')
    expect(MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(MIGRATION).toContain("CREATE OR REPLACE FUNCTION public.hr_doc_slice(p_text text, p_section text DEFAULT NULL, p_who text DEFAULT 'the document')")
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_matter_doc_read(p_matter_id uuid, p_doc_id uuid, p_section text DEFAULT NULL)')
    expect(MIGRATION).toContain("IF auth.uid() IS NULL OR NOT public.is_dev() THEN\n    RAISE EXCEPTION 'dev_matter_doc_read: devs only'")
    expect(MIGRATION).toContain('IF v_row.counsel_only AND public.request_is_dev_seat() THEN')
    expect(MIGRATION).toContain('IF v_row.text_document_id IS NULL THEN')
    expect(MIGRATION).toContain("RETURN jsonb_build_object('target', v_target) || public.hr_doc_slice(v_text, p_section, 'dev_matter_doc_read');")
    expect(MIGRATION).toContain("RETURN jsonb_build_object('target', v_target) || public.hr_doc_slice(v_text, p_section, 'dev_doc_read');")
    expect(MIGRATION).toContain('FROM public.documents d WHERE d.id = p_doc_id AND d.person_id = p_person_id;')
    expect(MIGRATION).toContain('FROM public.document_revisions r LEFT JOIN public.users u ON u.id = r.replaced_by')
    expect(MIGRATION).not.toMatch(/person_documents|person_document_revisions/)
    expect(MIGRATION).not.toContain('CREATE TABLE')
    expect(MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_matter_doc_read(uuid, uuid, text) FROM PUBLIC, anon;')
  })

  it('every function in the migration is whole: one header, one DECLARE, one BEGIN and one END (the SQL beds caught a doubled header and a lost DECLARE)', () => {
    const fns = [...MIGRATION.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([\s\S]*?)\n\$fn\$;/g)]
    expect(fns.map((m) => m[1])).toEqual(['hr_doc_slice', 'dev_doc_read', 'dev_matter_doc_read', 'dev_doc_history'])
    for (const m of fns) {
      const body = m[2]!
      expect(body, m[1]).not.toContain('CREATE OR REPLACE FUNCTION')
      expect(body.split('AS $fn$').length - 1, m[1]).toBe(1)
      for (const kw of ['DECLARE', 'BEGIN', 'END;']) expect((body.match(new RegExp(`^${kw}$`, 'gm')) ?? []).length, `${m[1]} ${kw}`).toBe(1)
    }
  })
})
