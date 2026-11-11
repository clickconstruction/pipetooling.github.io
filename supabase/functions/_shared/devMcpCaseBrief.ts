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
import { readAllRows, type Reader, type Row } from './devMcpComposites.ts'
import { resolvePerson } from './devMcpPersonFile.ts'
import { cutText, fitReply, outlineHeadings, type FitStep, type Shortened } from './devMcpReplyFit.ts'

export type CaseBriefAsk = { person: string }
export type CaseBriefReader = { role: string; todayYmd: string }

/** The title the agent's own notes document carries, by convention; the brief returns it first. */
export const AGENT_NOTES_TITLE = 'Agent notes'
/** How much of the notes the brief carries; the rest is a section read away. */
export const AGENT_NOTES_CHARS = 1200
const NEWEST_ENTRIES = 10
const HEADLINES = 5
const READ_CAP = 200
/** The fit's steps (v2.6935), mildest first: how many headings a document keeps, then the lists' newest rows. */
export const BRIEF_DOC_SECTION_STEPS = [40, 24, 16, 12, 8, 5, 3] as const
const BRIEF_OUTLINE_STEPS = [60, 30, 15] as const
const BRIEF_EVIDENCE_STEPS = [100, 50, 25] as const
const BRIEF_DOCUMENT_STEPS = [60, 30, 15] as const
const BRIEF_MATTER_ROWS = 40
const BRIEF_SUMMARY_CHARS = 6000

type Heading = { n: number | null; level: number; heading: string; line: number }
type EntryRow = { id: string; entry_date: string; source: string; created_at?: string | null }
type EvidenceRow = { id: string; dated_on: string; title: string; counsel_only: boolean | null }
type FileIndexRow = { kind: string; chars: number; sections: number; headings: Heading[] | null; updated_at: string; covered_through: string | null; author_label: string | null }
type DocIndexRow = { id: string; title: string; counsel_only: boolean; author_label: string | null; updated_at: string; archived_at: string | null; chars: number; sections: number; headings: Heading[] | null; evidence_id?: string | null }
type MatterRow = { id: string; stage: string | null; narrative_md: string | null; narrative_updated_at: string | null; closed_at: string | null }
type MatterEntryRow = { id: string; kind: string; occurred_on: string | null; body: string | null; meta: { done_at?: string | null } | null; voided_at: string | null }
type MatterDocRow = { id: string; title: string; state: string | null; dated_on: string | null; voided_at: string | null; mime: string | null }
type MarkRow = { theme_id: string; proposed: boolean | null; removed_at: string | null }
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

  // v2.6935: every entry, a page at a time, without its words — the count is exact past the door's 200 rows a read.
  let entriesCapped = false
  const [entryRows, evidence, fileIndex, docIndex, matters, marks, themes] = await Promise.all([
    read<EntryRow>('entries', async () => {
      const all = await readAllRows(reader, 'person_file_entries', { select: 'id,entry_date,source,created_at', filters: eq('person_id', personId) })
      entriesCapped = all.capped
      return all.rows
    }),
    read<EvidenceRow>('evidence', () => reader.rows('person_file_evidence', { select: 'id,dated_on,title,counsel_only', filters: eq('person_id', personId), order: [{ column: 'dated_on', ascending: false }], limit: READ_CAP })),
    read<FileIndexRow>('summary and narrative', () => reader.rows('person_file_index', { select: 'kind,chars,sections,headings,updated_at,covered_through,author_label', filters: eq('person_id', personId), limit: 4 })),
    // v2.6713 (punch list #287): evidence_id, the record a document transcribes; read without it when the catalog does not know the column yet.
    read<DocIndexRow>('documents', async () => {
      try {
        return await reader.rows('person_document_index', { select: 'id,title,counsel_only,author_label,updated_at,archived_at,chars,sections,headings,evidence_id', filters: eq('person_id', personId), limit: READ_CAP })
      } catch {
        return await reader.rows('person_document_index', { select: 'id,title,counsel_only,author_label,updated_at,archived_at,chars,sections,headings', filters: eq('person_id', personId), limit: READ_CAP })
      }
    }),
    read<MatterRow>('matter', () => reader.rows('legal_matters', { select: 'id,stage,narrative_md,narrative_updated_at,closed_at', filters: eq('person_id', personId), limit: 2 })),
    read<MarkRow>('themes', () => reader.rows('legal_theme_marks', { select: 'theme_id,proposed,removed_at', filters: eq('person_id', personId), limit: 1000 })),
    read<ThemeRow>('themes', () => reader.rows('legal_themes', { select: 'id,name', filters: [{ column: 'retired_at', op: 'is', value: null }], limit: READ_CAP })),
  ])

  // Newest first, as the Timeline orders them: the day, then when it was written. The newest ten's words are one more read.
  const entries = [...entryRows].sort((a, b) => (a.entry_date !== b.entry_date ? (a.entry_date < b.entry_date ? 1 : -1) : (a.created_at ?? '') !== (b.created_at ?? '') ? ((a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const newestIds = entries.slice(0, NEWEST_ENTRIES).map((e) => e.id)
  const newestRows = newestIds.length ? await read<{ id: string; content: string }>('entries', () => reader.rows('person_file_entries', { select: 'id,content', filters: [{ column: 'id', op: 'in', value: newestIds }], limit: NEWEST_ENTRIES })) : []
  const wordsOf = new Map(newestRows.map((r) => [r.id, r.content]))

  // The summary whole (a page by rule), the agent's notes' first lines: two small reads after the indexes.
  const summaryIndex = fileIndex.find((f) => f.kind === 'summary') ?? null
  const narrativeIndex = fileIndex.find((f) => f.kind === 'narrative') ?? null
  const summaryRows = summaryIndex ? await read<{ content: string }>('summary', () => reader.rows('person_files', { select: 'content', filters: [...eq('person_id', personId), ...eq('kind', 'summary')], limit: 1 })) : []
  const docs = docIndex.filter((d) => !d.archived_at).sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
  const notesDoc = docs.find((d) => d.title.trim().toLowerCase() === AGENT_NOTES_TITLE.toLowerCase()) ?? null
  const notesRows = notesDoc ? await read<{ content: string }>('agent notes', () => reader.rows('documents', { select: 'content', filters: eq('id', notesDoc.id), limit: 1 })) : []

  // The matter: its steps and documents, when one stands on the person.
  const matter = matters.find((m) => !m.closed_at) ?? matters[0] ?? null
  const counselOnlyHeld = matter ? await reader.rpc('matter_counsel_only_count', { p_matter_id: matter.id }).then((n) => (typeof n === 'number' ? n : 0)).catch(() => 0) : 0
  const [matterEntries, matterDocs] = matter
    ? await Promise.all([
        read<MatterEntryRow>('matter steps', () => reader.rows('legal_matter_entries', { select: 'id,kind,occurred_on,body,meta,voided_at', filters: eq('matter_id', matter.id), order: [{ column: 'occurred_on', ascending: true }], limit: READ_CAP })),
        read<MatterDocRow>('matter documents', () => reader.rows('legal_matter_documents', { select: 'id,title,state,dated_on,voided_at,mime', filters: eq('matter_id', matter.id), order: [{ column: 'dated_on', ascending: false }], limit: READ_CAP })),
      ])
    : [[], []]

  // The developments the person's jobs sit in: the team table and the schedule by the login, then each History's newest lines.
  const userId = person.account_user_id
  const [teamRows, blockRows] = userId
    ? await Promise.all([
        read<{ job_id: string }>('developments', () => reader.rows('jobs_ledger_team_members', { select: 'job_id', filters: eq('user_id', userId), limit: READ_CAP })),
        read<{ job_id: string }>('developments', () => reader.rows('job_schedule_blocks', { select: 'job_id', filters: eq('assignee_user_id', userId), limit: READ_CAP })),
      ])
    : [[], []]
  const jobIds = [...new Set([...teamRows, ...blockRows].map((r) => r.job_id).filter(Boolean))]
  const jobs = jobIds.length
    ? await read<{ id: string; job_name: string | null; development_id: string | null }>('developments', () => reader.rows('jobs_ledger', { select: 'id,job_name,development_id', filters: [{ column: 'id', op: 'in', value: jobIds }], limit: READ_CAP }))
    : []
  const developmentIds = [...new Set(jobs.map((j) => j.development_id).filter((d): d is string => Boolean(d)))]
  const developmentRows = developmentIds.length
    ? await read<{ id: string; name: string }>('developments', () => reader.rows('developments', { select: 'id,name', filters: [{ column: 'id', op: 'in', value: developmentIds }], limit: READ_CAP }))
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
  const themeRows = themes
    .map((t) => ({ id: t.id, name: t.name, marked: liveMarks.filter((m) => m.theme_id === t.id && !m.proposed).length, proposed: liveMarks.filter((m) => m.theme_id === t.id && m.proposed).length }))
    .filter((t) => t.marked + t.proposed > 0)
    .sort((a, b) => b.marked + b.proposed - (a.marked + a.proposed))
  const seen = new Set<string>()
  const heldOnce = held.filter((h) => {
    const k = `${h.source}:${h.reason}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const summaryText = summaryRows[0]?.content ?? null
  // v2.6713: the pair from either side — a document names the record it transcribes, a record names its transcript.
  const transcriptByRecord = new Map<string, string>()
  for (const d of docs) if (d.evidence_id && !transcriptByRecord.has(d.evidence_id)) transcriptByRecord.set(d.evidence_id, d.id)

  // The lists as the brief carries them, each behind the dial a fit step turns (v2.6935).
  const listed = docs.filter((d) => d.id !== notesDoc?.id)
  const documentsAt = (sectionMax: number | null, newest: number | null) =>
    (newest == null ? listed : listed.slice(0, newest)).map((d) => ({ id: d.id, title: d.title, counsel_only: d.counsel_only, kept_by: d.author_label ?? '', updated_at: d.updated_at, chars: d.chars, section_count: count(d.headings), sections: sections(d.headings, sectionMax), evidence_id: d.evidence_id ?? null }))
  const evidenceAt = (newest: number | null) =>
    (newest == null ? evidence : evidence.slice(0, newest)).map((r) => ({ id: r.id, dated_on: r.dated_on, title: r.title, counsel_only: Boolean(r.counsel_only), document_id: transcriptByRecord.get(r.id) ?? null }))
  const matterHeadings = headingsOf(matter?.narrative_md ?? '')
  const matterSteps = matterEntries
    .filter((e) => e.kind === 'plan' && !e.voided_at)
    .sort((a, b) => ((a.occurred_on ?? '') < (b.occurred_on ?? '') ? -1 : (a.occurred_on ?? '') > (b.occurred_on ?? '') ? 1 : 0))
    .map((e) => ({ id: e.id, on: e.occurred_on, body: firstLine(e.body ?? '', 160), done: Boolean(e.meta?.done_at) }))
  const matterDocuments = matterDocs.filter((d) => !d.voided_at).map((d) => ({ id: d.id, title: d.title, state: d.state, dated_on: d.dated_on, text: Boolean(d.mime && /^text\//.test(d.mime)) }))

  // The small blocks first, the long lists last: what a cut would take is the part another verb reads anyway.
  const whole = {
    person: { id: person.id, name: person.name, kind: person.kind, start_date: person.start_date, end_date: person.end_date, archived_at: person.archived_at, login: Boolean(userId) },
    read_as: { role: who.role, today: who.todayYmd },
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
      newest: entries.slice(0, NEWEST_ENTRIES).map((e) => ({ id: e.id, ymd: e.entry_date, source: e.source, first_line: firstLine(wordsOf.get(e.id) ?? '') })),
    },
    matter: matter
      ? {
          id: matter.id,
          stage: matter.stage,
          narrative: { chars: (matter.narrative_md ?? '').length, updated_at: matter.narrative_updated_at, section_count: matterHeadings.length, sections: sections(matterHeadings) },
          steps: matterSteps,
          events: matterEntries.filter((e) => e.kind !== 'plan' && !e.voided_at).length,
          documents: matterDocuments,
          // v2.6720 (punch list #288): how many of the matter's documents are for counsel alone and refused to the seat; a count, never a row.
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
  return fitReply(whole, [
    ...BRIEF_DOC_SECTION_STEPS.map(docSectionStep),
    ...BRIEF_OUTLINE_STEPS.map(narrativeStep),
    ...BRIEF_OUTLINE_STEPS.map(matterNarrativeStep),
    ...BRIEF_EVIDENCE_STEPS.map(evidenceStep),
    docSectionStep(0),
    ...BRIEF_DOCUMENT_STEPS.map(documentStep),
    summaryStep,
    matterRowsStep,
    headlinesStep,
  ])
}
