import { headingsOf } from '../../../supabase/functions/_shared/devMcpCaseBrief'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import { clampLimit } from '../../../supabase/functions/_shared/devMcpDoor'
import { catalogReader } from './catalogReader'

/**
 * A large HR case, made up from a word list (v2.6935; `deepCase` since v2.6939): 250 entries over fourteen months, 60 named documents — one with
 * 400 headings — 80 evidence records with their files, a long narrative, a matter and two developments. Nothing here is
 * anyone's file: the person is Pat Doe, the words are plumbing nouns in a fixed order, the same on every run.
 */
export const BIG_PERSON = '11111111-2222-4333-8444-555555555555'
export const BIG_LOGIN = '22222222-2222-4333-8444-555555555555'
export const BIG_MATTER = '33333333-2222-4333-8444-555555555555'
export const BIG_TODAY = '2026-11-11'
export const BIG_ENTRIES = 250
export const BIG_DOCUMENTS = 60
export const BIG_EVIDENCE = 80
export const BIG_LONG_DOC_HEADINGS = 400

const WORDS = ['valve', 'riser', 'manifold', 'cleanout', 'trap', 'flange', 'coupling', 'sleeve', 'hanger', 'stack', 'vent', 'main', 'lateral', 'meter', 'fixture', 'rough', 'trim', 'slab', 'trench', 'bench', 'ladder', 'truck', 'yard', 'shop', 'crew', 'shift', 'ticket', 'route', 'tally', 'gauge']

/** `n` words from the list, starting at a place the seed picks: a sentence that says nothing. */
function words(seed: number, n: number): string {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(WORDS[(seed * 7 + i * 13 + ((i * seed) % 5)) % WORDS.length]!)
  return out.join(' ')
}
const pad = (n: number, width = 3) => String(n).padStart(width, '0')
function ymdPlus(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}
const heading = (level: number, text: string) => `${'#'.repeat(level)} ${text}`

/** A markdown text of `count` headings (one title, a second level every tenth, the rest third level) with a line under each. */
function markdown(seed: number, count: number, linesUnder = 1): string {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const level = i === 0 ? 1 : i % 10 === 1 ? 2 : 3
    out.push(heading(level, `${i === 0 ? 'Paper' : `${i}.`} ${words(seed + i, 3)}`), '')
    for (let l = 0; l < linesUnder; l++) out.push(words(seed + i + l, 24))
    out.push('')
  }
  return out.join('\n')
}

export function bigCase() {
  const entries = Array.from({ length: BIG_ENTRIES }, (_, i) => {
    const day = ymdPlus('2025-09-01', Math.floor(i * 1.7))
    return { id: `e-${pad(i)}`, person_id: BIG_PERSON, entry_date: day, content: `${words(i, 30 + (i % 7) * 25)}.`, source: ['conversation', 'incident', 'review', 'job_event'][i % 4]!, created_by: null, created_at: `${day}T15:${pad(i % 60, 2)}:00Z`, author_label: 'HR agent' }
  })
  const evidence = Array.from({ length: BIG_EVIDENCE }, (_, i) => {
    const day = ymdPlus('2025-10-01', i * 5)
    return { id: `r-${pad(i)}`, person_id: BIG_PERSON, entry_id: i % 3 === 0 ? `e-${pad(i * 2)}` : null, dated_on: day, title: `Record ${i}: ${words(i, 4)}`, memo: `${words(i + 3, 40 + (i % 5) * 30)}.`, counsel_only: false, created_by: null, author_label: 'Office', created_at: `${day}T18:00:00Z`, drive_folder_id: `fo-${i}`, drive_folder_url: `https://drive.example/folders/fo-${i}`, filed_at: `${day}T18:05:00Z`, fail_why: null }
  })
  const attachments = [
    ...Array.from({ length: 100 }, (_, i) => {
      const record = evidence[i % BIG_EVIDENCE]!
      return { id: `f-${pad(i)}`, person_id: BIG_PERSON, entry_id: null, evidence_id: record.id, filename: `${words(i, 2).replace(' ', '-')}.pdf`, mime_type: 'application/pdf', size_bytes: 1000 + i, storage_path: `p/evidence/${record.id}/f-${pad(i)}.pdf`, drive_file_id: `df-${i}`, drive_url: `https://drive.example/file/df-${i}`, filed_at: record.filed_at, fail_why: null, created_at: record.created_at, sha256: null }
    }),
    ...Array.from({ length: 30 }, (_, i) => ({ id: `f-old-${pad(i)}`, person_id: BIG_PERSON, entry_id: `e-${pad(i)}`, evidence_id: null, filename: `old-${i}.jpg`, mime_type: 'image/jpeg', size_bytes: 500 + i, storage_path: `p/old-${i}.jpg`, drive_file_id: null, drive_url: null, filed_at: null, fail_why: null, created_at: `2025-09-${pad(1 + (i % 28), 2)}T12:00:00Z`, sha256: null })),
  ]
  const summary = markdown(900, 6, 4)
  const narrative = markdown(1000, 45, 22)
  const fileDocs = [
    { id: 'pf-summary', person_id: BIG_PERSON, kind: 'summary', content: summary, updated_at: '2026-11-01T00:00:00Z', covered_through: '2026-11-01T00:00:00Z', author_label: 'HR agent' },
    { id: 'pf-narrative', person_id: BIG_PERSON, kind: 'narrative', content: narrative, updated_at: '2026-11-08T00:00:00Z', covered_through: null, author_label: 'HR agent' },
  ]
  const notes = `## Open\n\n${words(5, 300)}`
  const documentIndex = Array.from({ length: BIG_DOCUMENTS }, (_, i) => {
    const text = i === 0 ? notes : markdown(2000 + i * 50, i === 7 ? BIG_LONG_DOC_HEADINGS : 6 + (i % 25))
    const headings = headingsOf(text)
    return { id: `d-${pad(i, 2)}`, person_id: BIG_PERSON, title: i === 0 ? 'Agent notes' : `Paper ${i}: ${words(i + 11, 3)}`, counsel_only: i % 9 === 0 && i > 0, author_label: 'HR agent', created_at: '2026-06-01T00:00:00Z', updated_at: `${ymdPlus('2026-07-01', i * 2)}T00:00:00Z`, archived_at: null, chars: text.length, sections: headings.length, headings, evidence_id: i % 6 === 2 ? `r-${pad(i)}` : null }
  })
  const matterNarrative = markdown(3000, 12, 3)
  return {
    people: [{ id: BIG_PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2025-02-01', end_date: null, archived_at: null, account_user_id: BIG_LOGIN }],
    person_file_entries: entries,
    person_file_evidence: evidence,
    person_file_attachments: attachments,
    person_files: fileDocs,
    person_file_index: fileDocs.map((d) => ({ person_id: BIG_PERSON, kind: d.kind, chars: d.content.length, sections: headingsOf(d.content).length, headings: headingsOf(d.content), updated_at: d.updated_at, covered_through: d.covered_through, author_label: d.author_label })),
    person_document_index: documentIndex,
    documents: [{ id: 'd-00', content: notes }],
    person_reports: Array.from({ length: 3 }, (_, i) => ({ id: `rep-${i}`, subject_person_id: BIG_PERSON, status: 'pending', occurred_date: ymdPlus('2026-10-20', i), created_at: `${ymdPlus('2026-10-21', i)}T12:00:00Z`, author_name: 'Sam Boss', content: `${words(i + 40, 30)}.`, resolution_note: null, resolved_at: null, filed_entry_id: null })),
    person_contract_documents: [{ id: 'c1', person_id: BIG_PERSON, person_name: 'Pat Doe', document_name: 'Helper agreement', status: 'signed', created_at: '2025-02-01T10:00:00Z', sent_at: '2025-02-01T10:00:00Z', signed_at: '2025-02-02T10:00:00Z', office_completed_at: null, signer_printed_name: 'Pat Doe', expires_at: null, doc_type: 'agreement', signer_consented_at: '2025-02-02T10:00:00Z', signer_signature_storage_path: 'sig/c1.png', form_scan_storage_path: null, form_source: null }],
    hours_statements: [],
    person_licenses: [{ id: 'l1', person_name: 'Pat Doe', license_type: 'Journeyman', date_of_expiry: '2027-01-15', created_at: '2025-03-01T10:00:00Z', note: null }],
    writeups: [{ id: 'w1', subject_user_id: BIG_LOGIN, template_id: 't1', status: 'submitted', disclosure: 'discussed_with_subject', submitted_at: '2026-09-10T10:00:00Z', created_at: '2026-09-10T09:00:00Z', filled_by_user_id: null }],
    writeup_templates: [{ id: 't1', name: 'Safety' }],
    attendance_incidents: Array.from({ length: 4 }, (_, i) => ({ id: `n-${i}`, subject_user_id: BIG_LOGIN, incident_type: 'no_call_no_show', work_date: ymdPlus('2026-08-03', i * 20), created_at: `${ymdPlus('2026-08-03', i * 20)}T20:00:00Z`, created_by_user_id: null, details: null })),
    attendance_annotations: [{ id: 'x1', subject_user_id: BIG_LOGIN, work_date: '2026-10-03', note: 'Flat tire, called ahead.', created_at: '2026-10-03T13:00:00Z', author: [{ name: 'Sam Boss' }] }],
    users: [],
    legal_matters: [{ id: BIG_MATTER, person_id: BIG_PERSON, stage: 'review', narrative_md: matterNarrative, narrative_updated_at: '2026-11-05T00:00:00Z', closed_at: null }],
    legal_matter_entries: Array.from({ length: 17 }, (_, i) => ({ id: `m-${pad(i, 2)}`, matter_id: BIG_MATTER, kind: i < 12 ? 'plan' : 'note', occurred_on: ymdPlus('2026-10-01', i * 3), body: `${words(i + 60, 12)}.`, meta: { done_at: i < 5 ? '2026-10-20' : null }, voided_at: null })),
    legal_matter_documents: Array.from({ length: 8 }, (_, i) => ({ id: `md-${i}`, matter_id: BIG_MATTER, title: `Exhibit ${i}: ${words(i + 70, 3)}`, state: 'final', dated_on: ymdPlus('2026-09-01', i * 4), voided_at: null, mime: i % 2 ? 'application/pdf' : 'text/markdown' })),
    legal_theme_marks: Array.from({ length: 30 }, (_, i) => ({ id: `mk-${i}`, person_id: BIG_PERSON, theme_id: `t-${i % 5}`, proposed: i % 3 === 0, removed_at: null })),
    legal_themes: Array.from({ length: 5 }, (_, i) => ({ id: `t-${i}`, name: `Theme ${i}: ${words(i + 80, 2)}`, retired_at: null })),
    jobs_ledger_team_members: [{ id: 'tm1', job_id: 'j1', user_id: BIG_LOGIN }, { id: 'tm2', job_id: 'j2', user_id: BIG_LOGIN }],
    job_schedule_blocks: [{ id: 'sb1', job_id: 'j3', assignee_user_id: BIG_LOGIN }],
    jobs_ledger: [{ id: 'j1', job_name: 'Lodge rough-in', development_id: 'dv1', click_number: '101' }, { id: 'j2', job_name: 'Clubhouse', development_id: 'dv1', click_number: '102' }, { id: 'j3', job_name: 'Pump house', development_id: 'dv2', click_number: '103' }],
    developments: [{ id: 'dv1', name: 'Quail Ridge' }, { id: 'dv2', name: 'Mill Creek' }],
  }
}

/** How many rows each list of the deep case holds: every one past the door's 200 rows a read. */
export const DEEP = { evidence: 230, attachments: 460, documents: 215, marks: 430, steps: 260, matterDocuments: 205, licenses: 210, reports: 204, jobs: 240 } as const

/**
 * The same made-up case with every list past 200 rows (v2.6939): what one read of a source would have cut. Two files on
 * every evidence record, a theme marked 86 times, a plan of 260 steps, schedule blocks on 240 jobs in one development.
 */
export function deepCase() {
  const base = bigCase()
  const evidence = Array.from({ length: DEEP.evidence }, (_, i) => ({ ...base.person_file_evidence[i % BIG_EVIDENCE]!, id: `r-${pad(i)}`, entry_id: null, dated_on: ymdPlus('2025-10-01', i), title: `Record ${i}` }))
  const attachments = Array.from({ length: DEEP.attachments }, (_, i) => ({ ...base.person_file_attachments[0]!, id: `f-${pad(i)}`, evidence_id: `r-${pad(i % DEEP.evidence)}`, filename: `file-${i}.pdf`, created_at: `${ymdPlus('2025-10-01', i % DEEP.evidence)}T18:00:00Z` }))
  const documents = Array.from({ length: DEEP.documents }, (_, i) => ({ ...base.person_document_index[1 + (i % 5)]!, id: `d-${pad(i)}`, title: i === 0 ? 'Agent notes' : `Paper ${i}`, counsel_only: false, evidence_id: null, updated_at: `${ymdPlus('2026-01-01', i)}T00:00:00Z` }))
  return {
    ...base,
    person_file_evidence: evidence,
    person_file_attachments: attachments,
    person_document_index: documents,
    person_reports: Array.from({ length: DEEP.reports }, (_, i) => ({ ...base.person_reports[0]!, id: `rep-${pad(i)}`, occurred_date: ymdPlus('2026-01-01', i), created_at: `${ymdPlus('2026-01-02', i)}T12:00:00Z` })),
    person_licenses: Array.from({ length: DEEP.licenses }, (_, i) => ({ ...base.person_licenses[0]!, id: `l-${pad(i)}`, created_at: `${ymdPlus('2025-03-01', i)}T10:00:00Z` })),
    legal_theme_marks: Array.from({ length: DEEP.marks }, (_, i) => ({ id: `mk-${pad(i)}`, person_id: BIG_PERSON, theme_id: `t-${i % 5}`, proposed: false, removed_at: null })),
    legal_matter_entries: Array.from({ length: DEEP.steps }, (_, i) => ({ id: `m-${pad(i)}`, matter_id: BIG_MATTER, kind: 'plan', occurred_on: ymdPlus('2026-01-01', i), body: `Step ${i}.`, meta: { done_at: null }, voided_at: null })),
    legal_matter_documents: Array.from({ length: DEEP.matterDocuments }, (_, i) => ({ id: `md-${pad(i)}`, matter_id: BIG_MATTER, title: `Exhibit ${i}`, state: 'final', dated_on: ymdPlus('2026-01-01', i), voided_at: null, mime: 'application/pdf' })),
    jobs_ledger_team_members: [],
    job_schedule_blocks: Array.from({ length: DEEP.jobs }, (_, i) => ({ id: `sb-${pad(i)}`, job_id: `j-${pad(i)}`, assignee_user_id: BIG_LOGIN })),
    jobs_ledger: Array.from({ length: DEEP.jobs }, (_, i) => ({ id: `j-${pad(i)}`, job_name: `Lot ${i}`, development_id: 'dv1', click_number: String(1000 + i) })),
  }
}

export const BIG_RPC = {
  dev_history_read: { count: 5, lines: Array.from({ length: 5 }, (_, i) => ({ at: `2026-10-${pad(20 - i, 2)}T10:00:00Z`, body: `${words(i + 90, 10)}.\nMore.`, kind: 'note' })) },
  person_counsel_only_count: 2,
  matter_counsel_only_count: 1,
}

/**
 * A reader that pages as the door does: the catalog's checks (catalogReader refuses a column the table lacks), then
 * the filters, the order and the limit applied to the fixture's rows — at most 200 a read, so a composite that needs
 * the 201st row has to ask for it.
 */
export function pagingReader(data: { rows: Record<string, Row[]>; rpc?: Record<string, unknown> }): Reader & { asked: string[] } {
  const check = catalogReader({ rows: data.rows, rpc: data.rpc })
  const cmp = (a: unknown, b: unknown): number => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : a < b ? -1 : a > b ? 1 : 0)
  return {
    asked: check.asked,
    rpc: (name, args, limit, filters) => check.rpc(name, args, limit, filters),
    rows: async (table: string, query: RowsQuery) => {
      await check.rows(table, query)
      let out = [...(data.rows[table] ?? [])]
      for (const f of query.filters ?? []) {
        const v = f.value as never
        if (f.op === 'eq') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'in') out = out.filter((r) => (f.value as unknown[]).includes(r[f.column]))
        else if (f.op === 'is') out = out.filter((r) => (f.value === null ? r[f.column] == null : r[f.column] === f.value))
        else if (f.op === 'gt') out = out.filter((r) => (r[f.column] as never) > v)
        else if (f.op === 'gte') out = out.filter((r) => (r[f.column] as never) >= v)
        else if (f.op === 'lt') out = out.filter((r) => (r[f.column] as never) < v)
        else if (f.op === 'lte') out = out.filter((r) => (r[f.column] as never) <= v)
        else if (f.op === 'ilike') out = out.filter((r) => String(r[f.column] ?? '').toLowerCase().includes(String(f.value).replace(/[%*]/g, ' ').trim().toLowerCase()))
        else throw new Error(`pagingReader: no "${f.op}" filter`)
      }
      for (const o of [...(query.order ?? [])].reverse()) out.sort((a, b) => cmp(a[o.column], b[o.column]) * (o.ascending === false ? -1 : 1))
      return out.slice(0, clampLimit(query.limit))
    },
  }
}
