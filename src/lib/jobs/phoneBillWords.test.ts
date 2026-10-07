import { describe, expect, it } from 'vitest'
import { phoneBillWords } from './phoneBillWords'

type JobsLedgerInvoice = NonNullable<Parameters<typeof phoneBillWords>[0]['inv']>

const TODAY = '2026-10-06'
const inv = (p: Partial<JobsLedgerInvoice>): JobsLedgerInvoice => ({ id: 'i1', job_id: 'j1', amount: 1713, status: 'billed', billed_at: null, estimated_bill_date: null, ...p }) as JobsLedgerInvoice

describe('phoneBillWords — the phone card\'s billing clause', () => {
  it('a Billed bill row reads the day it was billed, not the resend 32 days ago (punch list #93 B)', () => {
    const words = phoneBillWords({
      stage: 'billed',
      inv: inv({ billed_at: '2026-05-15T15:00:00Z', sent_to_customer_at: '2026-09-04T14:35:00Z' } as Partial<JobsLedgerInvoice>),
      detail: { ymd: '2026-09-04', tooltip: 'Latest: Invoice sent (2026-09-04)', labels: ['Invoice sent'] },
      todayYmd: TODAY,
    })
    expect(words).toBe('billed 5 months ago')
  })

  it('a Collections bill row reads the same day; the billed day wins and the hand-set estimate stands in when there is none, as the desktop dates block reads them', () => {
    expect(phoneBillWords({ stage: 'collections', inv: inv({ billed_at: '2026-04-13T12:00:00Z' }), detail: { ymd: '2026-10-01', tooltip: '', labels: ['Invoice sent'] }, todayYmd: TODAY })).toBe('billed 6 months ago')
    expect(phoneBillWords({ stage: 'collections', inv: inv({ billed_at: '2026-04-13T12:00:00Z', estimated_bill_date: '2026-08-20' }), detail: null, todayYmd: TODAY })).toBe('billed 6 months ago')
    expect(phoneBillWords({ stage: 'collections', inv: inv({ estimated_bill_date: '2026-08-20' }), detail: null, todayYmd: TODAY })).toBe('billed 7 weeks ago')
  })

  it('without a bill day on the row, the latest event still speaks', () => {
    expect(phoneBillWords({ stage: 'billed', inv: inv({}), detail: { ymd: '2026-09-01', tooltip: '', labels: ['Invoice sent'] }, todayYmd: TODAY })).toBe('billed 5 weeks ago')
    expect(phoneBillWords({ stage: 'billed', inv: inv({}), detail: null, todayYmd: TODAY })).toBeNull()
  })

  it('a working job and a Collections shell keep the latest event — paid today, billed N weeks ago', () => {
    expect(phoneBillWords({ stage: 'working', inv: null, detail: { ymd: TODAY, tooltip: '', labels: ['Payment recorded'] }, todayYmd: TODAY })).toMatch(/^paid /)
    expect(phoneBillWords({ stage: 'collections', inv: null, detail: { ymd: '2026-08-07', tooltip: '', labels: ['Invoice billed'] }, todayYmd: TODAY })).toBe('billed 9 weeks ago')
  })
})
