import { describe, expect, it } from 'vitest'
import { lienReleaseChips, lienReleaseIsEditable, lienReleaseNotaryPrint, lienReleaseSignatureAuditLine, lienReleaseSignedHow, lienReleaseStatus } from './lienReleaseLifecycle'
import { lienReleaseSteps } from './lienReleaseSteps'
import {
  buildLienWaiverEmailHtml,
  buildLienWaiverFootHtml,
  buildLienWaiverNotaryBlockHtml,
  buildLienWaiverPdfModel,
  type LienWaiverFields,
} from '../jobsDocuments/lienWaiverRelease'
import { buildLienReleaseEmailBodies, MAX_PDF_BASE64_CHARS } from '../sendLienReleaseEmail'
import { lienReleaseNotaryCopyPdfPath } from './lienReleaseDocuments'
import { lienReleaseNotaryCopy, NOTARY_COPY_MAX_BYTES, notaryCopyFileProblem, notaryCopyPdfFilename, resumesNotaryHold } from './lienReleaseNotaryCopy'

/**
 * Print for a notary (v2.5925): the held status, its chip, the notary_paper audit sentence, the
 * jurat block on the page and the PDF, the inkless foot, and the send email that links the
 * notarized copy. v2.5985 (the online-notary study's phase 0): the notarized PDF itself on the
 * record — which copy a row holds, the file the window takes, where it is stored, the email that
 * attaches it, and the held waiver the window opens on again.
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

  it('Print for a notary holds an issued waiver; from the hold it is a reprint that keeps the hold (v2.6006)', () => {
    expect(lienReleaseNotaryPrint({ status: 'issued' })).toEqual({ kind: 'hold', from: ['issued', 'draft'] })
    expect(lienReleaseNotaryPrint({ status: 'draft' })).toEqual({ kind: 'hold', from: ['issued', 'draft'] })
    // The held row is out_for_notary: an update matched on issued found no row and the reprint toasted an alarm.
    expect(lienReleaseNotaryPrint({ status: 'out_for_notary' })).toEqual({ kind: 'reprint', from: ['out_for_notary'] })
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

describe('the notarized PDF itself (v2.5985)', () => {
  const RELEASE_ID = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'

  it('the stored file wins over the link, and only a waiver signed before a notary has a copy', () => {
    expect(lienReleaseNotaryCopy({ signer_signature_mode: 'notary_paper', notary_copy_path: ' r1/notary-copy-1.pdf ', notary_copy_url: 'https://drive.google.com/x' })).toEqual({ path: 'r1/notary-copy-1.pdf', url: 'https://drive.google.com/x' })
    expect(lienReleaseNotaryCopy({ signer_signature_mode: 'notary_paper', notary_copy_url: 'https://drive.google.com/x' })).toEqual({ path: null, url: 'https://drive.google.com/x' })
    expect(lienReleaseNotaryCopy({ signer_signature_mode: 'notary_paper', notary_copy_path: '', notary_copy_url: '  ' })).toBeNull()
    expect(lienReleaseNotaryCopy({ signer_signature_mode: 'code', notary_copy_path: 'r1/notary-copy-1.pdf' })).toBeNull()
    expect(lienReleaseNotaryCopy(null)).toBeNull()
  })

  it('takes a PDF up to 4 MB, and names what is wrong with anything else', () => {
    expect(notaryCopyFileProblem({ name: 'Take 5 notarized.pdf', type: 'application/pdf', size: 312_000 })).toBeNull()
    // Some browsers hand a PDF over with no type: the name decides.
    expect(notaryCopyFileProblem({ name: 'scan.PDF', type: '', size: 900_000 })).toBeNull()
    expect(notaryCopyFileProblem({ name: 'IMG_2231.jpg', type: 'image/jpeg', size: 900_000 })).toBe('Pick the PDF the notary sent back. A photo or a scan in another format will not attach.')
    expect(notaryCopyFileProblem({ name: 'empty.pdf', type: 'application/pdf', size: 0 })).toBe('That PDF is empty. Pick the file the notary sent back.')
    expect(notaryCopyFileProblem({ name: 'big.pdf', type: 'application/pdf', size: 6_240_000 })).toBe('That PDF is 6.2 MB. An email carries 4 MB at most. Put it on Google Drive and paste the link instead.')
    expect(notaryCopyFileProblem({ name: 'edge.pdf', type: 'application/pdf', size: NOTARY_COPY_MAX_BYTES })).toBeNull()
    expect(notaryCopyFileProblem({ name: 'edge.pdf', type: 'application/pdf', size: NOTARY_COPY_MAX_BYTES + 1 })).toContain('An email carries 4 MB at most')
  })

  it('the largest file it takes still fits the send email once in base64', () => {
    expect(Math.ceil(NOTARY_COPY_MAX_BYTES / 3) * 4).toBeLessThanOrEqual(MAX_PDF_BASE64_CHARS)
  })

  it('stores it in the release’s own folder under a new name each time, in the shape the CHECK admits', () => {
    const path = lienReleaseNotaryCopyPdfPath(RELEASE_ID, 1_793_116_800_000)
    expect(path).toBe(`${RELEASE_ID}/notary-copy-1793116800000.pdf`)
    expect(lienReleaseNotaryCopyPdfPath(RELEASE_ID, 1_793_116_800_001)).not.toBe(path)
    // job_lien_releases_notary_copy_path_check (migration 20261027180000), as Postgres reads it.
    expect(new RegExp(`^${RELEASE_ID}/[A-Za-z0-9._-]+\\.pdf$`).test(path)).toBe(true)
  })

  it('the emailed file is the waiver’s own name, marked notarized', () => {
    expect(notaryCopyPdfFilename('lien-release-conditional-final-878.pdf')).toBe('lien-release-conditional-final-878-notarized.pdf')
  })

  it('the audit sentence claims no ink for a stored PDF: an online notary may have sealed it electronically', () => {
    const base = { signed_at: '2026-10-28T15:05:00Z', signer_consented_at: null, signer_printed_name: 'Malachi Whites', signer_signature_mode: 'notary_paper' }
    const line = lienReleaseSignatureAuditLine({ ...base, notary_copy_path: 'r1/notary-copy-1.pdf' })
    expect(line).toBe('Signed by Malachi Whites before a Notary Public of the State of Texas; the signed copy was filed in ClickTooling on Oct 28, 2026 at 10:05 AM CT.')
    expect(lienReleaseSignatureAuditLine(base)).toContain('Signed in ink by Malachi Whites')
  })

  it('step 5’s summary claims no ink either when the PDF is on the record, as the audit sentence and the email do (v2.6006)', () => {
    expect(lienReleaseSignedHow('notary_paper', null)).toBe(' · in ink before a notary')
    expect(lienReleaseSignedHow('notary_paper', null, 'r1/notary-copy-1.pdf')).toBe(' · before a notary')
    expect(lienReleaseSignedHow('notary_paper', null, '  ')).toBe(' · in ink before a notary')
    expect(lienReleaseSignedHow('notary_paper', 'Wendi', 'r1/notary-copy-1.pdf')).toBe(' · before a notary')
  })

  it('the email attaches the notarized PDF and drops the link line, even when a link is on file too', () => {
    const b = buildLienReleaseEmailBodies({ formLabel: 'Conditional · final', projectDescription: 'Take 5 Seguin', amountLabel: '$3,800.00', notaryCopyUrl: 'https://drive.google.com/file/d/1aB2/view', notaryCopyAttached: true })
    expect(b.text).toBe('Attached is the signed release of lien (Conditional · final, $3,800.00) for Take 5 Seguin.\n\nThis release was signed before a notary. The attached PDF is the signed, notarized copy.')
    expect(b.html).toContain('<p>This release was signed before a notary. The attached PDF is the signed, notarized copy.</p>')
    expect(b.text).not.toContain('drive.google.com')
    expect(b.html).not.toContain('href=')
  })

  it('the window opens on a held waiver when it opens on its bill and form, or on none', () => {
    const held = { status: 'out_for_notary', voided_at: null, invoice_ids: ['b1'], form_type: 'conditional_final' }
    expect(resumesNotaryHold(held, { invoiceIds: [], formType: null })).toBe(true)
    expect(resumesNotaryHold(held, { invoiceIds: ['b1'], formType: null })).toBe(true)
    expect(resumesNotaryHold(held, { invoiceIds: ['b1'], formType: 'conditional_final' })).toBe(true)
    // Another bill, or the unconditional follow-up on the same bill, is a different waiver: the held one waits in the list.
    expect(resumesNotaryHold(held, { invoiceIds: ['b2'], formType: null })).toBe(false)
    expect(resumesNotaryHold(held, { invoiceIds: ['b1'], formType: 'unconditional_final' })).toBe(false)
    expect(resumesNotaryHold({ ...held, voided_at: '2026-10-28T15:00:00Z' }, { invoiceIds: [], formType: null })).toBe(false)
    expect(resumesNotaryHold({ ...held, status: 'issued' }, { invoiceIds: [], formType: null })).toBe(false)
  })
})
