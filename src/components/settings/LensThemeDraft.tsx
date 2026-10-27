import { useMemo, useState, type CSSProperties } from 'react'
import shippedTokens from 'virtual:lens-tokens'
import { contrastRatio } from '../../lib/lens/lensAudit'
import { DRAFT_PAIRS, TOKEN_GROUP_ORDER, draftPatch, hexOf, hexToRgba, tokenGroup, type ThemeDraft, type ThemeName, type ThemeTokens } from '../../lib/lens/lensTokens'

const tokens: ThemeTokens = shippedTokens

/**
 * What everyone sees → Theme draft (punch list #194): every token of src/index.css, light and dark,
 * from the shipped values. A change redraws every frame on the tab with it; Draft and Current flip
 * between the change and the shipped look; Copy as CSS gives the patch a PR takes. The pairs that
 * must stay readable show their contrast as you type. Lazy-loaded with the tab's draft button.
 */

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'grid', gap: '0.6rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const LABEL: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const PILL: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const PILL_ON: CSSProperties = { ...PILL, background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' }
const INPUT: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

export type LensDraftMode = 'draft' | 'current'

export default function LensThemeDraft({ draft, onDraft, mode, onMode }: { draft: ThemeDraft; onDraft: (d: ThemeDraft) => void; mode: LensDraftMode; onMode: (m: LensDraftMode) => void }) {
  const [theme, setTheme] = useState<ThemeName>('light')
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState(false)
  const shipped = (t: ThemeName, name: string) => tokens[t].find((x) => x.name === name)?.value ?? tokens.light.find((x) => x.name === name)?.value
  const value = (t: ThemeName, name: string) => draft[t][name] ?? shipped(t, name)
  const groups = useMemo(() => {
    const names = tokens[theme].map((x) => x.name).concat(theme === 'dark' ? tokens.light.map((x) => x.name).filter((n) => !tokens.dark.some((d) => d.name === n)) : [])
    const q = filter.trim().toLowerCase()
    const by = new Map<string, string[]>()
    for (const n of names) {
      if (q && !n.includes(q)) continue
      const g = tokenGroup(n)
      by.set(g, [...(by.get(g) ?? []), n])
    }
    return TOKEN_GROUP_ORDER.filter((g) => by.has(g)).map((g) => [g, by.get(g)!] as const)
  }, [theme, filter])
  const set = (name: string, v: string) => {
    const next: ThemeDraft = { light: { ...draft.light }, dark: { ...draft.dark } }
    if (v.trim() === '' || v.trim().toLowerCase() === (shipped(theme, name) ?? '').toLowerCase()) delete next[theme][name]
    else next[theme][name] = v.trim()
    onDraft(next)
  }
  const changed = Object.keys(draft.light).length + Object.keys(draft.dark).length
  const patch = draftPatch(draft, tokens)
  const copy = () => {
    if (!patch) return
    void navigator.clipboard?.writeText(patch).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={CARD} aria-label="Theme draft">
      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <b style={{ color: 'var(--text-strong)' }}>Theme draft</b>
        <span style={MUTED}>{changed === 0 ? 'No change yet. Pick a token to start a draft.' : changed === 1 ? '1 token changed.' : `${changed} tokens changed.`}</span>
      </span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span role="group" aria-label="Values" style={{ display: 'flex', gap: 6 }}>
          {(['light', 'dark'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} style={theme === t ? PILL_ON : PILL} onClick={() => setTheme(t)}>
              {t === 'light' ? 'Light values' : 'Dark values'}
            </button>
          ))}
        </span>
        <span role="group" aria-label="Draft or current" style={{ display: 'flex', gap: 6 }}>
          <button type="button" aria-pressed={mode === 'draft'} style={mode === 'draft' ? PILL_ON : PILL} onClick={() => onMode('draft')}>
            Draft
          </button>
          <button type="button" aria-pressed={mode === 'current'} style={mode === 'current' ? PILL_ON : PILL} onClick={() => onMode('current')}>
            Current
          </button>
        </span>
        <input aria-label="Find a token" placeholder="Find a token" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...INPUT, width: '11rem' }} />
      </span>
      <div style={{ display: 'grid', gap: '0.5rem', maxHeight: 420, overflow: 'auto', paddingRight: 4 }}>
        {groups.map(([g, names]) => (
          <div key={g} style={{ display: 'grid', gap: 4 }}>
            <span style={LABEL}>{g}</span>
            {names.map((n) => {
              const v = value(theme, n) ?? ''
              const hex = hexOf(v)
              const isChanged = draft[theme][n] != null
              return (
                <label key={n} style={{ display: 'grid', gridTemplateColumns: '1.6rem minmax(0, 1fr) 7.5rem', gap: 8, alignItems: 'center', fontSize: '0.78rem' }}>
                  {hex ? <input type="color" aria-label={n} value={hex} onChange={(e) => set(n, e.target.value)} style={{ width: '1.6rem', height: '1.6rem', padding: 0, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 6, background: 'none' }} /> : <span />}
                  <code style={{ fontFamily: MONO, color: isChanged ? 'var(--text-link)' : 'var(--text-strong)', fontWeight: isChanged ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</code>
                  <input aria-label={`${n} value`} value={v} onChange={(e) => set(n, e.target.value)} style={{ ...INPUT, fontFamily: MONO, fontSize: '0.74rem' }} />
                </label>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 3 }}>
        <span style={LABEL}>Contrast, as you type · {theme}</span>
        {DRAFT_PAIRS.map((p) => {
          const fg = hexOf(value(theme, p.fg))
          const bg = hexOf(value(theme, p.bg))
          const r = fg && bg ? contrastRatio(hexToRgba(fg), hexToRgba(bg)) : null
          const ok = r != null && r >= p.floor
          return (
            <span key={p.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.78rem', color: 'var(--text-700)' }}>
              <span>{p.label}</span>
              <b style={{ color: r == null ? 'var(--text-muted)' : ok ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{r == null ? 'not a plain color' : `${r.toFixed(1)}:1${ok ? '' : ` · under ${p.floor}`}`}</b>
            </span>
          )
        })}
      </div>
      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={PILL} disabled={changed === 0} onClick={() => onDraft({ light: {}, dark: {} })}>
          Reset
        </button>
        <button type="button" style={PILL_ON} disabled={!patch} onClick={copy}>
          {copied ? 'Copied' : 'Copy as CSS'}
        </button>
      </span>
      {patch && <pre style={{ margin: 0, fontFamily: MONO, fontSize: '0.74rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', whiteSpace: 'pre-wrap', color: 'var(--text-700)', maxHeight: 220, overflow: 'auto' }}>{patch}</pre>}
    </div>
  )
}
