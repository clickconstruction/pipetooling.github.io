// A bill from the dev seat (v2.6794 / 0.51.0 — punch list #293, PR 3, the last of the owner's three: "setup and update
// jobs and send bills"). plan_bill → apply_bill does what Bill Customer and the share row do, in their order
// (src/components/jobs/SendRecordInvoiceModal.tsx submitStripeInvoice, StripeInvoiceSharePanel.tsx): the one primary
// Ready-to-Bill row sized to the remainder (ensure_single_ready_to_bill_invoice_for_job), the Stripe bill through
// create-stripe-invoice as the dev with an explicit mode, the ten-letter code read back (bill_pay_code asked once when
// missing), the job to Billed when fully invoiced (update_job_status, the modal's promotion), then the Billed line's
// text through quo-send and the share row's draft through messages-email. Every step is the app's own door; a refused
// send leaves the bill standing and is named. action send texts or emails the link of a bill that already exists.
//
// Pure: no env reads, no network. The reads come in through one small interface (the test runs a recording fake,
// src/lib/devMcp/devMcpBill.test.ts); the dry run is this server's read of the job, its lines and payments, the
// customer, their contact and numbers, the texts switch, the office's Billed line and the sender — the remainder worked
// out as the RPC works it (openLineAllocation, the kernel copy), the words as the sheet fills them (billedLine,
// stripeInvoiceShareCopy), the link as the share row builds it (billTextLink). The hash commits to all of it, with the
// bill's link a placeholder until the bill exists.

import { BILLED_LINE, billedText, type BilledLineWords } from './gcKernels/lib/tellCustomer/billedLine.ts'
import { buildStripeInvoiceEmailBody, buildStripeInvoiceEmailSubject } from './gcKernels/lib/stripeInvoiceShareCopy.ts'
import { billTextLink } from './gcKernels/lib/billing/billTextLink.ts'
import { billDollars } from './gcKernels/lib/billing/newestBill.ts'
import { allocatedOpenCents, isRtbPrimaryBundle, moneyCents, type LinkedPayment, type OpenLineInvoice } from './gcKernels/lib/billing/openLineAllocation.ts'
import { TEXTS_SWITCH_KEY, textsAreOn } from './gcKernels/lib/quo/textsSwitch.ts'
import { normalizeChannel } from './gcKernels/lib/contacts/kernel.ts'
import { customerLang } from './gcKernels/lib/messages/customerLang.ts'
import { letterheadFor } from './messagesEmail.ts'

export const BILL_VERBS = ['plan_bill', 'apply_bill'] as const
export type BillVerb = (typeof BILL_VERBS)[number]
export function isBillVerb(name: string): name is BillVerb {
  return (BILL_VERBS as readonly string[]).includes(name)
}

export const STRIPE_MODES = ['test', 'live'] as const
export type StripeMode = (typeof STRIPE_MODES)[number]

/** Where the text's link reads in the plan, before the bill exists: the share row's own shape, ten letters long. */
export const BILL_LINK_PLACEHOLDER = 'https://my.clickplumbing.com/pay/<ten letters>'
/** The text's column on the job (quo-send's and messages-email's tie). */
export const BILL_TIE_COLUMN = 'jobs_ledger_id'
const SIGNATURE_FREE_LINES_MAX = 2

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const MEMO_MAX = 2000

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

/** What to send: true picks the number or address the sheet would; a string names one on the contact; null leaves it. */
export type SendAsk = { text: true | string | null; email: true | string | null }

export type BillPayload =
  | { action: 'make'; job_id: string; stripe_mode: StripeMode; due_date: string; memo?: string; send: SendAsk }
  | { action: 'send'; invoice_id: string; send: SendAsk }

export type BillInput = { ok: true; p: BillPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs bill — { job_id (a jobs_ledger.id — find_job; the job must be at Ready to Bill), stripe_mode (test | live — required, no default: the server bills live when it is left out), due_date? (YYYY-MM-DD; today when left out, as Bill Customer opens), memo? (the words on the Stripe invoice under the service address, under ${MEMO_MAX}), send? ({ text?: true | '<a number on the contact>', email?: true | '<an address on the contact>' } — true picks the one the sheet would; left out, the bill is made and nothing is sent) }, or { action: 'send', invoice_id (a billed Stripe bill's jobs_ledger_invoices.id — get_job lists them), send } to text or email the link of a bill that already exists.`

function sendAsk(verb: string, raw: unknown): { ok: true; send: SendAsk } | { ok: false; error: string } {
  const s = obj(raw)
  if (raw !== undefined && raw !== null && !s) return { ok: false, error: `${verb}: send is { text?: true | '<number>', email?: true | '<address>' }.` }
  const one = (k: 'text' | 'email'): true | string | null | false => {
    const v = s?.[k]
    if (v === undefined || v === null || v === false) return null
    if (v === true) return true
    if (typeof v === 'string' && v.trim()) return v.trim()
    return false
  }
  const text = one('text')
  const email = one('email')
  if (text === false) return { ok: false, error: `${verb}: send.text is true (the number the sheet would pick) or one of their numbers as a string.` }
  if (email === false) return { ok: false, error: `${verb}: send.email is true (the address the share row would pick) or one of their addresses as a string.` }
  return { ok: true, send: { text, email } }
}

/** plan_bill / apply_bill's input, shaped. `todayYmd` fills a due date left out, as the modal opens on today. */
export function billInput(verb: BillVerb, input: Json, todayYmd: string): BillInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.bill)
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const action = str('action').toLowerCase() || 'make'
  if (action !== 'make' && action !== 'send') return { ok: false, error: `${verb}: action is make (left out) or send.` }
  const ask = sendAsk(verb, src.send)
  if (!ask.ok) return ask
  let p: BillPayload
  let target: string
  if (action === 'send') {
    const invoiceId = str('invoice_id').toLowerCase()
    if (!UUID_RE.test(invoiceId)) return { ok: false, error: `${verb}: action send needs invoice_id, a jobs_ledger_invoices.id — get_job lists the job's bills.` }
    if (ask.send.text === null && ask.send.email === null) return { ok: false, error: `${verb}: action send needs send — { text?: true | '<number>', email?: true | '<address>' }, one at least.` }
    p = { action: 'send', invoice_id: invoiceId, send: ask.send }
    target = invoiceId
  } else {
    const jobId = str('job_id').toLowerCase()
    if (!UUID_RE.test(jobId)) return { ok: false, error: shape }
    const mode = str('stripe_mode').toLowerCase()
    if (!(STRIPE_MODES as readonly string[]).includes(mode)) return { ok: false, error: `${verb}: stripe_mode is required — test or live. The server bills live when it is left out, so the verb never guesses.` }
    const due = str('due_date') || todayYmd
    if (!YMD_RE.test(due)) return { ok: false, error: `${verb}: due_date is YYYY-MM-DD.` }
    p = { action: 'make', job_id: jobId, stripe_mode: mode as StripeMode, due_date: due, send: ask.send }
    const memo = str('memo')
    if (memo) {
      if (memo.length > MEMO_MAX) return { ok: false, error: `${verb}: memo is under ${MEMO_MAX} characters.` }
      p.memo = memo
    }
    target = jobId
  }
  let planHash: string | null = null
  if (verb === 'apply_bill') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_bill replied with.` }
    planHash = h
  }
  return { ok: true, p, target, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type BillReads = {
  /** GET /rest/v1/<table>?<query> as the dev; the rows. Throws on a refused read. */
  rows(table: string, query: string): Promise<Json[]>
}

export type BillJobRow = { id: string; job_name: string | null; job_address: string | null; status: string | null; revenue: number | string | null; payments_made: number | string | null; customer_id: string | null; customer_name: string | null; customer_email: string | null; bill_to_party: string | null; click_number: string | null; hcp_number: string | null }
export type InvoiceRow = { id: string; job_id?: string | null; status: string | null; amount: number | string | null; is_primary_rtb_bundle: boolean | null; stripe_invoice_id: string | null; hosted_invoice_url: string | null; pay_code: string | null; stripe_mode: string | null; billed_at: string | null; created_at: string | null }
export type PaymentRow = { invoice_id: string | null; amount: number | string | null }
export type CustomerRow = { id: string; name: string | null; language: string | null }
export type ChannelRow = { id: string; kind: string; value: string; opted_out_at: string | null; usual_at: string | null; created_at: string | null }
export type LineRow = { channel_id: string | null; at: string; direction: string }
export type OfficeLineRow = { id: string; text: string; text_es: string | null; scope: string; added_by: string; added_at: string | null }
export type SenderRow = { id: string; name: string | null; title: string | null; phone: string | null; signature_lines: unknown }

export type BillWorld = {
  me: { userId: string; name: string | null }
  job: BillJobRow | null
  /** action send: the bill named. */
  invoice: InvoiceRow | null
  invoices: InvoiceRow[]
  payments: PaymentRow[]
  customer: CustomerRow | null
  /** The customer's own contact (contact_find_or_make's row: on the customer, no name); null when none yet. */
  contactId: string | null
  channels: ChannelRow[]
  /** The thread's texts by number, newest first, for the number order and the first-text mark. */
  lines: LineRow[]
  textsOn: boolean
  /** The office's lines on the Billed step visible to the dev, oldest first. */
  officeLines: OfficeLineRow[]
  sender: SenderRow | null
}

const JOB_COLS = 'id,job_name,job_address,status,revenue,payments_made,customer_id,customer_name,customer_email,bill_to_party,click_number,hcp_number'
const INVOICE_COLS = 'id,job_id,status,amount,is_primary_rtb_bundle,stripe_invoice_id,hosted_invoice_url,pay_code,stripe_mode,billed_at,created_at'

/** The reads the dry run needs, in one place, so the test pins the queries the door will see. */
export async function readBillWorld(reads: BillReads, p: BillPayload, me: { userId: string; name: string | null }): Promise<BillWorld> {
  const one = async <T>(table: string, query: string): Promise<T | null> => ((await reads.rows(table, query))[0] as T | undefined) ?? null
  let invoice: InvoiceRow | null = null
  let jobId: string | null = null
  if (p.action === 'send') {
    invoice = await one<InvoiceRow>('jobs_ledger_invoices', `select=${INVOICE_COLS}&id=eq.${p.invoice_id}`)
    jobId = invoice?.job_id ?? null
  } else jobId = p.job_id
  const job = jobId ? await one<BillJobRow>('jobs_ledger', `select=${JOB_COLS}&id=eq.${jobId}`) : null
  const customerId = job?.customer_id ?? null
  const [invoices, payments, customer, contact, switchRows, officeLines, sender] = await Promise.all([
    jobId && p.action === 'make' ? (reads.rows('jobs_ledger_invoices', `select=${INVOICE_COLS}&job_id=eq.${jobId}&order=created_at`) as Promise<InvoiceRow[]>) : Promise.resolve([] as InvoiceRow[]),
    jobId && p.action === 'make' ? (reads.rows('jobs_ledger_payments', `select=invoice_id,amount&job_id=eq.${jobId}`) as Promise<PaymentRow[]>) : Promise.resolve([] as PaymentRow[]),
    customerId ? one<CustomerRow>('customers', `select=id,name,language&id=eq.${customerId}`) : Promise.resolve(null),
    customerId ? one<{ id: string }>('contacts', `select=id&customer_id=eq.${customerId}&name=is.null&order=created_at&limit=1`) : Promise.resolve(null),
    reads.rows('app_settings', `select=key,value_text&key=eq.${TEXTS_SWITCH_KEY}`) as Promise<Array<{ key: string; value_text: string | null }>>,
    reads.rows('quick_replies', 'select=id,text,text_es,scope,added_by,added_at&for_kind=eq.customer&step_key=eq.billed&removed_at=is.null&order=added_at') as Promise<OfficeLineRow[]>,
    one<SenderRow>('users', `select=id,name,title,phone,signature_lines&id=eq.${me.userId}`),
  ])
  const contactId = contact?.id ?? null
  const [channels, lines] = contactId
    ? await Promise.all([
        reads.rows('contact_channels', `select=id,kind,value,opted_out_at,usual_at,created_at&contact_id=eq.${contactId}&order=created_at`) as Promise<ChannelRow[]>,
        reads.rows('messages', `select=channel_id,at,direction&contact_id=eq.${contactId}&channel=eq.text&order=at.desc&limit=200`) as Promise<LineRow[]>,
      ])
    : [[] as ChannelRow[], [] as LineRow[]]
  return {
    me,
    job,
    invoice,
    invoices,
    payments,
    customer,
    contactId,
    channels,
    lines,
    textsOn: textsAreOn(switchRows[0]?.value_text ?? null),
    officeLines: officeLines.filter((l) => l.scope === 'team' || l.added_by === me.userId),
    sender,
  }
}

// ── the arithmetic, the picks and the words ──────────────────────────────────────────────────────────────────────

/**
 * The remainder Bill Customer bills, as ensure_single_ready_to_bill_invoice_for_job sizes the primary row: the gross
 * left (revenue − payments on the job) less what every other open line still carries net of its payments — the
 * never-sent primary bundle left out, since it is the row being sized. In cents.
 */
export function remainderCents(job: Pick<BillJobRow, 'revenue' | 'payments_made'>, invoices: readonly OpenLineInvoice[], payments: readonly LinkedPayment[]): number {
  const gross = Math.max(0, moneyCents(job.revenue) - moneyCents(job.payments_made))
  return Math.max(0, gross - allocatedOpenCents(invoices, payments, { excludeRtbPrimary: true }))
}

/** The modal's promotion rule after a bill: no Ready to Bill line left and the gross allocated to lines. */
export function fullyInvoiced(job: Pick<BillJobRow, 'revenue' | 'payments_made'>, invoices: readonly OpenLineInvoice[], payments: readonly LinkedPayment[]): boolean {
  if (invoices.some((i) => i.status === 'ready_to_bill')) return false
  const gross = Math.max(0, moneyCents(job.revenue) - moneyCents(job.payments_made))
  return gross - allocatedOpenCents(invoices, payments, { excludeRtbPrimary: false }) <= 0
}

export const firstWord = (name: string | null | undefined): string | null => name?.trim().split(/\s+/)[0] || null

/**
 * The number the sheet's To chip picks (compose.ts numberOrder): the ones that sent STOP last, the usual the office
 * starred first, then the one the thread last carried a line on, then the oldest. Null with no number at all.
 */
export function numberOrder(channels: readonly ChannelRow[], lines: readonly LineRow[]): ChannelRow[] {
  const phones = channels.filter((c) => c.kind === 'phone' && c.value.trim())
  const usual = phones.filter((c) => c.usual_at && !c.opted_out_at).sort((a, b) => ((b.usual_at ?? '') > (a.usual_at ?? '') ? 1 : -1))[0] ?? null
  const lastOn = new Map<string, string>()
  for (const l of lines) {
    if (!l.channel_id || (l.direction !== 'in' && l.direction !== 'out')) continue
    if (l.at > (lastOn.get(l.channel_id) ?? '')) lastOn.set(l.channel_id, l.at)
  }
  return [...phones].sort((a, b) => {
    const sa = a.opted_out_at ? 1 : 0
    const sb = b.opted_out_at ? 1 : 0
    if (sa !== sb) return sa - sb
    const ua = usual && a.id === usual.id ? 0 : 1
    const ub = usual && b.id === usual.id ? 0 : 1
    if (ua !== ub) return ua - ub
    const la = lastOn.get(a.id) ?? ''
    const lb = lastOn.get(b.id) ?? ''
    if (la !== lb) return lb > la ? 1 : -1
    return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1
  })
}

/** Whether this would be the customer's first text from us on this number (the opt-out line's `first` reason, and the sheet's hold). */
export function isFirstTextOn(lines: readonly LineRow[], channelId: string): boolean {
  return !lines.some((l) => l.direction === 'out' && l.channel_id === channelId)
}

export type PickedChannel = { id: string; value: string }
type Pick_ = { ok: true; channel: PickedChannel } | { ok: false; refused: string }

/** The number a text goes to: the one named, else the sheet's first pick; refused with the fix when none can take it. */
export function pickNumber(ask: true | string, world: Pick<BillWorld, 'channels' | 'lines' | 'contactId' | 'textsOn'>, first: string): Pick_ {
  if (!world.textsOn) return { ok: false, refused: 'Texts are off. The owner or a dev turns them on in Settings → Phone and texts; the bill can still be made with send.text left out.' }
  const ordered = numberOrder(world.channels, world.lines)
  if (typeof ask === 'string') {
    const key = normalizeChannel('phone', ask)
    const hit = ordered.find((c) => normalizeChannel('phone', c.value) === key)
    if (!hit) return { ok: false, refused: `${ask} is not one of ${first}'s numbers${ordered.length ? ` (theirs: ${ordered.map((c) => c.value).join(', ')})` : ' — their contact has none'}. A number is added on the Job tab.` }
    if (hit.opted_out_at) return { ok: false, refused: `${hit.value} sent STOP; the box will not text it. Pick another number, or leave send.text out.` }
    return { ok: true, channel: { id: hit.id, value: hit.value } }
  }
  const pick = ordered.find((c) => !c.opted_out_at)
  if (!pick) return { ok: false, refused: world.contactId ? `${first}'s contact has no number that can take a text${ordered.length ? ' (every number sent STOP)' : ''}. Add one on the Job tab, or leave send.text out.` : `${first} has no contact yet, so no number to text. Add their phone on the Job tab (it makes the contact), or leave send.text out.` }
  return { ok: true, channel: { id: pick.id, value: pick.value } }
}

/** The address the share row's email goes to (billShareDoors.billEmailChannel): the one named, else the job's customer email on the contact, else the first email. */
export function pickEmail(ask: true | string, channels: readonly ChannelRow[], preferred: string | null, first: string): Pick_ {
  const emails = channels.filter((c) => c.kind === 'email' && c.value.trim())
  if (typeof ask === 'string') {
    const key = normalizeChannel('email', ask)
    const hit = emails.find((c) => normalizeChannel('email', c.value) === key)
    if (!hit) return { ok: false, refused: `${ask} is not one of ${first}'s addresses${emails.length ? ` (theirs: ${emails.map((c) => c.value).join(', ')})` : ' — their contact has none'}. An address is added on the Job tab.` }
    return { ok: true, channel: { id: hit.id, value: hit.value } }
  }
  const key = preferred ? normalizeChannel('email', preferred) : ''
  const same = key ? emails.find((c) => normalizeChannel('email', c.value) === key) : null
  const pick = same ?? emails[0] ?? null
  if (!pick) return { ok: false, refused: `${first}'s contact has no email yet, so the office cannot email the bill. Add one on the Job tab, or leave send.email out.` }
  return { ok: true, channel: { id: pick.id, value: pick.value } }
}

/** The line the sheet would send: the office's on the Billed step (the oldest the dev can see when several), else the app's own. */
export function billedLineFor(officeLines: readonly OfficeLineRow[]): { line: BilledLineWords; office: boolean; id: string | null } {
  const own = officeLines[0]
  if (own) return { line: { text: own.text, textEs: own.text_es }, office: true, id: own.id }
  return { line: BILLED_LINE, office: false, id: null }
}

/** The email's signature as the reply box signs it (compose.signatureLines): the name, the title and the company, the cell, the free lines. */
export function signatureFor(sender: SenderRow | null): string[] {
  const name = sender?.name?.trim() ?? ''
  const second = [sender?.title?.trim(), letterheadFor(BILL_TIE_COLUMN)].filter(Boolean).join(' · ')
  const cell = sender?.phone?.trim()
  const own = (Array.isArray(sender?.signature_lines) ? sender.signature_lines : []).filter((l): l is string => typeof l === 'string').map((l) => l.trim()).filter(Boolean).slice(0, SIGNATURE_FREE_LINES_MAX)
  return [...(name ? [name] : []), ...(second ? [second] : []), ...(cell ? [`cell ${cell}`] : []), ...own]
}

/** The planned words with the real link in place of the placeholder, once the bill exists. */
export function withBillLink(words: string, link: string): string {
  return words.split(BILL_LINK_PLACEHOLDER).join(link)
}

export type BillSendPlan = {
  text: { channel_id: string; to: string; words: string; first_text: boolean; line: 'office' | 'app'; lang: 'en' | 'es' } | null
  email: { channel_id: string; to: string; subject: string; body: string; signature: string[] } | null
}

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

const label = (job: BillJobRow): string => {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  if (n) return /^\d+$/.test(n) ? `JP${n}` : n
  return (job.job_name ?? '').trim() || 'this job'
}

/**
 * What the plan says and what the hash commits to: the job and its lines, the amount the bill will carry (the RPC's
 * remainder), the mode, the due date, the memo, the customer and the sends — the number or address picked with the
 * words as they will go, the link a placeholder until the bill exists — and what happens after. Refuses in words when
 * the job is not at Ready to Bill, nothing is left to bill, the customer has no email (Stripe needs one), a send was
 * asked for and cannot go (no number, STOP, texts off, no address), or a named bill is not a billed Stripe bill.
 */
export function billDryRun(p: BillPayload, world: BillWorld): DryRun {
  const job = world.job
  if (p.action === 'send') {
    if (!world.invoice) return { ok: false, refused: `No bill ${p.invoice_id} is visible to you — get_job lists a job's bills by id.` }
    if (!job) return { ok: false, refused: `The bill's job ${world.invoice.job_id ?? ''} is not visible to you.` }
    if (world.invoice.status !== 'billed' || !(world.invoice.stripe_invoice_id ?? '').trim()) return { ok: false, refused: `${label(job)}'s bill ${p.invoice_id} is ${world.invoice.status ?? 'without a status'}${(world.invoice.stripe_invoice_id ?? '').trim() ? '' : ' and not a Stripe bill'}: only a billed Stripe bill has a pay page to send. plan_bill { job_id } makes one.` }
  } else {
    if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
    if (job.status !== 'ready_to_bill') return { ok: false, refused: `${label(job)} is at ${job.status ?? 'no status'}, not Ready to Bill: Bill Customer bills a Ready to Bill job. plan_job_update { job_id, status: "ready_to_bill" } moves it.` }
    if (!(job.customer_email ?? '').trim()) return { ok: false, refused: `Customer email is required for Stripe invoices. Add it on Edit Job (plan_job_update { set: { customer_email } }).` }
    if (!job.customer_id) return { ok: false, refused: `${label(job)} has no customer: a Stripe bill needs one (plan_job_update { set: { customer_id } }).` }
    const primaries = world.invoices.filter(isRtbPrimaryBundle).length
    if (primaries > 1) return { ok: false, refused: `${label(job)} has ${primaries} primary Ready to Bill rows; the app refuses to bill until one is fixed (is_primary_rtb_bundle).` }
  }
  const cents = p.action === 'make' ? remainderCents(job, world.invoices, world.payments) : moneyCents(world.invoice!.amount)
  if (p.action === 'make' && cents <= 0) return { ok: false, refused: `Nothing left to bill for ${label(job)} — every dollar is already on a line (revenue ${billDollars(moneyCents(job.revenue) / 100)}, paid ${billDollars(moneyCents(job.payments_made) / 100)}). Raise revenue (plan_job_update) or bill from a partial line in the app.` }
  const amount = billDollars(cents / 100)
  const customerName = world.customer?.name ?? job.customer_name
  const first = firstWord(customerName) ?? 'the customer'
  const lang = customerLang({ lang: world.customer?.language === 'es' || world.customer?.language === 'en' ? world.customer.language : undefined })
  const link = p.action === 'send' ? billTextLink({ invoiceId: world.invoice!.id, payCode: world.invoice!.pay_code, hostedInvoiceUrl: world.invoice!.hosted_invoice_url ?? '' }) : BILL_LINK_PLACEHOLDER
  const sends: BillSendPlan = { text: null, email: null }
  if (p.send.text !== null) {
    const pick = pickNumber(p.send.text, world, first)
    if (!pick.ok) return { ok: false, refused: pick.refused }
    const chosen = billedLineFor(world.officeLines)
    const fills = { first, me: firstWord(world.sender?.name ?? world.me.name) ?? '', job: (job.job_name ?? '').trim(), address: (job.job_address ?? '').trim(), amount, bill: link }
    const words = billedText(chosen.line, fills, lang)
    if (words.left.length) return { ok: false, refused: `The Billed line leaves ${words.left.map((k) => `{${k}}`).join(', ')} unfilled — the office's line on the step names a blank this bill cannot fill. Edit the line under Settings → Flows, or leave send.text out.` }
    sends.text = { channel_id: pick.channel.id, to: pick.channel.value, words: words.text, first_text: isFirstTextOn(world.lines, pick.channel.id), line: chosen.office ? 'office' : 'app', lang }
  }
  if (p.send.email !== null) {
    const pick = pickEmail(p.send.email, world.channels, job.customer_email, first)
    if (!pick.ok) return { ok: false, refused: pick.refused }
    sends.email = {
      channel_id: pick.channel.id,
      to: pick.channel.value,
      subject: buildStripeInvoiceEmailSubject(job.job_name),
      body: buildStripeInvoiceEmailBody({ customerName, payUrl: link, amountLabel: amount, jobName: job.job_name, hcpNumber: job.hcp_number }),
      signature: signatureFor(world.sender),
    }
  }
  const after: string[] = []
  if (p.action === 'make') {
    after.push(`ensure_single_ready_to_bill_invoice_for_job sizes the one primary Ready to Bill row to ${amount}; a different amount then refuses the apply (the modal's own rule).`)
    after.push(`create-stripe-invoice as you, ${p.stripe_mode} mode, due ${p.due_date}: the bill lands as billed with its ten-letter code.`)
    const wouldBeFull = !world.invoices.some((i) => i.status === 'ready_to_bill' && !isRtbPrimaryBundle(i))
    after.push(wouldBeFull ? `${label(job)} moves to Billed (update_job_status), since no line is left and the gross is allocated.` : `${label(job)} stays at Ready to Bill: another Ready to Bill line remains.`)
  }
  if (sends.text) after.push(`The text goes from the company number through quo-send to ${sends.text.to}, tied to the job${sends.text.first_text ? '; their first text from us, so the carriers\' opt-out line rides under it' : ''}.`)
  if (sends.email) after.push(`The email goes through messages-email to ${sends.email.to}, the office's box as Reply-To, the sent copy filed.`)
  if (!sends.text && !sends.email) after.push('Nothing is sent: the bill is made and its link waits on the Bills tab; plan_bill { action: "send", invoice_id, send } hands it over later.')
  return {
    ok: true,
    reply: {
      action: p.action,
      job: { id: job.id, label: label(job), status: job.status, bill_to_party: job.bill_to_party },
      customer: { id: job.customer_id, name: customerName, email: job.customer_email, lang, contact: world.contactId ? 'on file' : 'none yet — contact_for_customer makes one at apply' },
      bill: p.action === 'make'
        ? { amount, amount_cents: cents, stripe_mode: p.stripe_mode, due_date: p.due_date, memo: p.memo ?? null, lines_on_job: world.invoices.map((i) => ({ id: i.id, status: i.status, amount: billDollars(moneyCents(i.amount) / 100), primary: isRtbPrimaryBundle(i) })), link: BILL_LINK_PLACEHOLDER }
        : { invoice_id: world.invoice!.id, amount, stripe_mode: world.invoice!.stripe_mode, stripe_invoice_id: world.invoice!.stripe_invoice_id, link, pay_code: world.invoice!.pay_code ?? 'none yet — minted at apply' },
      text: sends.text,
      email: sends.email,
      after,
    },
  }
}

export type SendOutcome = { sent: true; to: string; message_id: string | null } | { sent: false; to: string; why: string }

/** The apply's reply: the bill, its link, the sends each with its outcome, where the job stands, and the next press. */
export function billAppliedWords(
  p: BillPayload,
  jobLabel: string,
  bill: { invoice_id: string; stripe_invoice_id: string | null; stripe_mode: string | null; amount: string; link: string; pay_code: string | null },
  outcomes: { text: SendOutcome | null; email: SendOutcome | null },
  status: { moved: boolean; now: string | null; why?: string | null } | null,
): Json {
  const failed = [outcomes.text, outcomes.email].filter((o): o is Extract<SendOutcome, { sent: false }> => !!o && !o.sent)
  const next = failed.length
    ? `The bill stands (${bill.link}); ${failed.map((f) => `the ${f === outcomes.text ? 'text' : 'email'} did not go: ${f.why}`).join('; ')}. plan_bill { action: "send", invoice_id: "${bill.invoice_id}", send } tries again.`
    : outcomes.text || outcomes.email
      ? `Sent. The customer's thread shows it under the job; the Bills tab shows the bill${status?.moved ? `, and ${jobLabel} is at Billed` : ''}.`
      : `The bill is on the Bills tab with its link; plan_bill { action: "send", invoice_id: "${bill.invoice_id}", send } hands it to the customer.`
  return {
    action: p.action,
    job: jobLabel,
    bill,
    text: outcomes.text,
    email: outcomes.email,
    status,
    next,
  }
}
