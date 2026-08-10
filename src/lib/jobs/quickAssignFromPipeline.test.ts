import { describe, expect, it } from 'vitest'
import { jobWithDetailsToQuickAssignHubRow } from './quickAssignFromPipeline'
import type { JobWithDetails } from '../../types/jobWithDetails'

function baseJob(overrides: Partial<JobWithDetails> = {}): JobWithDetails {
  return {
    id: 'job-1',
    hcp_number: '951',
    click_number: 'JP951',
    job_name: 'Shearer Pinpoint',
    project_id: null,
    created_at: '2026-08-07T15:00:00Z',
    job_address: '717 Trinity St, Lockhart, TX',
    customer_name: 'Laura Shearer',
    status: 'working',
    materials: [],
    fixtures: [],
    payments: [],
    invoices: [],
    team_members: [],
    ...overrides,
  } as unknown as JobWithDetails
}

describe('jobWithDetailsToQuickAssignHubRow', () => {
  it('maps the board row fields the sheet header and picker use', () => {
    const row = jobWithDetailsToQuickAssignHubRow(
      baseJob({ serviceType: { name: 'Plumbing' } } as Partial<JobWithDetails>),
    )
    expect(row).toEqual({
      id: 'job-1',
      hcp_number: '951',
      click_number: 'JP951',
      job_name: 'Shearer Pinpoint',
      project_id: null,
      created_at: '2026-08-07T15:00:00Z',
      job_address: '717 Trinity St, Lockhart, TX',
      customer_name: 'Laura Shearer',
      status: 'working',
      service_type: { name: 'Plumbing' },
    })
  })

  it('drops the service_type embed when the row has no usable name', () => {
    expect(jobWithDetailsToQuickAssignHubRow(baseJob()).service_type).toBeNull()
    expect(
      jobWithDetailsToQuickAssignHubRow(baseJob({ serviceType: { name: '  ' } } as Partial<JobWithDetails>))
        .service_type,
    ).toBeNull()
  })

  it('normalizes missing optional fields to null', () => {
    const row = jobWithDetailsToQuickAssignHubRow(
      baseJob({
        customer_name: null,
        created_at: undefined,
        job_address: undefined,
        status: undefined,
      } as Partial<JobWithDetails>),
    )
    expect(row.customer_name).toBeNull()
    expect(row.created_at).toBeNull()
    expect(row.job_address).toBeNull()
    expect(row.status).toBeNull()
  })
})
