import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { openOrSaveFromStorage } from '../../../lib/storageSave'
import { useAuth } from '../../../hooks/useAuth'
import { useToastContext } from '../../../contexts/ToastContext'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../../utils/dateUtils'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { derivePersonFileFreshness } from '../../../lib/people/personFileFreshness'
import { hrDocMarkdownToSafeHtml, extractHrDocHeadings } from '../../../lib/people/hrDocMarkdown'
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

export type PersonFileView = 'timeline' | 'evidence' | 'narrative'

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
  /** Bump to read the file again (a report filed from the queue above, say). */
  changeKey?: number
  /** Called after this panel writes (an entry, an exhibit), so the host can refresh its own counts. */
  onChanged?: () => void
  initialView?: PersonFileView
  /** Set when the host wants a particular view (the queue's Open their file lands on the timeline). */
  viewKey?: number
}

export function PersonFilePanel({ personId, userId, personName, viewer, changeKey = 0, onChanged, initialView = 'timeline', viewKey = 0 }: PersonFilePanelProps) {
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
  const hrDocRef = useRef<HTMLDivElement>(null)
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
  const lineByEntryId = useMemo(() => {
    const m = new Map<string, PersonTimelineLine>()
    for (const l of lines) if (l.ref.table === 'person_file_entries') m.set(l.ref.id, l)
    return m
  }, [lines])

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
    setSavingEntry(false)
    showToast(`Entry added to the line.${fileWords}${markWords}`, 'success')
    setDraftContent('')
    setDraftDate(todayYmd)
    setComposerOpen(false)
    await load()
    onChanged?.()
  }, [personId, draftContent, savingEntry, draftDate, draftSource, authUser?.id, pendingFiles, showToast, todayYmd, load, onChanged, entryMark, themeNames, reloadThemes])

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

  const evidenceFileChip = (f: PersonEvidenceFile) => (
    <button
      key={f.id}
      type="button"
      onClick={() => void openEvidenceFile(f)}
      title={`${f.filename}${f.size_bytes !== null ? ` · ${evidenceSizeWords(f.size_bytes)}` : ''} · ${evidenceFileWhereWords(f)}`}
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
    if (ev) return evidenceFileChip(ev.file)
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
        <button type="button" onClick={() => { setComposerOpen(false); setDraftContent(''); setPendingFiles([]) }} style={{ padding: '0.4rem 0.7rem', borderRadius: 7, fontSize: '0.82rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
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
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>Entries append and never change. A correction is a new entry that says what it corrects.</p>
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
            {line.door ? (
              <a href={line.door.to} style={{ fontSize: '0.72rem', color: 'var(--text-link)', textDecoration: 'none', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {line.door.label} ›
              </a>
            ) : null}
          </span>
          <span style={{ display: 'block', fontSize: '0.87rem', color: 'var(--text-base)', marginTop: '0.25rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{line.what}</span>
          {line.notes ? <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{line.notes}</span> : null}
          {chips.length > 0 ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>{chips}</span> : null}
          {themeBits(line)}
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
    setEvDraft({ datedOn: todayYmd, title: '', memo: '' })
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
        <p style={{ margin: '0.8rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          Where it goes: <span style={{ color: 'var(--text-base)' }}>{evidenceDrivePathWords(personName, { dated_on: evDraft.datedOn || todayYmd, title: evDraft.title.trim() || 'untitled' })}</span>
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

  const evidenceView = (() => {
    const older = sources?.attachments ?? []
    const nothing = evidenceRecords.length === 0 && older.length === 0
    return (
      <div style={{ maxWidth: '88ch' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {evidenceRecords.length > 0 ? evidenceCountWords(evidenceRecords) : 'What is on file about them, each with the day, a title, a memo and its files.'}
            {' '}Filed in Drive under {PEOPLE_FOLDER_WORDS} › {personName}.
          </span>
          {canWrite ? (
            <button type="button" onClick={openEvidenceWindow} style={{ marginLeft: 'auto', padding: '0.3rem 0.75rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add evidence
            </button>
          ) : null}
        </div>
        {nothing ? (
          <EmptyState compact main="No evidence on file yet." {...(canWrite ? { next: { label: '+ Add evidence', onPress: openEvidenceWindow }, tail: 'keeps the first: the day, a title, a memo and the files.' } : {})} />
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
              {evidenceRecords.map((r) => {
                const state = evidenceDriveState(r)
                const on = r.entry_id ? lineByEntryId.get(r.entry_id) : null
                const stateLook: LaneLook = state === 'filed' ? FACT_TONE.green : state === 'held' ? FACT_TONE.red : FACT_TONE.amber
                return (
                  <li key={r.id} data-person-evidence={r.id} style={{ ...CARD, display: 'grid', gridTemplateColumns: '5.6rem 1fr', gap: '0.3rem 0.8rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', paddingTop: 2, whiteSpace: 'nowrap' }}>{dayWordsWithYear(r.dated_on)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{r.title}</div>
                      {r.memo ? <div style={{ fontSize: '0.84rem', color: 'var(--text-base)', marginTop: '0.2rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.memo}</div> : null}
                      {r.files.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.45rem' }}>{r.files.map(evidenceFileChip)}</div> : null}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.7rem', marginTop: '0.45rem', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                        <span style={chip(stateLook)}>{evidenceDriveWords(r)}</span>
                        {r.drive_folder_url ? (
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

  const renderDoc = (doc: PersonFileDoc | undefined, kind: 'summary' | 'narrative') => {
    const fr = freshness
    const html = doc ? hrDocMarkdownToSafeHtml(doc.content) : ''
    const headings = doc && kind === 'narrative' ? extractHrDocHeadings(doc.content) : []
    return (
      <section aria-label={kind === 'summary' ? 'Summary' : 'Narrative'} style={{ marginBottom: '1.1rem' }}>
        <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>{kind === 'summary' ? 'Summary' : 'Narrative'}</h4>
        {doc ? (
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
                {fr.staleDays > 0 ? `, ${fr.staleDays} days behind` : ''}. Ask the agent to bring it current.
              </div>
            )}
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
                        hrDocRef.current?.querySelector(`#${CSS.escape(h.slug)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      style={{ color: 'var(--text-link)', textDecoration: 'none', paddingLeft: `${(h.level - 1) * 0.7}rem`, whiteSpace: 'nowrap' }}
                    >
                      {h.text}
                    </a>
                  ))}
                </div>
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

  const narrativeView = viewer.isDev ? (
    <div>
      {renderDoc(sources?.docs.summary, 'summary')}
      {renderDoc(sources?.docs.narrative, 'narrative')}
    </div>
  ) : (
    <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>The summary and the narrative are kept by the dev.</div>
  )

  // ─── the frame ─────────────────────────────────────────────────────────────

  const heldWords = (sources?.held ?? []).map((h) => `${PERSON_TIMELINE_SOURCES.find((s) => s.source === h.source)?.label ?? h.source} (${h.reason})`)

  return (
    <div data-person-file-panel>
      {facts ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem', alignItems: 'center' }}>
          {personFileFactChips(facts).map((c) => (
            <span key={c.key} style={chip(FACT_TONE[c.tone])}>
              {c.label}
            </span>
          ))}
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
          Narrative
        </button>
      </div>

      {loadError ? (
        <p role="alert" style={{ color: 'var(--text-red-600)', fontSize: '0.85rem' }}>{loadError}</p>
      ) : !sources ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reading the file…</p>
      ) : (
        <>
          {view === 'timeline' ? timelineView : view === 'evidence' ? evidenceView : narrativeView}
          {heldWords.length > 0 ? (
            <p style={{ margin: '1rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>Not read here: {heldWords.join(' · ')}.</p>
          ) : null}
        </>
      )}
      {evidenceWindow}
    </div>
  )
}
