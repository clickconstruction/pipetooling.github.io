import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  TAG_GROUP_WORDS,
  insertPick,
  liveTags,
  rankTaggable,
  removePick,
  tagQueryAtCaret,
  type TagListRow,
  type TaggablePerson,
} from '../../lib/jobs/noteTags'

/**
 * Tagging a teammate in a job note (punch list #363): the pieces a note box needs.
 *
 * `useNoteTagBox` holds the picks, the list under the box and the keys. The box keeps its own
 * input and its own Post, and asks this for the ids to send with the note. `TaggedNoteBody`, in
 * its own file, draws a posted note's words with its name chips and the waiting words after them.
 */

type Picked = { userId: string; name: string }

const chipStyle: CSSProperties = {
  display: 'inline-block',
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-blue-800)',
  border: '1px solid var(--border-blue)',
  borderRadius: 999,
  padding: '0 7px',
  fontWeight: 600,
  fontSize: '0.92em',
  whiteSpace: 'nowrap',
}
const groupStyle: CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  padding: '6px 8px 2px',
}

/** What the person does, as the list says it beside the name. */
function roleWords(person: TaggablePerson): string {
  const role = person.role === 'helpers' ? 'crew' : person.role === 'superintendent' ? 'superintendent' : person.role === 'primary' ? 'crew' : 'office'
  return person.onJob && role !== 'office' ? `${role} · on this job` : role
}

export type NoteTagBox = {
  /** The picked names above the box, each with its × (null when none). */
  chips: ReactNode
  /** The list, to draw inside a `position: relative` wrapper around the box (null when shut). */
  list: ReactNode
  /** The @ button for the box's row (null when tagging is off). */
  atButton: ReactNode
  /** Call from the input's onChange with the new words and the caret. */
  onText: (value: string, caret: number | null) => void
  /** Call first from the input's onKeyDown. True means the key was the list's and the box must do nothing with it. */
  onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => boolean
  /** The ids to send with this body: the picks whose names are still in it. */
  taggedIds: (body: string) => string[]
  /** After a post, or when the box is cleared. */
  reset: () => void
}

export function useNoteTagBox(opts: {
  jobId: string
  draft: string
  setDraft: (value: string) => void
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  /** False draws no @ button and opens no list: the box is as it was. */
  enabled: boolean
  /** An answer box puts the person who asked on top. */
  askerId?: string | null
  /** A phone opens the list above the box, clear of the keyboard. */
  place?: 'above' | 'below'
}): NoteTagBox {
  const { jobId, draft, setDraft, inputRef, enabled, askerId = null, place = 'below' } = opts
  const [picked, setPicked] = useState<Picked[]>([])
  const [caret, setCaret] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [sel, setSel] = useState(0)
  const [people, setPeople] = useState<TaggablePerson[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const askedFor = useRef<string | null>(null)
  const nextCaret = useRef<number | null>(null)

  const query = enabled && !dismissed && caret != null ? tagQueryAtCaret(draft, caret) : null
  const open = query != null

  // The list is read once per job, the first time it opens.
  useEffect(() => {
    if (!open || askedFor.current === jobId) return
    askedFor.current = jobId
    setPeople(null)
    setLoadError(null)
    let live = true
    void supabase.rpc('job_note_taggable', { p_job_id: jobId }).then(({ data, error }) => {
      if (!live) return
      if (error) {
        setLoadError(formatErrorMessage(error, 'The names could not be read'))
        return
      }
      setPeople((data ?? []).map((r) => ({ userId: r.user_id, name: r.name, role: r.role, onJob: r.on_job })))
    })
    return () => {
      live = false
    }
  }, [open, jobId])

  const rows: TagListRow[] = useMemo(
    () => (query && people ? rankTaggable(people, query.query, { pickedIds: liveTags(draft, picked).map((p) => p.userId), askerId }) : []),
    [query, people, draft, picked, askerId],
  )
  const active = rows.length === 0 ? 0 : Math.min(sel, rows.length - 1)

  // Put the caret after the name a pick wrote, once the input holds the new words.
  useEffect(() => {
    const at = nextCaret.current
    if (at == null) return
    nextCaret.current = null
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(at, at)
  }, [draft, inputRef])

  const pick = useCallback(
    (person: TaggablePerson) => {
      const next = insertPick(draft, caret ?? draft.length, person.name)
      nextCaret.current = next.caret
      setPicked((prev) => [...prev.filter((p) => p.userId !== person.userId), { userId: person.userId, name: person.name }])
      setCaret(next.caret)
      setSel(0)
      setDraft(next.text)
    },
    [draft, caret, setDraft],
  )

  const onText = useCallback(
    (value: string, at: number | null) => {
      setDraft(value)
      setCaret(at ?? value.length)
      setDismissed(false)
      setSel(0)
    },
    [setDraft],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
      if (!open) return false
      if (e.key === 'Escape') {
        e.stopPropagation()
        setDismissed(true)
        return true
      }
      if (rows.length === 0) return false
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSel((active + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length)
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const row = rows[active]
        if (row) pick(row.person)
        return true
      }
      return false
    },
    [open, rows, active, pick],
  )

  const reset = useCallback(() => {
    setPicked([])
    setCaret(null)
    setDismissed(false)
    setSel(0)
  }, [])

  const taggedIds = useCallback((body: string) => liveTags(body, picked).map((p) => p.userId), [picked])

  const pressAt = () => {
    const el = inputRef.current
    const at = el?.selectionStart ?? draft.length
    const before = draft.slice(0, at)
    const head = `${before}${before && !/\s$/.test(before) ? ' ' : ''}@`
    nextCaret.current = head.length
    setCaret(head.length)
    setDismissed(false)
    setSel(0)
    setDraft(head + draft.slice(at))
  }

  const live = liveTags(draft, picked)
  const chips =
    enabled && live.length > 0 ? (
      <div data-note-tag-chips style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 4px 6px' }}>
        Will tag:
        {live.map((p) => (
          <span key={p.userId} style={chipStyle}>
            @{p.name}
            <button
              type="button"
              aria-label={`Take ${p.name} off`}
              onClick={(e) => {
                e.stopPropagation()
                setPicked((prev) => prev.filter((x) => x.userId !== p.userId))
                setDraft(removePick(draft, p.name))
              }}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', font: 'inherit' }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    ) : null

  const atButton = enabled ? (
    <button
      type="button"
      aria-label="Tag a teammate"
      title="Tag a teammate"
      onClick={(e) => {
        e.stopPropagation()
        pressAt()
      }}
      style={{ background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 999, minWidth: 28, padding: '1px 8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
    >
      @
    </button>
  ) : null

  let lastGroup: string | null = null
  const list = open ? (
    <div
      role="listbox"
      aria-label="Teammates"
      data-note-tag-list
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 8,
        right: 8,
        ...(place === 'above' ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
        zIndex: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
        padding: 4,
        maxHeight: 260,
        overflowY: 'auto',
        textAlign: 'left',
      }}
    >
      {loadError ? (
        <div style={{ ...groupStyle, textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{loadError}</div>
      ) : people == null ? (
        <div style={groupStyle}>Reading the names…</div>
      ) : rows.length === 0 ? (
        <div style={groupStyle}>Nobody by that name can be tagged on this job</div>
      ) : (
        rows.map((row, i) => {
          const head = row.group !== lastGroup ? TAG_GROUP_WORDS[row.group] : null
          lastGroup = row.group
          return (
            <div key={row.person.userId}>
              {head ? <div style={groupStyle}>{head}</div> : null}
              <div
                role="option"
                aria-selected={i === active}
                // mousedown, not click: the input must keep its focus and its caret.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(row.person)
                }}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '7px 8px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  minHeight: 40,
                  boxSizing: 'border-box',
                  background: i === active ? 'var(--bg-blue-tint)' : 'transparent',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-strong)' }}>{row.person.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', textAlign: 'right' }}>{roleWords(row.person)}</span>
              </div>
            </div>
          )
        })
      )}
    </div>
  ) : null

  return { chips, list, atButton, onText, onKeyDown, taggedIds, reset }
}
