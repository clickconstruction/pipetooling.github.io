import { describe, expect, it } from 'vitest'
import { BUSINESS_RECORDS_FORM, BUSINESS_RECORDS_PREFACE, BUSINESS_RECORDS_SERVICE_WORDS, businessRecordsBody, businessRecordsParagraphs, businessRecordsRole, businessRecordsTitle } from './businessRecords'
import { plainWordsFailures } from '../plainWords'

describe('the business-records affidavit (punch list #220, v2.6213)', () => {
  it('holds Rule 902(10)(B) word for word, from the Supreme Court’s order of August 19, 2014', () => {
    expect(BUSINESS_RECORDS_PREFACE).toBe('An affidavit is sufficient if it includes the following language, but this form is not exclusive. The proponent may use an unsworn declaration made under penalty of perjury in place of an affidavit.')
    expect(BUSINESS_RECORDS_FORM).toEqual([
      'I am the custodian of records [or I am an employee or owner] of __________ and am familiar with the manner in which its records are created and maintained by virtue of my duties and responsibilities.',
      'Attached are ____ pages of records. These are the original records or exact duplicates of the original records.',
      'The records were made at or near the time of each act, event, condition, opinion, or diagnosis set forth. [or It is the regular practice of __________ to make this type of record at or near the time of each act, event, condition, opinion, or diagnosis set forth in the record.]',
      'The records were made by, or from information transmitted by, persons with knowledge of the matters set forth. [or It is the regular practice of __________ for this type of record to be made by, or from information transmitted by, persons with knowledge of the matters set forth in them.]',
      'The records were kept in the course of regularly conducted business activity. [or It is the regular practice of __________ to keep this type of record in the course of regularly conducted business activity.]',
      'It is the regular practice of the business activity to make the records.',
    ])
    expect(plainWordsFailures(BUSINESS_RECORDS_SERVICE_WORDS)).toEqual([])
  })
  it('fills the company, the standing, the pages and the records into the plain reading of the six paragraphs', () => {
    const p = businessRecordsParagraphs({ pages: 14, records: ['Final invoice 891', 'The clock for job 891', 'The job thread'], standing: 'custodian' })
    expect(p).toEqual([
      'I am the custodian of records of Click Plumbing and Electrical and am familiar with the manner in which its records are created and maintained by virtue of my duties and responsibilities.',
      'Attached are 14 pages of records. These are the original records or exact duplicates of the original records.',
      'The records attached are: Final invoice 891; The clock for job 891; The job thread.',
      'The records were made at or near the time of each act, event, condition, opinion, or diagnosis set forth.',
      'The records were made by, or from information transmitted by, persons with knowledge of the matters set forth.',
      'The records were kept in the course of regularly conducted business activity.',
      'It is the regular practice of the business activity to make the records.',
    ])
    // Each plain paragraph is the rule's own sentence with its blank filled and its bracketed alternative left off, so the words a court reads are the rule's.
    expect(p[0]).toBe(BUSINESS_RECORDS_FORM[0]!.replace('[or I am an employee or owner] ', '').replace('__________', 'Click Plumbing and Electrical'))
    expect(p[1]).toBe(BUSINESS_RECORDS_FORM[1]!.replace('____', '14'))
    expect(p[3]).toBe(BUSINESS_RECORDS_FORM[2]!.split(' [or')[0])
    expect(p[4]).toBe(BUSINESS_RECORDS_FORM[3]!.split(' [or')[0])
    expect(p[5]).toBe(BUSINESS_RECORDS_FORM[4]!.split(' [or')[0])
    expect(p[6]).toBe(BUSINESS_RECORDS_FORM[5])
    const q = businessRecordsParagraphs({ pages: null, records: [], standing: 'owner', company: ' Click ' })
    expect(q[0]).toBe('I am an owner of Click and am familiar with the manner in which its records are created and maintained by virtue of my duties and responsibilities.')
    expect(q[1]).toBe('Attached are ____ pages of records. These are the original records or exact duplicates of the original records.')
    expect(q).toHaveLength(6)
    expect(businessRecordsBody({ pages: null, records: [], standing: 'employee' }).split('\n')).toHaveLength(6)
  })
  it('names the paper and the role', () => {
    expect(businessRecordsTitle('Grace Lee', 'notary')).toBe('Business Records Affidavit of Grace Lee')
    expect(businessRecordsTitle('', 'declaration')).toBe('Business Records Declaration')
    expect(businessRecordsRole('custodian')).toBe('custodian of records for Click Plumbing and Electrical')
    expect(businessRecordsRole('employee')).toBe('an employee of Click Plumbing and Electrical')
  })
})
