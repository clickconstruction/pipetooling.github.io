import { describe, expect, it } from 'vitest'
import { createJobForProjectHref, projectJobChipLabel } from './projectJobs'

describe('projectJobChipLabel', () => {
  it('is the job number, else the job’s name, else Job', () => {
    expect(projectJobChipLabel({ hcp_number: '978', job_name: 'Elm St rough' })).toBe('978')
    expect(projectJobChipLabel({ hcp_number: '', job_name: 'Elm St rough' })).toBe('Elm St rough')
    expect(projectJobChipLabel({ hcp_number: '', job_name: '' })).toBe('Job')
  })
})

describe('createJobForProjectHref', () => {
  it('opens the new-job form on the Stages tab with the project filled in', () => {
    expect(createJobForProjectHref('p-1')).toBe('/jobs?newJob=true&project=p-1&tab=stages')
  })
})
