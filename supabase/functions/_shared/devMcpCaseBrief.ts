// get_case_brief (v2.6619, punch list #278 PR 1): one page that says what is where on a person's case — the brief an
// agent reads before anything else, the way it reads a folder's README. Composed from the reads the seat already makes,
// each as the dev under RLS and fail-soft (a source that cannot be read is named in `held` and the rest still draws),
// over the injected Reader (devMcpComposites.ts), so the kernel is tested over a fake reader. The text never crosses
// the door whole: the section indexes come from person_file_index / person_document_index (20261107060000), the summary
// is a page by rule, and the agent's own notes come back as their first lines. Dev-only, like the HR file: another
// role gets the person and `held: dev only` for every source.
import type { Reader, Row } from './devMcpComposites.ts'
import { resolvePerson } from './devMcpPersonFile.ts'

export type CaseBriefAsk = { person: string }
export type CaseBriefReader = { role: string; todayYmd: string }

/** The title the agent's own notes document carries, by convention; the brief returns it first. */
export const AGENT_NOTES_TITLE = 'Agent notes'
/** How much of the notes the brief carries; the rest is a section read away. */
export const AGENT_NOTES_CHARS = 1200
const NEWEST_ENTRIES = 10
const HEADLINES = 5
const READ_CAP = 200

type Heading = { n: number | null; level: number; heading: string; line: number }
type EntryRow = { id: string; entry_date: string; content: string; source: string }
type EvidenceRow = { id: string; dated_on: string; title: string; counsel_only: boolean | null }
type FileIndexRow = { kind: string; chars: number; sections: number; headings: Heading[] | null; updated_at: string; covered_through: string | null; author_label: string | null }
type DocIndexRow = { id: string; title: string; counsel_only: boolean; author_label: string | null; updated_at: string; archived_at: string | null; chars: number; sections: number; headings: Heading[] | null }
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

const sections = (h: Heading[] | null | undefined) => (h ?? []).map((x) => ({ n: x.n, heading: x.heading, line: x.line }))

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

  const [entries, evidence, fileIndex, docIndex, matters, marks, themes] = await Promise.all([
    read<EntryRow>('entries', () => reader.rows('person_file_entries', { select: 'id,entry_date,content,source', filters: eq('person_id', personId), order: [{ column: 'entry_date', ascending: false }], limit: READ_CAP })),
    read<EvidenceRow>('evidence', () => reader.rows('person_file_evidence', { select: 'id,dated_on,title,counsel_only', filters: eq('person_id', personId), order: [{ column: 'dated_on', ascending: false }], limit: READ_CAP })),
    read<FileIndexRow>('summary and narrative', () => reader.rows('person_file_index', { select: 'kind,chars,sections,headings,updated_at,covered_through,author_label', filters: eq('person_id', personId), limit: 4 })),
    read<DocIndexRow>('documents', () => reader.rows('person_document_index', { select: 'id,title,counsel_only,author_label,updated_at,archived_at,chars,sections,headings', filters: eq('person_id', personId), limit: READ_CAP })),
    read<MatterRow>('matter', () => reader.rows('legal_matters', { select: 'id,stage,narrative_md,narrative_updated_at,closed_at', filters: eq('person_id', personId), limit: 2 })),
    read<MarkRow>('themes', () => reader.rows('legal_theme_marks', { select: 'theme_id,proposed,removed_at', filters: eq('person_id', personId), limit: 1000 })),
    read<ThemeRow>('themes', () => reader.rows('legal_themes', { select: 'id,name', filters: [{ column: 'retired_at', op: 'is', value: null }], limit: READ_CAP })),
  ])

  // The summary whole (a page by rule), the agent's notes' first lines: two small reads after the indexes.
  const summaryIndex = fileIndex.find((f) => f.kind === 'summary') ?? null
  const narrativeIndex = fileIndex.find((f) => f.kind === 'narrative') ?? null
  const summaryRows = summaryIndex ? await read<{ content: string }>('summary', () => reader.rows('person_files', { select: 'content', filters: [...eq('person_id', personId), ...eq('kind', 'summary')], limit: 1 })) : []
  const docs = docIndex.filter((d) => !d.archived_at).sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
  const notesDoc = docs.find((d) => d.title.trim().toLowerCase() === AGENT_NOTES_TITLE.toLowerCase()) ?? null
  const notesRows = notesDoc ? await read<{ content: string }>('agent notes', () => reader.rows('person_documents', { select: 'content', filters: eq('id', notesDoc.id), limit: 1 })) : []

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

  return {
    person: { id: person.id, name: person.name, kind: person.kind, start_date: person.start_date, end_date: person.end_date, archived_at: person.archived_at, login: Boolean(userId) },
    read_as: { role: who.role, today: who.todayYmd },
    agent_notes: notesDoc
      ? { doc_id: notesDoc.id, updated_at: notesDoc.updated_at, chars: notesDoc.chars, first_lines: (notesRows[0]?.content ?? '').slice(0, AGENT_NOTES_CHARS), more: (notesRows[0]?.content.length ?? 0) > AGENT_NOTES_CHARS }
      : null,
    summary: summaryIndex
      ? { chars: summaryIndex.chars, updated_at: summaryIndex.updated_at, covered_through: summaryIndex.covered_through, kept_by: summaryIndex.author_label ?? '', sections: sections(summaryIndex.headings), text: summaryText }
      : null,
    narrative: narrativeIndex ? { chars: narrativeIndex.chars, updated_at: narrativeIndex.updated_at, kept_by: narrativeIndex.author_label ?? '', sections: sections(narrativeIndex.headings) } : null,
    documents: docs.filter((d) => d.id !== notesDoc?.id).map((d) => ({ id: d.id, title: d.title, counsel_only: d.counsel_only, kept_by: d.author_label ?? '', updated_at: d.updated_at, chars: d.chars, sections: sections(d.headings) })),
    entries: {
      count: entries.length,
      at_cap: entries.length >= READ_CAP,
      first: entryDates[0] ?? null,
      last: entryDates[entryDates.length - 1] ?? null,
      by_source: bySource,
      newest: entries.slice(0, NEWEST_ENTRIES).map((e) => ({ id: e.id, ymd: e.entry_date, source: e.source, first_line: firstLine(e.content) })),
    },
    evidence: evidence.map((r) => ({ id: r.id, dated_on: r.dated_on, title: r.title, counsel_only: Boolean(r.counsel_only) })),
    matter: matter
      ? {
          id: matter.id,
          stage: matter.stage,
          narrative: { chars: (matter.narrative_md ?? '').length, updated_at: matter.narrative_updated_at, sections: sections(headingsOf(matter.narrative_md ?? '')) },
          steps: matterEntries
            .filter((e) => e.kind === 'plan' && !e.voided_at)
            .sort((a, b) => ((a.occurred_on ?? '') < (b.occurred_on ?? '') ? -1 : (a.occurred_on ?? '') > (b.occurred_on ?? '') ? 1 : 0))
            .map((e) => ({ id: e.id, on: e.occurred_on, body: firstLine(e.body ?? '', 160), done: Boolean(e.meta?.done_at) })),
          events: matterEntries.filter((e) => e.kind !== 'plan' && !e.voided_at).length,
          documents: matterDocs.filter((d) => !d.voided_at).map((d) => ({ id: d.id, title: d.title, state: d.state, dated_on: d.dated_on, text: Boolean(d.mime && /^text\//.test(d.mime)) })),
          // v2.6720 (punch list #288): how many of the matter's documents are for counsel alone and refused to the seat; a count, never a row.
          counsel_only_held: counselOnlyHeld,
        }
      : null,
    themes: themeRows,
    developments,
    held: heldOnce,
    read_next:
      'A document whole: read_rows on person_documents (select content) by id, or the narrative on person_files by kind; a development: get_history; the Timeline whole: get_person_file; a matter document\'s bytes are on its Evidence tab. Change a document by section with plan_person_doc { doc_id | kind, ops }.',
  }
}
