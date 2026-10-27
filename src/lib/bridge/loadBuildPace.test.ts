import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase, proxyFakeCalls } from '../../test/proxyFakeSupabase'
import { loadBuildPaceInputs } from './loadBuildPace'

// 01:30 UTC on Oct 27 is 8:30 PM on Oct 26 in Chicago, and every stamp here comes back as the UTC instant.
const TONIGHT = '2026-10-27T01:30:00+00:00'
const opts = { windowStart: '2026-09-28', todayYmd: '2026-10-26', officeJobLedgerId: null }

describe('loadBuildPaceInputs on the company calendar (v2.5978)', () => {
  it('reads tonight’s percent, report and new job as today, not tomorrow', async () => {
    const { db } = makeProxyFakeSupabase({
      jobs_ledger: [{ id: 'j1', job_name: 'Elm', hcp_number: '1842', click_number: null, revenue: 10_000, pct_complete: 60, status: 'working', created_at: TONIGHT, billing_only: false }],
      job_pct_events: [{ job_id: 'j1', pct: 60, changed_at: TONIGHT, source: 'hand' }],
      reports: [{ job_ledger_id: 'j1', created_at: TONIGHT, field_values: { 'How complete is the job?': '55' } }],
    })
    const input = await loadBuildPaceInputs(db, opts)
    expect(input.points).toEqual([
      { jobId: 'j1', atYmd: '2026-10-26', pct: 60, source: 'hand' },
      { jobId: 'j1', atYmd: '2026-10-26', pct: 55, source: 'report' },
    ])
    expect(input.openJobs.map((j) => j.createdYmd)).toEqual(['2026-10-26'])
  })

  it('counts the jobs sold in the window from midnight Central on its first day, in summer time and in winter time', async () => {
    const summer = makeProxyFakeSupabase({})
    await loadBuildPaceInputs(summer.db, opts)
    expect(proxyFakeCalls(summer.reads, 'jobs_ledger', 'gte')).toEqual([['created_at', '2026-09-28T05:00:00.000Z']])
    const winter = makeProxyFakeSupabase({})
    await loadBuildPaceInputs(winter.db, { ...opts, windowStart: '2026-12-07', todayYmd: '2027-01-04' })
    expect(proxyFakeCalls(winter.reads, 'jobs_ledger', 'gte')).toEqual([['created_at', '2026-12-07T06:00:00.000Z']])
  })
})
