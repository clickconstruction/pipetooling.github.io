import { describe, expect, it } from 'vitest'
import { subLaborSheetsByJobId } from './subLaborByJobId'

const sheet = (id: string, jobLedgerId: string | null | undefined, jobNumber: string | null) => ({ id, job_ledger_id: jobLedgerId, job_number: jobNumber })

describe('subLaborSheetsByJobId', () => {
  it('groups sheets by their job link, not the number they display', () => {
    const byJob = subLaborSheetsByJobId([
      sheet('s1', 'job-a', '812'),
      sheet('s2', 'job-a', '812'),
      // Renumbered job: the sheet still says 700, the link still says job-b.
      sheet('s3', 'job-b', '700'),
      // Hand-linked sheet whose typed number is someone else's.
      sheet('s4', 'job-c', '812'),
    ])
    expect(byJob.get('job-a')?.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(byJob.get('job-b')?.map((s) => s.id)).toEqual(['s3'])
    expect(byJob.get('job-c')?.map((s) => s.id)).toEqual(['s4'])
  })

  it('a job with no HCP number still gets its sheets (a click-number-only job)', () => {
    expect(subLaborSheetsByJobId([sheet('s1', 'job-click', '')]).get('job-click')?.map((s) => s.id)).toEqual(['s1'])
  })

  it('an unlinked sheet belongs to no job', () => {
    const byJob = subLaborSheetsByJobId([sheet('s1', null, '812'), sheet('s2', undefined, '812')])
    expect(byJob.size).toBe(0)
  })
})
