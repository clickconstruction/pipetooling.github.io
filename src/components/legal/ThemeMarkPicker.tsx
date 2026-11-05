import type { CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { MARK_WHY_MAX, PROVES_BY, markDraftProblem, sortThemes, themeStands, toggleThemeId, type LegalTheme, type MarkDraft } from '../../lib/legal/legalThemes'

/**
 * The theme picker (v2.6546, punch list #269 T2): the one strip every composer that writes to the record shows, and the
 * strip a line's *+ theme* and the Timeline's bulk bar open. The standing themes as chips, pressed to pick one or more;
 * once one is picked, *why it fits* in a few words and *proves it by* as four chips, the grade counsel's matrix asks at
 * the moment of marking. A theme the thing already carries is drawn pressed and still, so the same mark is never made
 * twice. With no theme on the catalog yet, the strip says where the first is named.
 */

const CHIP = (on: boolean, still = false): CSSProperties => ({
  padding: '0.2rem 0.6rem',
  fontWeight: 500,
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-700)' : 'var(--text-600)',
  cursor: still ? 'default' : 'pointer',
  whiteSpace: 'nowrap',
  font: 'inherit',
  fontSize: '0.74rem',
  opacity: still ? 0.8 : 1,
})

const LABEL: CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }

export type ThemeMarkPickerProps = {
  themes: ReadonlyArray<LegalTheme>
  draft: MarkDraft
  onChange: (next: MarkDraft) => void
  /** Themes the thing already carries: drawn pressed and still. */
  alreadyOn?: ReadonlySet<string>
  /** The first line's label: *Themes* by default, *Mark the ticked lines with* on the bulk bar. */
  label?: string
  testId?: string
}

export function ThemeMarkPicker({ themes, draft, onChange, alreadyOn, label = 'Themes', testId = 'theme-mark-picker' }: ThemeMarkPickerProps) {
  const standing = sortThemes(themes).filter(themeStands)
  const problem = markDraftProblem(draft)
  if (standing.length === 0) {
    return (
      <div data-testid={testId} style={{ fontSize: '0.78rem' }}>
        <EmptyState compact main="No theme to mark yet." next={{ label: 'Themes on the record', to: '/settings?tab=settings-people' }} tail="names the first." />
      </div>
    )
  }
  const picked = draft.themeIds.length > 0
  return (
    <div data-testid={testId} style={{ display: 'grid', gap: '0.45rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label={label}>
        <span style={LABEL}>{label}</span>
        {standing.map((t) => {
          const still = alreadyOn?.has(t.id) ?? false
          const on = still || draft.themeIds.includes(t.id)
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              disabled={still}
              title={still ? `${t.name} is on it already.` : t.what_counts || undefined}
              onClick={() => onChange(toggleThemeId(draft, t.id))}
              data-testid={`theme-pick-${t.id}`}
              style={CHIP(on, still)}
            >
              {t.name}
              {still ? ' ✓' : ''}
            </button>
          )
        })}
      </div>
      {picked ? (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={LABEL}>Why it fits</span>
            <input
              type="text"
              value={draft.why}
              maxLength={MARK_WHY_MAX}
              placeholder="A few words: what in it shows the theme."
              onChange={(e) => onChange({ ...draft, why: e.target.value })}
              data-testid="theme-mark-why"
              style={{ flex: '1 1 14rem', minWidth: 0, font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label="Proves it by">
            <span style={LABEL}>Proves it by</span>
            {PROVES_BY.map((p) => {
              const on = draft.provesBy === p.key
              return (
                <button key={p.key} type="button" aria-pressed={on} onClick={() => onChange({ ...draft, provesBy: on ? null : p.key })} data-testid={`theme-proves-${p.key}`} style={CHIP(on)}>
                  {p.label}
                </button>
              )
            })}
          </div>
          {problem ? (
            <span role="alert" style={{ fontSize: '0.76rem', color: 'var(--text-red-600)' }}>
              {problem}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
