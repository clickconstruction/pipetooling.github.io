/**
 * `send-contract-for-signature`'s company branch (GC mode, the Board's B6-b-i, call S, A): a trade partner company's
 * paper (its master agreement, its W-9) goes to the company's 'contracts' people in GC's frame, with the signing link as
 * the email's own step and the company's portal, when it has a link, under it. The words are the client's, built from
 * the portal's (`portalI18n.ts`), as every GC trade email's are; the function adds the link. These are its pure parts:
 * the request, the email's input, the `gc_trade_messages` row and the sent copy. The person path is
 * `contractSigningSend.ts`, pinned against main and untouched by this branch.
 */
import { parseTradeEmail, TRADE_EMAIL_LIMITS, type GcTradeEmailInput, type TradeEmailLine } from './gcTradeEmail.ts'

/** What the office posts for a company's paper. */
export interface CompanySigningRequest {
  documentId: string
  /** The app's address the signing link opens on, when the office's page says. */
  publicOrigin: string | null
  /** The company the paper is for: it must be the paper's own. */
  companyId: string
  /** Unique per company: a key is sent once (`<gc_paper_sends id>:<paper>`), so a reminder is its own send. */
  key: string
  lang: 'en' | 'es'
  subject: string
  lines: TradeEmailLine[]
  /** The step's words on its button, the portal's `readSign`. */
  actionLabel: string
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * The company branch's request, or not: `{ person_contract_document_id, public_origin?, trade_email: { companyId, key,
 * lang, subject, lines, actionLabel } }`. The words are held to gc-trade-email's own limits (`parseTradeEmail`).
 */
export function parseCompanySigningRequest(body: unknown): { ok: true; req: CompanySigningRequest } | { ok: false } {
  if (!isObject(body) || !isObject(body.trade_email)) return { ok: false }
  const documentId = typeof body.person_contract_document_id === 'string' ? body.person_contract_document_id.trim() : ''
  if (!UUID.test(documentId)) return { ok: false }
  const te = body.trade_email
  const parsed = parseTradeEmail({ companyId: te.companyId, kind: 'msa', key: te.key, projectId: null, lang: te.lang, subject: te.subject, lines: te.lines })
  if (!parsed.ok) return { ok: false }
  const actionLabel = typeof te.actionLabel === 'string' ? te.actionLabel.trim() : ''
  if (actionLabel === '' || actionLabel.length > TRADE_EMAIL_LIMITS.subject) return { ok: false }
  const origin = body.public_origin
  const publicOrigin = typeof origin === 'string' && origin.startsWith('http') ? origin : null
  const { companyId, key, lang, subject, lines } = parsed.req
  return { ok: true, req: { documentId, publicOrigin, companyId, key, lang, subject, lines, actionLabel } }
}

/** The portal message a company's paper goes as: its master agreement is `msa`; any other paper (a W-9) is `paper`. */
export function companyPaperMessageKind(docType: string | null | undefined): 'msa' | 'paper' {
  return (docType ?? 'agreement') === 'agreement' ? 'msa' : 'paper'
}

/** The email's input for `buildGcTradeEmail`: the signing link is the step, the portal a line under it when there is one. */
export function companySigningEmailInput(args: {
  req: CompanySigningRequest
  /** The names it goes to, the main contact first. */
  names: string[]
  company: string
  portalUrl: string | null
  acceptUrl: string
  signer: string
  gc: string
}): GcTradeEmailInput {
  return {
    lang: args.req.lang,
    recipients: args.names,
    company: args.company,
    subject: args.req.subject,
    lines: args.req.lines,
    linkUrl: args.portalUrl,
    action: { label: args.req.actionLabel, url: args.acceptUrl },
    signer: args.signer,
    gc: args.gc,
  }
}

/** The `gc_trade_messages` row, as gc-trade-email writes one: the portal's Messages and the office both see the send. */
export function companyTradeMessageRow(args: {
  id: string
  req: CompanySigningRequest
  kind: 'msa' | 'paper'
  subject: string
  names: string[]
  sentOn: string
  sentBy: string
  emailSendLogId: string | null
}) {
  return {
    id: args.id,
    company_id: args.req.companyId,
    project_id: null,
    kind: args.kind,
    mail_group: 'contracts' as const,
    msg_key: args.req.key,
    lang: args.req.lang,
    subject: args.subject,
    lines: args.req.lines,
    to_names: args.names,
    sent_on: args.sentOn,
    sent_by: args.sentBy,
    email_send_log_id: args.emailSendLogId,
  }
}

/** The sent copy (docs/SENT_COPIES.md): a GC trade email to the company by name, filed under its message row. */
export function companySigningSentCopy(args: {
  company: string
  messageId: string | null
  sentBy: string
  to: string
  cc: string[]
  from: string
  subject: string
  html: string
  resendEmailId: string | null
}): [
  { kind: string; title: string; recipientName: string; source: { table: string; id: string | null }; sentBy: string },
  { to: string[]; cc: string[]; from: string; subject: string; html: string; resendEmailId: string | null },
] {
  return [
    { kind: 'gc_trade_email', title: args.subject, recipientName: args.company, source: { table: 'gc_trade_messages', id: args.messageId }, sentBy: args.sentBy },
    { to: [args.to], cc: args.cc, from: args.from, subject: args.subject, html: args.html, resendEmailId: args.resendEmailId },
  ]
}
