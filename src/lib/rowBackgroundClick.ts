/**
 * Row-background click helper (v2.1314): make a list row clickable in its
 * empty space without fighting the interactive elements inside it.
 *
 * Instead of sprinkling stopPropagation on every link/button/pill in the row
 * (fragile — the next button added would regress the row), the row's own
 * onClick asks the INVERSE question: did this click land on anything
 * interactive? Only when the answer is no does the row-level action run.
 *
 * Also refuses clicks that end a text selection — users sweep-select customer
 * names and addresses; releasing the mouse must not navigate.
 */

/** Anything that owns its own click behavior. */
export const INTERACTIVE_CLICK_SELECTOR =
  'a, button, input, select, textarea, label, [role="button"], [role="link"], [contenteditable="true"]'

/**
 * True when the click landed on row background — not on/inside an interactive
 * element and not at the end of a text selection.
 */
export function isRowBackgroundClick(
  target: EventTarget | null,
  opts?: { selection?: string },
): boolean {
  const sel = opts?.selection ?? (typeof window !== 'undefined' ? window.getSelection()?.toString() ?? '' : '')
  if (sel.length > 0) return false
  if (!(target instanceof Element)) return true
  return target.closest(INTERACTIVE_CLICK_SELECTOR) == null
}
