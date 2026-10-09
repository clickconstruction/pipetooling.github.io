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
 * its words the ones `gc_remind_customer_to_pay` filed. O6b-2: our bill for the interest on late bills.
 */
export const GC_CUSTOMER_EMAIL_KINDS = ['pay_app', 'certify_ask', 'certified', 'change_order', 'reminder', 'interest_bill'] as const
export type GcCustomerEmailKind = (typeof GC_CUSTOMER_EMAIL_KINDS)[number]

/** Who each kind goes to: the project's customer, or its architect (`gc_projects.architect_customer_id`). */
export const GC_CUSTOMER_EMAIL_TO: Record<GcCustomerEmailKind, 'customer' | 'architect'> = {
  pay_app: 'customer',
  certify_ask: 'architect',
  certified: 'customer',
  change_order: 'customer',
  reminder: 'customer',
  interest_bill: 'customer',
}

/** The row each kind is about: a pay application, a change order, a reminder to pay, or an interest bill. */
export type GcCustomerEmailSource = 'gc_owner_pay_apps' | 'gc_change_orders' | 'gc_owner_pay_reminders' | 'gc_owner_interest_bills'
export const GC_CUSTOMER_EMAIL_SOURCE: Record<GcCustomerEmailKind, GcCustomerEmailSource> = {
  pay_app: 'gc_owner_pay_apps',
  certify_ask: 'gc_owner_pay_apps',
  certified: 'gc_owner_pay_apps',
  change_order: 'gc_change_orders',
  reminder: 'gc_owner_pay_reminders',
  interest_bill: 'gc_owner_interest_bills',
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
}
export const GC_CUSTOMER_EMAIL_PORTAL_WORDS = 'You can see this bill in your portal:'

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
  /** The pay application's form, made in the window (`payAppPdf`). */
  pdf: { filename: string; base64: string } | null
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
  return { ok: true, req: { projectId, kind: kind as GcCustomerEmailKind, sourceId, subject, lines, pdf } }
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
  /** The customer's portal, for the kinds that link it (`GC_CUSTOMER_EMAIL_PORTAL_LINE`). Null: no line. */
  portalUrl?: string | null
}

/**
 * The email a GC customer or its architect reads: our name on top, the window's lines, the portal line when there is
 * one, then who it is from.
 */
export function buildGcCustomerEmail(input: GcCustomerEmailInput): { subject: string; text: string; html: string } {
  const subject = input.subject.trim()
  const portal = /^https:\/\/\S+$/.test((input.portalUrl ?? '').trim()) ? input.portalUrl!.trim() : null
  const shown = portal ? portal.replace(/^https:\/\//, '').replace(/\/$/, '') : ''
  const text = [...input.lines.flatMap((l) => [l, '']), ...(portal ? [`${GC_CUSTOMER_EMAIL_PORTAL_WORDS} ${portal}`, ''] : []), 'Thank you,', input.signer, input.gc].join('\n')
  const p = (s: string) => `<p style="margin:0 0 12px">${esc(s)}</p>`
  const portalP = portal
    ? `<p style="margin:0 0 12px">${esc(GC_CUSTOMER_EMAIL_PORTAL_WORDS)} <a href="${esc(portal)}" style="color:${INK}">${esc(shown)}</a></p>`
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
    `<p style="margin:0;padding-top:10px;border-top:1px solid ${HAIR};color:${MUTED};font-size:13px">Thank you,<br>${esc(input.signer)}<br>${esc(input.gc)}</p>` +
    `</div></div></div></body></html>`
  return { subject, text, html }
}
