/**
 * Pure builder for the Bids RFI (Request For Information) document HTML.
 *
 * Extracted from `src/pages/Bids.tsx`. `RfiFormData` lives here as the canonical type so the
 * builder has no dependency on the page module; `Bids.tsx` re-imports it. No DOM/React/Supabase.
 */

import { addressLines, escapeHtml } from './htmlDoc'

export type RfiFormData = {
  bidSubmittedDate: string
  submittedTo: string
  companyName: string
  contactPerson: string
  phoneEmail: string
  responseRequestDate: string
  detailedDescription: string
  impactStatement: string
  checklistExactLocation?: boolean
  checklistWhatIssue?: boolean
  checklistReferenceDocs?: boolean
  checklistWhyUnclear?: boolean
  checklistProposedSolution?: boolean
  checklistImpactStatement?: boolean
}

export function buildRfiHtml(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: RfiFormData
): string {
  const br = '<br/>'
  const pStyle = 'margin: 0 0 0.5em 0'
  const customerAddr = addressLines(customerAddress).map((l) => escapeHtml(l)).join(br)
  const projectAddr = addressLines(projectAddress).map((l) => escapeHtml(l)).join(br)
  const customerBlock = '<strong>' + escapeHtml(customerName) + '</strong><br/>' + customerAddr
  const projectBlock = '<strong>' + escapeHtml(projectName) + '</strong><br/>' + projectAddr
  const paragraphs: string[] = [
    customerBlock + br + br + projectBlock,
    '',
    'Bid was submitted: ' + escapeHtml(form.bidSubmittedDate || '—') + br + 'The bid was submitted to ' + escapeHtml(form.submittedTo || '—'),
    '',
    'Response requested by ' + escapeHtml(form.responseRequestDate || '—'),
    '',
    '<strong>Question/Issue</strong>',
    escapeHtml(form.detailedDescription || '').replace(/\n/g, br) || '—',
    '',
    '<strong>Impact</strong>',
    escapeHtml(form.impactStatement || '').replace(/\n/g, br) || '—',
    '',
    'From ' + escapeHtml(form.companyName || '—') + br + escapeHtml(form.contactPerson || '—') + br + escapeHtml(form.phoneEmail || '—'),
  ]
  return '<div style="white-space: pre-wrap">' + paragraphs.map((p) => (p ? '<p style="' + pStyle + '">' + p + '</p>' : '<p style="' + pStyle + '">&nbsp;</p>')).join('') + '</div>'
}

export function buildRfiText(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: RfiFormData
): string {
  const lines: string[] = [
    customerName,
    ...addressLines(customerAddress),
    '',
    projectName,
    ...addressLines(projectAddress),
    '',
    'Bid was submitted: ' + (form.bidSubmittedDate || '—') + '\nThe bid was submitted to ' + (form.submittedTo || '—'),
    '',
    'Response requested by ' + (form.responseRequestDate || '—'),
    '',
    'Question/Issue',
    form.detailedDescription || '—',
    '',
    'Impact',
    form.impactStatement || '—',
    '',
    'From ' + (form.companyName || '—') + '\n' + (form.contactPerson || '—') + '\n' + (form.phoneEmail || '—'),
  ]
  return lines.join('\n')
}
