import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PERSON_FILE_READ_CAP, getPersonFile, personFileFilter, type PersonFileWholeReply } from '../../../supabase/functions/_shared/devMcpPersonFile'
import { buildPersonTimeline, personFileFactChips, personFileFacts, signedPapers, statementRows, type PersonTimelineInput } from '../people/personTimeline'
import { catalogReader } from './catalogReader'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')

const TODAY = '2026-11-02'
const PERSON = '11111111-2222-4333-8444-555555555555'
const LOGIN = '22222222-2222-4333-8444-555555555555'
const DEV = '33333333-2222-4333-8444-555555555555'
const ENTRY = '44444444-2222-4333-8444-555555555555'
const RECORD = '55555555-2222-4333-8444-555555555555'

/** The rows the tab's reads would return for one made-up person: every source with one line. */
function rows() {
  return {
    people: [{ id: PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2026-02-01', end_date: null, archived_at: null, account_user_id: LOGIN }],
    person_file_entries: [{ id: ENTRY, entry_date: '2026-10-20', content: 'Called in sick.', source: 'conversation', created_by: DEV, created_at: '2026-10-20T15:00:00Z', author_label: null }],
    person_file_attachments: [
      { id: 'f-old', entry_id: ENTRY, evidence_id: null, filename: 'old.pdf', mime_type: 'application/pdf', size_bytes: 10, storage_path: 'p/old.pdf', drive_file_id: null, drive_url: null, filed_at: null, fail_why: null, created_at: '2026-10-20T15:01:00Z' },
      { id: 'f-1', entry_id: null, evidence_id: RECORD, filename: 'site.jpg', mime_type: 'image/jpeg', size_bytes: 20, storage_path: 'p/evidence/r/f-1-site.jpg', drive_file_id: 'd1', drive_url: 'https://drive.google.com/file/d/d1/view', filed_at: '2026-10-29T10:00:00Z', fail_why: null, created_at: '2026-10-29T09:00:00Z' },
    ],
    person_files: [
      { kind: 'summary', content: '## Trajectory\nSteady.', updated_at: '2026-10-30T00:00:00Z', covered_through: '2026-10-30T00:00:00Z', author_label: 'HR agent' },
      { kind: 'narrative', content: '## 2026\nStarted in February.', updated_at: '2026-10-30T00:00:00Z', covered_through: null, author_label: 'HR agent' },
    ],
    person_file_evidence: [{ id: RECORD, person_id: PERSON, entry_id: null, dated_on: '2026-10-28', title: 'Left a mess at the site', memo: 'Two photos from the super.', created_by: DEV, author_label: null, created_at: '2026-10-29T09:00:00Z', drive_folder_id: 'fo', drive_folder_url: 'https://drive.google.com/drive/folders/fo', filed_at: '2026-10-29T10:00:00Z', fail_why: null }],
    person_reports: [{ id: 'r1', status: 'pending', occurred_date: '2026-10-25', created_at: '2026-10-26T12:00:00Z', author_name: 'Sam Boss', content: 'Late twice this week.', resolution_note: null, resolved_at: null, filed_entry_id: null }],
    person_contract_documents: [{ id: 'c1', document_name: 'Helper agreement', status: 'signed', created_at: '2026-02-01T10:00:00Z', sent_at: '2026-02-01T10:00:00Z', signed_at: '2026-02-02T10:00:00Z', office_completed_at: null, signer_printed_name: 'Pat Doe', expires_at: null, doc_type: 'agreement' }],
    hours_statements: [{ id: 'hs1', record_id: 'HS-629-0001', job_ledger_id: 'j629', state: 'printed', basis: 'paid', period_start: '2026-03-31', period_end: '2026-06-30', prepared_at: '2026-10-15T04:21:00Z', updated_at: '2026-10-15T04:21:00Z', contract_document_id: null, drive_file_id: null, matter_document_id: null, person_id: PERSON }],
    jobs_ledger: [{ id: 'j629', click_number: '629', job_name: 'Rough-in' }],
    person_licenses: [{ id: 'l1', license_type: 'Journeyman', date_of_expiry: '2027-01-15', created_at: '2026-03-01T10:00:00Z', note: null }],
    writeups: [{ id: 'w1', template_id: 't1', status: 'submitted', disclosure: 'discussed_with_subject', submitted_at: '2026-09-10T10:00:00Z', created_at: '2026-09-10T09:00:00Z', filled_by_user_id: DEV }],
    writeup_templates: [{ id: 't1', name: 'Safety' }],
    attendance_incidents: [{ id: 'n1', work_date: '2026-10-01', created_at: '2026-10-01T20:00:00Z', created_by_user_id: DEV, details: null }],
    attendance_annotations: [{ id: 'x1', work_date: '2026-10-03', note: 'Flat tire, called ahead.', created_at: '2026-10-03T13:00:00Z', author: [{ name: 'Sam Boss' }] }],
    users: [{ id: DEV, name: 'Robert' }],
  }
}

const dev = { role: 'dev', todayYmd: TODAY }
// These files are small, so nothing is shortened and every line and record is whole (v2.6935; the long file is devMcpBigCase.test.ts).
type Reply = PersonFileWholeReply

describe('get_person_file (the person file from the dev seat)', () => {
  it('every read is one the door accepts, and the lines are the tab\'s own kernel over the same rows', async () => {
    const data = rows()
    const reader = catalogReader({ rows: data })
    const out = (await getPersonFile(reader, { person: PERSON }, dev)) as Reply
    expect('refused' in out).toBe(false)
    expect(reader.asked).toEqual(expect.arrayContaining(['rows:people', 'rows:person_file_entries', 'rows:person_file_attachments', 'rows:person_files', 'rows:person_file_evidence', 'rows:person_reports', 'rows:person_contract_documents', 'rows:hours_statements', 'rows:jobs_ledger', 'rows:person_licenses', 'rows:writeups', 'rows:attendance_incidents', 'rows:attendance_annotations', 'rows:writeup_templates', 'rows:users']))
    expect(out.held).toEqual([])
    // What the tab would build from the same sources (personTimelineIo's shape), line for line.
    const input: PersonTimelineInput = {
      todayYmd: TODAY,
      person: { id: PERSON, name: 'Pat Doe', start_date: '2026-02-01', end_date: null, archived_at: null },
      entries: data.person_file_entries,
      attachments: [{ id: 'f-old', entry_id: ENTRY }, { id: 'f-1', entry_id: null }],
      evidence: [{ ...data.person_file_evidence[0]!, fileIds: ['f-1'] }],
      reports: data.person_reports,
      contracts: data.person_contract_documents,
      statements: [{ id: 'hs1', record_id: 'HS-629-0001', job_ledger_id: 'j629', job_label: 'Job 629 · Rough-in', state: 'printed', basis: 'paid', period_start: '2026-03-31', period_end: '2026-06-30', prepared_at: '2026-10-15T04:21:00Z', updated_at: '2026-10-15T04:21:00Z', contract_document_id: null, drive_file_id: null, matter_document_id: null }],
      licenses: data.person_licenses,
      writeups: [{ id: 'w1', template_name: 'Safety', status: 'submitted', disclosure: 'discussed_with_subject', submitted_at: '2026-09-10T10:00:00Z', created_at: '2026-09-10T09:00:00Z', filled_by_user_id: DEV }],
      ncns: data.attendance_incidents,
      excuses: [{ id: 'x1', work_date: '2026-10-03', note: 'Flat tire, called ahead.', created_at: '2026-10-03T13:00:00Z', author_name: 'Sam Boss' }],
      namesById: { [DEV]: 'Robert' },
    }
    const expected = buildPersonTimeline(input)
    const shown = [...[...out.ahead].reverse(), ...out.months.flatMap((m) => m.lines)]
    expect(shown).toEqual(expected)
    expect(out.ahead.map((l) => l.kindWords)).toEqual(['license expires'])
    expect(out.months.map((m) => m.label)).toEqual(['October 2026', 'September 2026', 'March 2026', 'February 2026'])
    // The strip and its chips are the kernel's too.
    const facts = personFileFacts(input, expected)
    expect(out.facts).toEqual(facts)
    expect(out.chips).toEqual(personFileFactChips(facts))
    expect(out.chips.map((c) => c.key)).toEqual(['reports', 'statements', 'ncns', 'signed', 'licenses', 'writeups', 'entries', 'evidence'])
    // v2.6820: the statements with their standing and door.
    expect(out.hours_statements).toEqual(statementRows(input))
    expect(out.hours_statements.map((s) => [s.record_id, s.standing, s.job, s.door.to])).toEqual([['HS-629-0001', 'printed', 'Job 629 · Rough-in', '/jobs?tab=stages&edit=j629']])
    // v2.6820: what they signed, as a list, with the door the signed line carries.
    expect(out.signed_papers).toEqual(signedPapers(input))
    expect(out.signed_papers.map((p) => [p.paper, p.signed_on, p.how, p.door.to])).toEqual([['Helper agreement', '2026-02-02', 'electronically', '/people?tab=contracts&doc=c1']])
    expect(expected.find((l) => l.key === 'contract:c1:signed')!.door).toEqual({ label: 'Open the signed record', to: '/people?tab=contracts&doc=c1' })
    expect(out.counts.total).toBe(expected.length)
    expect(out.counts.shown).toBe(expected.length)
    // The evidence records with their files and Drive state, the older file apart, the docs whole.
    expect(out.evidence).toHaveLength(1)
    expect(out.evidence[0]!.drive).toBe('In Drive')
    expect(out.evidence[0]!.files.map((f) => f.filename)).toEqual(['site.jpg'])
    expect(out.evidence[0]!.by).toBe('Robert')
    expect(out.files_before_records.map((f) => f.id)).toEqual(['f-old'])
    expect(out.docs).toEqual({ summary: data.person_files[0], narrative: data.person_files[1] })
    // v2.6613: the named documents come from the index view, quiet until the catalog knows it.
    expect(out.documents).toEqual([])
    expect(out.person).toEqual({ id: PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2026-02-01', end_date: null, archived_at: null, user_id: LOGIN, login: true })
    expect(out.at_cap).toBeNull()
    expect(out.filter).toBeNull()
    // v2.6935: a file that fits the door is whole — nothing shortened, nothing left to read on.
    expect(out.shortened).toBeNull()
    expect(out.next_until).toBeNull()
  })

  it('finds the person by a login\'s users.id (find_person\'s key) and by a name matching exactly one', async () => {
    const data = rows()
    const byLogin = catalogReader({ rows: { ...data, people: [] } })
    const base = byLogin.rows
    byLogin.rows = async (table, q) => {
      if (table === 'people') return q.filters?.[0]?.column === 'account_user_id' ? data.people : []
      return base(table, q)
    }
    const out = (await getPersonFile(byLogin, { person: LOGIN }, dev)) as Reply
    expect(out.person.id).toBe(PERSON)
    const byName = catalogReader({ rows: data })
    expect(((await getPersonFile(byName, { person: 'pat' }, dev)) as Reply).person.id).toBe(PERSON)
    expect(byName.asked.filter((a) => a === 'rows:people')).toHaveLength(1)
  })

  it('refuses in words a name that matches two people, a name that matches none and an id nobody wears', async () => {
    const two = catalogReader({ rows: { people: [{ ...rows().people[0]!, name: 'Pat Doe' }, { ...rows().people[0]!, id: LOGIN, name: 'Pat Dolan' }] } })
    const out = (await getPersonFile(two, { person: 'pat do' }, dev)) as { refused: string }
    expect(out.refused).toContain('matches 2 people')
    expect(out.refused).toContain(PERSON)
    expect(((await getPersonFile(catalogReader({}), { person: 'nobody' }, dev)) as { refused: string }).refused).toContain('No person matches')
    expect(((await getPersonFile(catalogReader({}), { person: PERSON }, dev)) as { refused: string }).refused).toContain('No person')
    expect(((await getPersonFile(catalogReader({}), { person: '' }, dev)) as { refused: string }).refused).toContain('needs person')
  })

  it('a source that fails is held in place with its reason and takes only itself out; a source read at the cap is named', async () => {
    const data = rows()
    const reader = catalogReader({ rows: { ...data, person_licenses: Array.from({ length: PERSON_FILE_READ_CAP }, (_, i) => ({ ...data.person_licenses[0]!, id: `l${i}` })) } })
    const base = reader.rows
    reader.rows = async (table, q) => {
      if (table === 'person_contract_documents') throw new Error('timeout')
      return base(table, q)
    }
    const out = (await getPersonFile(reader, { person: PERSON }, dev)) as Reply
    expect(out.held).toEqual([{ source: 'contract', reason: 'timeout' }])
    expect(out.counts.bySource.contract).toBe(0)
    expect(out.counts.bySource.file).toBe(1)
    expect(out.at_cap?.tables).toEqual(['person_licenses'])
    expect(out.facts.licensesLive).toBe(PERSON_FILE_READ_CAP)
  })

  it('a person with no login has the write-ups and attendance held as needing a login, never read', async () => {
    const data = rows()
    const reader = catalogReader({ rows: { ...data, people: [{ ...data.people[0]!, account_user_id: null }] } })
    const out = (await getPersonFile(reader, { person: PERSON }, dev)) as Reply
    expect(out.person.login).toBe(false)
    expect(out.held).toEqual([{ source: 'writeup', reason: 'needs a login' }, { source: 'attendance', reason: 'needs a login' }])
    expect(reader.asked).not.toContain('rows:writeups')
    expect(reader.asked).not.toContain('rows:attendance_incidents')
  })

  it('read as the office (view_as), the HR sources are not read and are named dev only; the papers still draw', async () => {
    const reader = catalogReader({ rows: rows() })
    const out = (await getPersonFile(reader, { person: PERSON }, { role: 'assistant', todayYmd: TODAY })) as Reply
    expect(out.held.map((h) => `${h.source}:${h.reason}`)).toEqual(['file:dev only', 'evidence:dev only', 'report:dev only', 'statement:dev or controller'])
    for (const t of ['person_file_entries', 'person_file_attachments', 'person_files', 'person_file_evidence', 'person_reports', 'hours_statements']) expect(reader.asked).not.toContain(`rows:${t}`)
    expect(out.counts.bySource.contract).toBe(1)
    expect(out.counts.bySource.file).toBe(0)
    expect(out.docs).toEqual({ summary: null, narrative: null })
    expect(out.read_as.role).toBe('assistant')
  })

  it('narrows by lane, source and since, and leaves the docs out on docs: false; a wrong filter is refused in words', async () => {
    const paper = (await getPersonFile(catalogReader({ rows: rows() }), { person: PERSON, lane: 'paper', docs: false }, dev)) as Reply
    expect(paper.filter).toEqual({ lane: 'paper', source: null, since: null, until: null })
    expect(new Set([...paper.ahead, ...paper.months.flatMap((m) => m.lines)].map((l) => l.lane))).toEqual(new Set(['paper']))
    expect(paper.counts.shown).toBeLessThan(paper.counts.total)
    expect(paper.docs).toBe('left out (docs: false)')
    const since = (await getPersonFile(catalogReader({ rows: rows() }), { person: PERSON, since: '2026-10-01' }, dev)) as Reply
    expect(since.months.map((m) => m.label)).toEqual(['October 2026'])
    expect(since.ahead).toHaveLength(1)
    const source = (await getPersonFile(catalogReader({ rows: rows() }), { person: PERSON, source: 'report' }, dev)) as Reply
    expect(source.months.flatMap((m) => m.lines).map((l) => l.kindWords)).toEqual(['field report · waiting to be filed'])
    expect(personFileFilter({ person: PERSON, lane: 'ahead' })).toEqual({ ok: false, refused: expect.stringContaining('Ahead is planned') })
    expect(personFileFilter({ person: PERSON, source: 'papers' })).toEqual({ ok: false, refused: expect.stringContaining('source must be') })
    expect(personFileFilter({ person: PERSON, since: 'yesterday' })).toEqual({ ok: false, refused: expect.stringContaining('YYYY-MM-DD') })
  })

  it('the server declares the verb, handles it as a read beside get_history, and the README has its row', () => {
    expect(SERVER).toContain("name: 'get_person_file'")
    expect(SERVER).toContain("case 'get_person_file':")
    expect(SERVER.indexOf("case 'get_person_file':")).toBeGreaterThan(SERVER.indexOf("case 'get_history':"))
    expect(SERVER).toContain("getPersonFile(readerAs(await jwt())")
    expect(SERVER).toMatch(/const SERVER_VERSION = '0\.67\.0'/)
    expect(README).toContain('`get_person_file(person')
  })
})

describe('get_person_file lists the named documents (v2.6613, punch list #277)', () => {
  it('reads person_document_index for a dev, newest first, archived ones left out, and says how to read one whole', async () => {
    const data = rows()
    const base = catalogReader({ rows: data })
    const index = [
      { id: 'doc-a', title: 'Interview guide', counsel_only: false, author_label: 'Robert', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', archived_at: null, chars: 4000, sections: 2 },
      { id: 'doc-b', title: 'Counsel memo', counsel_only: true, author_label: 'Robert', created_at: '2026-11-06T00:00:00Z', updated_at: '2026-11-07T00:00:00Z', archived_at: null, chars: 18000, sections: 6 },
      { id: 'doc-c', title: 'Old notes', counsel_only: false, author_label: 'HR agent', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', archived_at: '2026-10-01T00:00:00Z', chars: 10, sections: 0 },
    ]
    const reader = { ...base, rows: async (table: string, q: Parameters<typeof base.rows>[1]) => (table === 'person_document_index' ? index : base.rows(table, q)) }
    const out = (await getPersonFile(reader, { person: PERSON }, dev)) as Reply
    expect(out.documents).toEqual([
      { id: 'doc-b', title: 'Counsel memo', counsel_only: true, kept_by: 'Robert', updated_at: '2026-11-07T00:00:00Z', chars: 18000, sections: 6 },
      { id: 'doc-a', title: 'Interview guide', counsel_only: false, kept_by: 'Robert', updated_at: '2026-11-01T00:00:00Z', chars: 4000, sections: 2 },
    ])
    expect(String(out.documents_note)).toContain('plan_person_doc { doc_id }')
    const office = (await getPersonFile(reader, { person: PERSON }, { role: 'assistant', todayYmd: TODAY })) as Reply
    expect(office.documents).toEqual([])
  })
})
