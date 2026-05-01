import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/** Enter submits; Shift+Enter newline (default). IME-safe. */
export function submitNoteOnEnterKeyDown(
  e: ReactKeyboardEvent<HTMLTextAreaElement>,
  opts: { saving: boolean; onSubmit: () => void },
): void {
  if (e.key !== 'Enter' || e.shiftKey) return
  if (e.nativeEvent.isComposing) return
  e.preventDefault()
  if (!opts.saving) opts.onSubmit()
}
