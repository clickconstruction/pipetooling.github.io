import { useMemo, useRef, useState } from 'react'
import { searchSettings, type SettingsSearchEntry } from '../../lib/settingsSearch'

/**
 * Settings search bar (v2.2084, mockup A): a type-ahead above the tab bar.
 * Results come from the curated index in `lib/settingsSearch.ts`, filtered to
 * the viewer's role-visible tabs; each row names its destination tab, matched
 * label text is bolded, keyword-only matches show the word that hit. Keyboard:
 * ↑/↓ move, Enter jumps, Esc clears. Picking a result clears the box and hands
 * the entry to the parent (tab switch + anchor scroll).
 */
export default function SettingsSearchBar({
  groups,
  onPick,
}: {
  /** Role-filtered jump groups — provides both visibility and tab labels. */
  groups: readonly { id: string; label: string }[]
  onPick: (entry: SettingsSearchEntry) => void
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const tabLabelById = useMemo(() => new Map(groups.map((g) => [g.id, g.label])), [groups])
  const visibleTabIds = useMemo(() => groups.map((g) => g.id), [groups])
  const hits = useMemo(() => searchSettings(query, visibleTabIds), [query, visibleTabIds])
  const open = focused && query.trim() !== ''
  const clampedActive = Math.min(activeIndex, Math.max(0, hits.length - 1))

  const pick = (entry: SettingsSearchEntry) => {
    setQuery('')
    setActiveIndex(0)
    inputRef.current?.blur()
    onPick(entry)
  }

  return (
    <div style={{ position: 'relative', marginBottom: '1rem', maxWidth: 560 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          padding: '0.55rem 0.75rem',
          background: 'var(--surface)',
        }}
      >
        {/* Icon: Font Awesome Free 6.x — magnifying-glass (OFL/CC-BY) */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={15} height={15} fill="var(--text-muted)" aria-hidden focusable={false} style={{ flexShrink: 0 }}>
          <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, hits.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const hit = hits[clampedActive]
              if (hit) pick(hit.entry)
            } else if (e.key === 'Escape') {
              setQuery('')
              setActiveIndex(0)
            }
          }}
          placeholder="Search settings…"
          aria-label="Search settings"
          role="combobox"
          aria-expanded={open}
          aria-controls="settings-search-results"
          aria-activedescendant={open && hits[clampedActive] ? `settings-search-option-${clampedActive}` : undefined}
          style={{ border: 'none', outline: 'none', font: 'inherit', fontSize: '0.9375rem', flex: 1, minWidth: 0, background: 'transparent', color: 'var(--text-strong)' }}
        />
      </div>
      {open && (
        <div
          id="settings-search-results"
          role="listbox"
          aria-label="Matching settings"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 6px)',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            zIndex: 30,
          }}
        >
          {hits.length === 0 ? (
            <div style={{ padding: '0.65rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No settings match "{query.trim()}" — try another word.
            </div>
          ) : (
            hits.map((h, i) => {
              const label = h.entry.label
              const selected = i === clampedActive
              return (
                <div
                  key={h.entry.label}
                  id={`settings-search-option-${i}`}
                  role="option"
                  aria-selected={selected}
                  // mousedown (not click) so the pick lands before the input's blur closes the list
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(h.entry)
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.9075rem',
                    cursor: 'pointer',
                    background: selected ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span style={{ minWidth: 0, color: 'var(--text-strong)' }}>
                    {h.matchStart >= 0 ? (
                      <>
                        {label.slice(0, h.matchStart)}
                        <b>{label.slice(h.matchStart, h.matchStart + h.matchLen)}</b>
                        {label.slice(h.matchStart + h.matchLen)}
                      </>
                    ) : (
                      <>
                        {label}{' '}
                        <span style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>({h.matchedKeyword})</span>
                      </>
                    )}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    in {tabLabelById.get(h.entry.tabId) ?? h.entry.tabId} →
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

