/**
 * void-stripe-invoice-for-revert's own handler, run here (punch list #443, row 7): the function's `index.ts` with
 * its three URL imports stood in for, a fake database and a fake Stripe. Nothing here reaches a real database or
 * Stripe. Made-up names.
 *
 * What it proves: a bill of a ZZ test job leaves one `voided_test_bills` row, written after the Stripe step and
 * right before the delete, on each of the three delete paths. A bill of a real job takes the path it always took,
 * with one read of its job's names and no other. And the record never stops a void: with the table not on the
 * database yet, with a read that fails or an insert that throws, the bill is voided and deleted exactly as before
 * and the answer says `kept_record: false`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }

const BILL = 'bbbbbbbb-2222-4222-8222-222222222222'
const JOB = 'cccccccc-3333-4333-8333-333333333333'
const CALLER = 'dddddddd-4444-4444-8444-444444444444'

type Answer = { data: unknown; error: unknown }
type Call = [string, unknown[]]
const db = {
  role: 'dev',
  bill: null as Record<string, unknown> | null,
  job: null as Record<string, unknown> | null,
  jobError: false,
  payments: [] as unknown[],
  emailSends: [] as unknown[],
  emailSendsError: false,
  sentCopies: [] as unknown[],
  /** How the new table answers a write: it is there, it is not on the database yet, or the client throws. */
  recordsTable: 'there' as 'there' | 'missing' | 'throws',
  records: [] as Array<{ row: Record<string, unknown>; options: unknown }>,
  deleteError: false,
  /** Every statement and every Stripe call, in the order the function made them. */
  log: [] as string[],
}

function answer(table: string, calls: Call[]): Answer {
  const did = (op: string) => calls.some(([o]) => o === op)
  const selected = String(calls.find(([o]) => o === 'select')?.[1]?.[0] ?? '')
  if (did('delete')) {
    db.log.push(`delete:${table}`)
    return { data: null, error: db.deleteError ? { message: 'the delete failed' } : null }
  }
  if (did('upsert')) {
    db.log.push(`upsert:${table}`)
    if (db.recordsTable === 'throws') throw new Error('the client threw')
    if (db.recordsTable === 'missing') return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.voided_test_bills' in the schema cache" } }
    const call = calls.find(([o]) => o === 'upsert')!
    db.records.push({ row: call[1][0] as Record<string, unknown>, options: call[1][1] })
    return { data: null, error: null }
  }
  if (did('insert')) {
    db.log.push(`insert:${table}`)
    return { data: null, error: null }
  }
  db.log.push(`read:${table}${table === 'users' || table === 'jobs_ledger_invoices' ? `(${selected})` : ''}`)
  if (table === 'users') return { data: selected === 'role' ? { role: db.role } : selected === 'archived_at' ? { archived_at: null } : { name: 'ZZ Test Caller', email: 'zz.caller@example.test' }, error: null }
  if (table === 'jobs_ledger_invoices') return { data: db.bill, error: null }
  if (table === 'jobs_ledger') return db.jobError ? { data: null, error: { message: 'the job read failed' } } : { data: db.job, error: null }
  if (table === 'jobs_ledger_payments') return { data: db.payments, error: null }
  if (table === 'jobs_ledger_invoice_stripe_email_sends') return db.emailSendsError ? { data: null, error: { message: 'the sends read failed' } } : { data: db.emailSends, error: null }
  if (table === 'sent_documents') return { data: db.sentCopies, error: null }
  if (table === 'jobs_ledger_team_members') return { data: { user_id: CALLER }, error: null }
  if (table === 'job_collect_payment_flows') return { data: { status: 'approved_for_terminal', jobs_ledger_invoice_id: BILL }, error: null }
  return { data: null, error: null }
}

function builder(table: string): unknown {
  const calls: Call[] = []
  const settle = () => {
    try {
      return Promise.resolve(answer(table, calls))
    } catch (e) {
      return Promise.reject(e)
    }
  }
  const b: unknown = new Proxy(
    {},
    {
      get: (_t, op: string) => {
        if (op === 'then') return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => settle().then(resolve, reject)
        if (op === 'maybeSingle') return () => settle()
        return (...args: unknown[]) => {
          calls.push([op, args])
          return b
        }
      },
    },
  )
  return b
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: CALLER } }, error: null }) },
    from: (name: string) => builder(name),
  }),
}))

/** Stripe's side of one invoice. */
const stripe = { status: 'open', amountPaid: 0, charge: null as string | null, missing: false }
vi.mock('https://esm.sh/stripe@16.12.0?target=deno', () => ({
  default: class FakeStripe {
    invoices = {
      retrieve: async () => {
        db.log.push('stripe:retrieve')
        if (stripe.missing) throw Object.assign(new Error('No such invoice: in_test_zz1'), { code: 'resource_missing' })
        return { status: stripe.status, amount_paid: stripe.amountPaid, charge: stripe.charge, total: 12550, metadata: {} }
      },
      voidInvoice: async () => void db.log.push('stripe:void'),
      del: async () => void db.log.push('stripe:delete_draft'),
    }
    creditNotes = {
      list: async () => ({ data: [] }),
      create: async () => {
        db.log.push('stripe:credit_note')
        return { id: 'cn_test_zz1' }
      },
    }
  },
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key', STRIPE_SECRET_KEY_TEST: 'sk_test_zz' }

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/void-stripe-invoice-for-revert/index.ts'

const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  errors.mockRestore()
})

const ZZ_JOB = { job_name: 'ZZ Test walk job', customer_name: 'ZZ Test Customer' }
const REAL_JOB = { job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }
const bill = (over: Record<string, unknown> = {}) => ({ id: BILL, job_id: JOB, amount: 125.5, status: 'billed', stripe_invoice_id: 'in_test_zz1', external_send_channel: 'stripe', hosted_invoice_url: 'https://invoice.example.test/zz', stripe_mode: 'test', pay_code: 'abcdefghjk', ...over })
const EMAIL = { id: 'e1', sent_at: '2026-11-24T15:00:05Z', stripe_invoice_id: 'in_test_zz1', copy_emails: [] }
const COPY = { id: 'c1', kind: 'bill', title: 'Invoice #ZZ01-0002 from ZZ Test Plumbing', how: 'email', recipient_name: 'ZZ Test Payer', recipient_emails: ['zz.payer@example.test'], subject: 'Your bill', sent_at: '2026-11-24T15:00:00Z', sent_by_name: 'ZZ Test Sender', copy_path: null, resend_email_id: null }

beforeEach(() => {
  db.role = 'dev'
  db.bill = bill()
  db.job = ZZ_JOB
  db.jobError = false
  db.payments = []
  db.emailSends = [EMAIL]
  db.emailSendsError = false
  db.sentCopies = [COPY]
  db.recordsTable = 'there'
  db.records = []
  db.deleteError = false
  db.log = []
  stripe.status = 'open'
  stripe.amountPaid = 0
  stripe.charge = null
  stripe.missing = false
  errors.mockClear()
})

async function post(more: Record<string, unknown> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await box.handler!(new Request('http://fn/void-stripe-invoice-for-revert', { method: 'POST', headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' }, body: JSON.stringify({ jobs_ledger_invoice_id: BILL, ...more }) }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}
const at = (entry: string) => db.log.indexOf(entry)
const COPY_READS = ['read:jobs_ledger_invoices(*)', 'read:jobs_ledger_invoice_stripe_email_sends', 'read:sent_documents']

describe('a bill of a real job takes the path it always took', () => {
  it('voids and deletes, reads the job’s names once, copies nothing and keeps no record', async () => {
    db.job = REAL_JOB
    const res = await post()
    expect(res).toEqual({ status: 200, body: { success: true, stripe_action: 'void', stripe_credit_note_id: null, kept_record: false } })
    expect(db.log.filter((l) => l === 'read:jobs_ledger')).toHaveLength(1)
    for (const read of COPY_READS) expect(db.log).not.toContain(read)
    expect(db.log).not.toContain('upsert:voided_test_bills')
    expect(db.log.slice(-2)).toEqual(['stripe:void', 'delete:jobs_ledger_invoices'])
    expect(db.records).toEqual([])
    expect(errors).not.toHaveBeenCalled()
  })
})

describe('a bill of a ZZ test job leaves a record', () => {
  it('the Stripe path: the copy is read before Stripe is asked, and the record is written after the void and before the delete', async () => {
    const res = await post()
    expect(res).toEqual({ status: 200, body: { success: true, stripe_action: 'void', stripe_credit_note_id: null, kept_record: true } })
    for (const read of COPY_READS) expect(at(read)).toBeLessThan(at('stripe:retrieve'))
    expect(at('stripe:void')).toBeLessThan(at('upsert:voided_test_bills'))
    expect(at('upsert:voided_test_bills')).toBe(at('delete:jobs_ledger_invoices') - 1)
    expect(db.records).toHaveLength(1)
    expect(db.records[0]?.options).toEqual({ onConflict: 'invoice_id', ignoreDuplicates: true })
    expect(db.records[0]?.row).toEqual({
      invoice_id: BILL,
      job_id: JOB,
      bill: bill(),
      sends: [
        { source: 'sent_copy', ...COPY },
        { source: 'stripe_email', ...EMAIL },
      ],
      stripe_invoice_id: 'in_test_zz1',
      stripe_action: 'void',
      voided_by: CALLER,
      voided_by_name: 'ZZ Test Caller',
    })
  })
  it('names what Stripe was asked to do: a draft deleted, an invoice already void, an invoice Stripe does not have', async () => {
    stripe.status = 'draft'
    expect((await post()).body).toMatchObject({ stripe_action: 'delete_draft', kept_record: true })
    stripe.status = 'void'
    expect((await post()).body).toMatchObject({ stripe_action: 'noop', kept_record: true })
    stripe.missing = true
    expect((await post()).body).toMatchObject({ stripe_action: 'noop_missing', kept_record: true })
    expect(db.records.map((r) => r.row.stripe_action)).toEqual(['delete_draft', 'noop', 'noop_missing'])
  })
  it('a paid-by-check mark reversed: the record says so, and the payment event is written as before', async () => {
    stripe.status = 'paid'
    const res = await post()
    expect(res.body).toEqual({ success: true, stripe_action: 'reverse_oob_mark', stripe_credit_note_id: 'cn_test_zz1', kept_record: true })
    expect(db.records[0]?.row.stripe_action).toBe('reverse_oob_mark')
    expect(db.log.slice(-3)).toEqual(['delete:jobs_ledger_invoices', 'read:users(name, email)', 'insert:jobs_ledger_payment_events'])
  })
  it('the path with no Stripe id: a record with the function’s own word, right before the delete', async () => {
    db.bill = bill({ stripe_invoice_id: null })
    const res = await post()
    expect(res).toEqual({ status: 200, body: { success: true, stripe_action: 'db_only_no_stripe_id', kept_record: true } })
    expect(db.records[0]?.row).toMatchObject({ stripe_invoice_id: null, stripe_action: 'db_only_no_stripe_id' })
    expect(db.log.slice(-2)).toEqual(['upsert:voided_test_bills', 'delete:jobs_ledger_invoices'])
    expect(db.log.some((l) => l.startsWith('stripe:'))).toBe(false)
  })
  it('a helper’s Collect Payment send-back of a bill that is not Stripe’s: a record, under the helper’s name', async () => {
    db.role = 'helpers'
    db.bill = bill({ stripe_invoice_id: null, external_send_channel: 'physical' })
    const res = await post({ collect_payment_send_back_job_id: JOB })
    expect(res).toEqual({ status: 200, body: { success: true, stripe_action: 'db_only_non_stripe_collect_send_back', kept_record: true } })
    expect(db.records[0]?.row).toMatchObject({ stripe_action: 'db_only_non_stripe_collect_send_back', voided_by: CALLER, voided_by_name: 'ZZ Test Caller' })
    expect(db.log.slice(-2)).toEqual(['upsert:voided_test_bills', 'delete:jobs_ledger_invoices'])
  })
  it('a bill with no send keeps a record with an empty list', async () => {
    db.emailSends = []
    db.sentCopies = []
    expect((await post()).body.kept_record).toBe(true)
    expect(db.records[0]?.row.sends).toEqual([])
  })
})

describe('the record never stops a void', () => {
  const voidedAsBefore = (res: { status: number; body: Record<string, unknown> }) => {
    expect(res).toEqual({ status: 200, body: { success: true, stripe_action: 'void', stripe_credit_note_id: null, kept_record: false } })
    expect(db.log).toContain('stripe:void')
    expect(db.log[db.log.length - 1]).toBe('delete:jobs_ledger_invoices')
    expect(db.records).toEqual([])
  }
  it('the table is not on the database yet: the refusal is logged and the bill is voided and deleted', async () => {
    db.recordsTable = 'missing'
    voidedAsBefore(await post())
    expect(db.log).toContain('upsert:voided_test_bills')
    expect(errors).toHaveBeenCalledWith('void-stripe-invoice-for-revert: test bill record not kept', expect.objectContaining({ code: 'PGRST205' }))
  })
  it('the write throws: logged, and the void goes on', async () => {
    db.recordsTable = 'throws'
    voidedAsBefore(await post())
    expect(errors).toHaveBeenCalledWith('void-stripe-invoice-for-revert: test bill record not kept', expect.any(Error))
  })
  it('a read of the sends fails: no record is tried, and the void goes on', async () => {
    db.emailSendsError = true
    voidedAsBefore(await post())
    expect(db.log).not.toContain('upsert:voided_test_bills')
    expect(errors).toHaveBeenCalledWith('void-stripe-invoice-for-revert: test bill record, copy read', expect.objectContaining({ message: 'the sends read failed' }))
  })
  it('the job’s names cannot be read: the bill is treated as a real job’s', async () => {
    db.jobError = true
    voidedAsBefore(await post())
    for (const read of COPY_READS) expect(db.log).not.toContain(read)
    expect(errors).toHaveBeenCalledWith('void-stripe-invoice-for-revert: test bill record, job read', expect.objectContaining({ message: 'the job read failed' }))
  })
  it('the job is gone: no record, and the void goes on', async () => {
    db.job = null
    voidedAsBefore(await post())
    expect(errors).not.toHaveBeenCalled()
  })
})

describe('a void that is refused writes no record', () => {
  it('a bill with a payment on it: refused before anything is copied', async () => {
    db.payments = [{ id: 'p1' }]
    const res = await post()
    expect(res.status).toBe(409)
    expect(db.log).not.toContain('read:jobs_ledger')
    expect(db.log).not.toContain('upsert:voided_test_bills')
    expect(db.log).not.toContain('delete:jobs_ledger_invoices')
  })
  it('a bill Stripe holds real money for: refused, with no record and no delete', async () => {
    stripe.status = 'paid'
    stripe.charge = 'ch_test_zz1'
    stripe.amountPaid = 12550
    const res = await post()
    expect(res.status).toBe(409)
    expect(db.log).not.toContain('upsert:voided_test_bills')
    expect(db.log).not.toContain('delete:jobs_ledger_invoices')
  })
  it('a bill that is not billed: refused before the job is read', async () => {
    db.bill = bill({ status: 'ready_to_bill' })
    expect((await post()).status).toBe(400)
    expect(db.log).not.toContain('read:jobs_ledger')
  })
})

describe('a delete that fails after the record was written', () => {
  it('answers as it always did, and the record of what Stripe was asked stays for the second try', async () => {
    db.deleteError = true
    const res = await post()
    expect(res).toEqual({ status: 500, body: { error: 'Stripe updated but failed to delete invoice' } })
    expect(db.records).toHaveLength(1)
    expect(db.records[0]?.row.stripe_action).toBe('void')
  })
})
