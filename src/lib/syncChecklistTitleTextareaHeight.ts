/** Max height in px; beyond this the title textarea scrolls internally. */
const CHECKLIST_TITLE_TEXTAREA_MAX_HEIGHT_PX = 240

/**
 * Grows a title textarea to fit wrapped content (capped) so long titles don't overflow horizontally.
 */
export function syncChecklistTitleTextareaHeight(el: HTMLTextAreaElement | null): void {
  if (!el) return
  const max = CHECKLIST_TITLE_TEXTAREA_MAX_HEIGHT_PX
  el.style.height = 'auto'
  const sh = el.scrollHeight
  const h = Math.min(sh, max)
  el.style.height = `${h}px`
  el.style.overflowY = sh > max ? 'auto' : 'hidden'
}
