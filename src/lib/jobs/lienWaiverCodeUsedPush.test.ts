import { describe, expect, it } from 'vitest'
import { lienWaiverCodeUsedPush, signedYmdOf } from './lienApprovalPush'
import { plainWordsFailures } from '../plainWords'

describe('the push when his signing code signs a lien waiver on someone else’s screen (v2.5924)', () => {
  it('a job’s waiver: the job, the money, the day, whose screen; the tap lands on the Pipeline', () => {
    const p = lienWaiverCodeUsedPush({
      jobLabel: '878 · Take 5 Seguin',
      jobId: 'j-878',
      amount: 3800,
      formTitle: 'Conditional Waiver and Release on Final Payment',
      signedYmd: '2026-10-26',
      deviceName: 'Wendi Wright',
    })
    expect(p.title).toBe('Your signing code signed a lien waiver')
    expect(p.body).toBe('878 · Take 5 Seguin · $3,800 · signed Oct 26 · on Wendi’s screen')
    expect(p.url).toBe('/jobs?tab=stages')
    expect(p.tag).toBe('lien-waiver-code-j-878')
    expect(p.emailText).toContain('The signed waiver sits on the job, in the Release of Lien window under Already on this job.')
  })

  it('a bid’s waiver (v2.5958): the tap lands on the bid’s Lien Release tab, under Already on this bid', () => {
    const p = lienWaiverCodeUsedPush({
      jobLabel: 'Bid 482 · Take 5 Seguin',
      jobId: '',
      bidId: 'bid-482',
      amount: 34825,
      formTitle: 'Unconditional Waiver and Release on Progress Payment',
      signedYmd: '2026-10-26',
      deviceName: 'Wendi Wright',
    })
    expect(p.body).toBe('Bid 482 · Take 5 Seguin · $34,825 · signed Oct 26 · on Wendi’s screen')
    expect(p.url).toBe('/bids?tab=lien-release&bidId=bid-482')
    expect(p.tag).toBe('lien-waiver-code-bid-482')
    expect(p.subject).toBe('Your signing code signed a lien waiver · Bid 482 · Take 5 Seguin')
    expect(p.emailText).toContain('The signed waiver sits on the bid, in the Lien Release tab under Already on this bid.')
    expect(p.emailText).not.toContain('Already on this job')
    for (const line of p.emailText.split('\n').filter((l) => /[a-z]{3}/i.test(l) && !/^(\d|Bid \d)/.test(l))) expect(plainWordsFailures(line), line).toEqual([])
  })

  it('an evening signature is dated its own day (v2.6006): the function reads signed_at in the app’s zone, never its UTC prefix', () => {
    // 8:30 PM Central on Oct 26 is 01:30 UTC on Oct 27 — the row's signed_at, as notify-lien-approval reads it.
    expect(signedYmdOf('2026-10-27T01:30:00+00:00')).toBe('2026-10-26')
    expect(signedYmdOf('2026-01-15T00:30:00Z')).toBe('2026-01-14')
    expect(signedYmdOf('2026-10-26T20:30:00-05:00')).toBe('2026-10-26')
    expect(signedYmdOf('2026-10-26T15:00:00Z')).toBe('2026-10-26')
    expect(signedYmdOf('not a time')).toBeNull()
    expect(signedYmdOf(null)).toBeNull()
    expect(signedYmdOf(undefined)).toBeNull()
    const p = lienWaiverCodeUsedPush({ jobLabel: '878 · Take 5 Seguin', jobId: 'j-878', amount: 3800, formTitle: null, signedYmd: signedYmdOf('2026-10-27T01:30:00+00:00'), deviceName: 'Wendi Wright' })
    expect(p.body).toBe('878 · Take 5 Seguin · $3,800 · signed Oct 26 · on Wendi’s screen')
    expect(p.emailText).toContain('Signed Oct 26.')
  })
})
