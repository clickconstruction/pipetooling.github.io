/**
 * State roll, the Pulls view (punch list #411): what the ledger of pulls says, a line a state file. Pure: the screen
 * reads `license_roll_pulls` and `license_roll`, and this turns the rows into the lines and the sentences it draws.
 * Each value in a sentence is marked with `val`, so the screen draws it apart from its words (`ValueSentence`).
 */
import { TSBPE_FILES, TSBPE_WEEKLY_FILES, type RollClass, type TsbpeFileKey } from '../../../supabase/functions/_shared/licenseRoll'
import { val } from '../valuesInPlace'

/** A row of `license_roll_pulls`, as the view reads it. */
export type PullRow = {
  id: string
  file: string
  started_at: string
  finished_at: string | null
  rows_seen: number
  rows_kept: number
  added: number
  changed: number
  gone: number
  error: string
}

/** One state file's line on the Pulls view. */
export type PullLine = {
  file: TsbpeFileKey
  /** The file in a person's words: *Plumbing · journeyman*. */
  says: string
  licenseClass: RollClass
  /** The newest pull of this file, clean or not. Null when it was never pulled. */
  last: PullRow | null
  /** The newest pull that read the file whole. Null when none has. */
  lastGood: PullRow | null
}

/** A pull that was logged and never finished: the function stopped before it could say why. */
export const pullStopped = (row: PullRow): boolean => !row.finished_at && !row.error

/** A pull that read its file whole. */
export const pullWasClean = (row: PullRow): boolean => !!row.finished_at && !row.error

/** The weekly files in the order the page lists them, each with its newest pull and its newest clean one. */
export function pullLines(rows: readonly PullRow[]): PullLine[] {
  const newestFirst = [...rows].sort((a, b) => (a.started_at < b.started_at ? 1 : a.started_at > b.started_at ? -1 : 0))
  return TSBPE_WEEKLY_FILES.map((key) => {
    const file = TSBPE_FILES.find((f) => f.file === key)!
    const mine = newestFirst.filter((r) => r.file === key)
    return { file: key, says: file.says, licenseClass: file.license_class, last: mine[0] ?? null, lastGood: mine.find(pullWasClean) ?? null }
  })
}

/** `6,507`, with the comma a person expects. */
export const countWords = (n: number): string => n.toLocaleString('en-US')

/**
 * What a clean pull changed, each count marked as a value: *4 new · 31 changed · 9 gone*. A pull that changed
 * nothing says so in plain words.
 */
export function pullChangeWords(row: Pick<PullRow, 'added' | 'changed' | 'gone'>): string {
  const parts: string[] = []
  if (row.added > 0) parts.push(`${val('count', countWords(row.added))} new`)
  if (row.changed > 0) parts.push(`${val('count', countWords(row.changed))} changed`)
  if (row.gone > 0) parts.push(`${val('count', countWords(row.gone))} gone`)
  return parts.length > 0 ? parts.join(' · ') : 'Nothing changed'
}

/** The words under a file whose newest pull did not read it whole. */
export function pullTroubleWords(line: PullLine): string | null {
  const last = line.last
  if (!last || pullWasClean(last)) return null
  if (pullStopped(last)) return 'The last pull stopped before it finished. Nothing was changed by it.'
  return last.error
}

/** The classes the tiles count, in the order they are drawn, with a responsible master counted among the masters. */
export const ROLL_TILES: readonly { key: string; label: string; classes: readonly RollClass[] }[] = [
  { key: 'journeyman', label: 'journeymen', classes: ['journeyman'] },
  { key: 'master', label: 'masters', classes: ['master', 'responsible_master'] },
  { key: 'tradesman', label: 'tradesmen', classes: ['tradesman'] },
]

/** `BEXAR` as *Bexar*, and a list of them as a sentence's tail: *Bexar, Comal and Hays*. */
export function countyWords(counties: readonly string[]): string {
  const names = [...counties].sort().map((c) => c.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase()))
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The files a press of the page's pull would read: every weekly file. */
export const FILES_TO_PULL: readonly TsbpeFileKey[] = TSBPE_WEEKLY_FILES
