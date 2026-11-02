import { describe, expect, it } from 'vitest'
import { CHECK_SAMPLE_MAX, checkWantsAPass, checkWords, reconcile, type CheckFile, type CheckRow } from '../../../supabase/functions/_shared/fileIndexCheckKernel'

/**
 * supabase/functions/_shared/fileIndexCheckKernel.ts answers the owner's question after the backfill (punch list #240,
 * v2.6364): which files are in the index and which are not. These pin the reconciliation and its words.
 */
const file = (id: string, modified = '2026-11-01T10:00:00.000Z', name = `${id}.pdf`): CheckFile => ({ id, name, mimeType: 'application/pdf', modifiedTime: modified })
const row = (id: string, over: Partial<CheckRow> = {}): CheckRow => ({ drive_file_id: id, modified_at: '2026-11-01T10:00:00+00:00', text_why: null, text_source: 'pdf_layer', ...over })

describe('reconcile', () => {
  it('counts files with no row, rows for a file gone, and files changed since their row, comparing instants', () => {
    const files = [file('a'), file('b', '2026-11-02T09:00:00.000Z'), file('c'), file('c')]
    const rows = [row('a'), row('b'), row('gone')]
    const c = reconcile(files, rows, false)
    expect(c).toMatchObject({ filesInDrive: 3, capped: false, rows: 3, filesWithNoRow: 1, rowsWithNoFile: 1, filesChangedSinceRow: 1, rowsWithText: 3, rowsByWhy: {} })
    expect(c.missing).toEqual([{ id: 'c', name: 'c.pdf', mime: 'application/pdf', modified: '2026-11-01T10:00:00.000Z' }])
  })
  it('a row with the same instant in PostgREST’s spelling is current', () => {
    const c = reconcile([file('a', '2026-11-01T10:00:00.000Z')], [row('a', { modified_at: '2026-11-01T10:00:00+00:00' })], false)
    expect(c.filesChangedSinceRow).toBe(0)
  })
  it('rows with no text are counted by reason, and the sample is newest first and capped', () => {
    const files = Array.from({ length: 30 }, (_, i) => file(`f${i}`, `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T00:00:00.000Z`))
    const rows = [row('x', { text_source: null, text_why: 'scan' }), row('y', { text_source: null, text_why: 'scan' }), row('z', { text_source: null, text_why: 'big' })]
    const c = reconcile(files, rows, true)
    expect(c.rowsByWhy).toEqual({ scan: 2, big: 1 })
    expect(c.rowsWithText).toBe(0)
    expect(c.capped).toBe(true)
    expect(c.missing).toHaveLength(CHECK_SAMPLE_MAX)
    expect(c.missing[0]!.modified! >= c.missing[1]!.modified!).toBe(true)
  })
})

describe('the words', () => {
  it('say the counts and every reason, and nothing else', () => {
    const c = reconcile([file('a'), file('b'), file('c')], [row('a'), row('b', { text_source: null, text_why: 'scan' }), row('d', { text_source: null, text_why: 'reading' })], false)
    expect(checkWords(c)).toBe('Drive holds 3 files; the index holds 3 rows: 1 with no row, 0 changed since their row, 1 row for a file gone. 1 with text, 2 with none (1 scans, 1 cut short).')
    expect(checkWantsAPass(c)).toBe(true)
  })
  it('a whole index wants no pass', () => {
    const c = reconcile([file('a')], [row('a')], false)
    expect(checkWords(c)).toBe('Drive holds 1 file; the index holds 1 row: 0 with no row, 0 changed since their row, 0 rows for a file gone. 1 with text, 0 with none.')
    expect(checkWantsAPass(c)).toBe(false)
  })
  it('a capped listing says so', () => {
    expect(checkWords(reconcile([file('a')], [], true))).toMatch(/^Drive holds 1 file \(the first of more\);/)
  })
})
