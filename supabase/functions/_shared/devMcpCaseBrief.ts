// get_case_brief (v2.6619, punch list #278 PR 1): one page that says what is where on a person's case — the brief an
// agent reads before anything else, the way it reads a folder's README. Composed from the reads the seat already makes,
// each as the dev under RLS and fail-soft (a source that cannot be read is named in `held` and the rest still draws),
// over the injected Reader (devMcpComposites.ts), so the kernel is tested over a fake reader. The text never crosses
// the door whole: the section indexes come from person_file_index / person_document_index (20261107060000), the summary
// is a page by rule, and the agent's own notes come back as their first lines. Dev-only, like the HR file: another
// role gets the person and `held: dev only` for every source.
//
// v2.6935: the brief fits the door. A file with fifty documents, one of them with hundreds of headings, answered past
// the door's 80,000 characters and lost every block after `documents`. The small blocks now come first, the entries are
// counted a page at a time (one read stopped the count at 200), and a brief that is still too long is shortened by
// devMcpReplyFit.ts in a fixed order — the documents' section indexes first, as outlines — with each shortened block
// named in `shortened` beside the call that reads it whole.
//
// v2.7651 (server 0.97.0): the brief opens with the manifest and the reading rules (devMcpPersonManifest.ts). A large
// file is shortened here and in get_person_file, so neither said in one place how many of each thing the file holds or
// which call opens it; `manifest` does, one line a part with its whole count, and `reading` carries the rules an agent
// follows on an HR file. The Timeline's sources are counted by get_person_file's own kernel (its `tally` and
// `counts`), so a number here is the number that verb answers. No fit step touches either block.
//
// v2.7976 (server 0.118.0, punch list #315, upgrade 2): the brief reads the rows the system numbers. An evidence
// record carries exhibit_no, the number the file gave it. open_items lists the case's open items whole, by number,
// with the newest closed ones, and log counts the case log and carries its newest lines (devMcpCase.ts over the
// tab's own kernel, personCase.ts). Both were prose in the file's Agent notes; plan_case → apply_case writes them.
import { ALL_ROWS_MAX, newestFirst, readAllRows, readRowsByIds, type Reader, type Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { PERSON_FILE_LINE_CHARS_MIN, getPersonFile, resolvePerson } from './devMcpPersonFile.ts'
import { HR_READING_RECEIPT, HR_READING_RULES, buildPersonManifest, type ManifestHeld, type PersonManifestInput } from './devMcpPersonManifest.ts'
import type { PersonTimelineSource } from './personTimeline.ts'
import { cutText, fitReply, outlineHeadings, type FitStep, type Shortened } from './devMcpReplyFit.ts'
import { counselOnlyStillHeld } from './devMcpCounselOnly.ts'
import { AMENDMENTS_NOTE, amendmentCounts, amendmentDays, newestAmendments, readPersonAmendments, seatAmendmentBits } from './devMcpAmendments.ts'
import { ENGAGEMENT_SELECT, engagementsBlock } from './devMcpEngagement.ts'
import type { PersonEngagementRow } from './personEngagements.ts'
import { BRIEF_CASE_LOG_LINES, CASE_ITEMS_WHOLE, CASE_ITEM_SELECT, CASE_LOG_SELECT, briefCaseLog, briefOpenItems, exhibitBits, exhibitNoOf, type CaseItemRead, type CaseItemsDial, type CaseLogRead } from './devMcpCase.ts'

export type CaseBriefAsk = { person: string }
export type CaseBriefReader = { role: string; todayYmd: string }

/** The title the agent's own notes document carries, by convention; the brief returns it first. */
export const AGENT_NOTES_TITLE = 'Agent notes'
/** How much of the notes the brief carries; the rest is a section read away. */
export const AGENT_NOTES_CHARS = 1200
const NEWEST_ENTRIES = 10
/** Punch list #315: how many of the newest correction links the brief lists. */
const NEWEST_AMENDMENTS = 10
const HEADLINES = 5
/** The fit's steps (v2.6935), mildest first: how many headings a document keeps, then the lists' newest rows. */
export const BRIEF_DOC_SECTION_STEPS = [40, 24, 16, 12, 8, 5, 3] as const
const BRIEF_OUTLINE_STEPS = [60, 30, 15] as const
const BRIEF_EVIDENCE_STEPS = [100, 50, 25] as const
const BRIEF_DOCUMENT_STEPS = [60, 30, 15] as const
const BRIEF_MATTER_ROWS = 40
const BRIEF_SUMMARY_CHARS = 6000
/** v2.7976: the open items a long brief keeps, by number, and the log lines it keeps. */
const BRIEF_CASE_ITEM_STEPS = [40, 15] as const
const BRIEF_CASE_LOG_SHORT = 3

type Heading = { n: number | null; level: number; heading: string; line: number }
type EntryRow = { id: string; entry_date: string; source: string; created_at?: string | null; gmail_message_id?: string | null }
type EvidenceRow = { id: string; dated_on: string; title: string; counsel_only: boolean | null; drive_folder_id?: string | null; exhibit_no?: number | null }
type FileIndexRow = { kind: string; chars: number; sections: number; headings: Heading[] | null; updated_at: string; covered_through: string | null; author_label: string | null }
type DocIndexRow = { id: string; title: string; counsel_only: boolean; author_label: string | null; updated_at: string; archived_at: string | null; chars: number; sections: number; headings: Heading[] | null; evidence_id?: string | null }
type MatterRow = { id: string; stage: string | null; narrative_md: string | null; narrative_updated_at: string | null; closed_at: string | null }
type MatterEntryRow = { id: string; kind: string; occurred_on: string | null; body: string | null; meta: { done_at?: string | null } | null; voided_at: string | null }
type MatterDocRow = { id: string; title: string; state: string | null; dated_on: string | null; voided_at: string | null; mime: string | null; counsel_only?: boolean | null }
type MarkRow = { theme_id: string; proposed: boolean | null; kept_at?: string | null; removed_at: string | null }
type ThemeRow = { id: string; name: string }
type HistoryLine = { at: string; body: string; kind?: string; by?: string | null }

const eq = (column: string, value: unknown) => [{ column, op: 'eq' as const, value }]
const firstLine = (s: string, max = 120) => (s.split('\n').find((l) => l.trim() !== '') ?? '').trim().slice(0, max)

/** The headings of a markdown text, the way hr_doc_headings reads them, for a text the kernel holds (the matter's narrative). */
export function headingsOf(md: string): Heading[] {
  const out: Heading[] = []
  let fence = false
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!
    if (/^\s*(```|~~~)/.test(l)) {
      fence = !fence
      continue
    }
    if (fence) continue
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l)
    if (!m) continue
    const heading = m[2]!.replace(/`/g, '').replace(/\*\*/g, '').trim()
    if (!heading) continue
    const n = /^\s*(?:§\s*)?(\d{1,3})(?:[.:)]|\s+[-–—]|\s)/.exec(heading)
    out.push({ n: n ? Number(n[1]) : null, level: m[1]!.length, heading, line: i + 1 })
  }
  return out
}

/** A section index as the brief carries it; `max` keeps an outline of that many headings (outlineHeadings). */
const sections = (h: Heading[] | null | undefined, max: number | null = null) => (max == null ? h ?? [] : outlineHeadings(h ?? [], max)).map((x) => ({ n: x.n, heading: x.heading, line: x.line }))
const count = (h: Heading[] | null | undefined): number => (h ?? []).length

export async function getCaseBrief(reader: Reader, ask: CaseBriefAsk, who: CaseBriefReader) {
  const resolved = await resolvePerson(reader, ask.person)
  if ('refused' in resolved) return resolved
  const person = resolved.person
  const personId = person.id
  const isDev = who.role === 'dev'
  const held: { source: string; reason: string }[] = []
  const read = async <T>(source: string, run: () => Promise<Row[]>): Promise<T[]> => {
    if (!isDev) {
      held.push({ source, reason: 'dev only' })
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
   * Every row of a source, a page at a time in id order (readAllRows) — v2.6935 for the entries, every list since
   * v2.6939, so the evidence, the documents, the theme marks and the matter's steps count whole past the door's 200
   * rows a read. A read that stops at readAllRows' own cap is named in `held`. `newestBy` puts the rows back newest first.
   */
  const every = (source: string, table: string, select: string, filters: RowFilter[], newestBy?: string) => async (): Promise<Row[]> => {
    const r = await readAllRows(reader, table, { select, filters })
    if (r.capped) held.push({ source, reason: `more than ${ALL_ROWS_MAX} rows of ${table}: the read stopped there` })
    return newestBy ? newestFirst(r.rows, newestBy) : r.rows
  }

  // v2.7651: what only the manifest counts. Each is read on its own and fail-soft into its own part (count null, held),
  // never into the brief's `held`, which names the sources the brief itself draws. Started here, awaited with the rest.
  const counted = async <T>(table: string, select: string, filters: RowFilter[], key = 'id'): Promise<T[] | ManifestHeld> => {
    if (!isDev) return { held: 'dev only' }
    try {
      const r = await readAllRows(reader, table, { select, filters }, key)
      if (r.capped) return { held: `more than ${ALL_ROWS_MAX} rows of ${table}: the read stopped there` }
      return r.rows as unknown as T[]
    } catch (e) {
      return { held: e instanceof Error ? e.message : String(e) }
    }
  }
  const manifestReads = Promise.all([
    counted<{ text_source: string | null; text_why: string | null }>('file_index', 'drive_file_id,text_source,text_why', eq('person_id', personId), 'drive_file_id'),
    counted<{ id: string }>('person_case_log', 'id', eq('person_id', personId)),
    counted<{ state: string }>('dev_seat_kept_plans', 'id,state', eq('person_id', personId)),
    counted<{ untagging_at: string | null }>('email_tag_threads', 'id,untagging_at', eq('person_id', personId)),
    // The Timeline's sources, through get_person_file's own reads and kernel: its tally and counts are whole whatever it shortened.
    isDev
      ? getPersonFile(reader, { person: personId, brief: true, docs: false, line_chars: PERSON_FILE_LINE_CHARS_MIN }, who).catch((e) => ({ refused: e instanceof Error ? e.message : String(e) }))
      : Promise.resolve({ refused: 'dev only' }),
  ])

  // The entries without their words — the count is exact, and `entries.at_cap` is true only past readAllRows' own stop.
  let entriesCapped = false
  const [entryRows, evidence, fileIndex, docIndex, matters, marks, themes, caseItems, caseLogNewest, engagementRows] = await Promise.all([
    read<EntryRow>('entries', async () => {
      const all = await readAllRows(reader, 'person_file_entries', { select: 'id,entry_date,source,created_at,gmail_message_id', filters: eq('person_id', personId) })
      entriesCapped = all.capped
      return all.rows
    }),
    read<EvidenceRow>('evidence', every('evidence', 'person_file_evidence', 'id,dated_on,title,counsel_only,drive_folder_id,exhibit_no', eq('person_id', personId), 'dated_on')),
    read<FileIndexRow>('summary and narrative', () => reader.rows('person_file_index', { select: 'kind,chars,sections,headings,updated_at,covered_through,author_label', filters: eq('person_id', personId), limit: 4 })),
    // v2.6713 (punch list #287): evidence_id, the record a document transcribes; read without it when the catalog does not know the column yet.
    read<DocIndexRow>('documents', async () => {
      try {
        return await every('documents', 'person_document_index', 'id,title,counsel_only,author_label,updated_at,archived_at,chars,sections,headings,evidence_id', eq('person_id', personId))()
      } catch {
        return await every('documents', 'person_document_index', 'id,title,counsel_only,author_label,updated_at,archived_at,chars,sections,headings', eq('person_id', personId))()
      }
    }),
    read<MatterRow>('matter', () => reader.rows('legal_matters', { select: 'id,stage,narrative_md,narrative_updated_at,closed_at', filters: eq('person_id', personId), limit: 2 })),
    // One read asked for 1,000 marks and the door answered 200: paged, a theme's count is whole.
    read<MarkRow>('themes', every('themes', 'legal_theme_marks', 'id,theme_id,proposed,kept_at,removed_at', eq('person_id', personId))),
    read<ThemeRow>('themes', every('themes', 'legal_themes', 'id,name', [{ column: 'retired_at', op: 'is', value: null }])),
    // v2.7976 (punch list #315): the case's items, every one (a file holds tens), and the newest lines of its log in
    // one read; the log's whole count is the manifest's own read below.
    read<CaseItemRead>('case items', every('case items', 'person_case_items', CASE_ITEM_SELECT, eq('person_id', personId))),
    read<CaseLogRead>('case log', () => reader.rows('person_case_log', { select: CASE_LOG_SELECT, filters: eq('person_id', personId), order: [{ column: 'logged_at', ascending: false }], limit: BRIEF_CASE_LOG_LINES })),
    // v2.8000 (punch list #315, upgrade 4c): the standing over time, a source the brief draws.
    read<PersonEngagementRow>('standing', every('standing', 'person_engagements', ENGAGEMENT_SELECT, eq('person_id', personId))),
  ])

  // Newest first, as the Timeline orders them: the day, then when it was written. The newest ten's words are one more read.
  const entries = [...entryRows].sort((a, b) => (a.entry_date !== b.entry_date ? (a.entry_date < b.entry_date ? 1 : -1) : (a.created_at ?? '') !== (b.created_at ?? '') ? ((a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const newestIds = entries.slice(0, NEWEST_ENTRIES).map((e) => e.id)
  const newestRows = newestIds.length ? await read<{ id: string; content: string }>('entries', () => reader.rows('person_file_entries', { select: 'id,content', filters: [{ column: 'id', op: 'in', value: newestIds }], limit: NEWEST_ENTRIES })) : []
  const wordsOf = new Map(newestRows.map((r) => [r.id, r.content]))

  // Punch list #315 (0.81.0): the correction links, a source of their own. A read that fails is named in `held` and takes
  // only the links out. The days of both ends come from the rows already here; an end outside them is one more read.
  const amendRead = isDev ? await readPersonAmendments(reader, personId) : null
  if (amendRead?.heldWhy) held.push({ source: 'correction links', reason: amendRead.heldWhy })
  if (amendRead?.capped) held.push({ source: 'correction links', reason: `more than ${ALL_ROWS_MAX} rows of person_file_amendments: the read stopped there` })
  const knownDays = new Map<string, string | null>()
  for (const e of entries) knownDays.set(`hr_entry:${e.id}`, e.entry_date)
  for (const r of evidence) knownDays.set(`hr_evidence:${r.id}`, r.dated_on)
  const amendDayOf = amendRead && amendRead.rows.length > 0 ? await amendmentDays(reader, amendRead, knownDays) : knownDays
  const amendBits = (kind: 'hr_entry' | 'hr_evidence', id: string) => (amendRead ? seatAmendmentBits(`${kind}:${id}`, amendRead.index, (k) => amendDayOf.get(k) ?? null) : {})

  // The summary whole (a page by rule), the agent's notes' first lines: two small reads after the indexes.
  const summaryIndex = fileIndex.find((f) => f.kind === 'summary') ?? null
  const narrativeIndex = fileIndex.find((f) => f.kind === 'narrative') ?? null
  const summaryRows = summaryIndex ? await read<{ content: string }>('summary', () => reader.rows('person_files', { select: 'content', filters: [...eq('person_id', personId), ...eq('kind', 'summary')], limit: 1 })) : []
  const docs = docIndex.filter((d) => !d.archived_at).sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
  const notesDoc = docs.find((d) => d.title.trim().toLowerCase() === AGENT_NOTES_TITLE.toLowerCase()) ?? null
  const notesRows = notesDoc ? await read<{ content: string }>('agent notes', () => reader.rows('documents', { select: 'content', filters: eq('id', notesDoc.id), limit: 1 })) : []

  // The matter: its steps and documents, when one stands on the person.
  const matter = matters.find((m) => !m.closed_at) ?? matters[0] ?? null
  const counselOnlyCount = matter ? await reader.rpc('matter_counsel_only_count', { p_matter_id: matter.id }).catch(() => 0) : 0
  const [matterEntries, matterDocs] = matter
    ? await Promise.all([
        read<MatterEntryRow>('matter steps', async () => newestFirst(await every('matter steps', 'legal_matter_entries', 'id,kind,occurred_on,body,meta,voided_at', eq('matter_id', matter.id))(), 'occurred_on').reverse()),
        read<MatterDocRow>('matter documents', every('matter documents', 'legal_matter_documents', 'id,title,state,dated_on,voided_at,mime,counsel_only', eq('matter_id', matter.id), 'dated_on')),
      ])
    : [[], []]

  // The developments the person's jobs sit in: the team table and the schedule by the login, then each History's newest lines.
  const userId = person.account_user_id
  const [teamRows, blockRows] = userId
    ? await Promise.all([
        read<{ job_id: string }>('developments', every('developments', 'jobs_ledger_team_members', 'id,job_id', eq('user_id', userId))),
        read<{ job_id: string }>('developments', every('developments', 'job_schedule_blocks', 'id,job_id', eq('assignee_user_id', userId))),
      ])
    : [[], []]
  const jobIds = [...new Set([...teamRows, ...blockRows].map((r) => r.job_id).filter(Boolean))]
  const jobs = jobIds.length
    ? await read<{ id: string; job_name: string | null; development_id: string | null }>('developments', () => readRowsByIds(reader, 'jobs_ledger', 'id,job_name,development_id', jobIds))
    : []
  const developmentIds = [...new Set(jobs.map((j) => j.development_id).filter((d): d is string => Boolean(d)))]
  const developmentRows = developmentIds.length
    ? await read<{ id: string; name: string }>('developments', () => readRowsByIds(reader, 'developments', 'id,name', developmentIds))
    : []
  const developments = await Promise.all(
    developmentRows.map(async (d) => {
      let headlines: { at: string; first_line: string }[] = []
      if (isDev) {
        try {
          const r = (await reader.rpc('dev_history_read', { p_development_id: d.id, p_limit: HEADLINES })) as { lines?: HistoryLine[] } | null
          headlines = (r?.lines ?? []).slice(0, HEADLINES).map((l) => ({ at: l.at, first_line: firstLine(l.body ?? '') }))
        } catch (e) {
          held.push({ source: `history of ${d.name}`, reason: e instanceof Error ? e.message : String(e) })
        }
      }
      return { id: d.id, name: d.name, jobs: jobs.filter((j) => j.development_id === d.id).map((j) => ({ id: j.id, name: j.job_name ?? '' })), headlines }
    }),
  )

  const bySource: Record<string, number> = {}
  for (const e of entries) bySource[e.source] = (bySource[e.source] ?? 0) + 1
  const entryDates = entries.map((e) => e.entry_date).sort()
  const liveMarks = marks.filter((m) => !m.removed_at)
  // v2.7651: a mark the agent proposed and a dev kept is a kept mark (legalThemes.ts → markIsProposed). The brief counted
  // every mark an agent had proposed as still proposed, kept or not, so a file whose marks were all kept read as waiting.
  const waits = (m: MarkRow): boolean => Boolean(m.proposed) && !m.kept_at
  const themeRows = themes
    .map((t) => ({ id: t.id, name: t.name, marked: liveMarks.filter((m) => m.theme_id === t.id && !waits(m)).length, proposed: liveMarks.filter((m) => m.theme_id === t.id && waits(m)).length }))
    .filter((t) => t.marked + t.proposed > 0)
    .sort((a, b) => b.marked + b.proposed - (a.marked + a.proposed))
  const summaryText = summaryRows[0]?.content ?? null
  // v2.6713: the pair from either side — a document names the record it transcribes, a record names its transcript.
  const transcriptByRecord = new Map<string, string>()
  for (const d of docs) if (d.evidence_id && !transcriptByRecord.has(d.evidence_id)) transcriptByRecord.set(d.evidence_id, d.id)

  // The lists as the brief carries them, each behind the dial a fit step turns (v2.6935).
  const listed = docs.filter((d) => d.id !== notesDoc?.id)
  const documentsAt = (sectionMax: number | null, newest: number | null) =>
    (newest == null ? listed : listed.slice(0, newest)).map((d) => ({ id: d.id, title: d.title, counsel_only: d.counsel_only, kept_by: d.author_label ?? '', updated_at: d.updated_at, chars: d.chars, section_count: count(d.headings), sections: sections(d.headings, sectionMax), evidence_id: d.evidence_id ?? null }))
  const evidenceAt = (newest: number | null) =>
    (newest == null ? evidence : evidence.slice(0, newest)).map((r) => ({ id: r.id, ...exhibitBits(r), dated_on: r.dated_on, title: r.title, counsel_only: Boolean(r.counsel_only), document_id: transcriptByRecord.get(r.id) ?? null, ...amendBits('hr_evidence', r.id) }))
  const matterHeadings = headingsOf(matter?.narrative_md ?? '')
  const matterSteps = matterEntries
    .filter((e) => e.kind === 'plan' && !e.voided_at)
    .sort((a, b) => ((a.occurred_on ?? '') < (b.occurred_on ?? '') ? -1 : (a.occurred_on ?? '') > (b.occurred_on ?? '') ? 1 : 0))
    .map((e) => ({ id: e.id, on: e.occurred_on, body: firstLine(e.body ?? '', 160), done: Boolean(e.meta?.done_at) }))
  const matterDocuments = matterDocs.filter((d) => !d.voided_at).map((d) => ({ id: d.id, title: d.title, state: d.state, dated_on: d.dated_on, text: Boolean(d.mime && /^text\//.test(d.mime)), ...(d.counsel_only ? { counsel_only: true } : {}) }))
  // v2.6986: counsel-only papers come back to the seat while the switch stands open; held names only the ones that did not.
  const counselOnlyHeld = counselOnlyStillHeld(counselOnlyCount, matterDocs.filter((d) => !d.voided_at && d.counsel_only === true).length)

  // v2.7651: the manifest. A part the brief reads takes its count from the rows above, or `held` when its source is
  // named in the brief's `held`; the rest comes from the manifest's own reads and from get_person_file's tally.
  const [fileIndexRows, caseLogRows, keptPlanRows, mailRows, fileRead] = await manifestReads
  const whyHeld = (source: string): ManifestHeld | null => {
    const h = held.find((x) => x.source === source)
    return h ? { held: h.reason } : null
  }
  const isHeldRead = (v: unknown): v is ManifestHeld => !Array.isArray(v)
  const fileOk = 'refused' in fileRead ? null : fileRead
  const fileHeld: ManifestHeld = { held: 'refused' in fileRead ? fileRead.refused : 'not read' }
  const heldSources: Partial<Record<PersonTimelineSource, string>> = {}
  for (const h of fileOk?.held ?? []) heldSources[h.source] ??= h.reason
  const liveDocs = matterDocs.filter((d) => !d.voided_at)
  const planSteps = matterEntries.filter((e) => e.kind === 'plan' && !e.voided_at)
  const withoutWords: Record<string, number> = {}
  if (!isHeldRead(fileIndexRows)) for (const f of fileIndexRows) if (!f.text_source) withoutWords[f.text_why ?? 'not read yet'] = (withoutWords[f.text_why ?? 'not read yet'] ?? 0) + 1
  const recordFolders = evidence.filter((r) => r.drive_folder_id)
  const manifestInput: PersonManifestInput = {
    personId,
    agentNotes: whyHeld('documents') ?? (notesDoc ? { doc_id: notesDoc.id, chars: notesDoc.chars, updated_at: notesDoc.updated_at, entries_since: entries.filter((e) => (e.created_at ?? '') > notesDoc.updated_at).length } : null),
    summary: whyHeld('summary and narrative') ?? (summaryIndex ? { chars: summaryIndex.chars, sections: count(summaryIndex.headings), covered_through: summaryIndex.covered_through } : null),
    narrative: whyHeld('summary and narrative') ?? (narrativeIndex ? { chars: narrativeIndex.chars, sections: count(narrativeIndex.headings) } : null),
    documents: whyHeld('documents') ?? {
      count: listed.length,
      chars: listed.reduce((n, d) => n + (d.chars ?? 0), 0),
      counsel_only: listed.filter((d) => d.counsel_only).length,
      counsel_only_chars: listed.filter((d) => d.counsel_only).reduce((n, d) => n + (d.chars ?? 0), 0),
    },
    entries: whyHeld('entries') ?? { count: entries.length, first: entryDates[0] ?? null, last: entryDates[entryDates.length - 1] ?? null, from_mail: entries.filter((e) => e.gmail_message_id).length },
    evidence: whyHeld('evidence') ?? { count: evidence.length, numbered: evidence.filter((r) => exhibitNoOf(r) !== null).length, counsel_only: evidence.filter((r) => r.counsel_only).length, in_drive_folders: recordFolders.length, a_record_folder: recordFolders[0]?.drive_folder_id ?? null },
    files: fileOk ? (heldSources.file ? { held: heldSources.file } : fileOk.tally.files) : fileHeld,
    fileWords: isHeldRead(fileIndexRows) ? fileIndexRows : { indexed: fileIndexRows.length, with_words: fileIndexRows.filter((f) => f.text_source).length, without_words: withoutWords },
    timelineLines: fileOk ? fileOk.counts.bySource : fileHeld,
    heldSources,
    rows: fileOk ? fileOk.tally.rows : fileHeld,
    correctionLinks: !isDev ? { held: 'dev only' } : amendRead && !amendRead.heldWhy ? amendmentCounts(amendRead).live : { held: amendRead?.heldWhy ?? 'not read' },
    caseItems: whyHeld('case items') ?? { count: caseItems.length, open: caseItems.filter((i) => !i.closed_at).length },
    caseLog: isHeldRead(caseLogRows) ? caseLogRows : caseLogRows.length,
    standing: whyHeld('standing') ?? engagementRows.filter((e) => !e.withdrawn_at).length,
    keptPlans: isHeldRead(keptPlanRows) ? keptPlanRows : { count: keptPlanRows.length, waiting: keptPlanRows.filter((k) => k.state === 'waiting').length },
    mailConversations: isHeldRead(mailRows) ? mailRows : mailRows.filter((t) => !t.untagging_at).length,
    themes: whyHeld('themes') ?? { themes: themeRows.length, kept: liveMarks.filter((x) => !waits(x)).length, proposed: liveMarks.filter(waits).length },
    matter:
      whyHeld('matter') ??
      (matter
        ? {
            id: matter.id,
            stage: matter.stage,
            narrative_chars: (matter.narrative_md ?? '').length,
            narrative_sections: matterHeadings.length,
            steps: planSteps.length,
            steps_done: planSteps.filter((e) => Boolean(e.meta?.done_at)).length,
            events: matterEntries.filter((e) => e.kind !== 'plan' && !e.voided_at).length,
            documents: liveDocs.length,
            documents_text: liveDocs.filter((d) => Boolean(d.mime && /^text\//.test(d.mime))).length,
            documents_counsel_only: liveDocs.filter((d) => d.counsel_only === true).length,
          }
        : null),
    developments: { count: developments.length, jobs: developments.reduce((n, d) => n + d.jobs.length, 0), other_jobs: jobs.filter((j) => !j.development_id).length },
    login: Boolean(userId),
  }

  // v2.7976: the case's items and log as the brief carries them, the items behind the dial a fit step turns.
  const caseItemsHeld = whyHeld('case items') !== null
  const caseLogHeld = whyHeld('case log') !== null
  const openItemsAt = (dial: CaseItemsDial) => (caseItemsHeld ? null : briefOpenItems(caseItems, dial))
  const caseLogAt = (max: number) => (caseLogHeld ? null : briefCaseLog(caseLogNewest, isHeldRead(caseLogRows) ? null : caseLogRows.length, max))
  const openCount = caseItems.filter((i) => !i.closed_at).length

  const seen = new Set<string>()
  const heldOnce = held.filter((h) => {
    const k = `${h.source}:${h.reason}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  // The small blocks first, the long lists last: what a cut would take is the part another verb reads anyway.
  const whole = {
    person: { id: person.id, name: person.name, kind: person.kind, start_date: person.start_date, end_date: person.end_date, archived_at: person.archived_at, login: Boolean(userId) },
    read_as: { role: who.role, today: who.todayYmd },
    // v2.7651: how to read an HR file, and how to prove what was read; one constant (devMcpPersonManifest.ts).
    reading: { rules: HR_READING_RULES, receipt: HR_READING_RECEIPT },
    // v2.7651: every part of the file with its whole count and the call that opens it. Never shortened.
    manifest: buildPersonManifest(manifestInput),
    // v2.6935: null when the brief is whole; else why it was shortened and each block with what it kept and the call that reads the rest.
    shortened: null as Shortened | null,
    held: heldOnce,
    counts: { entries: entries.length, evidence: evidence.length, documents: listed.length },
    agent_notes: notesDoc
      ? { doc_id: notesDoc.id, updated_at: notesDoc.updated_at, chars: notesDoc.chars, first_lines: (notesRows[0]?.content ?? '').slice(0, AGENT_NOTES_CHARS), more: (notesRows[0]?.content.length ?? 0) > AGENT_NOTES_CHARS }
      : null,
    summary: summaryIndex
      ? { chars: summaryIndex.chars, updated_at: summaryIndex.updated_at, covered_through: summaryIndex.covered_through, kept_by: summaryIndex.author_label ?? '', section_count: count(summaryIndex.headings), sections: sections(summaryIndex.headings), text: summaryText }
      : null,
    entries: {
      count: entries.length,
      // Paged since v2.6935: true only past readAllRows' own stop, when the file holds more entries than the count says.
      at_cap: entriesCapped,
      first: entryDates[0] ?? null,
      last: entryDates[entryDates.length - 1] ?? null,
      by_source: bySource,
      newest: entries.slice(0, NEWEST_ENTRIES).map((e) => ({ id: e.id, ymd: e.entry_date, source: e.source, first_line: firstLine(wordsOf.get(e.id) ?? ''), ...amendBits('hr_entry', e.id) })),
    },
    // Punch list #315 (0.81.0): the correction links, counted, and the newest ten with both ends by row and day. An entry
    // or record above that a link touches carries standing, amended_by, amends and latest_word; null when not read.
    amendments: amendRead && !amendRead.heldWhy ? { ...amendmentCounts(amendRead), newest: newestAmendments(amendRead, (k) => amendDayOf.get(k) ?? null, NEWEST_AMENDMENTS), note: AMENDMENTS_NOTE } : null,
    // v2.7976 (punch list #315, upgrade 2): the case's open items by the number the file gave each, and its log's
    // newest lines. Null when the source could not be read, and `held` says why.
    open_items: openItemsAt(CASE_ITEMS_WHOLE),
    log: caseLogAt(BRIEF_CASE_LOG_LINES),
    // v2.8000 (punch list #315, upgrade 4c): what the person was over time, employee or subcontractor by stretch,
    // with where each fact comes from. Null when it could not be read, and `held` says why.
    engagements: whyHeld('standing') ? null : engagementsBlock(engagementRows, who.todayYmd),
    matter: matter
      ? {
          id: matter.id,
          stage: matter.stage,
          narrative: { chars: (matter.narrative_md ?? '').length, updated_at: matter.narrative_updated_at, section_count: matterHeadings.length, sections: sections(matterHeadings) },
          steps: matterSteps,
          events: matterEntries.filter((e) => e.kind !== 'plan' && !e.voided_at).length,
          documents: matterDocuments,
          // v2.6720 (punch list #288): how many of the matter's documents are for counsel alone and refused to the seat; a count, never a row.
          // v2.6986: 0 while the switch stands open, since those papers are listed above, marked counsel_only.
          counsel_only_held: counselOnlyHeld,
        }
      : null,
    themes: themeRows,
    developments,
    read_next:
      'A document whole: read_rows on documents (select content) by id (a section at a time, or its whole section index when the brief kept an outline: get_person_document, or get_matter_document for a matter\'s text document), or the narrative on person_files by kind; a development: get_history; the Timeline whole: get_person_file (brief: true for short lines); a matter document\'s bytes are on its Evidence tab. Change a document by section with plan_person_doc { doc_id | kind, ops }. A document\'s evidence_id is the record it transcribes (document_id on the record is the same pair); tie one with plan_person_doc { doc_id, evidence_id }. section_count is a text\'s whole heading count: sections holds fewer only when shortened names the block.',
    narrative: narrativeIndex ? { chars: narrativeIndex.chars, updated_at: narrativeIndex.updated_at, kept_by: narrativeIndex.author_label ?? '', section_count: count(narrativeIndex.headings), sections: sections(narrativeIndex.headings) } : null,
    evidence: evidenceAt(null),
    documents: documentsAt(null, null),
  }

  // v2.6935: the steps that shorten a brief too long for the door, mildest first (devMcpReplyFit.ts runs each only while
  // the brief is still over). The documents' section indexes go first: they are what filled the reply on a large file,
  // and get_person_document answers any one of them whole.
  type Brief = typeof whole
  let docSections: number | null = null
  let docNewest: number | null = null
  const docSectionStep = (max: number): FitStep<Brief> => (r) => {
    const over = listed.filter((d) => count(d.headings) > max).length
    if (over === 0) return null
    docSections = max
    return {
      reply: { ...r, documents: documentsAt(docSections, docNewest) },
      note: {
        block: 'documents.sections',
        kept: max > 0 ? `at most ${max} headings a document, the shallowest levels first; ${over} of ${listed.length} documents have more, and section_count is each one's whole count` : `no headings; section_count is each document's whole count`,
        read_whole: 'get_person_document { person, doc_id } answers one document\'s whole section index, and one section with section',
      },
    }
  }
  const narrativeStep = (max: number): FitStep<Brief> => (r) => {
    if (!r.narrative || count(narrativeIndex?.headings) <= max) return null
    return {
      reply: { ...r, narrative: { ...r.narrative, sections: sections(narrativeIndex?.headings, max) } },
      note: { block: 'narrative.sections', kept: `${max} of ${count(narrativeIndex?.headings)} headings, the shallowest levels first`, read_whole: 'get_person_document { person, kind: "narrative" } answers the whole section index' },
    }
  }
  const matterNarrativeStep = (max: number): FitStep<Brief> => (r) => {
    if (!r.matter || matterHeadings.length <= max) return null
    return {
      reply: { ...r, matter: { ...r.matter, narrative: { ...r.matter.narrative, sections: sections(matterHeadings, max) } } },
      note: { block: 'matter.narrative.sections', kept: `${max} of ${matterHeadings.length} headings, the shallowest levels first`, read_whole: 'read_rows on legal_matters (select narrative_md) by id' },
    }
  }
  const evidenceStep = (newest: number): FitStep<Brief> => (r) => {
    if (evidence.length <= newest) return null
    return {
      reply: { ...r, evidence: evidenceAt(newest) },
      note: { block: 'evidence', kept: `the newest ${newest} of ${evidence.length} records`, read_whole: 'get_person_file lists the records with their files; read_rows on person_file_evidence by person_id reads them a page at a time' },
    }
  }
  const documentStep = (newest: number): FitStep<Brief> => (r) => {
    if (listed.length <= newest) return null
    docNewest = newest
    return {
      reply: { ...r, documents: documentsAt(docSections, docNewest) },
      note: { block: 'documents', kept: `the ${newest} most lately changed of ${listed.length} documents`, read_whole: 'get_person_file lists every document, newest first, without its headings' },
    }
  }
  const summaryStep: FitStep<Brief> = (r) => {
    const text = r.summary?.text ?? ''
    if (!r.summary || text.length <= BRIEF_SUMMARY_CHARS) return null
    return {
      reply: { ...r, summary: { ...r.summary, text: cutText(text, BRIEF_SUMMARY_CHARS).text } },
      note: { block: 'summary.text', kept: `the first ${BRIEF_SUMMARY_CHARS} of ${text.length} characters`, read_whole: 'get_person_document { person, kind: "summary" }, a section at a time' },
    }
  }
  const matterRowsStep: FitStep<Brief> = (r) => {
    if (!r.matter || (matterSteps.length <= BRIEF_MATTER_ROWS && matterDocuments.length <= BRIEF_MATTER_ROWS)) return null
    return {
      reply: { ...r, matter: { ...r.matter, steps: matterSteps.slice(-BRIEF_MATTER_ROWS), documents: matterDocuments.slice(0, BRIEF_MATTER_ROWS) } },
      note: { block: 'matter.steps and matter.documents', kept: `the latest ${BRIEF_MATTER_ROWS} of ${matterSteps.length} steps and the newest ${BRIEF_MATTER_ROWS} of ${matterDocuments.length} documents`, read_whole: 'read_rows on legal_matter_entries (kind eq plan) and on legal_matter_documents, by matter_id' },
    }
  }
  const headlinesStep: FitStep<Brief> = (r) => {
    if (!r.developments.some((d) => d.headlines.length > 1)) return null
    return {
      reply: { ...r, developments: r.developments.map((d) => ({ ...d, headlines: d.headlines.slice(0, 1) })) },
      note: { block: 'developments.headlines', kept: 'the newest line of each development\'s History', read_whole: 'get_history { development_id }' },
    }
  }
  // v2.7976: the case's blocks. An item's detail is one read away, so it goes early; the open items themselves are the
  // working list and are cut last, after everything another verb answers whole.
  let caseDial: CaseItemsDial = CASE_ITEMS_WHOLE
  const caseDetailStep: FitStep<Brief> = (r) => {
    if (!r.open_items || !r.open_items.items.some((i) => 'detail' in i)) return null
    caseDial = { ...caseDial, detailChars: 0 }
    return {
      reply: { ...r, open_items: openItemsAt(caseDial) },
      note: { block: 'open_items.detail', kept: 'each open item without its detail; detail_more counts its characters', read_whole: 'read_rows on person_case_items (select item_no,detail), person_id eq' },
    }
  }
  const caseItemsStep = (max: number): FitStep<Brief> => (r) => {
    if (!r.open_items || openCount <= max) return null
    caseDial = { ...caseDial, openMax: max }
    return {
      reply: { ...r, open_items: openItemsAt(caseDial) },
      note: { block: 'open_items.items', kept: `the first ${max} of ${openCount} open items by number; counts is the whole case`, read_whole: 'read_rows on person_case_items, person_id eq and state eq open, order item_no' },
    }
  }
  const caseLogStep: FitStep<Brief> = (r) => {
    if (!r.log || r.log.newest.length <= BRIEF_CASE_LOG_SHORT) return null
    return {
      reply: { ...r, log: caseLogAt(BRIEF_CASE_LOG_SHORT) },
      note: { block: 'log.newest', kept: `the newest ${BRIEF_CASE_LOG_SHORT} lines; count is the whole log`, read_whole: 'read_rows on person_case_log, person_id eq, order logged_at descending' },
    }
  }
  return fitReply(whole, [
    ...BRIEF_DOC_SECTION_STEPS.map(docSectionStep),
    ...BRIEF_OUTLINE_STEPS.map(narrativeStep),
    ...BRIEF_OUTLINE_STEPS.map(matterNarrativeStep),
    caseDetailStep,
    ...BRIEF_EVIDENCE_STEPS.map(evidenceStep),
    docSectionStep(0),
    ...BRIEF_DOCUMENT_STEPS.map(documentStep),
    summaryStep,
    matterRowsStep,
    headlinesStep,
    caseLogStep,
    ...BRIEF_CASE_ITEM_STEPS.map(caseItemsStep),
  ])
}
