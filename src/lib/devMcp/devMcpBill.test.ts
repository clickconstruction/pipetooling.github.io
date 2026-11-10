import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BILL_LINK_PLACEHOLDER,
  BILL_TIE_COLUMN,
  BILL_VERBS,
  STRIPE_MODES,
  billAppliedWords,
  billDryRun,
  billInput,
  billNumberRefusal,
  billedLineFor,
  fullyInvoiced,
  isBillVerb,
  isFirstTextOn,
  numberOrder,
  pickEmail,
  pickNumber,
  readBillWorld,
  remainderCents,
  signatureFor,
  stripeJobNumber,
  withBillLink,
  type BillPayload,
  type BillReads,
  type BillWorld,
  type ChannelRow,
} from '../../../supabase/functions/_shared/devMcpBill'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { BILLED_LINE } from '../tellCustomer/billedLine'
import { DEFAULT_LINES, tellFills, tellWords } from '../tellCustomer/tellCustomer'
import { buildStripeInvoiceEmailBody, buildStripeInvoiceEmailSubject } from '../stripeInvoiceShareCopy'
import { signatureLines } from '../messages/compose'
import { billEmailChannel } from '../jobs/billShareDoors'
import { numberOrder as appNumberOrder } from '../messages/compose'
import { PIPETOOLING_STRIPE_INVOICE_NUMBER_HCP_ERROR } from '../../../supabase/functions/_shared/pipetoolingStripeInvoiceNumber'
import { letterheadFor } from '../../../supabase/functions/_shared/messagesEmail'
import { customerLang } from '../messages/customerLang'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const MODAL = readFileSync('src/components/jobs/SendRecordInvoiceModal.tsx', 'utf8')

const JOB = '99999999-1111-4111-8111-111111111111'
const INV = '88888888-1111-4111-8111-111111111111'
const INV2 = '88888888-2222-4222-8222-222222222222'
const CUSTOMER = 'aaaaaaaa-1111-4111-8111-111111111111'
const CONTACT = 'cccccccc-1111-4111-8111-111111111111'
const PHONE1 = 'dddddddd-1111-4111-8111-111111111111'
const PHONE2 = 'dddddddd-2222-4222-8222-222222222222'
const EMAIL1 = 'dddddddd-3333-4333-8333-333333333333'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const TODAY = '2026-11-09'
const ME = { userId: DEV, name: 'Dev One' }

const make = (over: Record<string, unknown> = {}): BillPayload => {
  const built = billInput('plan_bill', { bill: { job_id: JOB, stripe_mode: 'test', send: { text: true }, ...over } }, TODAY)
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const channel = (over: Partial<ChannelRow> & Pick<ChannelRow, 'id' | 'kind' | 'value'>): ChannelRow => ({ opted_out_at: null, usual_at: null, created_at: '2026-10-01T00:00:00+00:00', ...over })
const world = (over: Partial<BillWorld> = {}): BillWorld => ({
  me: ME,
  job: { id: JOB, job_name: 'ZZ TEST seat walk', job_address: '123 Main St', status: 'ready_to_bill', revenue: 1, payments_made: 0, customer_id: CUSTOMER, customer_name: 'ZZ Test Customer', customer_email: 'zz@example.com', bill_to_party: 'customer', click_number: '', hcp_number: '4411' },
  invoice: null,
  invoices: [{ id: INV, job_id: JOB, status: 'ready_to_bill', amount: 1, is_primary_rtb_bundle: true, stripe_invoice_id: null, hosted_invoice_url: null, pay_code: null, stripe_mode: null, billed_at: null, created_at: '2026-11-09T00:00:00+00:00' }],
  payments: [],
  customer: { id: CUSTOMER, name: 'ZZ Test Customer', language: null },
  contactId: CONTACT,
  channels: [channel({ id: PHONE1, kind: 'phone', value: '(512) 555-0100' }), channel({ id: EMAIL1, kind: 'email', value: 'zz@example.com' })],
  lines: [],
  textsOn: true,
  officeLines: [],
  sender: { id: DEV, name: 'Dev One', title: 'Office', phone: '512-555-0199', signature_lines: ['Mon–Fri 8–5'] },
  ...over,
})

describe('devMcpBill — the verbs on the allowlist', () => {
  it('are two write verbs with no RPC, the shape checked by the server with the day, and the docs carry them', () => {
    expect(BILL_VERBS).toEqual(['plan_bill', 'apply_bill'])
    for (const v of BILL_VERBS) {
      expect(isBillVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_bill')).toBe('plan_bill')
    expect(writeRpcBody('plan_bill', { bill: { job_id: JOB } })).toMatchObject({ ok: true, rpc: null, body: { p: { bill: { job_id: JOB } } } })
    expect(writeRpcBody('apply_bill', { bill: {} })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(SERVER).toContain('Writes are seventy-three verbs and nothing else:')
    expect(SERVER).toContain("const shaped = billInput(name, args, todayYmdInAppTz())")
    expect(README).toContain('`plan_bill(bill)` · `apply_bill(bill, plan_hash)`')
    expect([...STRIPE_MODES]).toEqual(['test', 'live'])
    expect(BILL_TIE_COLUMN).toBe('jobs_ledger_id')
  })
  it('the server runs the modal’s doors in the modal’s order, each the app’s own', () => {
    const at = (s: string) => {
      const i = SERVER.indexOf(s)
      expect(i, s).toBeGreaterThan(0)
      return i
    }
    const ensure = at("restPost(session, 'rpc/ensure_single_ready_to_bill_invoice_for_job', { p_job_id: job.id })")
    const create = at("invokeAsDev(session, 'create-stripe-invoice', {")
    const promote = at("restPost(session, 'rpc/update_job_status', { p_job_id: job.id, p_to_status: 'billed' })")
    const code = at("restPost(session, 'rpc/bill_pay_code', { p_invoice_id: invoice.id })")
    const contact = at("restPost(session, 'rpc/contact_for_customer', { p_customer_id: job.customer_id })")
    const text = at("invokeAsDev(session, 'quo-send', { contactId, channelId: planned.text.channel_id, tie, body: withBillLink(planned.text.words, link), held: false })")
    const email = at("invokeAsDev(session, 'messages-email', { contactId, channelId: planned.email.channel_id, tie, subject: planned.email.subject, body: withBillLink(planned.email.body, link), signature: planned.email.signature })")
    expect(ensure).toBeLessThan(create)
    expect(create).toBeLessThan(promote)
    expect(promote).toBeLessThan(code)
    expect(code).toBeLessThan(contact)
    expect(contact).toBeLessThan(text)
    expect(text).toBeLessThan(email)
    // The modal's own body, field for field (submitStripeInvoice).
    for (const key of ['jobs_ledger_invoice_id', 'customer_id', 'amount_dollars', 'customer_email', 'customer_name', 'due_date', 'memo']) expect(MODAL).toContain(`${key}:`)
    expect(MODAL).toContain('...stripeModeInvokeBody(stripeModeForBilling)') // the mode, as the modal passes it
    expect(SERVER).toContain("customer_name: (job.customer_name ?? '').trim() || 'Customer'")
    expect(MODAL).toContain("customer_name: (job.customer_name ?? '').trim() || 'Customer'")
  })
})

describe('billInput — the shape', () => {
  it('needs the job and an explicit mode, fills today for the due date, keeps the memo and the sends as asked', () => {
    expect(make()).toEqual({ action: 'make', job_id: JOB, stripe_mode: 'test', due_date: TODAY, send: { text: true, email: null } })
    expect(make({ due_date: '2026-12-01', memo: ' Thank you ', send: { text: '(512) 555-0100', email: true } })).toMatchObject({ due_date: '2026-12-01', memo: 'Thank you', send: { text: '(512) 555-0100', email: true } })
    expect(make({ send: undefined })).toMatchObject({ send: { text: null, email: null } })
    expect(billInput('plan_bill', { bill: { job_id: JOB } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('stripe_mode is required') })
    expect(billInput('plan_bill', { bill: { job_id: JOB, stripe_mode: 'sandbox' } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('test or live') })
    expect(billInput('plan_bill', { bill: { job_id: 'JP972', stripe_mode: 'test' } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('find_job') })
    expect(billInput('plan_bill', { bill: { job_id: JOB, stripe_mode: 'test', due_date: 'Dec 1' } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('YYYY-MM-DD') })
    expect(billInput('plan_bill', { bill: { job_id: JOB, stripe_mode: 'test', send: { text: 5 } } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('send.text') })
    expect(billInput('plan_bill', { bill: { job_id: JOB, stripe_mode: 'test', send: 'text' } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('send is') })
    expect(billInput('plan_bill', {}, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('plan_bill needs bill') })
  })
  it('action send needs the bill and at least one send; apply needs the hash', () => {
    expect(billInput('plan_bill', { bill: { action: 'send', invoice_id: INV, send: { email: true } } }, TODAY)).toMatchObject({ ok: true, p: { action: 'send', invoice_id: INV, send: { text: null, email: true } }, target: INV })
    expect(billInput('plan_bill', { bill: { action: 'send', invoice_id: INV } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('needs send') })
    expect(billInput('plan_bill', { bill: { action: 'send', send: { text: true } } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('invoice_id') })
    expect(billInput('plan_bill', { bill: { action: 'void', invoice_id: INV } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('make (left out) or send') })
    expect(billInput('apply_bill', { bill: { job_id: JOB, stripe_mode: 'test' } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(billInput('apply_bill', { bill: { job_id: JOB, stripe_mode: 'test' }, plan_hash: HASH }, TODAY)).toMatchObject({ ok: true, planHash: HASH, target: JOB })
  })
})

describe('readBillWorld — the reads the door sees', () => {
  it('reads the job, its lines and payments, the customer, their contact, numbers and texts, the switch, the office line and the sender', async () => {
    const seen: string[] = []
    const reads: BillReads = {
      rows: async (table, query) => {
        seen.push(`${table}?${query}`)
        if (table === 'jobs_ledger') return [world().job as Record<string, unknown>]
        if (table === 'contacts') return [{ id: CONTACT }]
        if (table === 'app_settings') return [{ key: 'messages_texts_on_v1', value_text: 'true' }]
        if (table === 'quick_replies') return [{ id: 'q1', text: 'team line {bill}', text_es: null, scope: 'team', added_by: 'x', added_at: '1' }, { id: 'q2', text: 'someone else’s {bill}', text_es: null, scope: 'mine', added_by: 'other', added_at: '2' }, { id: 'q3', text: 'my own {bill}', text_es: null, scope: 'mine', added_by: DEV, added_at: '3' }]
        if (table === 'users') return [{ id: DEV, name: 'Dev One', title: null, phone: null, signature_lines: null }]
        return []
      },
    }
    const w = await readBillWorld(reads, make(), ME)
    expect(seen).toContain(`jobs_ledger?select=id,job_name,job_address,status,revenue,payments_made,customer_id,customer_name,customer_email,bill_to_party,click_number,hcp_number&id=eq.${JOB}`)
    expect(seen).toContain(`jobs_ledger_invoices?select=id,job_id,status,amount,is_primary_rtb_bundle,stripe_invoice_id,hosted_invoice_url,pay_code,stripe_mode,billed_at,created_at&job_id=eq.${JOB}&order=created_at`)
    expect(seen).toContain(`jobs_ledger_payments?select=invoice_id,amount&job_id=eq.${JOB}`)
    expect(seen).toContain(`customers?select=id,name,language&id=eq.${CUSTOMER}`)
    expect(seen).toContain(`contacts?select=id&customer_id=eq.${CUSTOMER}&name=is.null&order=created_at&limit=1`)
    expect(seen).toContain(`contact_channels?select=id,kind,value,opted_out_at,usual_at,created_at&contact_id=eq.${CONTACT}&order=created_at`)
    expect(seen).toContain(`messages?select=channel_id,at,direction&contact_id=eq.${CONTACT}&channel=eq.text&order=at.desc&limit=200`)
    expect(seen).toContain('app_settings?select=key,value_text&key=eq.messages_texts_on_v1')
    expect(seen).toContain('quick_replies?select=id,text,text_es,scope,added_by,added_at&for_kind=eq.customer&step_key=eq.billed&removed_at=is.null&order=added_at')
    expect(seen).toContain(`users?select=id,name,title,phone,signature_lines&id=eq.${DEV}`)
    expect(w.textsOn).toBe(true)
    // The team's lines and my own are visible; another person's private line is not (qrVisible's rule).
    expect(w.officeLines.map((l) => l.id)).toEqual(['q1', 'q3'])
  })
  it('action send reads the bill first and the job through it, never the job’s other lines', async () => {
    const seen: string[] = []
    const reads: BillReads = {
      rows: async (table, query) => {
        seen.push(`${table}?${query}`)
        if (table === 'jobs_ledger_invoices') return [{ ...world().invoices[0], job_id: JOB }]
        if (table === 'jobs_ledger') return [world().job as Record<string, unknown>]
        return []
      },
    }
    const p = billInput('plan_bill', { bill: { action: 'send', invoice_id: INV, send: { text: true } } }, TODAY)
    if (!p.ok) throw new Error(p.error)
    const w = await readBillWorld(reads, p.p, ME)
    expect(seen[0]).toContain(`jobs_ledger_invoices?select=`)
    expect(seen[0]).toContain(`&id=eq.${INV}`)
    expect(seen.some((s) => s.includes(`job_id=eq.${JOB}&order=created_at`))).toBe(false)
    expect(w.invoice?.id).toBe(INV)
    expect(w.contactId).toBeNull()
  })
})

describe('the arithmetic — the RPC’s remainder and the modal’s promotion', () => {
  const job = { revenue: 1000, payments_made: 100 }
  it('the remainder leaves the primary bundle out and nets every other open line of its payments', () => {
    expect(remainderCents(job, [], [])).toBe(90000)
    expect(remainderCents(job, [{ id: INV, status: 'ready_to_bill', amount: 900, is_primary_rtb_bundle: true }], [])).toBe(90000)
    expect(remainderCents(job, [{ id: INV2, status: 'billed', amount: 400, is_primary_rtb_bundle: false }], [{ invoice_id: INV2, amount: 100 }])).toBe(60000)
    expect(remainderCents({ revenue: 1, payments_made: 0 }, [{ id: INV, status: 'billed', amount: 1, is_primary_rtb_bundle: false }], [])).toBe(0)
    expect(remainderCents({ revenue: '1.00', payments_made: null }, [], [])).toBe(100)
  })
  it('the job is fully invoiced when no Ready to Bill line is left and the gross is on lines', () => {
    expect(fullyInvoiced({ revenue: 1, payments_made: 0 }, [{ id: INV, status: 'billed', amount: 1, is_primary_rtb_bundle: false }], [])).toBe(true)
    expect(fullyInvoiced({ revenue: 1, payments_made: 0 }, [{ id: INV, status: 'billed', amount: 1, is_primary_rtb_bundle: false }, { id: INV2, status: 'ready_to_bill', amount: 0, is_primary_rtb_bundle: false }], [])).toBe(false)
    expect(fullyInvoiced({ revenue: 2, payments_made: 0 }, [{ id: INV, status: 'billed', amount: 1, is_primary_rtb_bundle: false }], [])).toBe(false)
  })
})

describe('the picks — the sheet’s number, the share row’s address', () => {
  const stopped = channel({ id: PHONE1, kind: 'phone', value: '(512) 555-0100', opted_out_at: '2026-10-01T00:00:00+00:00' })
  const usual = channel({ id: PHONE2, kind: 'phone', value: '(512) 555-0200', usual_at: '2026-10-05T00:00:00+00:00', created_at: '2026-10-02T00:00:00+00:00' })
  it('orders the numbers as compose.numberOrder does: STOP last, the usual first, then the last line, then the oldest', () => {
    const chans = [stopped, usual, channel({ id: EMAIL1, kind: 'email', value: 'a@b.co' }), channel({ id: 'p3', kind: 'phone', value: '(512) 555-0300', created_at: '2026-10-03T00:00:00+00:00' })]
    const lines = [{ channel_id: 'p3', at: '2026-11-01T00:00:00+00:00', direction: 'in' }]
    expect(numberOrder(chans, lines).map((c) => c.id)).toEqual([PHONE2, 'p3', PHONE1])
    const appOrder = appNumberOrder(
      { channels: chans.map((c) => ({ id: c.id, kind: c.kind as 'phone' | 'email', value: c.value, optedOutAt: c.opted_out_at, usualAt: c.usual_at })) },
      lines.map((l) => ({ channelId: l.channel_id, at: l.at, direction: l.direction as 'in' })),
    ).map((c) => c.id)
    expect(numberOrder(chans, lines).map((c) => c.id)).toEqual(appOrder)
  })
  it('picks the number the sheet would, or the one named, and refuses in words when none can take a text', () => {
    const w = world({ channels: [stopped, usual] })
    expect(pickNumber(true, w, 'Robert')).toEqual({ ok: true, channel: { id: PHONE2, value: '(512) 555-0200' } })
    expect(pickNumber('512-555-0200', w, 'Robert')).toEqual({ ok: true, channel: { id: PHONE2, value: '(512) 555-0200' } })
    expect(pickNumber('5125550100', w, 'Robert')).toMatchObject({ ok: false, refused: expect.stringContaining('sent STOP') })
    expect(pickNumber('5125550999', w, 'Robert')).toMatchObject({ ok: false, refused: expect.stringContaining('not one of Robert') })
    expect(pickNumber(true, world({ channels: [stopped] }), 'Robert')).toMatchObject({ ok: false, refused: expect.stringContaining('every number sent STOP') })
    expect(pickNumber(true, world({ channels: [], contactId: null }), 'Robert')).toMatchObject({ ok: false, refused: expect.stringContaining('no contact yet') })
    expect(pickNumber(true, world({ textsOn: false }), 'Robert')).toMatchObject({ ok: false, refused: expect.stringContaining('Texts are off') })
  })
  it('picks the address billEmailChannel picks: the job’s customer email on the contact, else the first', () => {
    const chans = [channel({ id: 'e1', kind: 'email', value: 'first@example.com' }), channel({ id: 'e2', kind: 'email', value: 'ZZ@Example.com' })]
    expect(pickEmail(true, chans, 'zz@example.com', 'Robert')).toEqual({ ok: true, channel: { id: 'e2', value: 'ZZ@Example.com' } })
    expect(pickEmail(true, chans, null, 'Robert')).toEqual({ ok: true, channel: { id: 'e1', value: 'first@example.com' } })
    expect(pickEmail('zz@example.com', chans, null, 'Robert')).toMatchObject({ ok: true, channel: { id: 'e2' } })
    expect(pickEmail('nobody@example.com', chans, null, 'Robert')).toMatchObject({ ok: false, refused: expect.stringContaining('not one of Robert') })
    expect(pickEmail(true, [], null, 'Robert')).toMatchObject({ ok: false, refused: expect.stringContaining('no email yet') })
    const contact = { channels: chans.map((c) => ({ id: c.id, kind: 'email' as const, value: c.value, optedOutAt: null, usualAt: null })) }
    expect(billEmailChannel(contact, 'zz@example.com')?.id).toBe('e2')
    expect(billEmailChannel(contact, null)?.id).toBe('e1')
  })
  it('a first text is one with no text of ours out on the number', () => {
    expect(isFirstTextOn([], PHONE1)).toBe(true)
    expect(isFirstTextOn([{ channel_id: PHONE1, at: '1', direction: 'in' }], PHONE1)).toBe(true)
    expect(isFirstTextOn([{ channel_id: PHONE1, at: '1', direction: 'out' }], PHONE1)).toBe(false)
  })
})

describe('the words — the sheet’s line, the share row’s draft, the box’s signature', () => {
  it('the Billed line is the sheet’s own, and the office’s on the step wins', () => {
    expect(DEFAULT_LINES.billed).toBe(BILLED_LINE)
    expect(billedLineFor([])).toEqual({ line: BILLED_LINE, office: false, id: null })
    expect(billedLineFor([{ id: 'q1', text: 'Ours {bill}', text_es: null, scope: 'team', added_by: 'x', added_at: '1' }])).toEqual({ line: { text: 'Ours {bill}', textEs: null }, office: true, id: 'q1' })
  })
  it('the signature is compose.signatureLines’s, the company Click Plumbing on a job', () => {
    const sender = { id: DEV, name: 'Dev One', title: 'Office', phone: '512-555-0199', signature_lines: ['Mon–Fri 8–5', 'Se habla español', 'a third line dropped'] }
    const company = { name: letterheadFor('jobs_ledger_id') }
    expect(signatureFor(sender)).toEqual(signatureLines({ name: 'Dev One', title: 'Office', cell: '512-555-0199', lines: ['Mon–Fri 8–5', 'Se habla español', 'a third line dropped'] }, company))
    expect(signatureFor(null)).toEqual([company.name])
    expect(signatureFor(sender)).toHaveLength(5)
  })
  it('the real link goes where the placeholder sat', () => {
    expect(withBillLink(`Pay it here: ${BILL_LINK_PLACEHOLDER}`, 'https://my.clickplumbing.com/pay/a2fvn3pqgq')).toBe('Pay it here: https://my.clickplumbing.com/pay/a2fvn3pqgq')
  })
})

describe('billDryRun — the plan', () => {
  it('replies with the amount, the mode, the number and the sheet’s exact words with the link a placeholder, and what happens after', () => {
    const dry = billDryRun(make({ send: { text: true, email: true } }), world())
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply).toMatchObject({
      action: 'make',
      job: { id: JOB, label: 'JP4411', status: 'ready_to_bill' },
      customer: { id: CUSTOMER, name: 'ZZ Test Customer', email: 'zz@example.com', lang: 'en', contact: 'on file' },
      bill: { amount: '$1.00', amount_cents: 100, stripe_mode: 'test', due_date: TODAY, memo: null, link: BILL_LINK_PLACEHOLDER },
      text: { channel_id: PHONE1, to: '(512) 555-0100', first_text: true, line: 'app', lang: 'en' },
      email: { channel_id: EMAIL1, to: 'zz@example.com', subject: buildStripeInvoiceEmailSubject('ZZ TEST seat walk') },
    })
    const text = dry.reply.text as { words: string }
    // The sheet's own words: tellWords over the same line and fills gives the same text.
    const sheet = tellWords(DEFAULT_LINES.billed, tellFills({ customerName: 'ZZ Test Customer', me: 'Dev One', jobName: 'ZZ TEST seat walk', jobAddress: '123 Main St', bill: { amount: '$1.00', link: BILL_LINK_PLACEHOLDER } }), 'en')
    expect(text.words).toBe(sheet.text)
    expect(text.words).toBe(`Hi ZZ, this is Dev with Click Plumbing. Your bill for ZZ TEST seat walk is ready, $1.00. Text me here with any question. Pay it here: ${BILL_LINK_PLACEHOLDER}`)
    const email = dry.reply.email as { body: string; signature: string[] }
    expect(email.body).toBe(buildStripeInvoiceEmailBody({ customerName: 'ZZ Test Customer', payUrl: BILL_LINK_PLACEHOLDER, amountLabel: '$1.00', jobName: 'ZZ TEST seat walk', hcpNumber: '4411' }))
    expect(email.signature[0]).toBe('Dev One')
    const after = dry.reply.after as string[]
    expect(after.join(' ')).toContain('moves to Billed')
    expect(after.join(' ')).toContain('first text from us')
  })
  it('a Spanish-reading customer gets the Spanish line; an office line on the step wins', () => {
    const es = billDryRun(make(), world({ customer: { id: CUSTOMER, name: 'Ana López', language: 'es' } }))
    if (!es.ok) throw new Error(es.refused)
    // The sheet's own gate (customerLang, PORTAL_SPANISH_ON): the Spanish line only while the portal speaks Spanish.
    const lang = customerLang({ lang: 'es' })
    expect((es.reply.text as { words: string; lang: string }).lang).toBe(lang)
    expect((es.reply.text as { words: string }).words.startsWith(lang === 'es' ? 'Hola Ana, soy Dev de Click Plumbing.' : 'Hi Ana, this is Dev with Click Plumbing.')).toBe(true)
    const office = billDryRun(make(), world({ officeLines: [{ id: 'q1', text: '{first}, your bill: {bill}', text_es: null, scope: 'team', added_by: 'x', added_at: '1' }] }))
    if (!office.ok) throw new Error(office.refused)
    expect(office.reply.text).toMatchObject({ line: 'office', words: `ZZ, your bill: ${BILL_LINK_PLACEHOLDER}` })
    const blank = billDryRun(make(), world({ officeLines: [{ id: 'q1', text: '{first}, {tech} will call about {bill}', text_es: null, scope: 'team', added_by: 'x', added_at: '1' }] }))
    expect(blank).toMatchObject({ ok: false, refused: expect.stringContaining('{tech}') })
  })
  it('a bill with nothing to send is made alone; another Ready to Bill line keeps the job where it is', () => {
    const dry = billDryRun(make({ send: undefined }), world({ invoices: [...world().invoices, { id: INV2, job_id: JOB, status: 'ready_to_bill', amount: 0.5, is_primary_rtb_bundle: false, stripe_invoice_id: null, hosted_invoice_url: null, pay_code: null, stripe_mode: null, billed_at: null, created_at: '2026-11-09T00:00:00+00:00' }], job: { ...world().job!, revenue: 1.5 } }))
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply.text).toBeNull()
    expect(dry.reply.email).toBeNull()
    expect(dry.reply.bill).toMatchObject({ amount: '$1.00', amount_cents: 100 })
    expect((dry.reply.after as string[]).join(' ')).toContain('stays at Ready to Bill')
    expect((dry.reply.after as string[]).join(' ')).toContain('Nothing is sent')
  })
  it('refuses a job not at Ready to Bill, no email, no customer, nothing left, two primaries, a send that cannot go', () => {
    expect(billDryRun(make(), world({ job: { ...world().job!, status: 'working' } }))).toMatchObject({ ok: false, refused: expect.stringContaining('plan_job_update') })
    expect(billDryRun(make(), world({ job: { ...world().job!, customer_email: ' ' } }))).toMatchObject({ ok: false, refused: expect.stringContaining('Customer email is required') })
    expect(billDryRun(make(), world({ job: { ...world().job!, customer_id: null } }))).toMatchObject({ ok: false, refused: expect.stringContaining('no customer') })
    expect(billDryRun(make(), world({ job: null }))).toMatchObject({ ok: false, refused: expect.stringContaining('find_job') })
    expect(billDryRun(make(), world({ job: { ...world().job!, revenue: 0 } }))).toMatchObject({ ok: false, refused: expect.stringContaining('Nothing left to bill') })
    expect(billDryRun(make(), world({ invoices: [world().invoices[0]!, { ...world().invoices[0]!, id: INV2 }] }))).toMatchObject({ ok: false, refused: expect.stringContaining('2 primary') })
    expect(billDryRun(make(), world({ channels: [] }))).toMatchObject({ ok: false, refused: expect.stringContaining('no number') })
    expect(billDryRun(make({ send: { email: true } }), world({ channels: [] }))).toMatchObject({ ok: false, refused: expect.stringContaining('no email yet') })
  })
  it('action send fills the real link, and refuses a bill that is not a billed Stripe bill', () => {
    const p = billInput('plan_bill', { bill: { action: 'send', invoice_id: INV, send: { text: true } } }, TODAY)
    if (!p.ok) throw new Error(p.error)
    const billed = { ...world().invoices[0]!, status: 'billed', stripe_invoice_id: 'in_test_1', hosted_invoice_url: 'https://invoice.stripe.com/i/x', pay_code: 'a2fvn3pqgq', stripe_mode: 'test' }
    const dry = billDryRun(p.p, world({ invoice: billed, invoices: [] }))
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply.bill).toMatchObject({ invoice_id: INV, amount: '$1.00', link: 'https://my.clickplumbing.com/pay/a2fvn3pqgq', pay_code: 'a2fvn3pqgq' })
    expect((dry.reply.text as { words: string }).words.endsWith('Pay it here: https://my.clickplumbing.com/pay/a2fvn3pqgq')).toBe(true)
    expect(billDryRun(p.p, world({ invoice: { ...billed, pay_code: null }, invoices: [] }))).toMatchObject({ ok: true, reply: { bill: { link: `https://my.clickplumbing.com/pay/${INV}`, pay_code: 'none yet — minted at apply' } } })
    expect(billDryRun(p.p, world({ invoice: world().invoices[0]!, invoices: [] }))).toMatchObject({ ok: false, refused: expect.stringContaining('only a billed Stripe bill') })
    expect(billDryRun(p.p, world({ invoice: null }))).toMatchObject({ ok: false, refused: expect.stringContaining('No bill') })
  })
  it('hashes the lines, the amount, the number and the words, so a payment, a new line or a changed number refuses the apply', async () => {
    const p = make()
    const a = billDryRun(p, world())
    const b = billDryRun(p, world({ payments: [{ invoice_id: INV, amount: 0.25 }], job: { ...world().job!, payments_made: 0.25 } }))
    const c = billDryRun(p, world({ channels: [channel({ id: PHONE2, kind: 'phone', value: '(512) 555-0200' })] }))
    if (!a.ok || !b.ok || !c.ok) throw new Error('refused')
    const ha = await planHash('plan_bill', p, a.reply)
    expect(await planHash('plan_bill', p, a.reply)).toBe(ha)
    expect(await planHash('plan_bill', p, b.reply)).not.toBe(ha)
    expect(await planHash('plan_bill', p, c.reply)).not.toBe(ha)
    expect(planReply('plan_bill', a.reply, ha).next).toContain('apply_bill')
    expect(alreadyApplied('apply_bill', { target: INV, at: null })).toContain('action: "send"')
  })
})

describe('the words after', () => {
  const bill = { invoice_id: INV, stripe_invoice_id: 'in_test_1', stripe_mode: 'test', amount: '$1.00', link: 'https://my.clickplumbing.com/pay/a2fvn3pqgq', pay_code: 'a2fvn3pqgq' }
  it('names the bill, each send’s outcome and the next press; a refused send leaves the bill standing', () => {
    const fine = billAppliedWords(make(), 'ZZ TEST seat walk', bill, { text: { sent: true, to: '(512) 555-0100', message_id: 'm1' }, email: null }, { moved: true, now: 'billed' })
    expect(fine).toMatchObject({ action: 'make', job: 'ZZ TEST seat walk', bill, status: { moved: true, now: 'billed' } })
    expect(String(fine.next)).toContain('is at Billed')
    const held = billAppliedWords(make(), 'ZZ TEST seat walk', bill, { text: { sent: false, to: '(512) 555-0100', why: 'Texts are off.' }, email: { sent: true, to: 'zz@example.com', message_id: null } }, null)
    expect(String(held.next)).toContain('The bill stands')
    expect(String(held.next)).toContain('the text did not go: Texts are off.')
    expect(String(held.next)).toContain(`action: "send", invoice_id: "${INV}"`)
    const alone = billAppliedWords(make({ send: undefined }), 'ZZ TEST seat walk', bill, { text: null, email: null }, { moved: false, now: 'ready_to_bill', why: 'another Ready to Bill line remains' })
    expect(String(alone.next)).toContain('hands it to the customer')
  })
})

describe('the bill’s number (v2.6826, found on the first seat walk)', () => {
  const CSI = readFileSync('supabase/functions/create-stripe-invoice/index.ts', 'utf8')
  it('reads the number create-stripe-invoice reads: the HCP number, else the Click number', () => {
    expect(CSI).toContain("((jobRow.hcp_number ?? '').trim() || (jobRow.click_number ?? '').trim()) || null")
    expect(CSI).toContain('buildPipetoolingStripeInvoiceNumber(effectiveJobNumber, due_date.trim(), issuedAtMs)')
    expect(stripeJobNumber({ hcp_number: ' 4411 ', click_number: '972' })).toBe('4411')
    expect(stripeJobNumber({ hcp_number: '', click_number: '972' })).toBe('972')
    expect(stripeJobNumber({ hcp_number: null, click_number: null })).toBeNull()
  })
  it('refuses in the plan a job with no number in digits, naming the press that fixes it', () => {
    const none = billDryRun(make(), world({ job: { ...world().job!, hcp_number: '', click_number: '' } }))
    expect(none).toMatchObject({ ok: false, refused: expect.stringContaining('has no HCP or Click number with digits') })
    expect(none).toMatchObject({ ok: false, refused: expect.stringContaining('plan_job_update { job_id, set: { click_number } }') })
    expect(none).toMatchObject({ ok: false, refused: expect.stringContaining(PIPETOOLING_STRIPE_INVOICE_NUMBER_HCP_ERROR) })
    // An HCP number with no digits wins over a Click number that has some, as the function reads it.
    expect(billDryRun(make(), world({ job: { ...world().job!, hcp_number: 'TBD', click_number: '972' } }))).toMatchObject({ ok: false })
    expect(billDryRun(make(), world({ job: { ...world().job!, hcp_number: '', click_number: '9293' } }))).toMatchObject({ ok: true, reply: { job: { label: 'JP9293' } } })
  })
  it('says another numbering refusal in the function’s words', () => {
    expect(billNumberRefusal('JP1', 'Invalid due date; not a real calendar day.')).toBe('The Stripe bill could not be numbered: Invalid due date; not a real calendar day.')
  })
  it('action send never asks for a number: the bill already has one', () => {
    const p = billInput('plan_bill', { bill: { action: 'send', invoice_id: INV, send: { text: true } } }, TODAY)
    if (!p.ok) throw new Error(p.error)
    const billed = { ...world().invoices[0]!, status: 'billed', stripe_invoice_id: 'in_test_1', hosted_invoice_url: 'https://invoice.stripe.com/i/x', pay_code: 'a2fvn3pqgq', stripe_mode: 'test' }
    expect(billDryRun(p.p, world({ invoice: billed, invoices: [], job: { ...world().job!, hcp_number: '', click_number: '' } }))).toMatchObject({ ok: true })
  })
})
