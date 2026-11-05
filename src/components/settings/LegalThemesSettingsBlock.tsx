import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { EmptyState } from '../EmptyState'
import ConfirmDialog from '../ConfirmDialog'
import {
  MARK_WHY_MAX,
  THEME_COUNSEL_WORDS_MAX,
  THEME_NAME_MAX,
  THEME_WHAT_COUNTS_MAX,
  markCountWords,
  marksByTheme,
  proofCountsWords,
  proposedCountWords,
  sortThemes,
  themeDraftProblem,
  type LegalTheme,
  type LegalThemeMark,
  type ThemeDraft,
} from '../../lib/legal/legalThemes'
import { addTheme, keepTheme, loadThemes, retireTheme, updateTheme } from '../../lib/legal/legalThemesIo'

/**
 * Settings → People & teams → Themes (v2.6545, punch list #269 T1, devs only): the catalog of themes on the record.
 * A theme is a plain-words name for a pattern the office wants to find again across a large record, with one line on
 * what counts and optional words for counsel. The card lists the standing themes with their live mark counts and the
 * proof behind them, the agent's proposals dashed with Keep and Retire, and the retired ones folded under the list;
 * a theme is edited in place and retired, never deleted, so old marks keep their meaning. The marks themselves are
 * made where the record is (an HR entry, a piece of evidence, a matter's document or event) from the PRs after this.
 */

const EMPTY_DRAFT: ThemeDraft = { name: '', whatCounts: '', counselWords: '' }

const INPUT: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }
const LABEL: React.CSSProperties = { display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }
const QUIET_PRESS: React.CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }

function ThemeForm({ draft, standing, editingId, saving, onChange, onSave, onCancel }: { draft: ThemeDraft; standing: LegalTheme[]; editingId: string | null; saving: boolean; onChange: (d: ThemeDraft) => void; onSave: () => void; onCancel: () => void }) {
  const problem = themeDraftProblem(draft, standing, editingId)
  const dead = saving || !!problem
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        if (!dead) onSave()
      }}
      data-testid="theme-form"
      style={{ display: 'grid', gap: '0.6rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
    >
      <label style={LABEL}>
        Name
        <input value={draft.name} maxLength={THEME_NAME_MAX} autoFocus onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Dishonesty" data-testid="theme-name" style={INPUT} />
      </label>
      <label style={LABEL}>
        What counts
        <textarea value={draft.whatCounts} maxLength={THEME_WHAT_COUNTS_MAX} rows={2} onChange={(e) => onChange({ ...draft, whatCounts: e.target.value })} placeholder="A statement the record shows to be untrue, or a thing hidden that the person owed the company." data-testid="theme-what-counts" style={{ ...INPUT, resize: 'vertical' }} />
      </label>
      <label style={LABEL}>
        Counsel’s words, if any
        <input value={draft.counselWords} maxLength={THEME_COUNSEL_WORDS_MAX} onChange={(e) => onChange({ ...draft, counselWords: e.target.value })} placeholder="Breach of the duty of loyalty" data-testid="theme-counsel-words" style={INPUT} />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="submit" disabled={dead} data-testid="theme-save" style={{ padding: '0.45rem 0.9rem', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}>
          {saving ? 'Saving…' : editingId ? 'Save the theme' : 'Add the theme'}
        </button>
        <button type="button" onClick={onCancel} style={QUIET_PRESS}>
          Cancel
        </button>
        {problem && draft.name.trim() ? (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="theme-problem">
            {problem}
          </span>
        ) : null}
      </div>
    </form>
  )
}

function ThemeRow({ theme, marks, busy, onEdit, onRetire, onKeep }: { theme: LegalTheme; marks: LegalThemeMark[]; busy: boolean; onEdit: () => void; onRetire: () => void; onKeep: () => void }) {
  const proposed = theme.proposed_by_agent && !theme.kept_at
  const retired = !!theme.retired_at
  const proposedMarks = proposedCountWords(marks)
  return (
    <li
      data-testid={`theme-row-${theme.id}`}
      style={{
        listStyle: 'none',
        padding: '0.6rem 0.75rem',
        border: `1px ${proposed ? 'dashed' : 'solid'} var(--border)`,
        borderRadius: 6,
        background: 'var(--surface)',
        opacity: retired ? 0.7 : 1,
        display: 'grid',
        gap: '0.25rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>{theme.name}</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="theme-mark-count">
          {retired ? `retired · ${markCountWords(marks.length)}` : markCountWords(marks.length)}
        </span>
        {proposed ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', borderRadius: 999, padding: '0 0.45rem' }}>proposed by the agent</span> : null}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
          {!retired ? (
            <button type="button" onClick={onEdit} disabled={busy} style={QUIET_PRESS} data-testid="theme-edit">
              Edit
            </button>
          ) : null}
          {proposed ? (
            <button type="button" onClick={onKeep} disabled={busy} style={QUIET_PRESS} data-testid="theme-keep">
              Keep
            </button>
          ) : null}
          <button type="button" onClick={onRetire} disabled={busy} style={QUIET_PRESS} data-testid="theme-retire">
            {retired ? 'Bring back' : 'Retire'}
          </button>
        </span>
      </div>
      {theme.what_counts ? <div style={{ fontSize: '0.875rem', color: 'var(--text-base)' }}>{theme.what_counts}</div> : null}
      {theme.counsel_words ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Counsel’s words: <span style={{ fontStyle: 'italic' }}>{theme.counsel_words}</span>
        </div>
      ) : null}
      {marks.length > 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} data-testid="theme-proof">
          {proofCountsWords(marks)}
          {proposedMarks ? ` · ${proposedMarks}` : ''}
        </div>
      ) : null}
    </li>
  )
}

export default function LegalThemesSettingsBlock() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [themes, setThemes] = useState<LegalTheme[]>([])
  const [marks, setMarks] = useState<LegalThemeMark[]>([])
  const [heldWhy, setHeldWhy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ThemeDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [showRetired, setShowRetired] = useState(false)
  const [retireAsk, setRetireAsk] = useState<LegalTheme | null>(null)

  const reload = useCallback(async () => {
    const r = await loadThemes()
    setThemes(r.themes)
    setMarks(r.marks)
    setHeldWhy(r.heldWhy)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const sorted = sortThemes(themes)
  const standing = sorted.filter((t) => !t.retired_at)
  const retired = sorted.filter((t) => !!t.retired_at)
  const byTheme = marksByTheme(marks)

  function startEdit(t: LegalTheme) {
    setAdding(false)
    setEditingId(t.id)
    setDraft({ name: t.name, whatCounts: t.what_counts, counselWords: t.counsel_words })
  }

  function closeForm() {
    setAdding(false)
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  async function save() {
    setSaving(true)
    const r = editingId ? await updateTheme(editingId, draft) : await addTheme(draft, authUser?.id ?? null)
    setSaving(false)
    if (!r.ok) {
      showToast(r.why, 'error')
      return
    }
    showToast(editingId ? 'The theme is saved.' : `${draft.name.trim()} is on the catalog.`, 'success')
    closeForm()
    await reload()
  }

  async function retire(t: LegalTheme) {
    setRetireAsk(null)
    setBusyId(t.id)
    const r = await retireTheme(t.id, !t.retired_at, authUser?.id ?? null)
    setBusyId(null)
    if (!r.ok) {
      showToast(r.why, 'error')
      return
    }
    showToast(t.retired_at ? `${t.name} stands again.` : `${t.name} is retired. Its marks keep their meaning.`, 'success')
    await reload()
  }

  async function keep(t: LegalTheme) {
    setBusyId(t.id)
    const r = await keepTheme(t.id)
    setBusyId(null)
    if (!r.ok) {
      showToast(r.why, 'error')
      return
    }
    showToast(`${t.name} is kept.`, 'success')
    await reload()
  }

  const liveMarkCount = (t: LegalTheme) => byTheme.get(t.id) ?? []

  return (
    <section data-testid="legal-themes-block" style={{ marginTop: '1.5rem', padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
        <div style={{ fontWeight: 600 }}>Themes on the record</div>
        {!adding && !editingId ? (
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setDraft(EMPTY_DRAFT)
              setAdding(true)
            }}
            data-testid="theme-add"
            style={{ ...QUIET_PRESS, marginLeft: 'auto' }}
          >
            + Add a theme
          </button>
        ) : null}
      </div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        A theme is a plain name for a pattern you want to find again across a person’s record: what counts, in your words, and counsel’s words when there are some. A mark on an entry or a piece of evidence says why it fits and how it proves the theme, with a reason of up to {MARK_WHY_MAX} characters. Retire a theme and its marks keep their meaning.
      </p>
      {heldWhy ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="legal-themes-held">
          The themes could not be read: {heldWhy}
        </p>
      ) : null}
      {adding ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <ThemeForm draft={draft} standing={standing} editingId={null} saving={saving} onChange={setDraft} onSave={() => void save()} onCancel={closeForm} />
        </div>
      ) : null}
      {loading ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Reading…</p>
      ) : standing.length === 0 && !adding ? (
        <EmptyState compact main="No themes yet." next={{ label: '+ Add a theme', onPress: () => setAdding(true) }} tail="names the first pattern to look for." />
      ) : (
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }} data-testid="theme-list">
          {standing.map((t) =>
            editingId === t.id ? (
              <li key={t.id} style={{ listStyle: 'none' }}>
                <ThemeForm draft={draft} standing={standing} editingId={t.id} saving={saving} onChange={setDraft} onSave={() => void save()} onCancel={closeForm} />
              </li>
            ) : (
              <ThemeRow key={t.id} theme={t} marks={liveMarkCount(t)} busy={busyId === t.id} onEdit={() => startEdit(t)} onRetire={() => setRetireAsk(t)} onKeep={() => void keep(t)} />
            ),
          )}
        </ul>
      )}
      {retired.length > 0 ? (
        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" onClick={() => setShowRetired((v) => !v)} style={QUIET_PRESS} data-testid="theme-show-retired">
            {showRetired ? 'Hide the retired themes' : `Show ${retired.length} retired ${retired.length === 1 ? 'theme' : 'themes'}`}
          </button>
          {showRetired ? (
            <ul style={{ margin: '0.5rem 0 0', padding: 0, display: 'grid', gap: '0.5rem' }} data-testid="theme-list-retired">
              {retired.map((t) => (
                <ThemeRow key={t.id} theme={t} marks={liveMarkCount(t)} busy={busyId === t.id} onEdit={() => startEdit(t)} onRetire={() => void retire(t)} onKeep={() => void keep(t)} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {retireAsk ? (
        <ConfirmDialog
          title={`Retire ${retireAsk.name}?`}
          body={`${markCountWords(liveMarkCount(retireAsk).length)} on it keep their meaning. Nobody can mark it on anything new until it is brought back.`}
          confirmLabel="Retire the theme"
          onConfirm={() => void retire(retireAsk)}
          onCancel={() => setRetireAsk(null)}
        />
      ) : null}
    </section>
  )
}
