import { describe, expect, it } from 'vitest'
import {
  BROKEN_PROMISE_GRACE_DAYS,
  buildPaymentChaseQueue,
  parseChaseTouchesRpc,
  resolvePromiseDates,
  summarizePaymentChase,
  type ChaseTouch,
} from './paymentChase'
import type { PaySpeedData, PromisedPayDate } from './billedExpectedPay'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const TODAY = '2026-08-21'

const speeds: PaySpeedData = {
  company: { medianDays: 16, samples: 40 },
  customers: { knight: { medianDays: 25, samples: 6 } },
  segments: { residential: { medianDays: 7, samples: 8 }, commercial: { medianDays: 25, samples: 32 } },
  customerTypes: { knight: 'commercial', palmer: 'commercial', holub: 'residential' },
  receipts: {},
  quality: null,
}

function invRow(opts: {
  customerId: string
  customerName: string
  jobId: string
  invoiceId: string
  amount: number
  billedAt: string // ISO
  jobName?: string
}): StageRow {
  const job = {
    id: opts.jobId,
    hcp_number: '900',
    click_number: null,
    job_name: opts.jobName ?? 'Job',
    customer_id: opts.customerId,
    customer_name: opts.customerName,
    payments: [],
    invoices: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: {
      id: opts.invoiceId,
      job_id: opts.jobId,
      amount: opts.amount,
      status: 'billed',
      sequence_order: 1,
      estimated_bill_date: null,
      billed_at: opts.billedAt,
    },
  } as unknown as StageRow
}

function touch(over: Partial<ChaseTouch> & Pick<ChaseTouch, 'customerId' | 'outcome' | 'createdAt'>): ChaseTouch {
  return {
    id: over.id ?? `t-${over.customerId}-${over.createdAt}`,
    jobId: null,
    note: null,
    promisedYmd: null,
    snoozeDays: null,
    resolvedAt: null,
    createdByName: 'office',
    ...over,
  }
}

describe('buildPaymentChaseQueue', () => {
  it('queues late unpromised bills as ask, grouped per customer with dollars', () => {
    // Knight pays in ~25d; billed Jul 1 → expected Jul 26 → 26d late today.
    const q = buildPaymentChaseQueue(
      [
        invRow({ customerId: 'knight', customerName: 'Knight', jobId: 'j1', invoiceId: 'i1', amount: 3600, billedAt: '2026-07-01T12:00:00Z' }),
        invRow({ customerId: 'knight', customerName: 'Knight', jobId: 'j2', invoiceId: 'i2', amount: 2700, billedAt: '2026-07-01T12:00:00Z' }),
      ],
      speeds,
      null,
      [],
      TODAY,
    )
    expect(q.due).toHaveLength(1)
    expect(q.due[0]).toMatchObject({ customerId: 'knight', state: 'ask', openLate: 6300 })
    expect(q.due[0]?.bills).toHaveLength(2)
    expect(q.dueDollars).toBe(6300)
    expect(q.askCount).toBe(1)
  })

  it('keeps a bill inside its promise out of the queue, and re-queues it as broken only past the grace', () => {
    const rows = [
      invRow({ customerId: 'palmer', customerName: 'Palmer', jobId: 'jp', invoiceId: 'ip', amount: 4100, billedAt: '2026-07-01T12:00:00Z' }),
    ]
    const promise = (ymd: string): Record<string, PromisedPayDate> => ({ jp: { promisedYmd: ymd, markedByName: 'Malachi' } })
    // Promise 3 days past — red chip on the board, but NOT re-queued yet.
    const inGrace = buildPaymentChaseQueue(rows, speeds, promise('2026-08-18'), [], TODAY)
    expect(inGrace.due).toHaveLength(0)
    expect(inGrace.waiting).toHaveLength(0)
    // Promise BROKEN_PROMISE_GRACE_DAYS past — back in the queue as broken.
    const pastYmd = '2026-08-14' // 7 days before TODAY
    const broken = buildPaymentChaseQueue(rows, speeds, promise(pastYmd), [], TODAY)
    expect(broken.due).toHaveLength(1)
    expect(broken.due[0]?.state).toBe('broken')
    expect(broken.brokenCount).toBe(1)
    expect(BROKEN_PROMISE_GRACE_DAYS).toBe(7)
  })

  it("can't-reach snoozes the customer for its window; quiet period holds recent touches", () => {
    const rows = [
      invRow({ customerId: 'knight', customerName: 'Knight', jobId: 'j1', invoiceId: 'i1', amount: 3600, billedAt: '2026-07-01T12:00:00Z' }),
    ]
    const snoozed = buildPaymentChaseQueue(
      rows, speeds, null,
      [touch({ customerId: 'knight', outcome: 'cant_reach', createdAt: '2026-08-18T15:00:00Z', snoozeDays: 7 })],
      TODAY,
    )
    expect(snoozed.due).toHaveLength(0)
    expect(snoozed.waiting).toHaveLength(1)
    expect(snoozed.waiting[0]?.waitReason).toMatchObject({ kind: 'snoozed', untilYmd: '2026-08-25' })
    // A snooze that has run out returns the customer to the queue.
    const returned = buildPaymentChaseQueue(
      rows, speeds, null,
      [touch({ customerId: 'knight', outcome: 'cant_reach', createdAt: '2026-08-10T15:00:00Z', snoozeDays: 7 })],
      TODAY,
    )
    expect(returned.due).toHaveLength(1)
    // A plain note 1 day ago holds the customer in the quiet period.
    const quiet = buildPaymentChaseQueue(
      rows, speeds, null,
      [touch({ customerId: 'knight', outcome: 'note', createdAt: '2026-08-20T15:00:00Z' })],
      TODAY,
    )
    expect(quiet.due).toHaveLength(0)
    expect(quiet.waiting[0]?.waitReason?.kind).toBe('quiet')
  })

  it('an unresolved dispute holds its bill out of the ask queue and lists it under disputes', () => {
    const rows = [
      invRow({ customerId: 'palmer', customerName: 'Palmer', jobId: 'jp', invoiceId: 'ip', amount: 4100, billedAt: '2026-07-01T12:00:00Z' }),
    ]
    const disputeTouch = touch({
      customerId: 'palmer', outcome: 'dispute', createdAt: '2026-08-15T15:00:00Z', jobId: 'jp', note: 'CO not approved',
    })
    const q = buildPaymentChaseQueue(rows, speeds, null, [disputeTouch], TODAY)
    expect(q.due).toHaveLength(0)
    expect(q.disputes).toHaveLength(1)
    expect(q.disputes[0]).toMatchObject({ customerName: 'Palmer' })
    expect(q.disputes[0]?.bill?.open).toBe(4100)
    // Resolved dispute → bill back in the ask queue.
    const resolved = buildPaymentChaseQueue(
      rows, speeds, null,
      [{ ...disputeTouch, resolvedAt: '2026-08-20T10:00:00Z' }],
      TODAY,
    )
    expect(resolved.due).toHaveLength(1)
    expect(resolved.disputes).toHaveLength(0)
  })

  it('not-late open bills ride along on the customer card without joining the queue', () => {
    const q = buildPaymentChaseQueue(
      [
        invRow({ customerId: 'knight', customerName: 'Knight', jobId: 'j1', invoiceId: 'i1', amount: 3600, billedAt: '2026-07-01T12:00:00Z' }),
        invRow({ customerId: 'knight', customerName: 'Knight', jobId: 'j3', invoiceId: 'i3', amount: 1980, billedAt: '2026-08-18T12:00:00Z' }),
      ],
      speeds, null, [], TODAY,
    )
    expect(q.due[0]?.bills.map((b) => b.invoiceId)).toEqual(['i1'])
    expect(q.due[0]?.notLate.map((b) => b.invoiceId)).toEqual(['i3'])
    expect(q.due[0]?.openLate).toBe(3600) // not-late money doesn't count toward the claim
  })

  it('counts past promised touches as broken-promise history for the escalation nudge', () => {
    const rows = [
      invRow({ customerId: 'palmer', customerName: 'Palmer', jobId: 'jp', invoiceId: 'ip', amount: 4100, billedAt: '2026-06-01T12:00:00Z' }),
    ]
    const q = buildPaymentChaseQueue(
      rows, speeds, null,
      [
        touch({ customerId: 'palmer', outcome: 'promised', createdAt: '2026-07-01T15:00:00Z', promisedYmd: '2026-07-15' }),
        touch({ customerId: 'palmer', outcome: 'promised', createdAt: '2026-07-20T15:00:00Z', promisedYmd: '2026-08-01' }),
      ],
      TODAY,
    )
    expect(q.due[0]?.brokenPromiseTouches).toBe(2)
  })
})

describe('resolvePromiseDates', () => {
  const bills = [
    { invoiceId: 'i1', jobId: 'j1', billedYmd: '2026-07-31' },
    { invoiceId: 'i2', jobId: 'j2', billedYmd: '2026-07-24' },
    { invoiceId: 'i3', jobId: 'j3', billedYmd: '2026-08-09' },
  ]

  it("mode 'date': the named date lands on every bill", () => {
    const r = resolvePromiseDates({ mode: 'date', ymd: '2026-08-28', bills, todayYmd: TODAY })!
    expect(r.uniqueYmds).toEqual(['2026-08-28'])
    expect(r.byJob.get('j2')).toBe('2026-08-28')
  })

  it("mode 'today': today + N, same for every bill", () => {
    const r = resolvePromiseDates({ mode: 'today', days: 14, bills, todayYmd: TODAY })!
    expect(r.uniqueYmds).toEqual(['2026-09-04'])
  })

  it("mode 'billed': each bill's own bill date + N — dates diverge honestly", () => {
    const r = resolvePromiseDates({ mode: 'billed', days: 45, bills, todayYmd: TODAY })!
    expect(r.byInvoice.get('i1')).toBe('2026-09-14')
    expect(r.byInvoice.get('i2')).toBe('2026-09-07')
    expect(r.byInvoice.get('i3')).toBe('2026-09-23')
    expect(r.uniqueYmds).toEqual(['2026-09-07', '2026-09-14', '2026-09-23'])
  })

  it("mode 'billed': a bill with no bill date falls back to today + N instead of dropping", () => {
    const r = resolvePromiseDates({
      mode: 'billed',
      days: 30,
      bills: [{ invoiceId: 'ix', jobId: 'jx', billedYmd: null }],
      todayYmd: TODAY,
    })!
    expect(r.byInvoice.get('ix')).toBe('2026-09-20')
  })

  it('two bills on one job → the job takes the EARLIEST resolved date', () => {
    const r = resolvePromiseDates({
      mode: 'billed',
      days: 30,
      bills: [
        { invoiceId: 'a', jobId: 'j1', billedYmd: '2026-08-01' },
        { invoiceId: 'b', jobId: 'j1', billedYmd: '2026-07-01' },
      ],
      todayYmd: TODAY,
    })!
    expect(r.byJob.get('j1')).toBe('2026-07-31')
    expect(r.byInvoice.get('a')).toBe('2026-08-31')
  })

  it('incomplete input resolves to null (no date, zero/negative days, no bills)', () => {
    expect(resolvePromiseDates({ mode: 'date', ymd: '', bills, todayYmd: TODAY })).toBeNull()
    expect(resolvePromiseDates({ mode: 'today', days: 0, bills, todayYmd: TODAY })).toBeNull()
    expect(resolvePromiseDates({ mode: 'billed', days: null, bills, todayYmd: TODAY })).toBeNull()
    expect(resolvePromiseDates({ mode: 'today', days: 14, bills: [], todayYmd: TODAY })).toBeNull()
  })
})

describe('parseChaseTouchesRpc / summarizePaymentChase', () => {
  it('parses valid rows and drops malformed ones; null on non-array', () => {
    const parsed = parseChaseTouchesRpc([
      { id: 't1', customerId: 'c1', outcome: 'cant_reach', createdAt: '2026-08-20T10:00:00Z', snoozeDays: 3 },
      { id: 't2', customerId: 'c1', outcome: 'nonsense', createdAt: '2026-08-20T10:00:00Z' },
      'garbage',
    ])
    expect(parsed).toHaveLength(1)
    expect(parsed?.[0]).toMatchObject({ outcome: 'cant_reach', snoozeDays: 3, createdByName: 'office' })
    expect(parseChaseTouchesRpc(null)).toBeNull()
  })

  it('summary hides when there is nothing anywhere', () => {
    const empty = buildPaymentChaseQueue([], speeds, null, [], TODAY)
    expect(summarizePaymentChase(empty)).toBeNull()
    expect(summarizePaymentChase(null)).toBeNull()
  })
})
