import { useCallback, useMemo, useRef, type SyntheticEvent } from 'react'
import { fieldsHoldUnsavedWords, isWordField, type TouchedField } from '../lib/jobs/lienWindowEscape'

/** What a typed field holds: a text box's value, or an editable block's words. */
function wordsIn(el: HTMLElement): string {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '')
}

/**
 * Whether the fields inside a window hold words typed and not saved (finding 284, `lienWindowEscape.ts`).
 *
 * A window with many forms keeps no one fact that says *something here is unsaved*. So the window's card watches its
 * own fields: `watch` is spread on the card, and the first time a typed field is touched (it takes the focus, a key, a
 * paste, a cut or a drop) what it held then is kept. `hold()` says whether any touched field still on the page reads
 * otherwise now. A field that left the page is dropped: its form was saved or cancelled, or its tab was left.
 * `forget()` drops them all, for the moment a save lands and the window reads again.
 *
 * It reads the page and writes nothing. A select, a tick box and a file are not words (`isWordField`).
 */
export function useUnsavedWords(): { watch: Record<'onFocusCapture' | 'onKeyDownCapture' | 'onPasteCapture' | 'onCutCapture' | 'onDropCapture' | 'onBeforeInputCapture', (e: SyntheticEvent) => void>; hold: () => boolean; forget: () => void } {
  const first = useRef(new Map<HTMLElement, string>())
  const touch = useCallback((e: SyntheticEvent) => {
    const el = e.target
    if (!(el instanceof HTMLElement) || first.current.has(el)) return
    if (!isWordField({ tagName: el.tagName, type: el.getAttribute('type'), editable: el.isContentEditable === true })) return
    first.current.set(el, wordsIn(el))
  }, [])
  const hold = useCallback(() => {
    const touched: TouchedField[] = []
    for (const [el, was] of first.current) {
      if (!el.isConnected) first.current.delete(el)
      else touched.push({ first: was, now: wordsIn(el) })
    }
    return fieldsHoldUnsavedWords(touched)
  }, [])
  const forget = useCallback(() => first.current.clear(), [])
  return useMemo(
    () => ({ watch: { onFocusCapture: touch, onKeyDownCapture: touch, onPasteCapture: touch, onCutCapture: touch, onDropCapture: touch, onBeforeInputCapture: touch }, hold, forget }),
    [touch, hold, forget],
  )
}
