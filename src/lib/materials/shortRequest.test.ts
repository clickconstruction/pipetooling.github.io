import { describe, expect, it } from 'vitest'
import { SHORT_MAX, shortAfterWords, shortLabel, shortPoEntries, shortRefusalWords, shortRequestRow, shortToast } from './shortRequest'

describe('shortRequest · the Short press as a tally request (punch list #209, v2.6742)', () => {
  it('writes the tally’s own row: the job, the part with its maker, the whole number, the presser', () => {
    expect(shortRequestRow({ jobId: 'j1', line: { partId: 'p1', partName: '3/4" copper 90', manufacturer: 'Nibco' }, n: 4.4, byUserId: 'u1' })).toEqual({
      job_id: 'j1',
      fixture_name: '3/4" copper 90 · Nibco',
      part_id: 'p1',
      quantity: 4,
      sequence_order: 0,
      created_by_user_id: 'u1',
    })
    // A typed name has no book part and no maker; the number is never under one.
    expect(shortRequestRow({ jobId: 'j1', line: { partId: null, partName: 'ZZ test elbow', manufacturer: null }, n: 0, byUserId: 'u1' })).toMatchObject({ fixture_name: 'ZZ test elbow', part_id: null, quantity: 1 })
  })

  it('a book part makes one purchase order entry; a typed name makes none', () => {
    expect(shortPoEntries({ part_id: 'p1', quantity: 4 })).toEqual([{ part_id: 'p1', quantity: 4 }])
    expect(shortPoEntries({ part_id: null, quantity: 4 })).toEqual([])
  })

  it('the words: the button with its count, the line under it, the toast for each outcome', () => {
    expect(shortLabel(4)).toBe('Ask the office for 4')
    expect(shortLabel(1)).toBe('Ask the office for 1')
    expect(shortAfterWords('A2', 8, 4)).toBe('A2 has 8. The office gets a request for 4 more.')
    expect(shortToast(4, 'ZZ test elbow', { kind: 'po' })).toBe('Asked the office for 4 more ZZ test elbow. A draft purchase order was made, and the request is on the job’s Parts tab.'.replace('’', "'"))
    expect(shortToast(4, 'ZZ test elbow', { kind: 'request' })).toBe("Asked the office for 4 more ZZ test elbow. The request is on the job's Parts tab.")
    expect(shortToast(4, 'ZZ test elbow', { kind: 'po-failed', reason: 'No service type available' })).toBe("Asked the office for 4 more ZZ test elbow. The request is on the job's Parts tab, but no purchase order was made: No service type available")
    expect(SHORT_MAX).toBe(9999)
  })

  it('a refusal by the table’s policy tells the crew what to say; any other reason stands as it is', () => {
    expect(shortRefusalWords('new row violates row-level security policy for table "jobs_tally_parts"', 4, 'ZZ test elbow')).toBe('Only the office can file a parts request on this job. Tell them: 4 more ZZ test elbow.')
    expect(shortRefusalWords('Failed to fetch', 4, 'ZZ test elbow')).toBe('Failed to fetch')
  })
})
