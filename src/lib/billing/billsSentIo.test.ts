import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A database of rows in memory, read the way the page reads: `from(table)` then filters, then awaited. Each read is
 * kept with its table and its calls, so a test can say what a read asked for. `eq`, `in`, `is` and `not … is` are
 * applied to the rows. `or`, `like`, `order` and `limit` are kept and not applied.
 */
type Row = Record<string, unknown>
type Call = [name: string, ...args: unknown[]]
const db = vi.hoisted(() => ({ tables: {} as Record<string, Array<Record<string, unknown>>>, reads: [] as Array<{ table: string; calls: Array<[string, ...unknown[]]> }> }))

vi.mock('../supabase', () => {
  const from = (table: string) => {
    const read = { table, calls: [] as Call[] }
    db.reads.push(read)
    let rows: Row[] = [...(db.tables[table] ?? [])]
    const keep = (test: (r: Row) => boolean) => {
      rows = rows.filter(test)
    }
    const builder: Record<string, unknown> = {
      then: (done: (answer: { data: Row[]; error: null }) => unknown, failed?: (reason: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(done, failed),
    }
    for (const name of ['select', 'eq', 'in', 'is', 'not', 'or', 'like', 'order', 'limit']) {
      builder[name] = (...args: unknown[]) => {
        read.calls.push([name, ...args])
        const [column, value, third] = args as [string, unknown, unknown]
        if (name === 'eq') keep((r) => r[column] === value)
        if (name === 'in') keep((r) => (value as unknown[]).includes(r[column]))
        if (name === 'is') keep((r) => (r[column] ?? null) === value)
        if (name === 'not' && value === 'is') keep((r) => (r[column] ?? null) !== third)
        return builder
      }
    }
    return builder
  }
  return { supabase: { from, rpc: async () => ({ data: [], error: null }) } }
})

import { payLinkRefInText, readBillsSent } from './billsSentIo'
import { billsSentGaps, billsSentLines, billsSentOut, billsSentTestGaps } from './billsSent'

describe('payLinkRefInText', () => {
  it('reads the bill a pay link names, by id or by its short code', () => {
    expect(payLinkRefInText('Your bill is ready: https://clicktooling.example/pay/AAAAAAAA-1111-4111-8111-111111111111 Thank you')).toEqual({ kind: 'id', value: 'aaaaaaaa-1111-4111-8111-111111111111' })
    expect(payLinkRefInText('Pay here my.northgate.example/pay/k7m2q9xwpd')).toEqual({ kind: 'code', value: 'k7m2q9xwpd' })
  })
  it('answers nothing for words with no pay link', () => {
    expect(payLinkRefInText('On my way, about 20 minutes.')).toBeNull()
    expect(payLinkRefInText('see /pay/')).toBeNull()
    expect(payLinkRefInText('see /pay/not-a-code')).toBeNull()
  })
})

describe('readBillsSent: the bills with no send, test mode included (punch list #340)', () => {
  const LIVE = 'aaaaaaaa-1111-4111-8111-111111111111'
  const TEST = 'bbbbbbbb-2222-4222-8222-222222222222'
  const TEST_ZZ = 'cccccccc-3333-4333-8333-333333333333'
  const SENT = 'dddddddd-4444-4444-8444-444444444444'
  const JOB = 'aaaaaaaa-9999-4999-8999-999999999991'
  const JOB_ZZ = 'aaaaaaaa-9999-4999-8999-999999999997'
  const bill = (over: Row): Row => ({ job_id: JOB, amount: 100, status: 'billed', pay_code: null, billed_at: '2026-11-10T15:00:00.000Z', created_at: '2026-11-10T15:00:00.000Z', stripe_invoice_id: 'in_1', stripe_invoice_status: 'open', stripe_mode: 'live', external_send_channel: 'stripe', sent_to_customer_at: null, ...over })

  beforeEach(() => {
    db.reads.length = 0
    db.tables = {
      jobs_ledger_invoices: [
        bill({ id: LIVE, amount: 2140 }),
        // Made in Stripe's test mode, the only way a walk is cleared to make a bill: one on a real job, one on a ZZ job.
        bill({ id: TEST, amount: 310, stripe_mode: 'test', billed_at: '2026-11-11T15:00:00.000Z' }),
        bill({ id: TEST_ZZ, job_id: JOB_ZZ, amount: 75, stripe_mode: 'test', status: 'paid', billed_at: '2026-11-12T15:00:00.000Z' }),
        // A test-mode bill with a send stamp is no gap: the read asks for the bills with none.
        bill({ id: SENT, stripe_mode: 'test', sent_to_customer_at: '2026-11-12T16:00:00.000Z' }),
      ],
      jobs_ledger: [
        { id: JOB, hcp_number: '1482', click_number: null, job_name: 'Northgate Dental', job_address: '', customer_name: 'Sable Ridge Builders' },
        { id: JOB_ZZ, hcp_number: '1501', click_number: null, job_name: 'ZZ Test sink', job_address: '', customer_name: 'ZZ Test Customer' },
      ],
    }
  })

  it('asks the database for every Stripe bill with no send stamp, and for no mode', async () => {
    await readBillsSent({ limit: 300 })
    const unsentRead = db.reads.find((r) => r.table === 'jobs_ledger_invoices' && r.calls.some(([name, column, value]) => name === 'is' && column === 'sent_to_customer_at' && value === null))
    expect(unsentRead).toBeTruthy()
    const filters = unsentRead!.calls.filter(([name]) => name !== 'select')
    expect(filters).toEqual([
      ['in', 'status', ['billed', 'paid']],
      ['is', 'sent_to_customer_at', null],
      ['eq', 'external_send_channel', 'stripe'],
      ['order', 'billed_at', { ascending: false }],
      ['limit', 300],
    ])
    // The mode is selected, never filtered on: a filter here is what kept every test bill out of the box.
    expect(JSON.stringify(filters)).not.toContain('stripe_mode')
    expect(String(unsentRead!.calls.find(([name]) => name === 'select')?.[1])).toContain('stripe_mode')
  })

  it('carries each bill’s mode to the kernel, so a test-mode bill lands in the box of test bills and nowhere else', async () => {
    const input = await readBillsSent({ limit: 300 })
    expect(input.unsent?.map((u) => [u.billId, u.stripeMode])).toEqual([
      [LIVE, 'live'],
      [TEST, 'test'],
      [TEST_ZZ, 'test'],
    ])
    const lines = billsSentLines(input)
    expect(lines).toEqual([])
    // The box a dev who shows ZZ test jobs reads: both test-mode bills, the newest first, with their jobs' words.
    expect(billsSentTestGaps(input, lines).map((g) => [g.billId, g.payer, g.amount, g.paid])).toEqual([
      [TEST_ZZ, 'ZZ Test Customer', 75, true],
      [TEST, 'Sable Ridge Builders', 310, false],
    ])
    // The yellow box and the Not paid tile hold the live bill alone.
    const gaps = billsSentGaps(input, lines)
    expect([gaps.open.map((g) => g.billId), gaps.paid.map((g) => g.billId)]).toEqual([[LIVE], []])
    const out = billsSentOut(lines, gaps.open, '2026-11-12')
    expect([out.all, out.noSend]).toEqual([
      { bills: 1, total: 2140 },
      { bills: 1, total: 2140 },
    ])
  })
})
