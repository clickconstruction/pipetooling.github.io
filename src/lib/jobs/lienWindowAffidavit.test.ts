import { describe, expect, it } from 'vitest'
import { buildLienAffidavitBlocks, filingDocText, type LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import { buildLienAffidavitFieldsForJob } from './lienNoticeDraft'
import { buildLienWindowAffidavitFields } from './lienWindowAffidavit'
import { buildLienTimelineFromWindow, lienWindowLastMonth } from './lienTimelineDesk'

/**
 * The desk's affidavit and the Lien window's are one paper (v2.6809). The report: a job with no clock hours and no day
 * set by hand read *from August 1, 2026 through August 31, 2026* on the desk and *from — through —* in the window one
 * press later, and the window's original contractor line had lost its address.
 */

// What both surfaces know about the job: a sub's service visit, created in August, never clocked, no day set by hand.
const shared = {
  jobName: 'Service Visit',
  jobAddress: '12 Sample Rd, San Antonio, TX 78209',
  serviceTypeName: 'Plumbing',
  isSub: true,
  originalContractorName: 'Harborline Builders',
  originalContractorAddress: '9 Yard St, Devine TX 78016',
  ownerName: 'Pat Owner',
  ownerAddress: '4 Owner Ct, San Antonio, TX 78209',
  county: 'Bexar',
  legalDescription: 'CB 1 BLK B LOT 7',
  customerName: 'Harborline Builders',
  revenue: 595,
  paymentsMade: 0,
  todayYmd: '2026-11-09',
  noticesRecorded: true,
  contactPerson: 'Rey Master, Master Plumber',
  issuer: null,
}
const jobRow = { created_at: '2026-08-18T05:40:28.750883+00:00', first_work_date: null, last_work_date: null, lien_last_work_on: null }

// The desk: its RPC names the creation month as the last month, and the pane hands over the job row.
const desk = (over: Partial<Parameters<typeof buildLienAffidavitFieldsForJob>[0]> = {}) => buildLienAffidavitFieldsForJob({ ...shared, openBalance: 595, lastMonth: '2026-08', workDays: jobRow, ...over })
// The window: the job row and the forecast's months, which leave a job with no sessions out.
const win = (over: Partial<Parameters<typeof buildLienWindowAffidavitFields>[0]> = {}) => buildLienWindowAffidavitFields({ ...shared, openBalance: 595, job: jobRow, workMonths: null, ...over })

const numbered = (fields: LienAffidavitFields) =>
  filingDocText(buildLienAffidavitBlocks(fields))
    .split('\n')
    .filter((line) => /^\d+\. /.test(line.trim()))

describe('the Lien window’s affidavit is the desk’s (v2.6809)', () => {
  it('a job with no clock hours and no day set by hand: every numbered item reads the same on both', () => {
    expect(numbered(win())).toEqual(numbered(desk()))
    expect(win()).toEqual(desk())
    expect(numbered(win()).length).toBeGreaterThanOrEqual(9)
  })

  it('paragraph 5 swears the creation month in the window, never the blanks', () => {
    const text = filingDocText(buildLienAffidavitBlocks(win()))
    expect(text).toContain('5. The work was performed and/or materials delivered during the period from August 1, 2026 through August 31, 2026.')
    expect(text).not.toContain('from — through —')
  })

  it('the original contractor line carries the address on file', () => {
    expect(filingDocText(buildLienAffidavitBlocks(win()))).toContain('7. The name and address of the original contractor is: Harborline Builders, 9 Yard St, Devine TX 78016.')
    // No address on file: the name alone, as before.
    expect(filingDocText(buildLienAffidavitBlocks(win({ originalContractorAddress: '' })))).toContain('7. The name and address of the original contractor is: Harborline Builders.')
  })

  it('a day set by hand, and clock days, reach both papers the same way', () => {
    const hand = { ...jobRow, lien_last_work_on: '2026-08-15' }
    expect(win({ job: hand })).toEqual(desk({ workDays: hand }))
    expect(win({ job: hand })).toMatchObject({ workStart: '2026-08-01', workEnd: '2026-08-15' })
    const clocked = { ...jobRow, first_work_date: '2026-07-22', last_work_date: '2026-08-11' }
    const months = { months: [{ key: '2026-07' }, { key: '2026-08' }] as never, lastMonthKey: '2026-08' }
    expect(win({ job: clocked, workMonths: months })).toEqual(desk({ workDays: clocked }))
    expect(win({ job: clocked, workMonths: months })).toMatchObject({ workStart: '2026-07-22', workEnd: '2026-08-11' })
  })

  it('sessions not yet approved: the window’s months give the period, from the first month’s first day', () => {
    const months = { months: [{ key: '2026-07' }, { key: '2026-08' }] as never, lastMonthKey: '2026-08' }
    expect(win({ workMonths: months })).toMatchObject({ workStart: '2026-07-01', workEnd: '2026-08-31' })
  })

  it('no creation day and nothing else: the paper shows its blanks', () => {
    expect(filingDocText(buildLienAffidavitBlocks(win({ job: { ...jobRow, created_at: null } })))).toContain('during the period from — through —.')
  })
})

describe('lienWindowLastMonth · the strip and the paper read one month (v2.6809)', () => {
  it('names the creation month for a job with no hours, the ledger’s month, or the day set by hand', () => {
    expect(lienWindowLastMonth({ workMonths: null, job: jobRow })).toEqual({ lastMonth: '2026-08', fromCreation: true, byHand: false })
    expect(lienWindowLastMonth({ workMonths: null, job: { ...jobRow, last_work_date: '2026-09-02' } })).toEqual({ lastMonth: '2026-09', fromCreation: false, byHand: false })
    expect(lienWindowLastMonth({ workMonths: null, job: { ...jobRow, lien_last_work_on: '2026-10-01' } })).toEqual({ lastMonth: '2026-10', fromCreation: false, byHand: true })
    const months = { months: [{ key: '2026-07' }] as never, lastMonthKey: '2026-07' }
    expect(lienWindowLastMonth({ workMonths: months, job: jobRow })).toEqual({ lastMonth: '2026-07', fromCreation: false, byHand: false })
    expect(lienWindowLastMonth({ workMonths: months, job: { ...jobRow, lien_last_work_on: '2026-08-15' } })).toEqual({ lastMonth: '2026-08', fromCreation: false, byHand: true })
  })

  it('is the month the window’s strip draws as Last work', () => {
    const timeline = buildLienTimelineFromWindow({ workMonths: null, filings: [], job: { id: 'j1', ...jobRow }, isSub: true, propertyKind: 'residential', openBalance: 595, todayYmd: '2026-11-09' })
    const lastWork = timeline.steps.find((s) => s.kind === 'last_work')
    expect(lastWork?.date).toBe('2026-08-01')
    expect(win().workStart).toBe(lastWork?.date)
  })
})
