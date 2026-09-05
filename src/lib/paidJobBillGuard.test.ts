import { describe, expect, it, vi } from 'vitest'
import {
  PAID_JOB_BILL_BLOCKED_EVENT_TYPE,
  PAID_JOB_BILL_BLOCKED_MESSAGE,
  allowRebillFromBody,
  buildPaidJobBillBlockedEventRow,
  isPaidJobStatus,
  logPaidJobBillBlockedBestEffort,
  shouldBlockBillOnPaidJob,
} from '../../supabase/functions/_shared/paidJobBillGuard'

/** Shared predicate behind create-stripe-invoice, send-physical-invoice-email and the Bill Customer modal (J3-1). */
describe('_shared/paidJobBillGuard', () => {
  it('refuses a Ready to Bill draft whose job is paid', () => {
    expect(shouldBlockBillOnPaidJob({ jobStatus: 'paid' })).toBe(true)
    expect(shouldBlockBillOnPaidJob({ jobStatus: 'paid', allowRebill: false })).toBe(true)
    expect(shouldBlockBillOnPaidJob({ jobStatus: 'paid', allowRebill: null })).toBe(true)
  })

  it('lets a working job with an RTB draft (break-off) and a billed job through', () => {
    expect(shouldBlockBillOnPaidJob({ jobStatus: 'working' })).toBe(false)
    expect(shouldBlockBillOnPaidJob({ jobStatus: 'ready_to_bill' })).toBe(false)
    expect(shouldBlockBillOnPaidJob({ jobStatus: 'billed' })).toBe(false)
    expect(shouldBlockBillOnPaidJob({ jobStatus: 'waiting' })).toBe(false)
  })

  it('never blocks on an unknown job status (adds a stop, never removes one)', () => {
    expect(shouldBlockBillOnPaidJob({ jobStatus: null })).toBe(false)
    expect(shouldBlockBillOnPaidJob({ jobStatus: undefined })).toBe(false)
    expect(shouldBlockBillOnPaidJob({ jobStatus: '' })).toBe(false)
  })

  it('an explicit allow_rebill: true is the only override', () => {
    expect(shouldBlockBillOnPaidJob({ jobStatus: 'paid', allowRebill: true })).toBe(false)
  })

  it('isPaidJobStatus is exact', () => {
    expect(isPaidJobStatus('paid')).toBe(true)
    expect(isPaidJobStatus('Paid')).toBe(false)
    expect(isPaidJobStatus('billed')).toBe(false)
  })

  it('reads the body flag strictly — only boolean true counts', () => {
    expect(allowRebillFromBody({ allow_rebill: true })).toBe(true)
    expect(allowRebillFromBody({ allow_rebill: 'true' })).toBe(false)
    expect(allowRebillFromBody({ allow_rebill: 1 })).toBe(false)
    expect(allowRebillFromBody({})).toBe(false)
    expect(allowRebillFromBody(null)).toBe(false)
    expect(allowRebillFromBody('allow_rebill')).toBe(false)
  })

  it('speaks trade language', () => {
    expect(PAID_JOB_BILL_BLOCKED_MESSAGE).toBe('This job is already paid in full — nothing to bill.')
  })

  it('builds the rtb_paid_job_blocked activity row with a per-refusal source_id', () => {
    const row = buildPaidJobBillBlockedEventRow({
      jobId: 'job-903',
      invoiceId: 'inv-1',
      actorUserId: 'user-1',
      channel: 'stripe',
      occurredAt: '2026-09-05T15:00:00.000Z',
    })
    expect(row.event_type).toBe(PAID_JOB_BILL_BLOCKED_EVENT_TYPE)
    expect(row.job_id).toBe('job-903')
    expect(row.actor_user_id).toBe('user-1')
    expect(row.financial).toBe(true)
    expect(row.summary).toBe('Stripe bill refused — job is already paid in full')
    expect(row.detail).toEqual({
      source_id: 'inv-1:2026-09-05T15:00:00.000Z',
      invoice_id: 'inv-1',
      channel: 'stripe',
      job_status: 'paid',
    })
  })

  it('falls back to the job id in source_id when there is no invoice yet', () => {
    const row = buildPaidJobBillBlockedEventRow({
      jobId: 'job-688',
      invoiceId: null,
      actorUserId: null,
      channel: 'physical',
      occurredAt: '2026-09-05T15:00:00.000Z',
    })
    expect((row.detail as { source_id: string }).source_id).toBe('job-688:2026-09-05T15:00:00.000Z')
    expect(row.summary).toBe('Physical invoice email refused — job is already paid in full')
  })

  it('logging is best-effort: a failing insert never throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing = {
      from: () => ({ insert: async () => ({ error: new Error('no policy') }) }),
    }
    await expect(
      logPaidJobBillBlockedBestEffort(failing, { jobId: 'j', invoiceId: null, actorUserId: null, channel: 'housecallpro' }),
    ).resolves.toBeUndefined()
    const throwing = {
      from: () => ({
        insert: () => {
          throw new Error('boom')
        },
      }),
    }
    await expect(
      logPaidJobBillBlockedBestEffort(throwing as never, { jobId: 'j', invoiceId: null, actorUserId: null, channel: 'stripe' }),
    ).resolves.toBeUndefined()
    await expect(
      logPaidJobBillBlockedBestEffort(null, { jobId: 'j', invoiceId: null, actorUserId: null, channel: 'stripe' }),
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('logging writes to job_activity_events', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({ insert }))
    await logPaidJobBillBlockedBestEffort({ from }, { jobId: 'j', invoiceId: 'i', actorUserId: 'u', channel: 'stripe' })
    expect(from).toHaveBeenCalledWith('job_activity_events')
    expect(insert).toHaveBeenCalledTimes(1)
  })
})
