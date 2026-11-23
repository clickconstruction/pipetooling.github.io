import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getCaseBrief } from '../../../supabase/functions/_shared/devMcpCaseBrief'
import { findPerson } from '../../../supabase/functions/_shared/devMcpComposites'
import { getPersonFile } from '../../../supabase/functions/_shared/devMcpPersonFile'
import { HR_READING_RECEIPT, HR_READING_RULES, MANIFEST_PART_OF_SOURCE, buildPersonManifest, type PersonManifestInput } from '../../../supabase/functions/_shared/devMcpPersonManifest'
import { REPLY_FIT_CHARS, replyChars } from '../../../supabase/functions/_shared/devMcpReplyFit'
import { PERSON_TIMELINE_SOURCES } from '../people/personTimeline'
import { BIG_LOGIN, BIG_PERSON, BIG_RPC, BIG_TODAY, DEEP, deepCase, pagingReader } from './bigCaseFixture'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const HR_FILES = readFileSync('docs/HR_FILES.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const DEV = { role: 'dev', todayYmd: BIG_TODAY }

/** A small file with every part read: the numbers a manifest is built from. */
function input(over: Partial<PersonManifestInput> = {}): PersonManifestInput {
  return {
    personId: BIG_PERSON,
    agentNotes: { doc_id: 'd-notes', chars: 900, updated_at: '2026-11-01T00:00:00Z', entries_since: 3 },
    summary: { chars: 400, sections: 2, covered_through: '2026-10-01T00:00:00Z' },
    narrative: { chars: 9000, sections: 12 },
    documents: { count: 5, chars: 60000, counsel_only: 2, counsel_only_chars: 45000 },
    entries: { count: 40, first: '2025-02-01', last: '2026-11-10', from_mail: 4 },
    evidence: { count: 9, counsel_only: 1, in_drive_folders: 6, a_record_folder: 'folder-1' },
    files: { count: 20, staged: 12, linked: 8, before_records: 3, bytes: 123456 },
    fileWords: { indexed: 18, with_words: 11, without_words: { scan: 4, kind: 3 } },
    timelineLines: { file: 40, evidence: 6, report: 1, contract: 3, statement: 1, license: 4, writeup: 2, attendance: 5, employment: 1 },
    heldSources: {},
    rows: { papers: 3, papers_signed: 1, hours_statements: 1, licenses: 2, write_ups: 2, attendance: 5, field_reports: 1, field_reports_waiting: 1 },
    correctionLinks: 2,
    caseItems: { count: 7, open: 4 },
    caseLog: 15,
    standing: 1,
    keptPlans: { count: 2, waiting: 1 },
    mailConversations: 1,
    themes: { themes: 3, kept: 10, proposed: 2 },
    matter: { id: 'm1', stage: 'review', narrative_chars: 2000, narrative_sections: 4, steps: 5, steps_done: 1, events: 2, documents: 6, documents_text: 4, documents_counsel_only: 1 },
    developments: { count: 1, jobs: 3, other_jobs: 2 },
    login: true,
    ...over,
  }
}

describe('the HR file\'s manifest (v2.7651): every part with its whole count and the call that opens it', () => {
  it('names a part for every source the Timeline draws, so a source added to the kernel cannot be left out', () => {
    const parts = buildPersonManifest(input()).parts
    const names = parts.map((p) => p.part)
    for (const { source } of PERSON_TIMELINE_SOURCES) {
      const part = MANIFEST_PART_OF_SOURCE[source]
      expect(part, `the Timeline source "${source}" has no manifest part`).toBeTruthy()
      expect(names, `the manifest has no "${part}" part for the Timeline source "${source}"`).toContain(part)
    }
    expect(Object.keys(MANIFEST_PART_OF_SOURCE).sort()).toEqual(PERSON_TIMELINE_SOURCES.map((s) => s.source).sort())
    // No part twice, and every part says how to open it.
    expect(new Set(names).size).toBe(names.length)
    for (const p of parts) expect(p.open.length, p.part).toBeGreaterThan(10)
  })

  it('carries the whole counts, the counsel-only counts, the notes\' age and the text\'s size', () => {
    const m = buildPersonManifest(input())
    const part = (name: string) => m.parts.find((p) => p.part === name)!
    expect(part('agent_notes')).toMatchObject({ count: 1, doc_id: 'd-notes', entries_since: 3 })
    expect(part('documents')).toMatchObject({ count: 5, counsel_only: 2, counsel_only_chars: 45000 })
    expect(part('entries')).toMatchObject({ count: 40, from_mail: 4, timeline_lines: 40 })
    // A record tied to an entry draws on the entry's line: nine records, six lines.
    expect(part('evidence')).toMatchObject({ count: 9, counsel_only: 1, timeline_lines: 6 })
    expect(part('files')).toMatchObject({ count: 20, staged: 12, linked_in_drive: 8, before_records: 3, indexed: 18, with_words: 11, without_words: { scan: 4, kind: 3 } })
    expect(part('drive_folder')).toMatchObject({ count: 6, a_record_folder: 'folder-1' })
    expect(part('papers')).toMatchObject({ count: 3, signed: 1, timeline_lines: 3 })
    expect(part('licenses')).toMatchObject({ count: 2, timeline_lines: 4 })
    expect(part('field_reports')).toMatchObject({ count: 1, waiting: 1 })
    expect(part('employment')).toMatchObject({ count: 1 })
    expect(part('case_items')).toMatchObject({ count: 7, open_items: 4, log_lines: 15 })
    expect(part('kept_plans')).toMatchObject({ count: 2, waiting: 1 })
    expect(part('themes')).toMatchObject({ count: 3, marks_kept: 10, marks_proposed: 2 })
    expect(part('matter')).toMatchObject({ count: 1, steps: 5, steps_done: 1, documents: 6, documents_counsel_only: 1 })
    expect(part('login')).toMatchObject({ count: 1 })
    expect(m.text_chars).toEqual({ all: 900 + 400 + 9000 + 60000 + 2000, counsel_only: 45000 })
    // The open lines carry the person, so the call can be made as written.
    expect(part('papers').open).toContain(`get_person_file { person: "${BIG_PERSON}", source: "contract" }`)
  })

  it('a part that could not be read answers count null and held, never zero; a file with no notes or matter says so', () => {
    const m = buildPersonManifest(
      input({
        agentNotes: null,
        matter: null,
        documents: { held: 'relation "person_document_index" does not exist' },
        fileWords: { held: 'no file index' },
        heldSources: { license: 'needs a name on the roster' },
        caseItems: { held: 'dev only' },
        rows: { held: 'the file could not be read' },
        timelineLines: { held: 'the file could not be read' },
      }),
    )
    const part = (name: string) => m.parts.find((p) => p.part === name)!
    expect(part('agent_notes').count).toBe(0)
    expect(part('matter')).toMatchObject({ count: 0, open: 'none stands on this person' })
    expect(part('documents')).toMatchObject({ count: null, held: 'relation "person_document_index" does not exist' })
    expect(part('licenses')).toMatchObject({ count: null, held: 'needs a name on the roster' })
    expect(part('papers')).toMatchObject({ count: null, held: 'the file could not be read' })
    expect(part('employment')).toMatchObject({ count: null, held: 'the file could not be read' })
    expect(part('case_items')).toMatchObject({ count: null, held: 'dev only' })
    // The files are counted; only their words are not known.
    expect(part('files')).toMatchObject({ count: 20, words_held: 'no file index' })
    expect(m.text_chars).toEqual({ all: null, counsel_only: null })
  })

  it('the rules are general and short, and the receipt is asked for', () => {
    expect(HR_READING_RULES.length).toBeLessThanOrEqual(8)
    const all = [...HR_READING_RULES, HR_READING_RECEIPT].join(' ')
    expect(all.length).toBeLessThan(2400)
    for (const word of ['manifest', 'agent_notes', 'shortened', 'search_case', 'Counsel-only', 'latest_word', 'plan_', 'private', 'receipt']) expect(all).toContain(word)
    // Nothing of a person: no year, no dollar figure, no uuid.
    expect(all).not.toMatch(/\b20\d\d\b|\$\d|[0-9a-f]{8}-[0-9a-f]{4}/)
  })
})

describe('get_case_brief opens with the manifest and the rules, whole on a file that is shortened (v2.7651)', () => {
  const rows = () => ({
    ...deepCase(),
    file_index: Array.from({ length: 230 }, (_, i) => ({ drive_file_id: `f-${String(i).padStart(4, '0')}`, person_id: BIG_PERSON, text_source: i % 2 === 0 ? 'plain' : null, text_why: i % 2 === 0 ? null : i % 4 === 1 ? 'scan' : 'kind' })),
    person_case_items: [
      { id: 'ci-1', person_id: BIG_PERSON, state: 'open', closed_at: null },
      { id: 'ci-2', person_id: BIG_PERSON, state: 'done', closed_at: '2026-11-01T00:00:00Z' },
    ],
    person_case_log: Array.from({ length: 3 }, (_, i) => ({ id: `cl-${i}`, person_id: BIG_PERSON })),
    person_engagements: [{ id: 'en-1', person_id: BIG_PERSON, withdrawn_at: null }, { id: 'en-2', person_id: BIG_PERSON, withdrawn_at: '2026-11-02T00:00:00Z' }],
    dev_seat_kept_plans: [{ id: 'kp-1', person_id: BIG_PERSON, state: 'waiting' }, { id: 'kp-2', person_id: BIG_PERSON, state: 'applied' }],
    email_tag_threads: [{ id: 'tt-1', person_id: BIG_PERSON, untagging_at: null }],
  })

  // Every counsel-only record handed back, so no source of the file read is held.
  const RPC = { ...BIG_RPC, person_counsel_only_count: 0 }

  it('counts every part past 200 rows, agrees with get_person_file, and no shortening touches it', async () => {
    const out = await getCaseBrief(pagingReader({ rows: rows(), rpc: RPC }), { person: BIG_PERSON }, DEV)
    if ('refused' in out) throw new Error(out.refused)
    // The brief was shortened, the manifest was not: it is the same object the kernel built.
    expect(out.shortened).not.toBeNull()
    expect(replyChars(out)).toBeLessThanOrEqual(REPLY_FIT_CHARS)
    expect(Object.keys(out).slice(0, 4)).toEqual(['person', 'read_as', 'reading', 'manifest'])
    expect(out.reading).toEqual({ rules: HR_READING_RULES, receipt: HR_READING_RECEIPT })
    expect(replyChars(out.manifest)).toBeLessThan(12_000)
    const part = (name: string) => out.manifest.parts.find((p) => p.part === name)!
    expect(part('evidence').count).toBe(DEEP.evidence)
    expect(part('documents').count).toBe(DEEP.documents - 1)
    expect(part('files')).toMatchObject({ count: DEEP.attachments, indexed: 230, with_words: 115, without_words: { scan: 58, kind: 57 } })
    expect(part('licenses').count).toBe(DEEP.licenses)
    expect(part('field_reports').count).toBe(DEEP.reports)
    expect(part('case_items')).toMatchObject({ count: 2, open_items: 1, log_lines: 3 })
    expect(part('standing').count).toBe(1)
    expect(part('kept_plans')).toMatchObject({ count: 2, waiting: 1 })
    expect(part('mail').count).toBe(1)
    expect(part('matter')).toMatchObject({ count: 1, steps: DEEP.steps, documents: DEEP.matterDocuments })
    expect(part('agent_notes').count).toBe(1)
    // The Timeline's numbers are get_person_file's own: its tally and its line counts.
    const file = await getPersonFile(pagingReader({ rows: rows(), rpc: RPC }), { person: BIG_PERSON, brief: true }, DEV)
    if ('refused' in file) throw new Error(String(file.refused))
    expect(file.read_first).toContain('get_case_brief')
    expect(part('files').count).toBe(file.tally.files.count)
    expect(part('papers').count).toBe(file.tally.rows.papers)
    expect(part('entries').timeline_lines).toBe(file.counts.bySource.file)
    expect(part('evidence').timeline_lines).toBe(file.counts.bySource.evidence)
    expect(part('employment').count).toBe(file.counts.bySource.employment)
  })

  it('a count the manifest alone reads is held on its own part, and the brief\'s held names only what the brief itself draws', async () => {
    // The manifest's own tables refuse the read: each of those parts is null with its reason, nothing is guessed.
    const base = pagingReader({ rows: rows(), rpc: RPC })
    const refusing = ['file_index', 'person_case_items', 'person_case_log', 'person_engagements', 'dev_seat_kept_plans', 'email_tag_threads']
    const r = { ...base, rows: async (table: string, q: Parameters<typeof base.rows>[1]) => (refusing.includes(table) ? Promise.reject(new Error(`permission denied for table ${table}`)) : base.rows(table, q)) }
    const out = await getCaseBrief(r, { person: BIG_PERSON }, DEV)
    if ('refused' in out) throw new Error(out.refused)
    // Since 0.118.0 the brief draws the case's items and log (open_items, log), so those two are named in its held;
    // since 0.120.0 it draws the standing too (engagements); the three the manifest alone reads are held on their own parts.
    expect(out.held).toHaveLength(3)
    expect(out.held).toEqual(expect.arrayContaining([{ source: 'case items', reason: 'permission denied for table person_case_items' }, { source: 'case log', reason: 'permission denied for table person_case_log' }, { source: 'standing', reason: 'permission denied for table person_engagements' }]))
    expect(out.engagements).toBeNull()
    expect(out.open_items).toBeNull()
    expect(out.log).toBeNull()
    const part = (name: string) => out.manifest.parts.find((p) => p.part === name)!
    expect(part('case_items')).toMatchObject({ count: null, held: 'permission denied for table person_case_items' })
    for (const name of ['standing', 'kept_plans', 'mail']) expect(part(name), name).toMatchObject({ count: null })
    expect(part('files')).toMatchObject({ count: DEEP.attachments, words_held: 'permission denied for table file_index' })
    // Another role reads no HR source: every HR part is held as dev only.
    const office = await getCaseBrief(pagingReader({ rows: rows(), rpc: RPC }), { person: BIG_PERSON }, { role: 'assistant', todayYmd: BIG_TODAY })
    if ('refused' in office) throw new Error(office.refused)
    const officePart = (name: string) => office.manifest.parts.find((p) => p.part === name)!
    for (const name of ['entries', 'evidence', 'documents', 'files', 'papers', 'case_items', 'kept_plans']) expect(officePart(name), name).toMatchObject({ count: null, held: 'dev only' })
  })
})

describe('find_person tries each word when the whole name matches no one (v2.7651)', () => {
  const users = [
    { id: BIG_LOGIN, name: 'Pat', email: 'pat@example.com', role: 'primary', archived_at: null, is_digital_twin: false, is_sample: false },
    { id: '44444444-2222-4333-8444-555555555555', name: 'Lee Doe', email: null, role: 'helpers', archived_at: null, is_digital_twin: false, is_sample: false },
  ]
  it('a full name against a first-name roster row finds the row and says how', async () => {
    const r = pagingReader({ rows: { users } })
    const whole = await findPerson(r, 'Lee Doe')
    expect(whole).toEqual({ matches: [expect.objectContaining({ name: 'Lee Doe' })] })
    const byWord = await findPerson(r, 'Pat Doe')
    expect(byWord.matches.map((m) => m.name).sort()).toEqual(['Lee Doe', 'Pat'])
    expect('note' in byWord && byWord.note).toContain('No one matches "Pat Doe" whole')
    // One word that matches no one stays an empty answer with no note.
    expect(await findPerson(r, 'Quinn')).toEqual({ matches: [] })
    expect(await findPerson(r, 'Quinn Zed')).toEqual({ matches: [] })
  })
})

describe('the server and the docs carry the manifest (v2.7651 / 0.97.0)', () => {
  it('the instructions send an HR read to get_case_brief before their first three hundred words end, and no longer say whole', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.131.0'")
    const at = SERVER.indexOf('const INSTRUCTIONS =')
    const opening = SERVER.slice(at, at + 700)
    expect(opening).toContain("For a person's HR file call get_case_brief first")
    expect(opening).toContain('manifest')
    expect(SERVER).not.toContain("reads a person's HR file whole")
    const brief = SERVER.slice(SERVER.indexOf("name: 'get_case_brief'"), SERVER.indexOf("name: 'get_document_history'"))
    for (const word of ['manifest', 'reading', 'count null and held']) expect(brief).toContain(word)
    const file = SERVER.slice(SERVER.indexOf("name: 'get_person_file'"), SERVER.indexOf("name: 'get_hours_statement'"))
    for (const word of ['get_case_brief first', 'read_first', 'tally']) expect(file).toContain(word)
    expect(SERVER.slice(SERVER.indexOf("name: 'find_person'"), SERVER.indexOf("name: 'find_person'") + 500)).toContain('tries each word')
  })

  it('the README rows, the function reference and the HR doc say where the rules live', () => {
    const row = (verb: string) => README.split('\n').find((l) => l.startsWith(`| \`${verb}(`)) ?? ''
    expect(row('get_case_brief')).toContain('`manifest`')
    expect(row('get_case_brief')).toContain('`reading`')
    expect(row('get_person_file')).toContain('`tally`')
    expect(README).toContain('devMcpPersonManifest.ts')
    expect(EDGE).toContain('v2.7651 (server 0.97.0)')
    expect(HR_FILES).toContain('## Reading a file')
    expect(HR_FILES).toContain('devMcpPersonManifest.ts')
  })
})
