import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/**
 * Textarea that grows to fit its content as the user types (v2.1020) — no inner
 * scrollbar, so everything written stays readable. `rows` sets the empty/minimum
 * height; it never shrinks below that. Works for controlled inputs: the resize
 * runs whenever `value` changes (typing, paste, programmatic set).
 *
 * Forwards its ref (v2.1459) so callers can focus / set the caret — the
 * DispatchTaskModal link-placeholder insert needs the underlying element.
 */
const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AutoGrowTextarea(props, forwardedRef) {
    const ref = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement, [])

    useLayoutEffect(() => {
      const el = ref.current
      if (!el) return
      // Reset first so scrollHeight reflects the content, not a previous height;
      // +2 covers the top/bottom borders under border-box sizing.
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight + 2}px`
    }, [props.value])

    return (
      <textarea
        {...props}
        ref={ref}
        style={{ overflow: 'hidden', resize: 'none', boxSizing: 'border-box', ...props.style }}
      />
    )
  },
)

export default AutoGrowTextarea
