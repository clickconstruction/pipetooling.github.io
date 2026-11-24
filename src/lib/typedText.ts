/**
 * Words a person typed and has not sent (punch list #85, Diane, 2026-11-24).
 *
 * The rule: the app never reloads itself over words someone typed. A report, a note or a message to a
 * customer stays on the screen until its writer sends it or clears it. A reload empties every field on the
 * page, and until now the reloads the app starts by itself looked only at a focused field, an open window, a
 * component that said it held unsaved work (eleven did) and a write in flight. Words typed into a field and
 * then left, with the cursor somewhere else, were none of those.
 *
 * So this watches the page. Two things count:
 *
 * 1. Any box made for free words that has words in it: a `textarea`, or an element the person can edit in
 *    place (`contenteditable`). Whoever put the words there, a reload would lose them.
 * 2. Any one-line field the person typed into on this page, while it still has words. A field the app filled
 *    by itself, a date or a saved amount, does not count: a reload brings those back.
 *
 * A search box is not a draft. Its words find things and are typed again in a second, and holding a reload
 * for them would hold it on every list. A field that cannot be typed into (read-only, disabled) is not one either.
 */

/** The one-line fields a person types words or numbers into. A date, a tick or a file is picked, not typed. */
const TYPED_INPUT_TYPES = new Set(['', 'text', 'email', 'tel', 'url', 'number', 'password'])

/** Boxes made for free words. */
const FREE_WORDS_SELECTOR = 'textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'

/** The one-line fields a person typed into since the page loaded. Pruned as they leave the page. */
const typedInto = new Set<Element>()

type FieldLike = Element & { value?: string; readOnly?: boolean; disabled?: boolean; type?: string; placeholder?: string }

function isOneLineField(el: FieldLike): boolean {
  return el.tagName === 'INPUT' && TYPED_INPUT_TYPES.has((el.getAttribute('type') ?? '').toLowerCase())
}

/** True for a field whose words search a list: by its type, its role, or how it names itself. */
export function isSearchField(el: Element): boolean {
  if ((el.getAttribute('type') ?? '').toLowerCase() === 'search') return true
  if (el.getAttribute('role') === 'searchbox') return true
  const name = el.getAttribute('placeholder') ?? el.getAttribute('aria-label') ?? ''
  return /^\s*(search|find|filter)\b/i.test(name)
}

function wordsIn(el: FieldLike): string {
  const words = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ? (el.value ?? '') : (el.textContent ?? '')
  return words.trim()
}

function cannotBeTyped(el: FieldLike): boolean {
  return el.readOnly === true || el.disabled === true
}

/** Remembers a one-line field the person typed into. `watchTypedText` calls it for every `input` event. */
export function noteTypedInto(target: EventTarget | null): void {
  const el = target as FieldLike | null
  if (!el || typeof el.tagName !== 'string') return
  if (!isOneLineField(el) || isSearchField(el)) return
  typedInto.add(el)
}

/**
 * Starts watching the page for typing. One listener, in the capture phase, so a field that stops its own
 * events is still seen. Called once from `main.tsx`. Returns a stop for tests.
 */
export function watchTypedText(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): () => void {
  if (!doc) return () => {}
  const onInput = (event: Event) => noteTypedInto(event.target)
  doc.addEventListener('input', onInput, true)
  return () => doc.removeEventListener('input', onInput, true)
}

/** The fields that hold typed words now, in no order. Throws what the page throws. */
function fieldsHoldingWords(doc: Document): FieldLike[] {
  const found = new Set<FieldLike>()
  for (const el of typedInto) {
    if (!el.isConnected) {
      typedInto.delete(el)
      continue
    }
    if (el.ownerDocument === doc && !cannotBeTyped(el) && wordsIn(el) !== '') found.add(el)
  }
  for (const el of Array.from(doc.querySelectorAll(FREE_WORDS_SELECTOR)) as FieldLike[]) {
    if (cannotBeTyped(el) || isSearchField(el)) continue
    if (wordsIn(el) !== '') found.add(el)
  }
  return [...found]
}

/**
 * True while the page holds words a reload would lose: see the two things that count, above. It never throws,
 * since a reload decision waits on it, and a page it cannot read counts as holding words: the reload waits.
 */
export function pageHoldsTypedText(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) return false
  try {
    return fieldsHoldingWords(doc).length > 0
  } catch {
    return true
  }
}

/**
 * The fields that hold typed words, top of the page first: the places the update pill walks a person through
 * before it reloads over them (`typedTextTour.ts`). It never throws. A page it cannot read gives none, and
 * `pageHoldsTypedText` still says the page holds words, so the warning shows with nothing to walk.
 */
export function typedTextFields(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): Element[] {
  if (!doc) return []
  try {
    // 4 is Node.DOCUMENT_POSITION_FOLLOWING: `b` comes after `a`.
    return fieldsHoldingWords(doc).sort((a, b) => (a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1))
  } catch {
    return []
  }
}

/** Tests only: forget every field typed into. */
export function __forgetTypedTextForTests(): void {
  typedInto.clear()
}
