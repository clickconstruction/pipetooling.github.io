/**
 * gc-customer-email's pure half (GC mode, Owner Billing's O4b): who may send, what a request may carry, who gets each
 * kind, and the email around the lines the window wrote. The words are the window's (`src/lib/gc/customerEmail.ts`);
 * this frames them the way `gc-trade-email` frames a trade partner's. Dependency-free, so the app's tests import it
 * straight from here.
 */

/**
 * Who may email a GC customer: the money team (the Owner Billing door), never a training account or a digital twin.
 * The client's copy is `GC_MONEY_TEAM` in `src/lib/gc/access.ts`; `access.test.ts` holds the two to each other.
 */
export const GC_CUSTOMER_EMAIL_ROLES: readonly string[] = ['dev', 'master_technician', 'controller']

/** The GC entity's name on every email to a GC customer (the owner's call 12: Click Construction). */
export const GC_CUSTOMER_EMAIL_FROM_NAME = 'Click Construction'

/** O4b-1's kinds: our pay application to the customer, and the ask to the architect to certify it. */
export const GC_CUSTOMER_EMAIL_KINDS = ['pay_app', 'certify_ask'] as const
export type GcCustomerEmailKind = (typeof GC_CUSTOMER_EMAIL_KINDS)[number]

/** Who each kind goes to: the project's customer, or its architect (`gc_projects.architect_customer_id`). */
export const GC_CUSTOMER_EMAIL_TO: Record<GcCustomerEmailKind, 'customer' | 'architect'> = {
  pay_app: 'customer',
  certify_ask: 'architect',
}

/**
 * The sent copy's kind (docs/SENT_COPIES.md) for each email kind: both carry the pay application. It begins `bill`, so
 * the Documents page sorts it under Bills (`sentKindGroup`); never `pay_application`, the Pipeline's G702 workbook.
 */
export const GC_CUSTOMER_EMAIL_FILED_AS: Record<GcCustomerEmailKind, string> = {
  pay_app: 'bill_gc_pay_app',
  certify_ask: 'bill_gc_pay_app',
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
  notSent: 409,
  noEmail: 422,
  sendFailed: 502,
  failed: 500,
} as const
export type CustomerEmailErrorKey = keyof typeof CUSTOMER_EMAIL_ERRORS

export interface GcCustomerEmailRequest {
  projectId: string
  kind: GcCustomerEmailKind
  /** The pay application the email is about (`gc_owner_pay_apps.id`). */
  sourceId: string
  subject: string
  /** The email, one paragraph a line, the greeting first. */
  lines: string[]
  /** The form, made in the window (`payAppPdf`). */
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
}

/** The email a GC customer or its architect reads: our name on top, the window's lines, then who it is from. */
export function buildGcCustomerEmail(input: GcCustomerEmailInput): { subject: string; text: string; html: string } {
  const subject = input.subject.trim()
  const text = [...input.lines.flatMap((l) => [l, '']), 'Thank you,', input.signer, input.gc].join('\n')
  const p = (s: string) => `<p style="margin:0 0 12px">${esc(s)}</p>`
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#ffffff">` +
    `<div style="max-width:560px;margin:0 auto;padding:16px;font-family:${FONT}">` +
    `<div style="background:${PAPER};color:${INK};border:1px solid ${INK};border-radius:10px;overflow:hidden">` +
    `<div style="background:${INK};color:${PAPER};padding:10px 16px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase">${esc(input.gc)}</div>` +
    `<div style="padding:16px;font-size:15px;line-height:1.5">` +
    input.lines.map(p).join('') +
    `<p style="margin:0;padding-top:10px;border-top:1px solid ${HAIR};color:${MUTED};font-size:13px">Thank you,<br>${esc(input.signer)}<br>${esc(input.gc)}</p>` +
    `</div></div></div></body></html>`
  return { subject, text, html }
}
