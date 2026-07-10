/**
 * Pure builders for the Bids cover-letter document (HTML for clipboard/print + plain text).
 *
 * Extracted from `src/pages/Bids.tsx`. No DOM, React, or Supabase access — callers pass in all
 * data. `numberToWords`, `serviceTypeWordForCoverLetter`, and the `DEFAULT_*` constants live here
 * because they are cover-letter concerns; `Bids.tsx` re-imports them where it still needs them.
 */

import { addressLines, escapeHtml } from './htmlDoc'
import { buildPaymentScheduleSectionLines, type PaymentScheduleRowInput } from './paymentSchedule'

/** Optional Schedule of Values section: rows + the contract amount the percents apply to. */
export type CoverLetterPaymentSchedule = { rows: PaymentScheduleRowInput[]; amountDollars: number }

/** Convert amount (e.g. 31420.50) to "Thirty One Thousand Four Hundred Twenty 50/100 Dollars" */
export function numberToWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount))
  const cents = Math.round((Math.abs(amount) - whole) * 100)
  const centsStr = String(cents).padStart(2, '0')
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function toHundreds(n: number): string {
    if (n === 0) return ''
    if (n < 20) return ONES[n] ?? ''
    if (n < 100) return (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + (ONES[n % 10] ?? '') : '')).trim()
    return ((ONES[Math.floor(n / 100)] ?? '') + ' Hundred' + (n % 100 ? ' ' + toHundreds(n % 100) : '')).trim()
  }
  function toWords(n: number): string {
    if (n === 0) return 'Zero'
    // Groups of three digits with scale words — the old thousands-only split fed
    // toHundreds values ≥ 1000 for amounts over $1M and produced garbage.
    const SCALES = ['', ' Thousand', ' Million', ' Billion', ' Trillion']
    const parts: string[] = []
    let remaining = n
    for (let idx = 0; remaining > 0 && idx < SCALES.length; idx++) {
      const group = remaining % 1000
      if (group) parts.unshift(toHundreds(group) + SCALES[idx])
      remaining = Math.floor(remaining / 1000)
    }
    return parts.join(' ').trim()
  }
  const words = toWords(whole)
  return `${words} ${centsStr}/100 Dollars`
}

export const DEFAULT_TERMS_AND_WARRANTY =
  'All work to be completed in a workmanlike manner in accordance with uniform code and/or specifications; workmanship warranty of one year for new construction projects considering substantial completion date. All material is guaranteed to be as specified; warranty by manufacturer, labor not included. No liability, no warranty on customer provided materials. All agreements contingent upon strikes, accidents or delays beyond our control. This estimate is subject to acceptance within thirty (30) days and is void thereafter at the option of Click Plumbing and Electrical. Any alteration or deviation from above specifications involving extra cost, including rock excavation and removal or haul-off of spoils or debris will become an extra charge over and above the estimate. Anything outside the scope of work described in this estimate, including any additional trips or visits beyond the standard rough-in, top-out, and trim phases, will be charged as a change order and will include a trip charge. Additionally, any trips or delays caused by builder, general contractor error, scheduling issues, or failure to provide timely access will be charged as a trip charge.'

export const DEFAULT_EXCLUSIONS = `Concrete cutting, removal, and/or pour back is excluded from this proposal.
This proposal excludes all impact fees.
This proposal excludes any work not specifically described within.
This proposal excludes any electrical, fire protection, fire alarm, drywall, framing, or architectural finishes of any type.`

/** Closing paragraph lines (before "Respectfully submitted…"); overridable per-org via app_settings. */
export const DEFAULT_COVER_LETTER_CLOSING =
  'No work shall commence until Click Plumbing and Electrical has received acceptance of the estimate.\nWork will not commence until building permit is issued and sent to Click Plumbing.'

function closingLinesFrom(closingParagraph: string | null): string[] {
  const src = closingParagraph?.trim() ? closingParagraph : DEFAULT_COVER_LETTER_CLOSING
  return src.split(/\n/).map((l) => l.trim()).filter(Boolean)
}

/** Service-type word for cover letter (plumbing/electrical/HVAC). "Click Plumbing and Electrical" is never changed. */
export function serviceTypeWordForCoverLetter(serviceTypeName: string): string {
  const name = (serviceTypeName ?? 'Plumbing').toLowerCase()
  if (name === 'electrical') return 'electrical'
  if (name === 'hvac') return 'HVAC'
  return 'plumbing'
}

export function buildCoverLetterHtml(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  revenueWords: string,
  revenueNumber: string,
  fixtureRows: { fixture: string; count: number }[],
  inclusions: string,
  exclusions: string,
  terms: string,
  designDrawingPlanDateFormatted: string | null,
  serviceTypeName: string,
  includeSignature = true,
  includeFixturesPerPlan = true,
  paymentSchedule: CoverLetterPaymentSchedule | null = null,
  closingParagraph: string | null = null
): string {
  const inclusionIndent = '     ' // 5 preceding spaces for Additional Inclusions (same as fixture header)
  const inclusionLines = inclusions.trim().split(/\n/).filter(Boolean).map((l) => inclusionIndent + '• ' + l.trim())
  const inclusionLinesToUse = inclusions.trim() ? inclusionLines : []
  const exclusionIndent = '     ' // 5 preceding spaces for Exclusions
  const exclusionLines = exclusions.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim())
  const termsLines = terms.trim().split(/\n/).filter(Boolean).map((l) => '• ' + l.trim())
  const fixtureBlock =
    fixtureRows.length > 0 && includeFixturesPerPlan
      ? '     • Fixtures provided and installed by us per plan:\n            ' + fixtureRows.map((r) => '• [' + r.count + '] ' + r.fixture).join('\n            ')
      : ''
  const inclusionsBlock = [fixtureBlock, ...inclusionLinesToUse].filter(Boolean).join('\n')
  const amountBold = `${revenueWords} (${revenueNumber})`
  const stWord = serviceTypeWordForCoverLetter(serviceTypeName)
  const revenueLinePrefix = `As per ${stWord} plans and specifications, we propose to do the ${stWord} in the amount of: `
  const br = '<br/>'
  const br2 = br + br
  // Single <p> + <br/> / <br/><br/> so Google Docs paste gets line breaks inside one paragraph (see clipboard full HTML doc).
  const customerAddr = addressLines(customerAddress).map((l) => escapeHtml(l)).join(br)
  const projectAddr = addressLines(projectAddress).map((l) => escapeHtml(l)).join(br)
  const customerBlock = '<strong>' + escapeHtml(customerName) + '</strong><br/>' + customerAddr
  const projectBlock = '<strong>' + escapeHtml(projectName) + '</strong><br/>' + projectAddr + br + br + (escapeHtml(revenueLinePrefix) + '<strong>' + escapeHtml(amountBold) + '</strong>')
  const exclusionsContent = exclusions.trim()
    ? exclusionLines.join('\n')
    : DEFAULT_EXCLUSIONS.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim()).join('\n')
  const termsContent = terms.trim() ? termsLines.join('\n') : DEFAULT_TERMS_AND_WARRANTY

  let html = customerBlock + br2 + projectBlock
  if (designDrawingPlanDateFormatted) {
    html += br2 + '<strong>Design Drawings Plan Date: ' + escapeHtml(designDrawingPlanDateFormatted) + '</strong>'
  }
  html += br2 + '<strong>Inclusions:</strong>' + br + escapeHtml(inclusionsBlock || '(none)').replace(/\n/g, br)
  html += br2 + '<strong>Exclusions and Scope:</strong>' + br + escapeHtml(exclusionsContent).replace(/\n/g, br)
  html += br2 + escapeHtml(termsContent).replace(/\n/g, br)
  const scheduleLines = paymentSchedule ? buildPaymentScheduleSectionLines(paymentSchedule.rows, paymentSchedule.amountDollars) : []
  if (scheduleLines.length > 0) {
    html += br2 + '<strong>' + escapeHtml(scheduleLines[0] ?? '') + '</strong>' + br + scheduleLines.slice(1).map((l) => escapeHtml(l)).join(br)
  }
  html += br2 + closingLinesFrom(closingParagraph).map((l) => escapeHtml(l)).join(br)
  html += br + escapeHtml('Respectfully submitted by Click Plumbing and Electrical')
  if (includeSignature) {
    html += br2 + escapeHtml('_______________________________')
    html += br + escapeHtml('The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.')
    html += br2 + '<strong>' + escapeHtml('Acceptance of estimate') + '</strong>'
    html += br + escapeHtml('General Contractor / Builder Signature:')
    html += br2 + escapeHtml('____________________________________')
    html += br2 + escapeHtml('Date: ____________________________________')
  }
  return '<p style="margin:0;line-height:1;white-space:pre-wrap">' + html + '</p>'
}

export function buildCoverLetterText(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  revenueWords: string,
  revenueNumber: string,
  fixtureRows: { fixture: string; count: number }[],
  inclusions: string,
  exclusions: string,
  terms: string,
  designDrawingPlanDateFormatted: string | null,
  serviceTypeName: string,
  includeSignature = true,
  includeFixturesPerPlan = true,
  paymentSchedule: CoverLetterPaymentSchedule | null = null,
  closingParagraph: string | null = null
): string {
  const inclusionIndent = '     ' // 5 preceding spaces for Additional Inclusions (same as fixture header)
  const inclusionLines = inclusions.trim().split(/\n/).filter(Boolean).map((l) => inclusionIndent + '• ' + l.trim())
  const inclusionLinesToUse = inclusions.trim() ? inclusionLines : []
  const exclusionIndent = '     ' // 5 preceding spaces for Exclusions
  const exclusionLines = exclusions.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim())
  const termsLines = terms.trim().split(/\n/).filter(Boolean).map((l) => '• ' + l.trim())
  const fixtureBlock =
    fixtureRows.length > 0 && includeFixturesPerPlan
      ? '     • Fixtures provided and installed by us per plan:\n            ' + fixtureRows.map((r) => '• [' + r.count + '] ' + r.fixture).join('\n            ')
      : ''
  const inclusionsBlock = [fixtureBlock, ...inclusionLinesToUse].filter(Boolean).join('\n')
  const stWord = serviceTypeWordForCoverLetter(serviceTypeName)
  const lines: string[] = [
    customerName,
    ...addressLines(customerAddress),
    '',
    projectName,
    ...addressLines(projectAddress),
    '',
    `As per ${stWord} plans and specifications, we propose to do the ${stWord} in the amount of: ${revenueWords} (${revenueNumber})`,
    '',
    ...(designDrawingPlanDateFormatted ? ['Design Drawings Plan Date: ' + designDrawingPlanDateFormatted, ''] : []),
    'Inclusions:',
    inclusionsBlock || '(none)',
    '',
    'Exclusions and Scope:',
    exclusions.trim() ? exclusionLines.join('\n') : DEFAULT_EXCLUSIONS.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim()).join('\n'),
    '',
    terms.trim() ? termsLines.join('\n') : DEFAULT_TERMS_AND_WARRANTY,
    ...(paymentSchedule && paymentSchedule.rows.length > 0
      ? ['', ...buildPaymentScheduleSectionLines(paymentSchedule.rows, paymentSchedule.amountDollars)]
      : []),
    '',
    ...closingLinesFrom(closingParagraph),
    'Respectfully submitted by Click Plumbing and Electrical',
    '',
    ...(includeSignature ? [
      '_______________________________',
      'The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.',
      '',
      'Acceptance of estimate',
      'General Contractor / Builder Signature:',
      '',
      '____________________________________',
      '',
      'Date: ____________________________________',
    ] : []),
  ]
  return lines.join('\n')
}

/**
 * Bundle several per-Pricing cover letters into one submission document. Each section is a full
 * cover letter (from buildCoverLetterHtml) headed by its Pricing label and separated by a page
 * break. A single section returns its html unchanged — identical to the un-bundled letter.
 */
export function buildCombinedCoverLetterDocument(sections: { label: string; html: string }[]): string {
  if (sections.length <= 1) return sections[0]?.html ?? ''
  return sections
    .map((s, i) => {
      const pageBreak = i < sections.length - 1 ? 'page-break-after: always;' : ''
      return `<section style="${pageBreak}">\n  <h2 style="font-size:1.1rem; margin:0 0 0.75rem;">${escapeHtml(s.label)}</h2>\n  ${s.html}\n</section>`
    })
    .join('\n')
}

/** Plain-text analog of buildCombinedCoverLetterDocument for the clipboard fallback. */
export function buildCombinedCoverLetterText(sections: { label: string; text: string }[]): string {
  if (sections.length <= 1) return sections[0]?.text ?? ''
  return sections.map((s) => `===== ${s.label} =====\n\n${s.text}`).join('\n\n\n')
}
