/**
 * The copy email that rides beside a Stripe bill (v2.3359, "Bills also go to").
 *
 * Stripe emails one address per customer and has no CC, so when the office
 * presses Send Email invoice the payer gets Stripe's email and everyone on the
 * bill's `copy_emails` gets THIS one from us — the same Pay link, the amount,
 * the due date, and who the bill is addressed to, so a copy is never mistaken
 * for a second bill. Pure (no Deno, no Stripe); tested from
 * `src/lib/billing/stripeBillCopyEmail.test.ts`.
 */
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

export type StripeBillCopyEmailInput = {
  /** Who the bill is addressed to — the payer's name. */
  payerName: string
  /** "J1013 · Peterson Pretest" — the job number and name the office uses. */
  jobLabel: string
  jobAddress: string
  /** Stripe's invoice number (the one on the hosted page). */
  invoiceNumber: string
  amountDueCents: number
  /** Unix seconds from Stripe, or null when the invoice has no due date. */
  dueDateUnix: number | null
  hostedInvoiceUrl: string
  /** Stripe's PDF link when it has one. */
  invoicePdfUrl: string | null
  companyName: string
  /** The recipient's own portal statement (v2.3362) — the payer's for the payer's people, the other party's own; null for a one-off. */
  portalUrl?: string | null
}

export type StripeBillCopyEmail = { subject: string; text: string; html: string }

export function formatCentsUsd(cents: number): string {
  const dollars = Math.round(cents) / 100
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDueDate(unix: number | null): string | null {
  if (unix == null || !Number.isFinite(unix)) return null
  const d = new Date(unix * 1000)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: APP_CALENDAR_TZ })
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildStripeBillCopyEmail(input: StripeBillCopyEmailInput): StripeBillCopyEmail {
  const amount = formatCentsUsd(input.amountDueCents)
  const due = formatDueDate(input.dueDateUnix)
  const payer = input.payerName.trim() || 'the customer'
  const job = input.jobLabel.trim()
  const addr = input.jobAddress.trim()
  const number = input.invoiceNumber.trim()
  const portal = (input.portalUrl ?? '').trim()
  const subject = `Copy of invoice${number ? ` #${number}` : ''}${job ? ` — ${job}` : ''}`

  const lines: string[] = [
    `This is a copy of the bill ${input.companyName} sent to ${payer}${addr ? ` for ${addr}` : ''}.`,
    '',
    `Amount due: ${amount}${due ? ` · Due ${due}` : ''}`,
    number ? `Invoice #${number}` : '',
    job ? `Job: ${job}` : '',
    '',
    `Pay or view the bill: ${input.hostedInvoiceUrl}`,
    input.invoicePdfUrl ? `PDF: ${input.invoicePdfUrl}` : '',
    portal ? `See your statement any time: ${portal}` : '',
    '',
    `You are receiving this because you are on the copy list for ${payer}'s bills. ${payer} was billed directly by Stripe.`,
  ]
  const text = lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n')

  const html = [
    `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 15px; line-height: 1.5; color: #111827; max-width: 560px;">`,
    `<p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em;">Copy of a bill</p>`,
    `<p style="margin: 0 0 16px;">This is a copy of the bill <strong>${esc(input.companyName)}</strong> sent to <strong>${esc(payer)}</strong>${addr ? ` for ${esc(addr)}` : ''}.</p>`,
    `<table style="border-collapse: collapse; margin: 0 0 16px;">`,
    `<tr><td style="padding: 2px 12px 2px 0; color: #6b7280;">Amount due</td><td style="padding: 2px 0; font-weight: 600;">${esc(amount)}</td></tr>`,
    due ? `<tr><td style="padding: 2px 12px 2px 0; color: #6b7280;">Due</td><td style="padding: 2px 0;">${esc(due)}</td></tr>` : '',
    number ? `<tr><td style="padding: 2px 12px 2px 0; color: #6b7280;">Invoice</td><td style="padding: 2px 0;">#${esc(number)}</td></tr>` : '',
    job ? `<tr><td style="padding: 2px 12px 2px 0; color: #6b7280;">Job</td><td style="padding: 2px 0;">${esc(job)}</td></tr>` : '',
    `</table>`,
    `<p style="margin: 0 0 16px;"><a href="${esc(input.hostedInvoiceUrl)}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600;">Pay or view the bill</a></p>`,
    input.invoicePdfUrl ? `<p style="margin: 0 0 16px; font-size: 13px;"><a href="${esc(input.invoicePdfUrl)}" style="color: #2563eb;">Download the PDF</a></p>` : '',
    portal ? `<p style="margin: 0 0 16px; font-size: 13px;">See your statement any time at <a href="${esc(portal)}" style="color: #2563eb;">${esc(portal)}</a></p>` : '',
    `<p style="margin: 0; color: #6b7280; font-size: 13px;">You are receiving this because you are on the copy list for ${esc(payer)}'s bills. ${esc(payer)} was billed directly by Stripe.</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, text, html }
}
