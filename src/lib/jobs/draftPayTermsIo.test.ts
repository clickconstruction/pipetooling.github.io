import { describe, expect, it } from 'vitest'
import { PAY_TERMS_FROM_BID_ACTION, payTermsOnRequest } from './draftPayTermsIo'
import { OPEN_JOB_FROM_BID_ACTION } from '../bids/wonDispatchHandoff'

/** Every name is made up. */
const terms = { scope: 'job' as const, calendar: { cutoffDay: 25, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' } }
const draft = { v: 1, jobName: 'Larkfield Medical Office', address: '2200 Canal Street', gcKey: '', gcName: 'Larkfield Construction', carry: null, serviceTypeId: null, wantedBy: null, note: null }

describe('the pay terms a Dispatch request carries (punch list #323)', () => {
  it('reads them inside a won bid’s job draft', () => {
    expect(payTermsOnRequest({ pending_action: OPEN_JOB_FROM_BID_ACTION, pending_payload: { job_draft: { ...draft, payTerms: terms } } })).toEqual(terms)
  })
  it('reads them on a request that carries terms alone', () => {
    expect(payTermsOnRequest({ pending_action: PAY_TERMS_FROM_BID_ACTION, pending_payload: { pay_terms: terms } })).toEqual(terms)
  })
  it('finds none on a draft without them, or on any other request', () => {
    expect(payTermsOnRequest({ pending_action: OPEN_JOB_FROM_BID_ACTION, pending_payload: { job_draft: draft } })).toBeNull()
    expect(payTermsOnRequest({ pending_action: OPEN_JOB_FROM_BID_ACTION, pending_payload: null })).toBeNull()
    expect(payTermsOnRequest({ pending_action: 'stage_check', pending_payload: { pay_terms: terms } })).toBeNull()
    expect(payTermsOnRequest({ pending_action: null, pending_payload: { pay_terms: terms } })).toBeNull()
  })
})
