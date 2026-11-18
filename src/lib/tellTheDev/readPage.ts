/**
 * Tell the dev (punch list #380): what the page itself says at the press.
 *
 * The app keeps no list of open windows. A window declares itself (`role="dialog"`,
 * `aria-modal`), so the page is asked: the last one drawn is the one on top, and its title is its
 * label. The box's own window is marked `data-tell-the-dev` and never counts.
 */

export const TELL_THE_DEV_MARK = 'data-tell-the-dev'

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function isShownByDefault(el: Element): boolean {
  return el.getClientRects().length > 0
}

/** The title of the window on top, or null with none open. */
export function openWindowTitle(doc: Document, isShown: (el: Element) => boolean = isShownByDefault): string | null {
  const windows = [...doc.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"]')].filter(
    (el) => !el.closest(`[${TELL_THE_DEV_MARK}]`) && isShown(el),
  )
  const top = windows[windows.length - 1]
  if (!top) return null
  const labelledBy = top.getAttribute('aria-labelledby')
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const label = text(doc.getElementById(id))
      if (label) return label
    }
  }
  const label = (top.getAttribute('aria-label') ?? '').trim()
  if (label) return label
  const heading = text(top.querySelector('h1, h2, h3'))
  return heading || 'A window with no title'
}
