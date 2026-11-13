/**
 * The walk through the rows with no price, one at a time (punch list #342, PR 1).
 *
 * The window asks about one row, then the next. The order is the list's own, most pieces first,
 * fixed when the window opens so a row never jumps under the reader. An answer and a skip both
 * move on. A row that leaves the list by itself (it was priced on another device, or a tie
 * folded it into another row) is stepped over. At the end the rows still open can be walked again.
 *
 * Pure: the keys come in, the place in the walk goes out.
 */

export type Walk = {
  /** The rows to ask about, in the order fixed at the start. */
  order: string[]
  /** How far the walk has come: every key before this was answered or skipped. */
  at: number
  /** The keys answered, oldest first. */
  answered: string[]
  /** The keys skipped in this pass. */
  skipped: string[]
}

export function startWalk(keys: ReadonlyArray<string>): Walk {
  return { order: [...keys], at: 0, answered: [], skipped: [] }
}

/** The row to ask about now: the first from the walk's place that still has no price. Null at the end. */
export function currentKey(walk: Walk, isOpen: (key: string) => boolean): string | null {
  for (let i = walk.at; i < walk.order.length; i++) {
    const key = walk.order[i]!
    if (isOpen(key)) return key
  }
  return null
}

function past(walk: Walk, key: string): number {
  const i = walk.order.indexOf(key)
  return i < 0 ? walk.at : Math.max(walk.at, i + 1)
}

/** The row was answered: the walk moves past it. */
export function answerWalk(walk: Walk, key: string): Walk {
  return { ...walk, at: past(walk, key), answered: [...walk.answered.filter((k) => k !== key), key] }
}

/** The row was skipped: the walk moves past it and remembers it for the end. */
export function skipWalk(walk: Walk, key: string): Walk {
  return { ...walk, at: past(walk, key), skipped: [...walk.skipped.filter((k) => k !== key), key] }
}

/** The last answer was taken back: the walk returns to that row. */
export function undoWalk(walk: Walk, key: string): Walk {
  const i = walk.order.indexOf(key)
  return { ...walk, at: i < 0 ? walk.at : Math.min(walk.at, i), answered: walk.answered.filter((k) => k !== key) }
}

function n(count: number, one: string, many: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`
}

/**
 * The line over the question: "Row 3 of 88" and "86 left · 1,430 pieces to go". `left` and
 * `pieces` are the rows that still have no price on the site, skipped ones included.
 */
export function walkWords(walk: Walk, key: string, left: number, pieces: number): { where: string; rest: string } {
  const i = walk.order.indexOf(key)
  return { where: `Row ${(i < 0 ? walk.at : i) + 1} of ${walk.order.length.toLocaleString('en-US')}`, rest: `${left.toLocaleString('en-US')} left · ${n(pieces, 'piece', 'pieces')} to go` }
}

/** The end of a pass: "3 rows priced. 5 rows still have no price.", or "5 rows are still on an old price." for the old prices' walk. */
export function walkEndWords(walk: Walk, left: number, mode: 'none' | 'old' = 'none'): string {
  const priced = `${n(walk.answered.length, 'row', 'rows')} priced`
  if (left <= 0) return `${priced}.`
  return mode === 'old' ? `${priced}. ${n(left, 'row is', 'rows are')} still on an old price.` : `${priced}. ${n(left, 'row still has', 'rows still have')} no price.`
}
