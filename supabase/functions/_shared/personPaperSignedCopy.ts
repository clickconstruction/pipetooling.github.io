/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A signed paper's PDF and the signer's copy, the fetches (punch list #376). Two callers:
 *
 * - `accept-contract`, once the signature row has committed: make the PDF of a plain or clause paper, keep it, and
 *   email the signer their copy. Best effort: a signature never fails because its copy could not be made or sent.
 * - `person-paper-pdf`, when the office opens a signed paper's PDF: make it the first time an older paper is opened.
 *   It emails nobody.
 *
 * What is drawn is `personPaperPdf.ts`, who is emailed is `personPaperSignedCopyEmail.ts`; both are pure and tested
 * under vitest. This file is the storage, the row and the send. pdf-lib is passed in by the function that loads it.
 */
import type { PdfLibLike } from './jobContractPdf.ts'
import { buildPersonPaperPdf, paperAuditLine, paperMakesAPdf, paperParagraphs, paperPdfPath } from './personPaperPdf.ts'
import { buildSignedCopyEmail, signedCopyFileName, signedCopyHold, type SignedCopyHold } from './personPaperSignedCopyEmail.ts'
import { isPartyPaperName, paperWord, partyFileWords, signerEmailWord } from './paperSigner.ts'
import { isCompanyPaperName } from './companyPaper.ts'
import { withSitePrintLine } from './paperSitePrint.ts'
import { APP_CALENDAR_TZ } from './appTimeZone.ts'
import { hasOfficeBoxes, type FormSchema } from './formSchema.ts'
import { sendEmailViaResend } from './resendSendEmail.ts'
import { EMAIL_FROM } from './emailFrom.ts'
import { mailboxWithName } from './mailboxWithName.ts'
import { PORTAL_COMPANY } from './portalCompany.ts'
import { CONTRACT_SIGNING_EMAIL_COMPANY, formatYmdForContractEmail } from './contractSigningEmail.ts'

/** The forms' bucket: a plain paper's PDF is kept beside a form's. */
export const PAPER_PDF_BUCKET = 'contract-form-pdfs'
const SIGNATURE_BUCKET = 'contract-signer-signatures'

/** The columns both callers read. */
export const SIGNED_PAPER_COLUMNS =
  'id, status, doc_type, person_id, person_name, party_name, document_name, signing_body_html, signing_body_format, clause_versions, form_template_id, form_pdf_storage_path, office_completed_at, signed_at, signer_consented_at, signer_ip, signer_printed_name, signer_name, signer_title, signing_for, signer_email, signer_signature_storage_path, signed_pdf_storage_path, signed_copy_sent_at, site_address, site_prints_address'

export interface SignedPaperRow {
  id: string
  status: string
  doc_type: string | null
  person_id: string | null
  person_name: string | null
  party_name: string | null
  document_name: string
  signing_body_html: string | null
  signing_body_format: string | null
  clause_versions: unknown
  form_template_id: string | null
  form_pdf_storage_path: string | null
  office_completed_at: string | null
  signed_at: string | null
  signer_consented_at: string | null
  signer_ip: string | null
  signer_printed_name: string | null
  signer_name: string | null
  signer_title: string | null
  signing_for: string | null
  signer_email: string | null
  signer_signature_storage_path: string | null
  signed_pdf_storage_path: string | null
  signed_copy_sent_at: string | null
  /** The site's address as written, and whether the paper prints it (punch list #439). Absent on a row read without them. */
  site_address?: string | null
  site_prints_address?: boolean | null
}

type Admin = { from(table: string): any; storage: { from(bucket: string): any } }

/** Who the paper is for, on the PDF: the person, the party of a party's paper, or whoever signed a company's. */
export function paperPdfForWords(row: Pick<SignedPaperRow, 'person_name' | 'party_name' | 'signer_name' | 'signer_printed_name'>): string {
  const name = row.person_name ?? ''
  if (isPartyPaperName(name)) return partyFileWords(row)
  if (isCompanyPaperName(name)) return paperWord(row.signer_printed_name) ?? ''
  return name.trim()
}

/** *Purchasing Manager, for Lone Pine Supply*: what the signer signs as, when the paper kept it. */
export function paperPdfCapacity(row: Pick<SignedPaperRow, 'signer_title' | 'signing_for'>): string | null {
  const title = paperWord(row.signer_title)
  const forWhom = paperWord(row.signing_for)
  const words = [title, forWhom ? `for ${forWhom}` : null].filter(Boolean).join(', ')
  return words || null
}

function consentLabel(iso: string | null): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  return `${new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, dateStyle: 'medium', timeStyle: 'short' }).format(at)} CT`
}

async function bytesOf(blob: unknown): Promise<Uint8Array | null> {
  if (!blob || typeof (blob as Blob).arrayBuffer !== 'function') return null
  return new Uint8Array(await (blob as Blob).arrayBuffer())
}

/** Draw one signed paper. The drawn signature is read from its bucket; a read that fails draws the typed name. */
export async function drawPaperPdf(admin: Admin, lib: PdfLibLike, row: SignedPaperRow): Promise<Uint8Array> {
  let png: Uint8Array | null = null
  const sigPath = (row.signer_signature_storage_path ?? '').trim()
  if (sigPath) {
    try {
      const { data } = await admin.storage.from(SIGNATURE_BUCKET).download(sigPath)
      png = await bytesOf(data)
    } catch (e) {
      console.error('paper pdf signature', row.id, e)
    }
  }
  const company = [PORTAL_COMPANY.phone, PORTAL_COMPANY.email].filter(Boolean).join('  ·  ')
  return buildPersonPaperPdf(lib, {
    title: row.document_name,
    company: PORTAL_COMPANY.name,
    companyLine: company || null,
    forWords: paperPdfForWords(row),
    // A paper that prints its site's address opens with that line, as the signer's page showed it (punch list #439).
    paragraphs: withSitePrintLine(paperParagraphs(row), row),
    signature: {
      printedName: paperWord(row.signer_printed_name) ?? paperWord(row.signer_name) ?? '',
      capacity: paperPdfCapacity(row),
      signedLabel: formatYmdForContractEmail(row.signed_at) ?? '',
      auditLine: paperAuditLine({ drawn: png !== null, consentedLabel: consentLabel(row.signer_consented_at), ip: row.signer_ip }),
      png,
      recordId: `P-${row.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
    },
  })
}

/**
 * The PDF of a signed plain or clause paper: the one kept, else made now and kept. Null for a paper that makes none
 * (a form, a paper that is only a link, one not signed). `bytes` is set when it was made in this call.
 * Throws when the bucket or the row refuses the write.
 */
export async function ensurePaperPdf(admin: Admin, lib: PdfLibLike, row: SignedPaperRow): Promise<{ path: string; bytes: Uint8Array | null } | null> {
  if (!paperMakesAPdf(row)) return null
  const kept = (row.signed_pdf_storage_path ?? '').trim()
  if (kept) return { path: kept, bytes: null }
  const bytes = await drawPaperPdf(admin, lib, row)
  const path = paperPdfPath(row.id)
  const { error: upErr } = await admin.storage.from(PAPER_PDF_BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (upErr) throw new Error(`The PDF was not kept: ${upErr.message ?? 'storage refused it'}`)
  const { error: rowErr } = await admin.from('person_contract_documents').update({ signed_pdf_storage_path: path }).eq('id', row.id).eq('status', 'signed')
  if (rowErr) throw new Error(`The PDF's place was not written: ${rowErr.message ?? 'the row refused it'}`)
  return { path, bytes }
}

function base64Of(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}

/** What became of the signer's copy. */
export type SignerCopyOutcome = { sent: true; to: string } | { sent: false; reason: SignedCopyHold | 'no_pdf' | 'office_step' | 'no_mail_key' | 'failed'; detail?: string }

/**
 * Email the signer their copy with the PDF attached, once. A plain or clause paper sends the PDF made for it. A form
 * sends its filled PDF, and a two-party form waits for the office's half, so it sends none here.
 */
export async function sendSignerCopy(admin: Admin, lib: PdfLibLike, row: SignedPaperRow, resendKey: string | null | undefined): Promise<SignerCopyOutcome> {
  const hold = signedCopyHold(row)
  if (hold) return { sent: false, reason: hold }
  const to = signerEmailWord(row.signer_email)!
  let bytes: Uint8Array | null = null
  if (row.form_template_id) {
    const formPath = (row.form_pdf_storage_path ?? '').trim()
    if (!formPath) return { sent: false, reason: 'no_pdf' }
    // A two-party form is not finished until the office signs its half: the PDF so far is not the signer's copy.
    const { data: tpl } = await admin.from('contract_form_templates').select('schema').eq('id', row.form_template_id).maybeSingle()
    const schema = (tpl as { schema?: FormSchema | null } | null)?.schema ?? null
    if (schema && Array.isArray(schema.boxes) && hasOfficeBoxes(schema) && !row.office_completed_at) return { sent: false, reason: 'office_step' }
    const { data } = await admin.storage.from(PAPER_PDF_BUCKET).download(formPath)
    bytes = await bytesOf(data)
  } else {
    const made = await ensurePaperPdf(admin, lib, row)
    if (!made) return { sent: false, reason: 'no_pdf' }
    bytes = made.bytes
    if (!bytes) {
      const { data } = await admin.storage.from(PAPER_PDF_BUCKET).download(made.path)
      bytes = await bytesOf(data)
    }
  }
  if (!bytes || bytes.length === 0) return { sent: false, reason: 'no_pdf' }
  if (!resendKey) return { sent: false, reason: 'no_mail_key' }

  const mail = buildSignedCopyEmail({
    documentName: row.document_name,
    signerName: paperWord(row.signer_printed_name) ?? paperWord(row.signer_name) ?? '',
    signedLabel: formatYmdForContractEmail(row.signed_at) ?? '',
    company: CONTRACT_SIGNING_EMAIL_COMPANY,
    officePhone: PORTAL_COMPANY.phone || null,
  })
  const forWords = paperPdfForWords(row)
  // Sent copies (docs/SENT_COPIES.md): the signer's copy is kept under the person, with its PDF. No sender: it sends itself.
  const r = await sendEmailViaResend(to, mail.subject, mail.text, mail.html, resendKey, {
    from: mailboxWithName(CONTRACT_SIGNING_EMAIL_COMPANY, EMAIL_FROM),
    emailType: 'contract_signed_copy',
    attachments: [{ filename: signedCopyFileName(row.document_name), content: base64Of(bytes) }],
    file: { kind: 'person_contract', recipientName: forWords || null, personId: row.person_id, source: { table: 'person_contract_documents', id: row.id } },
  })
  if (!r.success) return { sent: false, reason: 'failed', detail: r.error }
  const { error } = await admin.from('person_contract_documents').update({ signed_copy_sent_at: new Date().toISOString() }).eq('id', row.id)
  if (error) console.error('signed copy stamp', row.id, error)
  return { sent: true, to }
}
