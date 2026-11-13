import { useEffect, useState, type CSSProperties } from 'react'
import type { CallTodo } from '../../lib/bridge/callTodo'
import { todoCheckLabel, todoStateWords, todoWindowLines, type TodoState } from '../../lib/bridge/callTodoState'
import { lineStates, type TaskCriterion, type TaskCriterionCheck } from '../../lib/taskCriteria'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The check on a line of the Bridge's list (punch list #334, PR 9; `callTodoState.ts` has the owner's words).
 *
 * Grey while nobody has the thing: a press makes its to-do card. Blue with the person's name and how long while
 * someone has it, amber once it has waited too long: a press shows the card. Grey again once it is finished, with
 * who finished it, so it can be handed out again.
 */

type Seen = Extract<TodoState, { kind: 'open' | 'covered' | 'done' }>

const box = (size: number): CSSProperties => ({ width: size, height: size, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, font: 'inherit', padding: 0, cursor: 'pointer' })

function boxLook(state: TodoState): CSSProperties {
  // Someone has it: the app's blue press under a white mark. Waited too long: amber. Otherwise an empty grey box.
  if (state.kind === 'open' && state.late) return { background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)' }
  if (state.kind === 'open') return { background: '#2563eb', border: '1px solid #2563eb', color: 'white' }
  if (state.kind === 'covered') return { background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', color: 'var(--text-link)' }
  return { background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }
}

const wordsColor = (state: TodoState): string => (state.kind === 'open' ? (state.late ? 'var(--text-amber-800)' : 'var(--text-link)') : 'var(--text-muted)')

export function BridgeTodoCheck({ todo, state, dayLabel, narrow, onMake, onSee, showWords = true }: { todo: CallTodo; state: TodoState; dayLabel: (ymd: string) => string; narrow: boolean; onMake: (todo: CallTodo) => void; onSee: (state: Seen) => void; /** False where the words are drawn elsewhere: a table says them under the row. */ showWords?: boolean }) {
  const words = showWords ? todoStateWords(state, dayLabel) : ''
  const size = narrow ? 44 : 36
  const press = () => (state.kind === 'open' || state.kind === 'covered' ? onSee(state) : onMake(todo))
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '0 0 auto', marginLeft: 'auto' }} data-testid="bridge-week-dive-todo-state" data-todo-state={state.kind === 'open' && state.late ? 'late' : state.kind}>
      {words && <span style={{ fontSize: '0.78rem', fontWeight: state.kind === 'open' ? 700 : 400, color: wordsColor(state), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{words}</span>}
      <button type="button" onClick={press} aria-label={todoCheckLabel(todo, state, dayLabel)} title={state.kind === 'none' || state.kind === 'done' ? 'Make a to-do' : 'See the to-do'} data-testid="bridge-week-dive-todo" style={{ ...box(size), ...boxLook(state) }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4.5 10.5l3.6 3.6 7.4-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </span>
  )
}

/** What the window reads of the card's *Done when…* lines. The page supplies the read so this file holds no client. */
export type TodoLinesRead = (itemId: string, instanceIds: string[]) => Promise<{ criteria: TaskCriterion[]; checks: TaskCriterionCheck[]; error: string | null }>

/**
 * The window a blue check opens: the card, who has it, since when, and its *Done when…* lines as ticked so far.
 * It changes nothing; *Open the to-do* goes to the app's own task window, where it is edited, handed on or finished.
 */
export function BridgeTodoWindow({ state, todayYmd, dayLabel, readLines, onOpen, onClose }: { state: Seen; todayYmd: string; dayLabel: (ymd: string) => string; readLines: TodoLinesRead; onOpen: (itemId: string) => void; onClose: () => void }) {
  const card = state.card
  const [lines, setLines] = useState<Array<{ id: string; body: string; done: boolean }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const openInstance = card.instances.find((i) => i.doneYmd == null) ?? card.instances[card.instances.length - 1] ?? null
  const instanceId = openInstance?.id ?? null
  useEffect(() => {
    let cancelled = false
    setLines(null)
    setError(null)
    void (async () => {
      try {
        const read = await readLines(card.itemId, instanceId ? [instanceId] : [])
        if (cancelled) return
        if (read.error) setError(read.error)
        const own = read.criteria.filter((c) => c.checklist_item_id === card.itemId)
        const states = instanceId ? lineStates(own, read.checks, instanceId) : own.map((c) => ({ criterion: c, checked: false }))
        setLines(states.map((s) => ({ id: s.criterion.id, body: s.criterion.body, done: s.checked })))
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [card.itemId, instanceId, readLines])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const fine: CSSProperties = { fontSize: '0.84rem', color: 'var(--text-700)' }
  const done = lines ? lines.filter((l) => l.done).length : 0
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 770, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} data-testid="bridge-todo-window-backdrop">
      <div role="dialog" aria-modal="true" aria-label="The to-do" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', width: 'min(520px, 100%)', maxHeight: '86vh', overflowY: 'auto', padding: '1rem 1.1rem 1.1rem' }} data-testid="bridge-todo-window">
        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{state.kind === 'covered' ? 'The customer’s to-do' : 'The to-do'}</div>
        <div style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.3, margin: '4px 0 8px' }}>{card.title}</div>
        <div style={{ display: 'grid', gap: 2 }} data-testid="bridge-todo-window-facts">
          {todoWindowLines(state, todayYmd, dayLabel).map((l) => (
            <div key={l} style={fine}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-strong)' }}>Done when{lines && lines.length > 0 ? `, ${done} of ${lines.length} ticked` : ''}</div>
          {error ? (
            <div style={{ ...fine, color: 'var(--text-amber-800)' }}>The lines could not be read. {error}</div>
          ) : !lines ? (
            <div style={fine}>Reading the lines…</div>
          ) : lines.length === 0 ? (
            <div style={fine}>This to-do has no lines. It is finished when its person marks it done.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, display: 'grid', gap: 4 }} data-testid="bridge-todo-window-lines">
              {lines.map((l) => (
                <li key={l.id} style={{ ...fine, display: 'flex', gap: 8, alignItems: 'baseline', color: l.done ? 'var(--text-muted)' : 'var(--text-700)' }}>
                  <span aria-hidden="true" style={{ flex: '0 0 auto', width: 14, color: l.done ? 'var(--text-green-700)' : 'var(--text-muted)', fontWeight: 700 }}>
                    {l.done ? '✓' : '○'}
                  </span>
                  <span style={{ textDecoration: l.done ? 'line-through' : undefined }}>
                    {l.body}
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{l.done ? ', ticked' : ', not ticked yet'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
          <button type="button" onClick={onClose} style={{ font: 'inherit', fontSize: '0.86rem', fontWeight: 600, minHeight: 40, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}>
            Close
          </button>
          <button type="button" onClick={() => onOpen(card.itemId)} data-testid="bridge-todo-window-open" style={{ font: 'inherit', fontSize: '0.86rem', fontWeight: 700, minHeight: 40, padding: '0 0.9rem', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: 'white', cursor: 'pointer' }}>
            Open the to-do
          </button>
        </div>
      </div>
    </div>
  )
}
