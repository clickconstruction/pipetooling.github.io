import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  JOB_PAYMENT_VERBS,
  PAYMENT_LINK_RPC,
  PAYMENT_REMOVE_RPC,
  PAYMENT_TYPES,
  isJobPaymentVerb,
  jobPaymentAppliedWords,
  jobPaymentDryRun,
  jobPaymentInput,
  paymentBackingWords,
  paymentInsertRow,
  paymentLinkRpcBody,
  paymentNoteBody,
  paymentTypeAsWritten,
  paymentWordsPatch,
  readJobPaymentWorld,
  stripeHoldsRow,
  type JobPaymentPayload,
  type PaymentLink,
  type PaymentRecord,
} from '../../../supabase/functions/_shared/devMcpJobPayment'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_RPCS } from '../../../supabase/functions/dev-mcp/catalog'
import { rpcArgNames } from '../../../supabase/functions/_shared/devMcpDoor'
import { PAYMENT_KIND_CHOICES } from '../jobs/inKindPayment'
import { paymentInsertRows } from '../jobs/jobFormAutosaveSlices'
import type { PaymentRow } from '../jobs/jobFormTypes'
import { BILL, REAL, REAL_PAY, SHELL, SHELL_PAY, TODAY, WIRE, bill, fakeRest, realPayment, shellJob, shellPayment, standingWorld, wire } from './jobMoneyFixture'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const FORM_ACTIONS = readFileSync('src/lib/jobs/jobFormPaymentActions.ts', 'utf8')

/** The newest migration that defines a function, and its body. */
function newestBody(fn: string): string {
  const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
  const defining = files.filter((f) => readFileSync(`supabase/migrations/${f}`, 'utf8').includes(`CREATE OR REPLACE FUNCTION public.${fn}(`))
  const text = readFileSync(`supabase/migrations/${defining[defining.length - 1]}`, 'utf8')
  const from = text.slice(text.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`))
  return from.slice(0, from.indexOf('$function$;'))
}

const shaped = (payment: Record<string, unknown>, verb: 'plan_job_payment' | 'apply_job_payment' = 'plan_job_payment', extra: Record<string, unknown> = {}): JobPaymentPayload => {
  const built = jobPaymentInput(verb, { payment, ...extra }, TODAY)
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const REMOVE = { action: 'remove', payment_id: SHELL_PAY, reason: 'typed in June with no deposit behind it; the wire is on the real job' }
const plan = async (payment: Record<string, unknown>, data = standingWorld()) => {
  const p = shaped(payment)
  const world = await readJobPaymentWorld(fakeRest(data), p)
  return { p, world, dry: jobPaymentDryRun(p, world) }
}
const refusal = async (payment: Record<string, unknown>, data = standingWorld()): Promise<string> => {
  const { dry } = await plan(payment, data)
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}
const reply = async (payment: Record<string, unknown>, data = standingWorld()): Promise<Record<string, unknown>> => {
  const { dry } = await plan(payment, data)
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply
}

describe('devMcpJobPayment — the verbs on the allowlist', () => {
  it('are two write verbs with no RPC in the table, plan before apply, named by the server and the README', () => {
    expect(JOB_PAYMENT_VERBS).toEqual(['plan_job_payment', 'apply_job_payment'])
    for (const v of JOB_PAYMENT_VERBS) {
      expect(isJobPaymentVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(isJobPaymentVerb('plan_job')).toBe(false)
    expect(planVerbFor('apply_job_payment')).toBe('plan_job_payment')
    expect(SERVER).toContain("const SERVER_VERSION = '0.80.0'")
    expect(SERVER).toContain('Writes are ninety-seven verbs and nothing else:')
    expect(README).toContain('`plan_job_payment(payment)` · `apply_job_payment(payment, plan_hash)`')
    expect(README).toContain("eighty-one since v2.6940's payment and combine pairs")
    expect(alreadyApplied('apply_job_payment', { target: SHELL, at: null })).toContain('already applied')
  })
  it('goes through the doors the screens use: the remove RPC, the payments table and Accounts Receivable’s link', () => {
    expect(PAYMENT_REMOVE_RPC).toBe('remove_jobs_ledger_payment_and_reconcile')
    expect(FORM_ACTIONS).toContain('`remove_jobs_ledger_payment_and_reconcile`')
    expect([...rpcArgNames(CATALOG_RPCS[PAYMENT_REMOVE_RPC]!)]).toEqual(['p_payment_id'])
    expect(PAYMENT_LINK_RPC).toBe('apply_mercury_bank_payment_allocations')
    const linkArgs = rpcArgNames(CATALOG_RPCS[PAYMENT_LINK_RPC]!)
    expect(Object.keys(paymentLinkRpcBody({ action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: WIRE }, shellPayment())).sort()).toEqual([...linkArgs].sort())
    expect(SERVER).toContain('await restPost(session, `rpc/${PAYMENT_REMOVE_RPC}`, { p_payment_id: p.payment_id })')
    expect(SERVER).toContain("await restRows(session, 'POST', 'jobs_ledger_payments', `select=${PAY_ROW_COLS}`, paymentInsertRow(p, world))")
    expect(SERVER).toContain('await restPost(session, `rpc/${PAYMENT_LINK_RPC}`, paymentLinkRpcBody(p, world.row!))')
    // The reason lands on the job's activity as plan_activity_note writes a line.
    expect(SERVER).toContain("await restRows(session, 'POST', 'jobs_ledger_thread_notes', 'select=id', { job_id: target, author_user_id: who.userId, body: noteBody })")
  })
  it('refuses Stripe’s rows in the remove RPC’s own words, and the link by the RPC’s own rules', () => {
    const remove = newestBody(PAYMENT_REMOVE_RPC)
    expect(remove).toContain('This part payment sits on the Stripe bill as a credit note')
    expect(remove).toContain('This bill is marked paid in Stripe')
    expect(remove).toContain("v_status_rpc := public.update_job_status(v_job_id, 'billed');")
    expect(remove).toContain("IF coalesce(v_job_status, '') = 'paid' AND coalesce(v_rev, 0) > coalesce(v_pm, 0) + 0.01 THEN")
    const link = newestBody(PAYMENT_LINK_RPC)
    expect(link).toContain("IF v_elem ? 'payment_id'")
    expect(link).toContain('Recorded payment is already linked to a bank transaction')
    expect(link).toContain('Allocations exceed remaining on bank transaction')
    expect(link).toContain('reference_number = coalesce(nullif(trim(reference_number), \'\'), v_ref)')
  })
  it('offers the Job window’s kinds but In kind', () => {
    expect([...PAYMENT_TYPES]).toEqual(PAYMENT_KIND_CHOICES.filter((k) => !/in kind/i.test(k)))
    expect(paymentTypeAsWritten('wire')).toBe('Wire')
    expect(paymentTypeAsWritten('ach')).toBe('ACH')
    expect(paymentTypeAsWritten('card')).toBe('Card (external)')
    expect(paymentTypeAsWritten('gift')).toBeNull()
  })
})

describe('devMcpJobPayment — the input', () => {
  const bad = (payment: unknown, verb: 'plan_job_payment' | 'apply_job_payment' = 'plan_job_payment', extra: Record<string, unknown> = {}): string => {
    const built = jobPaymentInput(verb, { payment, ...extra }, TODAY)
    if (built.ok) throw new Error('expected a refusal')
    return built.error
  }
  it('needs an action and its ids', () => {
    expect(bad(undefined)).toContain('needs payment')
    expect(bad({ action: 'void', payment_id: SHELL_PAY })).toContain('needs payment')
    expect(bad({ action: 'remove', payment_id: 'JP5501', reason: 'x' })).toContain('needs payment')
    expect(bad({ action: 'record', job_id: 'J5501', amount: 5, paid_on: TODAY })).toContain('needs payment')
  })
  it('refuses a remove with no reason', () => {
    expect(bad({ action: 'remove', payment_id: SHELL_PAY })).toContain('a remove needs reason')
    expect(bad({ action: 'remove', payment_id: SHELL_PAY, reason: '   ' })).toContain('a remove needs reason')
    expect(bad({ action: 'remove', payment_id: SHELL_PAY, reason: 'x'.repeat(501) })).toContain('under 500')
    expect(shaped(REMOVE)).toEqual({ action: 'remove', payment_id: SHELL_PAY, reason: REMOVE.reason })
    expect(shaped({ ...REMOVE, unlink_bank: true })).toMatchObject({ unlink_bank: true })
  })
  it('records dollars received on a day that has happened, with a kind off the Job window’s list', () => {
    expect(bad({ action: 'record', job_id: SHELL, amount: 0, paid_on: TODAY })).toContain('more than 0')
    expect(bad({ action: 'record', job_id: SHELL, amount: -5, paid_on: TODAY })).toContain('never as a negative row')
    expect(bad({ action: 'record', job_id: SHELL, amount: 5, paid_on: '11/03/2026' })).toContain('YYYY-MM-DD')
    expect(bad({ action: 'record', job_id: SHELL, amount: 5, paid_on: '2026-11-12' })).toContain('ahead of today')
    expect(bad({ action: 'record', job_id: SHELL, amount: 5, paid_on: TODAY, payment_type: 'In kind' })).toContain('in kind question')
    expect(bad({ action: 'record', job_id: SHELL, amount: 5, paid_on: TODAY, payment_type: 'barter' })).toContain('one of Cash, Check, Wire')
    expect(shaped({ action: 'record', job_id: SHELL.toUpperCase(), amount: '$1,000.50', paid_on: '2026-03-02', payment_type: 'wire', reference_number: ' ZZ-WIRE-1 ' })).toEqual({ action: 'record', job_id: SHELL, amount: 1000.5, paid_on: '2026-03-02', payment_type: 'Wire', reference_number: 'ZZ-WIRE-1' })
  })
  it('links to a bank row or changes a word, never nothing', () => {
    expect(bad({ action: 'link', payment_id: SHELL_PAY })).toContain('Nothing to do')
    expect(bad({ action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: 'the March wire' })).toContain('mercury_transactions.id')
    expect(shaped({ action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: WIRE, payment_type: 'Wire' })).toEqual({ action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: WIRE, payment_type: 'Wire' })
  })
  it('apply quotes the plan’s hash, and the registry hands the payload on', () => {
    expect(bad(REMOVE, 'apply_job_payment')).toContain('needs plan_hash')
    const built = writeRpcBody('apply_job_payment', { payment: REMOVE, plan_hash: 'a'.repeat(64) })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', target: SHELL_PAY, planHash: 'a'.repeat(64) })
    expect(writeRpcBody('plan_job_payment', { payment: { action: 'remove', payment_id: SHELL_PAY } })).toMatchObject({ ok: false })
  })
})

describe('devMcpJobPayment — the read', () => {
  it('reads the row, its job, every payment on the job, its bills and the bank row, as columns the tables have', async () => {
    const rest = fakeRest(standingWorld())
    const world = await readJobPaymentWorld(rest, shaped({ action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: WIRE }))
    expect(world.row?.id).toBe(SHELL_PAY)
    expect(world.job?.id).toBe(SHELL)
    expect(world.payments.map((r) => r.id)).toEqual([SHELL_PAY])
    expect(world.bank?.id).toBe(WIRE)
    // The wire already pays the real job's row.
    expect(world.bankUse).toEqual([{ ...realPayment() }].map((r) => expect.objectContaining({ id: r.id, job_id: REAL })))
    expect(rest.asked.map((a) => a.split('?')[0])).toEqual(['jobs_ledger_payments', 'jobs_ledger', 'jobs_ledger_payments', 'jobs_ledger_invoices', 'mercury_transactions', 'jobs_ledger_payments'])
  })
  it('a row RLS hides reads as no row, and no job is asked for', async () => {
    const rest = fakeRest(standingWorld({ jobs_ledger_payments: [] }))
    const world = await readJobPaymentWorld(rest, shaped(REMOVE))
    expect(world.row).toBeNull()
    expect(rest.asked).toHaveLength(1)
    expect(jobPaymentDryRun(shaped(REMOVE), world)).toEqual({ ok: false, refused: expect.stringContaining('No payment') })
  })
})

describe('devMcpJobPayment — remove', () => {
  it('reads the shell’s unbacked row as it stands and what the job reads after', async () => {
    const r = await reply(REMOVE)
    expect(r.job).toMatchObject({ id: SHELL, label: 'JP5501', status: 'paid', job_total: 1000, paid: 1000, balance: 0 })
    expect(r.payments).toEqual([expect.objectContaining({ id: SHELL_PAY, amount: 1000, paid_on: '2026-03-02', payment_type: null, reference_number: null, bank_row: null, typed_in_on: '2026-06-02' })])
    expect(r.removes).toMatchObject({ id: SHELL_PAY, backing: 'nothing stands behind it: no bank row, no type and no reference' })
    expect(r.after).toMatchObject({ paid: 0, balance: 1000, status: 'billed' })
    expect((r.after as { status_words: string }).status_words).toContain('reads Paid today and would no longer cover its total')
    expect(r.sets_off).toContain('the job moves from Paid back to Billed through update_job_status')
    expect(r.sends).toContain('Nothing goes to the customer')
    expect(r.note_on_activity).toBe('Payment removed: $1,000.00 dated 2026-03-02 (nothing stands behind it: no bank row, no type and no reference). Reason: typed in June with no deposit behind it; the wire is on the real job')
    expect(r.no_undo).toContain('not restored')
  })
  it('leaves a job’s status alone when the rows left still cover the total', async () => {
    const data = standingWorld({ jobs_ledger_payments: [shellPayment(), shellPayment({ id: REAL_PAY, job_id: SHELL, sequence_order: 1, payment_type: 'Check', reference_number: '1042' })] })
    const r = await reply(REMOVE, data)
    expect(r.after).toMatchObject({ paid: 1000, balance: 0, status: 'paid' })
    expect(r.sets_off).not.toContain('the job moves from Paid back to Billed through update_job_status')
  })
  it('a bill the row sat on reads Billed again', async () => {
    const data = standingWorld({ jobs_ledger_payments: [shellPayment({ invoice_id: BILL }), realPayment()], jobs_ledger_invoices: [bill()] })
    expect((await reply(REMOVE, data)).after).toMatchObject({ bill: { id: BILL, status_now: 'paid', status_after: 'billed' } })
  })
  it('refuses a row Stripe holds: a credit note, a bill paid in Stripe, a payment Stripe wrote', async () => {
    expect(await refusal(REMOVE, standingWorld({ jobs_ledger_payments: [shellPayment({ stripe_credit_note_id: 'cn_zz_1' })] }))).toContain('credit note')
    expect(await refusal(REMOVE, standingWorld({ jobs_ledger_payments: [shellPayment({ invoice_id: BILL })], jobs_ledger_invoices: [bill({ stripe_invoice_id: 'in_zz_1', stripe_invoice_status: 'paid' })] }))).toContain('marked paid in Stripe')
    expect(await refusal(REMOVE, standingWorld({ jobs_ledger_payments: [shellPayment({ note: 'Stripe' })] }))).toContain('Stripe recorded this payment itself')
    // A check on an open Stripe bill Stripe never heard of is an ordinary row.
    expect(stripeHoldsRow(shellPayment({ invoice_id: BILL }), [bill({ stripe_invoice_id: 'in_zz_1', stripe_invoice_status: 'open' })])).toBeNull()
  })
  it('refuses a row with a bank deposit behind it unless unlink_bank, and then says where the deposit goes', async () => {
    const onReal = { action: 'remove', payment_id: REAL_PAY, reason: 'applied to the wrong job' }
    const why = await refusal(onReal)
    expect(why).toContain('a bank deposit stands behind it: $1,000.00 posted 2026-03-02 from ZZ TEST Builder LLC')
    expect(why).toContain('Pass unlink_bank: true')
    const r = await reply({ ...onReal, unlink_bank: true })
    expect(r.sets_off).toContain('the bank deposit is free in Accounts Receivable again, to be matched to the job it paid')
    expect(String(r.door)).toContain("Accounts Receivable's Unlink and remove")
    const returned = await reply({ ...onReal, unlink_bank: true }, standingWorld({ mercury_transactions: [wire({ status: 'failed' })] }))
    expect((returned.sets_off as string[]).join(' ')).toContain('marked returned in Accounts Receivable')
  })
  it('the hash commits to the job’s rows: a change since the plan moves it', async () => {
    const a = await plan(REMOVE)
    const b = await plan(REMOVE)
    if (!a.dry.ok || !b.dry.ok) throw new Error('expected plans')
    const hash = await planHash('plan_job_payment', a.p, a.dry.reply)
    expect(await planHash('plan_job_payment', b.p, b.dry.reply)).toBe(hash)
    for (const data of [
      standingWorld({ jobs_ledger: [shellJob({ updated_at: '2026-11-11T16:00:00+00:00' })] }),
      standingWorld({ jobs_ledger_payments: [shellPayment({ reference_number: 'added since' })] }),
      standingWorld({ jobs_ledger_payments: [shellPayment(), shellPayment({ id: REAL_PAY, job_id: SHELL, amount: 250, sequence_order: 1 })] }),
    ]) {
      const c = await plan(REMOVE, data)
      if (!c.dry.ok) throw new Error('expected a plan')
      expect(await planHash('plan_job_payment', c.p, c.dry.reply)).not.toBe(hash)
    }
  })
})

describe('devMcpJobPayment — record', () => {
  const RECORD = { action: 'record', job_id: SHELL, amount: 250, paid_on: '2026-11-03', payment_type: 'Check', reference_number: '1042' }
  it('writes the row the Job window’s payments table writes, after the job’s last', async () => {
    const { p, world } = await plan(RECORD)
    const row = paymentInsertRow(p as PaymentRecord, world)
    expect(row).toEqual({ job_id: SHELL, amount: 250, sequence_order: 1, paid_on: '2026-11-03', sent_on: null, note: null, payment_type: 'Check', reference_number: '1042', invoice_id: null, mercury_transaction_id: null })
    const formRow = paymentInsertRows(SHELL, [{ id: 'x', amount: '250', paid_on: '2026-11-03', sent_on: '', note: '', payment_type: 'Check', reference_number: '1042', invoice_id: null, mercury_transaction_id: null } as unknown as PaymentRow])[0]!
    expect(Object.keys(row).sort()).toEqual(Object.keys(formRow).sort())
  })
  it('says what the job reads after and what an insert sets off', async () => {
    const r = await reply(RECORD)
    expect(r.after).toMatchObject({ paid: 1250, balance: -250, status: 'paid' })
    expect(r.warnings).toEqual(['The paid figure would pass the job total by $250.00.'])
    expect((r.sets_off as string[]).join(' ')).toContain("the office's payment email is queued")
    expect((r.sets_off as string[]).join(' ')).toContain('a check with no deposit tied to it opens a case')
    expect(r.note_on_activity).toBeNull()
    const withReason = await reply({ ...RECORD, reason: 'the builder mailed a second check' })
    expect(withReason.note_on_activity).toBe('Payment recorded: $250.00 dated 2026-11-03, Check, reference 1042. Reason: the builder mailed a second check')
  })
  it('refuses the same amount on the same day twice unless duplicate_ok, and warns on a row that says nothing', async () => {
    const twin = { action: 'record', job_id: SHELL, amount: 1000, paid_on: '2026-03-02' }
    expect(await refusal(twin)).toContain('counts it twice')
    const r = await reply({ ...twin, duplicate_ok: true })
    expect((r.warnings as string[]).join(' ')).toContain('no type and no reference')
  })
  it('refuses a job RLS hides', async () => {
    expect(await refusal({ action: 'record', job_id: BILL, amount: 5, paid_on: TODAY })).toContain('No job')
  })
})

describe('devMcpJobPayment — link', () => {
  it('will not tie the shell’s row to the wire that already pays the real job', async () => {
    const why = await refusal({ action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: WIRE })
    expect(why).toContain('That deposit is $1,000.00 and $1,000.00 of it already pays another payment row')
    expect(why).toContain(REAL_PAY)
    expect(why).toContain('One deposit pays once')
  })
  it('ties a hand-recorded row to a free deposit through Accounts Receivable’s RPC', async () => {
    const data = standingWorld({ jobs_ledger_payments: [shellPayment()] })
    const ask = { action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: WIRE, payment_type: 'wire' }
    const { p, world, dry } = await plan(ask, data)
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply.ties).toMatchObject({ bank_row: { id: WIRE, amount: 1000, posted_on: '2026-03-02', from: 'ZZ TEST Builder LLC' }, left_on_the_deposit_after: 0 })
    expect(dry.reply.words_after).toEqual({ payment_type: 'Wire' })
    expect(dry.reply.after).toMatchObject({ paid: 1000, status: 'paid' })
    expect((dry.reply.sets_off as string[]).join(' ')).toContain("the row's reference becomes the bank's own id")
    expect(dry.reply.note_on_activity).toBe('Payment of $1,000.00 dated 2026-03-02 tied to the bank deposit of $1,000.00 posted 2026-03-02 from ZZ TEST Builder LLC.')
    expect(paymentLinkRpcBody(p as PaymentLink, world.row!)).toEqual({ p_mercury_transaction_id: WIRE, p_paid_on: '2026-03-02', p_payment_type: '', p_note: '', p_allocations: [{ payment_id: SHELL_PAY }], p_allow_stripe_hosted: false })
    expect(paymentWordsPatch(p as PaymentLink, world.row!)).toEqual({ payment_type: 'Wire' })
  })
  it('refuses a row already tied, money out, a returned deposit, a hidden bank row and a bill Stripe hosts', async () => {
    expect(await refusal({ action: 'link', payment_id: REAL_PAY, mercury_transaction_id: WIRE })).toContain('already tied to that bank row')
    const free = (over = {}) => standingWorld({ jobs_ledger_payments: [shellPayment()], mercury_transactions: [wire(over)] })
    const ask = { action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: WIRE }
    expect(await refusal(ask, free({ amount: -1000 }))).toContain('money out, not a deposit')
    expect(await refusal(ask, free({ status: 'failed' }))).toContain('The bank returned that deposit')
    expect(await refusal(ask, standingWorld({ jobs_ledger_payments: [shellPayment()], mercury_transactions: [] }))).toContain('No bank row')
    expect(await refusal(ask, standingWorld({ jobs_ledger_payments: [shellPayment({ invoice_id: BILL })], jobs_ledger_invoices: [bill({ stripe_invoice_id: 'in_zz_1', stripe_invoice_status: 'open' })] }))).toContain('a bill Stripe hosts')
  })
  it('warns when the deposit and the payment differ in amount or by more than ten days', async () => {
    const data = standingWorld({ jobs_ledger_payments: [shellPayment({ amount: 400, paid_on: '2026-04-20' })] })
    const r = await reply({ action: 'link', payment_id: SHELL_PAY, mercury_transaction_id: WIRE }, data)
    expect(r.warnings).toEqual(['The deposit is $1,000.00 and the payment $400.00: the deposit keeps $600.00 to match elsewhere.', "The deposit posted 2026-03-02 and the payment is dated 2026-04-20, more than ten days apart. The link leaves the payment's date as it is."])
  })
  it('changes a row’s words alone, and refuses when they already read that way', async () => {
    const r = await reply({ action: 'link', payment_id: SHELL_PAY, payment_type: 'Wire', reference_number: 'ZZ-WIRE-1', reason: 'named from the bank statement' })
    expect(r.words_after).toEqual({ payment_type: 'Wire', reference_number: 'ZZ-WIRE-1' })
    expect(r.ties).toBeUndefined()
    expect(r.note_on_activity).toBe('Payment of $1,000.00 dated 2026-03-02 changed: payment type set to Wire, reference number set to ZZ-WIRE-1. Reason: named from the bank statement')
    expect(await refusal({ action: 'link', payment_id: REAL_PAY, payment_type: 'Wire' })).toContain('already reads that way')
  })
})

describe('devMcpJobPayment — the words', () => {
  it('says what stands behind a row', () => {
    expect(paymentBackingWords(shellPayment(), null)).toBe('nothing stands behind it: no bank row, no type and no reference')
    expect(paymentBackingWords(shellPayment({ payment_type: 'Check', reference_number: '1042' }), null)).toBe('no bank row is tied to it; it was typed as Check, reference 1042')
    expect(paymentBackingWords(realPayment(), null)).toBe('a bank row is tied to it, which this account could not read')
  })
  it('a record or a word change with no reason leaves no note', async () => {
    const { p, world } = await plan({ action: 'link', payment_id: SHELL_PAY, payment_type: 'Wire' })
    expect(paymentNoteBody(p, world)).toBeNull()
  })
  it('the apply says what landed, the job read back, and whether the note landed', () => {
    const p = shaped(REMOVE)
    expect(jobPaymentAppliedWords(p, 'JP5501', { ok: true, detail: { rpc: { ok: true, payments_made: 0 } }, after: { paid: 0, status: 'billed' }, note: { id: 'n1' } })).toMatchObject({
      action: 'remove', job: 'JP5501', ok: true, after: { paid: 0, status: 'billed', status_words: 'Billed' }, note_on_activity: { written: true, id: 'n1' }, next: expect.stringContaining('the paid figure at $0.00'),
    })
    expect(jobPaymentAppliedWords(p, 'JP5501', { ok: true, detail: {}, after: null, note: { error: 'RLS' } })).toMatchObject({ note_on_activity: { written: false, why: 'RLS' } })
    expect(jobPaymentAppliedWords(p, 'JP5501', { ok: false, error: 'Payment not found' })).toEqual({ action: 'remove', job: 'JP5501', ok: false, error: 'Payment not found' })
  })
})
