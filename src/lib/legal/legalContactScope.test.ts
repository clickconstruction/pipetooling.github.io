/** Punch list #85, item 24: the firm reads the payer's contact log only about the matter's jobs or the account. */
import { describe, expect, it } from 'vitest'
import { contactGoesToCounsel, contactGoesWithShare, contactScopeNumbers, contactScopeOf, jobNumberOf, nonJobSpans, textNamesJob } from './legalContactScope'

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

/**
 * Punch list #85, the review's leftover: the rule read a job's number out of prose wherever the digits
 * stood alone. Most jobs carry three digits, so an area code, a street number or a count of days read
 * as a job. A number names a job only where it stands as one.
 */
describe('a number that is part of something else names no job', () => {
  const not = (n: string, texts: string[]) => {
    for (const t of texts) expect(textNamesJob(t, n), `${t} · ${n}`).toBe(false)
  }
  const yes = (n: string, texts: string[]) => {
    for (const t of texts) expect(textNamesJob(t, n), `${t} · ${n}`).toBe(true)
  }

  it('a phone number: the area code, the exchange, the last four, an extension', () => {
    not('512', ['Call (512) 555-0142', 'cell 512 555 0142', 'Office 512.555.0142', '1-512-555-0142'])
    not('555', ['Call (512) 555-0142', 'cell 512 555 0142', 'front desk 555-0142'])
    not('1042', ['cell 512 555 1042', 'Call (512) 555 1042', 'front desk ext 1042', 'Ext. 1042', 'extension #1042', 'the number ending in 1042', 'card ending 1042', 'last four 1042'])
  })

  it('a date or a year', () => {
    not('2026', ['Promised payment in 2026', 'Nov 2026', 'November 22, 2026', '11/22/2026', '2026-11-22', 'Since 2026 they have paid late', '2026'])
    not('1998', ['In business since 1998'])
  })

  it('a job whose number reads as a year is named with a marker', () => {
    yes('2026', ['job 2026 is still open', 'Re #2026', 'J2026 walkthrough', 'Invoice 2026-1 sent again', 'bill 2026-2'])
  })

  it('money', () => {
    not('500', ['Paid $ 500 today', 'Sent $500', 'offered 500 dollars', '500 bucks down', 'owes 1,500', 'owes 500.00', '500 USD'])
  })

  it('a street address', () => {
    not('1042', ['Meet at 1042 Main St', 'site is 1042 N Lamar Blvd', '1042 Shady Oak Dr, Austin', 'mail to 1042 East 6th Street'])
    not('512', ['512 Elm Ave is the owner’s address'])
  })

  it('a count of time or measure', () => {
    not('120', ['120 days past due', 'Now 120 days late', 'ran 120 ft of pipe', '120 hrs on site', 'called 120 times'])
    not('745', ['End 745 pm', 'Arrived 745 AM'])
    not('100', ['Paid 100% of the first draw', 'wants 100 percent released'])
  })

  it('a number labelled as another thing', () => {
    not('1042', ['Paid with check #1042', 'check no. 1042 bounced', 'ck 1042 cleared', 'PO 1042 covers it', 'P.O. #1042', 'Suite 1042', 'Unit 1042 leak', 'Lot 1042', 'permit 1042 closed', 'acct 1042', 'FM 1042 site'])
  })

  it('a longer run of digits', () => {
    not('1042', ['tracking 10425', 'ref 1042-2026', '512-1042-5555', '1042/7', '21042'])
  })
})

describe('a number that stands as a job’s number still names it', () => {
  it('beside the things that are not jobs', () => {
    for (const t of [
      'Pat said the 1042 balance goes out with the next draw.',
      'Called (512) 555-0142 about 1042.',
      'Paid $500 on 1042 with check #3381',
      '1042 is 120 days past due',
      'Walked 1042 at 77 Main St',
      'Please check 1042 and call back',
      'the 1042 fixtures are in',
      'Job 1042, PO 512',
      '1042 goes to small claims court next',
      '1042 is on the road to paid',
    ])
      expect(textNamesJob(t, '1042'), t).toBe(true)
  })

  it('a # holds a count or an address off, and the word job does not', () => {
    expect(textNamesJob('#512 days late', '512')).toBe(true)
    expect(textNamesJob('on the job 300 days now', '300')).toBe(false)
  })

  it('a Click number with letters is untouched by the spans', () => {
    expect(textNamesJob('C-219 is 90 days out', 'C-219')).toBe(true)
    expect(textNamesJob('C-219 days', 'C-219')).toBe(true)
  })
})

describe('nonJobSpans', () => {
  it('blanks the spans and keeps the length', () => {
    const t = 'Call (512) 555-0142 about 1042, 120 days late, check #3381'
    const out = nonJobSpans(t)
    expect(out.length).toBe(t.length)
    expect(out).toContain('about 1042,')
    expect(out).not.toMatch(/512|555|0142|120|3381/)
    expect(nonJobSpans(null)).toBe('')
  })
})

describe('the scope with the tighter rule', () => {
  const numbers = contactScopeNumbers([{ id: 'm1', hcp_number: '1042' }], [{ id: 'm1', hcp_number: '1042' }, { id: 'o1', hcp_number: '512' }, { id: 'o2', hcp_number: '120' }])

  it('an account entry with a phone, an address or a count goes; it was held back before', () => {
    expect(contactScopeOf('Left a message at (512) 555-0142. No reply.', numbers)).toBe('account')
    expect(contactScopeOf('Statement mailed to 512 Elm Ave.', numbers)).toBe('account')
    expect(contactScopeOf('Account is 120 days past due.', numbers)).toBe('account')
  })

  it('an entry that names another job still stays home', () => {
    expect(contactScopeOf('Walkthrough on 512', numbers)).toBe('other_job')
    expect(contactScopeOf('Job 120 punch list', numbers)).toBe('other_job')
    expect(contactGoesToCounsel('512 change order, call (512) 555-0142', numbers)).toBe(false)
  })

  it('an entry about another job no longer rides on a year or a phone that equals the matter’s number', () => {
    expect(contactScopeOf('512 walkthrough, call 512 555 1042', numbers)).toBe('other_job')
    expect(contactScopeOf('512 walkthrough, and the 1042 balance', numbers)).toBe('matter')
  })
})
