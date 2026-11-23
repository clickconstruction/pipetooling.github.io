/**
 * Values in place, the drawn half (punch list #382, PR 1; shared across the app, #399). The rule and the pure
 * half are in `src/lib/valuesInPlace.ts`. A screen draws every value with one of these pieces:
 *
 *   - `ChangeableValue`: underlined and tinted. A press turns it into its own field right there, with Keep and
 *     Cancel. Enter keeps, Escape cancels. It takes a save function and does not care what the save writes.
 *   - `WorkedOutValue`: plain bold, no press. The app works it out.
 *   - `ValueSentence`: a sentence a kernel marked with `val`, its values drawn apart from its words.
 *   - `ValueLines` and `ValueLine`: one fact a line, the label on the left and the values in a column.
 *   - `ValuesLegend`: the line that says which look is which.
 *   - `ValuesInPlaceOff`: a screen a firm or a read-only account reads draws every value with no press.
 *
 * The looks are the `.vip…` classes in `src/index.css`, because hover, focus and a phone's taller press need a
 * class. The underline is dotted and the words keep their own colour, so a value never reads as a link.
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  SET_OWN_LABEL,
  VALUES_LEGEND,
  VALUE_FIELD_WORDS,
  changeableValueName,
  keepVerdict,
  sentenceParts,
  type ValueFieldType,
} from '../../lib/valuesInPlace'

// ---------- The off switch ----------

const OffContext = createContext(false)

/** Everything inside draws its values with no press: a firm's page, a read-only account, a printed sheet. */
export function ValuesInPlaceOff({ off = true, children }: { off?: boolean; children: ReactNode }) {
  return <OffContext.Provider value={off}>{children}</OffContext.Provider>
}

// ---------- A worked-out value ----------

/** A value the app works out: plain bold, no press. `tone` is for a value that is itself the warning. */
export function WorkedOutValue({ children, tone, title }: { children: ReactNode; tone?: 'red' | 'green'; title?: string }) {
  return (
    <b className="vipWorked" data-value="worked-out" data-tone={tone} title={title}>
      {children}
    </b>
  )
}

// ---------- A changeable value ----------

export interface ChangeableValueProps {
  /** The value as the screen prints it: "Tue Dec 8", "10 days". */
  text: string
  /** What the value is, in a few words: "our first day". It names the press and the field. */
  label: string
  /** The field the press becomes. */
  type: ValueFieldType
  /** The value as the field holds it: a 'YYYY-MM-DD' day, the words, the number, the choice. '' when nothing is set. */
  value: string
  /**
   * Called with a finished value that differs from `value`, and the reason when one is asked for. It may return
   * a promise: the field waits on it, and a failure is shown under the field with what was typed still in it.
   */
  onKeep: (value: string, extra: { reason: string }) => void | Promise<void>
  /** A `choice` field's options. */
  choices?: ReadonlyArray<{ value: string; label: string }>
  /** The lowest and highest value kept: a day or a number. */
  min?: string
  max?: string
  /** A number field that takes no fraction. */
  whole?: boolean
  /** An emptied field is kept as ''. */
  canClear?: boolean
  /** A few words beside the open field: what the value is for. */
  hint?: string
  /** What the change will do, worked out from the draft: "We would decide by Sat Nov 28." */
  preview?: (draft: string) => ReactNode
  /** Ask for a reason with the change. */
  reason?: { label: string; required?: boolean }
  /** The screen's own check on a finished draft: why it cannot be kept, or null. */
  check?: (draft: string) => string | null
  /**
   * The value is read from a default this record may override: the small word drawn after it, such as
   * "default". The value is then bold, since nobody typed it here, and a press beside it sets this record's own.
   * A screen whose word has a look of its own hands in the drawn word (the Lien desk's source chip, punch list #399).
   */
  fromDefault?: ReactNode
  /** That press's words. */
  setOwnLabel?: string
  /** Offered in the open field when this record holds its own value: the press that puts the default back. */
  backToDefault?: { label: string; onPress: () => void | Promise<void> }
  /** It can be changed, but not by this person or not now: no press, a small tag, and the sentence that says who can. */
  locked?: { tag: string; why: string }
  /** No press and no tag. `ValuesInPlaceOff` sets it for a whole screen. */
  off?: boolean
  /**
   * The field is open when the value first draws: the screen just asked for the fact before this one, and this is
   * the next thing to type (the Lien desk's retainage pane asks how our contract ended, then its day). Cancel closes
   * it like any other, and a later press opens it again.
   */
  startOpen?: boolean
}

/**
 * A value a person can change where it sits. Closed it is a press that reads as the value. Open it is the value's
 * own field with Keep and Cancel. A click or a key inside it never reaches a row or a card it sits in.
 */
export function ChangeableValue(props: ChangeableValueProps) {
  const { text, label, type, value, onKeep, choices, min, max, whole, canClear, hint, preview, reason, check, fromDefault, backToDefault, locked } = props
  const offAround = useContext(OffContext)
  const off = props.off ?? offAround
  const [open, setOpen] = useState(props.startOpen === true)
  const [draft, setDraft] = useState(value)
  const [why, setWhy] = useState<string | null>(null)
  const [because, setBecause] = useState('')
  const [busy, setBusy] = useState(false)
  const fieldRef = useRef<HTMLSpanElement | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  const pressRef = useRef<HTMLButtonElement | null>(null)
  const refocus = useRef(false)
  const alive = useRef(true)
  const noteId = useId()

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // The press takes the focus back when the field closes, so a keyboard keeps its place in the line.
  useEffect(() => {
    if (open || !refocus.current) return
    refocus.current = false
    pressRef.current?.focus()
  }, [open])

  const close = useCallback(() => {
    refocus.current = true
    setOpen(false)
    setWhy(null)
  }, [])

  // Escape is taken in the capture phase and marked handled, so a window this field sits in keeps its own Escape
  // for the next press. The windows check `defaultPrevented`.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (!(e.target instanceof Node) || !fieldRef.current?.contains(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      if (!busy) close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, busy, close])

  if (off) return <WorkedOutValue>{text}</WorkedOutValue>
  if (locked) {
    return (
      <span className="vipLockedWrap" title={locked.why}>
        <span className="vipLocked" data-value="locked">
          {text}
        </span>{' '}
        <span className="vipTag">{locked.tag}</span>
      </span>
    )
  }

  const start = () => {
    setDraft(value)
    setBecause('')
    setWhy(null)
    setOpen(true)
  }

  /** Runs a save, holding the field while it is out and showing a failure under it. */
  const run = (save: () => void | Promise<void>) => {
    let out: void | Promise<void>
    try {
      out = save()
    } catch (err) {
      setWhy(formatErrorMessage(err))
      return
    }
    // A save that hands back nothing is done. One that hands back a promise, or anything that can be waited on, is waited on.
    if (!out || typeof (out as PromiseLike<void>).then !== 'function') return close()
    setBusy(true)
    Promise.resolve(out).then(
      () => {
        if (!alive.current) return
        setBusy(false)
        close()
      },
      (err: unknown) => {
        if (!alive.current) return
        setBusy(false)
        setWhy(formatErrorMessage(err))
      },
    )
  }

  const keep = () => {
    if (busy) return
    const el = inputRef.current
    const verdict = keepVerdict({
      type,
      draft,
      value,
      unfinished: type === 'date' && el instanceof HTMLInputElement && el.validity.badInput,
      min,
      max,
      whole,
      canClear,
      reason: reason ? { text: because, required: !!reason.required } : null,
      check,
      thisYear: new Date().getFullYear(),
    })
    if (verdict.kind === 'same') return close()
    if (verdict.kind === 'hold') return setWhy(verdict.why)
    run(() => onKeep(verdict.value, { reason: because.trim() }))
  }

  if (!open) {
    if (fromDefault) {
      return (
        <span className="vipDefaultWrap">
          <WorkedOutValue>{text}</WorkedOutValue> <span className="vipDefaultWord">{fromDefault}</span>{' '}
          <button
            ref={pressRef}
            type="button"
            className="vipSetOwn"
            aria-label={`${props.setOwnLabel ?? SET_OWN_LABEL}, ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              start()
            }}
            onKeyDown={stopRowKeys}
          >
            {props.setOwnLabel ?? SET_OWN_LABEL}
          </button>
        </span>
      )
    }
    return (
      <button
        ref={pressRef}
        type="button"
        className="vipChange"
        data-value="changeable"
        aria-label={changeableValueName(label, text)}
        title={hint ?? `Press to change ${label}`}
        onClick={(e) => {
          e.stopPropagation()
          start()
        }}
        onKeyDown={stopRowKeys}
      >
        {text}
      </button>
    )
  }

  const shown = preview ? preview(draft) : null
  const describedBy = why || hint || shown ? noteId : undefined
  const onFieldKey = (e: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key !== 'Enter') return
    // A select keeps Enter for its own list. In a text, date or number box Enter keeps, and never submits a form around it.
    if (e.currentTarget instanceof HTMLSelectElement) return
    e.preventDefault()
    keep()
  }
  const change = (next: string) => {
    setDraft(next)
    if (why) setWhy(null)
  }

  return (
    <span ref={fieldRef} className="vipField" data-value="field" onClick={(e) => e.stopPropagation()} onKeyDown={stopRowKeys}>
      {type === 'choice' ? (
        <select
          ref={(el) => {
            inputRef.current = el
          }}
          autoFocus
          className="vipInput"
          aria-label={label}
          aria-describedby={describedBy}
          aria-invalid={why ? true : undefined}
          disabled={busy}
          value={draft}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onFieldKey}
        >
          {draft === '' ? <option value="">Pick one</option> : null}
          {(choices ?? []).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={(el) => {
            inputRef.current = el
          }}
          autoFocus
          className="vipInput"
          data-type={type}
          type={type}
          inputMode={type === 'number' ? (whole ? 'numeric' : 'decimal') : undefined}
          aria-label={label}
          aria-describedby={describedBy}
          aria-invalid={why ? true : undefined}
          disabled={busy}
          value={draft}
          min={min}
          max={max}
          step={type === 'number' ? (whole ? 1 : 'any') : undefined}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onFieldKey}
        />
      )}
      {reason ? (
        <input
          className="vipInput vipReason"
          type="text"
          aria-label={reason.label}
          placeholder={reason.label}
          disabled={busy}
          value={because}
          onChange={(e) => {
            setBecause(e.target.value)
            if (why) setWhy(null)
          }}
          onKeyDown={onFieldKey}
        />
      ) : null}
      <button type="button" className="vipKeep" disabled={busy} aria-busy={busy || undefined} onClick={keep}>
        {busy ? VALUE_FIELD_WORDS.keeping : VALUE_FIELD_WORDS.keep}
      </button>
      <button type="button" className="vipCancel" disabled={busy} onClick={close}>
        {VALUE_FIELD_WORDS.cancel}
      </button>
      {backToDefault ? (
        <button type="button" className="vipCancel" disabled={busy} onClick={() => run(backToDefault.onPress)}>
          {backToDefault.label}
        </button>
      ) : null}
      {why || hint || shown ? (
        <span id={noteId} className="vipNote">
          {why ? (
            <span role="alert" className="vipWhy">
              {why}
            </span>
          ) : (
            <>
              {hint ? <span>{hint}</span> : null}
              {shown ? <span className="vipPreview">{shown}</span> : null}
            </>
          )}
        </span>
      ) : null}
    </span>
  )
}

/** A value sits inside rows and cards that open on a press: Enter, Space and Escape on it stay its own. */
function stopRowKeys(e: ReactKeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') e.stopPropagation()
}

// ---------- A sentence from a kernel ----------

/**
 * A sentence a kernel marked with `val`, its values drawn apart from its words. `values` draws the kinds a person
 * can change, each as the screen's own `ChangeableValue`. A kind it leaves out is worked out, and bold.
 */
export function ValueSentence<K extends string = string>({ text, values }: { text: string; values?: Partial<Record<K, (text: string) => ReactNode>> }) {
  return (
    <>
      {sentenceParts<K>(text).map((p, i) =>
        typeof p === 'string' ? <span key={i}>{p}</span> : <span key={i}>{values?.[p.kind]?.(p.text) ?? <WorkedOutValue>{p.text}</WorkedOutValue>}</span>,
      )}
    </>
  )
}

// ---------- One fact a line ----------

/** A block of facts, one a line: the labels in a column on the left, the values in a column beside them. */
export function ValueLines({ children }: { children: ReactNode }) {
  return (
    <div className="vipLines" data-value-lines>
      {children}
    </div>
  )
}

/** One fact: its label, and its values. */
export function ValueLine({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <span className="vipLineLabel">{label}</span>
      <span className="vipLineValues">{children}</span>
    </>
  )
}

/** The line that says which look is which. A screen with nothing to change says nothing. */
export function ValuesLegend() {
  const off = useContext(OffContext)
  if (off) return null
  return (
    <p className="vipLegend" data-values-legend>
      <span className="vipChange vipChangeSample">{VALUES_LEGEND.changeable}</span>
      {VALUES_LEGEND.changeableTail}
      <WorkedOutValue>{VALUES_LEGEND.workedOut}</WorkedOutValue>
      {VALUES_LEGEND.workedOutTail}
    </p>
  )
}
