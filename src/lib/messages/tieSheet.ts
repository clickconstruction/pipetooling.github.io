/**
 * Messages, cut 10: the rows of *Tie this message to*, the sheet a press and hold on a line opens on a phone (the
 * prototype's `tieMenu`, `phone-mockups.html` screen 1b). The person's jobs, the one their new messages land on first,
 * then the rail's order; the job the line is tied to now says so. *Another job…* opens the job picker, and a tied line
 * offers *Untie it*, so it sits on the person.
 */
import type { JobTile } from './jobTiles'

export interface TieSheetRow {
  key: string
  num: string
  name: string
  /** New messages from them land on this job. */
  star: boolean
  /** The line is tied to this job now. */
  here: boolean
  /** The tile's second line: "bid due Thu Oct 8 · 6 days". */
  words: string
}

/**
 * The sheet's rows for one line. A job with no tile is left out. The line's own job comes in first when the rail does not
 * hold it, so the sheet always shows where the line is.
 */
export function tieSheetRows(
  rail: readonly string[],
  tiles: Readonly<Record<string, JobTile>>,
  defaultJobId: string | null,
  lineJobId: string | null,
): { rows: TieSheetRow[]; untie: boolean } {
  const keys = [...new Set([...(lineJobId && !rail.includes(lineJobId) ? [lineJobId] : []), ...rail])]
  const rows = keys.flatMap((key) => {
    const t = tiles[key]
    return t ? [{ key, num: t.num, name: t.name, star: key === defaultJobId, here: key === lineJobId, words: t.day.words }] : []
  })
  const starred = rows.filter((r) => r.star)
  return { rows: [...starred, ...rows.filter((r) => !r.star)], untie: lineJobId !== null }
}
