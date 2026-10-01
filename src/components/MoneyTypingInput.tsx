import { useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { moneyTypingDeleteAcrossComma, moneyTypingEdit, moneyTypingGroup, moneyTypingSettle } from '../lib/moneyTyping'

/**
 * A money box that shows its commas while it is typed in (v2.4334): "17777.51" reads "17,777.51"
 * as the digits go in. The value in and out stays plain ("17777.51"), so the caller's state, saving
 * and math do not change; only the screen gets commas. The rules — the cursor kept in place,
 * Backspace across a comma, pasted "$" and commas, two decimals, cents on leaving — live in
 * `lib/moneyTyping.ts` with their tests.
 *
 * Unlike `MoneyDecimalAmountInput` (commas only once you leave the box, a number in and out), this
 * one carries a string, so an empty box stays empty and a typed "17777." is not rounded mid-typing.
 */
export function MoneyTypingInput({
  value,
  onChange,
  disabled = false,
  style,
  id,
  'aria-label': ariaLabel,
  placeholder,
}: {
  /** Plain digits and at most one dot: "17777.51". */
  value: string
  /** Called with the plain value on every edit and when leaving the box settles it to cents. */
  onChange: (plain: string) => void
  disabled?: boolean
  style?: CSSProperties
  id?: string
  'aria-label'?: string
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)
  // Settling to cents on leaving happens only after typing here, so tabbing through a saved value never rewrites it.
  const editedRef = useRef(false)
  const text = moneyTypingGroup(value ?? '')

  // After the parent re-renders with the new value, put the cursor back where the typing was.
  useLayoutEffect(() => {
    const el = ref.current
    const at = pendingCaret.current
    pendingCaret.current = null
    if (el && at != null && document.activeElement === el) el.setSelectionRange(at, at)
  })

  const apply = (r: { plain: string; text: string; caret: number }) => {
    const el = ref.current
    editedRef.current = true
    if (r.plain === (value ?? '')) {
      // Nothing kept changed (a letter, a second dot): show the text again with the cursor where it was.
      if (el) {
        el.value = r.text
        el.setSelectionRange(r.caret, r.caret)
      }
      return
    }
    pendingCaret.current = r.caret
    onChange(r.plain)
  }

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      disabled={disabled}
      onChange={(e) => apply(moneyTypingEdit(e.target.value, e.target.selectionStart ?? e.target.value.length))}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        const el = e.currentTarget
        const r = moneyTypingDeleteAcrossComma(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0, e.key)
        if (!r) return
        e.preventDefault()
        apply(r)
      }}
      onBlur={() => {
        if (!editedRef.current) return
        editedRef.current = false
        const settled = moneyTypingSettle(value ?? '')
        if (settled !== (value ?? '')) onChange(settled)
      }}
      style={style}
    />
  )
}
