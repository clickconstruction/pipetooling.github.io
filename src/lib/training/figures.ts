/**
 * Figures in a lesson (punch list #116, v2.5598): one line in a lesson's Must know or Traps list draws a
 * figure beside the sentence it explains.
 *
 *   - {{figure:clearance-stack|Five distances stacked under the anchor.}}
 *
 * This module is pure (no React), so the content test and the parser can hold a lesson's figure names to
 * the registry without loading the drawings. The drawings themselves live in
 * `src/components/training/figures/`, one component per name, and `figures/index.ts` maps each name here
 * to its component; `figures.test.ts` holds the two lists equal.
 */

export type FigureItem = { figure: FigureName; caption: string }

/** Every figure the app draws, by the name a lesson uses. Kept sorted; the test holds it so. */
export const FIGURE_NAMES = ['clearance-stack', 'controls-ladder'] as const
export type FigureName = (typeof FIGURE_NAMES)[number]

const FIGURE_LINE = /^\{\{figure:([a-z0-9-]+)\|(.+)\}\}$/

export function isFigureName(name: string): name is FigureName {
  return (FIGURE_NAMES as readonly string[]).includes(name)
}

/**
 * A list item that is a figure line, or null for a sentence. A figure line with a name the app does not
 * draw throws: the lesson is wrong, not the reader.
 */
export function parseFigureItem(text: string, where = 'a lesson'): FigureItem | null {
  const m = FIGURE_LINE.exec(text.trim())
  if (!m) return null
  const name = m[1] ?? ''
  const caption = (m[2] ?? '').trim()
  if (!isFigureName(name)) throw new Error(`Training content "${where}": figure "${name}" is not drawn (the app draws: ${FIGURE_NAMES.join(', ')})`)
  if (!caption) throw new Error(`Training content "${where}": figure "${name}" has no caption`)
  return { figure: name, caption }
}

export type LessonItem = { kind: 'text'; text: string } | ({ kind: 'figure' } & FigureItem)

/** The items of a Must know or Traps list as the page draws them: a sentence, or a figure with its caption. */
export function lessonItems(items: readonly string[]): LessonItem[] {
  return items.map((text) => {
    const f = parseFigureItem(text)
    return f ? { kind: 'figure', ...f } : { kind: 'text', text }
  })
}

/** The words the plain-words rules read for an item: the sentence, or the figure's caption. */
export function itemWords(text: string): string {
  return parseFigureItem(text)?.caption ?? text
}
