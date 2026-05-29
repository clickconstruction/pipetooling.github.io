/**
 * Pure builders for the Lien Release / Conditional Waiver document (HTML + plain text) plus the
 * default field values, extracted from `src/pages/Bids.tsx`.
 */

import { addressLines, escapeHtml } from './htmlDoc'
import { formatAmountFromString } from '../bids/bidFormatting'

export type LienReleaseFormData = {
  invoiceAmount: string
  bidAmount: string
  invoicesToDate: string
  cc: string
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  invoiceDate: string
  invoiceNumber: string
  descriptionOfWork: string
  conditionalWaiver: string
  paymentTerms: string
  lienStatusPhone: string
}

export const LIEN_RELEASE_DEFAULT_COMPANY_ADDRESS = '5501 Balcones Dr Ste A141, Austin, Texas 78731'
export const LIEN_RELEASE_DEFAULT_LIEN_PHONE = '+1 512 360 0599'
export const LIEN_RELEASE_DEFAULT_COMPANY_PHONE = '+1 512 360 0599'
export const LIEN_RELEASE_DEFAULT_COMPANY_EMAIL = 'office@clickplumbing.com'
export const LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER = 'CONDITIONAL WAIVER AND RELEASE ONLY upon receipt and collection of good funds in the amount of ${{finalInvoice}} payable to Click Plumbing and Electrical, the undersigned hereby waives and releases any and all mechanic\'s lien rights, payment bond claims, or claims against the project or property described above that have arisen or may arise through the date of this invoice.\n\nThis waiver and release is expressly conditional and shall be void and of no effect if the ${{invoicesToDate}} payment is not actually received and collected in full. Click Plumbing and Electrical expressly reserves all lien, bond, and contract rights until payment is received and clears.'
export const LIEN_RELEASE_DEFAULT_PAYMENT_TERMS = 'Payment of ${{finalInvoice}} is due immediately upon receipt of this invoice. Pursuant to Texas Property Code Chapter 28 (Prompt Payment Act), if payment in full is not received within 45 days of the invoice date, interest shall accrue at the rate of one and one-half percent (1.5%) per month (18% per annum) on the unpaid balance beginning on day 46, and {{ownerName}} shall also be liable for all reasonable attorney\'s fees, collection costs, and court costs incurred by Click Plumbing and Electrical to collect the overdue amount.'

export function buildLienReleaseHtml(
  customerName: string,
  _customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: LienReleaseFormData,
  ownerName: string
): string {
  const br = '<br/>'
  const pStyle = 'margin: 0 0 0.5em 0'

  const invoiceAmtFmt = formatAmountFromString(form.invoiceAmount)
  const invToDateFmt = formatAmountFromString(form.invoicesToDate)
  const amountDisplay = invoiceAmtFmt || '—'
  const invToDateDisplay = invToDateFmt || '—'

  const boldAmount = '<strong>$' + amountDisplay + '</strong>'
  const boldInvToDate = '<strong>$' + invToDateDisplay + '</strong>'
  let conditionalWaiver = escapeHtml(form.conditionalWaiver || '')
    .replace(/\$\{\{finalInvoice\}\}/g, boldAmount)
    .replace(/\$\{\{invoicesToDate\}\}/g, boldInvToDate)
    .replace(/\{\{finalInvoice\}\}/g, boldAmount)
    .replace(/\{\{invoicesToDate\}\}/g, boldInvToDate)
  conditionalWaiver = conditionalWaiver.replace(/\n/g, br)
  conditionalWaiver = conditionalWaiver
    .replace(/(CONDITIONAL WAIVER AND RELEASE ONLY)( upon)/g, '<strong>$1</strong>$2')
    .replace(/(expressly )(conditional)( and shall be )/g, '$1<strong>$2</strong>$3')
    .replace(/(shall be )(void and of no effect)( if)/g, '$1<strong>$2</strong>$3')
    .replace(/(within )(45 days)( of)/g, '$1<strong>$2</strong>$3')
    .replace(/(at the rate of )(one and one-half percent \(1\.5\%\) per month)( \(18% per annum\))/g, '$1<strong>$2</strong>$3')

  let paymentTerms = escapeHtml(form.paymentTerms || '')
    .replace(/\$\{\{finalInvoice\}\}/g, boldAmount)
    .replace(/\{\{finalInvoice\}\}/g, boldAmount)
    .replace(/\{\{ownerName\}\}/g, ownerName || '—')
  paymentTerms = paymentTerms.replace(/\n/g, br)

  const projectAddr = addressLines(projectAddress).map((l) => escapeHtml(l)).join(br)
  const claimantAddr = addressLines(form.companyAddress).map((l) => escapeHtml(l)).join(br)

  const projectBlock = '<strong>Project:</strong>' + br + escapeHtml(projectName || '—') + br + projectAddr
  const ownerBlock = '<strong>Owner / Contracting Party:</strong>' + br + escapeHtml(customerName || '—')

  const claimantLines: string[] = [escapeHtml(form.companyName || '—'), claimantAddr]
  if (form.companyPhone) claimantLines.push('Phone: ' + escapeHtml(form.companyPhone))
  if (form.companyEmail) claimantLines.push('Email: ' + escapeHtml(form.companyEmail))
  const claimantBlock = '<strong>Claimant (Releasing Party):</strong>' + br + claimantLines.join(br)

  const invoiceDateStr = form.invoiceDate ? new Date(form.invoiceDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
  const invoiceBlock = '<strong>Invoice / Application for Payment:</strong>' + br + 'Invoice Date: ' + escapeHtml(invoiceDateStr) + br + 'Invoice Number: ' + escapeHtml(form.invoiceNumber || '—') + br + 'Amount of this Application: ' + boldAmount

  const lienPhone = form.lienStatusPhone || LIEN_RELEASE_DEFAULT_LIEN_PHONE
  const lienBlock = '<strong>Lien Status Verification</strong>' + br + 'Current status of any lien filings or pencil-copy documentation may be verified at any time by calling: <strong>' + escapeHtml(lienPhone) + '</strong>'

  const sep = br + br
  let mainContent = projectBlock + sep + ownerBlock
  if ((form.cc || '').trim()) mainContent += sep + 'CC: ' + escapeHtml(form.cc.trim())
  mainContent += sep + claimantBlock + sep + invoiceBlock
  if ((form.descriptionOfWork || '').trim()) mainContent += sep + 'Description of Work / Period Covered:' + br + escapeHtml(form.descriptionOfWork.trim()).replace(/\n/g, br)
  mainContent += sep + conditionalWaiver + br + '<div style="text-align: center;"><strong>Payment Terms & Late Payment Consequences:</strong></div>' + paymentTerms + br + lienBlock

  const paragraphs: string[] = []
  const summaryLines: string[] = []
  if (invoiceAmtFmt) summaryLines.push(invoiceAmtFmt + ' - FINAL INVOICE')
  if (invToDateFmt) summaryLines.push(invToDateFmt + ' - Invoices to date')
  if (summaryLines.length > 0) {
    paragraphs.push(summaryLines.join(br))
    paragraphs.push('')
  }
  paragraphs.push(mainContent)

  const headerLines = [
    '<strong>' + escapeHtml('CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT') + '</strong>',
    escapeHtml('(Texas Property Code § 53.284(c) – Conditional Waiver and Release on Progress Payment)'),
    '<strong>' + escapeHtml('Effective ONLY Upon Actual Receipt and Collection of Payment') + '</strong>',
  ]
  const headerHtml = '<p style="text-align: center; font-family: inherit; font-size: 0.875rem; margin: 0 0 0.5em 0; padding: 0; line-height: 1.15;">' + headerLines.join(br) + '</p>'
  const contentHtml = paragraphs.map((p) => (p ? '<p style="' + pStyle + '">' + p + '</p>' : '<p style="' + pStyle + '">&nbsp;</p>')).join('')
  return headerHtml + '<div style="white-space: pre-wrap; font-family: inherit; font-size: 0.875rem;">' + contentHtml + '</div>'
}

export function buildLienReleaseText(
  customerName: string,
  _customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: LienReleaseFormData,
  ownerName: string
): string {
  const invoiceAmtFmt = formatAmountFromString(form.invoiceAmount)
  const invToDateFmt = formatAmountFromString(form.invoicesToDate)

  const conditionalWaiver = (form.conditionalWaiver || '')
    .replace(/\{\{finalInvoice\}\}/g, invoiceAmtFmt || '—')
    .replace(/\{\{invoicesToDate\}\}/g, invToDateFmt || '—')
  const paymentTerms = (form.paymentTerms || '')
    .replace(/\{\{finalInvoice\}\}/g, invoiceAmtFmt || '—')
    .replace(/\{\{ownerName\}\}/g, ownerName || '—')

  const headerLines = [
    'CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT',
    '(Texas Property Code § 53.284(c) – Conditional Waiver and Release on Progress Payment)',
    'Effective ONLY Upon Actual Receipt and Collection of Payment',
  ]
  const headerText = headerLines.join('\n')
  const sep = '\n\n'
  const lines: string[] = [headerText]
  if (invoiceAmtFmt) lines.push(invoiceAmtFmt + ' - FINAL INVOICE')
  if (invToDateFmt) lines.push(invToDateFmt + ' - Invoices to date')
  if (lines.length > 0) lines.push('')
  const projectSection = ['Project:', projectName || '—', ...addressLines(projectAddress)].join('\n')
  const ownerSection = ['Owner / Contracting Party:', customerName || '—'].join('\n')
  const claimantSection = ['Claimant (Releasing Party):', form.companyName || '—', ...addressLines(form.companyAddress), ...(form.companyPhone ? ['Phone: ' + form.companyPhone] : []), ...(form.companyEmail ? ['Email: ' + form.companyEmail] : [])].join('\n')
  const invoiceDateStr = form.invoiceDate ? new Date(form.invoiceDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
  const invoiceSection = ['Invoice / Application for Payment:', 'Invoice Date: ' + invoiceDateStr, 'Invoice Number: ' + (form.invoiceNumber || '—'), 'Amount of this Application: $' + (invoiceAmtFmt || '—')].join('\n')
  let body = projectSection + sep + ownerSection
  if ((form.cc || '').trim()) body += sep + 'CC: ' + (form.cc || '').trim()
  body += sep + claimantSection + sep + invoiceSection
  if ((form.descriptionOfWork || '').trim()) body += sep + 'Description of Work / Period Covered:' + '\n' + form.descriptionOfWork.trim()
  const lienStatusText = 'Lien Status Verification' + '\n' + 'Current status of any lien filings or pencil-copy documentation may be verified at any time by calling: ' + (form.lienStatusPhone || LIEN_RELEASE_DEFAULT_LIEN_PHONE)
  body += sep + conditionalWaiver + '\n' + 'Payment Terms & Late Payment Consequences:' + '\n' + paymentTerms + '\n' + lienStatusText
  return lines.join('\n') + (lines.length > 0 ? '\n\n' : '') + body
}
