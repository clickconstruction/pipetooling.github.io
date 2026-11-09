/**
 * Punch list #205, PR 2: the job head's facts. Sample Electric's dental office through the sample's own rows (the start
 * 30 days back, the finish 40 days out, the rough-in reported at 60% of $29,160 and the trim at 0% of $19,440), then a
 * project with no Start pressed, no finish and no signed work.
 */
import { describe, expect, it } from 'vitest'
import { gcTradePortalSample, gcTradePortalSampleSchedules, SAMPLE_TRADE_IDS as ID } from '../../../supabase/functions/_shared/gcTradePortalSample'
import { jobHead, jobHeadShown } from './tradePortalHead'
import { tradePortalState } from './tradePortalState'
import type { GcProject } from './types'

const TODAY = '2026-10-08'
const { state, partnerId } = tradePortalState(gcTradePortalSample(TODAY), TODAY)
const job = state.projects.find((p) => p.id === ID.job)!
const finish = gcTradePortalSampleSchedules(TODAY)[ID.job]!.finish!

describe('the job head (punch list #205, PR 2)', () => {
  it('shows on a job being built that is awarded to the company, and on no other', () => {
    expect(jobHeadShown(job, partnerId)).toBe(true)
    expect(jobHeadShown(state.projects.find((p) => p.id === ID.project)!, partnerId)).toBe(false)
    expect(jobHeadShown(job, 'another-company')).toBe(false)
    expect(jobHeadShown({ ...job, stage: 'buyout' }, partnerId)).toBe(false)
  })

  it('reads the start, the planned finish and the days left from the slice and the chart', () => {
    const head = jobHead(job, partnerId, TODAY, finish)
    expect([head.started, head.startedIsPlan, head.finish, head.daysLeft]).toEqual(['2026-09-08', false, '2026-11-17', 40])
  })

  it('weights the company’s own lines by their amount, from the percents it reported', () => {
    const head = jobHead(job, partnerId, TODAY, finish)
    // 60% of 29,160 is 17,496, of 48,600 in all: 36%.
    expect([head.pct, head.done, head.total]).toEqual([36, 17496, 48600])
    expect(head.lines.map((l) => [l.label, l.pct, l.amount])).toEqual([
      ['Rough-in', 60, 29160],
      ['Trim and fixtures', 0, 19440],
    ])
  })

  it('counts days past the plan as negative, and reads a planned start when Start was not pressed', () => {
    const late = jobHead(job, partnerId, '2026-11-20', finish)
    expect(late.daysLeft).toBe(-3)
    const planned: GcProject = { ...job, startedOn: null, startDate: '2026-10-20' }
    expect([jobHead(planned, partnerId, TODAY, finish).started, jobHead(planned, partnerId, TODAY, finish).startedIsPlan]).toEqual(['2026-10-20', true])
  })

  it('reads an older answer with no finish, and a job with no signed work, as a head with those lines missing', () => {
    const bare = jobHead({ ...job, startDate: null, startedOn: null, packages: job.packages.map((k) => ({ ...k, sow: null })) }, partnerId, TODAY, undefined)
    expect(bare).toEqual({ started: null, startedIsPlan: true, finish: null, daysLeft: null, pct: 0, done: 0, total: 0, lines: [] })
  })
})
