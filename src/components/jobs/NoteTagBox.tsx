import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { supabase } from '../../lib/supabase'
import { EmptyState } from '../EmptyState'
import { formatErrorMessage } from '../../utils/errorHandling'
import { TagMarkLayer } from './NoteTagMarkLayer'
import {
  backspaceTag,
  backspacedTag,
  draftMarkParts,
  insertPick,
  liveTags,
  rankTaggable,
  removePick,
  tagNameQueryAtCaret,
  tagPersonSays,
  tagTypingAtCaret,
  taskOffer,
  type TagListRow,
  type TaggablePerson,
} from '../../lib/jobs/noteTags'

/**
 * Tagging a teammate in a job note (punch list #363): the pieces a note box needs.
 *
 * `useNoteTagBox` holds the picks, the row of names at the box and the keys. The box keeps its own
 * input and its own Post, and asks this for the ids to send with the note. `TaggedNoteBody`, in
 * its own file, draws a posted note's words with its name chips and the waiting words after them.
 *
 * The easier box (punch list #375): the names are a row of presses a thumb can hit, the row
 * follows the words through a space, each made tag is tinted in the words by a layer under the
 * box, and one Backspace right after a tag takes it off whole. A tag is still only a tap or
 * Enter. A name that was only typed stays plain words.
 */

type Picked = { userId: string; name: string }

/** A person offered before a letter is typed: who they are, and the few words under the name. */
export type NoteTagOffer = { userId: string; name: string; says: string }

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
const hintStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  padding: '6px 8px',
}
/** One name as a press: tall enough for a thumb, the name over what the person does. */
const pressStyle: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  gap: 1,
  minHeight: 44,
  boxSizing: 'border-box',
  padding: '4px 12px',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  maxWidth: '100%',
}
const pressNameStyle: CSSProperties = { fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }
const pressSaysStyle: CSSProperties = { fontSize: '0.6875rem', color: 'var(--text-muted)' }

/** The row in the flow of a sheet: two lines of names and a sliver of the third, so the sheet keeps its box and Save above a phone's keyboard. */
const INLINE_ROW_MAX_HEIGHT = 124

/** The keys a phone keyboard reports when it does not say which key was pressed. */
const UNNAMED_KEYS: readonly string[] = ['Unidentified', 'Process']

export type NoteTagBox = {
  /** The line above the box, in the flow: the picked names, each with its ×, and the names offered before a letter is typed (null when neither). */
  chips: ReactNode
  /** The row of names, to draw inside a `position: relative` wrapper around the box (null when shut). */
  list: ReactNode
  /** The @ button for the box's row (null when tagging is off). */
  atButton: ReactNode
  /**
   * The mark in the words (null when nothing is marked). Draw it right before the input, as its
   * sibling. The input needs `position: relative` and a see-through background to sit over it.
   */
  mark: ReactNode
  /** Call from the input's onChange with the new words and the caret. */
  onText: (value: string, caret: number | null) => void
  /** Call first from the input's onKeyDown. True means the key was the row's and the box must do nothing with it. */
  onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => boolean
  /** The ids to send with this body: the picks whose names are still in it. */
  taggedIds: (body: string) => string[]
  /** After a post, or when the box is cleared. */
  reset: () => void
}

export function useNoteTagBox(opts: {
  /** The job whose notes the box writes. Empty when the box is a task's. */
  jobId: string
  /**
   * The task day row whose thread the box writes (punch list #375). With it the names come from
   * `task_note_taggable`, they are read as soon as the box is drawn so the task's own people can
   * be offered before a letter is typed, and a caller the task's list refuses gets a plain box.
   */
  taskInstanceId?: string | null
  draft: string
  setDraft: (value: string) => void
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  /** False draws no @ button and opens no row: the box is as it was. */
  enabled: boolean
  /** An answer box puts the person who asked on top. */
  askerId?: string | null
  /** The names offered as presses before a letter is typed: the person who asked, in an answer box. */
  offer?: readonly NoteTagOffer[]
  /**
   * A phone opens the row above the box, clear of the keyboard. `inline` draws the row in the flow instead, for a box
   * in a sheet from the bottom: the sheet grows by the row, where a row hung above the box would be cut by the sheet's edge.
   */
  place?: 'above' | 'below' | 'inline'
  /** The @ button as tall as a box whose buttons are 44 px, a task's. */
  bigAt?: boolean
}): NoteTagBox {
  const { jobId, taskInstanceId = null, draft, setDraft, inputRef, askerId = null, offer, place = 'below', bigAt = false } = opts
  // What the names are read for. A task's box and a job's box never share a list.
  const target = taskInstanceId ? `task:${taskInstanceId}` : `job:${jobId}`
  // The task's list refused this caller: they are not one of its people, so the box is plain.
  const [refusedFor, setRefusedFor] = useState<string | null>(null)
  const enabled = opts.enabled && refusedFor !== target
  const [picked, setPicked] = useState<Picked[]>([])
  const [caret, setCaret] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [sel, setSel] = useState(0)
  const [people, setPeople] = useState<TaggablePerson[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const askedFor = useRef<string | null>(null)
  const nextCaret = useRef<number | null>(null)
  const lastKey = useRef<string | null>(null)

  const live = useMemo(() => (enabled ? liveTags(draft, picked) : []), [enabled, draft, picked])
  const liveNames = useMemo(() => live.map((p) => p.name), [live])
  // Everyone the row could still offer, for the rule that runs through a space.
  const offerable = useMemo(
    () => (people ? rankTaggable(people, '', { pickedIds: live.map((p) => p.userId), askerId }) : []),
    [people, live, askerId],
  )
  const offerableNames = useMemo(() => offerable.map((r) => r.person.name), [offerable])

  const typing = enabled && caret != null ? tagTypingAtCaret(draft, caret) : null
  // A job's names wait for the first @. A task's are read with the box, for the names offered before a letter.
  const wanted = enabled && (typing != null || taskInstanceId != null)
  const query = enabled && !dismissed && caret != null ? tagNameQueryAtCaret(draft, caret, offerableNames, liveNames) : null

  // The names are read once per job or task.
  useEffect(() => {
    if (!wanted || askedFor.current === target) return
    askedFor.current = target
    setPeople(null)
    setLoadError(null)
    let alive = true
    let answered = false
    if (taskInstanceId) {
      void supabase.rpc('task_note_taggable', { p_instance_id: taskInstanceId }).then(({ data, error }) => {
        if (!alive) return
        answered = true
        if (error) {
          // 42501 is the list saying this caller is not one of the task's people. That is no failure to show.
          if (error.code === '42501') setRefusedFor(target)
          else setLoadError(formatErrorMessage(error, 'The names could not be read'))
          return
        }
        setPeople((data ?? []).map((r) => ({ userId: r.user_id, name: r.name, role: r.role, onJob: false, onTask: r.on_task, gave: r.gave })))
      })
    } else {
      void supabase.rpc('job_note_taggable', { p_job_id: jobId }).then(({ data, error }) => {
        if (!alive) return
        answered = true
        if (error) {
          setLoadError(formatErrorMessage(error, 'The names could not be read'))
          return
        }
        setPeople((data ?? []).map((r) => ({ userId: r.user_id, name: r.name, role: r.role, onJob: r.on_job })))
      })
    }
    return () => {
      alive = false
      // A read dropped before it answered (the @ was typed and taken back at once) is asked again the next time
      // the names are wanted. Before, the box said Reading the names… from then on.
      if (!answered) askedFor.current = null
    }
  }, [wanted, target, taskInstanceId, jobId])

  const rows: TagListRow[] = useMemo(() => (query ? rankTaggable(offerable.map((r) => r.person), query.query, { askerId }) : []), [query, offerable, askerId])
  const active = rows.length === 0 ? 0 : Math.min(sel, rows.length - 1)
  // The row is up while names fit, while they are being read, and for a bare @ with nobody left
  // to offer. Letters that are nobody's name, as in `@home`, show no row.
  const open = query != null && (loadError != null || people == null || rows.length > 0 || query.query === '')

  // Put the caret after the name a pick wrote, once the input holds the new words.
  useEffect(() => {
    const at = nextCaret.current
    if (at == null) return
    nextCaret.current = null
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(at, at)
    // Setting the caret does not slide the words: when the name was written at the end, show the end.
    if (at >= el.value.length) {
      el.scrollLeft = el.scrollWidth
      el.scrollTop = el.scrollHeight
    }
  }, [draft, inputRef])

  const write = useCallback(
    (next: { text: string; caret: number }) => {
      nextCaret.current = next.caret
      setCaret(next.caret)
      setSel(0)
      setDraft(next.text)
    },
    [setDraft],
  )

  const pick = useCallback(
    (person: Picked) => {
      // The caret may have moved by an arrow key since the last change: ask the box itself.
      const el = inputRef.current
      const at = el && typeof document !== 'undefined' && document.activeElement === el ? (el.selectionStart ?? draft.length) : (caret ?? draft.length)
      const q = dismissed ? null : tagNameQueryAtCaret(draft, at, offerableNames, liveNames)
      setPicked((prev) => [...prev.filter((p) => p.userId !== person.userId), { userId: person.userId, name: person.name }])
      setDismissed(false)
      write(insertPick(draft, at, person.name, q ? q.start : null))
    },
    [draft, caret, dismissed, inputRef, offerableNames, liveNames, write],
  )

  const onText = useCallback(
    (value: string, at: number | null) => {
      const where = at ?? value.length
      // A phone keyboard that names no key: read the Backspace from the change itself.
      const cut = lastKey.current != null && UNNAMED_KEYS.includes(lastKey.current) ? backspacedTag(draft, value, where, liveNames) : null
      const words = cut ? cut.text : value
      // A pick whose name is no longer whole in the words is no tag, and typing it back makes none.
      setPicked((prev) => {
        const kept = liveTags(words, prev)
        return kept.length === prev.length ? prev : kept
      })
      setDismissed(false)
      if (cut) {
        write(cut)
        return
      }
      setDraft(value)
      setCaret(where)
      setSel(0)
    },
    [draft, liveNames, setDraft, write],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
      lastKey.current = e.key
      if (!enabled) return false
      if (e.key === 'Backspace' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const el = e.currentTarget
        const at = el.selectionStart
        if (at != null && at === el.selectionEnd) {
          const cut = backspaceTag(draft, at, liveNames)
          if (cut) {
            e.preventDefault()
            setPicked((prev) => liveTags(cut.text, prev))
            write(cut)
            return true
          }
        }
      }
      if (!open) return false
      if (e.key === 'Escape') {
        e.stopPropagation()
        setDismissed(true)
        return true
      }
      if (rows.length === 0) return false
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        // Left and right move the caret in the words, as they always do. Up and down move in the row.
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') return false
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
    [enabled, open, rows, active, pick, draft, liveNames, write],
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
    setDismissed(false)
    write({ text: head + draft.slice(at), caret: head.length })
  }

  /**
   * A name as a press. pointerdown, not click: the box keeps its focus and its caret, so a
   * phone's keyboard stays up. The click is for a press made with no pointer, as a screen reader makes it.
   */
  const namePress = (person: Picked, says: string, more: { selected?: boolean; option?: boolean } = {}) => (
    <button
      key={person.userId}
      type="button"
      tabIndex={-1}
      {...(more.option ? { role: 'option', 'aria-selected': more.selected === true } : {})}
      data-note-tag-press
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        pick(person)
      }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation()
        if (e.detail === 0) pick(person)
      }}
      style={{ ...pressStyle, ...(more.selected ? { background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)' } : null) }}
    >
      <span style={pressNameStyle}>@{person.name}</span>
      <span style={pressSaysStyle}>{says}</span>
    </button>
  )

  // Offered before a letter is typed. In an answer box, whoever the box was handed, and once the names are
  // read only someone the list holds. In a task's own box, its own people, three at most.
  const offered: NoteTagOffer[] = !enabled || open
    ? []
    : taskInstanceId && !offer
      ? taskOffer(people ?? [], live.map((p) => p.userId)).map((r) => ({ userId: r.person.userId, name: r.person.name, says: tagPersonSays(r) }))
      : (offer ?? []).filter((o) => o.name.trim() && !live.some((p) => p.userId === o.userId) && (people == null || people.some((p) => p.userId === o.userId)))

  const chips =
    enabled && (live.length > 0 || offered.length > 0) ? (
      <div style={{ display: 'grid', gap: 6, margin: '0 4px 6px' }}>
        {live.length > 0 ? (
          <div data-note-tag-chips style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
        ) : null}
        {offered.length > 0 ? (
          <div data-note-tag-offer style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Tag:
            {offered.map((o) => namePress({ userId: o.userId, name: o.name }, o.says))}
          </div>
        ) : null}
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
      style={
        bigAt
          ? { background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 10, width: 44, height: 44, padding: 0, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }
          : { background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 999, minWidth: 28, padding: '1px 8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }
      }
    >
      @
    </button>
  ) : null

  const list = open ? (
    <div
      role="listbox"
      aria-label="Teammates"
      data-note-tag-list
      onClick={(e) => e.stopPropagation()}
      style={{
        ...(place === 'inline'
          ? { maxHeight: INLINE_ROW_MAX_HEIGHT }
          : {
              position: 'absolute',
              left: 8,
              right: 8,
              ...(place === 'above' ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
              zIndex: 20,
              boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
              maxHeight: 260,
            }),
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        padding: 6,
        overflowY: 'auto',
        textAlign: 'left',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      {loadError ? (
        <div style={{ ...hintStyle, color: 'var(--text-red-700)' }}>{loadError}</div>
      ) : people == null ? (
        <div style={hintStyle}>Reading the names…</div>
      ) : rows.length === 0 ? (
        <EmptyState compact main={taskInstanceId ? 'Nobody else can be tagged on this task' : 'Nobody else can be tagged on this job'} />
      ) : (
        rows.map((row, i) => namePress(row.person, tagPersonSays(row), { option: true, selected: i === active }))
      )}
    </div>
  ) : null

  // The tint under each made tag, and the underline under an @ the row is offering names for.
  const parts = useMemo(
    () => (enabled ? draftMarkParts(draft, liveNames, open && rows.length > 0 && query && caret != null ? { start: query.start, end: caret } : null) : []),
    [enabled, draft, liveNames, open, rows.length, query, caret],
  )
  const mark = parts.some((p) => p.mark != null) ? <TagMarkLayer inputRef={inputRef} parts={parts} /> : null

  return { chips, list, atButton, mark, onText, onKeyDown, taggedIds, reset }
}
