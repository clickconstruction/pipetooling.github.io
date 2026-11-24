import type { CSSProperties } from 'react'
import {
  splitMainForBold,
  suggestionLocality,
  type AddressSuggestion,
} from '../../lib/addressAutocomplete'
import { onFileCountWords, type OnFileMatch } from '../../lib/addresses/addressesOnFile'

/**
 * The dropdown under the Job Address field (v2.2338, owner mockup 1d6efc13):
 * Google-backed suggestions with the typed match bold, locality at the right
 * edge, keyboard hints and the required "powered by Google" attribution in
 * the footer. Pure presentation — the parent owns fetch, focus, keyboard
 * state, and the pick. Rows pick on mousedown so the input's blur can't
 * swallow the click.
 *
 * Addresses the company already has come first, under *Already on file* (punch list #439): each says how many
 * jobs and bids are there, so a place is picked the way it is already written and not typed a second way. One
 * index runs through both groups, the on-file rows first.
 */

const PIN = (
  <svg width="12" height="15" viewBox="0 0 384 512" fill="currentColor" aria-hidden>
    <path d="M192 0C86 0 0 86 0 192c0 77.4 27 99 172.3 309.7 9.5 13.8 29.9 13.8 39.5 0C357 291 384 269.4 384 192 384 86 298 0 192 0zm0 272c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80z" />
  </svg>
)

const ENTER_HINT_STYLE: CSSProperties = {
  flexShrink: 0,
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  padding: '0 4px',
}

const groupStyle: CSSProperties = {
  padding: '0.3rem 0.7rem',
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
}

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
  onFile = [],
  onPickOnFile,
}: {
  suggestions: AddressSuggestion[]
  activeIndex: number
  onPick: (s: AddressSuggestion) => void
  onHover: (index: number) => void
  /** Addresses already on file that match what is typed. They take the first indexes. */
  onFile?: OnFileMatch[]
  onPickOnFile?: (match: OnFileMatch) => void
}) {
  if (suggestions.length === 0 && onFile.length === 0) return null
  const offset = onFile.length
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
      {onFile.length > 0 && (
        <div data-testid="job-address-on-file-head" style={{ ...groupStyle, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }}>
          Already on file
        </div>
      )}
      {onFile.map((m, i) => {
        const active = i === activeIndex
        return (
          <div
            key={`on-file-${m.key}`}
            role="option"
            aria-selected={active}
            data-testid="job-address-on-file-row"
            onMouseDown={(e) => {
              e.preventDefault()
              onPickOnFile?.(m)
            }}
            onMouseEnter={() => onHover(i)}
            style={{ ...rowStyle(active), minHeight: 44 }}
          >
            {/* The same slot Google's rows give their pin, so both groups' addresses start on one line. */}
            <span aria-hidden style={{ flexShrink: 0, width: 12, textAlign: 'center', fontWeight: 700, color: 'var(--text-green-700)' }}>
              ✓
            </span>
            {/* The address is the thing being picked, so it keeps the line. On a narrow box the count drops under
                it instead of squeezing it: on a phone the first cut read "11…" beside "25 jobs". */}
            <span style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '0.6rem' }}>
              <span style={{ flex: '1 1 11rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b style={{ fontWeight: 700 }}>{m.address.slice(0, m.matchEnd)}</b>
                {m.address.slice(m.matchEnd)}
              </span>
              <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                {onFileCountWords(m)}
                {m.developmentName ? ` · ${m.developmentName}` : ''}
              </span>
            </span>
          </div>
        )
      })}
      {onFile.length > 0 && suggestions.length > 0 && (
        <div style={{ ...groupStyle, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>A new address</div>
      )}
      {suggestions.map((s, at) => {
        const i = at + offset
        const [bold, rest] = splitMainForBold(s)
        const active = i === activeIndex
        return (
          <div
            key={`${s.full}-${at}`}
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
            {active && <span style={ENTER_HINT_STYLE}>ENTER ↵</span>}
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
        {/* Required attribution when using Places without Google's own widget. Only Google's rows are Google's. */}
        {suggestions.length > 0 && <span style={{ fontWeight: 600 }}>powered by Google</span>}
      </div>
    </div>
  )
}
