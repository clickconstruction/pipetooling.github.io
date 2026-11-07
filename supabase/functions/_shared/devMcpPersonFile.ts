// dev-mcp's get_person_file (the People → Paperwork spike's MCP read, after v2.6392): a person's HR file whole, as the
// People → HR tab draws it — the Timeline's lines on the day each is ABOUT in lanes Said · Did · Paper · Missed · Ahead,
// by month with what lies ahead on top, the fact chips, the evidence records with their Drive state, and the summary and
// narrative. The same kernel (`personTimeline.ts`) over the same sources and keys as the tab's reads
// (`src/lib/people/personTimelineIo.ts`: people.id, the login's users.id, the person's name), each read through the
// injected `Reader` as the dev under RLS and fail-soft: a source that cannot be read is named in `held` and takes only
// itself out, as the panel names it under the strip. Nothing here reads the network. Tests:
// src/lib/devMcp/devMcpPersonFile.test.ts, whose fake reader enforces the generated catalog.

import type { Reader, Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import {
  PERSON_TIMELINE_LANES,
  PERSON_TIMELINE_SOURCES,
  buildPersonTimeline,
  countPersonTimeline,
  filterPersonTimeline,
  groupPersonTimelineByMonth,
  personFileFactChips,
  personFileFacts,
  splitPersonTimeline,
  type PersonTimelineContract,
  type PersonTimelineEntry,
  type PersonTimelineEvidence,
  type PersonTimelineExcuse,
  type PersonTimelineInput,
  type PersonTimelineLane,
  type PersonTimelineLicense,
  type PersonTimelineLine,
  type PersonTimelineNcns,
  type PersonTimelineReport,
  type PersonTimelineSource,
  type PersonTimelineWriteup,
} from './personTimeline.ts'
import { evidenceDriveWords, sortEvidenceNewestFirst, type PersonEvidenceFile } from './personEvidence.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
/** The door's own cap on one read; a source that answers exactly this many rows may hold more. */
export const PERSON_FILE_READ_CAP = 200
const FIND_LIMIT = 20

const LANES = new Set<string>(PERSON_TIMELINE_LANES.map((l) => l.lane))
const SOURCES = new Set<string>(PERSON_TIMELINE_SOURCES.map((s) => s.source))

export type PersonFileAsk = {
  /** A people.id, a users.id (find_person) or a name that matches exactly one person. */
  person: string
  lane?: unknown
  source?: unknown
  /** YYYY-MM-DD: only lines on or after this day. */
  since?: unknown
  /** false leaves the summary and narrative out (a long file). */
  docs?: unknown
}

export type PersonFileReader = { role: string; todayYmd: string }

export type PersonFileHeld = { source: PersonTimelineSource; reason: string }

type PeopleRow = { id: string; name: string; kind: string | null; start_date: string | null; end_date: string | null; archived_at: string | null; account_user_id: string | null }
type AttachmentRow = PersonEvidenceFile & { entry_id: string | null }
type DocRow = { kind: string; content: string; updated_at: string; covered_through: string | null; author_label: string | null }
/** One row of person_document_index (v2.6613): a named document without its text. */
type DocIndexRow = { id: string; title: string; counsel_only: boolean; author_label: string | null; created_at: string; updated_at: string; archived_at: string | null; chars: number; sections: number }
type EvidenceRow = { id: string; person_id: string; entry_id: string | null; dated_on: string; title: string; memo: string; created_by: string | null; author_label: string | null; created_at: string; drive_folder_id: string | null; drive_folder_url: string | null; filed_at: string | null; fail_why: string | null }
type WriteupRow = { id: string; template_id: string; status: string; disclosure: string | null; submitted_at: string | null; created_at: string; filled_by_user_id: string | null }
type ExcuseRow = { id: string; work_date: string; note: string; created_at: string; author: unknown }

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
/** PostgREST `ilike` wildcard is `*`; a literal `*`, `,` or a paren in the text would change the pattern. */
const likeTerm = (text: string): string => `*${text.trim().replace(/[*,()]/g, ' ').replace(/\s+/g, '*')}*`
const eq = (column: string, value: string): RowFilter[] => [{ column, op: 'eq', value }]

/** The ask's filters, checked against the kernel's own lists; a wrong one is refused in words. */
export function personFileFilter(ask: PersonFileAsk): { ok: true; lane: PersonTimelineLane | null; source: PersonTimelineSource | null; since: string | null; docs: boolean } | { ok: false; refused: string } {
  const lane = typeof ask.lane === 'string' && ask.lane.trim() ? ask.lane.trim().toLowerCase() : ''
  if (lane && !LANES.has(lane)) return { ok: false, refused: `lane must be one of ${[...LANES].join(', ')} (Ahead is planned).` }
  const source = typeof ask.source === 'string' && ask.source.trim() ? ask.source.trim().toLowerCase() : ''
  if (source && !SOURCES.has(source)) return { ok: false, refused: `source must be one of ${[...SOURCES].join(', ')}.` }
  const since = typeof ask.since === 'string' && ask.since.trim() ? ask.since.trim() : ''
  if (since && !YMD_RE.test(since)) return { ok: false, refused: 'since must be a day, YYYY-MM-DD.' }
  return { ok: true, lane: (lane || null) as PersonTimelineLane | null, source: (source || null) as PersonTimelineSource | null, since: since || null, docs: ask.docs !== false }
}

/** The person the ask names: a people.id, a login's users.id, or a name that matches exactly one. */
export async function resolvePerson(reader: Reader, ref: string): Promise<{ person: PeopleRow } | { refused: string }> {
  const select = 'id,name,kind,start_date,end_date,archived_at,account_user_id'
  const key = ref.trim()
  if (!key) return { refused: 'get_person_file needs person — a people.id, a users.id (find_person) or a name that matches exactly one person.' }
  if (UUID_RE.test(key)) {
    const byId = (await reader.rows('people', { select, filters: eq('id', key.toLowerCase()), limit: 1 })) as unknown as PeopleRow[]
    if (byId[0]) return { person: byId[0] }
    const byLogin = (await reader.rows('people', { select, filters: eq('account_user_id', key.toLowerCase()), limit: 2 })) as unknown as PeopleRow[]
    if (byLogin.length === 1) return { person: byLogin[0]! }
    if (byLogin.length > 1) return { refused: `That login has ${byLogin.length} roster rows — pass the people.id of one: ${byLogin.map((p) => `${p.name} (${p.id})`).join('; ')}` }
    return { refused: `No person ${key} — not a people.id, not a login's users.id, or RLS hides it from you.` }
  }
  const matches = (await reader.rows('people', { select, filters: [{ column: 'name', op: 'ilike', value: likeTerm(key) }], order: [{ column: 'name' }], limit: FIND_LIMIT })) as unknown as PeopleRow[]
  if (matches.length === 1) return { person: matches[0]! }
  const exact = matches.filter((m) => m.name.trim().toLowerCase() === key.toLowerCase())
  if (exact.length === 1) return { person: exact[0]! }
  if (matches.length === 0) return { refused: `No person matches "${key}" — find_person searches logins; a person with no login is on the roster by name.` }
  return { refused: `"${key}" matches ${matches.length} people — pass the id of one: ${matches.slice(0, 8).map((m) => `${m.name} (${m.id})`).join('; ')}` }
}

/**
 * The file, whole. Every source is read on its own: a failure is named in `held` with the source and the reason, and the
 * rest still draws. The HR sources (entries, evidence, field reports, the docs) are dev-only by RLS and are not read for
 * another role — `held` says *dev only*, as the panel does — so a view_as of the office sees the papers and nothing more.
 */
export async function getPersonFile(reader: Reader, ask: PersonFileAsk, who: PersonFileReader) {
  const filter = personFileFilter(ask)
  if (!filter.ok) return { refused: filter.refused }
  let resolved: Awaited<ReturnType<typeof resolvePerson>>
  try {
    resolved = await resolvePerson(reader, ask.person)
  } catch (e) {
    return { refused: `Could not read the roster: ${e instanceof Error ? e.message : String(e)}` }
  }
  if ('refused' in resolved) return resolved
  const person = resolved.person
  const personId = person.id
  const userId = person.account_user_id
  const name = person.name.trim()
  const isDev = who.role === 'dev'
  const held: PersonFileHeld[] = []
  const atCap: string[] = []

  async function read<T>(source: PersonTimelineSource, allowed: boolean, why: string, table: string, run: () => Promise<Row[]>): Promise<T[]> {
    if (!allowed) {
      held.push({ source, reason: why })
      return []
    }
    try {
      const rows = await run()
      if (rows.length >= PERSON_FILE_READ_CAP) atCap.push(table)
      return rows as unknown as T[]
    } catch (e) {
      held.push({ source, reason: e instanceof Error ? e.message : String(e) })
      return []
    }
  }

  const devOnly = 'dev only'
  const noLogin = 'needs a login'
  const CONTRACT_SELECT = 'id,document_name,status,created_at,sent_at,signed_at,office_completed_at,signer_printed_name,expires_at,doc_type'
  const [entries, attachments, docRows, evidenceRows, reports, contractsById, contractsByName, licenses, writeupRows, ncns, excuseRows] = await Promise.all([
    read<PersonTimelineEntry>('file', isDev, devOnly, 'person_file_entries', () => reader.rows('person_file_entries', { select: 'id,entry_date,content,source,created_by,created_at,author_label', filters: eq('person_id', personId), order: [{ column: 'entry_date', ascending: false }], limit: PERSON_FILE_READ_CAP })),
    read<AttachmentRow>('file', isDev, devOnly, 'person_file_attachments', () => reader.rows('person_file_attachments', { select: 'id,entry_id,evidence_id,filename,mime_type,size_bytes,storage_path,drive_file_id,drive_url,filed_at,fail_why,created_at,sha256', filters: eq('person_id', personId), order: [{ column: 'created_at', ascending: false }], limit: PERSON_FILE_READ_CAP })),
    read<DocRow>('file', isDev, devOnly, 'person_files', () => reader.rows('person_files', { select: 'kind,content,updated_at,covered_through,author_label', filters: eq('person_id', personId), limit: 10 })),
    read<EvidenceRow>('evidence', isDev, devOnly, 'person_file_evidence', () => reader.rows('person_file_evidence', { select: 'id,person_id,entry_id,dated_on,title,memo,created_by,author_label,created_at,drive_folder_id,drive_folder_url,filed_at,fail_why', filters: eq('person_id', personId), order: [{ column: 'dated_on', ascending: false }], limit: PERSON_FILE_READ_CAP })),
    read<PersonTimelineReport>('report', isDev, devOnly, 'person_reports', () => reader.rows('person_reports', { select: 'id,status,occurred_date,created_at,author_name,content,resolution_note,resolved_at,filed_entry_id', filters: eq('subject_person_id', personId), order: [{ column: 'occurred_date', ascending: false }], limit: PERSON_FILE_READ_CAP })),
    read<PersonTimelineContract>('contract', true, '', 'person_contract_documents', () => reader.rows('person_contract_documents', { select: CONTRACT_SELECT, filters: eq('person_id', personId), limit: PERSON_FILE_READ_CAP })),
    read<PersonTimelineContract>('contract', name !== '', 'needs a name on the roster', 'person_contract_documents', () => reader.rows('person_contract_documents', { select: CONTRACT_SELECT, filters: eq('person_name', name), limit: PERSON_FILE_READ_CAP })),
    read<PersonTimelineLicense>('license', name !== '', 'needs a name on the roster', 'person_licenses', () => reader.rows('person_licenses', { select: 'id,license_type,date_of_expiry,created_at,note', filters: eq('person_name', name), limit: PERSON_FILE_READ_CAP })),
    read<WriteupRow>('writeup', Boolean(userId), noLogin, 'writeups', () => reader.rows('writeups', { select: 'id,template_id,status,disclosure,submitted_at,created_at,filled_by_user_id', filters: eq('subject_user_id', userId as string), limit: PERSON_FILE_READ_CAP })),
    read<PersonTimelineNcns>('attendance', Boolean(userId), noLogin, 'attendance_incidents', () => reader.rows('attendance_incidents', { select: 'id,work_date,created_at,created_by_user_id,details', filters: [...eq('subject_user_id', userId as string), ...eq('incident_type', 'no_call_no_show')], limit: PERSON_FILE_READ_CAP })),
    read<ExcuseRow>('attendance', Boolean(userId), noLogin, 'attendance_annotations', () => reader.rows('attendance_annotations', { select: 'id,work_date,note,created_at,author:users!attendance_annotations_author_id_fkey(name)', filters: eq('subject_user_id', userId as string), limit: PERSON_FILE_READ_CAP })),
  ])

  // The same copy can answer both contract reads (person_id and person_name): keep one.
  const contracts = new Map<string, PersonTimelineContract>()
  for (const c of [...contractsById, ...contractsByName]) contracts.set(c.id, c)

  // Template names for the write-ups, and display names for every id a row names — both fail-soft: a name that cannot be
  // read leaves the line's byName empty, never the line out.
  const templateIds = [...new Set(writeupRows.map((w) => w.template_id))]
  const userIds = new Set<string>()
  for (const e of entries) if (e.created_by) userIds.add(e.created_by)
  for (const r of evidenceRows) if (r.created_by) userIds.add(r.created_by)
  for (const w of writeupRows) if (w.filled_by_user_id) userIds.add(w.filled_by_user_id)
  for (const n of ncns) if (n.created_by_user_id) userIds.add(n.created_by_user_id)
  const quiet = async (run: () => Promise<Row[]>): Promise<Row[]> => {
    try {
      return await run()
    } catch {
      return []
    }
  }
  const [templates, users] = await Promise.all([
    templateIds.length > 0 ? quiet(() => reader.rows('writeup_templates', { select: 'id,name', filters: [{ column: 'id', op: 'in', value: templateIds }], limit: PERSON_FILE_READ_CAP })) : Promise.resolve([] as Row[]),
    userIds.size > 0 ? quiet(() => reader.rows('users', { select: 'id,name', filters: [{ column: 'id', op: 'in', value: [...userIds] }], limit: PERSON_FILE_READ_CAP })) : Promise.resolve([] as Row[]),
  ])
  const templateName = new Map(templates.map((t) => [str(t.id), str(t.name)]))
  const namesById: Record<string, string> = {}
  for (const u of users) if (typeof u.name === 'string' && u.name) namesById[str(u.id)] = u.name

  const writeups: PersonTimelineWriteup[] = writeupRows.map((w) => ({
    id: w.id,
    template_name: templateName.get(w.template_id) ?? 'Write-up',
    status: w.status,
    disclosure: w.disclosure,
    submitted_at: w.submitted_at,
    created_at: w.created_at,
    filled_by_user_id: w.filled_by_user_id,
  }))
  // PostgREST types a to-one embed as an array; the row carries one author or none.
  const authorName = (a: unknown): string | null => {
    const one = Array.isArray(a) ? a[0] : a
    return one && typeof one === 'object' && typeof (one as { name?: unknown }).name === 'string' ? (one as { name: string }).name : null
  }
  const excuses: PersonTimelineExcuse[] = excuseRows.map((x) => ({ id: x.id, work_date: x.work_date, note: x.note, created_at: x.created_at, author_name: authorName(x.author) }))

  const filesByRecord = new Map<string, AttachmentRow[]>()
  for (const f of attachments) {
    if (!f.evidence_id) continue
    const list = filesByRecord.get(f.evidence_id) ?? []
    list.push(f)
    filesByRecord.set(f.evidence_id, list)
  }
  const evidence: PersonTimelineEvidence[] = evidenceRows.map((r) => ({
    id: r.id,
    entry_id: r.entry_id,
    dated_on: r.dated_on,
    title: r.title,
    memo: r.memo,
    created_at: r.created_at,
    created_by: r.created_by,
    author_label: r.author_label,
    drive_folder_url: r.drive_folder_url,
    fileIds: (filesByRecord.get(r.id) ?? []).map((f) => f.id),
  }))

  const input: PersonTimelineInput = {
    todayYmd: who.todayYmd,
    person: { id: person.id, name: person.name, start_date: person.start_date, end_date: person.end_date, archived_at: person.archived_at },
    entries,
    // Every file the line can show: the older bucket-only files on their entry, and each record's files on the entry it proves.
    attachments: [
      ...attachments.filter((a) => !a.evidence_id).map((a) => ({ id: a.id, entry_id: a.entry_id })),
      ...evidenceRows.flatMap((r) => (filesByRecord.get(r.id) ?? []).map((f) => ({ id: f.id, entry_id: r.entry_id }))),
    ],
    evidence,
    reports,
    contracts: [...contracts.values()],
    licenses,
    writeups,
    ncns,
    excuses,
    namesById,
  }

  const all = buildPersonTimeline(input)
  const facts = personFileFacts(input, all)
  let lines: PersonTimelineLine[] = filterPersonTimeline(all, { lane: filter.lane, source: filter.source })
  if (filter.since) lines = lines.filter((l) => l.ymd >= filter.since!)
  const { ahead, past } = splitPersonTimeline(lines, who.todayYmd)
  const months = groupPersonTimelineByMonth(past).map((m) => ({ month: m.monthKey, label: m.label, lines: m.lines }))

  // v2.6554: counsel-only records are refused to this seat by RLS (the X-Dev-Seat header); the count is a definer's answer, never a row.
  if (isDev) {
    try {
      const raw = await reader.rpc('person_counsel_only_count', { p_person_id: personId })
      const n = Number(Array.isArray(raw) ? raw[0] : raw)
      if (Number.isFinite(n) && n > 0) held.push({ source: 'evidence', reason: `${n} counsel-only record${n === 1 ? '' : 's'}, kept from the seat; a dev reads them on People → HR` })
    } catch {
      // Before the migration is pushed the function is not there: nothing to name.
    }
  }
  // A held source is named once, even when two reads share it.
  const seen = new Set<string>()
  const heldOnce = held.filter((h) => {
    const k = `${h.source}:${h.reason}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const docs: Record<string, DocRow> = {}
  for (const d of docRows) if (d.kind === 'summary' || d.kind === 'narrative') docs[d.kind] = d
  // v2.6613 (punch list #277): the named documents, from the index view — the list without the text; read one whole with
  // read_rows on person_documents by id. Quiet until the catalog knows the view (regenerated after the migration's push).
  const documentRows = isDev ? ((await quiet(() => reader.rows('person_document_index', { select: 'id,title,counsel_only,author_label,created_at,updated_at,archived_at,chars,sections', filters: eq('person_id', personId), limit: PERSON_FILE_READ_CAP }))) as unknown as DocIndexRow[]) : []
  const documents = documentRows
    .filter((d) => !d.archived_at)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
    .map((d) => ({ id: d.id, title: d.title, counsel_only: d.counsel_only, kept_by: d.author_label ?? '', updated_at: d.updated_at, chars: d.chars, sections: d.sections }))

  const filtered = Boolean(filter.lane || filter.source || filter.since)
  return {
    person: { id: person.id, name: person.name, kind: person.kind, start_date: person.start_date, end_date: person.end_date, archived_at: person.archived_at, user_id: userId, login: Boolean(userId) },
    read_as: { role: who.role, today: who.todayYmd },
    source: 'buildPersonTimeline + personFileFacts — the People → HR tab\'s own kernel (supabase/functions/_shared/personTimeline.ts) over the tab\'s sources and keys',
    facts,
    chips: personFileFactChips(facts),
    counts: { ...countPersonTimeline(all), shown: lines.length },
    lanes: PERSON_TIMELINE_LANES,
    sources: PERSON_TIMELINE_SOURCES,
    held: heldOnce,
    at_cap: atCap.length ? { tables: atCap, note: `A source answered ${PERSON_FILE_READ_CAP} rows, the door's cap on one read: it may hold more. Narrow with since, or read_rows the table with filters.` } : null,
    filter: filtered ? { lane: filter.lane, source: filter.source, since: filter.since } : null,
    ahead,
    months,
    evidence: sortEvidenceNewestFirst(evidenceRows).map((r) => {
      const files = (filesByRecord.get(r.id) ?? []).map((f) => ({ id: f.id, filename: f.filename, mime_type: f.mime_type, size_bytes: f.size_bytes, drive_url: f.drive_url, filed_at: f.filed_at, fail_why: f.fail_why, sha256: f.sha256 ?? null, linked: !f.storage_path && !!f.drive_url }))
      return { id: r.id, entry_id: r.entry_id, dated_on: r.dated_on, title: r.title, memo: r.memo, by: namesById[r.created_by ?? ''] ?? r.author_label ?? '', created_at: r.created_at, drive: evidenceDriveWords({ fail_why: r.fail_why, filed_at: r.filed_at, files: filesByRecord.get(r.id) ?? [] }), drive_folder_url: r.drive_folder_url, files }
    }),
    files_before_records: attachments.filter((a) => !a.evidence_id).map((f) => ({ id: f.id, entry_id: f.entry_id, filename: f.filename, mime_type: f.mime_type, size_bytes: f.size_bytes, created_at: f.created_at })),
    docs: filter.docs ? { summary: docs.summary ?? null, narrative: docs.narrative ?? null } : 'left out (docs: false)',
    documents,
    documents_note: isDev ? 'The named documents on the file (v2.6613), newest first, without their text: read one with read_rows on person_documents (select content) by id; change one with plan_person_doc { doc_id }; archived ones are left out.' : 'dev only',
  }
}
