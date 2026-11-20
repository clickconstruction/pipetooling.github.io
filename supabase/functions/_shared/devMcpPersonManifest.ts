// The HR file's manifest and reading rules (v2.7651, server 0.97.0): what get_case_brief answers first, so that whether
// an agent saw the whole file is checked against the tool's counts and not left to the reader's care. A large file
// never crosses the door whole — get_person_file and the brief are both shortened on one — and before this no reply
// said how many of each thing the file holds in one place, or which call opens each. The manifest is small by rule (one
// line a part, never a list of rows), so no fit step touches it.
//
// The rules live here and nowhere else: one constant, returned with the manifest, changed in the PR that changes an HR
// verb. A part's count is a whole number, or null with `held` when its source could not be read.
// Pure: no env, no network. Tests: src/lib/devMcp/devMcpPersonManifest.test.ts.
import { CASE_BLOCKS_OPEN } from './devMcpCase.ts'
import type { PersonTimelineSource } from './personTimeline.ts'

/** What an agent is told when it opens an HR file, in the order it needs them. General: nothing here names a person. */
export const HR_READING_RULES: readonly string[] = [
  'Start with the manifest: it lists every part of this file with its whole count and the call that opens it. When agent_notes counts 1, read that document whole before anything else; it holds this file\'s own standing rules and map. When its entries_since is above 0 the notes are older than the file, so trust the manifest\'s counts over the notes\'.',
  'No call returns a large file whole. When a reply carries shortened, follow its read_whole line, and page get_person_file with next_until.',
  'Find, do not read through. search_case searches the entries, the evidence titles and memos, the documents, the matter and the files the index has read. It does not search papers, licenses, write-ups, hours statements, attendance or field reports: read those with get_person_file { source }.',
  'Counsel-only items are counted here and marked in every list. Open one (a record\'s files, a document\'s sections) only when the owner names that item and says to, and say in your report which you opened.',
  'A line or record marked standing: corrected is not the latest word. Read its latest_word.',
  'Reading writes nothing. A change is a plan_ verb first, then its apply_ only on the owner\'s word for that change. A plan that waits for his word is kept with keep: true and words, and list_kept_plans reads the ones that wait.',
  'The file is private. Nothing from it goes into the repository, a commit, a pull request, a card, a memory note or an outside service. Speak of its contents only to the owner, and no more than the question needs.',
]

/** How an agent proves what it saw: against the manifest's counts. */
export const HR_READING_RECEIPT =
  'End with a receipt: for each part of the manifest, how many you opened of its count, and what you did not open and why. Reading a list\'s titles is not opening its items.'

/** Each source the Timeline draws and the manifest part that counts it. A source added to the kernel must be named here. */
export const MANIFEST_PART_OF_SOURCE: Record<PersonTimelineSource, string> = {
  file: 'entries',
  evidence: 'evidence',
  report: 'field_reports',
  contract: 'papers',
  statement: 'hours_statements',
  license: 'licenses',
  writeup: 'write_ups',
  attendance: 'attendance',
  employment: 'employment',
}

/** A source that could not be read: the part's count is null and this says why. */
export type ManifestHeld = { held: string }
const isHeld = (v: unknown): v is ManifestHeld => typeof v === 'object' && v !== null && typeof (v as ManifestHeld).held === 'string'

export type PersonManifestInput = {
  personId: string
  /** The notes document so titled, and how many entries were written after it was last changed. */
  agentNotes: { doc_id: string; chars: number; updated_at: string; entries_since: number } | null | ManifestHeld
  summary: { chars: number; sections: number; covered_through: string | null } | null | ManifestHeld
  narrative: { chars: number; sections: number } | null | ManifestHeld
  /** The named documents, the notes left out. */
  documents: { count: number; chars: number; counsel_only: number; counsel_only_chars: number } | ManifestHeld
  entries: { count: number; first: string | null; last: string | null; from_mail: number } | ManifestHeld
  /** `numbered` (v2.7976): how many records the file has given an exhibit number; the rest carry no exhibit_no. */
  evidence: { count: number; numbered?: number; counsel_only: number; in_drive_folders: number; a_record_folder: string | null } | ManifestHeld
  /** get_person_file's own tally of the files on the file (person_file_attachments). */
  files: { count: number; staged: number; linked: number; before_records: number; bytes: number } | ManifestHeld
  /** The file index's rows for the person: whose words the seat can search and read. */
  fileWords: { indexed: number; with_words: number; without_words: Record<string, number> } | ManifestHeld
  /** The Timeline's lines by source, as get_person_file counts them; a source it could not read is in `heldSources`. */
  timelineLines: Partial<Record<PersonTimelineSource, number>> | ManifestHeld
  heldSources: Partial<Record<PersonTimelineSource, string>>
  /** The rows behind the Timeline's other sources. */
  rows: { papers: number; papers_signed: number; hours_statements: number; licenses: number; write_ups: number; attendance: number; field_reports: number; field_reports_waiting: number } | ManifestHeld
  correctionLinks: number | ManifestHeld
  caseItems: { count: number; open: number } | ManifestHeld
  caseLog: number | ManifestHeld
  standing: number | ManifestHeld
  keptPlans: { count: number; waiting: number } | ManifestHeld
  mailConversations: number | ManifestHeld
  themes: { themes: number; kept: number; proposed: number } | ManifestHeld
  matter: { id: string; stage: string | null; narrative_chars: number; narrative_sections: number; steps: number; steps_done: number; events: number; documents: number; documents_text: number; documents_counsel_only: number } | null | ManifestHeld
  /** The developments the person's jobs sit in, the jobs in them, and the person's jobs that sit in none. */
  developments: { count: number; jobs: number; other_jobs: number }
  login: boolean
}

export type ManifestPart = { part: string; count: number | null; open: string; held?: string } & Record<string, unknown>

const held = (part: string, why: string, open: string): ManifestPart => ({ part, count: null, held: why, open })

/**
 * The manifest: one line a part, in the order a reader takes them. Every count is the whole file's; `open` is the call
 * that reads the part on. A part whose source could not be read answers count null and `held`, never a guess.
 */
export function buildPersonManifest(m: PersonManifestInput): { note: string; parts: ManifestPart[]; text_chars: { all: number | null; counsel_only: number | null } } {
  const p = m.personId
  const parts: ManifestPart[] = []
  const lines = isHeld(m.timelineLines) ? null : m.timelineLines
  const lineBits = (source: PersonTimelineSource): Record<string, unknown> => {
    const why = m.heldSources[source]
    if (why) return { timeline_lines: null, timeline_held: why }
    return lines ? { timeline_lines: lines[source] ?? 0 } : {}
  }
  const timeline = (source: PersonTimelineSource) => `get_person_file { person: "${p}", source: "${source}" }`

  // The file's own map first.
  const notesOpen = 'get_person_document { person, doc_id, section } a section at a time; kept through plan_person_doc'
  if (isHeld(m.agentNotes)) parts.push(held('agent_notes', m.agentNotes.held, notesOpen))
  else if (m.agentNotes) parts.push({ part: 'agent_notes', count: 1, doc_id: m.agentNotes.doc_id, chars: m.agentNotes.chars, updated_at: m.agentNotes.updated_at, entries_since: m.agentNotes.entries_since, open: notesOpen })
  else parts.push({ part: 'agent_notes', count: 0, open: 'none on this file: a named document titled "Agent notes" (plan_person_doc { title }) is where a file\'s own rules and map go' })

  const summaryOpen = 'whole in this brief (summary.text); get_person_document { person, kind: "summary" }'
  if (isHeld(m.summary)) parts.push(held('summary', m.summary.held, summaryOpen))
  else parts.push(m.summary ? { part: 'summary', count: 1, chars: m.summary.chars, sections: m.summary.sections, covered_through: m.summary.covered_through, open: summaryOpen } : { part: 'summary', count: 0, open: summaryOpen })

  const narrativeOpen = 'get_person_document { person, kind: "narrative", section } a section at a time; its index is narrative.sections here'
  if (isHeld(m.narrative)) parts.push(held('narrative', m.narrative.held, narrativeOpen))
  else parts.push(m.narrative ? { part: 'narrative', count: 1, chars: m.narrative.chars, sections: m.narrative.sections, open: narrativeOpen } : { part: 'narrative', count: 0, open: narrativeOpen })

  const documentsOpen = 'listed in documents here, each with its id; get_person_document { person, doc_id, section } a section at a time; get_document_history for what moved'
  if (isHeld(m.documents)) parts.push(held('documents', m.documents.held, documentsOpen))
  else parts.push({ part: 'documents', count: m.documents.count, chars: m.documents.chars, counsel_only: m.documents.counsel_only, counsel_only_chars: m.documents.counsel_only_chars, open: documentsOpen })

  // The record: entries, evidence, files.
  const entriesOpen = `${timeline('file')} with brief: true, a stretch at a time (since, until, next_until); one whole: read_rows on person_file_entries, id eq`
  if (isHeld(m.entries)) parts.push(held('entries', m.entries.held, entriesOpen))
  else parts.push({ part: 'entries', count: m.entries.count, first: m.entries.first, last: m.entries.last, from_mail: m.entries.from_mail, ...lineBits('file'), open: entriesOpen })

  const evidenceOpen = 'listed in evidence here, each with exhibit_no (cite it as Ev #N) once the file has numbered it, which numbered counts; one whole: read_rows on person_file_evidence, id eq, and on person_file_attachments, evidence_id eq, for its files. A record tied to an entry draws on that entry\'s Timeline line, so the lines are fewer than the records'
  if (isHeld(m.evidence)) parts.push(held('evidence', m.evidence.held, evidenceOpen))
  else parts.push({ part: 'evidence', count: m.evidence.count, ...(m.evidence.numbered === undefined ? {} : { numbered: m.evidence.numbered }), counsel_only: m.evidence.counsel_only, ...lineBits('evidence'), open: evidenceOpen })

  const filesOpen = 'no verb reads a file\'s bytes. Its words, where the index read them: search_case { in: "files" } finds them, read_rows on file_index (select name,text; source_id eq the attachment\'s id) reads them. without_words counts why not: scan (a picture or a scanned PDF), kind (audio, video, a kind the reader does not read), big'
  if (isHeld(m.files)) parts.push(held('files', m.files.held, filesOpen))
  else {
    const words = isHeld(m.fileWords) ? { words_held: m.fileWords.held } : { indexed: m.fileWords.indexed, with_words: m.fileWords.with_words, without_words: m.fileWords.without_words }
    parts.push({ part: 'files', count: m.files.count, staged: m.files.staged, linked_in_drive: m.files.linked, before_records: m.files.before_records, bytes: m.files.bytes, ...words, open: filesOpen })
  }

  const driveOpen = 'read_drive_folder { file: a_record_folder } names the person\'s folder as its parent; read_drive_folder { folder } lists it. Names and sizes only'
  if (isHeld(m.evidence)) parts.push(held('drive_folder', m.evidence.held, driveOpen))
  else parts.push({ part: 'drive_folder', count: m.evidence.in_drive_folders, a_record_folder: m.evidence.a_record_folder, open: driveOpen })

  // What the app already knows happened: the Timeline's other sources, which search_case does not reach.
  const rows = isHeld(m.rows) ? null : m.rows
  const rowsHeld = isHeld(m.rows) ? m.rows.held : null
  const source = (part: string, s: PersonTimelineSource, count: number | null, extra: Record<string, unknown>, open: string) => {
    const why = m.heldSources[s] ?? rowsHeld
    if (why || count == null) parts.push(held(part, why ?? 'not read', open))
    else parts.push({ part, count, ...extra, ...lineBits(s), open })
  }
  source('papers', 'contract', rows?.papers ?? null, { signed: rows?.papers_signed ?? 0 }, `${timeline('contract')}; signed_papers there lists what they signed, each with its door`)
  source('hours_statements', 'statement', rows?.hours_statements ?? null, {}, `${timeline('statement')}; hours_statements there lists each with its standing; get_hours_statement re-runs one`)
  source('licenses', 'license', rows?.licenses ?? null, {}, timeline('license'))
  source('write_ups', 'writeup', rows?.write_ups ?? null, {}, timeline('writeup'))
  source('attendance', 'attendance', rows?.attendance ?? null, {}, timeline('attendance'))
  source('field_reports', 'report', rows?.field_reports ?? null, { waiting: rows?.field_reports_waiting ?? 0 }, `${timeline('report')}; a waiting one is filed or dismissed with plan_person_report`)
  // The start and last days come from the roster row, not from rows of their own: the count is the lines they draw.
  {
    const why = m.heldSources.employment
    if (why) parts.push(held('employment', why, timeline('employment')))
    else parts.push({ part: 'employment', count: lines ? (lines.employment ?? 0) : null, ...(lines ? {} : { held: isHeld(m.timelineLines) ? m.timelineLines.held : 'not read' }), open: `${timeline('employment')}; the start and last days on the roster row` })
  }

  // The links and lists kept beside the record.
  const linksOpen = 'amendments here counts them and lists the newest; a corrected line says standing and latest_word wherever it is read'
  parts.push(isHeld(m.correctionLinks) ? held('correction_links', m.correctionLinks.held, linksOpen) : { part: 'correction_links', count: m.correctionLinks, open: linksOpen })
  const itemsOpen = CASE_BLOCKS_OPEN
  if (isHeld(m.caseItems)) parts.push(held('case_items', m.caseItems.held, itemsOpen))
  else parts.push({ part: 'case_items', count: m.caseItems.count, open_items: m.caseItems.open, log_lines: isHeld(m.caseLog) ? null : m.caseLog, open: itemsOpen })
  const standingOpen = 'engagements here: each stretch that stands, employee or subcontractor, with where the fact comes from; plan_engagement → apply_engagement records, changes, ends or takes one off'
  parts.push(isHeld(m.standing) ? held('standing', m.standing.held, standingOpen) : { part: 'standing', count: m.standing, open: standingOpen })
  const plansOpen = 'list_kept_plans { person }: the plans an agent kept for the owner\'s yes, with their words; one whole with id. Apply a waiting one only on his yes for that plan'
  parts.push(isHeld(m.keptPlans) ? held('kept_plans', m.keptPlans.held, plansOpen) : { part: 'kept_plans', count: m.keptPlans.count, waiting: m.keptPlans.waiting, open: plansOpen })
  const mailOpen = 'read_rows on email_tag_threads, person_id eq: conversations tagged onto the file, whose mails are entries (entries.from_mail); read_mail reads one back by its Gmail id'
  parts.push(isHeld(m.mailConversations) ? held('mail', m.mailConversations.held, mailOpen) : { part: 'mail', count: m.mailConversations, open: mailOpen })
  const themesOpen = 'themes here counts the marks by theme; read_rows on legal_theme_marks, person_id eq, for each mark with its why and grade'
  parts.push(isHeld(m.themes) ? held('themes', m.themes.held, themesOpen) : { part: 'themes', count: m.themes.themes, marks_kept: m.themes.kept, marks_proposed: m.themes.proposed, open: themesOpen })

  // The matter, the jobs, the login.
  const matterOpen = 'matter here lists its narrative\'s sections, steps and documents; get_matter_document { matter_id, doc_id, section } reads a text document; read_rows on legal_matters (select narrative_md) by id reads the narrative'
  if (isHeld(m.matter)) parts.push(held('matter', m.matter.held, matterOpen))
  else if (m.matter)
    parts.push({ part: 'matter', count: 1, id: m.matter.id, stage: m.matter.stage, narrative_chars: m.matter.narrative_chars, narrative_sections: m.matter.narrative_sections, steps: m.matter.steps, steps_done: m.matter.steps_done, events: m.matter.events, documents: m.matter.documents, documents_text: m.matter.documents_text, documents_counsel_only: m.matter.documents_counsel_only, open: matterOpen })
  else parts.push({ part: 'matter', count: 0, open: 'none stands on this person' })
  parts.push({ part: 'developments', count: m.developments.count, jobs: m.developments.jobs, other_jobs: m.developments.other_jobs, open: 'developments here lists them; get_history { development_id } reads one\'s History. The jobs\' own facts are the development\'s, not this file\'s' })
  parts.push({ part: 'login', count: m.login ? 1 : 0, open: 'get_login_state { person }: the account, its role, when it last signed in' })

  const docs = isHeld(m.documents) ? null : m.documents
  const text = (v: { chars: number } | null | ManifestHeld): number | null => (isHeld(v) ? null : (v?.chars ?? 0))
  const pieces = [text(m.agentNotes), text(m.summary), text(m.narrative), docs ? docs.chars : null, isHeld(m.matter) ? null : (m.matter?.narrative_chars ?? 0)]
  return {
    note: 'Every part of this file with its whole count and the call that opens it. A count is exact; null with held means the part could not be read, never that it is empty. text_chars is the text of the notes, the summary, the narrative, the named documents and the matter\'s narrative together: more than one reply, and often more than one session, can carry.',
    parts,
    text_chars: { all: pieces.some((n) => n == null) ? null : pieces.reduce<number>((a, b) => a + (b ?? 0), 0), counsel_only: docs ? docs.counsel_only_chars : null },
  }
}
