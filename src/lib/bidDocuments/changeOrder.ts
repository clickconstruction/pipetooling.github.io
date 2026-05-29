/**
 * Pure builders for the Change Order document (HTML + plain text), extracted from `src/pages/Bids.tsx`.
 */

import { addressLines, escapeHtml } from './htmlDoc'

export type ChangeOrderFormData = {
  bidSubmittedDate: string
  submittedTo: string
  companyName: string
  contactPerson: string
  phoneEmail: string
  responseRequestDate: string
  detailedDescriptionOfChange: string
  reasonForChange: string
  impactOnCost: string
  impactOnSchedule: string
  checklistDetailedDesc?: boolean
  checklistExactWork?: boolean
  checklistReferences?: boolean
  checklistSupportingDetails?: boolean
  checklistReasonForChange?: boolean
  checklistCostBreakdown?: boolean
  checklistNetChange?: boolean
  checklistUpdatedTotal?: boolean
  checklistScheduleDuration?: boolean
  checklistRevisedDate?: boolean
  checklistScheduleJustification?: boolean
}

export function buildChangeOrderHtml(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: ChangeOrderFormData
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
    '<strong>Detailed Description of the Change</strong>',
    escapeHtml(form.detailedDescriptionOfChange || '').replace(/\n/g, br) || '—',
    '',
    '<strong>Reason for the Change</strong>',
    escapeHtml(form.reasonForChange || '').replace(/\n/g, br) || '—',
    '',
    '<strong>Impact on Cost (Contract Sum Adjustment)</strong>',
    escapeHtml(form.impactOnCost || '').replace(/\n/g, br) || '—',
    '',
    '<strong>Impact on Schedule (Contract Time Adjustment)</strong>',
    escapeHtml(form.impactOnSchedule || '').replace(/\n/g, br) || '—',
    '',
    'From ' + escapeHtml(form.companyName || '—') + br + escapeHtml(form.contactPerson || '—') + br + escapeHtml(form.phoneEmail || '—'),
  ]
  return '<div style="white-space: pre-wrap">' + paragraphs.map((p) => (p ? '<p style="' + pStyle + '">' + p + '</p>' : '<p style="' + pStyle + '">&nbsp;</p>')).join('') + '</div>'
}

export function buildChangeOrderText(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: ChangeOrderFormData
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
    'Detailed Description of the Change',
    form.detailedDescriptionOfChange || '—',
    '',
    'Reason for the Change',
    form.reasonForChange || '—',
    '',
    'Impact on Cost (Contract Sum Adjustment)',
    form.impactOnCost || '—',
    '',
    'Impact on Schedule (Contract Time Adjustment)',
    form.impactOnSchedule || '—',
    '',
    'From ' + (form.companyName || '—') + '\n' + (form.contactPerson || '—') + '\n' + (form.phoneEmail || '—'),
  ]
  return lines.join('\n')
}
