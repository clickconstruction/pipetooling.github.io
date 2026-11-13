import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AGENT_NOTES_TITLE, getCaseBrief, headingsOf } from '../../../supabase/functions/_shared/devMcpCaseBrief'
import type { Reader, Row } from '../../../supabase/functions/_shared/devMcpComposites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261107060000_case_brief_indexes.sql', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const LOGIN = '22222222-2222-4333-8444-555555555555'
const MATTER = '33333333-2222-4333-8444-555555555555'
const DEV = { role: 'dev', todayYmd: '2026-11-07' }

/** A reader over fixture rows, filtered by eq / in / is like the door filters, with one RPC: the development's History. */
function reader(rows: Record<string, Row[]>, rpc: Record<string, unknown> = {}): Reader & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    rpc: async (name, args) => {
      asked.push(`rpc:${name}`)
      if (!(name in rpc)) throw new Error(`rpc ${name} is not in the fixture`)
      const v = rpc[name]
      return typeof v === 'function' ? (v as (a: unknown) => unknown)(args) : v
    },
    rows: async (table, q) => {
      asked.push(`rows:${table}`)
      if (!(table in rows)) throw new Error(`relation "${table}" does not exist`)
      let out = rows[table]!
      for (const f of q.filters ?? []) {
        if (f.op === 'eq') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'in') out = out.filter((r) => (f.value as unknown[]).includes(r[f.column]))
        else if (f.op === 'is') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'ilike') out = out.filter((r) => String(r[f.column] ?? '').toLowerCase().includes(String(f.value).replace(/[%*]/g, '').toLowerCase()))
      }
      return out.slice(0, q.limit ?? 50)
    },
  }
}

function fixture() {
  return {
    people: [{ id: PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2025-02-01', end_date: null, archived_at: null, account_user_id: LOGIN }],
    person_file_entries: [
      { id: 'e1', person_id: PERSON, entry_date: '2026-10-20', content: 'Called in sick.\nSecond line.', source: 'conversation' },
      { id: 'e2', person_id: PERSON, entry_date: '2026-09-02', content: 'Late twice, see N§2.', source: 'incident' },
    ],
    person_file_evidence: [{ id: 'r1', person_id: PERSON, dated_on: '2026-10-28', title: 'Recording of the call', counsel_only: true }],
    person_file_index: [
      { person_id: PERSON, kind: 'summary', chars: 300, sections: 2, headings: [{ n: null, level: 2, heading: 'Trajectory', line: 1 }, { n: null, level: 2, heading: 'Pay', line: 5 }], updated_at: '2026-10-30T00:00:00Z', covered_through: '2026-10-30T00:00:00Z', author_label: 'HR agent' },
      { person_id: PERSON, kind: 'narrative', chars: 9000, sections: 2, headings: [{ n: 1, level: 2, heading: '1. Background', line: 1 }, { n: 2, level: 2, heading: '2. The spring', line: 40 }], updated_at: '2026-11-06T22:00:00Z', covered_through: null, author_label: 'Robert' },
    ],
    person_files: [{ person_id: PERSON, kind: 'summary', content: '## Trajectory\nSteady.\n\n## Pay\nWeekly.' }, { person_id: PERSON, kind: 'narrative', content: '## 1. Background\n…' }],
    person_document_index: [
      { id: 'd-notes', person_id: PERSON, title: AGENT_NOTES_TITLE, counsel_only: false, author_label: 'Robert', updated_at: '2026-11-07T06:00:00Z', archived_at: null, chars: 80, sections: 1, headings: [{ n: null, level: 2, heading: 'Open', line: 1 }] },
      { id: 'd-guide', person_id: PERSON, title: 'Interview guide', counsel_only: false, author_label: 'Robert', updated_at: '2026-11-01T00:00:00Z', archived_at: null, evidence_id: 'r1', chars: 4000, sections: 2, headings: [{ n: null, level: 2, heading: 'Before the call', line: 1 }, { n: null, level: 2, heading: 'After the call', line: 20 }] },
      { id: 'd-old', person_id: PERSON, title: 'Old notes', counsel_only: false, author_label: 'HR agent', updated_at: '2026-09-01T00:00:00Z', archived_at: '2026-10-01T00:00:00Z', chars: 10, sections: 0, headings: [] },
    ],
    documents: [{ id: 'd-notes', content: '## Open\n\nAsk about the second week. ' + 'x'.repeat(2000) }],
    legal_matters: [{ id: MATTER, person_id: PERSON, stage: 'review', narrative_md: '## The parties\n\nWho.\n\n## The claim\n\nWhat.', narrative_updated_at: '2026-11-05T00:00:00Z', closed_at: null }],
    legal_matter_entries: [
      { id: 'm1', matter_id: MATTER, kind: 'plan', occurred_on: '2026-11-10', body: 'Pull the subcontract.', meta: { done_at: null }, voided_at: null },
      { id: 'm2', matter_id: MATTER, kind: 'plan', occurred_on: '2026-11-03', body: 'Send the notice.', meta: { done_at: '2026-11-04' }, voided_at: null },
      { id: 'm3', matter_id: MATTER, kind: 'note', occurred_on: '2026-11-02', body: 'A note.', meta: null, voided_at: null },
    ],
    legal_matter_documents: [{ id: 'md1', matter_id: MATTER, title: 'Scenario map', state: 'final', dated_on: '2026-10-14', voided_at: null, mime: 'text/plain' }],
    legal_theme_marks: [
      { person_id: PERSON, theme_id: 't1', proposed: false, removed_at: null },
      { person_id: PERSON, theme_id: 't1', proposed: true, removed_at: null },
      { person_id: PERSON, theme_id: 't2', proposed: true, removed_at: '2026-11-01T00:00:00Z' },
    ],
    legal_themes: [{ id: 't1', name: 'Dishonesty', retired_at: null }, { id: 't2', name: 'Interference', retired_at: null }],
    jobs_ledger_team_members: [{ job_id: 'j1', user_id: LOGIN }],
    job_schedule_blocks: [{ job_id: 'j2', assignee_user_id: LOGIN }],
    jobs_ledger: [{ id: 'j1', job_name: 'Lodge rough-in', development_id: 'dv1' }, { id: 'j2', job_name: 'Clubhouse', development_id: 'dv1' }],
    developments: [{ id: 'dv1', name: 'Quail Ridge' }],
    // Punch list #315: the correction links, a source of their own; this person has none (devMcpAmendments.test.ts has the linked file).
    person_file_amendments: [] as Record<string, unknown>[],
  }
}
const history = { dev_history_read: { count: 2, lines: [{ at: '2026-10-07T10:00:00Z', body: 'Lift stations in.\nMore.', kind: 'note' }, { at: '2026-09-20T10:00:00Z', body: 'The funeral weekend.', kind: 'note' }] } }

describe('get_case_brief (the seat reads a case the way an agent reads a folder, v2.6619)', () => {
  it('one page: the notes first, the summary whole, the section indexes without the text, the matter, the themes and the developments, every item with its id', async () => {
    const r = reader(fixture(), history)
    const out = await getCaseBrief(r, { person: PERSON }, DEV)
    if ('refused' in out) throw new Error(out.refused)
    expect(out.held).toEqual([])
    // v2.6935: a brief that fits the door is whole — nothing shortened, every section index complete.
    expect(out.shortened).toBeNull()
    expect(out.counts).toEqual({ entries: 2, evidence: 1, documents: 1 })
    expect(out.documents[0]).toMatchObject({ section_count: 2, sections: [{ heading: 'Before the call' }, { heading: 'After the call' }] })
    expect(out.agent_notes).toMatchObject({ doc_id: 'd-notes', chars: 80, more: true })
    expect(out.agent_notes?.first_lines.startsWith('## Open')).toBe(true)
    expect(out.summary).toMatchObject({ chars: 300, kept_by: 'HR agent', text: '## Trajectory\nSteady.\n\n## Pay\nWeekly.', sections: [{ n: null, heading: 'Trajectory', line: 1 }, { n: null, heading: 'Pay', line: 5 }] })
    expect(out.narrative).toMatchObject({ chars: 9000, kept_by: 'Robert', sections: [{ n: 1, heading: '1. Background', line: 1 }, { n: 2, heading: '2. The spring', line: 40 }] })
    // The notes are not listed twice; the archived document is out.
    expect(out.documents.map((d) => d.id)).toEqual(['d-guide'])
    // v2.6713: the pair from either side — the document names the record it transcribes, the record names its document.
    expect(out.documents[0]).toMatchObject({ evidence_id: 'r1' })
    expect(out.entries).toMatchObject({ count: 2, first: '2026-09-02', last: '2026-10-20', by_source: { conversation: 1, incident: 1 } })
    expect(out.entries.newest[0]).toEqual({ id: 'e1', ymd: '2026-10-20', source: 'conversation', first_line: 'Called in sick.' })
    expect(out.evidence).toEqual([{ id: 'r1', dated_on: '2026-10-28', title: 'Recording of the call', counsel_only: true, document_id: 'd-guide' }])
    expect(out.matter).toMatchObject({ id: MATTER, stage: 'review', events: 1, narrative: { sections: [{ heading: 'The parties', line: 1 }, { heading: 'The claim', line: 5 }] } })
    expect(out.matter?.steps).toEqual([{ id: 'm2', on: '2026-11-03', body: 'Send the notice.', done: true }, { id: 'm1', on: '2026-11-10', body: 'Pull the subcontract.', done: false }])
    expect(out.matter?.documents).toEqual([{ id: 'md1', title: 'Scenario map', state: 'final', dated_on: '2026-10-14', text: true }])
    expect(out.themes).toEqual([{ id: 't1', name: 'Dishonesty', marked: 1, proposed: 1 }])
    expect(out.developments).toEqual([{ id: 'dv1', name: 'Quail Ridge', jobs: [{ id: 'j1', name: 'Lodge rough-in' }, { id: 'j2', name: 'Clubhouse' }], headlines: [{ at: '2026-10-07T10:00:00Z', first_line: 'Lift stations in.' }, { at: '2026-09-20T10:00:00Z', first_line: 'The funeral weekend.' }] }])
    expect(r.asked).toContain('rpc:dev_history_read')
    expect(out.read_next).toContain('plan_person_doc')
  })

  it('a source that cannot be read is held by name and the rest still draws; the office gets the person and dev only', async () => {
    const data = fixture()
    delete (data as Record<string, unknown>).person_document_index
    const out = await getCaseBrief(reader(data, history), { person: PERSON }, DEV)
    if ('refused' in out) throw new Error(out.refused)
    expect(out.held).toEqual([{ source: 'documents', reason: 'relation "person_document_index" does not exist' }])
    expect(out.documents).toEqual([])
    expect(out.agent_notes).toBeNull()
    expect(out.summary?.text).toContain('Trajectory')
    const office = await getCaseBrief(reader(fixture(), history), { person: PERSON }, { role: 'assistant', todayYmd: '2026-11-07' })
    if ('refused' in office) throw new Error(office.refused)
    expect(office.person.name).toBe('Pat Doe')
    expect(office.held.every((h) => h.reason === 'dev only')).toBe(true)
    expect(office.summary).toBeNull()
    expect(office.developments).toEqual([])
  })

  it('refuses an unknown person, reads headings as hr_doc_headings does, and the server, docs and migration carry the verb', async () => {
    const out = await getCaseBrief(reader(fixture(), history), { person: 'nobody' }, DEV)
    expect('refused' in out).toBe(true)
    expect(headingsOf('# Title\n\n## 16. Bidding conduct\n\n```\n## not a heading\n```\n\n### §3 The shop\n\n## Appendix A')).toEqual([
      { n: null, level: 1, heading: 'Title', line: 1 }, { n: 16, level: 2, heading: '16. Bidding conduct', line: 3 }, { n: 3, level: 3, heading: '§3 The shop', line: 9 }, { n: null, level: 2, heading: 'Appendix A', line: 11 },
    ])
    expect(SERVER).toContain("name: 'get_case_brief'")
    expect(SERVER).toContain("case 'get_case_brief': {")
    expect(SERVER).toContain("const SERVER_VERSION = '0.81.0'")
    expect(README).toContain('`get_case_brief(person)`')
    expect(MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.hr_doc_heading_index(md text)')
    expect(MIGRATION).toContain('CREATE OR REPLACE VIEW public.person_file_index')
    expect(MIGRATION).toContain('public.hr_doc_heading_index(d.content) AS headings')
    expect(MIGRATION).not.toContain('CREATE TABLE')
  })
})
