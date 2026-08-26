import { useCallback, useEffect, useRef, useState } from 'react'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import {
  applyPaste,
  appendEntry,
  deserializeTape,
  filterTape,
  formatAmount,
  formatTyped,
  formatWhen,
  initialCalcState,
  isNoteStarterKey,
  keyboardCalcKey,
  pressBackspace,
  pressClear,
  pressDigit,
  pressEquals,
  pressOp,
  pressPercent,
  rollBackTo,
  type CalcState,
  type TapeEntry,
} from '../../lib/tapeCalculator'

/**
 * The Pricing Tape (v2.2359): a floating tape calculator for Bids → Pricing.
 * Rests as a small icon in the bottom-right corner; click to unfold. Every
 * `=` prints to a searchable, timestamped tape with notes and rollback.
 * Desktop-only; tape and open/closed state persist per device.
 *
 * All math/parse/search logic lives in src/lib/tapeCalculator.ts.
 */
const TAPE_STORAGE_KEY = 'pipetooling_pricing_tape_v1'
const OPEN_STORAGE_KEY = 'pipetooling_pricing_tape_open_v1'

/** Under every modal (ResponsiveModalShell is 1100), above page chrome — same shelf as SectionDock. */
const WIDGET_Z = 900

const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

export function BidsPricingCalculator() {
  const narrow = useNarrowViewport640()
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OPEN_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [armed, setArmed] = useState(false)
  const [calc, setCalc] = useState<CalcState>(initialCalcState)
  const [entries, setEntries] = useState<TapeEntry[]>(() => {
    try {
      return deserializeTape(localStorage.getItem(TAPE_STORAGE_KEY))
    } catch {
      return []
    }
  })
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [copied, setCopied] = useState(false)
  // re-render every 30s while open so "4m ago" stays honest
  const [, setAgoTick] = useState(0)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const tapeScrollRef = useRef<HTMLDivElement | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const armedRef = useRef(armed)
  armedRef.current = armed
  const calcRef = useRef(calc)
  calcRef.current = calc
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const editingRef = useRef(editingId)
  editingRef.current = editingId

  const persistEntries = useCallback((next: TapeEntry[]) => {
    setEntries(next)
    try {
      localStorage.setItem(TAPE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* tape is a per-device nicety */
    }
  }, [])

  const setOpenPersisted = useCallback((next: boolean) => {
    setOpen(next)
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, String(next))
    } catch {
      /* per-device nicety */
    }
  }, [])

  const openCalc = useCallback(() => {
    setOpenPersisted(true)
    setArmed(true)
  }, [setOpenPersisted])

  const closeCalc = useCallback(() => {
    setArmed(false)
    setEditingId(null)
    setOpenPersisted(false)
  }, [setOpenPersisted])

  const pressCalcKey = useCallback(
    (action: NonNullable<ReturnType<typeof keyboardCalcKey>>) => {
      const state = calcRef.current
      if (action.kind === 'digit') setCalc(pressDigit(state, action.d))
      else if (action.kind === 'op') setCalc(pressOp(state, action.op))
      else if (action.kind === 'percent') setCalc(pressPercent(state))
      else if (action.kind === 'backspace') setCalc(pressBackspace(state))
      else if (action.kind === 'clear') setCalc(pressClear())
      else if (action.kind === 'equals') {
        const { state: next, entry } = pressEquals(state, Date.now())
        setCalc(next)
        if (entry) persistEntries(appendEntry(entriesRef.current, entry))
      }
    },
    [persistEntries],
  )

  // Keyboard capture while armed — plus Esc to disarm/close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !armedRef.current && !editingRef.current) {
        closeCalc()
        return
      }
      if (!armedRef.current) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (e.key === 'Escape') {
        setArmed(false)
        return
      }
      // Right after `=`, letters start a note on the freshest tape line.
      const last = entriesRef.current[entriesRef.current.length - 1]
      if (isNoteStarterKey(e.key) && calcRef.current.justEvaluated && last) {
        setEditingId(last.id)
        setNoteDraft(e.key)
        e.preventDefault()
        return
      }
      const action = keyboardCalcKey(e.key)
      if (action) {
        pressCalcKey(action)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeCalc, pressCalcKey])

  // Native paste while armed — no permission prompt, works from any spreadsheet.
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      if (!armedRef.current || isTypingTarget(e.target)) return
      const text = e.clipboardData?.getData('text') ?? ''
      const { state, entry } = applyPaste(calcRef.current, text, Date.now())
      if (state === calcRef.current && !entry) return
      e.preventDefault()
      setCalc(state)
      if (entry) persistEntries(appendEntry(entriesRef.current, entry))
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open, persistEntries])

  // Clicking anywhere outside the panel drops the armed ring instantly.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current &&
        e.target instanceof Node &&
        !panelRef.current.contains(e.target)
      ) {
        setArmed(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setAgoTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [open])

  // Newest line stays in view as the tape grows.
  useEffect(() => {
    const el = tapeScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, search, open])

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    },
    [],
  )

  if (narrow) return null

  const now = Date.now()
  const shown = filterTape(entries, search, now)

  const saveNote = (id: string, raw: string) => {
    const note = raw.trim()
    persistEntries(
      entriesRef.current.map((e) =>
        e.id === id ? { ...e, note: note || undefined } : e,
      ),
    )
    setEditingId(null)
  }

  const copyResult = () => {
    const text = formatTyped(calc.current).replace(/,/g, '')
    void navigator.clipboard?.writeText?.(text)
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1200)
  }

  const corner = {
    position: 'fixed' as const,
    right: 16,
    bottom: 'calc(var(--app-bottom-chrome, 0px) + 16px)',
    zIndex: WIDGET_Z,
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openCalc}
        aria-label="Open the calculator"
        title="Calculator"
        style={{
          ...corner,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--menu-bg)',
          border: '1px solid var(--chrome-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-amber-700)',
          padding: 0,
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden
        >
          <rect x="5" y="3" width="14" height="18" rx="2.5" />
          <line x1="8.2" y1="7.2" x2="15.8" y2="7.2" />
          {[11.5, 14.5, 17.5].map((cy) =>
            [9, 12, 15].map((cx) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.4" />
            )),
          )}
        </svg>
      </button>
    )
  }

  const keyStyle: React.CSSProperties = {
    fontSize: '0.9375rem',
    fontWeight: 600,
    padding: '0.5rem 0',
    borderRadius: 9,
    border: '1px solid var(--border)',
    background: 'var(--bg-subtle)',
    color: 'var(--text-strong)',
    cursor: 'pointer',
    fontVariantNumeric: 'tabular-nums',
  }
  const PAD: {
    label: string
    key: string
    span?: number
    style?: React.CSSProperties
  }[] = [
    {
      label: 'C',
      key: 'c',
      style: { fontSize: '0.75rem', color: 'var(--text-muted)' },
    },
    {
      label: 'Del',
      key: 'Backspace',
      style: { fontSize: '0.75rem', color: 'var(--text-muted)' },
    },
    { label: '%', key: '%', style: { color: 'var(--text-amber-700)' } },
    { label: '÷', key: '/', style: { color: 'var(--text-amber-700)' } },
    { label: '7', key: '7' },
    { label: '8', key: '8' },
    { label: '9', key: '9' },
    { label: '×', key: '*', style: { color: 'var(--text-amber-700)' } },
    { label: '4', key: '4' },
    { label: '5', key: '5' },
    { label: '6', key: '6' },
    { label: '−', key: '-', style: { color: 'var(--text-amber-700)' } },
    { label: '1', key: '1' },
    { label: '2', key: '2' },
    { label: '3', key: '3' },
    { label: '+', key: '+', style: { color: 'var(--text-amber-700)' } },
    { label: '0', key: '0', span: 2 },
    { label: '.', key: '.' },
    {
      label: '=',
      key: '=',
      style: { background: '#d97706', borderColor: '#d97706', color: '#fff' },
    },
  ]

  const hint =
    calc.exprParts.length > 0
      ? calc.exprParts.join(' ')
      : armed && calc.justEvaluated && entries.length > 0
        ? 'type a word to label this line'
        : armed && calc.current === '0' && !calc.pending
          ? '⌘V to paste · type to calculate'
          : ' '
  const hintIsGhost = calc.exprParts.length === 0 && hint !== ' '

  return (
    <div
      ref={panelRef}
      onMouseDown={(e) => {
        if (!isTypingTarget(e.target)) {
          e.preventDefault()
          setArmed(true)
        }
      }}
      style={{
        ...corner,
        width: 296,
        background: 'var(--surface)',
        border: armed ? '1px solid #d97706' : '1px solid var(--border-strong)',
        borderRadius: 14,
        boxShadow: armed
          ? '0 0 0 3px rgba(217,119,6,0.33), 0 10px 30px rgba(0,0,0,0.18)'
          : '0 10px 30px rgba(0,0,0,0.18)',
        transition: 'box-shadow 0.18s, border-color 0.18s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderBottom: '1px solid var(--border)',
          userSelect: 'none',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: armed ? '#d97706' : 'var(--text-muted)',
            transition: 'background 0.18s',
          }}
        />
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Calculator
        </span>
        {armed ? (
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 600,
              color: 'var(--text-amber-700)',
              background: 'var(--bg-amber-tint)',
              padding: '2px 8px',
              borderRadius: 999,
              marginLeft: 'auto',
            }}
          >
            keys land here
          </span>
        ) : null}
        <button
          type="button"
          onClick={closeCalc}
          aria-label="Tuck the calculator away"
          title="Tuck away"
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            padding: '0 2px',
            marginLeft: armed ? 4 : 'auto',
            lineHeight: 1,
          }}
        >
          —
        </button>
      </div>

      <div style={{ padding: '8px 10px 0' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setArmed(false)}
          placeholder="Search the tape… (“1599”, “lockhart”)"
          aria-label="Search the tape"
          style={{
            width: '100%',
            fontSize: '0.72rem',
            padding: '5px 9px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-strong)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div
        ref={tapeScrollRef}
        style={{
          height: 150,
          overflowY: 'auto',
          padding: '14px 10px 4px',
          background: 'var(--bg-amber-tint)',
          margin: '8px 10px 0',
          borderRadius: 8,
          border: '1px solid var(--border)',
          maskImage: 'linear-gradient(to bottom, transparent 0, black 26px)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0, black 26px)',
        }}
      >
        {shown.length === 0 ? (
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '10px 0',
            }}
          >
            {search.trim()
              ? `Nothing on the tape matches “${search.trim()}”`
              : 'The tape is empty — do some math.'}
          </div>
        ) : (
          shown.map((e) => (
            <div
              key={e.id}
              onClick={() => {
                if (editingId) return
                setCalc(rollBackTo(e))
                setArmed(true)
              }}
              title="Click to roll back to this result"
              style={{
                padding: '5px 6px',
                borderRadius: 7,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {e.expr} =
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--text-strong)',
                  }}
                >
                  {formatAmount(e.result)}
                </span>
                <span
                  style={{
                    fontSize: '0.63rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatWhen(e.at, now)}
                </span>
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    setEditingId(e.id)
                    setNoteDraft(e.note ?? '')
                  }}
                  aria-label="Add a note to this line"
                  title="Add a note"
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: '0 2px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '0.63rem',
                  }}
                >
                  ✎
                </button>
              </span>
              {editingId === e.id ? (
                <input
                  autoFocus
                  value={noteDraft}
                  onChange={(ev) => setNoteDraft(ev.target.value)}
                  onMouseDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => ev.stopPropagation()}
                  onKeyDown={(ev) => {
                    ev.stopPropagation()
                    if (ev.key === 'Enter') saveNote(e.id, noteDraft)
                    else if (ev.key === 'Escape') setEditingId(null)
                  }}
                  onBlur={() => saveNote(e.id, noteDraft)}
                  placeholder="note… Enter saves, Esc cancels"
                  aria-label="Note for this tape line"
                  style={{
                    width: '100%',
                    fontSize: '0.66rem',
                    fontStyle: 'italic',
                    padding: '2px 5px',
                    border: '1px solid #d97706',
                    borderRadius: 5,
                    background: 'var(--surface)',
                    color: 'var(--text-strong)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              ) : e.note ? (
                <span
                  title={e.note}
                  style={{
                    fontSize: '0.66rem',
                    color: 'var(--text-amber-700)',
                    fontStyle: 'italic',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✎ {e.note}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '8px 14px 2px', textAlign: 'right' }}>
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            minHeight: 16,
            fontStyle: hintIsGhost ? 'italic' : undefined,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {hint}
        </div>
        <div
          onClick={copyResult}
          title="Click to copy"
          style={{
            fontSize: '1.625rem',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-strong)',
            cursor: 'copy',
            position: 'relative',
            display: 'inline-block',
          }}
        >
          {formatTyped(calc.current)}
          <span
            aria-live="polite"
            style={{
              position: 'absolute',
              right: 0,
              top: -16,
              fontSize: '0.63rem',
              fontWeight: 700,
              color: 'var(--text-green-700)',
              opacity: copied ? 1 : 0,
              transition: 'opacity 0.15s',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? 'Copied ✓' : ''}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          padding: '8px 12px 12px',
        }}
      >
        {PAD.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => {
              setArmed(true)
              const action = keyboardCalcKey(k.key)
              if (action) pressCalcKey(action)
            }}
            style={{
              ...keyStyle,
              ...(k.span ? { gridColumn: `span ${k.span}` } : null),
              ...k.style,
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  )
}
