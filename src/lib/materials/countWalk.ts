/**
 * Count this box, as a walk (Materials on site, punch list #209): which lines the walk visits and where it stands.
 *
 * The list is fixed when the walk starts (v2.7161). Before, the tab re-read *the lines with parts on hand* on every
 * step while its position went up by one. A line counted to none left that list, every line after it moved up a
 * place, and the walk stepped over the next one: it was never shown and never counted, and the box still read
 * *counted*.
 */
import type { ContainerLine } from './onSite'

/** The lines a walk visits, in the box's own order: every line with parts on hand when the walk starts. */
export function countWalkKeys(lines: ReadonlyArray<Pick<ContainerLine, 'partKey' | 'onHand'>>): string[] {
  return lines.filter((l) => l.onHand > 0).map((l) => l.partKey)
}

/**
 * Where the walk stands: the line at `index` of the walk's own list, read fresh from the box so its number is
 * today's. A line that has left the box since the walk began (another phone moved it out) is passed over, since
 * there is nothing to count. Null when no line is left, which ends the walk.
 */
export function countWalkAt<L extends Pick<ContainerLine, 'partKey'>>(keys: ReadonlyArray<string>, index: number, lines: ReadonlyArray<L>): { line: L; index: number } | null {
  for (let i = Math.max(0, index); i < keys.length; i += 1) {
    const line = lines.find((l) => l.partKey === keys[i])
    if (line) return { line, index: i }
  }
  return null
}
