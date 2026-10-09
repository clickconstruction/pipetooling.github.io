/**
 * The courtesy email, previewed (v2.5073, the owner's ask of 2026-10-09): what an envelope's
 * courtesy tick sends, drawn from the send's own builders, and the one body builder the email
 * function and the preview share.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { courtesyFileSizeWords, courtesyPreviewStripWords, runCourtesyEmails, runCourtesyPreviewHtml } from './lienRunCourtesyPreview'
import { runEnvelopes } from './runEnvelopes'
import type { RunNotice } from './lienDeskRun'
import { LIEN_FILING_REPLY_TO, lienFilingAttachmentName, lienFilingEmailHtml } from '../../../supabase/functions/_shared/lienFilingEmail'
import { COMPANY_EMAIL_FROM_LABEL } from '../customerEmailFrom'

function notice(partial: Partial<RunNotice> = {}): RunNotice {
  return {
    itemId: 'it1',
    jobId: 'j650',
    kind: 'notice_53_056',
    label: '650 · ATI Schertz',
    jobNumber: '650',
    months: ['2026-06', '2026-07'],
    amount: 33_500,
    fields: { noticeDate: '2026-10-09', projectDescription: 'ATI Schertz — 1204 Elbel Rd', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '5501 Balcones Dr' },
    extras: { refItems: ['Job #650'] },
    coverLetter: null,
    coverNote: null,
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '4 Example Way, Schertz, TX', email: 'owner@elbel.test', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '', courtesy: true },
    ],
    ...partial,
  }
}

const gcWith = (n: RunNotice, patch: Partial<RunNotice['recipients'][number]>): RunNotice => ({ ...n, recipients: n.recipients.map((r) => (r.key === 'original_contractor' ? { ...r, ...patch } : r)) })
const TEXT = 'Attached is a courtesy copy of our notice of claim for unpaid labor or materials (Tex. Prop. Code § 53.056). The notice itself is being delivered by certified mail. For questions call the office: (512) 360-0599'

describe('runCourtesyEmails · what an envelope’s tick sends', () => {
  it('the GC envelope sends its copy with the send’s words, body and file name; the owner’s envelope sends none', () => {
    const [owner, gc] = runEnvelopes([notice()])
    expect(runCourtesyEmails(owner!)).toEqual([])
    const [mail, ...rest] = runCourtesyEmails(gc!)
    expect(rest).toEqual([])
    expect(mail).toMatchObject({
      to: 'office@loberg.test',
      subject: 'Courtesy copy: notice of claim for unpaid labor or materials — 650 · ATI Schertz',
      text: TEXT,
      html: `<p>${TEXT}</p>`,
      filename: 'notice-53-056-650.pdf',
    })
    expect(mail!.recipient.key).toBe('original_contractor')
    expect(mail!.notice.itemId).toBe('it1')
  })

  it('an unticked copy is still shown; an envelope sent by email, or with no address, has no courtesy email', () => {
    expect(runCourtesyEmails(runEnvelopes([gcWith(notice(), { courtesy: false })])[1]!)).toHaveLength(1)
    expect(runCourtesyEmails(runEnvelopes([gcWith(notice(), { method: 'email' })])[1]!)).toEqual([])
    expect(runCourtesyEmails(runEnvelopes([gcWith(notice(), { email: '  ' })])[1]!)).toEqual([])
  })

  it('a GC envelope with two notices sends one email per notice, in packet order, each with its own subject and file', () => {
    const second = notice({ itemId: 'it2', jobId: 'j702', label: '702 · Quarry Bend', jobNumber: '702' })
    const gc = runEnvelopes([notice(), second]).find((e) => e.label === 'Original contractor')!
    expect(runCourtesyEmails(gc).map((m) => [m.subject, m.filename])).toEqual([
      ['Courtesy copy: notice of claim for unpaid labor or materials — 650 · ATI Schertz', 'notice-53-056-650.pdf'],
      ['Courtesy copy: notice of claim for unpaid labor or materials — 702 · Quarry Bend', 'notice-53-056-702.pdf'],
    ])
  })

  it('a courier envelope says so, and a retainage notice names its own form', () => {
    const [mail] = runCourtesyEmails(runEnvelopes([gcWith(notice({ kind: 'retainage_53_057' }), { method: 'traceable_courier' })])[1]!)
    expect(mail!.text).toBe('Attached is a courtesy copy of our notice of claim for unpaid retainage (Tex. Prop. Code § 53.057). The notice itself is being delivered by traceable courier. For questions call the office: (512) 360-0599')
    expect(mail!.filename).toBe('retainage-53-057-650.pdf')
  })
})

describe('the email function’s body and file name, shared', () => {
  it('escapes the text into one paragraph with its line breaks', () => {
    expect(lienFilingEmailHtml('a <b> c\nd')).toBe('<p>a &lt;b&gt; c<br/>d</p>')
  })
  it('cleans the attachment’s name the way the email carries it', () => {
    expect(lienFilingAttachmentName('notice 53.056 §-650.pdf')).toBe('notice_53.056__-650.pdf')
    expect(lienFilingAttachmentName('notice-53-056-650.pdf')).toBe('notice-53-056-650.pdf')
  })
})

describe('runCourtesyPreviewHtml · the tab', () => {
  const [gc] = runEnvelopes([notice()]).filter((e) => e.label === 'Original contractor')
  const emails = runCourtesyEmails(gc!)

  it('shows the email as it arrives: who it is from, to, the subject, the body as sent, and the PDF in the page', () => {
    const html = runCourtesyPreviewHtml(emails, { from: COMPANY_EMAIL_FROM_LABEL, ticked: true, attachments: [{ url: 'blob:https://app.test/pdf-1', bytes: 421_888 }] })
    expect(html).toContain('<title>Email preview — Courtesy copy: notice of claim for unpaid labor or materials — 650 · ATI Schertz</title>')
    expect(html).toContain('Preview — nothing has been sent. This email goes to office@loberg.test when you record the run, while Courtesy PDF stays ticked.')
    expect(html).toContain('<dt>From</dt><dd>Click Plumbing and Electrical &lt;team@noreply.clicktooling.com&gt;</dd>')
    expect(html).toContain('<dt>To</dt><dd>office@loberg.test</dd><dt>Replies to</dt><dd>office@clickplumbing.com</dd>')
    expect(html).toContain(`<div class="body" data-courtesy-preview-body><p>${TEXT}</p></div>`)
    expect(html).toContain('<span class="att-name">notice-53-056-650.pdf</span><span class="att-size">412 KB</span>')
    expect(html).toContain('<iframe class="pdf" src="blob:https://app.test/pdf-1" title="notice-53-056-650.pdf"></iframe>')
    expect(html).toContain('<a href="blob:https://app.test/pdf-1" target="_blank" rel="noopener" data-courtesy-preview-open>Open it in its own tab ›</a>')
    expect(html).not.toContain('Email 1 of')
  })

  it('escapes every value it writes, so a job’s name cannot become markup', () => {
    const odd = runCourtesyEmails(runEnvelopes([notice({ label: '650 · <b>Burd</b> & "Assoc"' })]).find((e) => e.label === 'Original contractor')!)
    const html = runCourtesyPreviewHtml(odd, { from: 'Click <team@x.test>', ticked: true, attachments: [{ url: 'blob:x"y', bytes: 10 }] })
    expect(html).toContain('— 650 · &lt;b&gt;Burd&lt;/b&gt; &amp; &quot;Assoc&quot;</h1>')
    expect(html).toContain('<dd>Click &lt;team@x.test&gt;</dd>')
    expect(html).toContain('src="blob:x&quot;y"')
    expect(html).not.toContain('<b>Burd</b>')
  })

  it('numbers the emails when the envelope sends several, and says so above them', () => {
    const second = notice({ itemId: 'it2', jobId: 'j702', label: '702 · Quarry Bend', jobNumber: '702' })
    const two = runCourtesyEmails(runEnvelopes([notice(), second]).find((e) => e.label === 'Original contractor')!)
    const html = runCourtesyPreviewHtml(two, { from: COMPANY_EMAIL_FROM_LABEL, ticked: true, attachments: [{ url: 'blob:1', bytes: 2048 }, { url: 'blob:2', bytes: 3_145_728 }] })
    expect(html).toContain('<title>Email preview — 2 courtesy emails</title>')
    expect(html).toContain('These 2 emails go to office@loberg.test when you record the run, one per notice, while Courtesy PDF stays ticked.')
    expect(html.indexOf('Email 1 of 2')).toBeLessThan(html.indexOf('Email 2 of 2'))
    expect(html.indexOf('notice-53-056-650.pdf')).toBeLessThan(html.indexOf('notice-53-056-702.pdf'))
    expect(html).toContain('<span class="att-size">3.0 MB</span>')
  })

  it('an unticked box says the email will not go; a PDF that did not build says so in place of the page', () => {
    const html = runCourtesyPreviewHtml(emails, { from: COMPANY_EMAIL_FROM_LABEL, ticked: false, attachments: [{ error: 'jsPDF failed' }] })
    expect(html).toContain('<div class="strip off" data-courtesy-preview-strip>Preview — nothing has been sent. Courtesy PDF is not ticked, so this email will not go. Tick it in the run window to send it.</div>')
    expect(html).toContain('The PDF could not be built here: jsPDF failed.')
    expect(html).not.toContain('<iframe')
  })

  it('sizes read as a mail app shows them', () => {
    expect(courtesyFileSizeWords(500)).toBe('500 bytes')
    expect(courtesyFileSizeWords(421_888)).toBe('412 KB')
    expect(courtesyFileSizeWords(1_258_291)).toBe('1.2 MB')
    expect(courtesyPreviewStripWords([{ to: 'a@x.test' }, { to: 'b@x.test' }], false)).toBe('Preview — nothing has been sent. Courtesy PDF is not ticked, so these 2 emails will not go. Tick it in the run window to send them.')
  })
})

describe('send-lien-filing-email, as written', () => {
  const src = readFileSync(resolve(__dirname, '../../../supabase/functions/send-lien-filing-email/index.ts'), 'utf8')
  it('builds the body and the attachment’s name with the shared builders the preview draws with', () => {
    expect(src).toContain("lienFilingAttachmentName, lienFilingEmailHtml } from '../_shared/lienFilingEmail.ts'")
    expect(src).toContain('const htmlBody = lienFilingEmailHtml(textPlain)')
    expect(src).toContain('filename: lienFilingAttachmentName(pdfFilename)')
    expect(src).not.toContain(".replace(/</g, '&lt;')")
  })
  it('sends every lien email with the office as its reply-to (v2.5092), the address the preview names', () => {
    expect(LIEN_FILING_REPLY_TO).toBe('office@clickplumbing.com')
    expect(src).toContain("import { LIEN_FILING_REPLY_TO, lienFilingAttachmentName, lienFilingEmailHtml } from '../_shared/lienFilingEmail.ts'")
    expect(src).toContain('reply_to: LIEN_FILING_REPLY_TO,')
  })
})
