import { describe, expect, it } from 'vitest'
import { mergeJobsOpened } from './bidJobsOpenedIo'

describe('mergeJobsOpened: the definer read and the table read as one list', () => {
  it('one entry per job, newest first, numbered HCP else C#', () => {
    const rows = [
      { bid_id: 'b166', job_id: 'j878', hcp_number: '878', click_number: null, job_name: 'Take 5- Seguin', created_at: '2026-06-25T18:35:03Z' },
      { bid_id: 'b166', id: 'j878', hcp_number: '878', job_name: 'Take 5- Seguin', created_at: '2026-06-25T18:35:03Z' },
      { bid_id: 'b375', job_id: 'j1007', hcp_number: '', click_number: '1007', job_name: 'SPACEX', created_at: '2026-09-01T10:00:00Z' },
    ]
    expect(mergeJobsOpened(rows)).toEqual([
      { bidId: 'b375', jobId: 'j1007', hcpNumber: '1007', jobName: 'SPACEX', createdAt: '2026-09-01T10:00:00Z' },
      { bidId: 'b166', jobId: 'j878', hcpNumber: '878', jobName: 'Take 5- Seguin', createdAt: '2026-06-25T18:35:03Z' },
    ])
  })
  it('a row with no job or no bid is dropped', () => {
    expect(mergeJobsOpened([{ bid_id: null, job_id: 'j', hcp_number: '1', job_name: null, created_at: null }])).toEqual([])
  })
})
