import { describe, expect, it } from 'vitest'
import { decodeHeaderWords, emlToText, htmlWords, isEmlFile } from '../../../supabase/functions/_shared/emlText'

/**
 * An email file's words (punch list #285, PR 1): a .eml on an evidence record is read the way a mail client shows it —
 * the kept headers, the text parts decoded, each attachment named — never its base64. Made-up mail: a foreman writing
 * about the Maple Court townhomes.
 */

const PLAIN = ['From: Pat Doe <pat@example.test>', 'To: office@example.test', 'Date: Tue, 3 Nov 2026 09:12:00 -0600', 'Subject: Maple Court rough-in', 'Message-ID: <abc@example.test>', 'Content-Type: text/plain; charset=utf-8', '', 'The rough-in on building B is done.', 'Inspection Thursday.'].join('\r\n')

const MIXED = [
  'From: =?utf-8?Q?Pat_Doe?= <pat@example.test>',
  'To: office@example.test',
  'Subject: =?utf-8?B?TWFwbGUgQ291cnQgwrcgY2hhbmdlIG9yZGVy?=',
  'Content-Type: multipart/mixed; boundary="outer"',
  '',
  'This is a multipart message.',
  '--outer',
  'Content-Type: multipart/alternative; boundary="inner"',
  '',
  '--inner',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'The GC agreed to the extra rock =E2=80=94 see the =',
  'attached letter.',
  '--inner',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<html><body><p>The GC <b>agreed</b> to the extra rock.</p></body></html>',
  '--inner--',
  '--outer',
  'Content-Type: application/pdf; name="Rock clause letter.pdf"',
  'Content-Disposition: attachment; filename="Rock clause letter.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+',
  '--outer--',
  '',
].join('\n')

describe('emlToText', () => {
  it('a plain mail: the kept headers, then the body; Message-ID and the content type are not words', () => {
    const text = emlToText(PLAIN)
    expect(text).toBe(['From: Pat Doe <pat@example.test>', 'To: office@example.test', 'Date: Tue, 3 Nov 2026 09:12:00 -0600', 'Subject: Maple Court rough-in', '', 'The rough-in on building B is done.', 'Inspection Thursday.'].join('\n'))
    expect(text).not.toContain('Message-ID')
  })

  it('a MIME mail: the plain part decoded over the HTML twin, encoded words read, the attachment named and its base64 left out', () => {
    const text = emlToText(MIXED)
    expect(text).toContain('From: Pat Doe <pat@example.test>')
    expect(text).toContain('Subject: Maple Court · change order')
    expect(text).toContain('The GC agreed to the extra rock — see the attached letter.')
    expect(text).not.toContain('<b>agreed</b>')
    expect(text).toContain('File: Rock clause letter.pdf')
    expect(text).not.toContain('JVBERi0')
    expect(text).not.toContain('This is a multipart message.')
  })

  it('a mail with an HTML part alone keeps its words; a file with no headers is returned as it stands', () => {
    const html = ['From: a@example.test', 'Content-Type: text/html', '', '<p>Line one<br>Line &amp; two</p><style>p{color:red}</style>'].join('\n')
    expect(emlToText(html)).toBe('From: a@example.test\n\nLine one\nLine & two')
    expect(emlToText('just some words\n')).toBe('just some words')
  })

  it('a base64 text part is decoded in its charset', () => {
    const b64 = ['From: a@example.test', 'Content-Type: text/plain; charset="utf-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from('Señor Doe signed.').toString('base64')].join('\n')
    expect(emlToText(b64)).toContain('Señor Doe signed.')
  })
})

describe('the small readers', () => {
  it('decodeHeaderWords reads B and Q encoded words and folds the spaces', () => {
    expect(decodeHeaderWords('=?utf-8?Q?Pat_Doe?=   <pat@example.test>')).toBe('Pat Doe <pat@example.test>')
    expect(decodeHeaderWords('=?utf-8?B?TWFwbGU=?= Court')).toBe('Maple Court')
  })
  it('htmlWords drops tags, scripts and styles and reads entities', () => {
    expect(htmlWords('<div>A &lt; B</div><script>x()</script><p>C&nbsp;D</p>')).toBe('A < B\nC D')
  })
  it('isEmlFile by kind or by name', () => {
    expect(isEmlFile({ name: 'call.eml', mimeType: 'application/octet-stream' })).toBe(true)
    expect(isEmlFile({ name: 'mail', mimeType: 'message/rfc822' })).toBe(true)
    expect(isEmlFile({ name: 'notes.txt', mimeType: 'text/plain' })).toBe(false)
  })
})
