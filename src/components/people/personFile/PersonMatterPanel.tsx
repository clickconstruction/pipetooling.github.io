import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../../utils/dateUtils'
import { legalRpc, legalRpcData } from '../../../hooks/useLegalMatters'
import { buildLegalTimeline, eventsNarrativeMarkdown, timelineDocumentsFromRows } from '../../../lib/legal/legalTimeline'
import { openLegalMatterDocument } from '../../../lib/legal/legalMatterDocumentsIo'
import { markedWords, themeStands, type LegalTheme, type LegalThemeMark } from '../../../lib/legal/legalThemes'
import { addMarks, authUserIdNow, loadThemes } from '../../../lib/legal/legalThemesIo'
import MatterThemesView from '../../jobs/legal/MatterThemesView'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { loadPersonMatter, openPersonMatter, type PersonMatterLoad } from '../../../lib/people/personMatterIo'
import { PERSON_MATTER_NONE_MAIN, PERSON_MATTER_NONE_SUB, PERSON_MATTER_OPEN_LABEL, personMatterStageWords, personMatterStandingWords } from '../../../lib/people/personMatter'
import LegalNarrativeEditor, { type NarrativeDesk } from '../../jobs/legal/LegalNarrativeEditor'
import LegalMatterDocumentsPanel from '../../jobs/legal/LegalMatterDocumentsPanel'
import LegalTimelinePanel, { type TimelinePlanActs } from '../../jobs/legal/LegalTimelinePanel'
import { EmptyState } from '../../EmptyState'

/**
 * The HR file's Matter view (v2.6543, punch list #269 PR 3a): a legal matter standing on the person instead of a
 * Collections payer, drawn from the Legal desk's own pieces — the narrative for the firm (`LegalNarrativeEditor` over
 * `legal_set_narrative`), the documents with what each one shows (`LegalMatterDocumentsPanel`, the same bucket and
 * rows the desk writes) and the timeline of planned steps and events (`LegalTimelinePanel` over `legal_plan_add`,
 * `legal_event_add`, `legal_plan_update`, `legal_plan_mark_done`, `legal_void_entry`). The account's tabs — who owes,
 * the bills, the lien paper, the firm's fees — have no person to stand on and are not drawn. A dev opens the matter
 * (`legal_person_matter_open`); the legal tables' restrictive policies keep its rows to devs. Since v2.6588 the
 * composers carry the theme picker (the catalog and the matter's marks, as the desk's do) and **By theme** reads the
 * matter one theme at a time (`MatterThemesView`).
 */

type SubTab = 'narrative' | 'evidence' | 'timeline' | 'themes'
const SUB_TABS: ReadonlyArray<{ key: SubTab; label: string }> = [
  { key: 'narrative', label: 'Narrative' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'themes', label: 'By theme' },
]

const subTab = (on: boolean): CSSProperties => ({
  padding: '0.3rem 0.7rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  border: 'none',
  borderBottom: `2px solid ${on ? '#2563eb' : 'transparent'}`,
  marginBottom: -1,
  background: 'transparent',
  color: on ? 'var(--text-blue-700)' : 'var(--text-muted)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

export function PersonMatterPanel({ personId, personName, canEdit, changeKey = 0, onChanged, namesById = {} }: { personId: string; personName: string; canEdit: boolean; changeKey?: number; onChanged?: () => void; /** Who marked what, by user id (v2.6588): the file's names, for the By theme window. */ namesById?: Record<string, string> }) {
  const { showToast } = useToastContext()
  const todayYmd = todayYmdInAppTz()
  const [load, setLoad] = useState<PersonMatterLoad | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<SubTab>('narrative')
  // Themes on the record (v2.6588): the catalog and this matter's marks, a dev's; the picker on the composers and the By theme view read them.
  const [themeCatalog, setThemeCatalog] = useState<{ themes: LegalTheme[]; marks: LegalThemeMark[] }>({ themes: [], marks: [] })

  const reload = useCallback(async () => {
    try {
      setLoad(await loadPersonMatter(personId))
      setLoadError(null)
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'The matter could not be read.'))
    }
  }, [personId])
  useEffect(() => {
    void reload()
  }, [reload, changeKey])

  const matterIdForThemes = canEdit ? (load?.matter?.id ?? null) : null
  const reloadThemes = useCallback(async () => {
    if (!matterIdForThemes) {
      setThemeCatalog({ themes: [], marks: [] })
      return
    }
    const r = await loadThemes({ matterId: matterIdForThemes })
    setThemeCatalog({ themes: r.themes, marks: r.marks })
  }, [matterIdForThemes])
  useEffect(() => {
    void reloadThemes()
  }, [reloadThemes, changeKey])

  // v2.6588: the names of whoever marked or kept, where the file's map has none (the dev's own, the agent's label stays).
  const [markerNames, setMarkerNames] = useState<Record<string, string>>({})
  useEffect(() => {
    const missing = [...new Set(themeCatalog.marks.flatMap((m) => [m.marked_by, m.kept_by]).filter((id): id is string => !!id && !namesById[id] && !markerNames[id]))]
    if (missing.length === 0) return
    let live = true
    void (supabase as unknown as SupabaseClient).from('users').select('id,name').in('id', missing).then((r) => {
      if (!live || r.error) return
      const rows = (r.data ?? []) as Array<{ id: string; name: string | null }>
      setMarkerNames((prev) => ({ ...prev, ...Object.fromEntries(rows.map((u) => [u.id, u.name ?? ''])) }))
    })
    return () => {
      live = false
    }
  }, [themeCatalog.marks, namesById, markerNames])
  const names = useMemo(() => ({ ...markerNames, ...namesById }), [markerNames, namesById])

  /** One write at a time; the words name the act when it fails. */
  const run = useCallback(
    async (label: string, act: () => Promise<string | null>): Promise<boolean> => {
      if (busy) return false
      setBusy(true)
      try {
        const err = await act()
        if (err) {
          showToast(`${label}: ${err}`, 'error')
          return false
        }
        await reload()
        onChanged?.()
        return true
      } catch (e) {
        showToast(`${label}: ${formatErrorMessage(e)}`, 'error')
        return false
      } finally {
        setBusy(false)
      }
    },
    [busy, reload, onChanged, showToast],
  )

  const open = async () => {
    const ok = await run(PERSON_MATTER_OPEN_LABEL, async () => {
      const out = await openPersonMatter(personId)
      return out.ok ? null : out.why
    })
    if (ok) showToast(`A matter stands on ${personName}. Write the narrative, add the documents, plan the steps.`, 'success')
  }

  const matter = load?.matter ?? null
  const entries = load?.entries ?? []
  const documents = load?.documents ?? []

  const narrative: NarrativeDesk | null = useMemo(() => {
    if (!matter) return null
    const timeline = buildLegalTimeline({ entries, documents: timelineDocumentsFromRows(documents, calendarYmdInAppTzFromIso), todayYmd, reader: 'office', dayOfIso: calendarYmdInAppTzFromIso })
    return {
      markdown: matter.narrative_md ?? '',
      updatedOn: matter.narrative_updated_at ? calendarYmdInAppTzFromIso(matter.narrative_updated_at) : '',
      updatedByName: '',
      canEdit: canEdit && !matter.closed_at,
      save: (markdown) => run('Narrative', () => legalRpc('legal_set_narrative', { p_matter_id: matter.id, p_markdown: markdown })),
      eventsMarkdown: eventsNarrativeMarkdown(timeline, todayYmd),
    }
  }, [matter, entries, documents, todayYmd, canEdit, run])

  const timeline = useMemo(
    () => buildLegalTimeline({ entries, documents: timelineDocumentsFromRows(documents, calendarYmdInAppTzFromIso), todayYmd, reader: 'office', dayOfIso: calendarYmdInAppTzFromIso }),
    [entries, documents, todayYmd],
  )

  const acts: TimelinePlanActs | null = matter && canEdit && !matter.closed_at
    ? {
        busy,
        add: (draft) => run('Plan a step', () => legalRpc('legal_plan_add', { p_matter_id: matter.id, p_on: draft.on, p_body: draft.body, p_notes: draft.notes })),
        addEvent: (draft) =>
          run('Record what happened', async () => {
            const r = await legalRpcData('legal_event_add', { p_matter_id: matter.id, p_on: draft.on, p_body: draft.body, p_notes: draft.notes, p_document_ids: draft.documentIds })
            if (r.error) return r.error
            // v2.6588: the themes picked on the composer, marked once the event stands (as the desk does since v2.6548).
            const entryId = typeof r.data?.entry_id === 'string' ? r.data.entry_id : null
            if (entryId && draft.marks && draft.marks.themeIds.length > 0) {
              const mk = await addMarks({ themeIds: draft.marks.themeIds, targets: [{ kind: 'matter_entry', id: entryId }], personId: null, matterId: matter.id, why: draft.marks.why, provesBy: draft.marks.provesBy, authUserId: await authUserIdNow() })
              showToast(mk.ok ? markedWords(draft.marks.themeIds.map((id) => themeCatalog.themes.find((t) => t.id === id)?.name ?? 'a theme'), mk.made, mk.already, ['event', 'events']) : `The themes were not marked: ${mk.why}`, mk.ok ? 'success' : 'error')
              void reloadThemes()
            }
            return null
          }),
        themes: themeCatalog.themes.length > 0 ? themeCatalog.themes : undefined,
        marks: themeCatalog.marks,
        documents: documents.map((d) => ({ id: d.id, title: d.title })),
        update: (entryId, draft) => run('Change the step', () => legalRpc('legal_plan_update', { p_entry_id: entryId, p_on: draft.on, p_body: draft.body, p_notes: draft.notes })),
        markDone: (entryId, doneOn, note) => run('Mark done', () => legalRpc('legal_plan_mark_done', { p_entry_id: entryId, p_done_on: doneOn, p_note: note })),
        undo: (entryId, reason) => run('Undo', () => legalRpc('legal_void_entry', { p_entry_id: entryId, p_reason: reason })),
        canUndo: (i) => (i.kind === 'plan' || i.kind === 'event') && !i.voided && !i.viaPortal,
      }
    : null

  // By theme (v2.6588): drawn once the catalog has a standing theme, with the count of things marked.
  const themesShown = canEdit && themeCatalog.themes.some(themeStands)
  const markedCount = new Set(themeCatalog.marks.filter((m) => !m.removed_at).map((m) => `${m.target_kind}:${m.target_id}`)).size

  if (loadError) return <p role="alert" style={{ color: 'var(--text-red-600)', fontSize: '0.85rem' }}>{loadError}</p>
  if (!load) return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reading the matter…</p>

  if (!matter) {
    return (
      <div data-testid="person-matter-none" style={{ display: 'grid', gap: '0.6rem', justifyItems: 'start', maxWidth: '64ch' }}>
        <EmptyState compact main={PERSON_MATTER_NONE_MAIN} next={canEdit && !busy ? { label: PERSON_MATTER_OPEN_LABEL, onPress: () => void open() } : undefined} tail={canEdit && !busy ? 'opens one.' : busy ? 'Opening…' : undefined} />
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{PERSON_MATTER_NONE_SUB}</p>
        {load.heldWhy ? <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not read here: {load.heldWhy}</p> : null}
      </div>
    )
  }

  return (
    <div data-testid="person-matter" style={{ maxWidth: '88ch' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem 0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>The matter on {personName}</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '0.1rem 0.55rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }} data-testid="person-matter-stage">
          {personMatterStageWords(matter)}
        </span>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{personMatterStandingWords(matter, { documents: documents.length, entries: entries.filter((e) => !e.voided_at).length })}</span>
      </div>
      <p style={{ margin: '0 0 0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        The analysis for counsel, kept apart from the record: what the office says happened, the papers that show it, and what is planned. Devs alone read it; nothing here reaches a firm until the matter is released.
      </p>
      <div role="tablist" aria-label="The matter" style={{ display: 'flex', gap: '0.15rem', borderBottom: '1px solid var(--border)', marginBottom: '0.8rem', overflowX: 'auto' }}>
        {SUB_TABS.filter((t) => t.key !== 'themes' || themesShown).map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={subTab(tab === t.key)} data-testid={`person-matter-tab-${t.key}`}>
            {t.label}
            {t.key === 'evidence' && documents.length ? ` (${documents.length})` : t.key === 'timeline' && timeline.counts.planned + timeline.counts.done ? ` (${timeline.counts.planned + timeline.counts.done})` : t.key === 'themes' && markedCount > 0 ? ` (${markedCount})` : ''}
          </button>
        ))}
      </div>
      {tab === 'narrative' && narrative ? <LegalNarrativeEditor narrative={narrative} busy={busy} /> : null}
      {tab === 'evidence' ? (
        <LegalMatterDocumentsPanel matterId={matter.id} documents={documents} canEdit={canEdit && !matter.closed_at} onChanged={() => void reload()} payerName={personName} fromMessages={null} themes={themeCatalog.themes.length > 0 ? themeCatalog.themes : undefined} marks={themeCatalog.marks} onMarksChanged={() => void reloadThemes()} />
      ) : null}
      {tab === 'themes' && themesShown ? (
        <MatterThemesView
          matterName={personName}
          themes={themeCatalog.themes}
          marks={themeCatalog.marks}
          entries={entries}
          documents={documents}
          canWrite={canEdit && !matter.closed_at}
          namesById={names}
          onOpenDocument={(id) => {
            const row = documents.find((d) => d.id === id)
            if (row) void openLegalMatterDocument(supabase, row)
          }}
          onOpenOnTimeline={(line) => setTab(line.ref.table === 'legal_matter_documents' ? 'evidence' : 'timeline')}
          onMarksChanged={() => void reloadThemes()}
        />
      ) : null}
      {tab === 'timeline' ? (
        <LegalTimelinePanel
          timeline={timeline}
          todayYmd={todayYmd}
          reader="office"
          lanes
          acts={acts}
          onOpenEvidence={() => setTab('evidence')}
          onOpenDocument={async (documentId) => {
            const row = documents.find((d) => d.id === documentId)
            if (row) await openLegalMatterDocument(supabase, row)
          }}
        />
      ) : null}
    </div>
  )
}

export default PersonMatterPanel
