import { useEffect, useMemo, useState, type CSSProperties, type Dispatch } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import {
  BY_NOT_A_TRADE,
  TRADE_TEMPLATES,
  scopeBook,
  scopeBookDuplicates,
  scopeBookUseWords,
  scopeSetsFor,
  scopeWordKey,
  tradeOrder,
  type GcAction,
  type GcState,
  type ScopeBookLine,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { Picker } from './GcNewProjectPickers'
import { FIELD_HEIGHT_PX, pickerGroup } from './GcNewProjectPickerRows'

/**
 * GC mode design spike: the scope book's own page (the owner, 2026-10-04; `scope-book-mockup.html`,
 * part 3). Every line we keep, by trade: change a line, add one, see the sets, save a scope as a
 * set, and fold together two lines that say the same thing. Opened from New project's Each scope
 * step (`current` is the scope being written there) and from anywhere else that wants it.
 */

const field: CSSProperties = { ...input, width: '100%', boxSizing: 'border-box', height: FIELD_HEIGHT_PX }

type Tab = 'lines' | 'sets' | 'duplicates'

export function GcScopeBookWindow({
  state,
  dispatch,
  onClose,
  startTrade,
  current,
}: {
  state: GcState
  dispatch: Dispatch<GcAction>
  onClose: () => void
  startTrade?: string
  /** The scope being written where the book was opened from, to save as a set. */
  current?: { trade: string; lines: string[]; projectName: string; projectId?: string } | null
}) {
  const roomy = useMatchMedia('(min-width: 900px)')
  const book = useMemo(() => scopeBook(state), [state])
  const dupes = useMemo(() => scopeBookDuplicates(book), [book])
  const trades = useMemo(() => {
    const all = [...new Set([...TRADE_TEMPLATES.map((t) => t.trade), ...book.map((l) => l.trade)])]
    return all.sort((a, b) => tradeOrder(a) - tradeOrder(b) || a.localeCompare(b))
  }, [book])
  const [trade, setTrade] = useState(startTrade && trades.includes(startTrade) ? startTrade : (trades[0] ?? ''))
  const [tab, setTab] = useState<Tab>('lines')
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="listbox"]')) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const lines = book.filter((l) => l.trade === trade)
  const shown = filter.trim() === '' ? lines : lines.filter((l) => scopeWordKey(l.words).includes(scopeWordKey(filter)))
  const sets = scopeSetsFor(state, trade, current?.projectId ?? null)
  const mine = dupes.filter((d) => d.trade === trade)
  const tabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      style={{
        padding: '0.35rem 0.7rem',
        border: 'none',
        borderBottom: `2px solid ${tab === t ? 'var(--text-blue-500)' : 'transparent'}`,
        background: 'transparent',
        color: tab === t ? 'var(--text-blue-500)' : 'var(--text-600)',
        fontWeight: tab === t ? 600 : 400,
        cursor: 'pointer',
        fontSize: '0.875rem',
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="The scope book"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(1000px, 100%)',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>The scope book</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Every scope line we keep, by trade. It started from the scopes on our jobs and grows each time a line is saved.
            </div>
          </div>
          <button type="button" aria-label="Close the scope book" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: roomy ? 'row' : 'column', gap: '0.75rem', padding: '0.75rem 1rem', overflowY: 'auto', minHeight: 0 }}>
          <div role="tablist" aria-label="Trades" style={roomy ? { display: 'grid', gap: '0.2rem', flex: '0 0 14rem', alignContent: 'start' } : { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {trades.map((t) => {
              const active = t === trade
              const n = book.filter((l) => l.trade === t).length
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTrade(t)
                    setEditing(null)
                    setFilter('')
                  }}
                  style={{
                    display: 'flex',
                    gap: '0.4rem',
                    alignItems: 'center',
                    textAlign: 'left',
                    padding: '0.3rem 0.55rem',
                    borderRadius: roomy ? 6 : 999,
                    border: roomy ? '1px solid transparent' : `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                    background: active ? 'var(--bg-blue-tint)' : 'transparent',
                    color: 'var(--text-base)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ flex: roomy ? 1 : undefined, fontWeight: active ? 600 : 400 }}>{t}</span>
                  {dupes.some((d) => d.trade === t) && <Chip tone="amber">merge</Chip>}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                </button>
              )
            })}
          </div>

          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
            <div role="tablist" aria-label={`${trade} in the book`} style={{ display: 'flex', gap: '0.2rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {tabBtn('lines', `Lines (${lines.length})`)}
              {tabBtn('sets', `Sets (${sets.length})`)}
              {tabBtn('duplicates', `Duplicates to merge (${mine.length})`)}
            </div>

            {tab === 'lines' && (
              <>
                <input aria-label={`Search the ${trade} lines`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search the ${trade} lines`} style={field} />
                {shown.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No {trade} line has those words.</div>}
                <div style={{ display: 'grid' }}>
                  {shown.map((l) =>
                    editing === l.id ? (
                      <LineEditor
                        key={l.id}
                        line={l}
                        trades={trades}
                        onCancel={() => setEditing(null)}
                        onSave={(to) => {
                          dispatch({ type: 'editScopeBookLine', trade, words: l.words, to })
                          setEditing(null)
                        }}
                      />
                    ) : (
                      <div key={l.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                        <span style={{ flex: '1 1 14rem', minWidth: 0 }}>
                          <strong>{l.words}</strong>
                          {l.late.length > 0 && (
                            <>
                              {' '}
                              <Chip tone="amber">missed on {l.late.length}</Chip>
                            </>
                          )}
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {[l.spec ? `Section ${l.spec}` : null, l.leavesOut ? `leaves out ${l.leavesOut.label}, done by ${l.leavesOut.by}` : null].filter(Boolean).join(' · ') ||
                              'No section, leaves out nothing'}
                          </span>
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{scopeBookUseWords(l)}</span>
                        <Btn kind="quiet" onClick={() => setEditing(l.id)}>Edit</Btn>
                      </div>
                    ),
                  )}
                </div>
                <AddToBook trade={trade} onAdd={(words, spec) => dispatch({ type: 'saveToScopeBook', trade, words, ...(spec ? { spec } : {}) })} have={(words) => lines.some((l) => scopeWordKey(l.words) === scopeWordKey(words))} />
              </>
            )}

            {tab === 'sets' && (
              <>
                {current && current.trade === trade && current.lines.length > 0 && (
                  <SaveAsSet
                    key={trade}
                    trade={trade}
                    lines={current.lines}
                    projectName={current.projectName}
                    onSave={(name) => dispatch({ type: 'saveScopeSet', trade, name, lines: current.lines, ...(current.projectId ? { fromProjectId: current.projectId } : {}) })}
                  />
                )}
                {sets.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No sets for {trade} yet.</div>}
                {sets.map((s) => (
                  <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', fontSize: '0.85rem', display: 'grid', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <strong>{s.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {s.lines.length} {s.lines.length === 1 ? 'line' : 'lines'} · {s.note}
                      </span>
                    </div>
                    <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-600)' }}>
                      {s.lines.map((words) => (
                        <li key={words}>{words}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </>
            )}

            {tab === 'duplicates' && (
              <>
                {mine.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No {trade} lines look like the same thing.</div>}
                {mine.map((d) => (
                  <div key={`${d.fold.id}>${d.keep.id}`} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.65rem', borderRadius: 8, background: 'var(--bg-amber-tint)', fontSize: '0.85rem' }}>
                    <span style={{ flex: '1 1 16rem', minWidth: 0 }}>
                      <strong>{d.fold.words}</strong> looks the same as <strong>{d.keep.words}</strong>.
                      <span style={{ display: 'block', color: 'var(--text-600)', fontSize: '0.78rem' }}>
                        {d.fold.words}: {scopeBookUseWords(d.fold)}. {d.keep.words}: {scopeBookUseWords(d.keep)}.
                      </span>
                    </span>
                    <Btn onClick={() => dispatch({ type: 'mergeScopeBookLines', trade, from: d.fold.words, into: d.keep.words })}>Fold into “{d.keep.words}”</Btn>
                    <Btn kind="quiet" onClick={() => dispatch({ type: 'mergeScopeBookLines', trade, from: d.keep.words, into: d.fold.words })}>Keep “{d.fold.words}” instead</Btn>
                  </div>
                ))}
                {mine.length > 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Folding keeps one line. Its jobs and the times it was missed join the line it folds into.</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** One line of the book being changed: its words, its section and what it leaves out. */
function LineEditor({
  line,
  trades,
  onSave,
  onCancel,
}: {
  line: ScopeBookLine
  trades: string[]
  onSave: (to: { words: string; spec: string | null; leavesOut: { label: string; by: string } | null }) => void
  onCancel: () => void
}) {
  const [words, setWords] = useState(line.words)
  const [spec, setSpec] = useState(line.spec ?? '')
  const [out, setOut] = useState(line.leavesOut?.label ?? '')
  const [by, setBy] = useState(line.leavesOut?.by ?? '')
  const others = trades.filter((t) => t !== line.trade)
  return (
    <div style={{ display: 'grid', gap: '0.4rem', padding: '0.55rem 0.65rem', margin: '0.3rem 0', borderRadius: 8, border: '1px solid var(--text-blue-500)', background: 'var(--bg-blue-tint)', fontSize: '0.85rem' }}>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontWeight: 600 }}>The line</span>
        <input value={words} onChange={(e) => setWords(e.target.value)} style={field} aria-label="The line's words" />
      </label>
      <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))' }}>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={{ fontWeight: 600 }}>Spec section (optional)</span>
          <input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="31 10 00" style={field} aria-label="The line's spec section" />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={{ fontWeight: 600 }}>Leaves out (optional)</span>
          <input value={out} onChange={(e) => setOut(e.target.value)} placeholder="Building connections" style={field} aria-label="What a trade with this line leaves out" />
        </label>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={{ fontWeight: 600 }}>Done by</span>
          <Picker
            value={by}
            onChange={setBy}
            placeholder="Who does it"
            ariaLabel="Who does what it leaves out"
            searchPlaceholder="Search the trades"
            options={[pickerGroup('trades', 'Trades'), ...others.map((t) => ({ value: t, label: t })), pickerGroup('not', 'Not a trade'), ...BY_NOT_A_TRADE.map((t) => ({ value: t, label: t }))]}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn
          kind="primary"
          disabled={words.trim() === '' || (out.trim() !== '' && by === '')}
          onClick={() => onSave({ words: words.trim(), spec: spec.trim() || null, leavesOut: out.trim() ? { label: out.trim(), by } : null })}
        >
          Save the line
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>Cancel</Btn>
        {out.trim() !== '' && by === '' && <span style={{ color: 'var(--text-amber-700)', fontSize: '0.78rem' }}>Say who does what it leaves out.</span>}
      </div>
    </div>
  )
}

/** A line typed straight into the book. */
function AddToBook({ trade, onAdd, have }: { trade: string; onAdd: (words: string, spec: string) => void; have: (words: string) => boolean }) {
  const [words, setWords] = useState('')
  const [spec, setSpec] = useState('')
  const there = words.trim() !== '' && have(words)
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.3rem' }}>
      <input value={words} onChange={(e) => setWords(e.target.value)} placeholder={`A new ${trade} line`} aria-label={`A new ${trade} line for the book`} style={{ ...field, flex: '2 1 14rem', width: 'auto' }} />
      <input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Section (optional)" aria-label="Its spec section" style={{ ...field, flex: '1 1 8rem', width: 'auto' }} />
      <Btn
        disabled={words.trim() === '' || there}
        onClick={() => {
          onAdd(words.trim(), spec.trim())
          setWords('')
          setSpec('')
        }}
      >
        + Add to the book
      </Btn>
      {there && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>The book has that line.</span>}
    </div>
  )
}

/** Save the scope being written as a set of this trade's lines. */
function SaveAsSet({ trade, lines, projectName, onSave }: { trade: string; lines: string[]; projectName: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(`${trade} for ${projectName.trim() || 'this project'}`)
  const [saved, setSaved] = useState(false)
  return (
    <div style={{ display: 'grid', gap: '0.3rem', padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
      <strong>Save this scope as a set</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        The {lines.length} {trade} {lines.length === 1 ? 'line' : 'lines'} on {projectName.trim() || 'this project'}, to start another job from.
      </span>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="The set's name" style={{ ...field, flex: '1 1 16rem', width: 'auto' }} />
        <Btn
          kind="primary"
          disabled={name.trim() === '' || saved}
          onClick={() => {
            onSave(name.trim())
            setSaved(true)
          }}
        >
          {saved ? 'Saved' : 'Save the set'}
        </Btn>
      </div>
    </div>
  )
}

/** A button that opens the scope book: for a door from anywhere (the Board puts one on Trade partners). */
export function GcScopeBookButton({ state, dispatch, label = 'Open the scope book' }: { state: GcState; dispatch: Dispatch<GcAction>; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Btn kind="quiet" onClick={() => setOpen(true)}>{label}</Btn>
      {open && <GcScopeBookWindow state={state} dispatch={dispatch} onClose={() => setOpen(false)} />}
    </>
  )
}
