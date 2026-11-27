// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { JOB_ACTIVITY_CHANGED_EVENT, announceJobActivityChanged, jobActivityChangedJobId, onJobActivityChanged } from './jobActivityChanged'

describe('a job’s Activity lines were taken off', () => {
  it('a listener hears the job that was named', () => {
    const heard: string[] = []
    const stop = onJobActivityChanged((id) => heard.push(id))
    announceJobActivityChanged('job-1')
    announceJobActivityChanged('job-2')
    expect(heard).toEqual(['job-1', 'job-2'])
    stop()
  })

  it('hears nothing once it has stopped', () => {
    const heard: string[] = []
    const stop = onJobActivityChanged((id) => heard.push(id))
    stop()
    announceJobActivityChanged('job-1')
    expect(heard).toEqual([])
  })

  it('says nothing for no job, and a listener is not called for an event that names none', () => {
    const heard: string[] = []
    const stop = onJobActivityChanged((id) => heard.push(id))
    announceJobActivityChanged('')
    window.dispatchEvent(new CustomEvent(JOB_ACTIVITY_CHANGED_EVENT))
    window.dispatchEvent(new CustomEvent(JOB_ACTIVITY_CHANGED_EVENT, { detail: { jobId: 'job-1' } }))
    expect(heard).toEqual([])
    stop()
  })

  it('reads the job off an event', () => {
    expect(jobActivityChangedJobId(new CustomEvent(JOB_ACTIVITY_CHANGED_EVENT, { detail: 'job-9' }))).toBe('job-9')
    expect(jobActivityChangedJobId(new CustomEvent(JOB_ACTIVITY_CHANGED_EVENT, { detail: 9 }))).toBeNull()
    expect(jobActivityChangedJobId(new Event(JOB_ACTIVITY_CHANGED_EVENT))).toBeNull()
  })
})
