import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { peerCandidateKey, type PeerCandidate } from '../../lib/teamFeedback'

const LIST_MAX_HEIGHT_PX = 240
const DROPDOWN_MARGIN_PX = 2
const PORTAL_Z_INDEX = 1100

type ListPosition = { top: number; left: number; width: number }

type Props = {
  candidates: PeerCandidate[]
  selectedPeerKeys: string[]
  peerFilter: string
  onFilterChange: (value: string) => void
  onTogglePeer: (peerKey: string) => void
  disabled?: boolean
}

export default function PeerTeammatePicker({
  candidates,
  selectedPeerKeys,
  peerFilter,
  onFilterChange,
  onTogglePeer,
  disabled,
}: Props) {
  const listId = useId()
  const emptyStateId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listPortalRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [listPosition, setListPosition] = useState<ListPosition | null>(null)

  const filtered = useMemo(() => {
    const q = peerFilter.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => c.peer_name.toLowerCase().includes(q))
  }, [candidates, peerFilter])

  const selectable = useMemo(
    () => filtered.filter((c) => selectedPeerKeys.includes(peerCandidateKey(c)) === false),
    [filtered, selectedPeerKeys]
  )

  /** RPC orders by shared_tag_count; re-apply after name filter. */
  const selectableSorted = useMemo(() => {
    return [...selectable].sort((a, b) => {
      const d = b.shared_tag_count - a.shared_tag_count
      if (d !== 0) return d
      return a.peer_name.localeCompare(b.peer_name)
    })
  }, [selectable])

  const selectedNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of candidates) {
      const k = peerCandidateKey(c)
      if (k) map.set(k, c.peer_name)
    }
    return map
  }, [candidates])

  const showList = open && selectableSorted.length > 0
  const showEmpty =
    open && selectable.length === 0 && filtered.length === 0 && peerFilter.trim() !== ''
  const showPortal = showList || showEmpty

  const close = useCallback(() => setOpen(false), [])

  const updateListPosition = useCallback(() => {
    if (!showPortal) {
      setListPosition(null)
      return
    }
    const input = inputRef.current
    if (!input) {
      setListPosition(null)
      return
    }
    const rect = input.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 120), window.innerWidth - 16)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    if (left < 8) left = 8

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const reserve = LIST_MAX_HEIGHT_PX + DROPDOWN_MARGIN_PX
    const placeBelow = spaceBelow >= reserve || spaceBelow >= spaceAbove

    let top: number
    if (placeBelow) {
      top = rect.bottom + DROPDOWN_MARGIN_PX
    } else {
      top = rect.top - LIST_MAX_HEIGHT_PX - DROPDOWN_MARGIN_PX
      if (top < 8) top = 8
    }

    setListPosition({ top, left, width })
  }, [showPortal])

  useLayoutEffect(() => {
    updateListPosition()
  }, [updateListPosition, peerFilter, selectableSorted.length, selectable.length, filtered.length])

  useEffect(() => {
    if (!open) return
    const onScrollResize = () => updateListPosition()
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    return () => {
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
    }
  }, [open, updateListPosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (listPortalRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  const listboxStyle = useMemo(
    () =>
      ({
        maxHeight: LIST_MAX_HEIGHT_PX,
        overflow: 'auto',
        listStyle: 'none',
        padding: 0,
        margin: 0,
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
      }) as const,
    []
  )

  const portalShellStyle = (pos: ListPosition): React.CSSProperties => ({
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    width: pos.width,
    zIndex: PORTAL_Z_INDEX,
    boxSizing: 'border-box',
  })

  const portalContent =
    listPosition &&
    showPortal &&
    createPortal(
      <div ref={listPortalRef} style={portalShellStyle(listPosition)}>
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Teammates to add"
            style={listboxStyle}
          >
            {selectableSorted.map((c) => {
              const pk = peerCandidateKey(c)
              if (!pk) return null
              return (
                <li key={pk} role="none">
                  <button
                    type="button"
                    role="option"
                    disabled={disabled}
                    onClick={() => {
                      onTogglePeer(pk)
                      onFilterChange('')
                      setOpen(false)
                      inputRef.current?.focus()
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 0.75rem',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      background: 'var(--surface)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 500 }}>{c.peer_name}</span>
                    {c.shared_tag_count > 0 && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {c.shared_tag_count} shared tag{c.shared_tag_count === 1 ? '' : 's'}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div
            id={emptyStateId}
            role="listbox"
            aria-label="No teammate matches"
            style={{
              padding: '0.75rem',
              fontSize: '0.875rem',
              color: 'var(--text-faint)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            }}
          >
            No matches
          </div>
        )}
      </div>,
      document.body
    )

  return (
    <div style={{ marginBottom: '1rem' }}>
      {selectedPeerKeys.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }} role="list" aria-label="Selected teammates">
          {selectedPeerKeys.map((pk) => (
            <span
              key={pk}
              role="listitem"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.5rem',
                borderRadius: 999,
                background: 'var(--bg-orange-tint)',
                border: '1px solid #fed7aa',
                fontSize: '0.875rem',
                color: 'var(--text-orange-800)',
              }}
            >
              {selectedNames.get(pk) ?? 'Teammate'}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${selectedNames.get(pk) ?? 'teammate'}`}
                onClick={() => onTogglePeer(pk)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  padding: 0,
                  lineHeight: 1,
                  fontSize: '1rem',
                  color: 'var(--text-orange-700)',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={wrapRef} style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={showList ? listId : showEmpty ? emptyStateId : undefined}
          aria-autocomplete="list"
          placeholder="Search teammates by name"
          value={peerFilter}
          disabled={disabled}
          onChange={(e) => {
            onFilterChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', boxSizing: 'border-box' }}
        />
      </div>
      {portalContent}
    </div>
  )
}
