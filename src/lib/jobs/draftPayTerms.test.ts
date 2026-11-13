import { describe, expect, it } from 'vitest'
import {
  DRAFT_PAY_TERMS_SCOPE_DEFAULT,
  draftPayTermsDraftWords,
  draftPayTermsFromPayload,
  draftPayTermsFromWords,
  draftPayTermsLine,
  draftPayTermsOffered,
  draftPayTermsScopeHint,
  newJobPayTermsTail,
  parseDraftPayTerms,
  payTermsRequestTitle,
  type DraftPayTerms,
} from './draftPayTerms'
import type { PayCalendarSource } from './payCalendar'
import { isStagesOfficeRole } from './stagesRoleGates'
import { sendsJobDraft } from '../bids/wonMomentActions'

/** Every name and clause is made up. */
const CAL = { cutoffDay: 25, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '§ 5.2', words: 'Paid the 10th of the month after it is received.' }
const forJob: DraftPayTerms = { scope: 'job', calendar: CAL }
const forPayer: DraftPayTerms = { scope: 'payer', calendar: { ...CAL, cutoffDay: null, payDay: 30 } }

describe('pay terms on a job draft: the read', () => {
  it('reads back what was written', () => {
    expect(parseDraftPayTerms(JSON.parse(JSON.stringify(forJob)))).toEqual(forJob)
    expect(parseDraftPayTerms(JSON.parse(JSON.stringify(forPayer)))).toEqual(forPayer)
  })
  it('opens on this job, the smaller reach, and reads an unknown scope as this job', () => {
    expect(DRAFT_PAY_TERMS_SCOPE_DEFAULT).toBe('job')
    expect(parseDraftPayTerms({ scope: 'everyone', calendar: CAL })?.scope).toBe('job')
  })
  it('is nothing without a pay day a month can hold', () => {
    expect(parseDraftPayTerms(null)).toBeNull()
    expect(parseDraftPayTerms('terms')).toBeNull()
    expect(parseDraftPayTerms([forJob])).toBeNull()
    expect(parseDraftPayTerms({ scope: 'job' })).toBeNull()
    expect(parseDraftPayTerms({ scope: 'job', calendar: { payDay: 40 } })).toBeNull()
  })
  it('trims and bounds what was typed, as the calendar itself does', () => {
    const read = parseDraftPayTerms({ scope: 'payer', calendar: { payDay: 10, cutoffDay: 31, monthsAfter: 9, clause: '  § 5.2  ', words: 'x'.repeat(400) } })
    expect(read?.calendar).toMatchObject({ cutoffDay: null, monthsAfter: 1, clause: '§ 5.2' })
    expect(read?.calendar.words).toHaveLength(240)
  })
  it('finds terms sent on their own on a request', () => {
    expect(draftPayTermsFromPayload({ pay_terms: forJob })).toEqual(forJob)
    expect(draftPayTermsFromPayload({ job_draft: { payTerms: forJob } })).toBeNull()
    expect(draftPayTermsFromPayload(null)).toBeNull()
  })
})

describe('pay terms on a job draft: the words', () => {
  it('says the terms and whose they are in one line', () => {
    expect(draftPayTermsLine(forJob)).toBe('In by the 25th, paid the 10th · only this job')
    expect(draftPayTermsLine(forPayer)).toBe('In by month end, paid the 30th · every job they pay')
  })
  it('rides the draft’s words on the Dispatch row in lower case', () => {
    expect(draftPayTermsDraftWords(forJob)).toBe('pay terms: in by the 25th, paid the 10th, only this job')
  })
  it('explains each choice', () => {
    expect(draftPayTermsScopeHint('job')).toBe('This job’s contract says it.')
    expect(draftPayTermsScopeHint('payer')).toBe('Their standard subcontract says it, whatever the job.')
  })
  it('names who read them, or the draft when it cannot', () => {
    expect(draftPayTermsFromWords(' Dana Whitfield ')).toBe('Dana Whitfield’s draft')
    expect(draftPayTermsFromWords(null)).toBe('The draft')
  })
  it('titles the row for terms sent on their own, with the clause', () => {
    expect(payTermsRequestTitle(forJob, 'B412 Larkfield Medical Office')).toBe('Pay terms for B412 Larkfield Medical Office: in by the 25th, paid the 10th, only this job (§ 5.2)')
    expect(payTermsRequestTitle({ scope: 'payer', calendar: { ...CAL, clause: '' } }, ' ')).toBe('Pay terms for a won bid: in by the 25th, paid the 10th, every job they pay')
  })
  it('says what New Job holds once the office has agreed', () => {
    expect(newJobPayTermsTail({ kind: 'offered' }, 'Larkfield Construction')).toBeNull()
    expect(newJobPayTermsTail({ kind: 'with-job', calendar: CAL }, 'Larkfield Construction')).toBe('sets with the job')
    expect(newJobPayTermsTail({ kind: 'payer-saved' }, 'Larkfield Construction')).toBe('set for every job Larkfield Construction pays')
  })
})

describe('when a job still offers its draft’s terms', () => {
  const SOURCES: PayCalendarSource[] = ['none', 'payer', 'job', 'off']
  it('for this job: until the job carries a row of its own, a calendar or its off switch', () => {
    expect(SOURCES.map((from) => draftPayTermsOffered(forJob, from))).toEqual([true, true, false, false])
  })
  it('for the payer: only while the bill reads no calendar at all', () => {
    expect(SOURCES.map((from) => draftPayTermsOffered(forPayer, from))).toEqual([true, false, false, false])
  })
  it('offers nothing with no terms', () => {
    expect(SOURCES.some((from) => draftPayTermsOffered(null, from))).toBe(false)
  })
})

describe('who writes the terms down and who makes them the calendar, role by role', () => {
  // The estimator reads the contract and sends the terms. The roles that set a calendar (`set_payer_pay_calendar`
  // behind `can_write_payment_promises()`) check them and save. No role does both, and no gate is widened.
  const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', null] as const
  it('pins each role', () => {
    const matrix = Object.fromEntries(ROLES.map((role) => [String(role), { sendsTerms: sendsJobDraft(role), setsCalendar: isStagesOfficeRole(role) }]))
    expect(matrix).toEqual({
      dev: { sendsTerms: false, setsCalendar: true },
      master_technician: { sendsTerms: false, setsCalendar: true },
      assistant: { sendsTerms: false, setsCalendar: true },
      controller: { sendsTerms: false, setsCalendar: true },
      estimator: { sendsTerms: true, setsCalendar: false },
      primary: { sendsTerms: false, setsCalendar: false },
      superintendent: { sendsTerms: false, setsCalendar: false },
      subcontractor: { sendsTerms: false, setsCalendar: false },
      helpers: { sendsTerms: false, setsCalendar: false },
      null: { sendsTerms: false, setsCalendar: false },
    })
  })
})
