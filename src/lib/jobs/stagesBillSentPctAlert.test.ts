import { describe, expect, it } from 'vitest'
import { stagesBillSentPctAlert } from './stagesBillSentPctAlert'

const inv = (status: string, billed_at: string | null, extra: Partial<{ sent_to_customer_at: string | null; created_at: string | null }> = {}) => ({
  status,
  billed_at,
  sent_to_customer_at: extra.sent_to_customer_at ?? null,
  created_at: extra.created_at ?? null,
})

describe('stagesBillSentPctAlert (v2.3411)', () => {
  it('flags a billed job with a sent bill and no percent, naming the first send day', () => {
    const a = stagesBillSentPctAlert({
      status: 'billed',
      pct_complete: null,
      invoices: [inv('billed', '2026-09-09T15:00:00Z'), inv('billed', '2026-09-02T15:00:00Z')],
    })
    expect(a).not.toBeNull()
    expect(a!.label).toBe('Bill sent Sep 2 · set % done')
    expect(a!.sentAt).toBe('2026-09-02T15:00:00Z')
  })

  it('a typed percent — even 0 — clears it', () => {
    expect(stagesBillSentPctAlert({ status: 'billed', pct_complete: 0, invoices: [inv('billed', '2026-09-02T15:00:00Z')] })).toBeNull()
    expect(stagesBillSentPctAlert({ status: 'billed', pct_complete: 45, invoices: [inv('billed', '2026-09-02T15:00:00Z')] })).toBeNull()
  })

  it('a Ready to Bill draft is not a sent bill; a job with no bill out stays quiet; paid never flags', () => {
    expect(stagesBillSentPctAlert({ status: 'ready_to_bill', pct_complete: null, invoices: [inv('ready_to_bill', null)] })).toBeNull()
    expect(stagesBillSentPctAlert({ status: 'working', pct_complete: null, invoices: [inv('ready_to_bill', null)] })).toBeNull()
    expect(stagesBillSentPctAlert({ status: 'working', pct_complete: null, invoices: [] })).toBeNull()
    expect(stagesBillSentPctAlert({ status: 'waiting', pct_complete: null, invoices: null })).toBeNull()
    expect(stagesBillSentPctAlert({ status: 'paid', pct_complete: null, invoices: [inv('billed', '2026-09-02T15:00:00Z')] })).toBeNull()
  })

  it('a Working job with a break-off bill already sent flags — the bill is what counts, not the section', () => {
    const a = stagesBillSentPctAlert({ status: 'working', pct_complete: null, invoices: [inv('billed', '2026-09-03T15:00:00Z'), inv('ready_to_bill', null)] })
    expect(a!.label).toBe('Bill sent Sep 3 · set % done')
  })

  it('a job sitting in Billed with no invoice rows (older records) still flags, with no date', () => {
    const a = stagesBillSentPctAlert({ status: 'billed', pct_complete: null, invoices: [] })
    expect(a!.label).toBe('Bill sent · set % done')
    expect(a!.sentAt).toBeNull()
  })

  it('falls back to the customer-send stamp, then the row date, and reads plainly with no date at all', () => {
    expect(stagesBillSentPctAlert({ status: 'billed', pct_complete: null, invoices: [inv('billed', null, { sent_to_customer_at: '2026-08-28T15:00:00Z' })] })!.label).toBe(
      'Bill sent Aug 28 · set % done',
    )
    expect(stagesBillSentPctAlert({ status: 'billed', pct_complete: null, invoices: [inv('billed', null, { created_at: '2026-08-20T15:00:00Z' })] })!.label).toBe(
      'Bill sent Aug 20 · set % done',
    )
    const bare = stagesBillSentPctAlert({ status: 'billed', pct_complete: null, invoices: [inv('billed', 'not-a-date')] })
    expect(bare!.label).toBe('Bill sent · set % done')
    expect(bare!.sentAt).toBeNull()
  })
})
