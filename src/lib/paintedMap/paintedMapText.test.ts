/**
 * Text it… (punch list #345): who is offered the press, why a map on no job has none, and the
 * words the customer's box opens with.
 */
import { describe, expect, it } from 'vitest'
import { PAINTED_MAP_TEXT_WORDS, paintedMapTextDoor, paintedMapTextJob, paintedMapTextWords } from './paintedMapText'

describe('paintedMapTextDoor', () => {
  it('offers the press to the office on a map that is on a job', () => {
    expect(paintedMapTextDoor({ office: true, jobId: 'job-1' })).toEqual({ kind: 'offered', jobId: 'job-1' })
  })

  it('says why there is no press on a map that is on no job', () => {
    expect(paintedMapTextDoor({ office: true, jobId: null })).toEqual({ kind: 'no-job', words: PAINTED_MAP_TEXT_WORDS.noJob })
    expect(paintedMapTextDoor({ office: true, jobId: '  ' })).toEqual({ kind: 'no-job', words: PAINTED_MAP_TEXT_WORDS.noJob })
    expect(paintedMapTextDoor({ office: true, jobId: undefined }).kind).toBe('no-job')
  })

  it('draws nothing for anyone outside the office, on a job or not', () => {
    expect(paintedMapTextDoor({ office: false, jobId: 'job-1' })).toEqual({ kind: 'hidden' })
    expect(paintedMapTextDoor({ office: false, jobId: null })).toEqual({ kind: 'hidden' })
  })
})

describe('paintedMapTextWords', () => {
  it('names the map and ends on the link, so a phone makes it a press', () => {
    expect(paintedMapTextWords('The way in for deliveries', 'https://example.test/way/q7m2kd4x9p')).toBe('Here is a map for you, The way in for deliveries. Open it here: https://example.test/way/q7m2kd4x9p')
  })

  it('tidies the name and stands without one', () => {
    expect(paintedMapTextWords('  The   back gate ', 'https://x.test/way/a')).toBe('Here is a map for you, The back gate. Open it here: https://x.test/way/a')
    expect(paintedMapTextWords('', 'https://x.test/way/a')).toBe('Here is a map for you. Open it here: https://x.test/way/a')
    expect(paintedMapTextWords(null, 'https://x.test/way/a')).toBe('Here is a map for you. Open it here: https://x.test/way/a')
  })
})

describe('paintedMapTextJob', () => {
  it('names the job as the customer’s box does: its name, else its number, else this job', () => {
    expect(paintedMapTextJob({ id: 'j', job_name: ' Oak Street ', hcp_number: '512', status: 'working', customer_id: 'c' })).toEqual({ id: 'j', name: 'Oak Street', status: 'working', customerId: 'c' })
    expect(paintedMapTextJob({ id: 'j', job_name: '', hcp_number: ' 512 ' }).name).toBe('Job 512')
    expect(paintedMapTextJob({ id: 'j' })).toEqual({ id: 'j', name: 'this job', status: null, customerId: null })
  })
})
