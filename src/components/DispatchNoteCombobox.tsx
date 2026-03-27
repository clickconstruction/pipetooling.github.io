import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { DISPATCH_NOTE_PRESETS } from '../lib/dispatchNotePresets'

const MAX_SUGGESTIONS = 8

function filterPresets(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...DISPATCH_NOTE_PRESETS].slice(0, MAX_SUGGESTIONS)
  return DISPATCH_NOTE_PRESETS.filter((p) => p.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS)
}

type DispatchNoteComboboxProps = {
  id?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Multiline note entry with typeahead suggestions from DISPATCH_NOTE_PRESETS.
 * Choosing a suggestion replaces the field value; user can keep typing after that.
 * Enter selects the keyboard-highlighted option only (not implicit first); otherwise Enter inserts a newline.
 * Arrow keys navigate suggestions only while the list is open (Escape closes); when closed, arrows move the caret.
 */
export function DispatchNoteCombobox({
  id: inputId,
  value,
  onChange,
  disabled = false,
  placeholder = 'Type a note or click here and pick a suggestion...',
}: DispatchNoteComboboxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const baseId = useId()
  const listId = `${baseId}-dispatch-note-listbox`

  const suggestions = useMemo(() => filterPresets(value), [value])

  const clearBlurTimeout = () => {
    if (blurTimeoutRef.current != null) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
  }

  const closeList = () => {
    setListOpen(false)
    setActiveIndex(-1)
  }

  const applySuggestion = (text: string) => {
    onChange(text)
    closeList()
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        const len = text.length
        el.setSelectionRange(len, len)
      }
    })
  }

  useEffect(() => () => clearBlurTimeout(), [])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        id={inputId}
        ref={textareaRef}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          listOpen && activeIndex >= 0 && suggestions[activeIndex] != null
            ? `${listId}-opt-${activeIndex}`
            : undefined
        }
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => {
          onChange(e.target.value)
          setListOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => {
          clearBlurTimeout()
          setListOpen(true)
        }}
        onBlur={() => {
          blurTimeoutRef.current = setTimeout(() => {
            closeList()
            blurTimeoutRef.current = null
          }, 175)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            closeList()
            return
          }

          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!listOpen || suggestions.length === 0) return
            e.preventDefault()
            if (e.key === 'ArrowDown') {
              setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0))
            } else {
              setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
            }
            return
          }

          if (e.key === 'Enter' && listOpen && activeIndex >= 0) {
            const pick = suggestions[activeIndex]
            if (pick != null) {
              e.preventDefault()
              applySuggestion(pick)
            }
          }
        }}
        style={{
          width: '100%',
          minHeight: '4.5rem',
          resize: 'vertical',
          padding: '0.35rem 0.5rem',
          borderRadius: 4,
          border: '1px solid #d1d5db',
          boxSizing: 'border-box',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          lineHeight: 1.4,
        }}
      />
      {listOpen && suggestions.length > 0 && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 20,
            left: 0,
            right: 0,
            top: '100%',
            margin: '2px 0 0 0',
            padding: '0.25rem 0',
            listStyle: 'none',
            maxHeight: 220,
            overflowY: 'auto',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {suggestions.map((p, idx) => (
            <li
              key={p}
              id={`${listId}-opt-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(ev) => ev.preventDefault()}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => applySuggestion(p)}
              style={{
                padding: '0.4rem 0.6rem',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                background: idx === activeIndex ? '#eff6ff' : undefined,
                color: '#1f2937',
              }}
            >
              {p}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
