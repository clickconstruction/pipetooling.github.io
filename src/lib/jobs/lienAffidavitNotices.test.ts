import { describe, expect, it } from 'vitest'
import { lienAffidavitMethodWords, lienAffidavitMonthsInSpan, lienAffidavitNoticeMonths, lienAffidavitNoticesWords, lienAffidavitOwnerSends } from './lienAffidavitNotices'

const send = (recipient: string, sent_on: string, method = 'certified_mail') => ({ recipient, method, tracking: '9407', sent_on })
const notice = (months: string[], sends: unknown, over: Record<string, unknown> = {}) => ({ kind: 'notice_53_056', months_covered: months, sends, voided_at: null, ...over })

describe('lienAffidavitNoticeMonths · the months the recorded notices name', () => {
  it('each month once, oldest first, across every notice on the job', () => {
    expect(lienAffidavitNoticeMonths([notice(['2026-06', '2026-08'], []), notice(['2026-04', '2026-06', '2026-07'], [])])).toEqual(['2026-04', '2026-06', '2026-07', '2026-08'])
  })

  it('a voided notice, another kind of filing and a malformed month are not read', () => {
    expect(lienAffidavitNoticeMonths([notice(['2026-06'], [], { voided_at: '2026-09-02T17:00:00Z' }), notice(['2026-07'], [], { kind: 'retainage_53_057' }), notice(['2026-08'], [], { kind: 'affidavit' }), notice(['August'], [])])).toEqual([])
    expect(lienAffidavitNoticeMonths(null)).toEqual([])
    expect(lienAffidavitNoticeMonths([notice(null as never, [])])).toEqual([])
  })
})

describe('lienAffidavitMonthsInSpan · the noticed months that are this job’s own', () => {
  // One paper mailed for several jobs at a property stores its months on every job's row.
  const paper = ['2026-04', '2026-06', '2026-07', '2026-08']

  it('a ticket worked in August keeps August and leaves the paper’s other months off', () => {
    expect(lienAffidavitMonthsInSpan(paper, '2026-08-01', '2026-08-31')).toEqual(['2026-08'])
  })

  it('a job worked April through August keeps every noticed month in that span', () => {
    expect(lienAffidavitMonthsInSpan(paper, '2026-04-02', '2026-08-11')).toEqual(paper)
    expect(lienAffidavitMonthsInSpan(paper, '2026-06-15', '2026-07-03')).toEqual(['2026-06', '2026-07'])
  })

  it('a span that reaches no noticed month names none, so the paper prints its blank', () => {
    expect(lienAffidavitMonthsInSpan(paper, '2026-09-01', '2026-09-30')).toEqual([])
  })

  it('a side with no day known is left open', () => {
    expect(lienAffidavitMonthsInSpan(paper, '', '2026-06-30')).toEqual(['2026-04', '2026-06'])
    expect(lienAffidavitMonthsInSpan(paper, '2026-07-01', null)).toEqual(['2026-07', '2026-08'])
    expect(lienAffidavitMonthsInSpan(paper, '', '')).toEqual(paper)
  })
})

describe('lienAffidavitOwnerSends · the day and method of each notice to the owner', () => {
  it('reads the owner’s send alone, oldest first; the copy to the original contractor is not the owner’s notice', () => {
    const filings = [notice(['2026-08'], [send('owner', '2026-10-14'), send('original_contractor', '2026-10-15')]), notice(['2026-07'], [send('owner', '2026-09-22')])]
    expect(lienAffidavitOwnerSends(filings)).toEqual([
      { method: 'certified_mail', sentOn: '2026-09-22' },
      { method: 'certified_mail', sentOn: '2026-10-14' },
    ])
  })

  it('one envelope that carried two notices counts once', () => {
    expect(lienAffidavitOwnerSends([notice(['2026-07'], [send('owner', '2026-10-14')]), notice(['2026-08'], [send('owner', '2026-10-14')])])).toEqual([{ method: 'certified_mail', sentOn: '2026-10-14' }])
  })

  it('a send with no day, a voided notice and sends that are not a list add nothing', () => {
    expect(lienAffidavitOwnerSends([notice(['2026-07'], [{ recipient: 'owner', method: 'certified_mail' }]), notice(['2026-07'], [send('owner', '2026-09-01')], { voided_at: '2026-09-02T17:00:00Z' }), notice(['2026-07'], null), notice(['2026-07'], 'certified'), notice(['2026-07'], [null, 'x'])])).toEqual([])
  })
})

describe('lienAffidavitNoticesWords · what follows “sent to the owner by”', () => {
  it('one notice, then several by the same method', () => {
    expect(lienAffidavitNoticesWords([{ method: 'certified_mail', sentOn: '2026-08-14' }])).toBe('certified mail on August 14, 2026')
    expect(lienAffidavitNoticesWords([{ method: 'certified_mail', sentOn: '2026-08-14' }, { method: 'certified_mail', sentOn: '2026-09-11' }])).toBe('certified mail on August 14, 2026 and September 11, 2026')
    expect(lienAffidavitNoticesWords([{ method: 'certified_mail', sentOn: '2026-08-14' }, { method: 'certified_mail', sentOn: '2026-09-11' }, { method: 'certified_mail', sentOn: '2026-10-14' }])).toBe('certified mail on August 14, 2026, September 11, 2026 and October 14, 2026')
  })

  it('a second method starts its own run', () => {
    expect(lienAffidavitNoticesWords([{ method: 'certified_mail', sentOn: '2026-08-14' }, { method: 'hand', sentOn: '2026-09-11' }])).toBe('certified mail on August 14, 2026, and by hand delivery on September 11, 2026')
  })

  it('nothing on record is no words: the paper prints its blank', () => {
    expect(lienAffidavitNoticesWords([])).toBe('')
  })

  it('names each method in plain words, and an unknown one as it was recorded', () => {
    expect(lienAffidavitMethodWords('certified_mail')).toBe('certified mail')
    expect(lienAffidavitMethodWords('traceable_courier')).toBe('a delivery service that confirms receipt')
    expect(lienAffidavitMethodWords('hand')).toBe('hand delivery')
    expect(lienAffidavitMethodWords('email')).toBe('email')
    expect(lienAffidavitMethodWords('registered_mail')).toBe('registered mail')
    expect(lienAffidavitMethodWords('')).toBe('a method not recorded')
  })
})
