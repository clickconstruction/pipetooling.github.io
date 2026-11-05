import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { earlierStintsLine, tenureLabel, type Stint } from '../../lib/people/employmentStints'
import { useSearchParams } from 'react-router-dom'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { KINDS, KIND_LABELS } from './peopleUsersTabShared'
import type { PersonKind } from '../../hooks/usePeopleRoster'
import { derivePersonFileFreshness, type PersonFileFreshness } from '../../lib/people/personFileFreshness'
import { HrPendingReportsSection } from './HrPendingReportsSection'
import { PersonFilePanel, type PersonFileView } from './personFile/PersonFilePanel'

export { HR_ENTRY_SOURCES } from './personFile/PersonFilePanel'

/**
 * People → HR (dev-only): the person files. Left, the roster with a freshness dot per person
 * (green current / amber entries newer than the summary / grey no file). Right, the person's
 * file — Timeline, Evidence, Narrative — drawn by `PersonFilePanel`, which merges the HR
 * file's own append-only entries with what the app already knows happened to the person.
 * The queue of field reports waiting to be filed sits above both.
 * Convention for what gets written lives in docs/HR_FILES.md.
 */

type HrPerson = {
  id: string
  name: string
  kind: string
  archived_at: string | null
  start_date: string | null
  account_user_id: string | null
}

type PersonFileMetaRow = {
  person_id: string
  kind: string
  updated_at: string
  covered_through: string | null
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
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${d}, ${y}`
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

const FILE_VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true } as const

export default function PeopleHrTab() {
  const [people, setPeople] = useState<HrPerson[]>([])
  const [files, setFiles] = useState<PersonFileMetaRow[]>([])
  /** Lightweight (person_id, created_at) for every entry — roster dots + counts. */
  const [entryMeta, setEntryMeta] = useState<Array<{ person_id: string; created_at: string }>>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  // Deep link from the Person Desk (v2.2710): ?tab=hr&person=<people.id> lands on that file.
  const [hrSearchParams, setHrSearchParams] = useSearchParams()
  const deepLinkPersonId = hrSearchParams.get('person')
  /** By theme (v2.6547): `?theme=<id>` opens the file on that theme, and a pick writes it back so a link reopens the same view. */
  const deepLinkThemeId = hrSearchParams.get('theme')
  useEffect(() => {
    if (deepLinkPersonId) setSelectedPersonId(deepLinkPersonId)
  }, [deepLinkPersonId])
  useEffect(() => {
    if (deepLinkPersonId && deepLinkThemeId) {
      setFileView('themes')
      setFileViewKey((k) => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkThemeId])
  const writeThemeToAddress = (themeId: string) => {
    if (!selectedPersonId) return
    setHrSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', 'hr')
        next.set('person', selectedPersonId)
        next.set('theme', themeId)
        return next
      },
      { replace: true },
    )
  }
  const [fileView, setFileView] = useState<PersonFileView>('timeline')
  const [fileViewKey, setFileViewKey] = useState(0)
  const [fileChangeKey, setFileChangeKey] = useState(0)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  /** The queue folds to one line while a file is open; Show the queue unfolds it. */
  const [queueOpen, setQueueOpen] = useState(true)
  const [queueReloadKey, setQueueReloadKey] = useState(0)
  /** A phone shows the roster or the file, not both: the roster to pick, then the file with a way back. */
  const [narrow, setNarrow] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth <= 760 : false))
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 760)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())

  const load = useCallback(async () => {
    setLoadError(null)
    const [peopleRes, filesRes, metaRes] = await Promise.all([
      supabase.from('people').select('id, name, kind, archived_at, start_date, account_user_id'),
      supabase.from('person_files').select('person_id, kind, updated_at, covered_through'),
      supabase.from('person_file_entries').select('person_id, created_at'),
    ])
    const firstError = peopleRes.error ?? filesRes.error ?? metaRes.error
    if (firstError) {
      setLoadError(firstError.message)
      setLoaded(true)
      return
    }
    setPeople(((peopleRes.data ?? []) as HrPerson[]).slice().sort((a, b) => a.name.localeCompare(b.name)))
    setFiles((filesRes.data ?? []) as PersonFileMetaRow[])
    setEntryMeta((metaRes.data ?? []) as Array<{ person_id: string; created_at: string }>)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summaryByPerson = useMemo(() => {
    const map = new Map<string, PersonFileMetaRow>()
    for (const f of files) if (f.kind === 'summary') map.set(f.person_id, f)
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
      const summary = summaryByPerson.get(p.id)
      map.set(
        p.id,
        derivePersonFileFreshness({
          summaryUpdatedAt: summary?.updated_at ?? null,
          summaryCoveredThrough: summary?.covered_through ?? null,
          entryCreatedAts: createdByPerson.get(p.id) ?? [],
          nowIso,
        }),
      )
    }
    return map
  }, [people, entryMeta, summaryByPerson])

  const selectedPerson = useMemo(() => people.find((p) => p.id === selectedPersonId) ?? null, [people, selectedPersonId])
  // v2.6526 (punch list #256): a person who left and came back has more than one stint; the earlier ones follow the tenure.
  const [earlierStints, setEarlierStints] = useState<string | null>(null)
  useEffect(() => {
    setEarlierStints(null)
    if (!selectedPersonId) return
    let on = true
    void supabase
      .from('employment_stints')
      .select('start_date, end_date')
      .eq('person_id', selectedPersonId)
      .then(({ data }) => {
        if (on) setEarlierStints(earlierStintsLine(((data ?? []) as Stint[])))
      })
    return () => {
      on = false
    }
  }, [selectedPersonId])

  const rosterSections = useMemo(() => {
    const q = search.trim().toLowerCase()
    const visible = people.filter((p) => q === '' || p.name.toLowerCase().includes(q))
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

  const openPerson = (id: string, view: PersonFileView) => {
    setSelectedPersonId(id)
    setFileView(view)
    setFileViewKey((k) => k + 1)
    setQueueOpen(false)
  }

  /** After a write from the file (an entry, a report filed from its line): the roster dots and the queue read again. */
  const afterFileChange = () => {
    void load()
    setQueueReloadKey((k) => k + 1)
  }

  const rosterRow = (p: HrPerson, archived: boolean) => {
    const fr = freshnessByPerson.get(p.id)
    const on = p.id === selectedPersonId
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => openPerson(p.id, 'timeline')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.4rem 0.85rem', fontSize: '0.86rem', border: 'none', cursor: 'pointer', background: on ? 'var(--bg-blue-tint)' : 'transparent', color: archived ? 'var(--text-muted)' : on ? 'var(--text-blue-800)' : 'var(--text-base)', fontWeight: on ? 600 : 400 }}
      >
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: DOT_COLOR[fr?.state ?? 'empty'] }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {fr && fr.entryCount > 0 ? fr.entryCount : ''}
          {!archived && fr?.state === 'stale' && fr.staleDays > 0 ? ` · ${fr.staleDays}d` : ''}
        </span>
      </button>
    )
  }

  if (!loaded) return <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
  if (loadError) return <div style={{ color: 'var(--text-red-600)' }}>Couldn't load HR files: {loadError}</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', background: 'var(--bg-amber-tint)', border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
        <span aria-hidden>🔒</span>
        <span>
          <strong>Dev-only.</strong> Entries append and never change. The agent keeps each summary and narrative.
        </span>
      </div>

      <HrPendingReportsSection
        nameForPerson={(id) => people.find((p) => p.id === id)?.name ?? 'this person'}
        onOpenPerson={(id) => openPerson(id, 'timeline')}
        onFiled={() => {
          void load()
          setFileChangeKey((k) => k + 1)
        }}
        reloadKey={queueReloadKey}
        collapsed={!queueOpen && selectedPerson != null}
        onExpand={() => setQueueOpen(true)}
      />

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Roster */}
        {narrow && selectedPerson ? null : (
        <aside style={{ flex: narrow ? '1 1 100%' : '0 0 250px', minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0' }}>
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
              {section.people.map((p) => rosterRow(p, false))}
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
              {showArchived && rosterSections.archived.map((p) => rosterRow(p, true))}
            </div>
          )}
        </aside>
        )}

        {/* The file */}
        <section style={{ flex: '1 1 480px', minWidth: 0 }}>
          {!selectedPerson ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingTop: '0.5rem' }}>
              Pick a person to open their file. Dots: <span style={{ color: 'var(--text-green-600)' }}>●</span> summary current · <span style={{ color: 'var(--text-amber-700)' }}>●</span> entries newer than the summary · <span style={{ color: 'var(--text-faint)' }}>●</span> no file yet.
            </div>
          ) : (
            <>
              {narrow ? (
                <button type="button" onClick={() => setSelectedPersonId(null)} style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: '0 0 0.5rem', cursor: 'pointer' }}>
                  ‹ All people
                </button>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-strong)' }}>{selectedPerson.name}</span>
                <span style={chipStyle({ background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' })}>{KIND_LABELS[selectedPerson.kind as PersonKind] ?? selectedPerson.kind}</span>
                {selectedPerson.start_date && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    started {formatYmd(selectedPerson.start_date)}
                    {tenureLabel(selectedPerson.start_date, todayYmd) ? ` · ${tenureLabel(selectedPerson.start_date, todayYmd)}` : ''}
                    {earlierStints ? ` · ${earlierStints}` : ''}
                  </span>
                )}
                {selectedPerson.archived_at && <span style={chipStyle({ background: 'var(--bg-neutral-100)', color: 'var(--text-muted)' })}>Archived</span>}
                {!selectedPerson.account_user_id && <span style={chipStyle({ background: 'var(--bg-subtle)', color: 'var(--text-muted)' })}>no login</span>}
              </div>
              <PersonFilePanel
                personId={selectedPerson.id}
                userId={selectedPerson.account_user_id}
                personName={selectedPerson.name}
                viewer={FILE_VIEWER}
                changeKey={fileChangeKey}
                onChanged={afterFileChange}
                initialView={fileView}
                viewKey={fileViewKey}
                initialThemeId={deepLinkThemeId}
                onThemePicked={writeThemeToAddress}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
