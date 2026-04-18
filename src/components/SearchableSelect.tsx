import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

const LIST_MAX_HEIGHT_PX = 240
const DROPDOWN_MARGIN_PX = 2
const PORTAL_Z_INDEX = 1100

/** Selectable row (value/label). */
export type SearchableSelectSelectableOption = {
  value: string
  /** Plain text for search filtering and accessible name; required even when `labelContent` is set. */
  label: string
  /** When set, shown in the list and closed trigger instead of `label` (search still uses `label`). */
  labelContent?: ReactNode
}

/** Non-interactive divider between option groups (e.g. Schedule assignee sections). */
export type SearchableSelectSeparatorOption = { kind: 'separator'; id: string }

export type SearchableSelectOption = SearchableSelectSelectableOption | SearchableSelectSeparatorOption

export function isSelectableOption(o: SearchableSelectOption): o is SearchableSelectSelectableOption {
  return 'value' in o && 'label' in o
}

export function isSeparatorOption(o: SearchableSelectOption): o is SearchableSelectSeparatorOption {
  return 'kind' in o && o.kind === 'separator'
}

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
  /** e.g. { value: '', label: '—' } or service type placeholder. Do not mix with mid-list separators. */
  emptyOption?: SearchableSelectSelectableOption
  /**
   * When true and `value === emptyOption.value`, omit the empty option row from the open list
   * (trigger still shows it). Use when the duplicate row feels redundant next to the search field.
   */
  hideEmptyOptionInListWhenUnset?: boolean
  required?: boolean
  /** Accessible name for the listbox */
  listAriaLabel?: string
  /** Portaled dropdown z-index; raise above modals with higher overlays (default 1100). */
  portalZIndex?: number
}

/** List rows for the open panel; may hide empty option while selection is still empty. */
function filterOptionsForListRender(
  filtered: SearchableSelectOption[],
  hideEmptyWhenUnset: boolean,
  emptyOption: SearchableSelectSelectableOption | undefined,
  currentValue: string,
): SearchableSelectOption[] {
  if (!hideEmptyWhenUnset || !emptyOption || currentValue !== emptyOption.value) return filtered
  return filtered.filter((o) => {
    if (isSeparatorOption(o)) return true
    if (!isSelectableOption(o)) return true
    return o.value !== emptyOption.value
  })
}

function normalizeOptions(
  options: SearchableSelectOption[],
  emptyOption: SearchableSelectSelectableOption | undefined
): SearchableSelectOption[] {
  if (!emptyOption) return options
  const rest = options.filter((o) => {
    if (isSeparatorOption(o)) return true
    return o.value !== emptyOption.value
  })
  return [emptyOption, ...rest]
}

/** Split options into selectable groups; `separatorIds[i]` sits between group i and i+1. */
function splitOptionGroups(options: SearchableSelectOption[]): {
  groups: SearchableSelectSelectableOption[][]
  separatorIds: string[]
} {
  const groups: SearchableSelectSelectableOption[][] = []
  const separatorIds: string[] = []
  let cur: SearchableSelectSelectableOption[] = []
  for (const row of options) {
    if (isSeparatorOption(row)) {
      groups.push(cur)
      separatorIds.push(row.id)
      cur = []
    } else {
      cur.push(row)
    }
  }
  groups.push(cur)
  return { groups, separatorIds }
}

function filterOptionsBySearch(
  allOptions: SearchableSelectOption[],
  queryLower: string
): SearchableSelectOption[] {
  const q = queryLower.trim().toLowerCase()
  if (!q) return allOptions
  const { groups, separatorIds } = splitOptionGroups(allOptions)
  const filteredGroups = groups.map((g) =>
    g.filter((o) => o.label.toLowerCase().includes(q)),
  )
  const out: SearchableSelectOption[] = []
  for (let i = 0; i < filteredGroups.length; i++) {
    const g = filteredGroups[i]!
    const nextGroup = filteredGroups[i + 1]
    out.push(...g)
    if (i < separatorIds.length && g.length > 0 && nextGroup && nextGroup.length > 0) {
      out.push({ kind: 'separator', id: separatorIds[i]! })
    }
  }
  return out
}

/** Same group-aware filtering as SearchableSelect search (for multi-pickers). */
export function filterSearchableSelectOptionsByQuery(
  options: SearchableSelectOption[],
  query: string
): SearchableSelectOption[] {
  return filterOptionsBySearch(options, query)
}

function firstSelectableIndex(rows: SearchableSelectOption[]): number {
  return rows.findIndex(isSelectableOption)
}

function lastSelectableIndex(rows: SearchableSelectOption[]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]
    if (row && isSelectableOption(row)) return i
  }
  return -1
}

function nextSelectableIndex(
  rows: SearchableSelectOption[],
  fromIndex: number,
  direction: 1 | -1
): number {
  const len = rows.length
  if (len === 0) return -1
  let idx = fromIndex
  for (let step = 0; step <= len; step++) {
    idx = (idx + direction + len) % len
    const row = rows[idx]
    if (row && isSelectableOption(row)) return idx
  }
  return -1
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
  hideEmptyOptionInListWhenUnset = false,
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

  const filtered = useMemo(
    () => filterOptionsBySearch(allOptions, query),
    [allOptions, query]
  )

  const filteredForRender = useMemo(
    () =>
      filterOptionsForListRender(
        filtered,
        hideEmptyOptionInListWhenUnset,
        emptyOption,
        value,
      ),
    [filtered, hideEmptyOptionInListWhenUnset, emptyOption, value],
  )

  const selectedDisplay = useMemo((): ReactNode => {
    const hit = allOptions.find(
      (o): o is SearchableSelectSelectableOption => isSelectableOption(o) && o.value === value,
    )
    if (hit) return hit.labelContent ?? hit.label
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
  }, [updateListPosition, open, query, filteredForRender.length])

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
    if (activeIndex >= filteredForRender.length) {
      setActiveIndex(filteredForRender.length > 0 ? filteredForRender.length - 1 : -1)
    }
  }, [filteredForRender.length, activeIndex, filteredForRender])

  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= filteredForRender.length) return
    const row = filteredForRender[activeIndex]
    if (row && isSeparatorOption(row)) {
      const next = firstSelectableIndex(filteredForRender)
      setActiveIndex(next)
    }
  }, [filteredForRender, activeIndex])

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
  }, [activeIndex, open, filteredForRender])

  const applyOption = (v: string) => {
    onChange(v)
    close()
  }

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        if (firstSelectableIndex(filteredForRender) < 0) return
        const idx =
          e.key === 'ArrowDown'
            ? firstSelectableIndex(filteredForRender)
            : lastSelectableIndex(filteredForRender)
        if (idx < 0) return
        openPanelWithActive(idx)
        return
      }
      if (filteredForRender.length === 0) return
      if (e.key === 'ArrowDown') {
        setActiveIndex((i) =>
          i < 0 ? firstSelectableIndex(filteredForRender) : nextSelectableIndex(filteredForRender, i, 1),
        )
      } else {
        setActiveIndex((i) =>
          i < 0 ? lastSelectableIndex(filteredForRender) : nextSelectableIndex(filteredForRender, i, -1),
        )
      }
    }
    if (e.key === 'Enter' && open && activeIndex >= 0) {
      const row = filteredForRender[activeIndex]
      if (row && isSelectableOption(row)) {
        e.preventDefault()
        applyOption(row.value)
      }
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
      const idx = firstSelectableIndex(filteredForRender)
      if (idx >= 0) setActiveIndex(idx)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = lastSelectableIndex(filteredForRender)
      if (idx >= 0) setActiveIndex(idx)
      return
    }
    if (e.key === 'Enter' && activeIndex >= 0) {
      const row = filteredForRender[activeIndex]
      if (row && isSelectableOption(row)) {
        e.preventDefault()
        applyOption(row.value)
      }
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
        {filteredForRender.length === 0 ? (
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
            {filteredForRender.map((o, idx) => {
              if (isSeparatorOption(o)) {
                return (
                  <li
                    key={`sep-${o.id}-${idx}`}
                    role="separator"
                    aria-hidden
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: '0.35rem 0.5rem 0',
                      background: '#f9fafb',
                    }}
                  >
                    <div
                      style={{
                        borderTop: '1px solid #d1d5db',
                        margin: 0,
                      }}
                    />
                  </li>
                )
              }
              const nextRow = idx + 1 < filteredForRender.length ? filteredForRender[idx + 1] : undefined
              const nextIsSep = nextRow ? isSeparatorOption(nextRow) : false
              return (
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
                    aria-label={o.label}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.6rem 0.75rem',
                      border: 'none',
                      borderBottom: nextIsSep ? 'none' : '1px solid #f3f4f6',
                      background: idx === activeIndex ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    {o.labelContent ?? o.label}
                  </button>
                </li>
              )
            })}
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
          open &&
          activeIndex >= 0 &&
          filteredForRender[activeIndex] &&
          isSelectableOption(filteredForRender[activeIndex])
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
          {selectedDisplay}
        </span>
        <span aria-hidden style={{ flexShrink: 0, color: '#6b7280', fontSize: '0.65rem' }}>
          ▾
        </span>
      </button>
      {portalContent}
    </div>
  )
}
