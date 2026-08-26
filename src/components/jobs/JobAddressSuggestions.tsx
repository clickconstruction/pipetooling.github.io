import type { CSSProperties } from 'react'
import {
  splitMainForBold,
  suggestionLocality,
  type AddressSuggestion,
} from '../../lib/addressAutocomplete'

/**
 * The dropdown under the Job Address field (v2.2338, owner mockup 1d6efc13):
 * Google-backed suggestions with the typed match bold, locality at the right
 * edge, keyboard hints and the required "powered by Google" attribution in
 * the footer. Pure presentation — the parent owns fetch, focus, keyboard
 * state, and the pick. Rows pick on mousedown so the input's blur can't
 * swallow the click.
 */

const PIN = (
  <svg width="12" height="15" viewBox="0 0 384 512" fill="currentColor" aria-hidden>
    <path d="M192 0C86 0 0 86 0 192c0 77.4 27 99 172.3 309.7 9.5 13.8 29.9 13.8 39.5 0C357 291 384 269.4 384 192 384 86 298 0 192 0zm0 272c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80z" />
  </svg>
)

const rowStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  padding: '0.45rem 0.7rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  borderBottom: '1px solid var(--border)',
  background: active ? 'var(--bg-blue-tint, var(--bg-muted))' : 'transparent',
})

export default function JobAddressSuggestions({
  suggestions,
  activeIndex,
  onPick,
  onHover,
}: {
  suggestions: AddressSuggestion[]
  activeIndex: number
  onPick: (s: AddressSuggestion) => void
  onHover: (index: number) => void
}) {
  if (suggestions.length === 0) return null
  return (
    <div
      id="job-address-suggestions"
      role="listbox"
      aria-label="Address suggestions"
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        right: 0,
        zIndex: 30,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
      }}
    >
      {suggestions.map((s, i) => {
        const [bold, rest] = splitMainForBold(s)
        const active = i === activeIndex
        return (
          <div
            key={`${s.full}-${i}`}
            role="option"
            aria-selected={active}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(s)
            }}
            onMouseEnter={() => onHover(i)}
            style={rowStyle(active)}
          >
            <span style={{ flexShrink: 0, display: 'flex', color: active ? 'var(--text-link)' : 'var(--text-muted)' }}>
              {PIN}
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <b style={{ fontWeight: 700 }}>{bold}</b>
              {rest}
            </span>
            <span style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
              {suggestionLocality(s)}
            </span>
            {active && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  padding: '0 4px',
                }}
              >
                ENTER ↵
              </span>
            )}
          </div>
        )
      })}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.6rem',
          padding: '0.25rem 0.7rem',
          background: 'var(--bg-muted)',
          fontSize: '0.64rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>↑↓ choose · Enter takes · Esc dismisses · or keep typing</span>
        {/* Required attribution when using Places without Google's own widget. */}
        <span style={{ fontWeight: 600 }}>powered by Google</span>
      </div>
    </div>
  )
}
