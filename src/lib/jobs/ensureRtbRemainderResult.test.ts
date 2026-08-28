import { describe, expect, it } from 'vitest'
import { ensureRemainderResyncOutcome } from './ensureRtbRemainderResult'

describe('ensureRemainderResyncOutcome', () => {
  it('treats an ok envelope as success', () => {
    expect(ensureRemainderResyncOutcome({ ok: true, invoice_id: 'abc', amount: 650 })).toEqual({ ok: true })
  })

  it('treats the post-fix fully-allocated ok envelope as success', () => {
    expect(
      ensureRemainderResyncOutcome({ ok: true, fully_allocated: true, amount: 0, primary_deleted: true }),
    ).toEqual({ ok: true })
  })

  it('treats the pre-fix zero-remainder error envelopes as success (invoice already written)', () => {
    expect(
      ensureRemainderResyncOutcome({ error: 'Nothing left to bill; invoice amount would be zero' }),
    ).toEqual({ ok: true })
    expect(ensureRemainderResyncOutcome({ error: 'Nothing left to bill for this job' })).toEqual({ ok: true })
    expect(
      ensureRemainderResyncOutcome({
        error: 'No remainder to bill on the job bundle; use Bill Customer from a partial invoice row or adjust amounts.',
      }),
    ).toEqual({ ok: true })
  })

  it('surfaces real errors', () => {
    expect(ensureRemainderResyncOutcome({ error: 'Not authorized' })).toEqual({
      ok: false,
      error: 'Not authorized',
    })
    expect(ensureRemainderResyncOutcome({ error: 'Job must be in Ready to Bill' })).toEqual({
      ok: false,
      error: 'Job must be in Ready to Bill',
    })
  })

  it('treats a null/empty payload as success (no error reported)', () => {
    expect(ensureRemainderResyncOutcome(null)).toEqual({ ok: true })
    expect(ensureRemainderResyncOutcome({})).toEqual({ ok: true })
  })
})
