import { describe, expect, it } from 'vitest'
import { sentAttachmentFileName, sentAttachmentPath, sentAttachmentType, sentCopyKeptHtml, sentEmailAddresses, sentEmailCopyHtml, sentEmailRow } from '../../../supabase/functions/_shared/sentCopyEmail'
import { buildGcTradeEmail } from '../../../supabase/functions/_shared/gcTradeEmail'

const ID = '11111111-2222-4333-8444-555555555555'
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const INV = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const msg = {
  to: ['ap@gc.example', ' AP@gc.example '],
  cc: ['pm@gc.example'],
  from: 'Click Plumbing <billing@click.example>',
  subject: ' Invoice 273-2 ',
  html: '<p>Your bill is attached.</p>',
  attachments: [{ filename: 'Invoice 273-2.pdf', content: 'QUJD' }],
  resendEmailId: 're_123',
}

describe('sentEmailRow', () => {
  it('writes the email with who it went to, the jobs and the record it came from', () => {
    const row = sentEmailRow(ID, { kind: 'bill', jobIds: [JOB, JOB, 'nope'], customerId: null, source: { table: 'jobs_ledger_invoices', id: INV }, sentBy: USER }, msg, {
      copyPath: `${ID}/copy.html`,
      copyHash: 'abc',
      copyBytes: 900,
      attachments: [{ name: 'Invoice 273-2.pdf', path: `${ID}/1-Invoice-273-2.pdf`, type: 'application/pdf', bytes: 3 }],
    })
    expect(row).toMatchObject({
      id: ID,
      kind: 'bill',
      title: 'Invoice 273-2',
      how: 'email',
      recipient_emails: ['ap@gc.example', 'pm@gc.example'],
      subject: 'Invoice 273-2',
      job_ids: [JOB],
      source_table: 'jobs_ledger_invoices',
      source_id: INV,
      copy_path: `${ID}/copy.html`,
      copy_type: 'text/html',
      copy_hash: 'abc',
      copy_bytes: 900,
      attachments: [{ name: 'Invoice 273-2.pdf', path: `${ID}/1-Invoice-273-2.pdf`, type: 'application/pdf', bytes: 3 }],
      resend_email_id: 're_123',
      sent_by: USER,
    })
  })

  it('still writes the row when the page was not kept, takes a given title, and names no source without an id', () => {
    const row = sentEmailRow(ID, { kind: 'lien_notice', title: ' § 53.056 notice ', recipientName: ' Umar Khan ', source: { table: 'job_lien_filings', id: null } }, msg, { copyPath: null, copyHash: 'abc', copyBytes: 900, attachments: [] })
    expect(row).toMatchObject({ title: '§ 53.056 notice', recipient_name: 'Umar Khan', copy_path: null, copy_type: '', copy_hash: '', copy_bytes: null, source_table: '', source_id: null, sent_by: null })
  })

  it('refuses a kind the table would refuse', () => {
    expect(sentEmailRow(ID, { kind: 'Bill Email' }, msg, { copyPath: null, copyHash: '', copyBytes: null, attachments: [] })).toBeNull()
  })
})

describe('sentEmailCopyHtml', () => {
  it('puts who it went to above the message, escaped', () => {
    const html = sentEmailCopyHtml({ ...msg, subject: 'Bill <2>' })
    expect(html).toContain('<b>From</b> Click Plumbing &lt;billing@click.example&gt;')
    expect(html).toContain('<b>To</b> ap@gc.example')
    expect(html).toContain('<b>Cc</b> pm@gc.example')
    expect(html).toContain('<b>Subject</b> Bill &lt;2&gt;')
    expect(html).toContain('<b>Attached</b> Invoice 273-2.pdf')
    expect(html.indexOf('<b>Subject</b>')).toBeLessThan(html.indexOf('<p>Your bill is attached.</p>'))
  })

  it('goes inside a full document\'s own body, and draws an inline image in place', () => {
    const html = sentEmailCopyHtml({
      to: ['a@b.example'],
      subject: 'Pay here',
      html: '<!doctype html><html><body class="x"><img src="cid:qr1"></body></html>',
      attachments: [{ filename: 'qr.png', content: 'UE5H', content_id: 'qr1' }],
    })
    expect(html.startsWith('<!doctype html><html><body class="x"><div style=')).toBe(true)
    expect(html).toContain('<img src="data:image/png;base64,UE5H">')
    // An inline image is part of the message, not a file the office opens.
    expect(html).not.toContain('<b>Attached</b>')
  })
})

describe('attachments and addresses', () => {
  it('keeps each file under a safe, numbered name with its type', () => {
    expect(sentAttachmentPath(ID, 0, '../Invoice 273-2 (final).pdf')).toBe(`${ID}/1-Invoice-273-2-final-.pdf`)
    expect(sentAttachmentFileName('')).toBe('attachment')
    expect(sentAttachmentType('Invoice.PDF')).toBe('application/pdf')
    // Never a page: an .html attachment is kept as plain bytes.
    expect(sentAttachmentType('notice.html')).toBe('application/octet-stream')
  })

  it('lists each address once', () => {
    expect(sentEmailAddresses(['a@b.example', ' A@B.example', '', 'c@d.example'])).toEqual(['a@b.example', 'c@d.example'])
  })
})

describe('sentCopyKeptHtml (punch list #85, item 21)', () => {
  it('keeps the law firm\u2019s link out of its filed copy, and leaves every other kind alone', () => {
    const html = '<a href="https://clicktooling.com/legal?t=tok_SECRET123">Open</a> https://clicktooling.com/legal?x=1&amp;t=tok_SECRET123 .'
    const kept = sentCopyKeptHtml('legal_firm_link', html)
    expect(kept).not.toContain('tok_SECRET123')
    expect(kept).toContain('/legal?t=…"')
    expect(kept).toContain('&amp;t=…')
    expect(sentCopyKeptHtml('bill', html)).toBe(html)
    const short = '<a href="https://my.clickplumbing.com/snell-law-firm-k4tp9x2mq7zr">Open</a> my.clickplumbing.com/snell-law-firm-k4tp9x2mq7zr'
    expect(sentCopyKeptHtml('legal_firm_link', short)).toBe('<a href="https://my.clickplumbing.com/…">Open</a> my.clickplumbing.com/…')
  })

  it('keeps a trade partner\u2019s portal link out of its filed copy: /t/… and never the token', () => {
    const token = 'a'.repeat(32) + '0123456789abcdef0123456789abcdef'
    const { html } = buildGcTradeEmail({ lang: 'en', recipients: ['Dana Ortiz'], company: 'Sample Electric Co.', subject: 'Plans', lines: ['Addendum 1 is out.'], linkUrl: `https://clicktooling.com/t/${token}`, signer: 'Avery Lin', gc: 'Click Construction' })
    expect(html).toContain(token)
    const kept = sentCopyKeptHtml('gc_trade_email', html)
    expect(kept).not.toContain(token)
    expect(kept).not.toMatch(/\/t\/[A-Za-z0-9]/)
    expect(kept).toContain('href="https://clicktooling.com/t/…"')
    expect(kept).toContain('>https://clicktooling.com/t/…</p>')
    expect(sentCopyKeptHtml('gc_plan_question', html)).toBe(html)
  })
})
