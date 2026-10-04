import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import {
  lateWords,
  linesToAdd,
  oftenMissed,
  scopeWordKey,
  scopeBookUseWords,
  searchScopeBook,
  type ScopeBookLine,
  type ScopeSetChoice,
} from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'
import { Picker } from './GcNewProjectPickers'
import { FIELD_HEIGHT_PX, pickerRow } from './GcNewProjectPickerRows'

/**
 * GC mode design spike: the scope book on a trade's scope (the owner, 2026-10-04; the revised
 * design in `to-dos/gc-mode/scope-book-mockup.html`). Three pieces: start from a set of lines, the
 * lines we missed on past jobs, and Add a line, which searches the book as you type.
 */

/** Start a trade's scope from a set: the lines already there stay, the set's other lines join them. */
export function StartFromBook({
  trade,
  sets,
  here,
  onUse,
}: {
  trade: string
  sets: ScopeSetChoice[]
  here: string[]
  onUse: (set: ScopeSetChoice) => number
}) {
  // The set that would add the most lines comes up first.
  const [pick, setPick] = useState(() => [...sets].sort((a, b) => linesToAdd(here, b.lines).length - linesToAdd(here, a.lines).length)[0]?.id ?? '')
  const [said, setSaid] = useState<string | null>(null)
  const set = sets.find((s) => s.id === pick) ?? sets[0]
  if (sets.length === 0 || !set) return null
  return (
    <div style={{ display: 'grid', gap: '0.3rem', padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
      <strong>Start from the book</strong>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
          <Picker
            value={set.id}
            onChange={(v) => {
              setPick(v)
              setSaid(null)
            }}
            options={sets.map((s) => ({
              value: s.id,
              label: `${s.name} ${s.note}`,
              labelContent: pickerRow(s.name, `${s.lines.length} ${s.lines.length === 1 ? 'line' : 'lines'} · ${s.note}`),
              triggerContent: (
                <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {s.lines.length} {s.lines.length === 1 ? 'line' : 'lines'}
                  </span>
                </span>
              ),
            }))}
            placeholder="Pick a set"
            ariaLabel={`Sets of ${trade} lines`}
            searchPlaceholder="Search the sets"
            minListWidth={320}
          />
        </div>
        <Btn
          onClick={() => {
            const added = onUse(set)
            setSaid(added === 0 ? 'Every line of that set is here already.' : `Added ${added} ${added === 1 ? 'line' : 'lines'} from ${set.name}.`)
          }}
        >
          Use these lines
        </Btn>
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        {said ?? 'Lines already here are kept. Take out what this job does not need.'}
      </span>
    </div>
  )
}

/** This trade's lines we added late on past jobs, each with + Add. Nothing to warn about: nothing shows. */
export function OftenMissed({ trade, book, here, onAdd }: { trade: string; book: ScopeBookLine[]; here: string[]; onAdd: (line: ScopeBookLine) => void }) {
  const [all, setAll] = useState(false)
  const missed = useMemo(() => oftenMissed(book, trade, here), [book, trade, here])
  if (missed.length === 0) return null
  const shown = all ? missed : missed.slice(0, 3)
  return (
    <div style={{ display: 'grid', gap: '0.35rem', padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--bg-amber-tint)', fontSize: '0.85rem' }}>
      <div>
        <strong>Often missed on {trade}</strong> <span style={{ color: 'var(--text-600)' }}>· lines we added late on past jobs</span>
      </div>
      {shown.map((l) => (
        <div key={l.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 16rem', minWidth: 0 }}>
            <strong>{l.words}</strong> {l.late[0] ? lateWords(l.late[0]) : ''}
            {l.late.length > 1 ? ` Missed on ${l.late.length} jobs in all.` : ''}
          </span>
          <Btn kind="quiet" onClick={() => onAdd(l)}>+ Add</Btn>
        </div>
      ))}
      {missed.length > 3 && (
        <div>
          <Btn kind="quiet" onClick={() => setAll((x) => !x)}>{all ? 'Show fewer' : `Show ${missed.length - 3} more`}</Btn>
        </div>
      )}
    </div>
  )
}

type Choice = { kind: 'book'; line: ScopeBookLine; otherTrade: boolean } | { kind: 'new'; words: string }

/**
 * Add a line, searching the book as you type: this trade's lines first, then the ones already here
 * (shown, not picked), then other trades' lines labeled "from Concrete", and last the typed words
 * as a new line. Enter takes the highlighted one.
 */
export function BookLineSearch({
  trade,
  book,
  here,
  onPick,
  onNew,
  autoFocus,
  onEscape,
}: {
  trade: string
  book: ScopeBookLine[]
  here: string[]
  onPick: (line: ScopeBookLine) => void
  onNew: (words: string) => void
  autoFocus?: boolean
  /** Escape with nothing typed and the list closed: what it does here (the box closes). Unset: the window around it has it. */
  onEscape?: () => void
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  // A press anywhere else closes the list, even when no blur comes (a window without focus).
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  const hits = useMemo(() => searchScopeBook(book, trade, query, here), [book, trade, query, here])
  const typed = query.trim()
  const shownHits = typed === '' ? hits.filter((h) => !h.here).slice(0, 8) : hits.slice(0, 12)
  const choices: Choice[] = [
    ...shownHits.filter((h) => !h.here).map((h) => ({ kind: 'book' as const, line: h.line, otherTrade: h.otherTrade })),
    // The typed words as a new line, unless this trade's book has them word for word.
    ...(typed !== '' && !hits.some((h) => !h.otherTrade && scopeWordKey(h.line.words) === scopeWordKey(typed)) ? [{ kind: 'new' as const, words: typed }] : []),
  ]
  const take = (c: Choice | undefined) => {
    if (!c) return
    if (c.kind === 'book') onPick(c.line)
    else onNew(c.words)
    setQuery('')
    setActive(0)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, choices.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      take(choices[active] ?? choices[0])
    } else if (e.key === 'Escape' && (open || query !== '' || onEscape)) {
      // Close the list (or the box), never the window around it.
      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
      if (!open && query === '') onEscape?.()
      setOpen(false)
      setQuery('')
    }
  }
  const row: CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'baseline',
    width: '100%',
    textAlign: 'left',
    padding: '0.4rem 0.6rem',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-base)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  }
  let n = -1
  return (
    <div ref={wrap} style={{ display: 'grid', gap: '0.25rem', flex: '1 1 18rem', minWidth: 0 }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={`Add a line to ${trade}: type to search the scope book`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        autoFocus={autoFocus}
        placeholder="Add a line: type to search the book"
        style={{ ...input, width: '100%', boxSizing: 'border-box', height: FIELD_HEIGHT_PX }}
      />
      {open && (shownHits.length > 0 || typed !== '') && (
        <div id={listId} role="listbox" aria-label={`The scope book's ${trade} lines`} style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
          {typed === '' && <div style={{ padding: '0.3rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{trade} lines in the book</div>}
          {shownHits.map((h) => {
            if (h.here)
              return (
                <div key={h.line.id} style={{ ...row, cursor: 'default', color: 'var(--text-muted)' }}>
                  <span style={{ flex: 1 }}>{h.line.words}</span>
                  <span style={{ fontSize: '0.75rem' }}>already here</span>
                </div>
              )
            n++
            const i = n
            return (
              <button
                key={h.line.id}
                type="button"
                role="option"
                aria-selected={active === i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => take(choices[i])}
                onMouseEnter={() => setActive(i)}
                style={{ ...row, background: active === i ? 'var(--bg-blue-tint)' : 'transparent' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{h.line.words}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {' '}
                    · {h.otherTrade ? `from ${h.line.trade}, pulls it into ${trade}` : scopeBookUseWords(h.line)}
                    {h.line.spec ? ` · ${h.line.spec}` : ''}
                  </span>
                </span>
                {h.line.late.length > 0 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-amber-700)', whiteSpace: 'nowrap' }}>
                    missed {h.line.late.length === 1 ? 'once' : `${h.line.late.length} times`}
                  </span>
                )}
              </button>
            )
          })}
          {choices[choices.length - 1]?.kind === 'new' &&
            (() => {
              const i = choices.length - 1
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active === i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => take(choices[i])}
                  onMouseEnter={() => setActive(i)}
                  style={{ ...row, borderBottom: 'none', color: 'var(--text-blue-500)', fontWeight: 600, background: active === i ? 'var(--bg-blue-tint)' : 'transparent' }}
                >
                  + Add "{typed}" as a new line
                </button>
              )
            })()}
        </div>
      )}
    </div>
  )
}
