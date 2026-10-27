import { describe, expect, it } from 'vitest'
import { lienReleaseChips, lienReleaseIsEditable, lienReleaseSignatureAuditLine, lienReleaseStatus } from './lienReleaseLifecycle'
import { lienReleaseSteps } from './lienReleaseSteps'
import {
  buildLienWaiverEmailHtml,
  buildLienWaiverFootHtml,
  buildLienWaiverNotaryBlockHtml,
  buildLienWaiverPdfModel,
  type LienWaiverFields,
} from '../jobsDocuments/lienWaiverRelease'
import { buildLienReleaseEmailBodies } from '../sendLienReleaseEmail'

/**
 * Print for a notary (v2.5925): the held status, its chip, the notary_paper audit sentence, the
 * jurat block on the page and the PDF, the inkless foot, and the send email that links the
 * notarized copy.
 */

const FIELDS: LienWaiverFields = {
  companyName: 'Click Plumbing and Electrical',
  checkFrom: 'Southern Post Construction, LLC',
  amount: '3800',
  projectDescription: 'Take 5 Seguin — 380 TX-123, Seguin, TX 78155',
  throughDate: '',
  signedDate: '2026-10-28',
  signerName: 'Malachi Whites',
  signerTitle: 'Owner · Responsible Master Plumber',
}

describe('the held status', () => {
  it('out_for_notary is a real status: not editable, an amber chip, step 5 in hand with 1–4 folded', () => {
    expect(lienReleaseStatus({ status: 'out_for_notary' })).toBe('out_for_notary')
    expect(lienReleaseIsEditable({ status: 'out_for_notary' })).toBe(false)
    expect(lienReleaseChips({ status: 'out_for_notary', sent_to_customer_at: null, voided_at: null })).toEqual([{ label: 'out for notary', tone: 'awaiting' }])
    const { steps, current } = lienReleaseSteps({ billCount: 2, billsPicked: 1, covered: false, amount: 3800, tooEarly: false, detailsMissing: 0, rowStatus: 'out_for_notary', sent: false })
    expect(current?.n).toBe(5)
    expect(steps.slice(0, 4).every((s) => s.folded && s.state === 'done')).toBe(true)
  })
})

describe('the notary_paper signature', () => {
  it('the audit sentence names the notary and when the copy was filed, never a screen', () => {
    const line = lienReleaseSignatureAuditLine({ signed_at: '2026-10-28T15:05:00Z', signer_consented_at: null, signer_printed_name: 'Malachi Whites', signer_signature_mode: 'notary_paper' }, 'Wendi')
    expect(line).toContain('Signed in ink by Malachi Whites before a Notary Public of the State of Texas')
    expect(line).toContain('filed in ClickTooling')
    expect(line).not.toContain('screen')
  })

  it('the foot renders no cursive ink for notary_paper — the scan is the signature', () => {
    const html = buildLienWaiverFootHtml(FIELDS, { mode: 'notary_paper', printedName: 'Malachi Whites', auditLine: 'Signed in ink…', signedYmd: '2026-10-28' })
    expect(html).not.toContain('Great Vibes')
    expect(html).toContain('<strong>Malachi Whites</strong>')
  })
})

describe('the jurat block', () => {
  it('carries the venue, the sworn line naming the signer, and the (seal) space — never a stamp box', () => {
    const block = buildLienWaiverNotaryBlockHtml(FIELDS)
    expect(block).toContain('THE STATE OF TEXAS')
    expect(block).toContain('COUNTY OF ______________')
    expect(block).toContain('SUBSCRIBED AND SWORN TO BEFORE ME on this ____ day of ______________, 2026, by Malachi Whites.')
    expect(block).toContain('Notary Public, State of Texas')
    expect(block).toContain('(seal)')
    expect(block).not.toContain('STAMP')
  })

  it('the page and the PDF carry it only when asked', () => {
    expect(buildLienWaiverEmailHtml('conditional_final', FIELDS, null, { notary: true })).toContain('SUBSCRIBED AND SWORN')
    expect(buildLienWaiverEmailHtml('conditional_final', FIELDS, null)).not.toContain('SUBSCRIBED AND SWORN')
    const blocks = buildLienWaiverPdfModel('conditional_final', FIELDS, null, { notary: true })
    expect(blocks[blocks.length - 1]).toEqual({ kind: 'notary', signer: 'Malachi Whites', year: '2026' })
    expect(buildLienWaiverPdfModel('conditional_final', FIELDS, null).some((b) => b.kind === 'notary')).toBe(false)
  })
})

describe('the send email', () => {
  it('links the notarized copy in place of the attached-PDF line', () => {
    const withLink = buildLienReleaseEmailBodies({ formLabel: 'Conditional · final', projectDescription: 'Take 5 Seguin', amountLabel: '$3,800.00', notaryCopyUrl: 'https://drive.google.com/file/d/1aB2/view' })
    expect(withLink.text).toContain('signed in ink before a notary')
    expect(withLink.text).toContain('https://drive.google.com/file/d/1aB2/view')
    expect(withLink.html).toContain('href="https://drive.google.com/file/d/1aB2/view"')
    const without = buildLienReleaseEmailBodies({ formLabel: 'Conditional · final', projectDescription: 'Take 5 Seguin', amountLabel: '$3,800.00' })
    expect(without.text).toContain('The attached PDF is the complete, signed document')
    expect(without.text).not.toContain('notary')
  })
})
