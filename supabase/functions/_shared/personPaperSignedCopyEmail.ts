/**
 * The signer's own copy of a paper they signed (punch list #376). Until now nobody was emailed once a person signed:
 * the office saw the paper turn signed, and the signer kept nothing. This is the email that carries the PDF to them,
 * at the address the send kept on the paper (`signer_email`, since v2.7986).
 *
 * Which paper: an agreement, never an hours statement, a W-9, a certificate or a licence, whose PDF holds a tax number
 * or is HR's own. A paper signed with no address on it (in person, or sent before the send kept one) emails nobody.
 * Pure and dependency-free: the app's catalog draws its sample from here.
 */
import { signerEmailWord } from './paperSigner.ts'

/** A signed paper as far as the signer's copy reads it. */
export interface SignedCopyRow {
  status?: string | null
  doc_type?: string | null
  signer_email?: string | null
  signed_copy_sent_at?: string | null
}

/** Why a signed paper's signer gets no copy by email, or null when one goes. */
export type SignedCopyHold = 'not_signed' | 'kind' | 'no_address' | 'sent_already'

export function signedCopyHold(row: SignedCopyRow): SignedCopyHold | null {
  if (row.status !== 'signed') return 'not_signed'
  if ((row.doc_type ?? 'agreement') !== 'agreement') return 'kind'
  if (signerEmailWord(row.signer_email) === null) return 'no_address'
  if ((row.signed_copy_sent_at ?? '').trim()) return 'sent_already'
  return null
}

/** The attached file's name: the paper's name, safe for a file. */
export function signedCopyFileName(documentName: string): string {
  const base = (documentName ?? '')
    .replace(/[^A-Za-z0-9 _.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${base || 'Agreement'} - signed.pdf`
}

export interface SignedCopyEmailInput {
  documentName: string
  /** Who signed, as they printed their name. */
  signerName: string
  /** The day it was signed, in words. */
  signedLabel: string
  company: string
  officePhone: string | null
}

export interface SignedCopyEmail {
  subject: string
  text: string
  html: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The email. Short on purpose: the PDF is the copy, and the words only say what it is. */
export function buildSignedCopyEmail(input: SignedCopyEmailInput): SignedCopyEmail {
  const doc = input.documentName.trim() || 'your agreement'
  const first = input.signerName.trim().split(/\s+/)[0] ?? ''
  const hello = first ? `${first},` : 'Hello,'
  const subject = `Your signed copy: ${doc} · ${input.company}`
  const signed = input.signedLabel.trim() ? `You signed ${doc} on ${input.signedLabel.trim()}.` : `You signed ${doc}.`
  const keep = 'Your copy is attached as a PDF. Keep it for your records.'
  const phone = (input.officePhone ?? '').trim()
  const reach = phone ? `Questions? Call or text the office at ${phone}.` : 'Questions? Call or text the office.'
  const text = [input.company, '', hello, '', signed, keep, '', reach].join('\n')

  const ink = '#16283c'
  const paper = '#f6f3ec'
  const muted = '#5a6b7e'
  const hair = '#ddd6c8'
  const copper = '#9a5b2b'
  const font = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
  const html =
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><meta name="color-scheme" content="light only" /></head>` +
    `<body style="margin:0;padding:0;background:${paper}">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${paper}"><tr><td align="center" style="padding:20px 12px 28px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%"><tr><td style="padding:0 6px;${font}">` +
    `<div style="font-size:26px;font-weight:900;letter-spacing:-0.03em;line-height:1;color:${ink}">CLICK<span style="color:${copper}">.</span></div>` +
    `<div style="height:3px;background:${ink};margin:12px 0 0;font-size:0;line-height:0">&nbsp;</div>` +
    `<div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${copper};margin-top:20px">Your signed copy</div>` +
    `<h1 style="${font}font-size:22px;font-weight:800;line-height:1.2;margin:4px 0 0;color:${ink}">${esc(doc)}</h1>` +
    `<p style="${font}font-size:15px;line-height:1.55;color:${ink};margin:18px 0 0">${esc(hello)}</p>` +
    `<p style="${font}font-size:15px;line-height:1.55;color:${ink};margin:10px 0 0">${esc(signed)} ${esc(keep)}</p>` +
    `<div style="height:1px;background:${hair};margin:18px 0 10px;font-size:0;line-height:0">&nbsp;</div>` +
    `<p style="${font}font-size:12px;color:${muted};margin:0;line-height:1.5">${esc(reach)} ${esc(input.company)}</p>` +
    `</td></tr></table></td></tr></table></body></html>`
  return { subject, text, html }
}
