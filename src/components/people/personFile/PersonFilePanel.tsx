import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { openOrSaveFromStorage } from '../../../lib/storageSave'
import { useAuth } from '../../../hooks/useAuth'
import { useToastContext } from '../../../contexts/ToastContext'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../../utils/dateUtils'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { derivePersonFileFreshness } from '../../../lib/people/personFileFreshness'
import { hrDocMarkdownToSafeHtml, extractHrDocHeadings } from '../../../lib/people/hrDocMarkdown'
import { hrDocDraftWords, hrDocSaveFailureWords, hrDocSavePayload, type HrDocTarget } from '../../../lib/people/hrDocEditor'
import { checkDocumentFile, cleanDocumentTitle, documentKeptByWords, documentSizeWords, documentsByEvidenceId, documentsTabCount, recordPickWords, tieToRecordProblem, transcribedRecordWords, type PersonDocumentIndexRow, type PersonDocumentRow } from '../../../lib/people/personDocuments'
import { loadPersonDocument, loadPersonDocuments, savePersonDocument, tieDocumentToEvidence } from '../../../lib/people/personDocumentsIo'
import { citationsBySection, parseSectionCitations, citedByWords, citedCorrectedWords, headingNumber, sectionByNumber, splitByDoors } from '../../../lib/people/hrDocCitations'
import { amendmentCountWords, amendmentEnds, amendmentIndex, amendmentKey, amendmentKindOfTable, amendmentTargetsProblem, amendmentThingWord, correctedKeys, type AmendmentHow, type AmendmentTarget, type PersonAmendmentRow } from '../../../lib/people/personAmendments'
import { addAmendments, loadPersonAmendments, withdrawAmendment } from '../../../lib/people/personAmendmentsIo'
import { caseItemCounts, exhibitBackfillWords, exhibitBesideTitle, exhibitLabel, exhibitNoFromTitle, type ExhibitBackfillReport, type PersonCaseItem, type PersonCaseLogLine } from '../../../lib/people/personCase'
import { loadExhibitNumbers, loadPersonCase, runExhibitBackfill } from '../../../lib/people/personCaseIo'
import { PersonCaseView } from './PersonCaseView'
import { sectionChangedWords, sectionFreshness, sectionFreshnessHeadWords, sectionNeedsALook, sectionNewerWords, type DocRevision } from '../../../lib/people/sectionFreshness'
import { loadDocRevisions } from '../../../lib/people/sectionFreshnessIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'
import {
  buildPersonTimeline,
  countPersonTimeline,
  filterPersonTimeline,
  groupPersonTimelineByMonth,
  PERSON_TIMELINE_LANES,
  PERSON_TIMELINE_SOURCES,
  personFileFactChips,
  personFileFacts,
  personTimelineEmptyWords,
  splitPersonTimeline,
  type PersonTimelineLane,
  type PersonTimelineLine,
  type PersonTimelineSource,
} from '../../../lib/people/personTimeline'
import { loadPersonFileSources, type PersonFileAttachment, type PersonFileDoc, type PersonFileSources, type PersonFileViewer } from '../../../lib/people/personTimelineIo'
import { PersonMatterPanel } from './PersonMatterPanel'
import { personMatterChipWords } from '../../../lib/people/personMatter'
import { loadPersonMatterStanding, type PersonMatterStanding } from '../../../lib/people/personMatterIo'
import {
  evidenceCountWords,
  evidenceDraftProblem,
  evidenceDrivePathWords,
  evidenceDriveState,
  evidenceDriveWords,
  evidenceKindWords,
  evidenceSizeWords,
  evidenceTitleFromName,
  evidenceFileWhereWords,
  evidenceHashWords,
  evidenceLinkProblem,
  type PersonEvidenceLink,
  sortEvidenceNewestFirst,
  type PersonEvidenceDraft,
  type PersonEvidenceFile,
  type PersonEvidenceRecord,
} from '../../../lib/people/personEvidence'
import { fileEvidenceToDrive, savePersonEvidence } from '../../../lib/people/personEvidenceIo'
import { shrinkPhoto } from '../../../lib/materials/photoShrink'
import { EmptyState } from '../../EmptyState'
import { EMPTY_MARK_DRAFT, linesWithTheme, markIsProposed, markTargetOfLine, markedWords, marksOnTarget, provesByWords, sortThemes, themeCountsOnLines, themeStands, tickedWords, type LegalTheme, type LegalThemeMark, type MarkDraft, type MarkTarget } from '../../../lib/legal/legalThemes'
import { addMarks, keepMark, loadThemes, removeMark } from '../../../lib/legal/legalThemesIo'
import { ThemeMarkPicker } from '../../legal/ThemeMarkPicker'
import { PersonThemesView } from './PersonThemesView'
import { countedLabel } from '../../../lib/batchWords'

/**
 * The person file (design spike, 2026-11-02): one person's Timeline, Evidence and Narrative,
 * drawn the way the Legal desk draws a matter. The Timeline is the HR file's hand-written entries
 * merged with what the app already knows happened to or about the person (`personTimeline.ts`);
 * Evidence is the files on the person, each on the entry it belongs to when it has one; the
 * Narrative is the agent's summary and story, read-only here. The composer is the only write a
 * person makes here, and it appends — the HR tables have no update or delete.
 *
 * Every source is read under the viewer's own RLS by `personTimelineIo.ts`; a source the role may
 * not open is named under the strip, never guessed at.
 */

export const HR_ENTRY_SOURCES = ['conversation', 'payroll_event', 'incident', 'review', 'milestone', 'job_event', 'report'] as const

const SOURCE_LABELS: Record<string, string> = {
  conversation: 'Conversation',
  payroll_event: 'Payroll event',
  incident: 'Incident',
  review: 'Review',
  milestone: 'Milestone',
  job_event: 'Job event',
  report: 'Field report',
}

const HR_FILES_BUCKET = 'hr-files'
const PEOPLE_FOLDER_WORDS = 'People'

export type PersonFileView = 'timeline' | 'evidence' | 'narrative' | 'case' | 'themes' | 'matter'

type LaneLook = { background: string; color: string; border?: string }

/** The kind chip's colours by lane, then by state where a state says more than the lane. */
function lineLook(line: PersonTimelineLine): LaneLook {
  switch (line.state) {
    case 'unreviewed':
    case 'owed':
    case 'waiting':
      return { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
    case 'dismissed':
    case 'draft':
      return { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
    case 'expired':
      return { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }
    case 'ahead':
      return { background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)' }
    default:
      break
  }
  switch (line.lane) {
    case 'said':
      return { background: 'var(--bg-slate-100)', color: 'var(--text-slate-600)' }
    case 'did':
      return { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }
    case 'paper':
      return { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
    case 'missed':
      return { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }
    default:
      return { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
  }
}

const FACT_TONE: Record<'gray' | 'green' | 'amber' | 'red', LaneLook> = {
  gray: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
}

const chip = (look: LaneLook, extra?: CSSProperties): CSSProperties => ({
  display: 'inline-block',
  padding: '0.1rem 0.55rem',
  borderRadius: 999,
  fontSize: '0.72rem',
  fontWeight: 600,
  background: look.background,
  color: look.color,
  border: look.border ?? '1px solid transparent',
  whiteSpace: 'nowrap',
  ...extra,
})

const filterChip = (on: boolean): CSSProperties => ({
  padding: '0.25rem 0.65rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-700)' : 'var(--text-600)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

const viewTab = (on: boolean): CSSProperties => ({
  padding: '0.45rem 0.9rem 0.55rem',
  fontSize: '0.86rem',
  color: on ? 'var(--text-link)' : 'var(--text-muted)',
  fontWeight: on ? 600 : 400,
  background: 'none',
  border: 'none',
  borderBottom: on ? '2px solid var(--text-link)' : '2px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.9rem' }

function formatBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}


const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-11-02` → *Nov 2*; the year is the month group's job. */
function dayWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS_SHORT[Number(m[2]) - 1]} ${Number(m[3])}`
}

/** `2027-02-19` → *Feb 19, 2027*: the Ahead group has no month heading to carry the year. */
function dayWordsWithYear(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS_SHORT[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}

function formatIsoDate(iso: string | null): string {
  if (!iso) return ''
  const ymd = calendarYmdInAppTzFromIso(iso)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS_SHORT[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}

/**
 * The sanitizer strips id attributes, so headings in the rendered HTML carry none. Add an id to
 * each successive heading tag from the extracted heading slugs so the jump-list anchors resolve.
 */
function injectHeadingIds(html: string, headings: Array<{ slug: string }>): string {
  let i = 0
  return html.replace(/<(h[1-6])>/g, (match, tag) => {
    const h = headings[i++]
    return h ? `<${tag} id="${h.slug}">` : match
  })
}

export type PersonFilePanelProps = {
  personId: string | null
  userId: string | null
  personName: string
  viewer: PersonFileViewer
  /** The theme the address names for the By theme view (`?theme=<id>`), and the press that writes a pick into it. */
  initialThemeId?: string | null
  onThemePicked?: (themeId: string) => void
  /** Bump to read the file again (a report filed from the queue above, say). */
  changeKey?: number
  /** Called after this panel writes (an entry, an exhibit), so the host can refresh its own counts. */
  onChanged?: () => void
  initialView?: PersonFileView
  /** Set when the host wants a particular view (the queue's Open their file lands on the timeline). */
  viewKey?: number
}

export function PersonFilePanel({ personId, userId, personName, viewer, changeKey = 0, onChanged, initialView = 'timeline', viewKey = 0, initialThemeId = null, onThemePicked }: PersonFilePanelProps) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const todayYmd = todayYmdInAppTz()

  const [sources, setSources] = useState<PersonFileSources | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<PersonFileView>(initialView)
  const [lane, setLane] = useState<PersonTimelineLane | null>(null)
  const [source, setSource] = useState<PersonTimelineSource | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftDate, setDraftDate] = useState(todayYmd)
  const [draftSource, setDraftSource] = useState<string>('conversation')
  const [draftContent, setDraftContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [savingEntry, setSavingEntry] = useState(false)
  /** Punch list #315: the links that say which entry or record corrects or completes which, the composer's picks, and a link being withdrawn. */
  const [amendRows, setAmendRows] = useState<PersonAmendmentRow[]>([])
  const [draftTargets, setDraftTargets] = useState<AmendmentTarget[]>([])
  const [withdrawingLinkId, setWithdrawingLinkId] = useState<string | null>(null)
  const [withdrawWhy, setWithdrawWhy] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  /** Punch list #315, upgrade 2: the number each evidence record goes by, the records with none yet, and the case's items and log. */
  const [exhibitNoById, setExhibitNoById] = useState<Map<string, number>>(new Map())
  const [unnumbered, setUnnumbered] = useState(0)
  const [caseItems, setCaseItems] = useState<PersonCaseItem[]>([])
  const [caseLog, setCaseLog] = useState<PersonCaseLogLine[]>([])
  const [caseHeld, setCaseHeld] = useState<string | null>(null)
  /** The numbering of old records: the dry run's report once asked for, whether titles with no number are numbered too, and a run in flight. */
  const [numbering, setNumbering] = useState<{ report: ExhibitBackfillReport; rest: boolean } | null>(null)
  const [numberingBusy, setNumberingBusy] = useState(false)
  /** A field report being filed or dismissed from its own line, and the dismissal's reason. */
  const [reportBusyId, setReportBusyId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [dismissReason, setDismissReason] = useState('')
  /** The Add evidence window: the day it is about, a title, a memo, the files picked so far. */
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [evDraft, setEvDraft] = useState<PersonEvidenceDraft>({ datedOn: todayYmd, title: '', memo: '' })
  const [evFiles, setEvFiles] = useState<File[]>([])
  // Files already in Drive, linked rather than staged (v2.6541): a recording over the cap, a file filed by hand.
  const [evLinks, setEvLinks] = useState<PersonEvidenceLink[]>([])
  const [evLinkDraft, setEvLinkDraft] = useState<PersonEvidenceLink>({ name: '', driveUrl: '' })
  const [evSaving, setEvSaving] = useState(false)
  const [evShrinking, setEvShrinking] = useState(false)
  const [evTried, setEvTried] = useState(false)
  const [evRetryId, setEvRetryId] = useState<string | null>(null)
  /** v2.6554: the Evidence tab's filter, All or Counsel-only. */
  const [evFilter, setEvFilter] = useState<'all' | 'counsel'>('all')
  const hrDocRef = useRef<HTMLDivElement>(null)
  // v2.6609: the summary or the narrative under edit — the draft, the text it started from, and the updated_at loaded,
  // which the save quotes so a version kept since (the seat's apply_person_doc, another dev) refuses it.
  const [docEdit, setDocEdit] = useState<{ kind: HrDocTarget; docId?: string; title?: string; draft: string; original: string; loadedUpdatedAt: string | null } | null>(null)
  const [docSaving, setDocSaving] = useState(false)
  // v2.6614 (punch list #277): the named documents — the list, the one open, and the Add a document form.
  const [documents, setDocuments] = useState<PersonDocumentIndexRow[]>([])
  const [documentsHeld, setDocumentsHeld] = useState<string | null>(null)
  const [openDoc, setOpenDoc] = useState<PersonDocumentRow | null>(null)
  const [addDoc, setAddDoc] = useState<{ how: 'write' | 'file' | 'paste'; title: string; text: string; counselOnly: boolean; fileName: string | null; why: string | null; saving: boolean } | null>(null)
  const namedDocRef = useRef<HTMLDivElement>(null)
  // v2.6713 (punch list #287): the picker over the person's records open on a document's header, and its save.
  const [tiePicking, setTiePicking] = useState(false)
  const [tieSaving, setTieSaving] = useState(false)
  // v2.6615 (punch list #277 PR 3): a citation pressed on a line asks for a section of the narrative; the Jump to list
  // opens the entries that cite a section.
  const [pendingSection, setPendingSection] = useState<number | null>(null)
  const [citedOpen, setCitedOpen] = useState<number | null>(null)
  /** Punch list #315 (upgrade 5a): the prior versions of the summary and the narrative, read when their fold is opened. */
  const [docRevisions, setDocRevisions] = useState<Partial<Record<'summary' | 'narrative', { state: 'loading' } | { state: 'held'; why: string } | { state: 'ready'; revisions: DocRevision[]; capped: boolean }>>>({})
  /** Themes on the record (v2.6546): the catalog and this person's marks, the pickers' drafts, the Timeline's theme filter, the ticked lines and the bulk bar. */
  const [themes, setThemes] = useState<LegalTheme[]>([])
  const [marks, setMarks] = useState<LegalThemeMark[]>([])
  const [entryMark, setEntryMark] = useState<MarkDraft>(EMPTY_MARK_DRAFT)
  const [evMark, setEvMark] = useState<MarkDraft>(EMPTY_MARK_DRAFT)
  const [themeFilter, setThemeFilter] = useState<string | null>(null)
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const [bulkMark, setBulkMark] = useState<MarkDraft>(EMPTY_MARK_DRAFT)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [lineMarkKey, setLineMarkKey] = useState<string | null>(null)
  const [lineMark, setLineMark] = useState<MarkDraft>(EMPTY_MARK_DRAFT)
  const [lineMarkSaving, setLineMarkSaving] = useState(false)
  const [removingMarkId, setRemovingMarkId] = useState<string | null>(null)
  const [removeWhy, setRemoveWhy] = useState('')
  const [markBusyId, setMarkBusyId] = useState<string | null>(null)
  /** By theme (v2.6547): the theme picked, from the address first. */
  const [byThemeId, setByThemeId] = useState<string | null>(initialThemeId)
  // v2.6582 (punch list #269 PR 3b): the matter standing on the person, the row alone, for the fact strip's chip.
  const [matterStanding, setMatterStanding] = useState<PersonMatterStanding | null>(null)
  useEffect(() => {
    if (initialThemeId) setByThemeId(initialThemeId)
  }, [initialThemeId])

  useEffect(() => {
    setView(initialView)
  }, [initialView, viewKey, personId, userId])

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const s = await loadPersonFileSources({ personId, userId, personName, viewer, todayYmd })
      setSources(s)
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'Could not read the file'))
      setSources(null)
    }
  }, [personId, userId, personName, viewer, todayYmd])

  useEffect(() => {
    setSources(null)
    void load()
  }, [load, changeKey])

  /** The links are a source of their own: a read that fails takes only them out, and the entries still draw. */
  const reloadAmendments = useCallback(async () => {
    if (!viewer.isDev || !personId) {
      setAmendRows([])
      return
    }
    const r = await loadPersonAmendments(personId)
    setAmendRows(r.rows)
  }, [viewer.isDev, personId])

  useEffect(() => {
    void reloadAmendments()
  }, [reloadAmendments, changeKey])

  const reloadNumbers = useCallback(async () => {
    if (!viewer.isDev || !personId) {
      setExhibitNoById(new Map())
      setUnnumbered(0)
      return
    }
    const r = await loadExhibitNumbers(personId)
    setExhibitNoById(r.byId)
    // A read that failed (the column is not there before its migration) says nothing about which records lack a number.
    setUnnumbered(r.heldWhy ? 0 : r.unnumbered)
  }, [viewer.isDev, personId])

  const reloadCase = useCallback(async () => {
    if (!viewer.isDev || !personId) {
      setCaseItems([])
      setCaseLog([])
      setCaseHeld(null)
      return
    }
    const r = await loadPersonCase(personId)
    setCaseItems(r.items)
    setCaseLog(r.log)
    setCaseHeld(r.heldWhy)
  }, [viewer.isDev, personId])

  useEffect(() => {
    setNumbering(null)
    void reloadNumbers()
    void reloadCase()
  }, [reloadNumbers, reloadCase, changeKey, sources])

  const reloadThemes = useCallback(async () => {
    if (!viewer.isDev || !personId) {
      setThemes([])
      setMarks([])
      return
    }
    const r = await loadThemes({ personId })
    setThemes(r.themes)
    setMarks(r.marks)
  }, [viewer.isDev, personId])

  useEffect(() => {
    void reloadThemes()
  }, [reloadThemes, changeKey])

  const reloadMatter = useCallback(async () => {
    if (!viewer.isDev || !personId) {
      setMatterStanding(null)
      return
    }
    setMatterStanding(await loadPersonMatterStanding(personId))
  }, [viewer.isDev, personId])

  useEffect(() => {
    void reloadMatter()
  }, [reloadMatter, changeKey])

  const reloadDocuments = useCallback(async () => {
    if (!viewer.isDev || !personId) {
      setDocuments([])
      setDocumentsHeld(null)
      return
    }
    const r = await loadPersonDocuments(personId)
    setDocuments(r.documents)
    setDocumentsHeld(r.heldWhy)
  }, [viewer.isDev, personId])

  useEffect(() => {
    void reloadDocuments()
  }, [reloadDocuments, changeKey])

  const openDocument = useCallback(
    async (id: string) => {
      const r = await loadPersonDocument(id)
      if (!r.document) {
        showToast(`Could not open the document: ${r.why ?? 'it was not found'}`, 'error')
        return
      }
      setDocEdit(null)
      setOpenDoc(r.document)
    },
    [showToast],
  )

  useEffect(() => {
    setTicked(new Set())
    setThemeFilter(null)
    setLineMarkKey(null)
  }, [personId])

  const lines = useMemo(() => (sources ? buildPersonTimeline(sources.input) : []), [sources])
  const facts = useMemo(() => (sources ? personFileFacts(sources.input, lines) : null), [sources, lines])
  const counts = useMemo(() => countPersonTimeline(lines), [lines])
  const laneFiltered = useMemo(() => filterPersonTimeline(lines, { lane, source }), [lines, lane, source])
  const filtered = useMemo(() => (themeFilter ? linesWithTheme(laneFiltered, marks, themeFilter) : laneFiltered), [laneFiltered, marks, themeFilter])
  const standingThemes = useMemo(() => sortThemes(themes).filter(themeStands), [themes])
  const themeById = useMemo(() => new Map(themes.map((t) => [t.id, t])), [themes])
  const themeCounts = useMemo(() => themeCountsOnLines(lines, marks), [lines, marks])
  const themeNames = useCallback((ids: ReadonlyArray<string>) => ids.map((id) => themeById.get(id)?.name ?? 'a theme'), [themeById])
  const { ahead, past } = useMemo(() => splitPersonTimeline(filtered, todayYmd), [filtered, todayYmd])
  const months = useMemo(() => groupPersonTimelineByMonth(past), [past])
  const attachmentsById = useMemo(() => new Map((sources?.attachments ?? []).map((a) => [a.id, a])), [sources])
  /** Every evidence file by id, for the line's chips and the Evidence view. */
  const evidenceFilesById = useMemo(() => {
    const m = new Map<string, { file: PersonEvidenceFile; record: PersonEvidenceRecord }>()
    for (const r of sources?.evidence ?? []) for (const f of r.files) m.set(f.id, { file: f, record: r })
    return m
  }, [sources])
  const evidenceRecords = useMemo(() => sortEvidenceNewestFirst(sources?.evidence ?? []), [sources])
  const evidenceById = useMemo(() => new Map(evidenceRecords.map((r) => [r.id, r])), [evidenceRecords])
  /** v2.6713 (punch list #287): the transcript on each record, for *Transcript on file* on its row and its line. */
  const transcriptByEvidenceId = useMemo(() => documentsByEvidenceId(documents), [documents])
  /** v2.6615: the entries that cite each section of the narrative (`N§16` in their words). */
  const citesBySection = useMemo(() => citationsBySection(lines.filter((l) => l.ref.table === 'person_file_entries').map((l) => ({ key: l.key, ymd: l.ymd, what: l.what }))), [lines])
  const lineByEntryId = useMemo(() => {
    const m = new Map<string, PersonTimelineLine>()
    for (const l of lines) if (l.ref.table === 'person_file_entries') m.set(l.ref.id, l)
    return m
  }, [lines])
  /** When each entry was written and the sections its words cite: what the freshness fold counts against a section. */
  const freshnessEntries = useMemo(() => (sources?.input.entries ?? []).map((e) => ({ created_at: e.created_at, cites: parseSectionCitations(e.content).map((c) => c.section) })), [sources])
  // A file that was saved, or another person's, starts the folds over: the versions read are that text's no longer.
  const docStamp = `${personId ?? ''}|${sources?.docs.summary?.updated_at ?? ''}|${sources?.docs.narrative?.updated_at ?? ''}`
  /** The folds already asked for, so a second toggle before the first answer lands reads nothing twice. */
  const docRevisionsAsked = useRef<Set<string>>(new Set())
  useEffect(() => {
    docRevisionsAsked.current = new Set()
    setDocRevisions({})
  }, [docStamp])
  const openDocFreshness = useCallback(
    async (kind: 'summary' | 'narrative') => {
      if (!personId || !viewer.isDev || docRevisionsAsked.current.has(kind)) return
      docRevisionsAsked.current.add(kind)
      setDocRevisions((prev) => ({ ...prev, [kind]: { state: 'loading' } }))
      const r = await loadDocRevisions(personId, kind)
      setDocRevisions((prev) => ({ ...prev, [kind]: r.heldWhy ? { state: 'held', why: r.heldWhy } : { state: 'ready', revisions: r.revisions, capped: r.capped } }))
    },
    [personId, viewer.isDev],
  )
  const amendIndex = useMemo(() => amendmentIndex(amendRows), [amendRows])
  /** The record a number names: the database's number first, then the number an old title wears when only one record wears it. */
  const evidenceIdByNumber = useMemo(() => {
    const m = new Map<number, string>()
    for (const [id, n] of exhibitNoById) m.set(n, id)
    const worn = new Map<number, string[]>()
    for (const r of sources?.evidence ?? []) {
      if (exhibitNoById.has(r.id)) continue
      const n = exhibitNoFromTitle(r.title)
      if (n === null) continue
      worn.set(n, [...(worn.get(n) ?? []), r.id])
    }
    for (const [n, ids] of worn) if (!m.has(n) && ids.length === 1 && ids[0]) m.set(n, ids[0])
    return m
  }, [exhibitNoById, sources])
  const exhibitBeside = (r: { id: string; title: string }): string | null => exhibitBesideTitle({ exhibit_no: exhibitNoById.get(r.id) ?? null, title: r.title })
  /** The Timeline line a linked thing stands on: an entry's own, a record's own, or the entry a record proves. */
  const lineByAmendKey = useMemo(() => {
    const m = new Map<string, PersonTimelineLine>()
    for (const l of lines) {
      const kind = amendmentKindOfTable(l.ref.table)
      if (kind) m.set(amendmentKey(kind, l.ref.id), l)
    }
    for (const r of sources?.evidence ?? []) {
      const key = amendmentKey('hr_evidence', r.id)
      if (m.has(key) || !r.entry_id) continue
      const onEntry = m.get(amendmentKey('hr_entry', r.entry_id))
      if (onEntry) m.set(key, onEntry)
    }
    return m
  }, [lines, sources])
  /** The lines a live correction points at: what a section of the narrative should not rest on without a flag. */
  const correctedLineKeys = useMemo(() => {
    const out = new Set<string>()
    for (const key of correctedKeys(amendIndex)) {
      const l = lineByAmendKey.get(key)
      if (l) out.add(l.key)
    }
    return out
  }, [amendIndex, lineByAmendKey])

  const freshness = useMemo(() => {
    if (!sources) return null
    return derivePersonFileFreshness({
      summaryUpdatedAt: sources.docs.summary?.updated_at ?? null,
      summaryCoveredThrough: sources.docs.summary?.covered_through ?? null,
      entryCreatedAts: sources.input.entries.map((e) => e.created_at),
      nowIso: new Date().toISOString(),
    })
  }, [sources])

  const canWrite = viewer.isDev && Boolean(personId)

  const addEntry = useCallback(async () => {
    if (!personId || draftContent.trim() === '' || savingEntry) return
    setSavingEntry(true)
    const { data, error } = await supabase
      .from('person_file_entries')
      .insert({ person_id: personId, entry_date: draftDate, content: draftContent.trim(), source: draftSource, created_by: authUser?.id ?? null })
      .select('id')
      .single()
    if (error) {
      setSavingEntry(false)
      showToast(`Could not add the entry: ${error.message}`, 'error')
      return
    }
    let fileWords = ''
    const entryId = (data as { id: string } | null)?.id ?? null
    if (pendingFiles.length > 0) {
      // The files become a piece of evidence on the entry: its words as the title and the memo, so they are found in Drive.
      const words = draftContent.trim()
      const firstLine = words.split('\n')[0]?.trim() || 'Entry'
      const out = await savePersonEvidence({ personId, draft: { datedOn: draftDate, title: firstLine.slice(0, 160), memo: words }, files: pendingFiles, entryId, authUserId: authUser?.id ?? null })
      if (out.ok) {
        setPendingFiles([])
        fileWords = out.drive && out.drive.remaining === 0 && !out.drive.failWhy ? ' The files are in Drive.' : out.drive?.failWhy ? ` The files are kept here. Not in Drive: ${out.drive.failWhy}` : ' The files are kept here and on their way to Drive.'
      } else {
        showToast(`The entry is on the line, but its files were not kept: ${out.why}`, 'error')
      }
    }
    let markWords = ''
    if (entryId && entryMark.themeIds.length > 0) {
      const mk = await addMarks({ themeIds: entryMark.themeIds, targets: [{ kind: 'hr_entry', id: entryId }], personId, matterId: null, why: entryMark.why, provesBy: entryMark.provesBy, authUserId: authUser?.id ?? null })
      markWords = mk.ok ? ` ${markedWords(themeNames(entryMark.themeIds), mk.made, mk.already, ['entry', 'entries'])}` : ` The themes were not marked: ${mk.why}`
      setEntryMark(EMPTY_MARK_DRAFT)
      void reloadThemes()
    }
    let linkWords = ''
    if (entryId && draftTargets.length > 0) {
      // The entry is written first, then one link a thing it corrects or completes; the table's guard refuses a bad pair in words.
      const lk = await addAmendments({ personId, fromKind: 'hr_entry', fromId: entryId, targets: draftTargets, authUserId: authUser?.id ?? null })
      if (lk.ok) {
        linkWords = ` ${amendmentCountWords(lk.made)} made.`
        setDraftTargets([])
        void reloadAmendments()
      } else {
        showToast(`The entry is on the line, but it was not linked: ${lk.why}`, 'error')
      }
    }
    setSavingEntry(false)
    showToast(`Entry added to the line.${fileWords}${markWords}${linkWords}`, 'success')
    setDraftContent('')
    setDraftDate(todayYmd)
    setComposerOpen(false)
    await load()
    onChanged?.()
  }, [personId, draftContent, savingEntry, draftDate, draftSource, authUser?.id, pendingFiles, showToast, todayYmd, load, onChanged, entryMark, themeNames, reloadThemes, draftTargets, reloadAmendments])

  /** File a waiting report from its line: the same RPC as the queue, so the entry lands dated the day it happened. */
  const fileReport = useCallback(
    async (reportId: string) => {
      setReportBusyId(reportId)
      const { error } = await supabase.rpc('file_person_report', { p_report_id: reportId })
      if (error) showToast(`Could not file it: ${error.message}`, 'error')
      else {
        showToast('Filed as a dated entry on the line.', 'success')
        await load()
        onChanged?.()
      }
      setReportBusyId(null)
    },
    [showToast, load, onChanged],
  )

  const dismissReport = useCallback(
    async (reportId: string) => {
      const reason = dismissReason.trim()
      if (reason === '') return
      setReportBusyId(reportId)
      const { error } = await supabase.rpc('dismiss_person_report', { p_report_id: reportId, p_reason: reason })
      if (error) showToast(`Could not dismiss it: ${error.message}`, 'error')
      else {
        showToast('Dismissed. The report and your reason are kept.', 'success')
        setDismissingId(null)
        setDismissReason('')
        await load()
        onChanged?.()
      }
      setReportBusyId(null)
    },
    [dismissReason, showToast, load, onChanged],
  )

  const openAttachment = useCallback(
    async (a: PersonFileAttachment) => {
      if (!a.storage_path) {
        showToast(`${a.filename} has no copy here to open.`, 'error')
        return
      }
      if (!(await openOrSaveFromStorage(HR_FILES_BUCKET, a.storage_path, a.filename, 600))) showToast(`Could not open ${a.filename}.`, 'error')
    },
    [showToast],
  )

  const openEvidenceFile = useCallback(
    async (f: PersonEvidenceFile) => {
      if (f.drive_url) {
        window.open(f.drive_url, '_blank', 'noopener')
        return
      }
      if (f.storage_path) {
        if (!(await openOrSaveFromStorage(HR_FILES_BUCKET, f.storage_path, f.filename, 600))) showToast(`Could not open ${f.filename}.`, 'error')
        return
      }
      showToast(`${f.filename} has no copy to open yet.`, 'error')
    },
    [showToast],
  )

  const evidenceFileChip = (f: PersonEvidenceFile, rec?: Pick<PersonEvidenceRecord, 'counsel_only'>) => (
    <button
      key={f.id}
      type="button"
      onClick={() => void openEvidenceFile(f)}
      title={`${f.filename}${f.size_bytes !== null ? ` · ${evidenceSizeWords(f.size_bytes)}` : ''} · ${(rec?.counsel_only ? 'kept here only, counsel-only' : evidenceFileWhereWords(f))}${evidenceHashWords(f.sha256) ? ` · ${evidenceHashWords(f.sha256)}` : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.12rem 0.55rem', borderRadius: 999, fontSize: '0.74rem', border: '1px solid var(--border-strong)', background: 'var(--bg-page)', color: 'var(--text-link)', cursor: 'pointer', maxWidth: '32ch' }}
    >
      <span aria-hidden>📎</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</span>
      <span style={{ color: 'var(--text-faint)', flex: 'none' }}>{evidenceKindWords(f.mime_type)}</span>
    </button>
  )

  /** A chip for any file id the line names: an evidence file, else an older bucket-only file. */
  const fileChipById = (id: string) => {
    const ev = evidenceFilesById.get(id)
    if (ev) return evidenceFileChip(ev.file, ev.record)
    const a = attachmentsById.get(id)
    return a ? attachmentChip(a) : null
  }

  const attachmentChip = (a: PersonFileAttachment) => (
    <button
      key={a.id}
      type="button"
      onClick={() => void openAttachment(a)}
      title={`${a.filename}${a.size_bytes !== null ? ` · ${formatBytes(a.size_bytes)}` : ''} · added ${formatIsoDate(a.created_at)}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.12rem 0.55rem', borderRadius: 999, fontSize: '0.74rem', border: '1px solid var(--border-strong)', background: 'var(--bg-page)', color: 'var(--text-link)', cursor: 'pointer', maxWidth: '32ch' }}
    >
      <span aria-hidden>📎</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</span>
      {a.size_bytes !== null && <span style={{ color: 'var(--text-faint)', flex: 'none' }}>{formatBytes(a.size_bytes)}</span>}
    </button>
  )

  // ─── the pieces ────────────────────────────────────────────────────────────

  const composer = canWrite && composerOpen ? (
    <div style={{ ...CARD, marginBottom: '0.9rem' }} data-person-file-composer>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          The day it happened{' '}
          <input
            type="date"
            value={draftDate}
            max={todayYmd}
            onChange={(e) => setDraftDate(e.target.value)}
            style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.8rem', background: 'var(--bg-page)', color: 'var(--text-base)', marginLeft: '0.3rem' }}
          />
        </label>
        <select
          value={draftSource}
          onChange={(e) => setDraftSource(e.target.value)}
          aria-label="What kind of entry"
          style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.8rem', background: 'var(--bg-page)', color: 'var(--text-base)' }}
        >
          {HR_ENTRY_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {draftTargets.length > 0 ? (
        <div data-testid="composer-amends" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
          {draftTargets.map((t) => {
            const on = lineByAmendKey.get(amendmentKey(t.kind, t.id))
            const thing = amendmentThingWord(t.kind)
            return (
              <span key={`${t.kind}:${t.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                This entry
                <select
                  value={t.how}
                  aria-label={`What this entry does to the ${thing}`}
                  onChange={(e) => setDraftTargets((prev) => prev.map((x) => (x.kind === t.kind && x.id === t.id ? { ...x, how: e.target.value as AmendmentHow } : x)))}
                  style={{ padding: '0.15rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.78rem', background: 'var(--bg-page)', color: 'var(--text-base)' }}
                >
                  <option value="corrects">corrects</option>
                  <option value="completes">completes</option>
                </select>
                the {thing} of {on ? dayWordsWithYear(on.ymd) : 'another day'}
                {on ? <span style={{ color: 'var(--text-base)' }}>{(on.what.split('\n')[0] ?? '').slice(0, 60)}</span> : null}
                <button type="button" aria-label={`Leave the ${thing} of ${on ? dayWordsWithYear(on.ymd) : 'another day'} out`} onClick={() => setDraftTargets((prev) => prev.filter((x) => !(x.kind === t.kind && x.id === t.id)))} style={{ border: 'none', background: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.74rem', padding: 0 }}>
                  ✕
                </button>
              </span>
            )
          })}
        </div>
      ) : null}
      <textarea
        value={draftContent}
        onChange={(e) => setDraftContent(e.target.value)}
        placeholder="What happened. Facts and dates, no guesses."
        rows={3}
        autoFocus
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.84rem', background: 'var(--bg-page)', color: 'var(--text-base)', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ marginTop: '0.55rem' }}>
        <ThemeMarkPicker themes={themes} draft={entryMark} onChange={setEntryMark} testId="entry-theme-picker" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={() => void addEntry()}
          disabled={savingEntry || draftContent.trim() === ''}
          style={{ padding: '0.4rem 0.9rem', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: savingEntry || draftContent.trim() === '' ? 'default' : 'pointer', background: '#2563eb', color: '#fff', opacity: savingEntry || draftContent.trim() === '' ? 0.55 : 1 }}
        >
          {savingEntry ? 'Adding…' : 'Add entry'}
        </button>
        <button type="button" onClick={() => { setComposerOpen(false); setDraftContent(''); setPendingFiles([]); setDraftTargets([]) }} style={{ padding: '0.4rem 0.7rem', borderRadius: 7, fontSize: '0.82rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          Cancel
        </button>
        <label style={{ fontSize: '0.78rem', color: 'var(--text-link)', cursor: 'pointer' }}>
          📎 Attach files
          <input
            type="file"
            multiple
            onChange={(e) => {
              if (e.target.files) setPendingFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
              e.target.value = ''
            }}
            style={{ display: 'none' }}
          />
        </label>
        {pendingFiles.map((f, i) => (
          <span key={`${f.name}-${i}`} style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {f.name}
            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))} style={{ marginLeft: '0.25rem', border: 'none', background: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.74rem' }}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>Entries append and never change. A correction is a new entry: press Correct this entry… on the line it corrects.</p>
    </div>
  ) : null

  const smallPress = (primary: boolean): CSSProperties => ({
    font: 'inherit',
    fontSize: '0.74rem',
    fontWeight: 650,
    padding: '0.22rem 0.6rem',
    borderRadius: 6,
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? '#2563eb' : 'transparent',
    color: primary ? '#fff' : 'var(--text-link)',
    cursor: 'pointer',
  })

  /** The presses on a field report waiting to be filed (dev): file it onto the line, or dismiss it with a reason. */
  const reportActs = (line: PersonTimelineLine) => {
    if (!canWrite || line.state !== 'unreviewed') return null
    const id = line.ref.id
    const busy = reportBusyId === id
    return (
      <span style={{ display: 'block', marginTop: '0.45rem' }}>
        <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={smallPress(true)} disabled={busy} onClick={() => void fileReport(id)}>
            {busy && dismissingId !== id ? 'Filing…' : 'File to the record'}
          </button>
          <button type="button" style={smallPress(false)} disabled={busy} onClick={() => { setDismissingId(dismissingId === id ? null : id); setDismissReason('') }}>
            Dismiss…
          </button>
        </span>
        {dismissingId === id ? (
          <span style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={dismissReason}
              autoFocus
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Why is this not going on the record?"
              style={{ flex: '1 1 220px', font: 'inherit', fontSize: '0.78rem', padding: '0.28rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
            />
            <button type="button" style={{ ...smallPress(false), color: 'var(--text-red-600)' }} disabled={dismissReason.trim() === '' || busy} onClick={() => void dismissReport(id)}>
              {busy ? 'Dismissing…' : 'Confirm dismiss'}
            </button>
          </span>
        ) : null}
      </span>
    )
  }

  // ─── themes on a line (v2.6546) ──────────────────────────────────────────

  const canMark = canWrite && standingThemes.length > 0

  const writeMarks = async (draft: MarkDraft, targets: MarkTarget[], noun: readonly [string, string]) => {
    const mk = await addMarks({ themeIds: draft.themeIds, targets, personId, matterId: null, why: draft.why, provesBy: draft.provesBy, authUserId: authUser?.id ?? null })
    if (!mk.ok) {
      showToast(`The themes were not marked: ${mk.why}`, 'error')
      return false
    }
    showToast(`${markedWords(themeNames(draft.themeIds), mk.made, mk.already, noun)}${mk.failWhy ? ` One was refused: ${mk.failWhy}` : ''}`, mk.made > 0 ? 'success' : 'info')
    await reloadThemes()
    return true
  }

  const markOneLine = async (target: MarkTarget) => {
    if (lineMark.themeIds.length === 0 || lineMarkSaving) return
    setLineMarkSaving(true)
    const ok = await writeMarks(lineMark, [target], ['line', 'lines'])
    setLineMarkSaving(false)
    if (ok) {
      setLineMarkKey(null)
      setLineMark(EMPTY_MARK_DRAFT)
    }
  }

  const markTickedLines = async () => {
    const targets = lines.filter((l) => ticked.has(l.key)).map(markTargetOfLine).filter((t): t is MarkTarget => !!t)
    if (bulkMark.themeIds.length === 0 || targets.length === 0 || bulkSaving) return
    setBulkSaving(true)
    const ok = await writeMarks(bulkMark, targets, ['line', 'lines'])
    setBulkSaving(false)
    if (ok) {
      setTicked(new Set())
      setBulkMark(EMPTY_MARK_DRAFT)
    }
  }

  const takeMarkOff = async (id: string) => {
    if (removeWhy.trim() === '' || markBusyId) return
    setMarkBusyId(id)
    const r = await removeMark(id, removeWhy, authUser?.id ?? null)
    setMarkBusyId(null)
    if (!r.ok) {
      showToast(`The mark stays: ${r.why}`, 'error')
      return
    }
    setRemovingMarkId(null)
    setRemoveWhy('')
    showToast('The mark is off. Its row stays, with the reason.', 'success')
    await reloadThemes()
  }

  const keepOneMark = async (id: string) => {
    setMarkBusyId(id)
    const r = await keepMark(id, authUser?.id ?? null)
    setMarkBusyId(null)
    if (!r.ok) {
      showToast(`The mark was not kept: ${r.why}`, 'error')
      return
    }
    showToast('Kept.', 'success')
    await reloadThemes()
  }

  /** From the item window: the Timeline with every filter off, scrolled to the line and lit for a moment. */
  const openOnTimeline = (key: string) => {
    setLane(null)
    setSource(null)
    setThemeFilter(null)
    setView('timeline')
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-person-file-line="${key}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      el.style.transition = 'background 1.2s'
      el.style.background = 'var(--bg-blue-tint)'
      window.setTimeout(() => {
        el.style.background = ''
      }, 1400)
    }, 50)
  }

  /** v2.6713 (punch list #287): from a document's header, and since punch list #315 from an `Ev #41` in an entry's words, the Evidence tab scrolled to the record and lit for a moment. */
  const openEvidenceRecord = (id: string) => {
    setOpenDoc(null)
    setDocEdit(null)
    setTiePicking(false)
    setEvFilter('all')
    setView('evidence')
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-person-evidence="${id}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      el.style.transition = 'background 1.2s'
      el.style.background = 'var(--bg-blue-tint)'
      window.setTimeout(() => {
        el.style.background = ''
      }, 1400)
    }, 50)
  }

  /** From a record's row or its Timeline line: the Documents view open on the transcript. */
  const openTranscript = (docId: string) => {
    setAddDoc(null)
    setView('narrative')
    void openDocument(docId)
  }

  /** The document names its record (or stands alone again) through the same function the seat writes with; the function holds the counsel rule too. */
  const tieRecord = async (d: PersonDocumentRow, evidenceId: string | null) => {
    if (!personId) return
    const record = evidenceId ? evidenceById.get(evidenceId) ?? null : null
    const problem = evidenceId ? tieToRecordProblem(d, record) : null
    if (problem) {
      showToast(problem, 'error')
      return
    }
    setTieSaving(true)
    const out = await tieDocumentToEvidence({ personId, docId: d.id, evidenceId, expectUpdatedAt: d.updated_at })
    setTieSaving(false)
    if (!out.ok) {
      showToast(`The record was not tied: ${out.why}`, 'error')
      return
    }
    setTiePicking(false)
    showToast(evidenceId ? 'The document now names its record.' : 'The document stands on its own again.', 'success')
    await reloadDocuments()
    await openDocument(d.id)
    onChanged?.()
  }

  /** A citation on a line (v2.6615): the Documents view on the narrative, scrolled to that section and lit for a moment. */
  const openNarrativeSection = (n: number) => {
    setOpenDoc(null)
    setDocEdit(null)
    setAddDoc(null)
    setView('narrative')
    setPendingSection(n)
  }
  useEffect(() => {
    if (pendingSection === null || view !== 'narrative' || !sources?.docs.narrative) return
    const target = sectionByNumber(extractHrDocHeadings(sources.docs.narrative.content), pendingSection)
    setPendingSection(null)
    if (!target) {
      showToast(`The narrative has no section ${pendingSection}.`, 'error')
      return
    }
    window.setTimeout(() => {
      // The slug is letters, digits and dashes (hrDocMarkdown's slugify), so an attribute selector needs no escaping.
      const el = hrDocRef.current?.querySelector<HTMLElement>(`[id="${target.slug}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.style.transition = 'background 1.2s'
      el.style.background = 'var(--bg-blue-tint)'
      window.setTimeout(() => {
        el.style.background = ''
      }, 1400)
    }, 50)
  }, [pendingSection, view, sources, showToast])

  const removeMarkFromWindow = async (id: string, why: string) => {
    const r = await removeMark(id, why, authUser?.id ?? null)
    if (!r.ok) {
      showToast(`The mark stays: ${r.why}`, 'error')
      return false
    }
    showToast('The mark is off. Its row stays, with the reason.', 'success')
    await reloadThemes()
    return true
  }

  const toggleTick = (key: string) =>
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const themeChipStyle = (proposed: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.1rem 0.5rem',
    borderRadius: 999,
    fontSize: '0.72rem',
    border: `1px ${proposed ? 'dashed' : 'solid'} var(--border-blue)`,
    background: 'var(--bg-blue-tint)',
    color: 'var(--text-blue-700)',
  })

  /** The theme chips on a line, each with its why and grade on the tip and a × that asks why, and the *+ theme* press. */
  const themeBits = (line: PersonTimelineLine) => {
    const target = markTargetOfLine(line)
    if (!target || !viewer.isDev) return null
    const live = marksOnTarget(marks, target)
    const open = lineMarkKey === line.key
    if (live.length === 0 && !canMark) return null
    return (
      <span style={{ display: 'block', marginTop: '0.35rem' }} data-testid={`line-themes-${line.key}`}>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
          {live.map((m) => {
            const proposed = markIsProposed(m)
            const name = themeById.get(m.theme_id)?.name ?? 'a theme'
            const tip = [m.why ? `why: ${m.why}` : '', m.proves_by ? `proves it by ${provesByWords(m.proves_by)}` : '', proposed ? 'proposed by the agent, not yet kept' : ''].filter(Boolean).join(' · ')
            return (
              <span key={m.id} style={themeChipStyle(proposed)} title={tip || undefined} data-testid={`line-theme-${m.id}`}>
                {name}
                {proposed ? <span style={{ color: 'var(--text-muted)' }}>· proposed</span> : null}
                {proposed && canWrite ? (
                  <button type="button" disabled={markBusyId === m.id} onClick={() => void keepOneMark(m.id)} style={{ font: 'inherit', fontSize: '0.7rem', fontWeight: 600, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }}>
                    Keep
                  </button>
                ) : null}
                {canWrite ? (
                  <button
                    type="button"
                    aria-label={`Take ${name} off this line`}
                    onClick={() => {
                      setRemovingMarkId(removingMarkId === m.id ? null : m.id)
                      setRemoveWhy('')
                    }}
                    style={{ font: 'inherit', fontSize: '0.74rem', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                ) : null}
              </span>
            )
          })}
          {canMark && !open ? (
            <button
              type="button"
              onClick={() => {
                setLineMarkKey(line.key)
                setLineMark(EMPTY_MARK_DRAFT)
              }}
              data-testid={`line-add-theme-${line.key}`}
              style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }}
            >
              + theme
            </button>
          ) : null}
        </span>
        {removingMarkId && live.some((m) => m.id === removingMarkId) ? (
          <span style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={removeWhy}
              autoFocus
              maxLength={200}
              onChange={(e) => setRemoveWhy(e.target.value)}
              placeholder="Why is the theme coming off?"
              style={{ flex: '1 1 220px', font: 'inherit', fontSize: '0.78rem', padding: '0.28rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
            />
            <button type="button" style={{ ...smallPress(false), color: 'var(--text-red-600)' }} disabled={removeWhy.trim() === '' || !!markBusyId} onClick={() => void takeMarkOff(removingMarkId)}>
              {markBusyId === removingMarkId ? 'Taking it off…' : 'Take it off'}
            </button>
            <button type="button" style={smallPress(false)} onClick={() => setRemovingMarkId(null)}>
              Keep it
            </button>
          </span>
        ) : null}
        {open ? (
          <span style={{ display: 'block', marginTop: '0.45rem', padding: '0.5rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }} data-testid={`line-theme-picker-${line.key}`}>
            <ThemeMarkPicker themes={themes} draft={lineMark} onChange={setLineMark} alreadyOn={new Set(live.map((m) => m.theme_id))} />
            <span style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
              <button type="button" style={smallPress(true)} disabled={lineMark.themeIds.length === 0 || lineMarkSaving} onClick={() => void markOneLine(target)}>
                {lineMarkSaving ? 'Marking…' : countedLabel('Mark', lineMark.themeIds.length, ['theme', 'themes'])}
              </button>
              <button type="button" style={smallPress(false)} onClick={() => setLineMarkKey(null)}>
                Cancel
              </button>
            </span>
          </span>
        ) : null}
      </span>
    )
  }

  /** Open the composer with this line picked as what the new entry corrects (the dev may switch it to completes). */
  const startAmending = (line: PersonTimelineLine) => {
    const kind = amendmentKindOfTable(line.ref.table)
    if (!kind) return
    const next: AmendmentTarget[] = draftTargets.some((t) => t.kind === kind && t.id === line.ref.id) ? draftTargets : [...draftTargets, { kind, id: line.ref.id, how: 'corrects' }]
    const problem = amendmentTargetsProblem(next, null)
    if (problem) {
      showToast(problem, 'error')
      return
    }
    setDraftTargets(next)
    setComposerOpen(true)
    window.setTimeout(() => document.querySelector<HTMLElement>('[data-person-file-composer]')?.scrollIntoView({ block: 'center' }), 50)
  }

  const withdrawLink = async (id: string) => {
    if (withdrawBusy) return
    setWithdrawBusy(true)
    const r = await withdrawAmendment(id, withdrawWhy, authUser?.id ?? null)
    setWithdrawBusy(false)
    if (!r.ok) {
      showToast(`The link stays: ${r.why}`, 'error')
      return
    }
    showToast('The link is off. Its row stays, with the reason.', 'success')
    setWithdrawingLinkId(null)
    setWithdrawWhy('')
    await reloadAmendments()
  }

  /** Punch list #315: what corrected or completed this line, what this line corrects or completes, and the press that starts a correction. */
  const amendBits = (line: PersonTimelineLine) => {
    if (!viewer.isDev) return null
    const kind = amendmentKindOfTable(line.ref.table)
    if (!kind) return null
    const ends = amendmentEnds(amendmentKey(kind, line.ref.id), amendIndex, (k) => lineByAmendKey.get(k)?.ymd ?? null)
    if (ends.amendedBy.length === 0 && ends.amends.length === 0 && !canWrite) return null
    const linkPress: CSSProperties = { font: 'inherit', fontSize: '0.72rem', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }
    const withdrawing = ends.amends.find((e) => e.link_id === withdrawingLinkId) ?? null
    return (
      <span style={{ display: 'block', marginTop: '0.3rem' }} data-testid={`line-amends-${line.key}`}>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          {ends.amendedBy.map((e) => {
            const to = lineByAmendKey.get(e.key)
            return (
              <button key={e.link_id} type="button" disabled={!to} onClick={() => { if (to) openOnTimeline(to.key) }} style={chip(e.how === 'corrects' ? FACT_TONE.amber : FACT_TONE.gray, { cursor: to ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 700, border: 'none' })}>
                {e.words}
                {to ? ' ›' : ''}
              </button>
            )
          })}
          {ends.amends.map((e) => {
            const to = lineByAmendKey.get(e.key)
            return (
              <span key={e.link_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <button type="button" disabled={!to} onClick={() => { if (to) openOnTimeline(to.key) }} style={{ ...linkPress, color: to ? 'var(--text-link)' : 'var(--text-muted)', cursor: to ? 'pointer' : 'default' }}>
                  {e.words}
                  {to ? ' ›' : ''}
                </button>
                {canWrite ? (
                  <button
                    type="button"
                    aria-label={`Withdraw the link: ${e.words}`}
                    onClick={() => {
                      setWithdrawingLinkId(withdrawingLinkId === e.link_id ? null : e.link_id)
                      setWithdrawWhy('')
                    }}
                    style={{ ...linkPress, color: 'var(--text-muted)', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                ) : null}
              </span>
            )
          })}
          {canWrite ? (
            <button type="button" onClick={() => startAmending(line)} style={{ ...linkPress, color: 'var(--text-faint)' }}>
              {kind === 'hr_entry' ? 'Correct this entry…' : 'Correct this record…'}
            </button>
          ) : null}
        </span>
        {withdrawing ? (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginTop: '0.3rem' }}>
            <input
              value={withdrawWhy}
              onChange={(e) => setWithdrawWhy(e.target.value)}
              maxLength={200}
              placeholder="Why the link comes off"
              aria-label="Why the link comes off"
              style={{ flex: '1 1 14rem', minWidth: 0, padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.78rem', background: 'var(--bg-page)', color: 'var(--text-base)' }}
            />
            <button type="button" disabled={withdrawBusy || withdrawWhy.trim() === ''} onClick={() => void withdrawLink(withdrawing.link_id)} style={smallPress(true)}>
              Withdraw the link
            </button>
            <button type="button" onClick={() => setWithdrawingLinkId(null)} style={smallPress(false)}>
              Cancel
            </button>
          </span>
        ) : null}
      </span>
    )
  }

  const renderLine = (line: PersonTimelineLine, withYear = false) => {
    const look = lineLook(line)
    const faded = line.state === 'dismissed' || line.state === 'draft'
    const chips = line.attachmentIds.map(fileChipById).filter(Boolean)
    const tickable = canMark && !!markTargetOfLine(line)
    return (
      <li key={line.key} data-person-file-line={line.key} style={{ display: 'grid', gridTemplateColumns: withYear ? (canMark ? '7.2rem 1fr' : '5.8rem 1fr') : canMark ? '4.8rem 1fr' : '3.4rem 1fr', gap: '0.6rem', padding: '0.55rem 0', borderTop: '1px solid var(--border)', opacity: faded ? 0.7 : 1 }}>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', paddingTop: 3, whiteSpace: 'nowrap', display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
          {canMark ? (
            tickable ? (
              <input type="checkbox" checked={ticked.has(line.key)} onChange={() => toggleTick(line.key)} aria-label={`Tick the ${dayWords(line.ymd)} line`} data-testid={`line-tick-${line.key}`} style={{ margin: 0, marginTop: 1 }} />
            ) : (
              <span aria-hidden style={{ width: 13, flex: 'none' }} />
            )
          ) : null}
          {withYear ? dayWordsWithYear(line.ymd) : dayWords(line.ymd)}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={chip(look)}>{line.kindWords}</span>
            {line.ref.table === 'person_file_evidence' && exhibitBeside({ id: line.ref.id, title: line.what }) ? (
              <span style={chip(FACT_TONE.gray)} data-testid={`line-exhibit-${line.ref.id}`}>{exhibitBeside({ id: line.ref.id, title: line.what })}</span>
            ) : null}
            {line.ref.table === 'person_file_evidence' && transcriptByEvidenceId.has(line.ref.id) ? (
              <button type="button" onClick={() => { const t = transcriptByEvidenceId.get(line.ref.id); if (t) openTranscript(t.id) }} aria-label={`Open the transcript of ${line.what}`} style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                Transcript on file ›
              </button>
            ) : null}
            {line.door ? (
              <a href={line.door.to} style={{ fontSize: '0.72rem', color: 'var(--text-link)', textDecoration: 'none', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {line.door.label} ›
              </a>
            ) : null}
          </span>
          <span style={{ display: 'block', fontSize: '0.87rem', color: 'var(--text-base)', marginTop: '0.25rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {line.ref.table === 'person_file_entries' && viewer.isDev
              ? splitByDoors(line.what).map((part, i) =>
                  part.kind === 'text' ? (
                    <span key={i}>{part.text}</span>
                  ) : part.kind === 'exhibit' ? (
                    evidenceIdByNumber.has(part.exhibitNo) ? (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Open the evidence record ${exhibitLabel(part.exhibitNo)}`}
                        title={`The evidence record ${exhibitLabel(part.exhibitNo)}`}
                        onClick={() => openEvidenceRecord(evidenceIdByNumber.get(part.exhibitNo) ?? '')}
                        style={{ font: 'inherit', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline dotted' }}
                      >
                        {part.raw}
                      </button>
                    ) : (
                      <span key={i}>{part.raw}</span>
                    )
                  ) : (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Open section ${part.section} of the narrative`}
                      title={`Section ${part.section} of the narrative`}
                      onClick={() => openNarrativeSection(part.section)}
                      style={{ font: 'inherit', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline dotted' }}
                    >
                      {part.raw}
                    </button>
                  ),
                )
              : line.what}
          </span>
          {line.notes ? <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{line.notes}</span> : null}
          {chips.length > 0 ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>{chips}</span> : null}
          {themeBits(line)}
          {amendBits(line)}
          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
            {line.byName ? line.byName : ''}
            {line.byName && line.loggedAt ? ' · ' : ''}
            {line.loggedAt ? `written ${formatIsoDate(line.loggedAt)}` : ''}
          </span>
          {reportActs(line)}
        </span>
      </li>
    )
  }

  const timelineView = (
    <div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }} role="group" aria-label="Filter the line by lane">
        <button type="button" aria-pressed={lane === null} onClick={() => setLane(null)} style={filterChip(lane === null)}>
          All · {counts.total}
        </button>
        {PERSON_TIMELINE_LANES.map((l) =>
          counts.byLane[l.lane] > 0 ? (
            <button key={l.lane} type="button" aria-pressed={lane === l.lane} onClick={() => setLane((prev) => (prev === l.lane ? null : l.lane))} style={filterChip(lane === l.lane)}>
              {l.label} · {counts.byLane[l.lane]}
            </button>
          ) : null,
        )}
        <select
          value={source ?? ''}
          onChange={(e) => setSource((e.target.value || null) as PersonTimelineSource | null)}
          aria-label="Filter the line by where it comes from"
          style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.75rem', background: 'var(--surface)', color: 'var(--text-600)' }}
        >
          <option value="">Everything on record</option>
          {PERSON_TIMELINE_SOURCES.map((s) =>
            counts.bySource[s.source] > 0 ? (
              <option key={s.source} value={s.source}>
                {s.label} · {counts.bySource[s.source]}
              </option>
            ) : null,
          )}
        </select>
        {canWrite && !composerOpen ? (
          <button type="button" onClick={() => setComposerOpen(true)} style={{ padding: '0.3rem 0.75rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
            + Add entry
          </button>
        ) : null}
      </div>

      {viewer.isDev && standingThemes.some((t) => (themeCounts.get(t.id) ?? 0) > 0) ? (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }} role="group" aria-label="Filter the line by theme" data-testid="timeline-theme-row">
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Themes</span>
          {standingThemes.map((t) => {
            const n = themeCounts.get(t.id) ?? 0
            return n > 0 ? (
              <button key={t.id} type="button" aria-pressed={themeFilter === t.id} onClick={() => setThemeFilter((prev) => (prev === t.id ? null : t.id))} title={t.what_counts || undefined} style={filterChip(themeFilter === t.id)} data-testid={`timeline-theme-${t.id}`}>
                {t.name} · {n}
              </button>
            ) : null
          })}
        </div>
      ) : null}

      {composer}

      {filtered.length === 0 ? (
        <EmptyState compact {...personTimelineEmptyWords({ filtered: lane !== null || source !== null || themeFilter !== null, canAdd: canWrite, clearFilter: () => { setLane(null); setSource(null); setThemeFilter(null) }, openComposer: () => setComposerOpen(true) })} />
      ) : (
        <div style={{ maxWidth: '88ch' }}>
          {ahead.length > 0 ? (
            <section aria-label="Ahead" style={{ marginBottom: '0.9rem' }}>
              <h4 style={{ margin: '0 0 0.1rem', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>Ahead</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{ahead.map((l) => renderLine(l, true))}</ul>
            </section>
          ) : null}
          {months.map((m) => (
            <section key={m.monthKey} aria-label={m.label} style={{ marginBottom: '0.9rem' }}>
              <h4 style={{ margin: '0 0 0.1rem', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span>{m.label}</span>
                <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>{m.lines.length === 1 ? '1 line' : `${m.lines.length} lines`}</span>
              </h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{m.lines.map((l) => renderLine(l))}</ul>
            </section>
          ))}
        </div>
      )}
      {ticked.size > 0 ? (
        <div style={{ position: 'sticky', bottom: 'calc(var(--app-bottom-chrome, 0px) + 0.5rem)', marginTop: '0.75rem', padding: '0.6rem 0.8rem', border: '1px solid var(--border-blue)', borderRadius: 10, background: 'var(--surface)', boxShadow: '0 6px 24px rgba(0,0,0,0.12)', display: 'grid', gap: '0.5rem', maxWidth: '88ch' }} data-testid="timeline-bulk-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{tickedWords(ticked.size)}</span>
            <button type="button" onClick={() => setTicked(new Set())} style={{ font: 'inherit', fontSize: '0.76rem', border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }}>
              Untick
            </button>
          </div>
          <ThemeMarkPicker themes={themes} draft={bulkMark} onChange={setBulkMark} label="Mark them with" testId="bulk-theme-picker" />
          <div>
            <button type="button" style={smallPress(true)} disabled={bulkMark.themeIds.length === 0 || bulkSaving} onClick={() => void markTickedLines()} data-testid="bulk-mark">
              {bulkSaving ? 'Marking…' : countedLabel('Mark', ticked.size, ['line', 'lines'])}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )

  const pickEvidenceFiles = useCallback(async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return
    setEvShrinking(true)
    const out: File[] = []
    for (const f of Array.from(picked)) {
      // A photo shrinks on the way in, as a box photo does: a phone's 4 MB shot becomes a few hundred KB that still reads.
      if (f.type.startsWith('image/') && f.size > 600_000) {
        try {
          const shot = await shrinkPhoto(f)
          if (shot.shrunk) {
            out.push(new File([shot.blob], f.name.replace(/\.[A-Za-z0-9]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: f.lastModified }))
            continue
          }
        } catch {
          // The original goes as it came.
        }
      }
      out.push(f)
    }
    setEvShrinking(false)
    setEvFiles((prev) => [...prev, ...out])
    setEvDraft((d) => (d.title.trim() === '' && out[0] ? { ...d, title: evidenceTitleFromName(out[0].name) } : d))
  }, [])

  const openEvidenceWindow = () => {
    setEvDraft({ datedOn: todayYmd, title: '', memo: '', counselOnly: false })
    setEvFiles([])
    setEvLinks([])
    setEvLinkDraft({ name: '', driveUrl: '' })
    setEvTried(false)
    setEvMark(EMPTY_MARK_DRAFT)
    setEvidenceOpen(true)
  }

  const evProblem = evidenceDraftProblem(evDraft, evFiles, todayYmd, evLinks)
  const evLinkDraftProblem = evLinkDraft.name.trim() || evLinkDraft.driveUrl.trim() ? evidenceLinkProblem(evLinkDraft) : null

  /** The link row's press: the draft becomes a linked file when it stands; the title starts from the first name when blank. */
  const addEvidenceLink = () => {
    if (evLinkDraftProblem || !(evLinkDraft.name.trim() || evLinkDraft.driveUrl.trim())) return
    const link = { name: evLinkDraft.name.trim(), driveUrl: evLinkDraft.driveUrl.trim() }
    setEvLinks((prev) => [...prev, link])
    setEvDraft((d) => (d.title.trim() === '' && evFiles.length === 0 ? { ...d, title: evidenceTitleFromName(link.name) } : d))
    setEvLinkDraft({ name: '', driveUrl: '' })
  }

  const saveEvidence = useCallback(async () => {
    setEvTried(true)
    if (!personId || evProblem || evSaving) return
    setEvSaving(true)
    const out = await savePersonEvidence({ personId, draft: evDraft, files: evFiles, links: evLinks, authUserId: authUser?.id ?? null })
    setEvSaving(false)
    if (!out.ok) {
      showToast(`Could not keep the evidence: ${out.why}`, 'error')
      return
    }
    const where =
      out.staged === 0 && out.linked > 0
        ? `${out.linked === 1 ? 'The file is' : `All ${out.linked} files are`} linked in Drive.`
        : out.drive && out.drive.remaining === 0 && !out.drive.failWhy
          ? 'In Drive.'
          : out.drive?.failWhy
            ? `Kept here. Not in Drive: ${out.drive.failWhy}`
            : 'Kept here and on its way to Drive.'
    let markWords = ''
    if (evMark.themeIds.length > 0) {
      const mk = await addMarks({ themeIds: evMark.themeIds, targets: [{ kind: 'hr_evidence', id: out.recordId }], personId, matterId: null, why: evMark.why, provesBy: evMark.provesBy, authUserId: authUser?.id ?? null })
      markWords = mk.ok ? ` ${markedWords(themeNames(evMark.themeIds), mk.made, mk.already, ['record', 'records'])}` : ` The themes were not marked: ${mk.why}`
      void reloadThemes()
    }
    showToast(`Evidence kept on the file. ${where}${markWords}`, 'success')
    setEvidenceOpen(false)
    await load()
    onChanged?.()
  }, [personId, evProblem, evSaving, evDraft, evFiles, evLinks, authUser?.id, showToast, load, onChanged, evMark, themeNames, reloadThemes])

  const retryDrive = useCallback(
    async (recordId: string) => {
      setEvRetryId(recordId)
      const out = await fileEvidenceToDrive(recordId)
      setEvRetryId(null)
      if (out.ok) showToast('In Drive.', 'success')
      else showToast(`Still not in Drive: ${out.why ?? 'no answer'}`, 'error')
      await load()
    },
    [showToast, load],
  )

  const input = (extra?: CSSProperties): CSSProperties => ({ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.86rem', background: 'var(--bg-page)', color: 'var(--text-base)', fontFamily: 'inherit', ...extra })
  const fieldLabel: CSSProperties = { display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }

  const evidenceWindow = evidenceOpen ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 760, padding: 'calc(var(--app-top-chrome, 0px) + 1.5rem) 0.75rem 1.5rem', overflowY: 'auto' }} onClick={() => (evSaving ? null : setEvidenceOpen(false))}>
      <div role="dialog" aria-modal="true" aria-labelledby="person-evidence-title" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.1rem 1.2rem 1rem', width: '100%', maxWidth: 560, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <h3 id="person-evidence-title" style={{ margin: '0 0 0.15rem', fontSize: '1.05rem' }}>Add evidence</h3>
        <p style={{ margin: '0 0 0.9rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>The day it is about, a title, a memo on what it shows, and the files. It is kept on {personName}’s file and filed in Drive.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.6rem 0.8rem', alignItems: 'end' }}>
          <label style={{ minWidth: 0 }}>
            <span style={fieldLabel}>The day it is about</span>
            <input type="date" value={evDraft.datedOn} max={todayYmd} onChange={(e) => setEvDraft((d) => ({ ...d, datedOn: e.target.value }))} style={input()} />
          </label>
          <label style={{ minWidth: 0 }}>
            <span style={fieldLabel}>Title</span>
            <input type="text" value={evDraft.title} maxLength={160} placeholder="What this is, in a few words" onChange={(e) => setEvDraft((d) => ({ ...d, title: e.target.value }))} style={input()} />
          </label>
        </div>
        <label style={{ display: 'block', marginTop: '0.7rem' }}>
          <span style={fieldLabel}>Memo</span>
          <textarea value={evDraft.memo} rows={3} maxLength={4000} placeholder="What it shows and why it matters. Who sent it, what was said." onChange={(e) => setEvDraft((d) => ({ ...d, memo: e.target.value }))} style={input({ resize: 'vertical' })} />
        </label>
        <div style={{ marginTop: '0.7rem' }}>
          <span style={fieldLabel}>Files</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ padding: '0.4rem 0.8rem', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}>
              {evShrinking ? 'Reading…' : '+ Pick files'}
              <input type="file" multiple disabled={evShrinking} onChange={(e) => { void pickEvidenceFiles(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
            </label>
            <label style={{ padding: '0.4rem 0.8rem', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}>
              Take a photo
              <input type="file" accept="image/*" capture="environment" disabled={evShrinking} onChange={(e) => { void pickEvidenceFiles(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
            </label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>A photo, a PDF, an email, a screenshot. Up to 10 MB each. Photos shrink on the way in. A larger file, or a recording, is linked from Drive below.</span>
          </div>
          {evFiles.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, display: 'grid', gap: '0.25rem' }}>
              {evFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ color: 'var(--text-muted)', flex: 'none' }}>{evidenceKindWords(f.type)} · {evidenceSizeWords(f.size)}</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setEvFiles((prev) => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                </li>
              ))}
            </ul>
          ) : null}
          {/* A file already in Drive (v2.6541): linked, never staged. The row takes a name and the link; + Add the link keeps it on the list. */}
          <div style={{ marginTop: '0.6rem' }} data-testid="evidence-link-row">
            <span style={fieldLabel}>Or a file already in Drive</span>
            {/* The name, the link and the press wrap onto their own lines at phone width. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <input type="text" value={evLinkDraft.name} maxLength={200} placeholder="Its name" aria-label="Linked file name" onChange={(e) => setEvLinkDraft((d) => ({ ...d, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEvidenceLink() } }} style={input({ width: 'auto', flex: '1 1 9rem', minWidth: 0 })} />
              <input type="url" value={evLinkDraft.driveUrl} placeholder="https://drive.google.com/file/d/…" aria-label="Drive link" onChange={(e) => setEvLinkDraft((d) => ({ ...d, driveUrl: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEvidenceLink() } }} style={input({ width: 'auto', flex: '2 1 14rem', minWidth: 0 })} />
              <button type="button" onClick={addEvidenceLink} disabled={!!evLinkDraftProblem || !(evLinkDraft.name.trim() || evLinkDraft.driveUrl.trim())} data-testid="evidence-add-link" style={{ padding: '0.45rem 0.8rem', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: evLinkDraftProblem || !(evLinkDraft.name.trim() || evLinkDraft.driveUrl.trim()) ? 'var(--text-faint)' : 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                + Add the link
              </button>
            </div>
          </div>
          {evLinkDraftProblem ? <p style={{ margin: '0.3rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{evLinkDraftProblem}</p> : null}
          {evLinks.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, display: 'grid', gap: '0.25rem' }} data-testid="evidence-links">
              {evLinks.map((l, i) => (
                <li key={`${l.driveUrl}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <span aria-hidden>🔗</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  <span style={{ color: 'var(--text-muted)', flex: 'none' }}>in Drive, linked</span>
                  <button type="button" aria-label={`Remove the link ${l.name}`} onClick={() => setEvLinks((prev) => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div style={{ marginTop: '0.8rem' }}>
          <ThemeMarkPicker themes={themes} draft={evMark} onChange={setEvMark} testId="evidence-theme-picker" />
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginTop: '0.8rem', fontSize: '0.8rem', cursor: 'pointer' }} data-testid="evidence-counsel-only">
          <input type="checkbox" checked={Boolean(evDraft.counselOnly)} onChange={(e) => setEvDraft((d) => ({ ...d, counselOnly: e.target.checked }))} style={{ marginTop: 2 }} />
          <span>
            <span style={{ fontWeight: 600 }}>Counsel-only.</span> Kept here only: never filed in Drive. Devs read it, and so does the dev seat their agents use. The HR agent's key does not.
          </span>
        </label>
        <p style={{ margin: '0.8rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          {evDraft.counselOnly ? (
            <>Where it goes: <span style={{ color: 'var(--text-base)' }}>kept here only, counsel-only. Not filed in Drive.</span></>
          ) : (
            <>Where it goes: <span style={{ color: 'var(--text-base)' }}>{evidenceDrivePathWords(personName, { dated_on: evDraft.datedOn || todayYmd, title: evDraft.title.trim() || 'untitled' })}</span></>
          )}
        </p>
        {evTried && evProblem ? <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-red-600)' }}>{evProblem}</p> : null}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem', justifyContent: 'flex-end' }}>
          <button type="button" disabled={evSaving} onClick={() => setEvidenceOpen(false)} style={{ padding: '0.45rem 0.9rem', borderRadius: 7, fontSize: '0.84rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" disabled={evSaving || evShrinking} onClick={() => void saveEvidence()} style={{ padding: '0.45rem 1rem', borderRadius: 7, fontSize: '0.84rem', fontWeight: 600, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', opacity: evSaving ? 0.6 : 1 }}>
            {evSaving ? 'Keeping…' : 'Keep the evidence'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  /** Ask the file what numbering the old records would do (a dry run), or do it. */
  const askNumbering = async (rest: boolean, write: boolean) => {
    if (!personId || numberingBusy) return
    setNumberingBusy(true)
    const r = await runExhibitBackfill({ personId, dryRun: !write, numberRest: rest })
    setNumberingBusy(false)
    if (!r.ok) {
      showToast(`The numbering was not read: ${r.why}`, 'error')
      return
    }
    if (!write) {
      setNumbering({ report: r.report, rest })
      return
    }
    showToast(`${countedLabel('Numbered', r.report.numbered + r.report.no_number_numbered, ['record', 'records'])}. The titles are as they were.`, 'success')
    setNumbering(null)
    await reloadNumbers()
  }

  /** Punch list #315: records made before the file numbered them. The dry run is read first; nothing is guessed. */
  const numberingStrip = (
    <div style={{ ...CARD, marginBottom: '0.7rem', fontSize: '0.82rem', color: 'var(--text-base)' }} data-testid="evidence-numbering">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span>
          {unnumbered} {unnumbered === 1 ? 'record has' : 'records have'} no number from the file yet. A record keeps its title either way.
        </span>
        {numbering === null ? (
          <button type="button" disabled={numberingBusy} onClick={() => void askNumbering(false, false)} style={smallPress(false)}>
            {numberingBusy ? 'Reading…' : 'See what numbering would do'}
          </button>
        ) : null}
      </div>
      {numbering ? (
        <div style={{ marginTop: '0.5rem' }}>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {exhibitBackfillWords(numbering.report).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {numbering.report.clashes.length > 0 ? (
            <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="evidence-numbering-clashes">
              {numbering.report.clashes.map((c) => (
                <div key={c.number}>
                  {exhibitLabel(c.number)} is worn by: {c.records.map((x) => `${dayWordsWithYear(x.day)} ${x.title}`).join(' · ')}
                </div>
              ))}
            </div>
          ) : null}
          {numbering.report.no_number.length > 0 || numbering.rest ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.45rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={numbering.rest} disabled={numberingBusy} onChange={(e) => void askNumbering(e.target.checked, false)} />
              Also number the titles with no number, after the highest
            </label>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.55rem' }}>
            <button
              type="button"
              disabled={numberingBusy || numbering.report.numbered + numbering.report.no_number_numbered === 0}
              onClick={() => void askNumbering(numbering.rest, true)}
              style={{ ...smallPress(true), ...(numberingBusy || numbering.report.numbered + numbering.report.no_number_numbered === 0 ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}) }}
            >
              {countedLabel('Number', numbering.report.numbered + numbering.report.no_number_numbered, ['record', 'records'])}
            </button>
            <button type="button" onClick={() => setNumbering(null)} style={smallPress(false)}>
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )

  const evidenceView = (() => {
    const older = sources?.attachments ?? []
    const nothing = evidenceRecords.length === 0 && older.length === 0
    // v2.6554: counsel-only records fold behind a filter once there is one; All shows every record.
    const counselCount = evidenceRecords.filter((r) => r.counsel_only).length
    const shownRecords = evFilter === 'counsel' ? evidenceRecords.filter((r) => r.counsel_only) : evidenceRecords
    return (
      <div style={{ maxWidth: '88ch' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {evidenceRecords.length > 0 ? evidenceCountWords(evidenceRecords) : 'What is on file about them, each with the day, a title, a memo and its files.'}
            {' '}Filed in Drive under {PEOPLE_FOLDER_WORDS} › {personName}.
          </span>
          {counselCount > 0 ? (
            <span role="group" aria-label="Show which records" style={{ display: 'inline-flex', gap: '0.3rem' }} data-testid="evidence-filter">
              <button type="button" aria-pressed={evFilter === 'all'} onClick={() => setEvFilter('all')} style={filterChip(evFilter === 'all')}>
                All · {evidenceRecords.length}
              </button>
              <button type="button" aria-pressed={evFilter === 'counsel'} onClick={() => setEvFilter('counsel')} style={filterChip(evFilter === 'counsel')}>
                🔒 Counsel-only · {counselCount}
              </button>
            </span>
          ) : null}
          {canWrite ? (
            <button type="button" onClick={openEvidenceWindow} style={{ marginLeft: 'auto', padding: '0.3rem 0.75rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add evidence
            </button>
          ) : null}
        </div>
        {canWrite && unnumbered > 0 ? numberingStrip : null}
        {nothing ? (
          <EmptyState compact main="No evidence on file yet." {...(canWrite ? { next: { label: '+ Add evidence', onPress: openEvidenceWindow }, tail: 'keeps the first: the day, a title, a memo and the files.' } : {})} />
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
              {shownRecords.map((r) => {
                const state = evidenceDriveState(r)
                const on = r.entry_id ? lineByEntryId.get(r.entry_id) : null
                const stateLook: LaneLook = state === 'filed' ? FACT_TONE.green : state === 'held' ? FACT_TONE.red : FACT_TONE.amber
                return (
                  <li key={r.id} data-person-evidence={r.id} style={{ ...CARD, display: 'grid', gridTemplateColumns: '5.6rem 1fr', gap: '0.3rem 0.8rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', paddingTop: 2, whiteSpace: 'nowrap' }}>{dayWordsWithYear(r.dated_on)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                        {exhibitBeside(r) ? <span style={{ ...chip(FACT_TONE.gray), marginRight: '0.4rem' }} data-testid={`evidence-exhibit-${r.id}`}>{exhibitBeside(r)}</span> : null}
                        {r.title}
                      </div>
                      {r.memo ? <div style={{ fontSize: '0.84rem', color: 'var(--text-base)', marginTop: '0.2rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.memo}</div> : null}
                      {r.files.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.45rem' }}>{r.files.map((f) => evidenceFileChip(f, r))}</div> : null}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.7rem', marginTop: '0.45rem', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                        <span style={chip(r.counsel_only ? FACT_TONE.gray : stateLook)} data-testid={r.counsel_only ? 'evidence-counsel-chip' : undefined}>{r.counsel_only ? '🔒 ' : ''}{evidenceDriveWords(r)}</span>
                        {transcriptByEvidenceId.has(r.id) ? (
                          <button type="button" onClick={() => { const t = transcriptByEvidenceId.get(r.id); if (t) openTranscript(t.id) }} aria-label={`Open the transcript of ${r.title}`} data-testid="evidence-transcript-chip" style={{ ...chip(FACT_TONE.gray), border: 'none', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600 }}>
                            Transcript on file ›
                          </button>
                        ) : null}
                        {r.counsel_only ? null : r.drive_folder_url ? (
                          <a href={r.drive_folder_url} target="_blank" rel="noopener" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
                            Open the folder in Drive ›
                          </a>
                        ) : canWrite && state !== 'filed' ? (
                          <button type="button" disabled={evRetryId === r.id} onClick={() => void retryDrive(r.id)} style={{ font: 'inherit', fontSize: '0.72rem', color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {evRetryId === r.id ? 'Asking Drive…' : 'Try Drive again'}
                          </button>
                        ) : null}
                        {on ? <span>On the {dayWords(on.ymd)} entry</span> : null}
                        <span>{(r.created_by ? sources?.input.namesById[r.created_by] : null) ?? r.author_label ?? 'a dev'} · kept {formatIsoDate(r.created_at)}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {older.length > 0 ? (
              <section aria-label="Files from before records" style={{ marginTop: '1.1rem' }}>
                <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>Files from before records</h4>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>Kept here only, each on the entry it was attached to. Not in Drive.</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }}>
                  {older.map((a) => {
                    const on = a.entry_id ? lineByEntryId.get(a.entry_id) : null
                    return (
                      <li key={a.id} style={{ ...CARD, padding: '0.55rem 0.8rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem 0.8rem', alignItems: 'start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{a.filename}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.7rem' }}>
                            <span>{evidenceKindWords(a.mime_type)}{a.size_bytes !== null ? ` · ${formatBytes(a.size_bytes)}` : ''}</span>
                            <span>added {formatIsoDate(a.created_at)}</span>
                            <span>{a.author_label ?? (a.uploaded_by ? sources?.input.namesById[a.uploaded_by] ?? 'a dev' : 'a dev')}</span>
                            {on ? <span>on the {on.ymd.slice(0, 4) === todayYmd.slice(0, 4) ? dayWords(on.ymd) : dayWordsWithYear(on.ymd)} entry</span> : null}
                          </div>
                        </div>
                        <button type="button" onClick={() => void openAttachment(a)} style={{ padding: '0.3rem 0.7rem', borderRadius: 7, fontSize: '0.78rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Open
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    )
  })()

  const saveDoc = useCallback(async () => {
    if (!docEdit || !personId) return
    setDocSaving(true)
    try {
      if (docEdit.kind === 'document') {
        // A named document (v2.6614): the same function, by its id; the list and the open document read again after.
        const out = await savePersonDocument({ personId, docId: docEdit.docId ?? null, title: docEdit.title ?? null, markdown: docEdit.draft, expectUpdatedAt: docEdit.loadedUpdatedAt })
        if (!out.ok) {
          showToast(hrDocSaveFailureWords('document', out.why), 'error')
          return
        }
        showToast('The document is saved. The prior version is in its history.', 'success')
        setDocEdit(null)
        await reloadDocuments()
        if (docEdit.docId) await openDocument(docEdit.docId)
        onChanged?.()
        return
      }
      // The same function the dev seat writes through (dev_person_doc_write, 20261107013000): the whole text, with the
      // updated_at this editor loaded; the prior version is archived by the table's trigger.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('dev_person_doc_write', {
        p: hrDocSavePayload({ personId, kind: docEdit.kind, markdown: docEdit.draft, loadedUpdatedAt: docEdit.loadedUpdatedAt }),
        p_dry_run: false,
      })
      if (error) {
        showToast(hrDocSaveFailureWords(docEdit.kind, formatErrorMessage(error, 'the save was refused')), 'error')
        return
      }
      showToast(`The ${docEdit.kind} is saved. The prior version is in its history.`, 'success')
      setDocEdit(null)
      await load()
      onChanged?.()
    } catch (e) {
      showToast(hrDocSaveFailureWords(docEdit.kind, formatErrorMessage(e, 'the save was refused')), 'error')
    } finally {
      setDocSaving(false)
    }
  }, [docEdit, personId, showToast, load, onChanged, reloadDocuments, openDocument])

  /** The edit box (v2.6610), for one of the fixed two or, since v2.6614, a named document. */
  const renderEditor = (kind: HrDocTarget) => {
    if (!docEdit) return null
    const state = hrDocDraftWords(kind, docEdit.draft, docEdit.original)
    const live = state.changed && !docSaving
    return (
      <div style={{ ...CARD, maxWidth: '70ch', padding: '0.75rem 0.9rem' }} data-testid={`hr-doc-editor-${kind}`}>
        <textarea
          aria-label={`The ${kind}`}
          value={docEdit.draft}
          onChange={(e) => setDocEdit({ ...docEdit, draft: e.target.value })}
          rows={kind === 'summary' ? 14 : 28}
          autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.82rem', lineHeight: 1.45, background: 'var(--bg-page)', color: 'var(--text-base)', resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        />
        <p style={{ margin: '0.5rem 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>Markdown, as the agent writes it. {state.words}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void saveDoc()}
            disabled={!live}
            style={{ padding: '0.4rem 0.9rem', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: live ? 'pointer' : 'default', background: live ? '#2563eb' : DEAD_PRESS_FILL, color: live ? '#fff' : DEAD_PRESS_TEXT }}
          >
            {docSaving ? 'Saving…' : `Save the ${kind}`}
          </button>
          <button type="button" onClick={() => setDocEdit(null)} disabled={docSaving} style={{ padding: '0.4rem 0.7rem', borderRadius: 7, fontSize: '0.82rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
        {docEdit.draft.trim() !== '' ? (
          <details style={{ marginTop: '0.6rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)' }}>How it will read</summary>
            {/* The draft, rendered the way the saved text is: marked and the contract sanitizer. */}
            <div className="hr-doc-body" style={{ ...CARD, marginTop: '0.5rem', padding: '1rem 1.2rem', fontSize: '0.9rem' }} dangerouslySetInnerHTML={{ __html: hrDocMarkdownToSafeHtml(docEdit.draft) }} />
          </details>
        ) : null}
      </div>
    )
  }

  /**
   * Punch list #315 (upgrade 5a): when each section last changed and how many entries were written since. A fold, read
   * when opened: the prior versions are whole texts, so nothing is fetched until a dev asks.
   */
  const renderDocFreshness = (doc: PersonFileDoc, kind: 'summary' | 'narrative') => {
    const read = docRevisions[kind]
    const rows = read?.state === 'ready' ? sectionFreshness({ content: doc.content, updatedAt: doc.updated_at, revisions: read.revisions, entries: freshnessEntries }) : []
    return (
      <details
        data-testid={`hr-doc-freshness-${kind}`}
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open) void openDocFreshness(kind)
        }}
        style={{ maxWidth: '70ch', marginBottom: '0.7rem', fontSize: '0.8rem' }}
      >
        <summary style={{ cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600 }}>When each section last changed</summary>
        {!read || read.state === 'loading' ? (
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)' }}>Reading the earlier versions…</p>
        ) : read.state === 'held' ? (
          <p role="alert" style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)' }}>
            The earlier versions could not be read: {read.why}
          </p>
        ) : (
          <div style={{ marginTop: '0.4rem' }}>
            <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>
              {sectionFreshnessHeadWords(rows)}.{read.capped ? ` Read against the newest ${read.revisions.length} earlier versions.` : ''}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {rows.map((r) => (
                <li key={r.key} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.6rem', alignItems: 'baseline', padding: '0.3rem 0', borderTop: '1px solid var(--border)', paddingLeft: `${Math.max(0, r.level - 2) * 0.8}rem` }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-base)', overflowWrap: 'anywhere' }}>{r.heading || 'Before the first heading'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{sectionChangedWords(r, calendarYmdInAppTzFromIso)}</span>
                  {sectionNewerWords(r) ? <span style={sectionNeedsALook(r) ? chip(FACT_TONE.amber) : { color: 'var(--text-muted)' }}>{sectionNewerWords(r)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
    )
  }

  const renderDoc = (doc: PersonFileDoc | undefined, kind: 'summary' | 'narrative') => {
    const fr = freshness
    const html = doc ? hrDocMarkdownToSafeHtml(doc.content) : ''
    const headings = doc && kind === 'narrative' ? extractHrDocHeadings(doc.content) : []
    return (
      <section aria-label={kind === 'summary' ? 'Summary' : 'Narrative'} style={{ marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', margin: '0 0 0.4rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>{kind === 'summary' ? 'Summary' : 'Narrative'}</h4>
          {viewer.isDev && personId && docEdit === null ? (
            <button
              type="button"
              aria-label={`${doc ? 'Edit' : 'Write'} the ${kind}`}
              onClick={() => setDocEdit({ kind, draft: doc?.content ?? '', original: doc?.content ?? '', loadedUpdatedAt: doc?.updated_at ?? null })}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}
            >
              {doc ? 'Edit' : 'Write'} the {kind}
            </button>
          ) : null}
        </div>
        {docEdit?.kind === kind ? renderEditor(kind) : doc ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <span>Kept by {doc.author_label ?? 'the agent'}</span>
              <span>
                {kind === 'summary' ? 'rewritten' : 'last extended'} {formatIsoDate(doc.updated_at)}
              </span>
              {doc.covered_through && <span>covers through {formatIsoDate(doc.covered_through)}</span>}
              {kind === 'summary' && fr && fr.entryCount > 0 && (
                <span>
                  {fr.coveredCount} of {fr.entryCount} entries
                </span>
              )}
              {kind === 'summary' && fr?.state === 'current' && <span style={{ color: 'var(--text-green-600)', fontWeight: 600 }}>● current</span>}
            </div>
            {kind === 'summary' && fr?.state === 'stale' && (
              <div style={{ background: 'var(--bg-amber-tint)', border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8rem', marginBottom: '0.6rem', maxWidth: '70ch' }}>
                {fr.entryCount - fr.coveredCount} newer {fr.entryCount - fr.coveredCount === 1 ? 'entry' : 'entries'} since this was rewritten
                {fr.staleDays > 0 ? `, ${fr.staleDays} days behind` : ''}. Ask the agent to bring it current, or press Edit the summary.
              </div>
            )}
            {viewer.isDev ? renderDocFreshness(doc, kind) : null}
            {headings.length > 2 && (
              <nav aria-label="Jump to section" style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.8rem', marginBottom: '0.8rem', maxWidth: '70ch', fontSize: '0.8rem' }}>
                <div style={{ textTransform: 'uppercase', fontSize: '0.64rem', letterSpacing: '0.07em', color: 'var(--text-faint)', fontWeight: 700, marginBottom: '0.35rem' }}>Jump to</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.9rem' }}>
                  {headings.map((h) => {
                    const n = kind === 'narrative' ? headingNumber(h.text) : null
                    const cited = n !== null ? (citesBySection.get(n)?.length ?? 0) : 0
                    const citedCorrected = n !== null ? (citesBySection.get(n) ?? []).filter((l) => correctedLineKeys.has(l.key)).length : 0
                    return (
                    <span key={h.slug} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem' }}>
                    <a
                      href={`#${h.slug}`}
                      onClick={(ev) => {
                        ev.preventDefault()
                        hrDocRef.current?.querySelector(`#${CSS.escape(h.slug)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      style={{ color: 'var(--text-link)', textDecoration: 'none', paddingLeft: `${(h.level - 1) * 0.7}rem`, whiteSpace: 'nowrap' }}
                    >
                      {h.text}
                    </a>
                    {cited > 0 && n !== null ? (
                      <button type="button" aria-label={`Section ${n}: ${citedByWords(cited)}${citedCorrected > 0 ? `, ${citedCorrectedWords(citedCorrected)}` : ''}`} aria-expanded={citedOpen === n} onClick={() => setCitedOpen((prev) => (prev === n ? null : n))} style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 700, color: citedCorrected > 0 ? 'var(--text-amber-800)' : citedOpen === n ? 'var(--text-link)' : 'var(--text-muted)', background: citedCorrected > 0 ? 'var(--bg-amber-tint)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '0 0.4rem', cursor: 'pointer', lineHeight: 1.5 }}>
                        {cited}
                      </button>
                    ) : null}
                    </span>
                    )
                  })}
                </div>
                {kind === 'narrative' && citedOpen !== null && (citesBySection.get(citedOpen)?.length ?? 0) > 0 ? (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }} data-testid="hr-doc-cited-by">
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Section {citedOpen} · {citedByWords(citesBySection.get(citedOpen)?.length ?? 0)}{(citesBySection.get(citedOpen) ?? []).some((l) => correctedLineKeys.has(l.key)) ? `, ${citedCorrectedWords((citesBySection.get(citedOpen) ?? []).filter((l) => correctedLineKeys.has(l.key)).length)}` : ''}. Press one to open the Timeline on it.</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {(citesBySection.get(citedOpen) ?? []).map((l) => (
                        <button key={l.key} type="button" onClick={() => openOnTimeline(l.key)} style={chip(correctedLineKeys.has(l.key) ? FACT_TONE.amber : FACT_TONE.gray, { cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, lineHeight: 'inherit' })}>
                          {dayWords(l.ymd)} · {(l.what.split('\n')[0] ?? '').slice(0, 48)}
                          {correctedLineKeys.has(l.key) ? ' · corrected since' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </nav>
            )}
            {doc.content.trim() === '' ? (
              <div style={{ ...CARD, maxWidth: '70ch' }}>
                <span style={{ color: 'var(--text-muted)' }}>Empty.</span>
              </div>
            ) : (
              <div
                ref={kind === 'narrative' ? hrDocRef : undefined}
                className="hr-doc-body"
                style={{ ...CARD, padding: '1rem 1.2rem', fontSize: '0.9rem', maxWidth: '70ch' }}
                // Agent-authored markdown, rendered through marked and the contract sanitizer.
                dangerouslySetInnerHTML={{ __html: injectHeadingIds(html, headings) }}
              />
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', maxWidth: '60ch' }}>
            No {kind} yet. The agent writes it from the line. Add what happened there and ask it to build the {kind}.
          </div>
        )}
      </section>
    )
  }

  // ─── Documents (v2.6614, punch list #277): the two the agent keeps, then the named ones, then the doors to add one ───
  const OUTLINE_PRESS: CSSProperties = { padding: '0.3rem 0.75rem', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }
  const QUIET_PRESS: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 7, fontSize: '0.8rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }
  const COUNSEL_CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.1rem 0.55rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
  const FIELD: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.84rem', background: 'var(--bg-page)', color: 'var(--text-base)' }

  const startAdd = (how: 'write' | 'file' | 'paste') => {
    setOpenDoc(null)
    setDocEdit(null)
    setAddDoc({ how, title: '', text: '', counselOnly: false, fileName: null, why: null, saving: false })
  }

  const pickDocumentFile = (files: FileList | null) => {
    const f = files?.[0]
    if (!f || !addDoc) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const check = checkDocumentFile(f.name, text)
      setAddDoc((prev) => {
        if (!prev) return prev
        if (!check.ok) return { ...prev, why: check.why, fileName: null, text: '' }
        return { ...prev, why: null, fileName: f.name, text: check.text, title: prev.title.trim() ? prev.title : check.title }
      })
    }
    reader.onerror = () => setAddDoc((prev) => (prev ? { ...prev, why: `${f.name} could not be read.`, fileName: null, text: '' } : prev))
    reader.readAsText(f)
  }

  const submitAdd = async () => {
    if (!addDoc || !personId) return
    const title = cleanDocumentTitle(addDoc.title)
    if (!title || addDoc.text.trim() === '') return
    setAddDoc({ ...addDoc, saving: true })
    const out = await savePersonDocument({ personId, docId: null, title, markdown: addDoc.text, expectUpdatedAt: null, counselOnly: addDoc.counselOnly })
    if (!out.ok) {
      showToast(`Could not add the document: ${out.why}`, 'error')
      setAddDoc({ ...addDoc, saving: false })
      return
    }
    showToast(`${title} is on the file.`, 'success')
    setAddDoc(null)
    await reloadDocuments()
    if (out.docId) await openDocument(out.docId)
    onChanged?.()
  }

  const renderAddDocument = () => {
    if (!addDoc) return null
    const ready = cleanDocumentTitle(addDoc.title) !== '' && addDoc.text.trim() !== '' && !addDoc.saving
    return (
      <div style={{ ...CARD, maxWidth: '70ch', padding: '0.75rem 0.9rem' }} data-testid="hr-doc-add">
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{addDoc.how === 'file' ? 'Add a document from a file' : addDoc.how === 'paste' ? 'Add a document from pasted text' : 'Write a document'}</div>
        <input type="text" aria-label="Document title" value={addDoc.title} maxLength={160} placeholder="Its title" onChange={(e) => setAddDoc({ ...addDoc, title: e.target.value })} style={FIELD} />
        {addDoc.how === 'file' ? (
          <div style={{ margin: '0.5rem 0', display: 'grid', gap: '0.35rem' }}>
            <input type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" aria-label="The file" onChange={(e) => { pickDocumentFile(e.target.files); e.target.value = '' }} style={{ fontSize: '0.82rem' }} />
            {addDoc.fileName ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{addDoc.fileName} · {addDoc.text.length.toLocaleString('en-US')} characters, read in the browser; nothing leaves it until Add.</div> : null}
            {addDoc.why ? <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-600)' }}>{addDoc.why}</div> : null}
          </div>
        ) : (
          <textarea aria-label="The document" value={addDoc.text} rows={16} placeholder={addDoc.how === 'paste' ? 'Paste the text here' : 'Markdown or plain text'} onChange={(e) => setAddDoc({ ...addDoc, text: e.target.value })} style={{ ...FIELD, margin: '0.5rem 0', resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem', lineHeight: 1.45 }} />
        )}
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem', margin: '0.4rem 0 0.6rem', color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={addDoc.counselOnly} onChange={(e) => setAddDoc({ ...addDoc, counselOnly: e.target.checked })} data-testid="hr-doc-add-counsel" />
          Counsel-only: kept inside the circle, left out of Copy as text
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void submitAdd()} disabled={!ready} style={{ padding: '0.4rem 0.9rem', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: ready ? 'pointer' : 'default', background: ready ? '#2563eb' : DEAD_PRESS_FILL, color: ready ? '#fff' : DEAD_PRESS_TEXT }}>
            {addDoc.saving ? 'Adding…' : 'Add the document'}
          </button>
          <button type="button" onClick={() => setAddDoc(null)} disabled={addDoc.saving} style={QUIET_PRESS}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  /**
   * v2.6713 (punch list #287): the record a document transcribes — its title, day and hash as a press that opens the record,
   * the record's file chips (the audio's door), and *Transcribes…*, a picker over the person's records that ties or unties it.
   */
  const renderTranscribes = (d: PersonDocumentRow) => {
    const record = d.evidence_id ? evidenceById.get(d.evidence_id) ?? null : null
    if (!record && !d.evidence_id && evidenceRecords.length === 0) return null
    return (
      <div data-testid="hr-doc-transcribes" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
        {record ? (
          <>
            <button type="button" aria-label={`Open the evidence record ${record.title}`} title="Open the record on the Evidence tab" onClick={() => openEvidenceRecord(record.id)} style={{ ...chip(FACT_TONE.gray), border: 'none', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600 }}>
              {transcribedRecordWords(record, dayWordsWithYear)} ›
            </button>
            {record.files.map((f) => evidenceFileChip(f, record))}
          </>
        ) : d.evidence_id ? (
          <span style={chip(FACT_TONE.gray)}>Transcribes a record not on this file</span>
        ) : null}
        {tiePicking ? (
          <>
            <select aria-label="The record this document transcribes" disabled={tieSaving} value={d.evidence_id ?? ''} onChange={(e) => void tieRecord(d, e.target.value || null)} style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', maxWidth: '100%' }}>
              <option value="">— none —</option>
              {evidenceRecords.map((r) => {
                const taken = transcriptByEvidenceId.get(r.id)
                return (
                  <option key={r.id} value={r.id}>
                    {recordPickWords(r, dayWordsWithYear, taken && taken.id !== d.id ? taken : null)}
                  </option>
                )
              })}
            </select>
            <button type="button" onClick={() => setTiePicking(false)} disabled={tieSaving} style={QUIET_PRESS}>
              Cancel
            </button>
          </>
        ) : evidenceRecords.length > 0 ? (
          <button type="button" onClick={() => setTiePicking(true)} style={QUIET_PRESS}>
            {d.evidence_id ? 'Change the record…' : 'Transcribes…'}
          </button>
        ) : null}
      </div>
    )
  }

  const renderOpenDocument = (d: PersonDocumentRow) => {
    const headings = extractHrDocHeadings(d.content)
    const html = hrDocMarkdownToSafeHtml(d.content)
    const editing = docEdit?.kind === 'document' && docEdit.docId === d.id
    const copy = () => {
      navigator.clipboard.writeText(d.content).then(
        () => showToast('Copied the text.', 'success'),
        () => showToast('Could not copy: the clipboard refused.', 'error'),
      )
    }
    return (
      <section aria-label={d.title} data-testid="hr-doc-open">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
          <button type="button" onClick={() => { setOpenDoc(null); setDocEdit(null) }} style={QUIET_PRESS}>
            ‹ Documents
          </button>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{d.title}</h3>
          {d.counsel_only ? <span style={COUNSEL_CHIP} data-testid="hr-doc-counsel-chip">🔒 Counsel-only</span> : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
          <span>{documentKeptByWords(d)}</span>
          <span>saved {formatIsoDate(d.updated_at)}</span>
          <span>{documentSizeWords({ chars: d.content.length, sections: headings.length })}</span>
          {!editing ? (
            <>
              <button type="button" onClick={() => setDocEdit({ kind: 'document', docId: d.id, title: d.title, draft: d.content, original: d.content, loadedUpdatedAt: d.updated_at })} style={OUTLINE_PRESS}>
                Edit the document
              </button>
              {!d.counsel_only ? (
                <button type="button" onClick={copy} style={QUIET_PRESS}>
                  Copy as text
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {!editing ? renderTranscribes(d) : null}
        {editing ? (
          renderEditor('document')
        ) : (
          <>
            {headings.length > 2 && (
              <nav aria-label="Jump to section" style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.8rem', marginBottom: '0.8rem', maxWidth: '70ch', fontSize: '0.8rem' }}>
                <div style={{ textTransform: 'uppercase', fontSize: '0.64rem', letterSpacing: '0.07em', color: 'var(--text-faint)', fontWeight: 700, marginBottom: '0.35rem' }}>Jump to</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.9rem' }}>
                  {headings.map((h) => (
                    <a
                      key={h.slug}
                      href={`#${h.slug}`}
                      onClick={(ev) => {
                        ev.preventDefault()
                        namedDocRef.current?.querySelector(`#${CSS.escape(h.slug)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      style={{ color: 'var(--text-link)', textDecoration: 'none', paddingLeft: `${(h.level - 1) * 0.7}rem`, whiteSpace: 'nowrap' }}
                    >
                      {h.text}
                    </a>
                  ))}
                </div>
              </nav>
            )}
            <div
              ref={namedDocRef}
              className="hr-doc-body"
              style={{ ...CARD, padding: '1rem 1.2rem', fontSize: '0.9rem', maxWidth: '70ch' }}
              // The document's markdown, rendered through marked and the contract sanitizer, as the narrative is.
              dangerouslySetInnerHTML={{ __html: injectHeadingIds(html, headings) }}
            />
          </>
        )}
      </section>
    )
  }

  const documentsTab = documentsTabCount({ hasSummary: Boolean(sources?.docs.summary), hasNarrative: Boolean(sources?.docs.narrative), named: documents.length })
  const documentsView = viewer.isDev ? (
    openDoc ? (
      renderOpenDocument(openDoc)
    ) : (
      <div>
        {renderDoc(sources?.docs.summary, 'summary')}
        {renderDoc(sources?.docs.narrative, 'narrative')}
        <section aria-label="Named documents" style={{ marginBottom: '1.1rem' }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>Named documents</h4>
          {documentsHeld ? (
            <p role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-600)', margin: '0 0 0.5rem' }}>The documents could not be read: {documentsHeld}</p>
          ) : null}
          {documents.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: '0 0 0.7rem', padding: 0, display: 'grid', gap: '0.5rem', maxWidth: '70ch' }}>
              {documents.map((r) => (
                <li key={r.id} style={{ ...CARD, display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{r.title}</span>
                      {r.counsel_only ? <span style={COUNSEL_CHIP}>🔒 Counsel-only</span> : null}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {documentKeptByWords(r)} · {formatIsoDate(r.updated_at)} · {documentSizeWords(r)}
                    </div>
                  </div>
                  <button type="button" aria-label={`Open ${r.title}`} onClick={() => void openDocument(r.id)} style={OUTLINE_PRESS}>
                    Open
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {addDoc ? (
            renderAddDocument()
          ) : (
            <div style={{ ...CARD, maxWidth: '70ch', borderStyle: 'dashed', display: 'grid', gap: '0.5rem' }}>
              <div>
                <strong>Add a document</strong> <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>· a title and markdown or plain text; the prior version of every save stays in its history</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => startAdd('write')} style={OUTLINE_PRESS}>Write it</button>
                <button type="button" onClick={() => startAdd('file')} style={OUTLINE_PRESS}>From a file (.md or .txt)</button>
                <button type="button" onClick={() => startAdd('paste')} style={OUTLINE_PRESS}>Paste text</button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>From a file reads the file in the browser and saves it as it is, so a long document lands in one press.</div>
            </div>
          )}
        </section>
      </div>
    )
  ) : (
    <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>The summary, the narrative and the documents are kept by the dev.</div>
  )

  // ─── the frame ─────────────────────────────────────────────────────────────

  // The strip's Matter chip (v2.6582): the matter's stage once one stands on the person, a press to the Matter view.
  const matterChip = personMatterChipWords(matterStanding)

  const heldWords = (sources?.held ?? []).map((h) => `${PERSON_TIMELINE_SOURCES.find((s) => s.source === h.source)?.label ?? h.source} (${h.reason})`)

  const themesView = (
    <PersonThemesView
      personName={personName}
      themes={themes}
      marks={marks}
      lines={lines}
      themeId={byThemeId}
      onPickTheme={(id) => {
        setByThemeId(id)
        onThemePicked?.(id)
      }}
      canWrite={canWrite}
      namesById={sources?.input.namesById ?? {}}
      renderFiles={(line) => line.attachmentIds.map(fileChipById).filter(Boolean)}
      onOpenOnTimeline={openOnTimeline}
      onKeepMark={keepOneMark}
      onRemoveMark={removeMarkFromWindow}
    />
  )

  return (
    <div data-person-file-panel>
      {facts ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem', alignItems: 'center' }}>
          {personFileFactChips(facts).map((c) => {
            // v2.6820: a chip is a press that narrows the Timeline to what it counts — *1 paper signed* lists the papers, each with
            // its door to the signed record — and a second press on the same chip clears the filter.
            const on = view === 'timeline' && lane === (c.filter.lane ?? null) && source === (c.filter.source ?? null)
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                title={on ? 'Show the whole record' : `Show only these on the Timeline`}
                data-testid={`person-file-chip-${c.key}`}
                onClick={() => {
                  setThemeFilter(null)
                  setView('timeline')
                  setLane(on ? null : c.filter.lane ?? null)
                  setSource(on ? null : c.filter.source ?? null)
                }}
                style={chip(FACT_TONE[c.tone], { cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, lineHeight: 'inherit', outline: on ? '2px solid var(--border-blue)' : undefined, outlineOffset: 1 })}
              >
                {c.label}
              </button>
            )
          })}
          {matterChip ? (
            <button type="button" onClick={() => setView('matter')} title="Open the matter" style={chip(FACT_TONE.gray, { cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, lineHeight: 'inherit' })} data-testid="person-file-matter-chip">
              {matterChip}
            </button>
          ) : null}
          {facts.lastYmd ? <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>last on record {dayWords(facts.lastYmd)}{facts.lastYmd.slice(0, 4) !== todayYmd.slice(0, 4) ? `, ${facts.lastYmd.slice(0, 4)}` : ''}</span> : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '0.25rem', margin: '0 0 0.9rem', borderBottom: '1px solid var(--border)', overflowX: 'auto' }} role="tablist" aria-label="The file">
        <button type="button" role="tab" aria-selected={view === 'timeline'} onClick={() => setView('timeline')} style={viewTab(view === 'timeline')}>
          Timeline{counts.total > 0 ? ` (${counts.total})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={view === 'evidence'} onClick={() => setView('evidence')} style={viewTab(view === 'evidence')}>
          Evidence{(sources ? sources.evidence.length + sources.attachments.length : 0) > 0 ? ` (${(sources?.evidence.length ?? 0) + (sources?.attachments.length ?? 0)})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={view === 'narrative'} onClick={() => setView('narrative')} style={viewTab(view === 'narrative')}>
          Documents{documentsTab > 0 ? ` (${documentsTab})` : ''}
        </button>
        {viewer.isDev ? (
          <button type="button" role="tab" aria-selected={view === 'case'} onClick={() => setView('case')} style={viewTab(view === 'case')} data-testid="person-file-tab-case">
            Case{caseItemCounts(caseItems).open > 0 ? ` (${caseItemCounts(caseItems).open})` : ''}
          </button>
        ) : null}
        {viewer.isDev && themes.length > 0 ? (
          <button type="button" role="tab" aria-selected={view === 'themes'} onClick={() => setView('themes')} style={viewTab(view === 'themes')} data-testid="person-file-tab-themes">
            By theme{marks.some((m) => !m.removed_at) ? ` (${new Set(marks.filter((m) => !m.removed_at).map((m) => `${m.target_kind}:${m.target_id}`)).size})` : ''}
          </button>
        ) : null}
        {viewer.isDev ? (
          <button type="button" role="tab" aria-selected={view === 'matter'} onClick={() => setView('matter')} style={viewTab(view === 'matter')} data-testid="person-file-tab-matter">
            Matter
          </button>
        ) : null}
      </div>

      {loadError ? (
        <p role="alert" style={{ color: 'var(--text-red-600)', fontSize: '0.85rem' }}>{loadError}</p>
      ) : !sources ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reading the file…</p>
      ) : (
        <>
          {view === 'timeline' ? timelineView : view === 'evidence' ? evidenceView : view === 'case' ? (personId ? <PersonCaseView personId={personId} canWrite={canWrite} items={caseItems} log={caseLog} heldWhy={caseHeld} onChanged={reloadCase} showToast={showToast} /> : null) : view === 'themes' ? themesView : view === 'matter' ? (personId ? <PersonMatterPanel personId={personId} personName={personName} canEdit={viewer.isDev} changeKey={changeKey} onChanged={() => { void reloadMatter(); onChanged?.() }} namesById={sources?.input.namesById ?? {}} /> : <EmptyState compact main="A matter hangs on a person row, and this login has none yet." />) : documentsView}
          {heldWords.length > 0 ? (
            <p style={{ margin: '1rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>Not read here: {heldWords.join(' · ')}.</p>
          ) : null}
        </>
      )}
      {evidenceWindow}
    </div>
  )
}
