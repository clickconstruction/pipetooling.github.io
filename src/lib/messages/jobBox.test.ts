import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { JOB_BOX_KINDS, JOB_MODE_MESSAGES_ON, jobBoxJobKey, jobBoxJobName, jobBoxOffered, jobModeMessagesOffered, NO_CUSTOMER_WORDS } from './jobBox'

describe('the box in a job’s window', () => {
  it('offers Note, Text and Email in that order', () => {
    expect(JOB_BOX_KINDS.map((k) => k.label)).toEqual(['Note', 'Text', 'Email'])
  })

  it('offers Text and Email to the office team only', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) expect(jobBoxOffered(role)).toBe(true)
    for (const role of ['primary', 'helpers', 'superintendent', 'subcontractor'] as const) expect(jobBoxOffered(role)).toBe(false)
    expect(jobBoxOffered(null)).toBe(false)
  })

  it('offers Job Mode’s Message the customer to the tech’s door only, and only while it is switched on', () => {
    expect(JOB_MODE_MESSAGES_ON).toBe(true)
    for (const role of ['primary', 'helpers'] as const) {
      expect(jobModeMessagesOffered(role)).toBe(true)
      expect(jobModeMessagesOffered(role, false)).toBe(false)
    }
    for (const role of ['dev', 'master_technician', 'assistant', 'superintendent', 'subcontractor'] as const) expect(jobModeMessagesOffered(role, true)).toBe(false)
    expect(jobModeMessagesOffered(null, true)).toBe(false)
  })

  it('ties a reply to the Pipeline job, as the thread keys it', () => {
    expect(jobBoxJobKey('j-helotes')).toBe('pipeline:j-helotes')
  })

  it('names the job by its name, else its number', () => {
    expect(jobBoxJobName({ job_name: ' Helotes ', hcp_number: '1044' })).toBe('Helotes')
    expect(jobBoxJobName({ job_name: '', hcp_number: '1044' })).toBe('Job 1044')
    expect(jobBoxJobName({})).toBe('this job')
  })

  it('every sentence a person reads passes plain words', () => {
    expect([NO_CUSTOMER_WORDS, ...JOB_BOX_KINDS.map((k) => k.tip)].flatMap(plainWordsFailures)).toEqual([])
  })
})
