import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { materialsPressesFor } from './materialsGroups'
import { jobPrintSheet, jobPrintSheetTitle, pagePrintSheet, PRINT_SHEET_NO_BOX } from './printSheet'
import { PRINT_RESERVED_SAME_WORDS, reservedRunsToPrint } from './reservedPrint'
import { STICKER_MINT_WHO, type StickerRowOfRun, type StickerRun } from './stickerRun'

const sticker = (number: number, boxName: string | null, printedAt: string | null = null): StickerRowOfRun => ({ id: `s${number}`, number, code: `AAAA${String(number).padStart(4, '0')}`, boxName, containerId: null, lostAt: null, ...(printedAt ? { printedAt } : {}) })
const run = (id: string, first: number, count: number, over: Partial<StickerRun> = {}, printed = 0): { run: StickerRun; stickers: StickerRowOfRun[] } => {
  const names = Array.from({ length: count }, (_, i) => `G${first + i}`)
  return {
    run: { id, jobId: 'j1', count, firstNumber: first, lastNumber: first + count - 1, copies: 1, printedByName: 'Robert', printedAt: '2026-11-16T15:00:00Z', names, ...over },
    stickers: names.map((n, i) => sticker(first + i, n, i < printed ? '2026-11-17T15:05:00Z' : null)),
  }
}
const day = () => 'Nov 16'
const job = { hcp_number: '224', click_number: null, job_name: 'Materials: Phase 2 draws, Jul 2025' }

describe('the Print sheet with a job open', () => {
  it('is titled by the job’s number with its name under it', () => {
    const sheet = jobPrintSheet({ job, boxCount: 91, runs: [], role: 'dev', dayWords: day })
    expect(sheet.title).toBe('Print for job 224')
    expect(sheet.sub).toBe('Materials: Phase 2 draws, Jul 2025')
    // a job with no number, and a job the page could not read
    expect(jobPrintSheetTitle({ hcp_number: '', click_number: '', job_name: 'A walk' })).toBe('Print for this job')
    expect(jobPrintSheet({ job: undefined, boxCount: 0, runs: [], role: 'dev', dayWords: day })).toMatchObject({ title: 'Print for this job', sub: '' })
  })

  it('offers the labels, the manifest, each reserved run, a new run and another job, in that order', () => {
    const sheet = jobPrintSheet({ job, boxCount: 91, runs: reservedRunsToPrint([run('r1', 93, 58)]), role: 'assistant', dayWords: day })
    expect(sheet.rows.map((r) => [r.label, r.dead])).toEqual([
      ['Labels for its boxes', false],
      ['The manifest', false],
      ['Print the 58 reserved stickers, G93 to G150', false],
      ['Future stickers', false],
      ['Print for another job', false],
    ])
    expect(sheet.rows.map((r) => r.act)).toEqual([{ kind: 'labels' }, { kind: 'manifest' }, { kind: 'reserved', runId: 'r1', waiting: false }, { kind: 'stickers' }, { kind: 'another-job' }])
    // the reserved run says it reserves nothing new
    expect(sheet.rows[2]!.line).toBe(PRINT_RESERVED_SAME_WORDS)
  })

  it('a job with no box has the labels and the manifest dead with the reason', () => {
    const sheet = jobPrintSheet({ job, boxCount: 0, runs: [], role: 'dev', dayWords: day })
    expect(sheet.rows.filter((r) => r.dead).map((r) => [r.key, r.line])).toEqual([['labels', PRINT_SHEET_NO_BOX], ['manifest', PRINT_SHEET_NO_BOX]])
    // a new run and another job are still live
    expect(sheet.rows.filter((r) => !r.dead).map((r) => r.key)).toEqual(['stickers', 'another-job'])
  })

  it('a role that may not print a run sees the runs and Future stickers dead with who may, never missing', () => {
    const sheet = jobPrintSheet({ job, boxCount: 3, runs: reservedRunsToPrint([run('r1', 93, 58)]), role: 'estimator', dayWords: day })
    expect(sheet.rows.map((r) => [r.key, r.dead])).toEqual([['labels', false], ['manifest', false], ['reserved:r1', true], ['stickers', true], ['another-job', false]])
    expect(sheet.rows[2]!.line).toBe(STICKER_MINT_WHO)
    expect(sheet.rows[3]!.line).toBe(STICKER_MINT_WHO)
  })

  it('a run stopped part way has the press for what never came out before the press for all of it', () => {
    const sheet = jobPrintSheet({ job, boxCount: 3, runs: reservedRunsToPrint([run('r1', 93, 58, { printedAt: '2026-11-17T15:00:00Z' }, 40)]), role: 'dev', dayWords: day })
    expect(sheet.rows.slice(2, 4).map((r) => [r.label, r.act])).toEqual([
      ['Print the 18 not printed yet, G133 to G150', { kind: 'reserved', runId: 'r1', waiting: true }],
      ['Print the 58 reserved stickers, G93 to G150', { kind: 'reserved', runId: 'r1', waiting: false }],
    ])
  })

  it('two runs are told apart by who reserved each and when', () => {
    const sheet = jobPrintSheet({ job, boxCount: 3, runs: reservedRunsToPrint([run('r1', 1, 6), run('r2', 11, 3, { printedByName: 'Marcus' })]), role: 'dev', dayWords: day })
    expect(sheet.rows.filter((r) => r.act.kind === 'reserved').map((r) => r.line)).toEqual([`Reserved Nov 16 by Robert. ${PRINT_RESERVED_SAME_WORDS}`, `Reserved Nov 16 by Marcus. ${PRINT_RESERVED_SAME_WORDS}`])
  })

  it('every line is plain words', () => {
    const sheets = [
      jobPrintSheet({ job, boxCount: 3, runs: reservedRunsToPrint([run('r1', 1, 6), run('r2', 11, 3)]), role: 'dev', dayWords: day }),
      jobPrintSheet({ job, boxCount: 0, runs: reservedRunsToPrint([run('r1', 1, 6)]), role: 'estimator', dayWords: day }),
      pagePrintSheet(materialsPressesFor('dev')),
    ]
    for (const sheet of sheets) for (const row of sheet.rows) expect(plainWordsFailures(`${row.label}. ${row.line}`)).toEqual([])
  })
})

describe('the Print sheet with no job open', () => {
  it('is titled Print and offers what the strip’s presses offer the role', () => {
    expect(pagePrintSheet(materialsPressesFor('dev'))).toMatchObject({ title: 'Print', sub: '', rows: [{ label: 'Print labels', act: { kind: 'page-labels' }, dead: false }, { label: 'Print future stickers', act: { kind: 'page-stickers' }, dead: false }] })
    // an estimator prints labels and no run, as on the strip
    expect(pagePrintSheet(materialsPressesFor('estimator')).rows.map((r) => r.label)).toEqual(['Print labels'])
    expect(pagePrintSheet(materialsPressesFor('helpers')).rows).toEqual([])
  })
})
