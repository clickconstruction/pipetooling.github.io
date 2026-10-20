import { describe, expect, it } from 'vitest'
import { paymentPromisesToActivityEvents, promiseDateWords, promiseSummary } from './promiseActivityEvents'
import type { PaymentPromise } from './paymentPromises'

const promise = (over: Partial<PaymentPromise> = {}): PaymentPromise => ({
  id: 'p1',
  jobId: 'j1',
  customerId: 'c1',
  promisedYmd: '2026-11-20',
  saidBy: 'Umar Khan',
  heardByName: 'Taunya',
  channel: 'phone',
  source: 'office',
  note: 'check goes out with the draw',
  createdAt: '2026-09-28T16:20:00Z',
  kind: 'promise' as const,
  method: null,
  amount: null,
  ...over,
})

describe('promise activity events (v2.4103)', () => {
  it('keeps the year — a promise is read months later', () => {
    expect(promiseDateWords('2026-11-20')).toBe('Nov 20, 2026')
    expect(promiseDateWords('junk')).toBe('junk')
  })

  it('one event per live promise, in the feed’s generic event shape', () => {
    const [ev] = paymentPromisesToActivityEvents([promise()])
    expect(ev).toMatchObject({
      kind: 'event',
      event: {
        dedupeKey: 'ev:promise:p1',
        type: 'payment_promise',
        occurredAt: '2026-09-28T16:20:00Z',
        actorName: 'Taunya',
        financial: true,
        detail: { promisedYmd: '2026-11-20', source: 'office', channel: 'phone', saidBy: 'Umar Khan' },
      },
    })
    expect(ev!.event.summary).toBe('Pay by Nov 20, 2026 — Umar Khan · by phone · heard by Taunya · “check goes out with the draw”')
  })

  it('a date the customer named themselves has no office actor', () => {
    const [ev] = paymentPromisesToActivityEvents([promise({ source: 'customer', saidBy: null, heardByName: null, channel: 'portal', note: null })])
    expect(ev!.event.actorName).toBeNull()
    expect(ev!.event.summary).toBe('Pay by Nov 20, 2026 — the customer · on their statement page')
  })

  it('no said-by and no note: the date alone', () => {
    expect(promiseSummary(promise({ saidBy: null, heardByName: null, channel: null, note: null }))).toBe('Pay by Nov 20, 2026')
  })

  it('a promise with no usable timestamp is dropped rather than sorted to 1970', () => {
    expect(paymentPromisesToActivityEvents([promise({ createdAt: '' }), promise({ id: 'p2', createdAt: 'not a date', kind: 'promise', method: null, amount: null })])).toEqual([])
  })
})

describe('a paid claim in the trail (v2.5648)', () => {
  it('reads Says they paid, how and the amount, who and how, the note', () => {
    const claim: PaymentPromise = { id: 'w1', jobId: 'j1', customerId: 'c1', promisedYmd: '2026-10-20', saidBy: 'Dana', heardByName: 'Theo', channel: 'text', source: 'office', note: 'Check #1187', createdAt: '2026-10-21T14:40:00Z', kind: 'paid_claim', method: 'check_mailed', amount: 1500 }
    expect(promiseSummary(claim)).toBe('Says they paid Oct 20, 2026 · a check in the mail · $1,500 — Dana · by text · heard by Theo · “Check #1187”')
    const [ev] = paymentPromisesToActivityEvents([claim])
    expect(ev!.event.type).toBe('payment_promise')
    expect(ev!.event.detail).toMatchObject({ kind: 'paid_claim', method: 'check_mailed', amount: 1500 })
  })
})
