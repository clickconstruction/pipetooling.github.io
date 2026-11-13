import type { CSSProperties } from 'react'

/** The box for the task's words, as both task windows draw it. The window passes its own handlers and ref. */
export const TASK_WORDS_BOX_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  minHeight: '4.25rem',
  padding: '0.65rem 0.75rem',
  boxSizing: 'border-box',
  font: 'inherit',
  fontSize: '1.0625rem',
  lineHeight: 1.35,
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
  resize: 'none',
  border: '1.5px solid var(--border-strong)',
  borderRadius: 12,
}

/** True when the people search box is on screen, and focused now. A task window's Tab cycle calls it. */
export function focusPeopleSearchIfOpen(searchId: string): boolean {
  const box = document.getElementById(searchId)
  if (!box || box.closest('[hidden]')) return false
  box.focus()
  return true
}
