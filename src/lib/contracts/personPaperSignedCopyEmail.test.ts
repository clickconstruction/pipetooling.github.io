/** The signer's own copy of a paper they signed (punch list #376): who gets one, and what it says. Every name is made up. */
import { describe, expect, it } from 'vitest'
import { buildSignedCopyEmail, signedCopyFileName, signedCopyHold } from '../../../supabase/functions/_shared/personPaperSignedCopyEmail'

const signed = { status: 'signed', doc_type: 'agreement', signer_email: 'dana@example.com', signed_copy_sent_at: null }

describe('who gets a copy', () => {
  it('is the signer of a signed agreement, at the address the send kept', () => {
    expect(signedCopyHold(signed)).toBeNull()
    expect(signedCopyHold({ ...signed, doc_type: null })).toBeNull()
  })

  it('is nobody for a paper that waits, a kind that is never emailed, no address, or a copy already sent', () => {
    expect(signedCopyHold({ ...signed, status: 'sent' })).toBe('not_signed')
    for (const kind of ['hours_statement', 'w9', 'coi', 'license', 'other']) expect(signedCopyHold({ ...signed, doc_type: kind })).toBe('kind')
    expect(signedCopyHold({ ...signed, signer_email: null })).toBe('no_address')
    expect(signedCopyHold({ ...signed, signer_email: 'not an address' })).toBe('no_address')
    expect(signedCopyHold({ ...signed, signed_copy_sent_at: '2026-11-20T15:00:00Z' })).toBe('sent_already')
  })
})

describe('the copy', () => {
  it('names the attached file after the paper, safe for a file', () => {
    expect(signedCopyFileName('Subcontractor Agreement')).toBe('Subcontractor Agreement - signed.pdf')
    expect(signedCopyFileName('W/E: “Terms” <2026>')).toBe('W E Terms 2026 - signed.pdf')
    expect(signedCopyFileName('  ')).toBe('Agreement - signed.pdf')
  })

  it('says what was signed and when, and that the PDF is theirs to keep', () => {
    const mail = buildSignedCopyEmail({ documentName: 'Subcontractor Agreement', signerName: 'Dana Whitfield', signedLabel: 'Nov 20, 2026', company: 'Click Plumbing and Electrical', officePhone: '555-0100' })
    expect(mail.subject).toBe('Your signed copy: Subcontractor Agreement · Click Plumbing and Electrical')
    expect(mail.text).toBe(
      ['Click Plumbing and Electrical', '', 'Dana,', '', 'You signed Subcontractor Agreement on Nov 20, 2026.', 'Your copy is attached as a PDF. Keep it for your records.', '', 'Questions? Call or text the office at 555-0100.'].join('\n'),
    )
    expect(mail.html).toContain('Your signed copy')
    expect(mail.html).toContain('You signed Subcontractor Agreement on Nov 20, 2026.')
  })

  it('escapes a paper’s name in the page, and reads without a name, a day or a phone', () => {
    const mail = buildSignedCopyEmail({ documentName: 'Terms <A&B>', signerName: '', signedLabel: '', company: 'Click Plumbing and Electrical', officePhone: null })
    expect(mail.html).toContain('Terms &lt;A&amp;B&gt;')
    expect(mail.html).not.toContain('<A&B>')
    expect(mail.text).toContain('Hello,')
    expect(mail.text).toContain('You signed Terms <A&B>.')
    expect(mail.text).toContain('Questions? Call or text the office.')
  })
})
