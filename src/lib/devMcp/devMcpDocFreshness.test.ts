/**
 * get_person_document says when each section last changed (punch list #315, upgrade 5a, the seat's half; server
 * 0.124.0): freshness: true on the summary's or the narrative's index, through the tab's own kernel. Made-up words.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOC_FRESHNESS_REVISIONS, docFreshness, docReadInput, getPersonDocument } from '../../../supabase/functions/_shared/devMcpDocRead'
import type { Reader, Row } from '../../../supabase/functions/_shared/devMcpComposites'
import { parseSectionCitations as fromShared } from '../../../supabase/functions/_shared/sectionFreshness'
import { parseSectionCitations as fromTab } from '../people/hrDocCitations'
import { catalogReader } from './catalogReader'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const NOTES = readFileSync('docs/dev-mcp/SERVER_NOTES.md', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const ymdOf = (iso: string) => iso.slice(0, 10)
const NOW = '## 1. Background\n\nHired in February.\n\n## 2. The spring\n\nLate twice in April, and once in May.\n'
const WAS = '## 1. Background\n\nHired in February.\n\n## 2. The spring\n\nLate twice in April.\n'

function reader(tables: Record<string, Row[]>): Reader & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    rpc: async (name) => {
      asked.push(`rpc:${name}`)
      return { target: { kind: 'narrative' }, lines: 8, sections: [{ i: 1, n: 1, heading: '1. Background', level: 2, from_line: 1, to_line: 4, chars: 40 }], section: null }
    },
    rows: async (table, q) => {
      asked.push(`rows:${table}`)
      if (!(table in tables)) throw new Error(`relation "${table}" does not exist`)
      let out = [...tables[table]!]
      for (const f of q.filters ?? []) {
        if (f.op === 'eq') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'gt') out = out.filter((r) => String(r[f.column]) > String(f.value))
      }
      const by = q.order?.[0]
      if (by) out.sort((a, b) => (String(a[by.column]) < String(b[by.column]) ? -1 : 1) * (by.ascending === false ? -1 : 1))
      return out.slice(0, q.limit ?? 50)
    },
  }
}

const tables = (): Record<string, Row[]> => ({
  people: [{ id: PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2025-02-01', end_date: null, archived_at: null, account_user_id: null }],
  person_files: [{ person_id: PERSON, kind: 'narrative', content: NOW, updated_at: '2026-06-01T12:00:00Z' }],
  person_file_revisions: [
    { person_id: PERSON, kind: 'narrative', content: WAS, replaced_at: '2026-06-01T12:00:00Z' },
    { person_id: PERSON, kind: 'narrative', content: WAS, replaced_at: '2026-04-20T12:00:00Z' },
  ],
  person_file_entries: [
    { id: 'e1', person_id: PERSON, created_at: '2026-03-01T12:00:00Z', content: 'Hired. See N§1.' },
    { id: 'e2', person_id: PERSON, created_at: '2026-07-04T12:00:00Z', content: 'Late again, see N§2.' },
    { id: 'e3', person_id: PERSON, created_at: '2026-07-05T12:00:00Z', content: 'A call about the truck.' },
  ],
})

describe('get_person_document { freshness: true } (0.124.0)', () => {
  it('is asked for on the summary\'s or the narrative\'s index, and nowhere else', () => {
    expect(docReadInput({ person: PERSON, kind: 'narrative', freshness: true })).toMatchObject({ ok: true, kind: 'narrative', freshness: true })
    expect(docReadInput({ person: PERSON, kind: 'summary' })).toMatchObject({ ok: true, freshness: false })
    expect(docReadInput({ person: PERSON, kind: 'narrative', section: 2, freshness: true })).toMatchObject({ ok: false, refused: expect.stringContaining('on the index, without section') })
    expect(docReadInput({ person: PERSON, doc_id: 'd1d2c3d4-0000-4000-8000-000000000012', freshness: true })).toMatchObject({ ok: false, refused: expect.stringContaining('freshness is for the summary or the narrative') })
    expect(docReadInput({ person: PERSON, kind: 'narrative', freshness: 'yes' })).toMatchObject({ ok: false, refused: expect.stringContaining('freshness is true, or left out') })
  })

  it('says when each section took its words, how many entries are newer, and which an entry cites since', async () => {
    const out = await docFreshness(reader(tables()), PERSON, 'narrative', ymdOf)
    if ('held' in out) throw new Error(out.held)
    expect(out).toMatchObject({ versions_read: 2, older_versions: false, look_again: 1 })
    // Section 1 reads the same in every version read: at least as old as the oldest. Three entries were written since.
    expect(out.sections[0]).toEqual({ heading: '1. Background', level: 2, changed: 'not changed since before Apr 20, 2026', changed_at: '2026-04-20T12:00:00Z', at_least: true, since: 'at least 2 entries since', newer_entries: 2 })
    // Section 2 took its words when the newest version was replaced, and an entry written since cites it.
    expect(out.sections[1]).toEqual({ heading: '2. The spring', level: 2, changed: 'changed Jun 1, 2026', changed_at: '2026-06-01T12:00:00Z', since: '2 entries since, 1 cites it', newer_entries: 2, newer_citing: 1 })
    expect(out.note).toContain('look again at such a section')
  })

  it('reads at most twelve versions and says older ones exist; a file with no such document, or a refused read, is held', async () => {
    const many = tables()
    many.person_file_revisions = Array.from({ length: DOC_FRESHNESS_REVISIONS + 3 }, (_, i) => ({ person_id: PERSON, kind: 'narrative', content: WAS, replaced_at: `2026-0${1 + (i % 5)}-${String(10 + i).padStart(2, '0')}T12:00:00Z` }))
    const out = await docFreshness(reader(many), PERSON, 'narrative', ymdOf)
    if ('held' in out) throw new Error(out.held)
    expect(out).toMatchObject({ versions_read: DOC_FRESHNESS_REVISIONS, older_versions: true })
    expect(await docFreshness(reader(tables()), PERSON, 'summary', ymdOf)).toEqual({ held: 'no summary on this file' })
    const without = tables()
    delete without.person_file_revisions
    expect(await docFreshness(reader(without), PERSON, 'narrative', ymdOf)).toEqual({ held: 'relation "person_file_revisions" does not exist' })
  })

  it('rides on the index only when asked, the reads are ones the door accepts, and another role is refused before any', async () => {
    const r = reader(tables())
    const plain = await getPersonDocument(r, { person: PERSON, kind: 'narrative' }, { role: 'dev' })
    expect(plain).not.toHaveProperty('freshness')
    expect(r.asked).not.toContain('rows:person_file_revisions')
    const asked = await getPersonDocument(reader(tables()), { person: PERSON, kind: 'narrative', freshness: true }, { role: 'dev', ymdOf })
    if ('refused' in asked) throw new Error(asked.refused)
    expect(asked.freshness).toMatchObject({ versions_read: 2 })
    expect(asked.sections).toHaveLength(1)
    const door = catalogReader({ rows: {} })
    await expect(docFreshness(door, PERSON, 'narrative', ymdOf)).resolves.toEqual({ held: 'no narrative on this file' })
    expect(door.asked).toEqual(expect.arrayContaining(['rows:person_files', 'rows:person_file_revisions', 'rows:person_file_entries']))
    expect(await getPersonDocument(reader(tables()), { person: PERSON, kind: 'narrative', freshness: true }, { role: 'assistant' })).toMatchObject({ refused: expect.stringContaining('dev-only') })
  })

  it('the tab and the seat parse a citation with one function', () => {
    expect(fromTab).toBe(fromShared)
    expect(fromShared('See N§2 and §16, and N §2 again.').map((c) => c.section)).toEqual([2, 16])
  })

  it('the server, the README and the notes carry it', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.130.0'")
    expect(SERVER).toContain('freshness: args.freshness }, { role: who.role, ymdOf: calendarYmdInAppTzFromIso })')
    expect(SERVER).toContain("freshness: { type: 'boolean'")
    expect(README).toContain('`get_person_document(person, doc_id? \\| kind?, section?, freshness?)`')
    expect(README).toContain('**`freshness: true`**')
    expect(NOTES).toContain('0.124.0 (v2.8197')
  })
})
