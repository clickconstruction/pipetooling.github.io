/**
 * gc-customer-email's pure half (GC mode, Owner Billing's O4b): who may send, what a request may carry, who gets each
 * kind and what it is about, and the email around the lines the window wrote. The words are the window's
 * (`src/lib/gc/customerEmail.ts`); this frames them the way `gc-trade-email` frames a trade partner's. Dependency-free,
 * so the app's tests import it straight from here.
 */

/**
 * Who may email a GC customer: the money team (the Owner Billing door), never a training account or a digital twin.
 * The client's copy is `GC_MONEY_TEAM` in `src/lib/gc/access.ts`; `access.test.ts` holds the two to each other.
 */
export const GC_CUSTOMER_EMAIL_ROLES: readonly string[] = ['dev', 'master_technician', 'controller']

/** The GC entity's name on every email to a GC customer (the owner's call 12: Click Construction). */
export const GC_CUSTOMER_EMAIL_FROM_NAME = 'Click Construction'

/**
 * The kinds. O4b-1: our pay application to the customer, and the ask to the architect to certify it. O4b-2: the bill
 * the architect certified, to the customer, and a change order for them to sign. O5b: our reminder to pay a late bill,
 * its words the ones `gc_remind_customer_to_pay` filed. O6b-2: our bill for the interest on late bills. Building's U7b:
 * the weekly report on a job we are building, its words the `gc_weekly_reports` row the window kept. The Board's
 * B6-d-iii-b: our contract to sign in their portal, the send's own file attached by the function.
 */
export const GC_CUSTOMER_EMAIL_KINDS = ['pay_app', 'certify_ask', 'certified', 'change_order', 'reminder', 'interest_bill', 'weekly', 'contract'] as const
export type GcCustomerEmailKind = (typeof GC_CUSTOMER_EMAIL_KINDS)[number]

/** Who each kind goes to: the project's customer, or its architect (`gc_projects.architect_customer_id`). */
export const GC_CUSTOMER_EMAIL_TO: Record<GcCustomerEmailKind, 'customer' | 'architect'> = {
  pay_app: 'customer',
  certify_ask: 'architect',
  certified: 'customer',
  change_order: 'customer',
  reminder: 'customer',
  interest_bill: 'customer',
  weekly: 'customer',
  contract: 'customer',
}

/** The row each kind is about: a pay application, a change order, a reminder to pay, an interest bill, a weekly report, or a send of our contract. */
export type GcCustomerEmailSource = 'gc_owner_pay_apps' | 'gc_change_orders' | 'gc_owner_pay_reminders' | 'gc_owner_interest_bills' | 'gc_weekly_reports' | 'gc_owner_contract_sends'
export const GC_CUSTOMER_EMAIL_SOURCE: Record<GcCustomerEmailKind, GcCustomerEmailSource> = {
  pay_app: 'gc_owner_pay_apps',
  certify_ask: 'gc_owner_pay_apps',
  certified: 'gc_owner_pay_apps',
  change_order: 'gc_change_orders',
  reminder: 'gc_owner_pay_reminders',
  interest_bill: 'gc_owner_interest_bills',
  weekly: 'gc_weekly_reports',
  contract: 'gc_owner_contract_sends',
}

/**
 * Who may send each kind. The money team for every bill and change (`GC_CUSTOMER_EMAIL_ROLES`). The weekly report is
 * Building's: whoever can read its row through RLS may send it (dev while Building is built; Building's door decides the
 * schedule's team, and whether reading is still enough then). A test copy passes the same gate.
 */
export const GC_CUSTOMER_EMAIL_GATE: Record<GcCustomerEmailKind, 'moneyTeam' | 'row'> = {
  pay_app: 'moneyTeam',
  certify_ask: 'moneyTeam',
  certified: 'moneyTeam',
  change_order: 'moneyTeam',
  reminder: 'moneyTeam',
  interest_bill: 'moneyTeam',
  weekly: 'row',
  // Our contract goes with the price by line, Our number's.
  contract: 'moneyTeam',
}

/**
 * Which of a customer row's addresses each kind goes to: the billing address first for a bill, the contact first for the
 * weekly report, which is for the person who runs the job for them (`customerContactEmail`), and for our contract, whose
 * signer is their owner, not their payables.
 */
export const GC_CUSTOMER_EMAIL_ADDRESS: Record<GcCustomerEmailKind, 'billing' | 'contact'> = {
  pay_app: 'billing',
  certify_ask: 'billing',
  certified: 'billing',
  change_order: 'billing',
  reminder: 'billing',
  interest_bill: 'billing',
  weekly: 'contact',
  contract: 'contact',
}

/**
 * Whether the email is framed: our closing lines after the window's. The weekly report carries its own greeting and
 * sign-off (`weeklyReportText`), so nothing is added after it.
 */
export const GC_CUSTOMER_EMAIL_FRAMED: Record<GcCustomerEmailKind, boolean> = {
  pay_app: true,
  certify_ask: true,
  certified: true,
  change_order: true,
  reminder: true,
  interest_bill: true,
  weekly: false,
  contract: true,
}

/**
 * The sent copy's kind (docs/SENT_COPIES.md) for each email kind. The pay application and the ask carry the form,
 * `bill_gc_pay_app`; the certified bill is its own kind, so the window tells the two apart. Both begin `bill`, so the
 * Documents page sorts them under Bills (`sentKindGroup`), and neither is `pay_application`, the Pipeline's G702
 * workbook. A change order changes our contract with the customer: `job_contract_gc_change_order`, under Contracts.
 * A reminder to pay is a bill's too: `bill_gc_reminder`, under Bills, and so is an interest bill: `bill_gc_interest`.
 */
export const GC_CUSTOMER_EMAIL_FILED_AS: Record<GcCustomerEmailKind, string> = {
  pay_app: 'bill_gc_pay_app',
  certify_ask: 'bill_gc_pay_app',
  certified: 'bill_gc_certified',
  change_order: 'job_contract_gc_change_order',
  reminder: 'bill_gc_reminder',
  interest_bill: 'bill_gc_interest',
  // A report on the job, not a bill: `field_report`'s prefix, so the Documents page sorts it under Statements.
  weekly: 'field_report_gc_weekly',
  // Our contract with the customer, kept in Documents until SENT_COPIES' step 4 lists it.
  contract: 'gc_owner_contract',
}

/** The sent copies' kinds about rows of one table, for the window's *Emailed to* lines. */
export function gcCustomerEmailCopyKinds(table: GcCustomerEmailSource): string[] {
  return [...new Set(GC_CUSTOMER_EMAIL_KINDS.filter((k) => GC_CUSTOMER_EMAIL_SOURCE[k] === table).map((k) => GC_CUSTOMER_EMAIL_FILED_AS[k]))]
}

/**
 * The kinds that add the customer's portal link when they already have one (never minted here): the certified bill,
 * the reminder to pay it and the interest bill, which the portal lists. It has no Pay there yet, since the bill is not on Stripe, so the line
 * says *see*, not *pay*.
 */
export const GC_CUSTOMER_EMAIL_PORTAL_LINE: Record<GcCustomerEmailKind, boolean> = {
  pay_app: false,
  certify_ask: false,
  certified: true,
  change_order: false,
  reminder: true,
  interest_bill: true,
  // Until the customer's portal shows the reports (the schedule's PR 15).
  weekly: false,
  // Required, never left off: they sign it there. With no link where GC jobs show, the kind refuses noPortal.
  contract: true,
}
export const GC_CUSTOMER_EMAIL_PORTAL_WORDS = 'You can see this bill in your portal:'
/** Our contract's portal line: they sign it there. */
export const GC_CUSTOMER_EMAIL_CONTRACT_PORTAL_WORDS = 'Read it and sign it in your portal:'

/**
 * The link our contract goes with: one where their GC jobs show. The merged link (`all`) first, at its short address
 * when it has one, then a customer view (`customer`). Never a general contractor's view (`gc`), which shows no GC job of
 * ours. Null: none on, and the kind refuses noPortal.
 */
export function gcContractPortalUrl(
  links: ReadonlyArray<{ audience: string; token: string | null; revoked_at?: string | null }>,
  slug: string | null | undefined,
  appOrigin: string,
  shortOrigin: string,
): string | null {
  const active = links.filter((l) => l.revoked_at == null && !!(l.token ?? '').trim())
  const origin = appOrigin.replace(/\/+$/, '')
  const all = active.find((l) => l.audience === 'all')
  if (all?.token) return (slug ?? '').trim() ? `${shortOrigin}${(slug ?? '').trim()}` : `${origin}/portal?t=${all.token.trim()}`
  const customer = active.find((l) => l.audience === 'customer')
  return customer?.token ? `${origin}/portal?t=${customer.token.trim()}` : null
}

/** The largest contract file an email attaches, under Resend's message limit. Over it: `tooLarge`. */
export const GC_CUSTOMER_EMAIL_MAX_CONTRACT_BYTES = 30 * 1024 * 1024

/** Our contract's attachment name: the office's file name as Resend takes one, always a .pdf. */
export function gcContractAttachmentName(name: string): string {
  const base = name.replace(/\.pdf$/i, '').replace(/[^\w.() -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110)
  return `${base || 'Our contract'}.pdf`
}

/** A file's bytes as base64 for an attachment, a chunk at a time so a long file never overflows the call stack. */
export function bytesBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/** The form's PDF, base64, under the same cap `send-lien-release-email` keeps. */
export const GC_CUSTOMER_EMAIL_MAX_PDF_BASE64 = 6_000_000

/** Each refusal and its HTTP status. The window says each one in words (`gcCustomerEmailRefusal`). */
export const CUSTOMER_EMAIL_ERRORS = {
  signIn: 401,
  moneyTeamOnly: 403,
  readOnly: 403,
  badRequest: 400,
  notFound: 404,
  otherProject: 409,
  notCertified: 409,
  notSent: 409,
  alreadySent: 409,
  noEmail: 422,
  // Our contract (B6-d-iii-b): no link where GC jobs show; the send's file is not the bytes it hashed; a newer send went;
  // they signed it already.
  noPortal: 422,
  fileChanged: 409,
  notNewest: 409,
  alreadySigned: 409,
  // The stored file is over what one email carries (Resend takes about 40 MB a message): their portal has it.
  tooLarge: 413,
  sendFailed: 502,
  failed: 500,
} as const
export type CustomerEmailErrorKey = keyof typeof CUSTOMER_EMAIL_ERRORS

export interface GcCustomerEmailRequest {
  projectId: string
  kind: GcCustomerEmailKind
  /** The row the email is about: a pay application or a change order, by `GC_CUSTOMER_EMAIL_SOURCE`. */
  sourceId: string
  subject: string
  /** The email, one paragraph a line, the greeting first. */
  lines: string[]
  /** The pay application's form, made in the window (`payAppPdf`). Never with our contract: the function attaches its file. */
  pdf: { filename: string; base64: string } | null
  /**
   * A test copy: built as the real email would be, to the caller's own address only, `[TEST]` before the subject, with no
   * copy to anyone, nothing filed and nothing written back. The caller's gate runs as for a real send.
   */
  test?: boolean
}

/** A test copy's email type on `email_send_log`, so no reader counts it as a send. */
export const GC_CUSTOMER_EMAIL_TEST_TYPE = 'gc_customer_email_test'

/** A test copy's subject. */
export function gcCustomerEmailTestSubject(subject: string): string {
  return `[TEST] ${subject.trim()}`
}

/**
 * Who is copied: the architect, on a weekly report whose row says so, at their address. Never on a test copy, never with
 * no address, and never twice to the address it already goes to.
 */
export function gcCustomerEmailCc(input: { copyArchitect: boolean; test: boolean; architectAddress: string; address: string }): string[] {
  const cc = input.architectAddress.trim()
  if (!input.copyArchitect || input.test || !cc || cc.toLowerCase() === input.address.trim().toLowerCase()) return []
  return [cc]
}

/** A weekly report's body as the email's paragraphs: split on blank lines, each kept with its own line breaks. */
export function gcWeeklyReportLines(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What a request may carry, checked before anything is read. */
export function parseCustomerEmail(body: unknown): { ok: true; req: GcCustomerEmailRequest } | { ok: false } {
  if (!body || typeof body !== 'object') return { ok: false }
  const b = body as Record<string, unknown>
  const kind = b.kind
  if (typeof kind !== 'string' || !(GC_CUSTOMER_EMAIL_KINDS as readonly string[]).includes(kind)) return { ok: false }
  const projectId = typeof b.projectId === 'string' ? b.projectId : ''
  const sourceId = typeof b.sourceId === 'string' ? b.sourceId : ''
  if (!UUID.test(projectId) || !UUID.test(sourceId)) return { ok: false }
  const subject = typeof b.subject === 'string' ? b.subject.trim() : ''
  if (!subject || subject.length > 200) return { ok: false }
  if (!Array.isArray(b.lines) || b.lines.length === 0 || b.lines.length > 30) return { ok: false }
  const lines = b.lines.map((l) => (typeof l === 'string' ? l.trim() : ''))
  if (lines.some((l) => l === '' || l.length > 2000)) return { ok: false }
  let pdf: GcCustomerEmailRequest['pdf'] = null
  if (b.pdf != null) {
    const p = b.pdf as Record<string, unknown>
    const filename = typeof p.filename === 'string' ? p.filename.trim() : ''
    const base64 = typeof p.base64 === 'string' ? p.base64.replace(/\s+/g, '') : ''
    if (!/^[\w.() -]{1,120}\.pdf$/i.test(filename)) return { ok: false }
    if (!base64 || base64.length > GC_CUSTOMER_EMAIL_MAX_PDF_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { ok: false }
    pdf = { filename, base64 }
  }
  // Our contract goes with the send's own file, read and checked by the function, never one the window sends.
  if (kind === 'contract' && pdf) return { ok: false }
  return { ok: true, req: { projectId, kind: kind as GcCustomerEmailKind, sourceId, subject, lines, pdf, ...(b.test === true ? { test: true } : {}) } }
}

const INK = '#16283c'
const PAPER = '#f6f3ec'
const MUTED = '#5a6b7e'
const HAIR = '#ddd6c8'
const FONT = `-apple-system, 'Segoe UI', Roboto, sans-serif`
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface GcCustomerEmailInput {
  subject: string
  /** One paragraph a line, the greeting first. */
  lines: string[]
  /** Who signs it: the project manager, else who sent it. */
  signer: string
  /** Our name: `GC_CUSTOMER_EMAIL_FROM_NAME`. */
  gc: string
  /**
   * With our closing lines after the window's (`GC_CUSTOMER_EMAIL_FRAMED`). False: the lines carry their own greeting and
   * sign-off, each kept with its line breaks. Unset: framed.
   */
  framed?: boolean
  /** The customer's portal, for the kinds that link it (`GC_CUSTOMER_EMAIL_PORTAL_LINE`). Null: no line. */
  portalUrl?: string | null
  /** The portal line's words. Unset: a bill's (`GC_CUSTOMER_EMAIL_PORTAL_WORDS`). */
  portalWords?: string
  /**
   * The bill's card fee when their portal offers Pay by card (O8c: the switch on, the bill certified, not on Stripe
   * and nothing paid). With a portal link, the portal line says they may pay by card there, and the fee follows.
   */
  cardFee?: number | null
}

/** The portal line when the portal offers Pay by card (O8c). */
export const GC_CUSTOMER_EMAIL_CARD_PORTAL_WORDS = 'Or pay it by card in your portal:'

/** "Paying by card adds a 3% card fee of $8,666.37." */
export function gcCustomerEmailCardFeeLine(fee: number): string {
  return `Paying by card adds a 3% card fee of $${fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
}

/**
 * The email a GC customer or its architect reads: our name on top, the window's lines, the portal line when there is
 * one, then who it is from.
 */
export function buildGcCustomerEmail(input: GcCustomerEmailInput): { subject: string; text: string; html: string } {
  const subject = input.subject.trim()
  const portal = /^https:\/\/\S+$/.test((input.portalUrl ?? '').trim()) ? input.portalUrl!.trim() : null
  const shown = portal ? portal.replace(/^https:\/\//, '').replace(/\/$/, '') : ''
  // A card offer goes only with a bill's portal line, never under other words (our contract is not a bill).
  const fee = portal && input.portalWords === undefined && typeof input.cardFee === 'number' && input.cardFee > 0 ? input.cardFee : null
  const words = fee !== null ? GC_CUSTOMER_EMAIL_CARD_PORTAL_WORDS : (input.portalWords ?? GC_CUSTOMER_EMAIL_PORTAL_WORDS)
  const feeLine = fee !== null ? gcCustomerEmailCardFeeLine(fee) : null
  const framed = input.framed !== false
  const text = [
    ...input.lines.flatMap((l) => [l, '']),
    ...(portal ? [`${words} ${portal}`, ''] : []),
    ...(feeLine ? [feeLine, ''] : []),
    ...(framed ? ['Thank you,', input.signer, input.gc] : []),
  ]
    .join('\n')
    .replace(/\n+$/, '')
  // Unframed lines keep their own breaks (a section's title and its list); each is escaped before the break goes in.
  const p = (s: string) => `<p style="margin:0 0 12px">${framed ? esc(s) : esc(s).replace(/\n/g, '<br>')}</p>`
  const portalP = portal
    ? `<p style="margin:0 0 12px">${esc(words)} <a href="${esc(portal)}" style="color:${INK}">${esc(shown)}</a></p>` + (feeLine ? p(feeLine) : '')
    : ''
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#ffffff">` +
    `<div style="max-width:560px;margin:0 auto;padding:16px;font-family:${FONT}">` +
    `<div style="background:${PAPER};color:${INK};border:1px solid ${INK};border-radius:10px;overflow:hidden">` +
    `<div style="background:${INK};color:${PAPER};padding:10px 16px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase">${esc(input.gc)}</div>` +
    `<div style="padding:16px;font-size:15px;line-height:1.5">` +
    input.lines.map(p).join('') +
    portalP +
    (framed ? `<p style="margin:0;padding-top:10px;border-top:1px solid ${HAIR};color:${MUTED};font-size:13px">Thank you,<br>${esc(input.signer)}<br>${esc(input.gc)}</p>` : '') +
    `</div></div></div></body></html>`
  return { subject, text, html }
}
