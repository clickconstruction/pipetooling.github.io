import { describe, expect, it } from 'vitest'
import { DATED_FROM_BILL_WORDS, lienStandInFlag, lienStandInMonth, lienStandInSourceOf, MONTH_FROM_BILL_LINE, MONTH_FROM_CREATION_LINE, MONTH_STAND_IN_DOOR_WORDS } from './lienBillMonths'
import { buildLienDeskQueue, DATED_FROM_CREATION_WORDS, monthFromBill, monthFromCreation, monthIsStandIn, type LienNoticeMonthRow } from './lienDesk'
import { buildLienAffidavitQueue, type LienAffidavitRow } from './lienDeskAffidavits'
import { buildLienDeskGates } from './lienDeskGates'
import { lienDayGuessSentence } from './lienActWords'
import { lienHelpChecks } from './lienHelpSheet'
import { lienLastWorkDay, lienLastWorkSourceLine } from './lienLastWorkDay'
import { lienNoticeRecord, lienNoticeRecordAsks } from './lienNoticeRecord'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'
import { buildLienTimelineFromWindow, lienWindowLastMonth } from './lienTimelineDesk'
import { lienWindowSwornMonths } from './lienWindowAffidavit'
import { groupByProperty, parseOwnerToConfirmRows } from './ownerConfirm'
import { legalLastWorkBasis, legalLastWorkWords } from '../legal/legalLienPaper'

/**
 * The month comes from the bill (v2.7224): every reader of a job's lien month takes the same stand-in for a job
 * nobody clocked on, and says where it came from. The rule itself is `lienBillMonths.test.ts`; the SQL readers
 * are held by the lien_bill_months bed; `lienOneReading.test.ts` holds the row, the window and the paper together.
 */

const TODAY = '2026-09-23'
// Typed in on Aug 18, weeks after its work; its bill carries a July day.
const MADE = '2026-08-18T05:59:40Z'
const BILL = { status: 'billed', billed_at: '2026-08-18T06:01:42Z', sent_to_customer_at: '2026-07-24T17:00:00Z' }
const runway = (over: Partial<LienRunwayInput> = {}) => buildLienPayRunway({ todayYmd: TODAY, openBalance: 4200, lastWorkYmd: null, createdAt: MADE, bills: [BILL], propertyKind: 'non_residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, isSub: true, ...over })

describe('the billed row’s clock (buildLienPayRunway)', () => {
  it('counts from the bill’s day, not the day the job was made, and says so', () => {
    const r = runway()
    expect(r.basisYmd).toBe('2026-07-24')
    expect(r).toMatchObject({ datedFromCreation: true, datedFromBill: true, datedByHand: false })
    // July on a commercial sub job: the notice by Oct 15, the affidavit by Nov 16.
    expect(r.noticeByYmd).toBe('2026-10-15')
    expect(r.lienByYmd).toBe('2026-11-16')
    expect(r.title).toContain(`July 2026, ${DATED_FROM_BILL_WORDS}`)
    expect(lienDayGuessSentence(r)).toBe('The day counts from the bill, since no hours are on the clock.')
  })

  it('a job with no dated unpaid bill still counts from the day it was made', () => {
    const r = runway({ bills: [{ ...BILL, status: 'paid' }] })
    expect(r.basisYmd).toBe('2026-08-18')
    expect(r).toMatchObject({ datedFromCreation: true, datedFromBill: false })
    expect(r.title).toContain(`August 2026, ${DATED_FROM_CREATION_WORDS}`)
    expect(lienDayGuessSentence(r)).toBe('The day counts from the day the job was made, since no hours are on the clock.')
    expect(runway({ bills: null }).basisYmd).toBe('2026-08-18')
  })

  it('clock hours and a day set by hand both come before the bill', () => {
    expect(runway({ lastWorkYmd: '2026-06-09' })).toMatchObject({ basisYmd: '2026-06-09', datedFromCreation: false, datedFromBill: false })
    expect(runway({ handLastWorkYmd: '2026-06-12' })).toMatchObject({ basisYmd: '2026-06-12', datedByHand: true, datedFromBill: false })
  })

  it('two unpaid bills in two months owe a notice each, and the later sets the lien’s day', () => {
    const r = runway({ bills: [{ status: 'billed', billed_at: '2026-07-01T15:00:00Z' }, { status: 'billed', billed_at: '2026-08-10T15:00:00Z' }] })
    expect(r.noticeMonths.map((m) => m.key)).toEqual(['2026-07', '2026-08'])
    expect(r.lienByYmd).toBe('2026-12-15')
    // The earliest month still owed sets the notice's day.
    expect(r.noticeByYmd).toBe('2026-10-15')
  })
})

describe('the Lien window (lienWindowLastMonth, buildLienTimelineFromWindow)', () => {
  const job = { id: 'j1', created_at: MADE, last_work_date: null, invoices: [BILL] }

  it('names the bill’s month and where it came from', () => {
    expect(lienWindowLastMonth({ workMonths: null, job })).toEqual({ lastMonth: '2026-07', fromCreation: true, byHand: false, laterHoursDay: '', fromBill: true, standInMonths: ['2026-07'] })
    // No bills in hand, or none dated and unpaid: the creation month, in the shape it always had.
    expect(lienWindowLastMonth({ workMonths: null, job: { ...job, invoices: null } })).toEqual({ lastMonth: '2026-08', fromCreation: true, byHand: false, laterHoursDay: '' })
    expect(lienWindowLastMonth({ workMonths: null, job: { ...job, invoices: [{ ...BILL, status: 'paid' }] } }).lastMonth).toBe('2026-08')
  })

  it('a day set by hand and the ledger’s last day both come first', () => {
    expect(lienWindowLastMonth({ workMonths: null, job: { ...job, lien_last_work_on: '2026-06-12' } })).toMatchObject({ lastMonth: '2026-06', fromCreation: false, byHand: true })
    expect(lienWindowLastMonth({ workMonths: null, job: { ...job, last_work_date: '2026-06-09' } })).toEqual({ lastMonth: '2026-06', fromCreation: false, byHand: false, laterHoursDay: '' })
  })

  it('the strip’s Last work node and its notice month say dated from the bill', () => {
    const t = buildLienTimelineFromWindow({ workMonths: null, filings: [], job, isSub: true, propertyKind: 'non_residential', openBalance: 4200, todayYmd: TODAY })
    const last = t.steps.find((s) => s.kind === 'last_work')
    expect(last?.words).toBe(DATED_FROM_BILL_WORDS)
    expect(last?.date).toBe('2026-07-01')
    expect(t.steps.filter((s) => s.kind === 'notice').map((s) => s.monthKey)).toEqual(['2026-07'])
  })

  it('the months the paper swears are read off the same month', () => {
    const filings = [{ kind: 'notice_53_056', voided_at: null, months_covered: ['2026-07', '2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: 't', sent_on: '2026-09-10' }] }]
    // The bill's month is July, so the paper names July and leaves August off, as outside this job's work.
    expect(lienWindowSwornMonths({ job, workMonths: null, isSub: true, todayYmd: TODAY, filings: filings as never })).toEqual(['2026-07'])
    expect(lienWindowSwornMonths({ job: { ...job, invoices: null }, workMonths: null, isSub: true, todayYmd: TODAY, filings: filings as never })).toEqual(['2026-08'])
  })
})

describe('the desk’s rows (the four readers’ month_source)', () => {
  const noticeRow = (over: Partial<LienNoticeMonthRow>): LienNoticeMonthRow => ({ job_id: 'j1', work_month: '2026-07', approved_hours: 0, deadline: '2026-10-15', noticed: false, open_balance: 4200, customer_id: 'c1', gc_customer_id: 'g1', property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null, ...over })
  const affidavitRow = (over: Partial<LienAffidavitRow>): LienAffidavitRow => ({ job_id: 'j1', last_month: '2026-07', deadline: '2026-11-16', is_sub: true, noticed: true, filed: false, open_balance: 4200, customer_id: 'c1', gc_customer_id: 'g1', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null, ...over })

  it('a bill row is a stand-in, and is not a creation row', () => {
    expect([monthIsStandIn({ month_source: 'bill' }), monthFromBill({ month_source: 'bill' }), monthFromCreation({ month_source: 'bill' })]).toEqual([true, true, false])
    expect([monthIsStandIn({ month_source: 'job_created' }), monthFromBill({ month_source: 'job_created' })]).toEqual([true, false])
    expect([monthIsStandIn({ month_source: 'hours' }), monthIsStandIn({ month_source: 'hand' }), monthIsStandIn({})]).toEqual([false, false, false])
    expect(lienStandInSourceOf(true, true)).toBe('bill')
    expect(lienStandInSourceOf(true, false)).toBe('job_created')
    expect(lienStandInSourceOf(false, true)).toBeNull()
  })

  it('the notice queue flags the month and the entry', () => {
    const e = buildLienDeskQueue([noticeRow({ month_source: 'bill' })], [], {}, TODAY).entries[0]!
    expect(e.months[0]).toMatchObject({ key: '2026-07', fromCreation: true, fromBill: true })
    expect(e).toMatchObject({ datedFromCreation: true, datedFromBill: true })
    const made = buildLienDeskQueue([noticeRow({ month_source: 'job_created' })], [], {}, TODAY).entries[0]!
    expect(made).toMatchObject({ datedFromCreation: true, datedFromBill: false })
    expect(made.months[0]).not.toHaveProperty('fromBill')
  })

  it('the affidavit queue flags the last month', () => {
    expect(buildLienAffidavitQueue([affidavitRow({ month_source: 'bill' })], [], TODAY).entries[0]).toMatchObject({ lastMonth: '2026-07', lastMonthFromCreation: true, lastMonthFromBill: true })
    expect(buildLienAffidavitQueue([affidavitRow({ month_source: 'job_created' })], [], TODAY).entries[0]).toMatchObject({ lastMonthFromCreation: true, lastMonthFromBill: false })
    expect(buildLienAffidavitQueue([affidavitRow({ month_source: 'hours' })], [], TODAY).entries[0]).toMatchObject({ lastMonthFromCreation: false, lastMonthFromBill: false })
  })

  it('the fourth gate reads Dated from the bill', () => {
    const base = { ownerName: 'Sample Owner Lp', ownerMailingAddress: '1 Sample St, Austin, TX 78701', gcName: 'Sample GC', gcAddress: '', propertyKind: 'non_residential', county: 'Comal', monthLabels: ['Jul'], pickedMonthsCount: 1, pendingSessions: 0 }
    const gate = buildLienDeskGates({ ...base, datedFromCreation: true, datedFromBill: true }).gates[3]!
    expect(gate.label).toBe('Dated from the bill')
    expect(gate.title).toContain(MONTH_STAND_IN_DOOR_WORDS)
    expect(buildLienDeskGates({ ...base, datedFromCreation: true }).gates[3]!.label).toBe('Dated from creation')
    expect(buildLienDeskGates(base).gates[3]!.label).toBe('Approved hours')
  })

  it('the owner list words the first month', () => {
    const rows = parseOwnerToConfirmRows([{ job_id: 'j1', hcp_number: '412', click_number: '', job_address: '1 Sample Rd', status: 'billed', customer_id: 'c1', customer_name: 'Sample Builder', gc_customer_id: 'g1', gc_name: 'Sample Builder', customer_address_id: null, has_owner: false, owner_confirmed: false, property_kind: '', first_work_month: '2026-07', first_deadline: '2026-09-15', month_source: 'bill' }])
    expect(rows[0]).toMatchObject({ firstMonthFromCreation: true, firstMonthFromBill: true })
    expect(groupByProperty(rows, '2026-09-01')[0]!.noticeLabel).toBe('due Sep 15 · dated from the bill')
    expect(groupByProperty(rows, TODAY)[0]!.noticeLabel).toBe("July's window closed · dated from the bill")
  })
})

describe('the last-day line and the legal packet name the bill', () => {
  it('the day is the latest sent, unpaid bill’s, after a hand day and the hours', () => {
    const job = { created_at: MADE, invoices: [BILL] }
    const d = lienLastWorkDay(job)
    expect(d).toMatchObject({ day: '2026-07-24', source: 'bill', sourceWords: 'from the bill' })
    expect(lienLastWorkSourceLine(d)).toBe('from the bill')
    expect(lienLastWorkDay({ ...job, last_work_date: '2026-06-09' }).source).toBe('hours')
    expect(lienLastWorkDay({ ...job, lien_last_work_on: '2026-06-12' }).source).toBe('hand')
    expect(lienLastWorkDay({ created_at: MADE })).toMatchObject({ day: '2026-08-18', source: 'created' })
  })

  it('the legal packet’s chain takes the bill before the creation day', () => {
    expect(legalLastWorkBasis([], { created_at: MADE, invoices: [BILL] })).toEqual({ ymd: '2026-07-24', source: 'bill' })
    expect(legalLastWorkBasis([], { created_at: MADE })).toEqual({ ymd: '2026-08-18', source: 'created' })
    expect(legalLastWorkBasis(['2026-06-09'], { created_at: MADE, invoices: [BILL] }).source).toBe('sessions')
    expect(legalLastWorkWords('2026-07-24', 'bill')).toBe("no work date on file: dated from the bill's month, 2026-07")
  })
})

describe('a paper on a stand-in month is flagged, never held, and never reads On record', () => {
  it('the flag is the plain line and the door', () => {
    expect(lienStandInFlag('bill')).toBe(`${MONTH_FROM_BILL_LINE} ${MONTH_STAND_IN_DOOR_WORDS}`)
    expect(lienStandInFlag('job_created')).toBe(`${MONTH_FROM_CREATION_LINE} ${MONTH_STAND_IN_DOOR_WORDS}`)
    expect(lienStandInFlag(null)).toBe('')
  })

  it('the help sheet asks, on a sub job and on a job contracted with the owner', () => {
    const sub = lienHelpChecks({ ownerName: 'Jordan Sample', propertyKind: 'residential', homestead: false, isSub: true, monthsWords: 'August 2026', noticeLines: [], contractorName: 'Ridgeway Builders', monthStandIn: 'bill' })
    expect(sub[sub.length - 1]).toEqual({ state: 'ask', lead: 'Work month.', words: lienStandInFlag('bill') })
    const direct = lienHelpChecks({ ownerName: 'Mock Holdings LLC', propertyKind: 'non_residential', homestead: false, isSub: false, monthsWords: '', noticeLines: [], contractorName: '', monthStandIn: 'job_created' })
    expect(direct.map((c) => [c.state, c.lead])).toEqual([['ok', 'Owner.'], ['ask', 'Work month.']])
    // A month from hours or a day set by hand adds nothing.
    expect(lienHelpChecks({ ownerName: 'Mock Holdings LLC', propertyKind: 'non_residential', homestead: false, isSub: false, monthsWords: '', noticeLines: [], contractorName: '' }).map((c) => c.lead)).toEqual(['Owner.'])
  })

  it('the notice record of a paper whose notices all stand still asks when the month is a stand-in', () => {
    const filings = [{ kind: 'notice_53_056', voided_at: null, months_covered: ['2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 06', sent_on: '2026-09-22' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9589 0000 0000 0000 0000 07', sent_on: '2026-09-22' }] }]
    const input = { isSub: true, propertyKind: 'residential', swornMonths: ['2026-08'], filings: filings as never, paperMonthsWords: 'August 2026', paperNoticesWords: '' }
    const fromHours = lienNoticeRecord(input)!
    expect(fromHours.flags).toEqual([])
    const fromBill = lienNoticeRecord({ ...input, monthStandIn: 'bill' })!
    expect(fromBill.flags).toEqual([lienStandInFlag('bill')])
    expect(lienNoticeRecordAsks(fromBill)).toBe(true)
    expect(lienNoticeRecord({ ...input, monthStandIn: 'job_created' })!.flags).toEqual([lienStandInFlag('job_created')])
  })
})

describe('one rule: the kernel, the row and the window name the same month', () => {
  it.each([
    ['typed in late, bill dated earlier', MADE, [BILL], '2026-07', 'bill'],
    ['made early, billed later', '2026-02-26T17:55:00Z', [{ status: 'billed', billed_at: '2026-08-24T17:00:00Z', sent_to_customer_at: '2026-09-04T14:19:00Z' }], '2026-08', 'bill'],
    ['no dated unpaid bill', MADE, [{ status: 'paid', billed_at: '2026-06-01T15:00:00Z' }], '2026-08', 'job_created'],
  ] as const)('%s', (_name, createdAt, bills, month, source) => {
    const rule = lienStandInMonth({ bills, createdAt })
    expect([rule.month, rule.source]).toEqual([month, source])
    const row = runway({ createdAt, bills: [...bills] })
    expect(row.basisYmd.slice(0, 7)).toBe(month)
    expect(row.datedFromBill).toBe(source === 'bill')
    const win = lienWindowLastMonth({ workMonths: null, job: { created_at: createdAt, invoices: [...bills] } })
    expect(win.lastMonth).toBe(month)
    expect(Boolean(win.fromBill)).toBe(source === 'bill')
  })
})
