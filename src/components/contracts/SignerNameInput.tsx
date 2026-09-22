import { forwardRef, useEffect, useImperativeHandle, useRef, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from 'react'

export type SignerNameInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type'> & {
  /** What the parent remembers. Written into the box only when it changes (a reset, a preview's ''). */
  value: string
  /** Fired on every keystroke and on blur — blur catches a value the browser put there silently. */
  onValueChange: (value: string) => void
}

/**
 * The "Full name" box every signing surface shares (v2.3739). Uncontrolled on purpose: a
 * controlled input rewrites the box from state on every render, and iOS Safari's AutoFill can
 * fill the box without an input event — so the customer's name vanished the moment she ticked
 * the consent checkbox. Here the box keeps whatever the browser or the person put in it; state
 * follows on change and on blur, and submits read the box through the ref
 * (`resolveSignerName` in src/lib/signerNameField.ts).
 */
export const SignerNameInput = forwardRef<HTMLInputElement, SignerNameInputProps>(function SignerNameInput(
  { value, onValueChange, autoComplete = 'name', ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inner.current as HTMLInputElement, [])

  // A parent-driven change (reset after a send, the staff preview's '') writes through to the
  // box. Runs only when `value` changes, so a re-render with the same state — the render that
  // used to wipe an AutoFilled name — leaves the box alone.
  useEffect(() => {
    const el = inner.current
    if (el && el.value !== value) el.value = value
  }, [value])

  function sync(e: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>) {
    const next = e.currentTarget.value
    if (next !== value) onValueChange(next)
  }

  return <input {...rest} ref={inner} type="text" defaultValue={value} autoComplete={autoComplete} onChange={sync} onBlur={sync} />
})
