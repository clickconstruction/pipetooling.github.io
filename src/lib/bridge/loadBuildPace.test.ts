import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase, proxyFakeCalls } from '../../test/proxyFakeSupabase'
import { loadBuildPaceInputs } from './loadBuildPace'

// 01:30 UTC on Oct 27 is 8:30 PM on Oct 26 in Chicago, and every stamp here comes back as the UTC instant.
const TONIGHT = '2026-10-27T01:30:00+00:00'
const opts = { windowStart: '2026-09-28', todayYmd: '2026-10-26', officeJobLedgerId: null, zzTestJobIds: null }

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

describe('loadBuildPaceInputs leaves ZZ test jobs out (v2.6813)', () => {
  const job = (id: string, jobName: string, customerName: string, status: string) => ({ id, job_name: jobName, customer_name: customerName, hcp_number: null, click_number: null, revenue: 10_000, pct_complete: 50, status, created_at: '2026-10-20T15:00:00+00:00', billing_only: false })
  const rows = {
    // The fake hands every jobs_ledger read the same rows: the open jobs, the jobs created and the jobs the points touch.
    jobs_ledger: [job('real', 'Elm', 'Ann Lee', 'working'), job('zzById', 'Renamed since', 'Ann Lee', 'working'), job('zzByName', 'ZZ TEST walk', 'Robert Test', 'working'), job('zzByCustomer', 'Walk through', 'ZZ Test Customer', 'waiting')],
    job_pct_events: [
      { job_id: 'real', pct: 50, changed_at: '2026-10-20T15:00:00+00:00', source: 'hand' },
      { job_id: 'zzById', pct: 50, changed_at: '2026-10-20T15:00:00+00:00', source: 'hand' },
      { job_id: 'zzByName', pct: 50, changed_at: '2026-10-20T15:00:00+00:00', source: 'hand' },
    ],
    reports: [{ job_ledger_id: 'zzByCustomer', created_at: '2026-10-21T15:00:00+00:00', field_values: { 'How complete is the job?': '40' } }],
  }

  it('a ZZ job is no open job, no job sold and no point, by the shared ids or by its own names', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const input = await loadBuildPaceInputs(db, { ...opts, zzTestJobIds: new Set(['zzById']) })
    expect(input.openJobs.map((j) => j.id)).toEqual(['real'])
    expect(input.createdInWindow.map((j) => j.id)).toEqual(['real'])
    expect(input.points.map((p) => p.jobId)).toEqual(['real'])
    expect([...input.jobsByPoint.keys()]).toEqual(['real'])
  })

  it('keeps every job for a dev who shows them', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const input = await loadBuildPaceInputs(db, opts)
    expect(input.openJobs.map((j) => j.id)).toEqual(['real', 'zzById', 'zzByName', 'zzByCustomer'])
    expect(input.createdInWindow).toHaveLength(4)
    expect(input.points).toHaveLength(4)
  })

  it('reads the two names with every job, so the rule needs no second read', async () => {
    const { db, reads } = makeProxyFakeSupabase({})
    await loadBuildPaceInputs(db, { ...opts, zzTestJobIds: new Set() })
    for (const [cols] of proxyFakeCalls(reads, 'jobs_ledger', 'select')) expect(String(cols)).toContain('job_name, customer_name')
  })
})
