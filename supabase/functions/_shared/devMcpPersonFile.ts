// dev-mcp's get_person_file (the People → Paperwork spike's MCP read, after v2.6392): a person's HR file whole, as the
// People → HR tab draws it — the Timeline's lines on the day each is ABOUT in lanes Said · Did · Paper · Missed · Ahead,
// by month with what lies ahead on top, the fact chips, the evidence records with their Drive state, and the summary and
// narrative. The same kernel (`personTimeline.ts`) over the same sources and keys as the tab's reads
// (`src/lib/people/personTimelineIo.ts`: people.id, the login's users.id, the person's name), each read through the
// injected `Reader` as the dev under RLS and fail-soft: a source that cannot be read is named in `held` and takes only
// itself out, as the panel names it under the strip. Nothing here reads the network. Tests:
// src/lib/devMcp/devMcpPersonFile.test.ts, whose fake reader enforces the generated catalog.
//
// v2.6935: the file fits the door. Three things on a large file: the HR entries are read a page at a time (one read of
// 200 rows left the 201st out, and the chip read "200 HR entries"); `brief` (or `line_chars`) answers each line short —
// the day, the lane, the kind, the first characters of its words, who, and the row behind it — with the docs' sizes in
// place of their text; and a reply still past the door's 80,000 characters is shortened by devMcpReplyFit.ts in a fixed
// order, down to the newest months that fit, with `shortened` naming each block and `next_until` the day to read on from.
// Tests: src/lib/devMcp/devMcpBigCase.test.ts.

import { ALL_ROWS_MAX, newestFirst, readAllRows, readRowsByIds, type Reader, type Row } from './devMcpComposites.ts'
import { AMENDMENTS_NOTE, amendmentCounts, amendmentKeyOfRow, readPersonAmendments, seatAmendmentBits, type SeatAmendmentBits } from './devMcpAmendments.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { cutText, fitReply, replyChars, type FitStep, type Shortened, type ShortenedBlock } from './devMcpReplyFit.ts'
import {
  PERSON_TIMELINE_LANES,
  PERSON_TIMELINE_SOURCES,
  buildPersonTimeline,
  countPersonTimeline,
  filterPersonTimeline,
  groupPersonTimelineByMonth,
  personFileFactChips,
  personFileFacts,
  signedPapers,
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
  type PersonTimelineState,
  type PersonTimelineStatement,
  type PersonTimelineWriteup,
  statementRows,
  ymdShift,
} from './personTimeline.ts'
import { evidenceDriveWords, sortEvidenceNewestFirst, type PersonEvidenceFile } from './personEvidence.ts'
import { counselOnlyHeldReason, counselOnlyStillHeld } from './devMcpCounselOnly.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const FIND_LIMIT = 20
/** A brief line's words (v2.6935): this many characters of `what` unless `line_chars` says otherwise. */
export const PERSON_FILE_LINE_CHARS = 160
export const PERSON_FILE_LINE_CHARS_MIN = 40
export const PERSON_FILE_LINE_CHARS_MAX = 2000
/** The fit's steps for the lists a long file carries beside its lines. */
const FIT_DOCUMENTS = 20
const FIT_OLD_FILES = 20
const FIT_EVIDENCE_STEPS = [50, 25, 10] as const
const FIT_LINE_STEPS = [80, 40] as const

const LANES = new Set<string>(PERSON_TIMELINE_LANES.map((l) => l.lane))
const SOURCES = new Set<string>(PERSON_TIMELINE_SOURCES.map((s) => s.source))

export type PersonFileAsk = {
  /** A people.id, a users.id (find_person) or a name that matches exactly one person. */
  person: string
  lane?: unknown
  source?: unknown
  /** YYYY-MM-DD: only lines on or after this day. */
  since?: unknown
  /** YYYY-MM-DD: only lines on or before this day (v2.6935) — how a long Timeline is read on, a stretch at a time. */
  until?: unknown
  /** false leaves the summary and narrative out (a long file); true keeps their text under brief. */
  docs?: unknown
  /** true answers each line short, and the docs' sizes in place of their text (v2.6935). */
  brief?: unknown
  /** How many characters of a line's words brief keeps, 40 to 2,000; asking it asks for brief. */
  line_chars?: unknown
}

/** A Timeline line as `brief` answers it: the words cut, the row behind it one read away. */
export type PersonFileBriefLine = {
  ymd: string
  lane: PersonTimelineLane
  source: PersonTimelineSource
  kindWords: string
  what: string
  /** The characters of `what` left out; absent when it is whole. */
  more?: number
  /** The line's second line, cut the same way; absent when empty. */
  notes?: string
  byName: string
  /** Absent when live. */
  state?: PersonTimelineState
  /** How many files hang on the entry; absent when none. */
  files?: number
  /** The row behind the line, `table:id`: read_rows on the table with id eq answers it whole. */
  row: string
} & SeatAmendmentBits

export function briefPersonFileLine(l: PersonTimelineLine, max: number): PersonFileBriefLine {
  const what = cutText(l.what, max)
  const notes = cutText(l.notes, max).text
  return {
    ymd: l.ymd,
    lane: l.lane,
    source: l.source,
    kindWords: l.kindWords,
    what: what.text,
    ...(what.more > 0 ? { more: what.more } : {}),
    ...(notes ? { notes } : {}),
    byName: l.byName,
    ...(l.state !== 'live' ? { state: l.state } : {}),
    ...(l.attachmentIds.length > 0 ? { files: l.attachmentIds.length } : {}),
    row: `${l.ref.table}:${l.ref.id}`,
  }
}

export type PersonFileReader = { role: string; todayYmd: string }

export type PersonFileHeld = { source: PersonTimelineSource; reason: string }

type PeopleRow = { id: string; name: string; kind: string | null; start_date: string | null; end_date: string | null; archived_at: string | null; account_user_id: string | null }
type AttachmentRow = PersonEvidenceFile & { entry_id: string | null }
type DocRow = { kind: string; content: string; updated_at: string; covered_through: string | null; author_label: string | null }
/** One row of person_document_index (v2.6613): a named document without its text. */
type DocIndexRow = { id: string; title: string; counsel_only: boolean; author_label: string | null; created_at: string; updated_at: string; archived_at: string | null; chars: number; sections: number }
type EvidenceRow = { id: string; person_id: string; entry_id: string | null; dated_on: string; title: string; memo: string; created_by: string | null; author_label: string | null; created_at: string; drive_folder_id: string | null; drive_folder_url: string | null; filed_at: string | null; fail_why: string | null; counsel_only?: boolean | null }
type WriteupRow = { id: string; template_id: string; status: string; disclosure: string | null; submitted_at: string | null; created_at: string; filled_by_user_id: string | null }
type ExcuseRow = { id: string; work_date: string; note: string; created_at: string; author: unknown }
type StatementRow = Omit<PersonTimelineStatement, 'job_label'>
type JobNameRow = { id: string; click_number: string | null; job_name: string | null }

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
/** PostgREST `ilike` wildcard is `*`; a literal `*`, `,` or a paren in the text would change the pattern. */
const likeTerm = (text: string): string => `*${text.trim().replace(/[*,()]/g, ' ').replace(/\s+/g, '*')}*`
const eq = (column: string, value: string): RowFilter[] => [{ column, op: 'eq', value }]

/** The ask's filters, checked against the kernel's own lists; a wrong one is refused in words. */
export function personFileFilter(
  ask: PersonFileAsk,
): { ok: true; lane: PersonTimelineLane | null; source: PersonTimelineSource | null; since: string | null; until: string | null; docs: boolean; docsAsked: boolean; brief: boolean; lineChars: number } | { ok: false; refused: string } {
  const lane = typeof ask.lane === 'string' && ask.lane.trim() ? ask.lane.trim().toLowerCase() : ''
  if (lane && !LANES.has(lane)) return { ok: false, refused: `lane must be one of ${[...LANES].join(', ')} (Ahead is planned).` }
  const source = typeof ask.source === 'string' && ask.source.trim() ? ask.source.trim().toLowerCase() : ''
  if (source && !SOURCES.has(source)) return { ok: false, refused: `source must be one of ${[...SOURCES].join(', ')}.` }
  const since = typeof ask.since === 'string' && ask.since.trim() ? ask.since.trim() : ''
  if (since && !YMD_RE.test(since)) return { ok: false, refused: 'since must be a day, YYYY-MM-DD.' }
  const until = typeof ask.until === 'string' && ask.until.trim() ? ask.until.trim() : ''
  if (until && !YMD_RE.test(until)) return { ok: false, refused: 'until must be a day, YYYY-MM-DD.' }
  if (since && until && since > until) return { ok: false, refused: `since (${since}) is after until (${until}): no day is in both.` }
  const asksChars = ask.line_chars != null && ask.line_chars !== ''
  const lineChars = asksChars ? Number(ask.line_chars) : PERSON_FILE_LINE_CHARS
  if (!Number.isInteger(lineChars) || lineChars < PERSON_FILE_LINE_CHARS_MIN || lineChars > PERSON_FILE_LINE_CHARS_MAX) return { ok: false, refused: `line_chars must be a whole number from ${PERSON_FILE_LINE_CHARS_MIN} to ${PERSON_FILE_LINE_CHARS_MAX}: the characters of a line's words brief keeps (${PERSON_FILE_LINE_CHARS} when left out).` }
  return { ok: true, lane: (lane || null) as PersonTimelineLane | null, source: (source || null) as PersonTimelineSource | null, since: since || null, until: until || null, docs: ask.docs !== false, docsAsked: ask.docs === true, brief: ask.brief === true || asksChars, lineChars }
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

  async function read<T>(source: PersonTimelineSource, allowed: boolean, why: string, run: () => Promise<Row[]>): Promise<T[]> {
    if (!allowed) {
      held.push({ source, reason: why })
      return []
    }
    try {
      return (await run()) as unknown as T[]
    } catch (e) {
      held.push({ source, reason: e instanceof Error ? e.message : String(e) })
      return []
    }
  }

  /**
   * Every row of a source, a page at a time in id order (readAllRows). v2.6935 paged the HR entries; since v2.6939 every
   * source is read this way, so a file with more than 200 attachments, records or papers is whole. `at_cap` names a
   * table only past readAllRows' own stop. `newestBy` puts the rows back newest first on that column, as one read
   * ordered them.
   */
  const every = (table: string, select: string, filters: RowFilter[], newestBy?: string) => async (): Promise<Row[]> => {
    const r = await readAllRows(reader, table, { select, filters })
    if (r.capped && !atCap.includes(table)) atCap.push(table)
    return newestBy ? newestFirst(r.rows, newestBy) : r.rows
  }

  const devOnly = 'dev only'
  const noLogin = 'needs a login'
  const CONTRACT_SELECT = 'id,document_name,status,created_at,sent_at,signed_at,office_completed_at,signer_printed_name,expires_at,doc_type,signer_consented_at,signer_signature_storage_path,form_scan_storage_path,form_source'
  const [entryRows, attachments, docRows, evidenceRows, reports, contractsById, contractsByName, statementRowsRaw, licenses, writeupRows, ncns, excuseRows] = await Promise.all([
    // v2.6935: every entry, a page at a time — one read of 200 left the 201st out and the chip said 200.
    read<PersonTimelineEntry>('file', isDev, devOnly, every('person_file_entries', 'id,entry_date,content,source,created_by,created_at,author_label', eq('person_id', personId))),
    read<AttachmentRow>('file', isDev, devOnly, every('person_file_attachments', 'id,entry_id,evidence_id,filename,mime_type,size_bytes,storage_path,drive_file_id,drive_url,filed_at,fail_why,created_at,sha256', eq('person_id', personId), 'created_at')),
    read<DocRow>('file', isDev, devOnly, () => reader.rows('person_files', { select: 'kind,content,updated_at,covered_through,author_label', filters: eq('person_id', personId), limit: 10 })),
    read<EvidenceRow>('evidence', isDev, devOnly, every('person_file_evidence', 'id,person_id,entry_id,dated_on,title,memo,created_by,author_label,created_at,drive_folder_id,drive_folder_url,filed_at,fail_why,counsel_only', eq('person_id', personId), 'dated_on')),
    read<PersonTimelineReport>('report', isDev, devOnly, every('person_reports', 'id,status,occurred_date,created_at,author_name,content,resolution_note,resolved_at,filed_entry_id', eq('subject_person_id', personId), 'occurred_date')),
    read<PersonTimelineContract>('contract', true, '', every('person_contract_documents', CONTRACT_SELECT, eq('person_id', personId))),
    read<PersonTimelineContract>('contract', name !== '', 'needs a name on the roster', every('person_contract_documents', CONTRACT_SELECT, eq('person_name', name))),
    // v2.6820: hours statements — payroll data, a dev's or the controller's by RLS; read as the dev alone, held for a view_as.
    read<StatementRow>('statement', isDev, 'dev or controller', every('hours_statements', 'id,record_id,job_ledger_id,state,basis,period_start,period_end,prepared_at,updated_at,contract_document_id,drive_file_id,matter_document_id', eq('person_id', personId), 'prepared_at')),
    read<PersonTimelineLicense>('license', name !== '', 'needs a name on the roster', every('person_licenses', 'id,license_type,date_of_expiry,created_at,note', eq('person_name', name))),
    read<WriteupRow>('writeup', Boolean(userId), noLogin, every('writeups', 'id,template_id,status,disclosure,submitted_at,created_at,filled_by_user_id', eq('subject_user_id', userId as string))),
    read<PersonTimelineNcns>('attendance', Boolean(userId), noLogin, every('attendance_incidents', 'id,work_date,created_at,created_by_user_id,details', [...eq('subject_user_id', userId as string), ...eq('incident_type', 'no_call_no_show')])),
    read<ExcuseRow>('attendance', Boolean(userId), noLogin, every('attendance_annotations', 'id,work_date,note,created_at,author:users!attendance_annotations_author_id_fkey(name)', eq('subject_user_id', userId as string))),
  ])

  // The pages come in id order; the entries go on newest day first, as the one read ordered them.
  const entries = [...entryRows].sort((a, b) => (a.entry_date !== b.entry_date ? (a.entry_date < b.entry_date ? 1 : -1) : a.created_at !== b.created_at ? (a.created_at < b.created_at ? 1 : -1) : 0))

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
  const statementJobIds = [...new Set(statementRowsRaw.map((s) => s.job_ledger_id))]
  const [templates, users, statementJobs] = await Promise.all([
    templateIds.length > 0 ? quiet(() => readRowsByIds(reader, 'writeup_templates', 'id,name', templateIds)) : Promise.resolve([] as Row[]),
    userIds.size > 0 ? quiet(() => readRowsByIds(reader, 'users', 'id,name', [...userIds])) : Promise.resolve([] as Row[]),
    statementJobIds.length > 0 ? quiet(() => readRowsByIds(reader, 'jobs_ledger', 'id,click_number,job_name', statementJobIds)) : Promise.resolve([] as Row[]),
  ])
  // The job in words, as the tab's io writes it (statementJobLabel): the number, then the name.
  const jobLabel = new Map((statementJobs as unknown as JobNameRow[]).map((j) => [j.id, [(j.click_number ?? '').trim() ? `Job ${(j.click_number ?? '').trim()}` : '', (j.job_name ?? '').trim()].filter(Boolean).join(' · ')]))
  const statements: PersonTimelineStatement[] = statementRowsRaw.map((s) => ({ ...s, job_label: jobLabel.get(s.job_ledger_id) ?? '' }))
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
    statements,
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
  if (filter.until) lines = lines.filter((l) => l.ymd <= filter.until!)
  const { ahead, past } = splitPersonTimeline(lines, who.todayYmd)
  const monthsWhole = groupPersonTimelineByMonth(past)

  // v2.6554: counsel-only records were refused to this seat by RLS (the X-Dev-Seat header). Since v2.6986 the fence asks a
  // switch that stands open, so they come back with the rest; a hold is named only for the ones the count names that the
  // read did not hand back (the switch shut again).
  if (isDev) {
    try {
      const raw = await reader.rpc('person_counsel_only_count', { p_person_id: personId })
      const n = counselOnlyStillHeld(raw, evidenceRows.filter((r) => r.counsel_only === true).length)
      if (n > 0) held.push({ source: 'evidence', reason: counselOnlyHeldReason(n) })
    } catch {
      // Before the migration is pushed the function is not there: nothing to name.
    }
  }
  // Punch list #315 (0.81.0): the correction links, a source of their own. A read that fails is named in `held` under the
  // entries' source and takes only the links out; every line still draws.
  const amendRead = isDev ? await readPersonAmendments(reader, personId) : null
  if (amendRead?.heldWhy) held.push({ source: 'file', reason: `the correction links could not be read (${amendRead.heldWhy}); the entries and records are whole` })
  if (amendRead?.capped && !atCap.includes('person_file_amendments')) atCap.push('person_file_amendments')
  const amendDays = new Map<string, string>()
  for (const e of entries) amendDays.set(`hr_entry:${e.id}`, e.entry_date)
  for (const r of evidenceRows) amendDays.set(`hr_evidence:${r.id}`, r.dated_on)
  const amendBits = (table: string, id: string): SeatAmendmentBits => (amendRead ? seatAmendmentBits(amendmentKeyOfRow(table, id), amendRead.index, (k) => amendDays.get(k) ?? null) : {})

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
  // get_person_document by id, or read_rows on documents (v2.6716's table). Quiet until the catalog knows the view (regenerated after the migration's push).
  const documentRows = isDev ? ((await quiet(every('person_document_index', 'id,title,counsel_only,author_label,created_at,updated_at,archived_at,chars,sections', eq('person_id', personId)))) as unknown as DocIndexRow[]) : []
  const documents = documentRows
    .filter((d) => !d.archived_at)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
    .map((d) => ({ id: d.id, title: d.title, counsel_only: d.counsel_only, kept_by: d.author_label ?? '', updated_at: d.updated_at, chars: d.chars, sections: d.sections, ...(filter.since ? { changed_since: d.updated_at.slice(0, 10) >= filter.since } : {}) }))

  // v2.6935: the blocks a long file fills, each behind the dial `brief` or a fit step turns. The rows stay whole in
  // here; a block is drawn again from them each time a dial moves.
  let lineChars: number | null = filter.brief ? filter.lineChars : null
  let monthsKept: number | null = null
  let evidenceChars: number | null = filter.brief ? filter.lineChars : null
  let evidenceNewest: number | null = null
  let summaryOut = filter.brief && !filter.docsAsked
  let narrativeOut = filter.brief && !filter.docsAsked
  // A line a link touches gains standing, amended_by, amends and latest_word; a line none touches is what the kernel wrote.
  const drawLine = (l: PersonTimelineLine): (PersonTimelineLine & SeatAmendmentBits) | PersonFileBriefLine => {
    const bits = amendBits(l.ref.table, l.ref.id)
    return lineChars == null ? { ...l, ...bits } : { ...briefPersonFileLine(l, lineChars), ...bits }
  }
  const monthsShown = () => (monthsKept == null ? monthsWhole : monthsWhole.slice(0, monthsKept))
  const aheadBlock = () => ahead.map(drawLine)
  const monthsBlock = () => monthsShown().map((m) => ({ month: m.monthKey, label: m.label, lines: m.lines.map(drawLine) }))
  const shownCount = () => ahead.length + monthsShown().reduce((n, m) => n + m.lines.length, 0)

  const evidenceSorted = sortEvidenceNewestFirst(evidenceRows)
  const evidenceBy = (r: EvidenceRow): string => namesById[r.created_by ?? ''] ?? r.author_label ?? ''
  const evidenceDrive = (r: EvidenceRow) => evidenceDriveWords({ fail_why: r.fail_why, filed_at: r.filed_at, files: filesByRecord.get(r.id) ?? [] })
  const evidenceWhole = (r: EvidenceRow) => {
    const files = (filesByRecord.get(r.id) ?? []).map((f) => ({ id: f.id, filename: f.filename, mime_type: f.mime_type, size_bytes: f.size_bytes, drive_url: f.drive_url, filed_at: f.filed_at, fail_why: f.fail_why, sha256: f.sha256 ?? null, linked: !f.storage_path && !!f.drive_url }))
    return { id: r.id, entry_id: r.entry_id, dated_on: r.dated_on, title: r.title, memo: r.memo, ...(r.counsel_only ? { counsel_only: true } : {}), by: evidenceBy(r), created_at: r.created_at, drive: evidenceDrive(r), drive_folder_url: r.drive_folder_url, files, ...amendBits('person_file_evidence', r.id) }
  }
  const evidenceShort = (r: EvidenceRow, max: number) => {
    const memo = cutText(r.memo, max)
    return { id: r.id, entry_id: r.entry_id, dated_on: r.dated_on, title: r.title, memo: memo.text, ...(memo.more > 0 ? { more: memo.more } : {}), ...(r.counsel_only ? { counsel_only: true } : {}), by: evidenceBy(r), drive: evidenceDrive(r), files: (filesByRecord.get(r.id) ?? []).length, ...amendBits('person_file_evidence', r.id) }
  }
  const evidenceBlock = () => (evidenceNewest == null ? evidenceSorted : evidenceSorted.slice(0, evidenceNewest)).map((r) => (evidenceChars == null ? evidenceWhole(r) : evidenceShort(r, evidenceChars)))

  const docOut = (d: DocRow | undefined, out: boolean) =>
    !d ? null : out ? { kind: d.kind, content: null, chars: d.content.length, updated_at: d.updated_at, covered_through: d.covered_through, author_label: d.author_label, read: `get_person_document { person, kind: "${d.kind}" } reads it a section at a time` } : d
  const docsBlock = () => (filter.docs ? { summary: docOut(docs.summary, summaryOut), narrative: docOut(docs.narrative, narrativeOut) } : 'left out (docs: false)')
  const oldFiles = attachments.filter((a) => !a.evidence_id).map((f) => ({ id: f.id, entry_id: f.entry_id, filename: f.filename, mime_type: f.mime_type, size_bytes: f.size_bytes, created_at: f.created_at }))

  // What each shortening says of itself: the block, what is still there, the call that reads the rest.
  const lineNote = (max: number): ShortenedBlock => ({
    block: 'ahead and months',
    kept: `each line short: the day, the lane, the kind, the first ${max} characters of its words (more counts the rest), who, and row, the table and id behind it`,
    read_whole: 'read_rows on the row\'s table with id eq (row is table:id), or get_person_file without brief over a shorter stretch (since, until)',
  })
  const evidenceNote = (max: number, newest: number | null): ShortenedBlock => ({
    block: 'evidence',
    kept: `${newest == null ? 'each record' : `the newest ${newest} of ${evidenceSorted.length} records, each`} short: the first ${max} characters of its memo (more counts the rest), the Drive state and a count of its files`,
    read_whole: 'read_rows on person_file_evidence by id, and on person_file_attachments with evidence_id eq for its files; get_case_brief lists every record',
  })
  const docsNote = (): ShortenedBlock => ({
    block: 'docs',
    kept: `the size of ${[summaryOut && docs.summary ? 'the summary' : '', narrativeOut && docs.narrative ? 'the narrative' : ''].filter(Boolean).join(' and ')} in place of the text`,
    read_whole: 'get_person_document { person, kind } reads the summary or the narrative a section at a time; docs: true keeps the text here',
  })
  const asked: ShortenedBlock[] = filter.brief
    ? [lineNote(filter.lineChars), ...(evidenceSorted.length > 0 ? [evidenceNote(filter.lineChars, null)] : []), ...(filter.docs && !filter.docsAsked && (docs.summary || docs.narrative) ? [docsNote()] : [])]
    : []

  const filtered = Boolean(filter.lane || filter.source || filter.since || filter.until)
  const whole = {
    person: { id: person.id, name: person.name, kind: person.kind, start_date: person.start_date, end_date: person.end_date, archived_at: person.archived_at, user_id: userId, login: Boolean(userId) },
    read_as: { role: who.role, today: who.todayYmd },
    // v2.6935: null when the reply is whole; else why it was shortened and each block with what it kept and the call that reads the rest.
    shortened: (filter.brief ? { why: filter.lineChars === PERSON_FILE_LINE_CHARS ? 'You asked for brief.' : `You asked for brief, ${filter.lineChars} characters a line.`, blocks: asked } : null) as Shortened | null,
    // The day to pass as until to read the lines this reply left out; null when every line asked for is here.
    next_until: null as string | null,
    source: 'buildPersonTimeline + personFileFacts — the People → HR tab\'s own kernel (supabase/functions/_shared/personTimeline.ts) over the tab\'s sources and keys',
    facts,
    chips: personFileFactChips(facts),
    // v2.6820: what they signed, as a list — the paper, the day, signed as, how, and the door to the signed record — so an agent
    // reads it without walking the months; the same rows the Timeline's contract source draws, newest first.
    signed_papers: signedPapers(input),
    signed_papers_note: 'The papers this person signed in the app (person_contract_documents, status signed), newest first; door.to opens the signed record on People → Contracts. A paper made for them and never sent stands on the Timeline as owed; an hours statement signed through the app is here too (doc_type hours_statement); a statement only printed is not a signature.',
    // v2.6820 (Diane: "Statements too"): every hours statement with where it stands — draft, printed and not signed back, sent and
    // waiting, signed back — the job, the period, the basis, and the door: the signed record, the file in Drive, or the job window.
    hours_statements: statementRows(input),
    hours_statements_note: 'The person\'s hours statements (hours_statements, punch list #212), newest first, each with its standing: draft · printed, not signed back · sent for signature · signed back. A signed one names its signed copy (signed_copy_id, a person_contract_documents row, also in signed_papers) and its door opens that record, where the signed PDF opens; an unsigned one\'s door opens the file in Drive when the office put it there, else the job window, whose Documents tab holds the sheet. A printed statement is not a signature.',
    // total and the two breakdowns count the whole file; shown counts the lines in this reply.
    counts: { ...countPersonTimeline(all), shown: lines.length },
    lanes: PERSON_TIMELINE_LANES,
    sources: PERSON_TIMELINE_SOURCES,
    held: heldOnce,
    at_cap: atCap.length ? { tables: atCap, note: `Every source is read a page at a time, and a read stops at ${ALL_ROWS_MAX} rows: these tables hold more, so the file here is short of them. read_rows the table with filters for the rest.` } : null,
    filter: filtered ? { lane: filter.lane, source: filter.source, since: filter.since, until: filter.until } : null,
    // Punch list #315 (0.81.0): the correction links on the file, counted; null for another role or a file with none read.
    amendments: amendRead && !amendRead.heldWhy ? { ...amendmentCounts(amendRead), note: AMENDMENTS_NOTE } : null,
    ahead: aheadBlock(),
    months: monthsBlock(),
    evidence: evidenceBlock(),
    files_before_records: oldFiles,
    docs: docsBlock(),
    documents,
    documents_note: isDev ? 'The named documents on the file (v2.6613), newest first, without their text: read one with get_person_document { doc_id, section? } or read_rows on documents (select content) by id; change one with plan_person_doc { doc_id }; archived ones are left out.' : 'dev only',
  }

  // v2.6935: the steps that shorten a reply too long for the door, mildest first (devMcpReplyFit.ts runs each only while
  // the reply is still over): the docs' text, which get_person_document reads a section at a time; the evidence short
  // and the lists another verb carries, since a record is on the Timeline as a line too; then the lines short; then
  // fewer evidence records; and last the Timeline's oldest months, with next_until to read on.
  type Reply = typeof whole
  const steps: FitStep<Reply>[] = [
    (r) => {
      if (!filter.docs || narrativeOut || !docs.narrative) return null
      narrativeOut = true
      return { reply: { ...r, docs: docsBlock() }, note: docsNote() }
    },
    (r) => {
      if (!filter.docs || summaryOut || !docs.summary) return null
      summaryOut = true
      return { reply: { ...r, docs: docsBlock() }, note: docsNote() }
    },
    (r) => {
      if (evidenceChars != null || evidenceSorted.length === 0) return null
      evidenceChars = filter.lineChars
      return { reply: { ...r, evidence: evidenceBlock() }, note: evidenceNote(evidenceChars, evidenceNewest) }
    },
    (r) => {
      if (documents.length <= FIT_DOCUMENTS) return null
      return { reply: { ...r, documents: documents.slice(0, FIT_DOCUMENTS) }, note: { block: 'documents', kept: `the ${FIT_DOCUMENTS} most lately changed of ${documents.length} documents`, read_whole: 'get_case_brief lists every document with its section index' } }
    },
    (r) => {
      if (oldFiles.length <= FIT_OLD_FILES) return null
      return { reply: { ...r, files_before_records: oldFiles.slice(0, FIT_OLD_FILES) }, note: { block: 'files_before_records', kept: `the newest ${FIT_OLD_FILES} of ${oldFiles.length} files`, read_whole: 'read_rows on person_file_attachments with person_id eq and evidence_id is null' } }
    },
    (r) => {
      if (lineChars != null) return null
      lineChars = filter.lineChars
      return { reply: { ...r, ahead: aheadBlock(), months: monthsBlock() }, note: lineNote(lineChars) }
    },
    ...FIT_EVIDENCE_STEPS.map(
      (newest): FitStep<Reply> =>
        (r) => {
          if (evidenceSorted.length <= newest) return null
          evidenceNewest = newest
          return { reply: { ...r, evidence: evidenceBlock() }, note: evidenceNote(evidenceChars ?? filter.lineChars, evidenceNewest) }
        },
    ),
    (r, budget) => {
      if (monthsWhole.length <= 1) return null
      // The newest months that fit, found by halves; the newest month alone when even two do not.
      const at = (kept: number): Reply => {
        monthsKept = kept
        return { ...r, months: monthsBlock(), counts: { ...r.counts, shown: shownCount() }, next_until: ymdShift(`${monthsWhole[kept - 1]!.monthKey}-01`, -1) }
      }
      const room = budget - 900
      let best = 1
      let lo = 2
      let hi = monthsWhole.length - 1
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (replyChars(at(mid)) <= room) {
          best = mid
          lo = mid + 1
        } else hi = mid - 1
      }
      const reply = at(best)
      const oldest = monthsWhole[best - 1]!
      // The call that reads on keeps what this one asked: the stretch's start, the lane, the source, the line's length.
      const narrowed = [filter.since ? `, since: "${filter.since}"` : '', filter.lane ? `, lane: "${filter.lane}"` : '', filter.source ? `, source: "${filter.source}"` : ''].join('')
      const short = filter.lineChars === PERSON_FILE_LINE_CHARS ? 'brief: true' : `line_chars: ${filter.lineChars}`
      return {
        reply,
        note: {
          block: 'months',
          kept: `the newest ${best} of ${monthsWhole.length} months: ${reply.counts.shown} of ${lines.length} lines`,
          read_whole: `get_person_file { person, until: "${reply.next_until}"${narrowed}, ${short} } reads the ${lines.length - reply.counts.shown} lines before ${oldest.label}; next_until carries that day`,
        },
      }
    },
    ...FIT_LINE_STEPS.map(
      (max): FitStep<Reply> =>
        (r) => {
          if (lineChars != null && lineChars <= max) return null
          lineChars = max
          return { reply: { ...r, ahead: aheadBlock(), months: monthsBlock() }, note: lineNote(max) }
        },
    ),
  ]
  return fitReply(whole, steps)
}

/** The reply of a file that was read (not refused). */
export type PersonFileReply = Exclude<Awaited<ReturnType<typeof getPersonFile>>, { refused: string }>
/** The same reply when nothing was shortened: every line and every evidence record as the kernel wrote it. */
export type PersonFileWholeReply = Omit<PersonFileReply, 'ahead' | 'months' | 'evidence'> & {
  ahead: (PersonTimelineLine & SeatAmendmentBits)[]
  months: { month: string; label: string; lines: (PersonTimelineLine & SeatAmendmentBits)[] }[]
  evidence: Extract<PersonFileReply['evidence'][number], { files: unknown[] }>[]
}
