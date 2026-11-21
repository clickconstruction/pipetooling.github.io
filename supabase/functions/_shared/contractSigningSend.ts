/**
 * `send-contract-for-signature`'s person path, its pure parts, moved word for word out of the handler (the Board's
 * B6-b-i) so `src/lib/contractSigningSend.pin.test.ts` holds them to main's: the request's own refusals, whether a
 * document can go out, and the sent copy a person's signing email files. Dependency-free: the app's tests import it
 * straight from here, and the handler calls it.
 */

/** What the office posts. */
export interface SigningRequestBody {
  person_contract_document_id?: string
  signer_email?: string
  public_origin?: string
  email_subject?: string
  email_intro_plain?: string
}

/** A refusal, as the handler answers it: the HTTP status and the `error` words. */
export interface SigningRefusal {
  status: number
  error: string
}

/** The roles that send a paper for signature: the ones `person_contract_documents`' own write policy takes. */
export const SIGNING_SEND_ROLES = ['dev', 'master_technician', 'assistant', 'controller'] as const

/** The caller's account row, as far as the gate reads it. */
export interface SigningCaller {
  role?: string | null
  read_only?: boolean | null
  is_digital_twin?: boolean | null
}

/**
 * Who may send a paper for signature. The handler writes with the service role, which no row policy holds, so it asks
 * here before it reads the paper: one of the four roles that write a paper, and never a training account or a digital
 * twin, as the company branch refuses them. Reading a paper is not enough. The role is said first.
 */
export function signingCallerRefusal(caller: SigningCaller | null | undefined): SigningRefusal | null {
  const role = caller?.role ?? ''
  if (!(SIGNING_SEND_ROLES as readonly string[]).includes(role)) {
    return { status: 403, error: 'Only the office sends a paper for signature.' }
  }
  if (caller?.read_only || caller?.is_digital_twin) {
    return { status: 403, error: 'A training account cannot send a paper for signature.' }
  }
  return null
}

/** The request's own refusals, before any row is read: both fields are needed, and the address must look like one. */
export function signingRequestRefusal(body: SigningRequestBody): SigningRefusal | null {
  const { person_contract_document_id, signer_email } = body
  if (!person_contract_document_id || !signer_email?.trim()) {
    return { status: 400, error: 'person_contract_document_id and signer_email required' }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(signer_email.trim())) {
    return { status: 400, error: 'Invalid email' }
  }
  return null
}

export function hasSigningContent(row: {
  signing_body_html?: string | null
  canonical_document_url?: string | null
  url?: string | null
  form_template_id?: string | null
}): boolean {
  if (row.form_template_id) return true
  if (row.signing_body_html?.trim()) return true
  if (row.canonical_document_url?.trim()) return true
  if (row.url?.trim()) return true
  return false
}

/** The document as the handler reads it. */
export interface SigningDoc {
  status: string
  signing_body_html: string | null
  canonical_document_url: string | null
  url: string | null
  form_template_id: string | null
}

/** A document that cannot go out: signed already, nothing to sign, or a status that is neither unsent nor sent. */
export function signingDocRefusal(doc: SigningDoc): SigningRefusal | null {
  if (doc.status === 'signed') {
    return { status: 400, error: 'This document is already signed' }
  }
  if (!hasSigningContent(doc)) {
    return { status: 400, error: 'Add contract text, a canonical document URL, or a reference link before sending for signature.' }
  }
  if (doc.status !== 'unsent' && doc.status !== 'sent') {
    return { status: 400, error: 'Invalid status for sending' }
  }
  return null
}

/** The sent copy of a person's signing email (docs/SENT_COPIES.md): kept under the person the name found, when it found one. */
export function personSigningSentCopy(args: {
  doc: { id: string; person_name: string }
  personId: string | null
  sentBy: string
  signerEmail: string
  from: string
  subject: string
  html: string
  resendEmailId: string | null
}): [
  { kind: string; recipientName: string; personId: string | null; source: { table: string; id: string }; sentBy: string },
  { to: string[]; from: string; subject: string; html: string; resendEmailId: string | null },
] {
  return [
    { kind: 'person_contract', recipientName: args.doc.person_name, personId: args.personId, source: { table: 'person_contract_documents', id: args.doc.id }, sentBy: args.sentBy },
    { to: [args.signerEmail.trim()], from: args.from, subject: args.subject, html: args.html, resendEmailId: args.resendEmailId },
  ]
}
