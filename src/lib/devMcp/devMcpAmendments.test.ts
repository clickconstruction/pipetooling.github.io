/**
 * The dev seat's reads carry the correction links (punch list #315, upgrade 1, PR 3; server 0.81.0): get_person_file's
 * lines and records, get_case_brief's newest entries and evidence index, and search_case's entry and evidence hits say
 * which thing was corrected or completed, by what, and what the latest word is. Made-up people and words.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AMENDMENTS_NOTE, amendmentCounts, amendmentDays, amendmentKeyOfRow, amendmentRowOfKey, newestAmendments, readPersonAmendments, seatAmendmentBits } from '../../../supabase/functions/_shared/devMcpAmendments'
import { getCaseBrief } from '../../../supabase/functions/_shared/devMcpCaseBrief'
import { searchCase } from '../../../supabase/functions/_shared/devMcpCaseSearch'
import type { Reader, Row } from '../../../supabase/functions/_shared/devMcpComposites'
import { getPersonFile, type PersonFileWholeReply } from '../../../supabase/functions/_shared/devMcpPersonFile'
import { amendmentIndex, type PersonAmendmentRow } from '../people/personAmendments'
import { catalogReader } from './catalogReader'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const DEVUSER = '33333333-2222-4333-8444-555555555555'
const E1 = 'aaaaaaa1-2222-4333-8444-555555555555'
const E2 = 'aaaaaaa2-2222-4333-8444-555555555555'
const E3 = 'aaaaaaa3-2222-4333-8444-555555555555'
const E4 = 'aaaaaaa4-2222-4333-8444-555555555555'
const R1 = 'bbbbbbb1-2222-4333-8444-555555555555'

const link = (id: string, from: [string, string], to: [string, string], how: string, at: string, withdrawn: string | null = null): PersonAmendmentRow => ({ id, from_kind: from[0], from_id: from[1], to_kind: to[0], to_id: to[1], how, created_at: at, withdrawn_at: withdrawn })

/**
 * e1 (Mar 30) said 4:10. e2 (Apr 15) corrects it. e3 (May 2) corrects e2, so the latest word on e1 is e3.
 * e4 (May 9) completes the record r1. A withdrawn link (e4 corrects e1) stays on the table and is not drawn.
 */
const LINKS: PersonAmendmentRow[] = [
  link('l1', ['hr_entry', E2], ['hr_entry', E1], 'corrects', '2026-04-15T12:00:01Z'),
  link('l2', ['hr_entry', E3], ['hr_entry', E2], 'corrects', '2026-05-02T12:00:01Z'),
  link('l3', ['hr_entry', E4], ['hr_evidence', R1], 'completes', '2026-05-09T12:00:01Z'),
  link('l4', ['hr_entry', E4], ['hr_entry', E1], 'corrects', '2026-05-09T12:00:02Z', '2026-05-10T09:00:00Z'),
]
const DAYS: Record<string, string> = { [`hr_entry:${E1}`]: '2026-03-30', [`hr_entry:${E2}`]: '2026-04-15', [`hr_entry:${E3}`]: '2026-05-02', [`hr_entry:${E4}`]: '2026-05-09', [`hr_evidence:${R1}`]: '2026-04-01' }
const dayOf = (k: string) => DAYS[k] ?? null

const ENTRIES: Row[] = [
  { id: E1, person_id: PERSON, entry_date: '2026-03-30', content: 'The truck came back at 4:10.', source: 'incident', created_by: DEVUSER, created_at: '2026-03-30T12:00:00Z', author_label: null },
  { id: E2, person_id: PERSON, entry_date: '2026-04-15', content: 'The gate log reads 5:40, not 4:10.', source: 'incident', created_by: DEVUSER, created_at: '2026-04-15T12:00:00Z', author_label: null },
  { id: E3, person_id: PERSON, entry_date: '2026-05-02', content: 'The gate log was read against the wrong day. It reads 5:10.', source: 'incident', created_by: DEVUSER, created_at: '2026-05-02T12:00:00Z', author_label: null },
  { id: E4, person_id: PERSON, entry_date: '2026-05-09', content: 'The yard camera shows the same truck at the gate.', source: 'incident', created_by: DEVUSER, created_at: '2026-05-09T12:00:00Z', author_label: null },
]
const EVIDENCE: Row[] = [{ id: R1, person_id: PERSON, entry_id: null, dated_on: '2026-04-01', title: 'Gate log, the week of March 30', memo: 'A photo of the page.', created_by: DEVUSER, author_label: null, created_at: '2026-04-01T09:00:00Z', drive_folder_id: null, drive_folder_url: null, filed_at: null, fail_why: null, counsel_only: false }]
const PEOPLE: Row[] = [{ id: PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2025-02-01', end_date: null, archived_at: null, account_user_id: null }]

/** A plain reader over tables: the filters the reads use, and a refusal for a table it does not hold. */
function tableReader(tables: Record<string, Row[]>, rpc: Record<string, unknown> = {}): Reader & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    rpc: async (name) => {
      asked.push(`rpc:${name}`)
      if (!(name in rpc)) throw new Error(`rpc ${name} is not in the fixture`)
      return rpc[name]
    },
    rows: async (table, q) => {
      asked.push(`rows:${table}`)
      if (!(table in tables)) throw new Error(`relation "${table}" does not exist`)
      let out = tables[table]!
      for (const f of q.filters ?? []) {
        if (f.op === 'eq') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'in') out = out.filter((r) => (f.value as unknown[]).includes(r[f.column]))
        else if (f.op === 'is') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'gt') out = out.filter((r) => String(r[f.column]) > String(f.value))
        else if (f.op === 'ilike') out = out.filter((r) => String(r[f.column] ?? '').toLowerCase().includes(String(f.value).replace(/[%*]/g, '').toLowerCase()))
      }
      return out.slice(0, q.limit ?? 50)
    },
  }
}

describe('the bits a thing wears (devMcpAmendments.ts over the tab\'s kernel)', () => {
  const index = amendmentIndex(LINKS)

  it('a corrected entry names what corrected it and the latest word along the chain; the correction names what it corrects', () => {
    expect(seatAmendmentBits(`hr_entry:${E1}`, index, dayOf)).toEqual({
      standing: 'corrected',
      amended_by: [{ link_id: 'l1', how: 'corrects', row: `person_file_entries:${E2}`, day: '2026-04-15', words: 'Corrected Apr 15, 2026' }],
      latest_word: `person_file_entries:${E3}`,
    })
    // e2 is itself corrected, and it corrects e1: both sides ride on the one line.
    expect(seatAmendmentBits(`hr_entry:${E2}`, index, dayOf)).toEqual({
      standing: 'corrected',
      amended_by: [{ link_id: 'l2', how: 'corrects', row: `person_file_entries:${E3}`, day: '2026-05-02', words: 'Corrected May 2, 2026' }],
      amends: [{ link_id: 'l1', how: 'corrects', row: `person_file_entries:${E1}`, day: '2026-03-30', words: 'Corrects the entry of Mar 30, 2026' }],
      latest_word: `person_file_entries:${E3}`,
    })
    // The newest correction stands: it has no standing and no latest word of its own.
    expect(seatAmendmentBits(`hr_entry:${E3}`, index, dayOf)).toEqual({ amends: [{ link_id: 'l2', how: 'corrects', row: `person_file_entries:${E2}`, day: '2026-04-15', words: 'Corrects the entry of Apr 15, 2026' }] })
  })

  it('a completed record still stands, a withdrawn link is not drawn, and a thing no link touches gains nothing', () => {
    expect(seatAmendmentBits(`hr_evidence:${R1}`, index, dayOf)).toEqual({ standing: 'completed', amended_by: [{ link_id: 'l3', how: 'completes', row: `person_file_entries:${E4}`, day: '2026-05-09', words: 'Completed May 9, 2026' }] })
    // l4 (e4 corrects e1) was withdrawn: e4 amends the record alone.
    expect(seatAmendmentBits(`hr_entry:${E4}`, index, dayOf).amends).toEqual([{ link_id: 'l3', how: 'completes', row: `person_file_evidence:${R1}`, day: '2026-04-01', words: 'Completes the evidence record of Apr 1, 2026' }])
    expect(seatAmendmentBits('hr_entry:nobody', index, dayOf)).toEqual({})
    expect(seatAmendmentBits(null, index, dayOf)).toEqual({})
  })

  it('an end this reader does not hold has no day, and its words say so', () => {
    const bits = seatAmendmentBits(`hr_entry:${E4}`, index, () => null)
    expect(bits.amends?.[0]).toMatchObject({ day: null, words: 'Completes an evidence record held from this view' })
    expect(seatAmendmentBits(`hr_entry:${E1}`, index, () => null).amended_by?.[0]).toMatchObject({ day: null, words: 'Corrected' })
  })

  it('names rows both ways, counts the links, and lists the newest first', async () => {
    expect(amendmentKeyOfRow('person_file_entries', E1)).toBe(`hr_entry:${E1}`)
    expect(amendmentKeyOfRow('person_file_evidence', R1)).toBe(`hr_evidence:${R1}`)
    expect(amendmentKeyOfRow('person_licenses', 'x')).toBeNull()
    expect(amendmentRowOfKey(`hr_evidence:${R1}`)).toBe(`person_file_evidence:${R1}`)
    const read = await readPersonAmendments(tableReader({ person_file_amendments: LINKS.map((l) => ({ ...l, person_id: PERSON })) }), PERSON)
    expect(read.heldWhy).toBeNull()
    expect(amendmentCounts(read)).toEqual({ live: 3, corrected: 2, completed: 1, withdrawn: 1 })
    expect(newestAmendments(read, dayOf, 2)).toEqual([
      { id: 'l3', how: 'completes', made_at: '2026-05-09T12:00:01Z', from: { row: `person_file_entries:${E4}`, day: '2026-05-09' }, to: { row: `person_file_evidence:${R1}`, day: '2026-04-01' } },
      { id: 'l2', how: 'corrects', made_at: '2026-05-02T12:00:01Z', from: { row: `person_file_entries:${E3}`, day: '2026-05-02' }, to: { row: `person_file_entries:${E2}`, day: '2026-04-15' } },
    ])
  })

  it('a refused read answers no links and its reason, and the days of ends not in hand are one read each', async () => {
    const refused = await readPersonAmendments(tableReader({}), PERSON)
    expect(refused).toMatchObject({ rows: [], heldWhy: 'relation "person_file_amendments" does not exist' })
    const reader = tableReader({ person_file_amendments: LINKS.map((l) => ({ ...l, person_id: PERSON })), person_file_entries: ENTRIES, person_file_evidence: EVIDENCE })
    const read = await readPersonAmendments(reader, PERSON)
    const days = await amendmentDays(reader, read, new Map([[`hr_entry:${E1}`, '2026-03-30']]))
    expect(Object.fromEntries(days)).toEqual(DAYS)
    // A reader that cannot read the records leaves that end without a day, and the entries' days still come.
    const partial = tableReader({ person_file_amendments: LINKS.map((l) => ({ ...l, person_id: PERSON })), person_file_entries: ENTRIES })
    const some = await amendmentDays(partial, await readPersonAmendments(partial, PERSON))
    expect(some.get(`hr_entry:${E2}`)).toBe('2026-04-15')
    expect(some.has(`hr_evidence:${R1}`)).toBe(false)
  })
})

describe('get_person_file carries the links (0.81.0)', () => {
  const data = () => ({ people: PEOPLE, person_file_entries: ENTRIES, person_file_evidence: EVIDENCE, person_file_amendments: LINKS.map((l) => ({ ...l, person_id: PERSON })) })
  const dev = { role: 'dev', todayYmd: '2026-11-12' }

  it('every read is one the door accepts; the corrected line, the correction and the record each say where they stand', async () => {
    const reader = catalogReader({ rows: data() })
    const out = (await getPersonFile(reader, { person: PERSON }, dev)) as PersonFileWholeReply
    expect('refused' in out).toBe(false)
    expect(reader.asked).toContain('rows:person_file_amendments')
    // This made-up person has no login, so the write-ups and attendance are held for that; nothing of the file's is.
    expect(out.held.filter((h) => h.source === 'file' || h.source === 'evidence')).toEqual([])
    const lines = out.months.flatMap((m) => m.lines)
    const byId = (id: string) => lines.find((l) => l.ref.id === id)!
    expect(byId(E1)).toMatchObject({ standing: 'corrected', latest_word: `person_file_entries:${E3}`, amended_by: [{ how: 'corrects', row: `person_file_entries:${E2}`, day: '2026-04-15', words: 'Corrected Apr 15, 2026' }] })
    expect(byId(E3)).toMatchObject({ amends: [{ how: 'corrects', row: `person_file_entries:${E2}` }] })
    expect(byId(E3)).not.toHaveProperty('standing')
    expect(byId(R1)).toMatchObject({ standing: 'completed', amended_by: [{ how: 'completes', row: `person_file_entries:${E4}` }] })
    // The evidence block's record says the same as its line.
    expect(out.evidence[0]).toMatchObject({ id: R1, standing: 'completed' })
    expect(out.amendments).toEqual({ live: 3, corrected: 2, completed: 1, withdrawn: 1, note: AMENDMENTS_NOTE })
    // A line no link touches is what the kernel wrote: the start line has no key of ours.
    const start = lines.find((l) => l.ref.table === 'people')
    if (start) for (const k of ['standing', 'amended_by', 'amends', 'latest_word']) expect(start).not.toHaveProperty(k)
  })

  it('brief keeps the links on a short line, and a file with no links gains only the counts', async () => {
    const out = await getPersonFile(catalogReader({ rows: data() }), { person: PERSON, brief: true }, dev)
    if ('refused' in out) throw new Error(out.refused)
    const short = out.months.flatMap((m) => m.lines).find((l) => 'row' in l && l.row === `person_file_entries:${E1}`)
    expect(short).toMatchObject({ row: `person_file_entries:${E1}`, standing: 'corrected', latest_word: `person_file_entries:${E3}` })
    const none = await getPersonFile(catalogReader({ rows: { ...data(), person_file_amendments: [] } }), { person: PERSON }, dev)
    if ('refused' in none) throw new Error(none.refused)
    expect(none.amendments).toMatchObject({ live: 0, corrected: 0, completed: 0, withdrawn: 0 })
    for (const l of none.months.flatMap((m) => m.lines)) expect(l).not.toHaveProperty('standing')
  })

  it('another role reads no links, and a links read that fails is named and takes only the links out', async () => {
    const office = catalogReader({ rows: data() })
    const asOffice = await getPersonFile(office, { person: PERSON }, { role: 'assistant', todayYmd: '2026-11-12' })
    if ('refused' in asOffice) throw new Error(asOffice.refused)
    expect(office.asked).not.toContain('rows:person_file_amendments')
    expect(asOffice.amendments).toBeNull()
    // The links' read is refused; the entries are whole and the hold says which part is missing.
    const base = catalogReader({ rows: data() })
    const failing: Reader = { rpc: base.rpc, rows: async (table, q) => { if (table === 'person_file_amendments') throw new Error('permission denied for table person_file_amendments'); return base.rows(table, q) } }
    const out = await getPersonFile(failing, { person: PERSON }, dev)
    if ('refused' in out) throw new Error(out.refused)
    expect(out.held.filter((h) => h.source === 'file')).toEqual([{ source: 'file', reason: 'the correction links could not be read (permission denied for table person_file_amendments); the entries and records are whole' }])
    expect(out.amendments).toBeNull()
    expect(out.months.flatMap((m) => m.lines).filter((l) => 'ref' in l && l.ref.table === 'person_file_entries')).toHaveLength(4)
  })
})

describe('get_case_brief and search_case carry the links (0.81.0)', () => {
  const tables = () => ({
    people: PEOPLE,
    person_file_entries: ENTRIES,
    person_file_evidence: EVIDENCE,
    person_file_amendments: LINKS.map((l) => ({ ...l, person_id: PERSON })),
    person_file_index: [],
    person_document_index: [],
    legal_matters: [],
    legal_theme_marks: [],
    legal_themes: [],
  })

  it('the brief counts the links, lists the newest with both ends, and marks the entries and records they touch', async () => {
    const out = await getCaseBrief(tableReader(tables()), { person: PERSON }, { role: 'dev', todayYmd: '2026-11-12' })
    if ('refused' in out) throw new Error(out.refused)
    expect(out.held).toEqual([])
    expect(out.amendments).toMatchObject({ live: 3, corrected: 2, completed: 1, withdrawn: 1, note: AMENDMENTS_NOTE })
    expect(out.amendments?.newest.map((l) => l.id)).toEqual(['l3', 'l2', 'l1'])
    expect(out.amendments?.newest[2]).toEqual({ id: 'l1', how: 'corrects', made_at: '2026-04-15T12:00:01Z', from: { row: `person_file_entries:${E2}`, day: '2026-04-15' }, to: { row: `person_file_entries:${E1}`, day: '2026-03-30' } })
    expect(out.entries.newest.find((e) => e.id === E1)).toMatchObject({ standing: 'corrected', latest_word: `person_file_entries:${E3}` })
    expect(out.entries.newest.find((e) => e.id === E3)).not.toHaveProperty('standing')
    expect(out.evidence[0]).toMatchObject({ id: R1, standing: 'completed' })
    // The office reads no links, as it reads no entries.
    const office = await getCaseBrief(tableReader(tables()), { person: PERSON }, { role: 'assistant', todayYmd: '2026-11-12' })
    if ('refused' in office) throw new Error(office.refused)
    expect(office.amendments).toBeNull()
  })

  it('a search hit on a corrected entry says so and names the correction; a hit no link touches is as the search answered', async () => {
    const rpcReply = {
      q: 'gate', query: "'gate'", in: null, person_id: PERSON, matter_id: null, count: 3, shown: 3,
      hits: [
        { source: 'entry', id: E1, title: null, section_n: null, section: null, day: '2026-03-30', counsel_only: false, rank: 0.3, snippet: 'came back at «4:10»' },
        { source: 'evidence', id: R1, title: 'Gate log, the week of March 30', section_n: null, section: null, day: '2026-04-01', counsel_only: false, rank: 0.2, snippet: 'the «gate» log' },
        { source: 'narrative', id: 'n1', title: null, section_n: 2, section: '2. The spring', day: null, counsel_only: false, rank: 0.1, snippet: 'the «gate»' },
      ],
    }
    const out = await searchCase(tableReader(tables(), { dev_case_search: rpcReply }), { person: PERSON, q: 'gate' }, { role: 'dev' })
    if ('refused' in out) throw new Error(out.refused)
    // The other end (e2) is not among the hits: its day is read by id.
    expect(out.hits[0]).toMatchObject({ id: E1, standing: 'corrected', amended_by: [{ how: 'corrects', row: `person_file_entries:${E2}`, day: '2026-04-15', words: 'Corrected Apr 15, 2026' }], latest_word: `person_file_entries:${E3}` })
    expect(out.hits[1]).toMatchObject({ id: R1, standing: 'completed' })
    expect(out.hits[2]).not.toHaveProperty('standing')
    expect(out.note).toContain('standing: corrected')
    // A reader that cannot read the links leaves the hits as the search answered them.
    const { person_file_amendments: _links, ...without } = tables()
    void _links
    const plain = await searchCase(tableReader(without, { dev_case_search: rpcReply }), { person: PERSON, q: 'gate' }, { role: 'dev' })
    if ('refused' in plain) throw new Error(plain.refused)
    expect(plain.hits[0]).not.toHaveProperty('standing')
  })
})

describe('the server and the docs say it', () => {
  it('0.81.0: the three reads and the write name the links, and no new verb was added', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.86.0'")
    for (const verb of ['get_person_file', 'get_case_brief', 'search_case']) {
      const at = SERVER.indexOf(`name: '${verb}',`)
      const description = SERVER.slice(at, SERVER.indexOf('inputSchema', at))
      expect(description, verb).toContain('Since 0.81.0 (punch list #315)')
      expect(description, verb).toContain('standing')
    }
    const plan = SERVER.slice(SERVER.indexOf("name: 'plan_hr_entry',"), SERVER.indexOf("name: 'apply_hr_entry',"))
    expect(plan).toContain('corrects or completes on the entry')
    expect(plan).toContain('withdraw_amendments?: [{ id, why }]')
    expect(README).toContain('0.81.0')
    expect(README).toContain('latest_word')
    expect(EDGE).toContain('Server 0.81.0')
  })
})
