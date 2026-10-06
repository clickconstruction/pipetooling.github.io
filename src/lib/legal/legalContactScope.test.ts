/** Punch list #85, item 24: the firm reads the payer's contact log only about the matter's jobs or the account. */
import { describe, expect, it } from 'vitest'
import { contactGoesToCounsel, contactGoesWithShare, contactScopeNumbers, contactScopeOf, jobNumberOf, textNamesJob } from './legalContactScope'

const matterJobs = [{ id: 'm1', hcp_number: '1042', click_number: '' }]
const payerJobs = [...matterJobs, { id: 'o1', hcp_number: '1057', click_number: '' }, { id: 'o2', hcp_number: '', click_number: 'C-219' }, { id: 'o3', hcp_number: '12', click_number: '' }]
const numbers = contactScopeNumbers(matterJobs, payerJobs)

describe('jobNumberOf and contactScopeNumbers', () => {
  it('reads HCP first, else Click, and drops numbers too short to mean a job', () => {
    expect(jobNumberOf({ hcp_number: ' 1042 ', click_number: 'C-1' })).toBe('1042')
    expect(jobNumberOf({ hcp_number: '', click_number: 'C-219' })).toBe('c-219')
    expect([...numbers.matter]).toEqual(['1042'])
    expect([...numbers.other].sort()).toEqual(['1057', 'c-219'])
  })

  it('counts a number shared with a matter job as the matter’s', () => {
    const n = contactScopeNumbers([{ id: 'a', hcp_number: '500' }], [{ id: 'a', hcp_number: '500' }, { id: 'b', hcp_number: '500' }])
    expect([...n.other]).toEqual([])
  })
})

describe('textNamesJob', () => {
  it('finds the number standing alone, after # or J, or after the word job', () => {
    for (const t of ['Called about 1042.', 'Re #1042: no answer', 'J1042 still open', 'job 1042, Pat promised Friday', '1042']) expect(textNamesJob(t, '1042')).toBe(true)
  })

  it('does not find it inside money, decimals, dates, phones or longer numbers', () => {
    for (const t of ['Sent $1042 by check', 'Owes 1042.50', 'Call 512-555-1042', 'Lot 10425', 'Invoice A1042', 'ref 1042/7']) expect(textNamesJob(t, '1042')).toBe(false)
  })
})

describe('contactScopeOf', () => {
  it('sends entries about the matter’s job and about the account; keeps entries about other jobs home', () => {
    expect(contactScopeOf('Pat said the 1042 balance goes out with the next draw.', numbers)).toBe('matter')
    expect(contactScopeOf('Statement re-sent. No reply.', numbers)).toBe('account')
    expect(contactScopeOf('Bid follow-up on the dental job, 1057 pricing.', numbers)).toBe('other_job')
    expect(contactScopeOf('Asked about C-219 punch list', numbers)).toBe('other_job')
    expect(contactGoesToCounsel('Asked about 1057 and 1042 together', numbers)).toBe(true)
    expect(contactGoesToCounsel('Walkthrough on 1057', numbers)).toBe(false)
    expect(contactGoesToCounsel(null, numbers)).toBe(true)
  })

  it('never reads a two-digit number as a job', () => {
    expect(contactScopeOf('12 fixtures left on the punch list', numbers)).toBe('account')
  })
})

describe('a bill of the job, and job# (review)', () => {
  it('counts Invoice 1042-1, #1042-2 and job#1042 as naming job 1042', () => {
    for (const t of ['Sent Invoice 1042-1 again', 'Asked about #1042-2', 'job#1042 is still open', 'Re: 1042-12 retainage']) expect(textNamesJob(t, '1042'), t).toBe(true)
  })
  it('still refuses a longer number or a date run on with a dash', () => {
    for (const t of ['call 512-1042-5555', 'ref 1042-2026', 'po 1042-123']) expect(textNamesJob(t, '1042'), t).toBe(false)
  })
})

describe('contactGoesWithShare · an explicit share wins', () => {
  const numbers = contactScopeNumbers([{ id: 'm1', hcp_number: '1042' }], [{ id: 'o1', hcp_number: '2077' }])
  it('sends an entry about another job when the office shared it by hand, and holds it otherwise', () => {
    expect(contactGoesWithShare('Called about 2077', numbers, false)).toBe(true)
    expect(contactGoesWithShare('Called about 2077', numbers, undefined)).toBe(false)
    expect(contactGoesWithShare('Called about 2077', numbers, true)).toBe(false)
    expect(contactGoesWithShare('Called about 1042-1', numbers, undefined)).toBe(true)
  })
})
