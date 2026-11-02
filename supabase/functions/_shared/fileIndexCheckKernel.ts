/**
 * The index check (punch list #240, v2.6364): what Drive holds against what `file_index` holds, pure, so the app's test
 * reads it as `drive-link`'s `index_check` does. The owner's question after the backfill: how do we know which files are
 * in the index and which are not, so we know when to index again or index more? The row is the record of a file the
 * walk reached; this is the record of the ones it did not. No imports, as `fileIndexKernel.ts`.
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
}

/** How many of the files with no row the answer names, for the office to act on. */
export const CHECK_SAMPLE_MAX = 25
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
  /** Rows whose file the listing did not show: trashed, moved out, or past the cap. */
  rowsWithNoFile: number
  /** Rows whose file changed in Drive since the row was written. */
  filesChangedSinceRow: number
  rowsWithText: number
  /** Rows with no text, by reason. */
  rowsByWhy: Record<string, number>
  /** Up to CHECK_SAMPLE_MAX of the files with no row, newest first. */
  missing: { id: string; name: string; mime: string; modified: string | null }[]
}

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  return Number.isFinite(ta) && Number.isFinite(tb) ? ta === tb : a === b
}

/** The reconciliation: every listed file against every row. */
export function reconcile(files: readonly CheckFile[], rows: readonly CheckRow[], capped: boolean, sampleMax = CHECK_SAMPLE_MAX): IndexCheck {
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
  let rowsWithNoFile = 0
  let rowsWithText = 0
  const rowsByWhy: Record<string, number> = {}
  for (const r of rows) {
    if (!seen.has(r.drive_file_id)) rowsWithNoFile += 1
    if (r.text_source) rowsWithText += 1
    else {
      const why = r.text_why ?? 'none'
      rowsByWhy[why] = (rowsByWhy[why] ?? 0) + 1
    }
  }
  missing.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''))
  return { filesInDrive: seen.size, capped, rows: rows.length, filesWithNoRow, rowsWithNoFile, filesChangedSinceRow, rowsWithText, rowsByWhy, missing: missing.slice(0, sampleMax) }
}

const n = (v: number) => v.toLocaleString('en-US')
const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`

const WHY_WORDS: Record<string, string> = {
  scan: 'scans',
  kind: 'of a kind the index does not read',
  big: 'too big',
  slow: 'cut short',
  reading: 'cut short',
  error: 'failed',
}

/** The check in the office's words, counts only. */
export function checkWords(c: IndexCheck): string {
  const whys = Object.entries(c.rowsByWhy)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${n(v)} ${WHY_WORDS[k] ?? k}`)
  const none = c.rows - c.rowsWithText
  let line = `Drive holds ${plural(c.filesInDrive, 'file', 'files')}${c.capped ? ' (the first of more)' : ''}; the index holds ${plural(c.rows, 'row', 'rows')}: ${n(c.filesWithNoRow)} with no row, ${n(c.filesChangedSinceRow)} changed since their row, ${n(c.rowsWithNoFile)} ${c.rowsWithNoFile === 1 ? 'row' : 'rows'} for a file gone.`
  line += ` ${n(c.rowsWithText)} with text, ${n(none)} with none${whys.length ? ` (${whys.join(', ')})` : ''}.`
  return line
}

/** Whether the index needs another pass: a file with no row, a file changed since its row, or a row for a file gone. */
export function checkWantsAPass(c: IndexCheck): boolean {
  return c.filesWithNoRow > 0 || c.filesChangedSinceRow > 0 || c.rowsWithNoFile > 0
}
