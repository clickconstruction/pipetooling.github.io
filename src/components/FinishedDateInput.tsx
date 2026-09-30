import { useRef, useState, type InputHTMLAttributes } from 'react'
import { useToastContext } from '../contexts/ToastContext'
import { holdsDateBoxChange, readDateBoxEntry, unfinishedDateMessage } from '../lib/dateBoxEntry'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  /** The date the box holds when nothing is being typed: the saved one (or a suggestion), `YYYY-MM-DD` or empty. */
  value: string | null
  /** A finished date, or null for an emptied box. Never a half-typed one, and never the date already shown. */
  onCommit: (value: string | null) => void
}

/**
 * A date box for a field that saves as you go: it hands over a finished date only. The
 * browser reports a date on every key that completes one ("2026" arrives as 0002, 0020,
 * 0202, 2026), so a typed date waits in the box until the box is left or Enter is pressed.
 * A pick from the calendar (a change with no key press) goes through at once. A date left
 * unfinished is dropped with a toast and the box shows `value` again.
 */
export function FinishedDateInput({ value, onCommit, onKeyDown, onPointerDown, onBlur, ...rest }: Props) {
  const { showToast } = useToastContext()
  const shown = value ?? ''
  const [draft, setDraft] = useState<string | null>(null)
  // A key was pressed in the box since it was last clicked or left: the next change is typed, not picked.
  const typing = useRef(false)

  const drop = () => {
    setDraft(null)
    showToast(unfinishedDateMessage(new Date().getFullYear()), 'info')
  }
  const commit = (raw: string) => {
    const entry = readDateBoxEntry(raw, shown)
    if (entry.kind === 'unfinished') return drop()
    setDraft(null)
    if (entry.kind === 'save') onCommit(entry.value)
  }

  return (
    <input
      {...rest}
      type="date"
      value={draft ?? shown}
      onChange={(e) => {
        const raw = e.target.value
        if (holdsDateBoxChange(typing.current, raw, shown)) setDraft(raw)
        else commit(raw)
      }}
      onKeyDown={(e) => {
        typing.current = true
        if (e.key === 'Enter' && draft != null && !e.currentTarget.validity.badInput) commit(draft)
        onKeyDown?.(e)
      }}
      onPointerDown={(e) => {
        typing.current = false
        onPointerDown?.(e)
      }}
      onBlur={(e) => {
        typing.current = false
        if (e.currentTarget.validity.badInput) {
          // Left with a part missing (09/30/yyyy): the browser reports that as no date. Put the box back to what it showed.
          e.currentTarget.value = shown
          drop()
        } else if (draft != null) commit(draft)
        onBlur?.(e)
      }}
    />
  )
}
