import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { KINDS, KIND_LABELS } from './peopleUsersTabShared'
import type { PersonKind } from '../../hooks/usePeopleRoster'
import { derivePersonFileFreshness, type PersonFileFreshness } from '../../lib/people/personFileFreshness'
import { hrDocMarkdownToSafeHtml, extractHrDocHeadings } from '../../lib/people/hrDocMarkdown'
import { HrPendingReportsSection } from './HrPendingReportsSection'

/**
 * People → HR (dev-only): per-person HR files. Three layers per person —
 * curated Summary and Narrative docs (person_files, maintained mostly by the
 * agent; READ-ONLY here by design) and the append-only Raw entries log
 * (person_file_entries; the composer here is the only UI write). Corrections
 * are new entries — the table has no UPDATE/DELETE policies at all.
 * Self-contained like PeopleSubsTab: loads everything itself under the
 * caller's RLS (dev-only policies make it empty for anyone else).
 * Convention for what gets written lives in docs/HR_FILES.md.
 */

type HrPerson = {
  id: string
  name: string
  kind: string
  archived_at: string | null
  start_date: string | null
}

type PersonFileRow = {
  person_id: string
  kind: string
  content: string
  updated_at: string
  covered_through: string | null
  author_label: string | null
}

type EntryRow = {
  id: string
  person_id: string
  entry_date: string
  content: string
  source: string
  created_by: string | null
  created_at: string
  author_label: string | null
}

type AttachmentRow = {
  id: string
  person_id: string
  entry_id: string | null
  storage_path: string
  filename: string
  mime_type: string | null
  size_bytes: number | null
  author_label: string | null
  uploaded_by: string | null
  created_at: string
}

type FileView = 'summary' | 'narrative' | 'raw'

const HR_FILES_BUCKET = 'hr-files'

function formatBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function safeUploadName(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120)
}

export const HR_ENTRY_SOURCES = [
  'conversation',
  'payroll_event',
  'incident',
  'review',
  'milestone',
  'job_event',
  'report',
] as const

const SOURCE_LABELS: Record<string, string> = {
  conversation: 'Conversation',
  payroll_event: 'Payroll event',
  incident: 'Incident',
  review: 'Review',
  milestone: 'Milestone',
  job_event: 'Job event',
  report: 'Field report',
}

const SOURCE_CHIP_STYLE: Record<string, { background: string; color: string }> = {
  report: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  conversation: { background: 'var(--bg-slate-100)', color: 'var(--text-slate-600)' },
  payroll_event: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' },
  incident: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  review: { background: 'var(--bg-slate-tint)', color: 'var(--text-violet-700)' },
  milestone: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  job_event: { background: 'var(--bg-slate-100)', color: 'var(--text-slate-600)' },
}

const DOT_COLOR: Record<PersonFileFreshness['state'], string> = {
  current: 'var(--text-green-600)',
  stale: 'var(--text-amber-700)',
  empty: 'var(--text-faint)',
}

function formatYmd(ymd: string | null): string {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatIsoDate(iso: string): string {
  return formatYmd(calendarYmdInAppTzFromIso(iso))
}

/** "1y 5m" tenure from a start date; empty when unknown. */
function tenureLabel(startYmd: string | null, todayYmd: string): string {
  if (!startYmd) return ''
  const [sy, sm] = startYmd.split('-').map(Number)
  const [ty, tm] = todayYmd.split('-').map(Number)
  if (!sy || !sm || !ty || !tm) return ''
  const months = (ty - sy) * 12 + (tm - sm)
  if (months < 0) return ''
  if (months < 12) return `${months}m`
  return `${Math.floor(months / 12)}y ${months % 12}m`
}

/**
 * The sanitizer strips id attributes, so headings in the rendered HTML carry
 * none. Add an id to each successive heading tag from the extracted heading
 * slugs (same document order) so the jump-list anchors resolve. Slugs are
 * [a-z0-9-] only (see hrDocMarkdown.slugify), safe to inline as an attribute.
 */
function injectHeadingIds(html: string, headings: Array<{ slug: string }>): string {
  let i = 0
  return html.replace(/<(h[1-6])>/g, (match, tag) => {
    const h = headings[i++]
    return h ? `<${tag} id="${h.slug}">` : match
  })
}

const chipStyle = (colors: { background: string; color: string }): React.CSSProperties => ({
  display: 'inline-block',
  padding: '0.1rem 0.55rem',
  borderRadius: 999,
  fontSize: '0.72rem',
  fontWeight: 600,
  background: colors.background,
  color: colors.color,
  whiteSpace: 'nowrap',
})

export default function PeopleHrTab() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()

  const [people, setPeople] = useState<HrPerson[]>([])
  const [files, setFiles] = useState<PersonFileRow[]>([])
  /** Lightweight (person_id, created_at) for every entry — roster dots + counts. */
  const [entryMeta, setEntryMeta] = useState<Array<{ person_id: string; created_at: string }>>([])
  const [userNamesById, setUserNamesById] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  // Deep link from the Person Desk (v2.2710): ?tab=hr&person=<people.id> lands on that file.
  const [hrSearchParams] = useSearchParams()
  const deepLinkPersonId = hrSearchParams.get('person')
  useEffect(() => {
    if (deepLinkPersonId) setSelectedPersonId(deepLinkPersonId)
  }, [deepLinkPersonId])
  const [fileView, setFileView] = useState<FileView>('summary')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const [entries, setEntries] = useState<EntryRow[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const hrDocRef = useRef<HTMLDivElement>(null)
  const [attachments, setAttachments] = useState<AttachmentRow[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingExhibit, setUploadingExhibit] = useState(false)

  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const [draftDate, setDraftDate] = useState(todayYmd)
  const [draftSource, setDraftSource] = useState<string>('conversation')
  const [draftContent, setDraftContent] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    const [peopleRes, filesRes, metaRes, usersRes] = await Promise.all([
      supabase.from('people').select('id, name, kind, archived_at, start_date'),
      supabase.from('person_files').select('person_id, kind, content, updated_at, covered_through, author_label'),
      supabase.from('person_file_entries').select('person_id, created_at'),
      supabase.from('users').select('id, name'),
    ])
    const firstError = peopleRes.error ?? filesRes.error ?? metaRes.error ?? usersRes.error
    if (firstError) {
      setLoadError(firstError.message)
      setLoaded(true)
      return
    }
    setPeople(((peopleRes.data ?? []) as HrPerson[]).slice().sort((a, b) => a.name.localeCompare(b.name)))
    setFiles((filesRes.data ?? []) as PersonFileRow[])
    setEntryMeta((metaRes.data ?? []) as Array<{ person_id: string; created_at: string }>)
    const names: Record<string, string> = {}
    for (const u of (usersRes.data ?? []) as Array<{ id: string; name: string | null }>) {
      if (u.name) names[u.id] = u.name
    }
    setUserNamesById(names)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const loadEntries = useCallback(async (personId: string) => {
    setEntriesLoading(true)
    const [entriesRes, attachRes] = await Promise.all([
      supabase
        .from('person_file_entries')
        .select('id, person_id, entry_date, content, source, created_by, created_at, author_label')
        .eq('person_id', personId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('person_file_attachments')
        .select('id, person_id, entry_id, storage_path, filename, mime_type, size_bytes, author_label, uploaded_by, created_at')
        .eq('person_id', personId)
        .order('created_at', { ascending: false }),
    ])
    setEntriesLoading(false)
    if (entriesRes.error) {
      showToast(`Couldn't load entries: ${entriesRes.error.message}`, 'error')
      return
    }
    setEntries((entriesRes.data ?? []) as EntryRow[])
    // Attachments failing to load shouldn't blank the timeline — degrade quietly.
    setAttachments(attachRes.error ? [] : ((attachRes.data ?? []) as AttachmentRow[]))
  }, [showToast])

  /** Upload files to the hr-files bucket + insert their metadata rows. */
  const uploadAttachments = useCallback(async (personId: string, entryId: string | null, files: File[]): Promise<boolean> => {
    for (const file of files) {
      const path = `${personId}/${crypto.randomUUID()}-${safeUploadName(file.name)}`
      const up = await supabase.storage.from(HR_FILES_BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (up.error) {
        showToast(`Couldn't upload ${file.name}: ${up.error.message}`, 'error')
        return false
      }
      const ins = await supabase.from('person_file_attachments').insert({
        person_id: personId,
        entry_id: entryId,
        storage_path: path,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: authUser?.id ?? null,
      })
      if (ins.error) {
        showToast(`Uploaded ${file.name} but couldn't record it: ${ins.error.message}`, 'error')
        return false
      }
    }
    return true
  }, [authUser?.id, showToast])

  const openAttachment = useCallback(async (a: AttachmentRow) => {
    const { data, error } = await supabase.storage.from(HR_FILES_BUCKET).createSignedUrl(a.storage_path, 600)
    if (error || !data?.signedUrl) {
      showToast(`Couldn't open ${a.filename}: ${error?.message ?? 'no URL'}`, 'error')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }, [showToast])

  useEffect(() => {
    if (selectedPersonId) void loadEntries(selectedPersonId)
    else setEntries([])
  }, [selectedPersonId, loadEntries])

  const filesByPerson = useMemo(() => {
    const map = new Map<string, { summary?: PersonFileRow; narrative?: PersonFileRow }>()
    for (const f of files) {
      const slot = map.get(f.person_id) ?? {}
      if (f.kind === 'summary') slot.summary = f
      else if (f.kind === 'narrative') slot.narrative = f
      map.set(f.person_id, slot)
    }
    return map
  }, [files])

  const freshnessByPerson = useMemo(() => {
    const createdByPerson = new Map<string, string[]>()
    for (const m of entryMeta) {
      const list = createdByPerson.get(m.person_id) ?? []
      list.push(m.created_at)
      createdByPerson.set(m.person_id, list)
    }
    const nowIso = new Date().toISOString()
    const map = new Map<string, PersonFileFreshness>()
    for (const p of people) {
      map.set(p.id, derivePersonFileFreshness({
        summaryUpdatedAt: filesByPerson.get(p.id)?.summary?.updated_at ?? null,
        summaryCoveredThrough: filesByPerson.get(p.id)?.summary?.covered_through ?? null,
        entryCreatedAts: createdByPerson.get(p.id) ?? [],
        nowIso,
      }))
    }
    return map
  }, [people, entryMeta, filesByPerson])

  const selectedPerson = useMemo(
    () => people.find((p) => p.id === selectedPersonId) ?? null,
    [people, selectedPersonId],
  )
  const selectedFiles = selectedPersonId ? filesByPerson.get(selectedPersonId) : undefined
  const selectedFreshness = selectedPersonId ? freshnessByPerson.get(selectedPersonId) : undefined

  const rosterSections = useMemo(() => {
    const q = search.trim().toLowerCase()
    const visible = people.filter((p) => (q === '' || p.name.toLowerCase().includes(q)))
    const active = visible.filter((p) => !p.archived_at)
    const archived = visible.filter((p) => p.archived_at)
    const sections: Array<{ label: string; people: HrPerson[] }> = []
    for (const kind of KINDS) {
      const rows = active.filter((p) => p.kind === kind)
      if (rows.length > 0) sections.push({ label: KIND_LABELS[kind as PersonKind] ?? kind, people: rows })
    }
    const unknownKind = active.filter((p) => !(KINDS as readonly string[]).includes(p.kind))
    if (unknownKind.length > 0) sections.push({ label: 'Other', people: unknownKind })
    return { sections, archived }
  }, [people, search])

  const addEntry = useCallback(async () => {
    if (!selectedPersonId || draftContent.trim() === '' || savingEntry) return
    setSavingEntry(true)
    const { data, error } = await supabase
      .from('person_file_entries')
      .insert({
        person_id: selectedPersonId,
        entry_date: draftDate,
        content: draftContent.trim(),
        source: draftSource,
        created_by: authUser?.id ?? null,
      })
      .select('id')
      .single()
    if (error) {
      setSavingEntry(false)
      showToast(`Couldn't add the entry: ${error.message}`, 'error')
      return
    }
    // Attach any files staged in the composer to the new entry.
    if (pendingFiles.length > 0) {
      const entryId = (data as { id: string } | null)?.id ?? null
      const ok = await uploadAttachments(selectedPersonId, entryId, pendingFiles)
      if (ok) setPendingFiles([])
    }
    setSavingEntry(false)
    showToast('Entry added', 'success')
    setDraftContent('')
    setDraftDate(todayYmd)
    await Promise.all([loadEntries(selectedPersonId), load()])
  }, [selectedPersonId, draftContent, draftDate, draftSource, savingEntry, authUser?.id, showToast, loadEntries, load, todayYmd, pendingFiles, uploadAttachments])

  const addExhibits = useCallback(async (files: FileList | null) => {
    if (!selectedPersonId || !files || files.length === 0 || uploadingExhibit) return
    setUploadingExhibit(true)
    const ok = await uploadAttachments(selectedPersonId, null, Array.from(files))
    setUploadingExhibit(false)
    if (ok) {
      showToast(files.length === 1 ? 'Exhibit added' : `${files.length} exhibits added`, 'success')
      await loadEntries(selectedPersonId)
    }
  }, [selectedPersonId, uploadingExhibit, uploadAttachments, showToast, loadEntries])

  const attachmentsByEntry = useMemo(() => {
    const map = new Map<string, AttachmentRow[]>()
    for (const a of attachments) {
      if (!a.entry_id) continue
      const list = map.get(a.entry_id) ?? []
      list.push(a)
      map.set(a.entry_id, list)
    }
    return map
  }, [attachments])
  const exhibitAttachments = useMemo(() => attachments.filter((a) => a.entry_id === null), [attachments])

  const attachmentChip = (a: AttachmentRow) => (
    <button
      key={a.id}
      type="button"
      onClick={() => { void openAttachment(a) }}
      title={`${a.filename}${a.size_bytes !== null ? ` · ${formatBytes(a.size_bytes)}` : ''} · added ${formatIsoDate(a.created_at)}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.12rem 0.55rem', borderRadius: 999, fontSize: '0.74rem', border: '1px solid var(--border-strong)', background: 'var(--bg-page)', color: 'var(--text-link)', cursor: 'pointer', maxWidth: '32ch' }}
    >
      <span aria-hidden>📎</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</span>
      {a.size_bytes !== null && <span style={{ color: 'var(--text-faint)', flex: 'none' }}>{formatBytes(a.size_bytes)}</span>}
    </button>
  )

  const renderDoc = (doc: PersonFileRow | undefined, kind: 'summary' | 'narrative') => {
    const fr = selectedFreshness
    const html = doc ? hrDocMarkdownToSafeHtml(doc.content) : ''
    const headings = doc && kind === 'narrative' ? extractHrDocHeadings(doc.content) : []
    return (
      <div>
        {doc ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.7rem' }}>
              <span>Maintained by {doc.author_label ?? 'the agent'}</span>
              <span>{kind === 'summary' ? 'rewritten' : 'last extended'} {formatIsoDate(doc.updated_at)}</span>
              {doc.covered_through && (
                <span>covers through {formatIsoDate(doc.covered_through)}</span>
              )}
              {kind === 'summary' && fr && fr.entryCount > 0 && (
                <span>{fr.coveredCount} of {fr.entryCount} entries</span>
              )}
              {kind === 'summary' && fr?.state === 'current' && (
                <span style={{ color: 'var(--text-green-600)', fontWeight: 600 }}>● current</span>
              )}
            </div>
            {kind === 'summary' && fr?.state === 'stale' && (
              <div style={{ background: 'var(--bg-amber-tint)', border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8rem', marginBottom: '0.7rem', maxWidth: '70ch' }}>
                {fr.entryCount - fr.coveredCount} newer {fr.entryCount - fr.coveredCount === 1 ? 'entry' : 'entries'} since this was rewritten
                {fr.staleDays > 0 ? ` — ${fr.staleDays}d behind` : ''}. Ask the agent to bring it current.
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
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.2rem', maxWidth: '70ch' }}>
                <span style={{ color: 'var(--text-muted)' }}>Empty.</span>
              </div>
            ) : (
              <div
                ref={hrDocRef}
                className="hr-doc-body"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.2rem', fontSize: '0.9rem', maxWidth: '70ch' }}
                // Content is agent-authored markdown, rendered via marked and run
                // through the contract-signing sanitizer (hrDocMarkdownToSafeHtml).
                dangerouslySetInnerHTML={{ __html: injectHeadingIds(html, headings) }}
              />
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '60ch' }}>
            No {kind} yet. The agent writes this from the raw entries — add facts there and ask it to build the {kind}.
          </div>
        )}
      </div>
    )
  }

  const fileTabStyle = (on: boolean): React.CSSProperties => ({
    padding: '0.45rem 0.9rem 0.55rem',
    fontSize: '0.86rem',
    color: on ? 'var(--text-link)' : 'var(--text-muted)',
    fontWeight: on ? 600 : 400,
    background: 'none',
    border: 'none',
    borderBottom: on ? '2px solid var(--text-link)' : '2px solid transparent',
    cursor: 'pointer',
  })

  if (!loaded) return <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
  if (loadError) return <div style={{ color: 'var(--text-red-600)' }}>Couldn't load HR files: {loadError}</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', background: 'var(--bg-amber-tint)', border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
        <span aria-hidden>🔒</span>
        <span><strong>Dev-only.</strong> Curated files are maintained by the agent; raw entries are append-only — corrections are new entries.</span>
      </div>

      <HrPendingReportsSection
        nameForPerson={(id) => people.find((p) => p.id === id)?.name ?? 'this person'}
        onOpenPerson={(id) => { setSelectedPersonId(id); setFileView('raw') }}
        onFiled={() => { void load(); if (selectedPersonId) void loadEntries(selectedPersonId) }}
      />

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Roster */}
        <aside style={{ flex: '0 0 250px', minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0' }}>
          <div style={{ padding: '0 0.75rem 0.5rem' }}>
            <input
              type="text"
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: '0.82rem', background: 'var(--bg-page)', color: 'var(--text-base)' }}
            />
          </div>
          {rosterSections.sections.map((section) => (
            <div key={section.label}>
              <div style={{ textTransform: 'uppercase', fontSize: '0.66rem', letterSpacing: '0.08em', color: 'var(--text-faint)', padding: '0.6rem 0.85rem 0.2rem', fontWeight: 700 }}>{section.label}</div>
              {section.people.map((p) => {
                const fr = freshnessByPerson.get(p.id)
                const on = p.id === selectedPersonId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedPersonId(p.id); setFileView('summary') }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.4rem 0.85rem', fontSize: '0.86rem', border: 'none', cursor: 'pointer', background: on ? 'var(--bg-blue-tint)' : 'transparent', color: on ? 'var(--text-blue-800)' : 'var(--text-base)', fontWeight: on ? 600 : 400 }}
                  >
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: DOT_COLOR[fr?.state ?? 'empty'] }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {fr && fr.entryCount > 0 ? fr.entryCount : ''}
                      {fr?.state === 'stale' && fr.staleDays > 0 ? ` · ${fr.staleDays}d` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
          {rosterSections.archived.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                style={{ display: 'block', width: '100%', textAlign: 'left', textTransform: 'uppercase', fontSize: '0.66rem', letterSpacing: '0.08em', color: 'var(--text-faint)', padding: '0.6rem 0.85rem 0.2rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showArchived ? '▾' : '▸'} Archived ({rosterSections.archived.length})
              </button>
              {showArchived && rosterSections.archived.map((p) => {
                const fr = freshnessByPerson.get(p.id)
                const on = p.id === selectedPersonId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedPersonId(p.id); setFileView('summary') }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.4rem 0.85rem', fontSize: '0.86rem', border: 'none', cursor: 'pointer', background: on ? 'var(--bg-blue-tint)' : 'transparent', color: 'var(--text-muted)' }}
                  >
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: DOT_COLOR[fr?.state ?? 'empty'] }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums' }}>{fr && fr.entryCount > 0 ? fr.entryCount : ''}</span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        {/* Person panel */}
        <section style={{ flex: '1 1 480px', minWidth: 0 }}>
          {!selectedPerson ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingTop: '0.5rem' }}>
              Select a person to open their file. Dots: <span style={{ color: 'var(--text-green-600)' }}>●</span> summary current · <span style={{ color: 'var(--text-amber-700)' }}>●</span> entries newer than the summary · <span style={{ color: 'var(--text-faint)' }}>●</span> no file yet.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-strong)' }}>{selectedPerson.name}</span>
                <span style={chipStyle({ background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' })}>
                  {KIND_LABELS[selectedPerson.kind as PersonKind] ?? selectedPerson.kind}
                </span>
                {selectedPerson.start_date && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    started {formatYmd(selectedPerson.start_date)}
                    {tenureLabel(selectedPerson.start_date, todayYmd) ? ` · ${tenureLabel(selectedPerson.start_date, todayYmd)}` : ''}
                  </span>
                )}
                {selectedPerson.archived_at && (
                  <span style={chipStyle({ background: 'var(--bg-neutral-100)', color: 'var(--text-muted)' })}>Archived</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.25rem', margin: '0.9rem 0 1rem', borderBottom: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setFileView('summary')} style={fileTabStyle(fileView === 'summary')}>Summary</button>
                <button type="button" onClick={() => setFileView('narrative')} style={fileTabStyle(fileView === 'narrative')}>Narrative</button>
                <button type="button" onClick={() => setFileView('raw')} style={fileTabStyle(fileView === 'raw')}>
                  Raw entries{selectedFreshness && selectedFreshness.entryCount > 0 ? ` (${selectedFreshness.entryCount})` : ''}
                </button>
              </div>

              {fileView === 'summary' && renderDoc(selectedFiles?.summary, 'summary')}
              {fileView === 'narrative' && renderDoc(selectedFiles?.narrative, 'narrative')}

              {fileView === 'raw' && (
                <div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.9rem', marginBottom: '1rem', maxWidth: '70ch' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: exhibitAttachments.length > 0 ? '0.5rem' : 0 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-strong)' }}>Exhibits</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>person-level files; entry-linked ones sit on their entries below</span>
                      <label style={{ marginLeft: 'auto', fontSize: '0.76rem', color: 'var(--text-link)', cursor: uploadingExhibit ? 'default' : 'pointer', fontWeight: 600 }}>
                        {uploadingExhibit ? 'Uploading…' : '+ Add exhibits'}
                        <input
                          type="file"
                          multiple
                          disabled={uploadingExhibit}
                          onChange={(e) => { void addExhibits(e.target.files); e.target.value = '' }}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                    {exhibitAttachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {exhibitAttachments.map(attachmentChip)}
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.9rem', marginBottom: '1rem', maxWidth: '70ch' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <input
                        type="date"
                        value={draftDate}
                        max={todayYmd}
                        onChange={(e) => setDraftDate(e.target.value)}
                        style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.8rem', background: 'var(--bg-page)', color: 'var(--text-base)' }}
                      />
                      <select
                        value={draftSource}
                        onChange={(e) => setDraftSource(e.target.value)}
                        style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.8rem', background: 'var(--bg-page)', color: 'var(--text-base)' }}
                      >
                        {HR_ENTRY_SOURCES.map((s) => (
                          <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      placeholder="What happened — facts and dates, no speculation…"
                      rows={3}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.84rem', background: 'var(--bg-page)', color: 'var(--text-base)', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => { void addEntry() }}
                        disabled={savingEntry || draftContent.trim() === ''}
                        style={{ padding: '0.4rem 0.9rem', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: savingEntry || draftContent.trim() === '' ? 'default' : 'pointer', background: 'var(--text-link)', color: 'var(--surface)', opacity: savingEntry || draftContent.trim() === '' ? 0.55 : 1 }}
                      >
                        {savingEntry ? 'Adding…' : 'Add entry'}
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
                          <button
                            type="button"
                            aria-label={`Remove ${f.name}`}
                            onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                            style={{ marginLeft: '0.25rem', border: 'none', background: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.74rem' }}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {entriesLoading ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading entries…</div>
                  ) : entries.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No entries yet — this log is the source of truth the curated files are built from.</div>
                  ) : (
                    <div style={{ maxWidth: '70ch' }}>
                      {entries.map((e) => (
                        <div key={e.id} style={{ display: 'flex', gap: '0.8rem', padding: '0.6rem 0.15rem', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ flex: '0 0 88px', fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{e.entry_date}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '0.87rem' }}>
                            {e.content}
                            <span style={{ ...chipStyle(SOURCE_CHIP_STYLE[e.source] ?? SOURCE_CHIP_STYLE.conversation!), marginLeft: '0.5rem' }}>
                              {SOURCE_LABELS[e.source] ?? e.source}
                            </span>
                            {(attachmentsByEntry.get(e.id) ?? []).length > 0 && (
                              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
                                {(attachmentsByEntry.get(e.id) ?? []).map(attachmentChip)}
                              </span>
                            )}
                            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 2 }}>
                              {e.created_by ? (userNamesById[e.created_by] ?? 'unknown') : (e.author_label ?? 'agent')} · logged {formatIsoDate(e.created_at)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
