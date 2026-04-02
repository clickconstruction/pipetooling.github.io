import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const LIST_MAX_HEIGHT_PX = 240
const DROPDOWN_MARGIN_PX = 2
const PORTAL_Z_INDEX = 1100
export type SearchableSelectOption = { value: string; label: string }

type ListPosition = { top: number; left: number; width: number }

export type SearchableSelectProps = {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  /** Shown on the trigger when value is empty and emptyOption is absent */
  placeholder?: string
  disabled?: boolean
  id?: string
  searchable?: boolean
  /** e.g. { value: '', label: '—' } or service type placeholder */
  emptyOption?: SearchableSelectOption
  required?: boolean
  /** Accessible name for the listbox */
  listAriaLabel?: string
  /** Portaled dropdown z-index; raise above modals with higher overlays (default 1100). */
  portalZIndex?: number
}

function normalizeOptions(
  options: SearchableSelectOption[],
  emptyOption: SearchableSelectOption | undefined
): SearchableSelectOption[] {
  if (!emptyOption) return options
  const rest = options.filter((o) => o.value !== emptyOption.value)
  return [emptyOption, ...rest]
}

export function SearchableSelect({
  value,
  onChange,
  options: optionsProp,
  placeholder = 'Select…',
  disabled = false,
  id: idProp,
  searchable = true,
  emptyOption,
  required = false,
  listAriaLabel = 'Options',
  portalZIndex = PORTAL_Z_INDEX,
}: SearchableSelectProps) {
  const reactId = useId()
  const baseId = idProp ?? reactId
  const listId = `${baseId}-listbox`
  const searchInputId = `${baseId}-search`

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listPortalRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [listPosition, setListPosition] = useState<ListPosition | null>(null)

  const allOptions = useMemo(
    () => normalizeOptions(optionsProp, emptyOption),
    [optionsProp, emptyOption]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allOptions
    return allOptions.filter((o) => o.label.toLowerCase().includes(q))
  }, [allOptions, query])

  const selectedLabel = useMemo(() => {
    const hit = allOptions.find((o) => o.value === value)
    if (hit) return hit.label
    return placeholder
  }, [allOptions, value, placeholder])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIndex(-1)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const openPanel = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setActiveIndex(-1)
  }, [disabled])

  const openPanelWithActive = useCallback(
    (index: number) => {
      if (disabled) return
      setOpen(true)
      setQuery('')
      setActiveIndex(index)
    },
    [disabled]
  )

  const updateListPosition = useCallback(() => {
    if (!open) {
      setListPosition(null)
      return
    }
    const el = triggerRef.current
    if (!el) {
      setListPosition(null)
      return
    }
    const rect = el.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 120), window.innerWidth - 16)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    if (left < 8) left = 8

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const reserve = LIST_MAX_HEIGHT_PX + DROPDOWN_MARGIN_PX + (searchable ? 52 : 0)
    const placeBelow = spaceBelow >= reserve || spaceBelow >= spaceAbove

    let top: number
    if (placeBelow) {
      top = rect.bottom + DROPDOWN_MARGIN_PX
    } else {
      top = rect.top - LIST_MAX_HEIGHT_PX - DROPDOWN_MARGIN_PX - (searchable ? 48 : 0)
      if (top < 8) top = 8
    }

    setListPosition({ top, left, width })
  }, [open, searchable])

  useLayoutEffect(() => {
    updateListPosition()
  }, [updateListPosition, open, query, filtered.length])

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

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length > 0 ? filtered.length - 1 : -1)
    }
  }, [filtered.length, activeIndex, filtered])

  useEffect(() => {
    if (!open) return
    if (searchable) {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [open, searchable])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const el = optionRefs.current.get(activeIndex)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, filtered])

  const applyOption = (v: string) => {
    onChange(v)
    close()
  }

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        if (allOptions.length === 0) return
        const idx = e.key === 'ArrowDown' ? 0 : allOptions.length - 1
        openPanelWithActive(idx)
        return
      }
      if (filtered.length === 0) return
      if (e.key === 'ArrowDown') {
        setActiveIndex((i) => (i < filtered.length - 1 ? i + 1 : 0))
      } else {
        setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1))
      }
    }
    if (e.key === 'Enter' && open && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault()
      applyOption(filtered[activeIndex].value)
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      close()
    }
  }

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filtered.length > 0) setActiveIndex(0)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filtered.length > 0) setActiveIndex(filtered.length - 1)
      return
    }
    if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault()
      applyOption(filtered[activeIndex].value)
    }
  }

  const listboxStyle = useMemo(
    () =>
      ({
        maxHeight: LIST_MAX_HEIGHT_PX,
        overflow: 'auto',
        listStyle: 'none',
        padding: 0,
        margin: 0,
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        background: 'white',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
      }) as const,
    []
  )

  const portalShellStyle = (pos: ListPosition): React.CSSProperties => ({
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    width: pos.width,
    zIndex: portalZIndex,
    boxSizing: 'border-box',
  })

  const showPortal = open && listPosition !== null

  const portalContent =
    showPortal &&
    listPosition &&
    createPortal(
      <div ref={listPortalRef} style={portalShellStyle(listPosition)}>
        {searchable && (
          <input
            id={searchInputId}
            ref={searchInputRef}
            type="search"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(-1)
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="Search…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: 6,
              padding: '0.5rem 0.65rem',
              fontSize: 16,
              border: '1px solid #d1d5db',
              borderRadius: 4,
            }}
          />
        )}
        {filtered.length === 0 ? (
          <div
            style={{
              ...listboxStyle,
              padding: '0.75rem',
              fontSize: '0.875rem',
              color: '#9ca3af',
              maxHeight: 'none',
            }}
          >
            No matches
          </div>
        ) : (
          <ul id={listId} role="listbox" aria-label={listAriaLabel} style={listboxStyle}>
            {filtered.map((o, idx) => (
              <li key={`${o.value}-${idx}`} role="none">
                <button
                  type="button"
                  ref={(el) => {
                    if (el) optionRefs.current.set(idx, el)
                    else optionRefs.current.delete(idx)
                  }}
                  role="option"
                  aria-selected={value === o.value}
                  id={`${listId}-opt-${idx}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => applyOption(o.value)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.6rem 0.75rem',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    background: idx === activeIndex ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>,
      document.body
    )

  const triggerMinHeight = 44

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        id={baseId}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        aria-activedescendant={
          open && activeIndex >= 0 && filtered[activeIndex]
            ? `${listId}-opt-${activeIndex}`
            : undefined
        }
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={onTriggerKeyDown}
        style={{
          width: '100%',
          minHeight: triggerMinHeight,
          padding: '0.5rem 0.65rem',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          background: disabled ? '#f3f4f6' : 'white',
          color: value === '' && emptyOption === undefined ? '#6b7280' : '#111827',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box',
          fontSize: '0.875rem',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {selectedLabel}
        </span>
        <span aria-hidden style={{ flexShrink: 0, color: '#6b7280', fontSize: '0.65rem' }}>
          ▾
        </span>
      </button>
      {portalContent}
    </div>
  )
}
