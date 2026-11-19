import { describe, expect, it } from 'vitest'
import { serveDueForFiling } from './lienDeadlines'
import {
  lienDocNumberFromName,
  lienFilingBatchPress,
  lienFilingByWords,
  lienFilingCheck,
  lienFilingDayOk,
  lienFilingDoorWords,
  lienFilingFilesPlan,
  lienFilingFilesWords,
  lienFilingLeadWords,
  lienFilingNotRecordedWords,
  lienFilingPayload,
  lienFilingRecordedWords,
  lienFilingTargets,
  type LienFilingTarget,
} from './lienFilingBatch'

// Every job, county and number here is made up.
const target = (n: string, over: Partial<LienFilingTarget> = {}): LienFilingTarget => ({ jobId: `job-${n}`, jobNumber: `JP${n}`, jobLabel: `${n} · Sample Job`, county: 'Alder', fileByYmd: '2026-12-15', daysLeft: 27, fields: { county: 'Alder', unpaidAmount: '9000.00' }, amount: 9000, ...over })

describe('lienFilingTargets', () => {
  const entries = [
    { jobId: 'job-9011', pile: 'ready', deadline: '2026-12-15', daysLeft: 27 },
    { jobId: 'job-9004', pile: 'ready', deadline: '2026-11-20', daysLeft: 2 },
    { jobId: 'job-9001', pile: 'filed', deadline: '2026-12-15', daysLeft: 27 },
    { jobId: 'job-9002', pile: 'held', deadline: '2026-12-15', daysLeft: 27 },
    { jobId: 'job-9009', pile: 'ready', deadline: null, daysLeft: null },
  ]
  const fieldsFor = (jobId: string) => (jobId === 'job-9009' ? null : { county: ' Alder ', unpaidAmount: '1234.50' })

  it('lists the liens in Ready to file alone, the soonest day first, with the county and the sworn amount off the paper', () => {
    const out = lienFilingTargets({ entries, jobNumber: (id) => `JP${id.slice(4)}`, jobLabel: (id) => `${id.slice(4)} · Sample Job`, fieldsFor })
    expect(out.map((t) => [t.jobId, t.county, t.amount, t.fileByYmd])).toEqual([
      ['job-9004', 'Alder', 1234.5, '2026-11-20'],
      ['job-9011', 'Alder', 1234.5, '2026-12-15'],
      ['job-9009', '', 0, ''],
    ])
    // A lien the desk cannot draw is listed, with no paper: the window sends it to its own Lien window.
    expect(out[2]?.fields).toBeNull()
  })
})

describe('the window’s words', () => {
  it('names the door with its count, and none with nothing waiting', () => {
    expect(lienFilingDoorWords(3)).toBe('Enter document numbers · 3 ›')
    expect(lienFilingDoorWords(0)).toBeNull()
  })

  it('says how many liens wait, and what is on record once none do', () => {
    expect(lienFilingLeadWords(3, 0)).toBe('3 liens are approved and not yet on record as filed.')
    expect(lienFilingLeadWords(1, 2)).toBe('1 lien is approved and not yet on record as filed.')
    expect(lienFilingLeadWords(0, 3)).toBe('3 filings are on record.')
    expect(lienFilingLeadWords(0, 0)).toBe('Nothing waiting on a document number.')
  })

  it('counts the press for numbers that came from file names', () => {
    expect(lienFilingBatchPress(3)).toBe('Record 3 filings')
    expect(lienFilingBatchPress(1)).toBe('Record 1 filing')
  })

  it('says the day recorded and the mail-by day, from the statute’s own count', () => {
    expect(lienFilingRecordedWords('2026-11-18')).toBe(`Filed Nov 18. Recorded. Mail its copies by Nov ${Number(serveDueForFiling('2026-11-18').slice(8))}.`)
    expect(lienFilingNotRecordedWords('permission denied.')).toBe('Not recorded: permission denied. The box still holds the number.')
  })

  it('reads the file-by day as a chip', () => {
    expect(lienFilingByWords(target('1'))).toEqual({ words: 'file by Dec 15', tone: 'quiet' })
    expect(lienFilingByWords(target('1', { daysLeft: 2, fileByYmd: '2026-11-20' }))).toEqual({ words: 'file by Nov 20', tone: 'soon' })
    expect(lienFilingByWords(target('1', { daysLeft: 0 }))).toEqual({ words: 'file today', tone: 'soon' })
    expect(lienFilingByWords(target('1', { daysLeft: -1 }))).toEqual({ words: 'its day passed', tone: 'late' })
    expect(lienFilingByWords(target('1', { fileByYmd: '' }))).toBeNull()
  })

  it('knows a day from a blank', () => {
    expect(lienFilingDayOk('2026-11-18')).toBe(true)
    expect(lienFilingDayOk('')).toBe(false)
  })
})

describe('lienFilingCheck', () => {
  const known = [{ filingId: 'a', county: 'Alder', number: '20260229001', filedYmd: '2026-11-16', jobLabel: '9001 · Sample Job' }]
  const stack = [
    { jobId: 'job-9004', county: 'Alder', number: '20260229004', jobLabel: '9004 · Sample Job' },
    { jobId: 'job-9007', county: 'Alder', number: '', jobLabel: '9007 · Sample Job' },
  ]

  it('passes a number of the county’s shape', () => {
    expect(lienFilingCheck({ target: target('9007'), number: '20260229007', filedYmd: '2026-11-18', known, stack })).toEqual({ kind: 'ok' })
  })

  it('holds a number a lien on record holds, and one typed on another row of the same stack', () => {
    expect(lienFilingCheck({ target: target('9007'), number: '20260229001', filedYmd: '2026-11-18', known, stack }).kind).toBe('twin')
    expect(lienFilingCheck({ target: target('9007'), number: '20260229004', filedYmd: '2026-11-18', known, stack })).toEqual({ kind: 'twin', words: '9004 · Sample Job holds this number too. Two liens cannot share one. Check both stamps.' })
  })

  it('does not call a row its own twin, and asks about an odd number', () => {
    expect(lienFilingCheck({ target: target('9004'), number: '20260229004', filedYmd: '2026-11-18', known, stack })).toEqual({ kind: 'ok' })
    expect(lienFilingCheck({ target: target('9007'), number: '2026022900', filedYmd: '2026-11-18', known, stack }).kind).toBe('odd')
  })
})

describe('lienFilingPayload', () => {
  it('is the row the Lien window inserts: the paper, the sworn amount, the county, the number, the day and the serve-by day', () => {
    const t = target('9004')
    expect(lienFilingPayload(t, { number: ' 2026 0229 004 ', filedYmd: '2026-11-18' })).toEqual({ job_id: 'job-9004', kind: 'affidavit', amount: 9000, fields: t.fields, county: 'Alder', recording_number: '2026 0229 004', filed_at: '2026-11-18', serve_due: serveDueForFiling('2026-11-18') })
  })
})

describe('the clerk’s files, by their names', () => {
  it('reads the document number out of a name, never the job’s own number or a day', () => {
    expect(lienDocNumberFromName('J9004 Lien (20260229004).pdf', 'JP9004')).toBe('20260229004')
    expect(lienDocNumberFromName('9004 stamped 2026-0229-004.pdf', '9004')).toBe('20260229004')
    expect(lienDocNumberFromName('J9004 Lien 2026-11-16.pdf', 'JP9004')).toBe('')
    expect(lienDocNumberFromName('J9004 Lien 2026-11-16 (20260229004).pdf', 'JP9004')).toBe('20260229004')
    expect(lienDocNumberFromName('J9004 Lien.pdf', 'JP9004')).toBe('')
  })

  const targets = [target('9004'), target('9007'), target('904')]

  it('sends each file to the lien whose job number is in its name, with the number from the name', () => {
    const plan = lienFilingFilesPlan([{ name: 'J9004 Lien (20260229004).pdf' }, { name: 'j9007 lien.pdf' }], targets)
    expect(plan).toEqual({ matched: [{ index: 0, jobId: 'job-9004', number: '20260229004' }, { index: 1, jobId: 'job-9007', number: '' }], left: [] })
    expect(lienFilingFilesWords(plan)).toEqual({ went: '2 files went to their liens, by the job number in each name.', left: [] })
  })

  it('leaves out a file that names no lien, two liens, or a lien that has a file, each with its reason', () => {
    const plan = lienFilingFilesPlan([{ name: 'scan 12.pdf' }, { name: 'J9004 and J9007.pdf' }, { name: 'J904 Lien.pdf' }, { name: '904 again.pdf' }, { name: 'J9004 second.pdf' }], targets, new Set(['job-9004']))
    expect(plan.matched).toEqual([{ index: 2, jobId: 'job-904', number: '' }])
    expect(plan.left.map((l) => [l.index, l.reason])).toEqual([
      [0, 'its name holds no job number of a lien here'],
      [1, 'its name fits two liens'],
      [3, 'that lien already has a file'],
      [4, 'that lien already has a file'],
    ])
    expect(lienFilingFilesWords(plan).left[0]).toBe('scan 12.pdf: left out, its name holds no job number of a lien here.')
    expect(lienFilingFilesWords({ matched: [{}], left: [] }).went).toBe('1 file went to its lien, by the job number in its name.')
    expect(lienFilingFilesWords({ matched: [], left: [] }).went).toBe('No file found its lien.')
  })

  it('does not find job 904 inside 9004, or a job number inside the document number', () => {
    expect(lienFilingFilesPlan([{ name: 'J9004 Lien (20260220904).pdf' }], targets).matched).toEqual([{ index: 0, jobId: 'job-9004', number: '20260220904' }])
  })
})
