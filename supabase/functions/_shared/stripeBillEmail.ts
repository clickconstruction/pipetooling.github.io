/**
 * The bill email the payer reads — ours, where Stripe's own used to go.
 *
 * Stripe's invoice email, hosted page and PDF take no image, so a QR code back to the
 * customer's statement has nowhere to sit on them. When the office presses Send Email invoice
 * the payer now gets THIS email from us: the amount and the due date, a Pay now button on the
 * bill's own address (`/pay/<id>`, which outlives Stripe's link), the invoice PDF, and — when
 * the payer has a portal — "Your account, any time" with the code and the short address in
 * words. Paying still happens on Stripe's page. Pure (no Deno, no Stripe); tested from
 * `src/lib/billing/stripeBillEmail.test.ts`.
 */
import { formatCentsUsd, formatDueDate } from './stripeBillCopyEmail.ts'

/** The Content-ID the code rides under as an inline attachment; the HTML reads it as `cid:`. */
export const BILL_EMAIL_QR_CONTENT_ID = 'portal-qr'
export const BILL_EMAIL_QR_FILENAME = 'your-account-qr.png'
/** The code's side in the email, in CSS pixels; the file is drawn larger so it stays sharp. */
export const BILL_EMAIL_QR_DISPLAY_PX = 120
/** A statement address longer than this is not worth printing in words — the link says "Open your statement". */
export const BILL_EMAIL_ADDRESS_MAX_CHARS = 48

const INK = '#16283c'
const COPPER = '#b0662f'
const CREAM = '#f6f3ec'
const MUTED = '#5b6676'
const RULE = '#e4dfd3'

export type StripeBillEmailInput = {
  companyName: string
  companyPhone: string
  /** Who the bill is addressed to. */
  payerName: string
  /** The service address — the customer's own words for the job; never our job name or number. */
  jobAddress: string
  /** Stripe's invoice number (the one on the hosted page and the PDF). */
  invoiceNumber: string
  amountDueCents: number
  /** Unix seconds from Stripe, or null when the invoice has no due date. */
  dueDateUnix: number | null
  /** The bill's own pay address (`https://clicktooling.com/pay/<id>`). */
  payUrl: string
  /** Stripe's PDF link when it has one — printed only when the file could not be attached. */
  invoicePdfUrl: string | null
  pdfAttached: boolean
  /** The payer's statement; null when they have no portal or the bill goes to someone else. */
  portalUrl: string | null
  /** What the code's `<img>` loads — `cid:portal-qr` in a real send, a data URL in a sample; null draws no code. */
  qrImgSrc: string | null
  /** True when a reply reaches a person (the sender's address rides as Reply-To). */
  canReply: boolean
  /** A test-mode bill goes to whoever pressed Send; this names the address it did not go to. */
  testIntendedFor?: string | null
}

export type StripeBillEmail = { subject: string; text: string; html: string }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The statement address in words ("my.clickplumbing.com/hartwell-homes-k7x2"), or null when it is too long to read. */
export function portalAddressInWords(portalUrl: string | null | undefined): string | null {
  const url = (portalUrl ?? '').trim()
  // A token address keeps its key in the query; in words without it, it would lead nowhere.
  if (!url || /[?#]/.test(url)) return null
  const words = url.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  return words && words.length <= BILL_EMAIL_ADDRESS_MAX_CHARS ? words : null
}

export function stripeBillEmailSubject(input: Pick<StripeBillEmailInput, 'companyName' | 'invoiceNumber' | 'testIntendedFor'>): string {
  const number = input.invoiceNumber.trim()
  const subject = `Invoice${number ? ` #${number}` : ''} from ${input.companyName}`
  return (input.testIntendedFor ?? '').trim() ? `[Test] ${subject}` : subject
}

export function buildStripeBillEmail(input: StripeBillEmailInput): StripeBillEmail {
  const amount = formatCentsUsd(input.amountDueCents)
  const due = formatDueDate(input.dueDateUnix)
  const payer = input.payerName.trim()
  const addr = input.jobAddress.trim()
  const number = input.invoiceNumber.trim()
  const phone = input.companyPhone.trim()
  const portal = (input.portalUrl ?? '').trim()
  const words = portalAddressInWords(portal)
  const pdf = (input.invoicePdfUrl ?? '').trim()
  const qr = portal ? (input.qrImgSrc ?? '').trim() : ''
  const testFor = (input.testIntendedFor ?? '').trim()
  const invoiceLine = number ? `Invoice #${number}` : 'Invoice'
  const questions = [phone ? `call ${phone}` : '', input.canReply ? 'reply to this email' : ''].filter(Boolean).join(' or ')
  const testLine = testFor ? `Test bill. This email came to you instead of ${testFor}; nothing was sent to the customer.` : ''

  const lines: string[] = [
    testLine,
    '',
    payer ? `Hello ${payer},` : 'Hello,',
    '',
    `Here is your invoice from ${input.companyName}${addr ? ` for ${addr}` : ''}.`,
    '',
    `Amount due: ${amount}${due ? ` · Due ${due}` : ''}`,
    number ? `Invoice #${number}` : '',
    '',
    `Pay online: ${input.payUrl}`,
    input.pdfAttached ? 'The invoice is attached as a PDF.' : pdf ? `Invoice PDF: ${pdf}` : '',
    '',
    portal ? `Your account, any time: ${portal}` : '',
    portal ? 'Every open bill and payment, with no login.' : '',
    '',
    questions ? `Questions? ${questions.charAt(0).toUpperCase()}${questions.slice(1)}.` : '',
    '',
    input.companyName,
  ]
  const text = lines
    .filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === '')))
    .join('\n')
    .trim()

  const accountText = [
    `<div style="font-weight: 600; color: ${INK};">Your account, any time</div>`,
    words
      ? `<div style="margin: 2px 0 0; word-break: break-all;"><a href="${esc(portal)}" style="color: ${COPPER}; font-weight: 600; text-decoration: none;">${esc(words)}</a></div>`
      : `<div style="margin: 2px 0 0;"><a href="${esc(portal)}" style="color: ${COPPER}; font-weight: 600;">Open your statement</a></div>`,
    `<div style="margin: 4px 0 0; color: ${MUTED}; font-size: 13px;">Every open bill and payment, with no login.${qr ? ' Scan the code with your phone camera.' : ''}</div>`,
  ].join('')
  const accountCard = portal
    ? [
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 20px; background: ${CREAM}; border-radius: 8px;"><tr>`,
        qr
          ? `<td width="${BILL_EMAIL_QR_DISPLAY_PX}" valign="middle" style="padding: 14px 0 14px 14px;"><a href="${esc(portal)}"><img src="${esc(qr)}" width="${BILL_EMAIL_QR_DISPLAY_PX}" height="${BILL_EMAIL_QR_DISPLAY_PX}" alt="QR code for ${esc(words ?? 'your statement')}" style="display: block; border: 0; border-radius: 4px;"></a></td>`
          : '',
        `<td valign="middle" style="padding: 14px 16px; font-size: 15px; line-height: 1.45;">${accountText}</td>`,
        `</tr></table>`,
      ].join('')
    : ''

  const html = [
    `<div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: ${INK}; max-width: 560px; margin: 0 auto; background: #ffffff;">`,
    testLine ? `<div style="background: #fdf3d7; color: #6b4a00; padding: 10px 20px; font-size: 13px;">${esc(testLine)}</div>` : '',
    `<div style="background: ${INK}; color: #ffffff; padding: 16px 20px; font-size: 16px; font-weight: 600;">${esc(input.companyName)}</div>`,
    `<div style="padding: 22px 20px 8px;">`,
    `<p style="margin: 0 0 14px;">${payer ? `Hello ${esc(payer)},` : 'Hello,'}</p>`,
    `<p style="margin: 0 0 18px;">Here is your invoice from ${esc(input.companyName)}${addr ? ` for ${esc(addr)}` : ''}.</p>`,
    `<div style="margin: 0 0 4px; color: ${MUTED}; font-size: 13px;">${esc(invoiceLine)}</div>`,
    `<div style="margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2;">${esc(amount)}</div>`,
    due ? `<div style="margin: 2px 0 0; color: ${MUTED};">Due ${esc(due)}</div>` : '',
    `<p style="margin: 18px 0 8px;"><a href="${esc(input.payUrl)}" style="display: inline-block; background: ${COPPER}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">Pay now</a></p>`,
    `<p style="margin: 0 0 20px; color: ${MUTED}; font-size: 13px;">Card or bank transfer, on Stripe's secure page.${
      input.pdfAttached ? ' The invoice is attached as a PDF.' : pdf ? ` <a href="${esc(pdf)}" style="color: ${COPPER};">Download the invoice PDF</a>` : ''
    }</p>`,
    accountCard,
    `<div style="border-top: 1px solid ${RULE}; padding: 14px 0 18px; color: ${MUTED}; font-size: 13px;">${
      questions ? `Questions? ${esc(questions.charAt(0).toUpperCase() + questions.slice(1))}.` : esc(input.companyName)
    }</div>`,
    `</div>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join('\n')

  return { subject: stripeBillEmailSubject(input), text, html }
}
