import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DIFF_CHARS_CAP, DIFF_LCS_LINES, DIFF_LINES_CAP, docHistoryInput, getDocumentHistory, lineDiff } from '../../../supabase/functions/_shared/devMcpDocHistory'
import type { Reader, Row } from '../../../supabase/functions/_shared/devMcpComposites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261107090000_doc_history.sql', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const DOC = 'd1d2c3d4-0000-4000-8000-000000000012'
const REV = 'e1e2c3d4-0000-4000-8000-000000000021'
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

describe('get_document_history (what moved on a document, v2.6622)', () => {
  it('the line diff: common ends dropped, the middle as hunks with the first line of each change, exact when small, one block when big, capped', () => {
    expect(lineDiff('a\nb\nc', 'a\nb\nc')).toEqual({ same: true, removed_lines: 0, added_lines: 0, hunks: [], cut: false, exact: true })
    expect(lineDiff('a\nb\nc\nd', 'a\nB\nc\nd\ne')).toEqual({ same: false, removed_lines: 3, added_lines: 4, exact: true, cut: false, hunks: [{ from_line: 2, removed: ['b'], added: ['B'] }, { from_line: 5, removed: [], added: ['e'] }] })
    expect(lineDiff('', 'new').hunks).toEqual([{ from_line: 1, removed: [], added: ['new'] }])
    // One changed line in a long text is still exact: the common ends are dropped first. Every line changed is not.
    const long = Array.from({ length: DIFF_LCS_LINES + 1 }, (_, i) => `line ${i}`).join('\n')
    expect(lineDiff(long, long.replace('line 5', 'LINE 5'))).toMatchObject({ exact: true, hunks: [{ from_line: 6, removed: ['line 5'], added: ['LINE 5'] }] })
    const bigDiff = lineDiff(long, Array.from({ length: DIFF_LCS_LINES + 1 }, (_, i) => `other ${i}`).join('\n'))
    expect(bigDiff.exact).toBe(false)
    expect(bigDiff.hunks).toHaveLength(1)
    expect(bigDiff.cut).toBe(true)
    expect(bigDiff.hunks[0]!.removed.length + bigDiff.hunks[0]!.added.length).toBe(DIFF_LINES_CAP)
  })

  it('v2.6642: the hunks stop at the character cap too, a long line cut to fit with an ellipsis, so the reply stays under the door\'s 80,000', () => {
    // Paragraph-long lines: 400 of them would be far over the door's cap.
    const para = (tag: string, i: number) => `${tag} ${i} ` + 'w'.repeat(900)
    const before = Array.from({ length: 300 }, (_, i) => para('old', i)).join('\n')
    const after = Array.from({ length: 300 }, (_, i) => para('new', i)).join('\n')
    const d = lineDiff(before, after)
    const sent = d.hunks.reduce((n, h) => n + [...h.removed, ...h.added].reduce((m, l) => m + l.length + 1, 0), 0)
    expect(d.cut).toBe(true)
    expect(sent).toBeLessThanOrEqual(DIFF_CHARS_CAP + 1)
    expect(JSON.stringify(d).length).toBeLessThan(80_000)
    const last = d.hunks[d.hunks.length - 1]!
    const lastLine = [...last.removed, ...last.added].pop()!
    expect(lastLine.endsWith('…') || sent < DIFF_CHARS_CAP).toBe(true)
    // A small change in short lines is untouched by the cap.
    expect(lineDiff('a\nb', 'a\nc')).toMatchObject({ cut: false, hunks: [{ from_line: 2, removed: ['b'], added: ['c'] }] })
  })

  it('shapes the ask: doc_id or kind; from a revision id; to needs from', () => {
    expect(docHistoryInput({ person: PERSON, doc_id: DOC })).toEqual({ ok: true, docId: DOC, kind: null, from: null, to: null })
    expect(docHistoryInput({ person: PERSON, kind: 'narrative', from: REV })).toEqual({ ok: true, docId: null, kind: 'narrative', from: REV, to: null })
    expect(docHistoryInput({ person: PERSON, kind: 'narrative', to: REV })).toMatchObject({ ok: false, refused: expect.stringContaining('to needs from') })
    expect(docHistoryInput({ person: PERSON })).toMatchObject({ ok: false })
    expect(docHistoryInput({ person: PERSON, doc_id: DOC, from: 'nope' })).toMatchObject({ ok: false })
  })

  it('lists the revisions with now, and with from (and to left out) diffs the older revision against the text as it stands', async () => {
    const list = { now: { doc_id: DOC, title: 'Interview guide', chars: 40, updated_at: '2026-11-07T06:00:00Z', kept_by: 'Robert' }, revisions: [{ id: REV, replaced_at: '2026-11-07T06:00:00Z', replaced_by: 'Robert', chars: 30 }], from: null, to: null }
    const r = reader(list)
    const out = await getDocumentHistory(r, { person: 'Pat', doc_id: DOC }, { role: 'dev' })
    if ('refused' in out) throw new Error(out.refused)
    expect(r.asked).toEqual([{ name: 'dev_doc_history', args: { p_person_id: PERSON, p_doc_id: DOC, p_kind: null, p_from: null, p_to: null } }])
    expect(out).toMatchObject({ revision_count: 1, diff: null, read_next: expect.stringContaining('Pass from') })
    const withDiff = { ...list, from: { id: REV, replaced_at: '2026-11-07T06:00:00Z', content: '## Before\n\nRead the file.' }, to: { id: null, replaced_at: null, content: '## Before\n\nRead the whole file.' } }
    const out2 = await getDocumentHistory(reader(withDiff), { person: PERSON, doc_id: DOC, from: REV }, { role: 'dev' })
    if ('refused' in out2) throw new Error(out2.refused)
    expect(out2.diff).toMatchObject({ from: { id: REV, chars: 25 }, to: { id: null, chars: 31 }, same: false, exact: true, hunks: [{ from_line: 3, removed: ['Read the file.'], added: ['Read the whole file.'] }] })
  })

  it('refuses another role before any read; the server, docs and migration carry the verb', async () => {
    const r = reader({})
    expect(await getDocumentHistory(r, { person: PERSON, kind: 'summary' }, { role: 'assistant' })).toMatchObject({ refused: expect.stringContaining('dev-only') })
    expect(r.asked).toEqual([])
    expect(SERVER).toContain("name: 'get_document_history'")
    expect(SERVER).toContain("case 'get_document_history': {")
    expect(README).toContain('`get_document_history(person, doc_id? \\| kind?, from?, to?)`')
    expect(MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_doc_history(p_person_id uuid, p_doc_id uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_from uuid DEFAULT NULL, p_to uuid DEFAULT NULL)')
    expect(MIGRATION).toContain("IF auth.uid() IS NULL OR NOT public.is_dev() THEN")
    expect(MIGRATION).toContain('FROM public.person_document_revisions r LEFT JOIN public.users u ON u.id = r.replaced_by')
    expect(MIGRATION).toContain('FROM public.person_file_revisions r LEFT JOIN public.users u ON u.id = r.replaced_by')
    expect(MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_doc_history(uuid, uuid, text, uuid, uuid) FROM PUBLIC, anon;')
    expect(MIGRATION).not.toContain('CREATE TABLE')
  })
})
