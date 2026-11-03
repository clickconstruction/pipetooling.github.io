/**
 * The index check (punch list #240, v2.6364): what Drive holds against what `file_index` holds, pure, so the app's test
 * reads it as `drive-link`'s `index_check` and `scripts/file-index-check.ts` do. The owner's question after the backfill:
 * how do we know which files are in the index and which are not, so we know when to index again or index more? A row is
 * the record of a file a walk reached; this is the record of the ones no walk reached. No imports, as `fileIndexKernel.ts`.
 *
 * A row the Shared Drive's listing does not show is not a file gone: a bid's folder can sit outside the Shared Drive,
 * readable because it is shared with the service account, and its files have rows no listing of the drive will show. Only
 * asking Drive by id can tell, which is what the sweep's recheck does, so this counts those rows and never calls them gone.
 */

/** A file as the Shared Drive lists it to the check. */
export interface CheckFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string | null
}

/** A row as the check reads it. */
export interface CheckRow {
  drive_file_id: string
  modified_at: string | null
  text_why: string | null
  text_source: string | null
  jobs_ledger_id: string | null
  bid_id: string | null
}

/** How many of the files with no row an answer names, as it ships and at most. */
export const CHECK_SAMPLE_DEFAULT = 25
export const CHECK_SAMPLE_MAX = 500
/** How many files one check lists at most; past it the answer says it was capped. */
export const CHECK_FILES_MAX = 10_000

export interface IndexCheck {
  /** Files in the Shared Drive the listing reached, folders left out. */
  filesInDrive: number
  /** True when the drive holds more than the cap, so the counts are of the first `filesInDrive` by modified time. */
  capped: boolean
  rows: number
  /** Files in the drive with no row: never reached by a walk or the sweep. */
  filesWithNoRow: number
  /** Rows whose file changed in Drive since the row was written. */
  filesChangedSinceRow: number
  /** Rows the listing did not show: a file outside the Shared Drive, one trashed since, or one past the cap. */
  rowsOutsideListing: number
  /** The same rows by what they belong to. */
  rowsOutsideListingOn: { job: number; bid: number; none: number }
  rowsWithText: number
  /** Rows with no text, by reason. */
  rowsByWhy: Record<string, number>
  /** Up to the sample's size of the files with no row, newest first. */
  missing: { id: string; name: string; mime: string; modified: string | null }[]
}

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  return Number.isFinite(ta) && Number.isFinite(tb) ? ta === tb : a === b
}

/** The sample's size an ask may take: the default for nothing or nonsense, zero for counts alone, never past the most. */
export function checkSample(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return CHECK_SAMPLE_DEFAULT
  return Math.min(CHECK_SAMPLE_MAX, Math.floor(v))
}

/** The reconciliation: every listed file against every row. */
export function reconcile(files: readonly CheckFile[], rows: readonly CheckRow[], capped: boolean, sample: number = CHECK_SAMPLE_DEFAULT): IndexCheck {
  const byId = new Map<string, CheckRow>()
  for (const r of rows) byId.set(r.drive_file_id, r)
  const seen = new Set<string>()
  let filesWithNoRow = 0
  let filesChangedSinceRow = 0
  const missing: IndexCheck['missing'] = []
  for (const f of files) {
    if (seen.has(f.id)) continue
    seen.add(f.id)
    const row = byId.get(f.id)
    if (!row) {
      filesWithNoRow += 1
      missing.push({ id: f.id, name: f.name, mime: f.mimeType, modified: f.modifiedTime ?? null })
      continue
    }
    if (!sameInstant(f.modifiedTime, row.modified_at)) filesChangedSinceRow += 1
  }
  let rowsOutsideListing = 0
  const rowsOutsideListingOn = { job: 0, bid: 0, none: 0 }
  let rowsWithText = 0
  const rowsByWhy: Record<string, number> = {}
  for (const r of rows) {
    if (!seen.has(r.drive_file_id)) {
      rowsOutsideListing += 1
      rowsOutsideListingOn[r.jobs_ledger_id ? 'job' : r.bid_id ? 'bid' : 'none'] += 1
    }
    if (r.text_source) rowsWithText += 1
    else {
      const why = r.text_why ?? 'none'
      rowsByWhy[why] = (rowsByWhy[why] ?? 0) + 1
    }
  }
  missing.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''))
  return { filesInDrive: seen.size, capped, rows: rows.length, filesWithNoRow, filesChangedSinceRow, rowsOutsideListing, rowsOutsideListingOn, rowsWithText, rowsByWhy, missing: missing.slice(0, Math.max(0, sample)) }
}

const n = (v: number) => v.toLocaleString('en-US')
const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`

function whyWords(why: string, count: number): string {
  switch (why) {
    case 'scan':
      return plural(count, 'scan', 'scans')
    case 'kind':
      return `${n(count)} of a kind the index does not read`
    case 'big':
      return `${n(count)} too big`
    case 'slow':
    case 'reading':
      return `${n(count)} cut short`
    case 'error':
      return `${n(count)} failed`
    default:
      return `${n(count)} ${why}`
  }
}

/** The check in the office's words, counts only, never a file's name. */
export function checkWords(c: IndexCheck): string {
  const merged: Record<string, number> = {}
  for (const [why, count] of Object.entries(c.rowsByWhy)) {
    const key = why === 'reading' ? 'slow' : why
    merged[key] = (merged[key] ?? 0) + count
  }
  const whys = Object.entries(merged)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => whyWords(k, v))
  const none = c.rows - c.rowsWithText
  const parts = [
    `Drive holds ${plural(c.filesInDrive, 'file', 'files')}${c.capped ? ' (the first of more)' : ''} and the index holds ${plural(c.rows, 'row', 'rows')}.`,
    `${plural(c.filesWithNoRow, 'file has', 'files have')} no row, and ${plural(c.filesChangedSinceRow, 'file has', 'files have')} changed since its row.`,
    `${n(c.rowsWithText)} with text, ${n(none)} with none${whys.length ? ` (${whys.join(', ')})` : ''}.`,
  ]
  if (c.rowsOutsideListing > 0) {
    const on = c.rowsOutsideListingOn
    const where = [on.bid ? `${n(on.bid)} on bids` : '', on.job ? `${n(on.job)} on jobs` : '', on.none ? `${n(on.none)} on nothing` : ''].filter(Boolean).join(', ')
    parts.push(`${plural(c.rowsOutsideListing, 'row is', 'rows are')} for a file the Shared Drive's listing did not show (${where}): outside the drive, or trashed since, which the sweep's recheck settles.`)
  }
  return parts.join(' ')
}

/** Whether the index wants another pass: a file with no row, or a file changed since its row. A row outside the listing does not: the sweep's recheck settles it. */
export function checkWantsAPass(c: IndexCheck): boolean {
  return c.filesWithNoRow > 0 || c.filesChangedSinceRow > 0
}

/** How many rounds a fill takes at most, each of up to CHECK_SAMPLE_MAX files. */
export const FILL_ROUNDS_MAX = 200

/** Whether a fill goes round again: files still have no row, the last round made some have one, and the rounds are not spent. */
export function fillContinues(before: number, after: number, rounds: number): boolean {
  return after > 0 && after < before && rounds < FILL_ROUNDS_MAX
}

/** What a fill did, counted: files asked about, rows written, why a row has no text, and the refusals in their own words. */
export interface FillTally {
  asked: number
  rows: number
  held: Record<string, number>
  refused: Record<string, number>
}

export const emptyFill = (): FillTally => ({ asked: 0, rows: 0, held: {}, refused: {} })

/** One file's answer from `index`, read defensively; a file with no text still has a row, with its reason. */
export function addFillAnswer(t: FillTally, answer: unknown): FillTally {
  const o = (answer ?? {}) as { indexed?: unknown; held?: unknown }
  const held = { ...t.held }
  for (const raw of Array.isArray(o.held) ? o.held : []) {
    const why = (raw as { why?: unknown } | null)?.why
    if (typeof why === 'string') held[why] = (held[why] ?? 0) + 1
  }
  return { ...t, asked: t.asked + 1, rows: t.rows + (typeof o.indexed === 'number' ? o.indexed : 0), held }
}

/** One file the function refused, or stopped on. */
export function addFillRefusal(t: FillTally, words: string): FillTally {
  return { ...t, asked: t.asked + 1, refused: { ...t.refused, [words]: (t.refused[words] ?? 0) + 1 } }
}

/** The fill's line, counts only. */
export function fillWords(t: FillTally): string {
  const held = Object.entries(t.held).map(([why, count]) => whyWords(why, count))
  const refused = Object.entries(t.refused).map(([words, count]) => `${n(count)} × ${words}`)
  const parts = [`Asked about ${plural(t.asked, 'file', 'files')}: ${plural(t.rows, 'row', 'rows')} written`]
  if (held.length) parts.push(`of them with no text ${held.join(', ')}`)
  if (refused.length) parts.push(`refused ${refused.join(', ')}`)
  return `${parts.join('; ')}.`
}
