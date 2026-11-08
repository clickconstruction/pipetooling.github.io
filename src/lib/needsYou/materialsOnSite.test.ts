import { describe, expect, it } from 'vitest'
import { materialsNeeds, materialsNeedsHref } from './materialsOnSite'

describe('materialsNeeds · the Needs you card’s two facts across jobs (punch list #209)', () => {
  it('sums the boxes due and the week’s shortfalls, counting only the jobs that have some', () => {
    const n = materialsNeeds([
      { jobId: 'j1', stale: 3, missingLines: 2, missingMoneyWeek: 410 },
      { jobId: 'j2', stale: 0, missingLines: 1, missingMoneyWeek: 0 },
      { jobId: 'j3', stale: 1, missingLines: 0, missingMoneyWeek: 0 },
    ])
    expect(n).toEqual({ staleBoxes: 4, staleJobs: 2, staleJobId: null, missingLines: 3, missingMoneyWeek: 410, missingJobs: 2, missingJobId: null })
  })

  it('names the job when one job holds every box due or every shortfall, so the door lands on it', () => {
    const n = materialsNeeds([
      { jobId: 'j1', stale: 0, missingLines: 2, missingMoneyWeek: 410 },
      { jobId: 'j2', stale: 5, missingLines: 0, missingMoneyWeek: 0 },
    ])
    expect(n.staleJobId).toBe('j2')
    expect(n.missingJobId).toBe('j1')
  })

  it('a job with lines short and no price still counts as missing, with no money', () => {
    const n = materialsNeeds([{ jobId: 'j1', stale: 0, missingLines: 2, missingMoneyWeek: 0 }])
    expect(n).toMatchObject({ missingLines: 2, missingMoneyWeek: 0, missingJobs: 1, missingJobId: 'j1' })
  })

  it('reads nothing from no jobs', () => {
    expect(materialsNeeds([])).toEqual({ staleBoxes: 0, staleJobs: 0, staleJobId: null, missingLines: 0, missingMoneyWeek: 0, missingJobs: 0, missingJobId: null })
  })

  it('the door is the desk, or the one job’s page', () => {
    expect(materialsNeedsHref(null)).toBe('/jobs?tab=materials')
    expect(materialsNeedsHref('j1')).toBe('/jobs?tab=materials&job=j1')
  })
})
